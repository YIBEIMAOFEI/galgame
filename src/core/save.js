/**
 * core/save.js —— 存档系统（内核层）
 *
 * - 只做「序列化好的对象 <-> localStorage / 文件」这一件事，不认识剧情。
 * - 多槽位 + 一份自动存档（auto）+ 一份「章节进度」（解锁哪些章节）。
 * - 提供 export/import：玩家能把存档导出成 JSON 文件带走，
 *   服务器换域名、换机器都不丢档 —— 纯静态站也能有「云存档」的替代品。
 */

import { clone, isPlainObject } from './util.js';

export const SAVE_VERSION = 1;

export const SLOT_META = [
  { id: 'auto', label: '自动存档' },
  { id: 'quick', label: '快速存档' },
  { id: 'slot1', label: '存档 1' },
  { id: 'slot2', label: '存档 2' },
  { id: 'slot3', label: '存档 3' },
  { id: 'slot4', label: '存档 4' },
  { id: 'slot5', label: '存档 5' },
  { id: 'slot6', label: '存档 6' },
];

const PROGRESS_KEY = 'gal:progress';
const SETTINGS_KEY = 'gal:settings';

export class SaveManager {
  /**
   * @param {object} [options]
   * @param {string} [options.namespace] 存储前缀，多个游戏共用域名时用得上
   * @param {Storage} [options.storage]  可注入（Node 测试里传内存实现）
   * @param {string} [options.gameVersion]
   */
  constructor({ namespace = 'gal', storage, gameVersion = '0.1.0', slots = SLOT_META } = {}) {
    this.namespace = namespace;
    this.gameVersion = gameVersion;
    this.slots = slots;
    this.storage = storage ?? defaultStorage();
    this.available = !!this.storage;
    this.memory = new Map();
    /** 写入失败（隐私模式 / 配额满）时的告警 */
    this.onError = () => {};
  }

  /* ------------------------------- 键值底座 ------------------------------ */

  key(slot) {
    return `${this.namespace}:save:${slot}`;
  }

  readRaw(key) {
    if (!this.storage) return this.memory.get(key) ?? null;
    try {
      return this.storage.getItem(key);
    } catch {
      return this.memory.get(key) ?? null;
    }
  }

  writeRaw(key, value) {
    this.memory.set(key, value);
    if (!this.storage) return false;
    try {
      this.storage.setItem(key, value);
      return true;
    } catch (err) {
      this.onError(err);
      return false;
    }
  }

  removeRaw(key) {
    this.memory.delete(key);
    try {
      this.storage?.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  /* -------------------------------- 存档 -------------------------------- */

  /**
   * 写档。
   * @param {string} slot 'auto' | 'quick' | 'slot1'... | 'auto:ch01' 这类自定义名
   * @param {object} payload 任意可序列化状态
   * @param {object} [meta]  显示用元数据（章节标题、时间、缩略图等）
   */
  save(slot, payload, meta = {}) {
    const record = {
      version: SAVE_VERSION,
      gameVersion: this.gameVersion,
      slot,
      savedAt: new Date().toISOString(),
      meta: { ...meta },
      payload: clone(payload),
    };
    const ok = this.writeRaw(this.key(slot), JSON.stringify(record));
    return { ok, record };
  }

  /** 读档；不存在或版本过旧返回 null */
  load(slot) {
    const raw = this.readRaw(this.key(slot));
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      if (!isPlainObject(record) || !record.payload) return null;
      if (record.version > SAVE_VERSION) return { ...record, unsupported: true };
      return record;
    } catch {
      return null;
    }
  }

  has(slot) {
    return !!this.readRaw(this.key(slot));
  }

  remove(slot) {
    this.removeRaw(this.key(slot));
  }

  /** 列出全部槽位状态，存读档界面直接用 */
  listSlots({ chapterTitleById = {} } = {}) {
    return this.slots.map((slot) => {
      const record = this.load(slot.id);
      return {
        ...slot,
        empty: !record,
        savedAt: record?.savedAt ?? null,
        chapterId: record?.payload?.chapterId ?? record?.meta?.chapterId ?? null,
        chapterTitle: chapterTitleById[record?.payload?.chapterId] ?? record?.meta?.chapterTitle ?? null,
        preview: record?.meta?.preview ?? null,
        playTimeMs: record?.payload?.playTimeMs ?? 0,
      };
    });
  }

  /** 最近一次存档（用于标题界面的「继续游戏」） */
  latest() {
    let best = null;
    for (const slot of this.slots) {
      const record = this.load(slot.id);
      if (!record?.savedAt) continue;
      if (!best || record.savedAt > best.savedAt) best = { ...record, slot: slot.id };
    }
    return best;
  }

  /* ------------------------------ 进度 / 设置 --------------------------- */

  progress() {
    const raw = this.readRaw(`${this.namespace}:progress`);
    if (!raw) return { unlocked: {}, cleared: {}, endings: {} };
    try {
      const parsed = JSON.parse(raw);
      return {
        unlocked: isPlainObject(parsed.unlocked) ? parsed.unlocked : {},
        cleared: isPlainObject(parsed.cleared) ? parsed.cleared : {},
        endings: isPlainObject(parsed.endings) ? parsed.endings : {},
      };
    } catch {
      return { unlocked: {}, cleared: {}, endings: {} };
    }
  }

  /** 章节通关：解锁后续章节、记录达成的结局 */
  markCleared(chapterId, { endingId = null, nextChapterIds = [] } = {}) {
    const progress = this.progress();
    progress.cleared[chapterId] = new Date().toISOString();
    for (const next of nextChapterIds) {
      if (next) progress.unlocked[next] = true;
    }
    if (endingId) progress.endings[endingId] = new Date().toISOString();
    this.writeRaw(`${this.namespace}:progress`, JSON.stringify(progress));
    return progress;
  }

  /** 通关某章节前需不需要先解锁（章节 manifest 里的 requireCleared） */
  isUnlocked(chapter, progress = this.progress()) {
    if (!chapter?.unlockAfter) return true;
    const chain = Array.isArray(chapter.unlockAfter) ? chapter.unlockAfter : [chapter.unlockAfter];
    return chain.every((id) => !!progress.cleared[id]);
  }

  /* ------------------------------- 设置项 ------------------------------- */

  settings(defaults = {}) {
    const raw = this.readRaw(SETTINGS_KEY);
    let stored = {};
    if (raw) {
      try {
        stored = JSON.parse(raw) ?? {};
      } catch {
        stored = {};
      }
    }
    return { ...defaults, ...(isPlainObject(stored) ? stored : {}) };
  }

  saveSettings(settings) {
    return this.writeRaw(SETTINGS_KEY, JSON.stringify(settings));
  }

  /* ------------------------------ 导入 / 导出 --------------------------- */

  exportAll() {
    const dump = { kind: 'gal-save-archive', version: SAVE_VERSION, exportedAt: new Date().toISOString(), saves: {} };
    for (const slot of this.slots) {
      const record = this.load(slot.id);
      if (record) dump.saves[slot.id] = record;
    }
    dump.progress = this.progress();
    dump.settings = this.settings({});
    return JSON.stringify(dump, null, 2);
  }

  importAll(json, { merge = true } = {}) {
    let dump;
    try {
      dump = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (err) {
      return { ok: false, error: `不是合法 JSON: ${err.message}` };
    }
    if (!isPoolObjectLike(dump) || dump.kind !== 'gal-save-archive') {
      return { ok: false, error: '文件不是本游戏的存档包' };
    }

    let imported = 0;
    for (const [slot, record] of Object.entries(dump.saves ?? {})) {
      if (!merge && !this.slots.some((item) => item.id === slot)) continue;
      if (isPlainObject(record) && record.payload) {
        this.writeRaw(this.key(slot), JSON.stringify(record));
        imported += 1;
      }
    }
    if (isPlainObject(dump.progress)) {
      const current = this.progress();
      this.writeRaw(
        `${this.namespace}:progress`,
        JSON.stringify({
          unlocked: { ...current.unlocked, ...dump.progress.unlocked },
          cleared: { ...current.cleared, ...dump.progress.cleared },
          endings: { ...current.endings, ...dump.progress.endings },
        }),
      );
    }
    if (isPlainObject(dump.settings)) {
      this.writeRaw(SETTINGS_KEY, JSON.stringify({ ...this.settings({}), ...dump.settings }));
    }
    return { ok: true, imported };
  }

  wipe() {
    for (const slot of this.slots) this.remove(slot);
    this.removeRaw(`${this.namespace}:progress`);
    this.removeRaw(SETTINGS_KEY);
  }
}

function isPoolObjectLike(value) {
  return !!value && typeof value === 'object';
}

function defaultStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__gal_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}
