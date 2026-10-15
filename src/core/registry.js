/**
 * core/registry.js —— 章节注册表（模块化动态加载的入口）
 *
 * 这里是「玩家玩到对应章节才加载对应文件夹」真正发生的地方：
 *
 *   chapters/index.js            ← 章节清单（只有标题和顺序，几百字节）
 *          │  玩家点了第 2 章
 *          ▼
 *   import(`${base}/chapters/ch02/index.js`)   ← 此刻才下载这一章的代码
 *          │  章节模块 export default {...}
 *          ▼
 *   本章声明的 assets → 逐个请求图片/音频    ← 此刻才下载这一章的美术
 *
 * 关键点：
 *   1. 目录清单（index.js）与实际内容（ch02/）解耦，不再用的章节删掉即可，
 *      清单里没有的文件夹不会被打包/加载，也不会 404；
 *   2. 加载失败（网络抖动、文件被删、语法错误）只影响这一章，
 *      内核把错误收下来，菜单里这一章显示为「不可用」，其他章节照常能玩；
 *   3. 已加载的章节会缓存，二次进入零请求。
 */

import { isPlainObject } from './util.js';
import { normalizeChapter, ScriptError } from './story.js';
import { validateChapter } from './validate.js';

export class ChapterRegistry {
  /**
   * @param {object} options
   * @param {import('./paths.js').PathResolver} options.paths
   * @param {(url: string, options?: object) => Promise<any>} [options.importModule] 可注入（测试用）
   * @param {(message: string, level?: string) => void} [options.log]
   */
  constructor({ paths, importModule, log = () => {}, engineVersion = '1.0.0' } = {}) {
    this.paths = paths;
    this.importModule = importModule ?? ((url) => import(/* @vite-ignore */ url));
    this.log = log;
    this.engineVersion = engineVersion;

    /** @type {Map<string, object>} 已加载并归一化的章节 */
    this.loaded = new Map();
    /** @type {Map<string, Promise<object>>} 进行中的加载 */
    this.pending = new Map();
    /** @type {Map<string, object>} 加载失败记录 */
    this.failures = new Map();

    /** @type {object[]} 清单（chapters/index.js 导出） */
    this.entries = [];
    this.manifestLoaded = false;
    /** @type {Record<string, object>} 角色表 */
    this.characters = {};
    this.charactersLoaded = false;
  }

  /* ------------------------------ 章节清单 ----------------------------- */

  get entryIndex() {
    return Object.fromEntries(this.entries.map((entry) => [entry.id, entry]));
  }

  /** 读取 chapters/index.js（清单）。这个模块必须非常小、非常稳，不依赖任何资源。 */
  async loadManifest({ force = false } = {}) {
    if (this.manifestLoaded && !force) return this.entries;
    const url = this.paths.absolute(`${this.paths.config.chapters}/index.js`);
    try {
      const module = await this.importModule(url);
      const list = module.chapters ?? module.default ?? [];
      if (!Array.isArray(list)) throw new Error('chapters/index.js 必须导出 chapters 数组');
      this.entries = list
        .filter((entry) => isPlainObject(entry) && entry.id)
        .map((entry) => ({
          status: 'released',
          ...entry,
          order: entry.order ?? 0,
          title: entry.title ?? entry.id,
        }))
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      this.manifestLoaded = true;
    } catch (err) {
      this.manifestLoaded = true;
      this.entries = [];
      this.manifestError = err;
      this.log(`⚠️ 章节清单加载失败: ${err.message}`, 'error');
    }
    return this.entries;
  }

  async loadCharacters({ force = false } = {}) {
    if (this.charactersLoaded && !force) return this.characters;
    const url = this.paths.charactersFile();
    try {
      const module = await this.importModule(url);
      const data = module.default ?? module.characters ?? module;
      this.characters = isPlainObject(data) ? data : {};
      this.charactersLoaded = true;
    } catch (err) {
      this.charactersLoaded = true;
      this.characters = {};
      this.charactersError = err;
      this.log(`⚠️ 角色表加载失败: ${err.message}`, 'error');
    }
    return this.characters;
  }

  getCharacter(id) {
    return this.characters[id] ?? null;
  }

  /** 角色显示名（找不到就原样返回 id，界面不会崩） */
  displayName(id) {
    return this.characters[id]?.name ?? id;
  }

  /* ------------------------------- 加载章节 ---------------------------- */

  /**
   * 按需加载章节。同一个章节并发调用只会真正加载一次。
   * @param {string} chapterId
   * @param {object} [options]
   * @param {boolean} [options.validate] 加载后是否做结构校验（默认 true，开销很小）
   * @param {boolean} [options.force] 忽略缓存重新加载（开发热重载用）
   */
  async load(chapterId, { validate = true, force = false } = {}) {
    if (!chapterId) throw new ScriptError('缺少 chapterId');
    if (force) {
      this.loaded.delete(chapterId);
      this.pending.delete(chapterId);
      this.failures.delete(chapterId);
    }

    const cached = this.loaded.get(chapterId);
    if (cached) return cached;
    if (this.pending.has(chapterId)) return this.pending.get(chapterId);

    const task = this.#loadModule(chapterId, { validate });
    this.pending.set(chapterId, task);
    try {
      const chapter = await task;
      this.loaded.set(chapterId, chapter);
      this.failures.delete(chapterId);
      return chapter;
    } catch (err) {
      this.failures.set(chapterId, { id: chapterId, error: err, at: new Date().toISOString() });
      this.log(`✖ 章节 ${chapterId} 加载失败: ${err.message}`, 'error');
      throw err;
    } finally {
      this.pending.delete(chapterId);
    }
  }

  async #loadModule(chapterId, { validate }) {
    if (!this.charactersLoaded) await this.loadCharacters();
    const url = this.paths.chapterEntry(chapterId);
    const module = await this.importModule(url);
    const definition = module.default ?? module.chapter ?? module;

    // 章节可以自带「只在本章出现」的角色（路人、回忆里的某人）。
    // 先合并进角色表再归一化，剧本里就能直接用；卸载本章时它们留在表里也无害
    // （只是章节选择界面多几个用不到的名字，比每章都要重新注册简单得多）。
    const chapterCharacters = isPlainObject(definition?.characters) ? definition.characters : {};
    const scopedCharacters = { ...this.characters, ...chapterCharacters };

    const chapter = normalizeChapter(definition, {
      chapterId,
      knownCharacters: scopedCharacters,
      engineVersion: this.engineVersion,
    });

    const entry = this.entryIndex[chapterId];
    if (entry) {
      chapter.title = definition.title ?? entry.title ?? chapter.title;
      chapter.order = entry.order ?? chapter.order;
      chapter.status = entry.status ?? chapter.status;
      chapter.next = definition.next ?? entry.next ?? chapter.next;
      chapter.unlockAfter = definition.unlockAfter ?? entry.unlockAfter ?? chapter.unlockAfter;
      chapter.summary = definition.summary ?? entry.summary ?? chapter.summary;
    }

    chapter.url = url;
    chapter.loadedAt = Date.now();
    this.characters = scopedCharacters;

    if (validate) {
      const report = await validateChapter(chapter, {
        characters: this.characters,
        knownVars: new Set(['playerName', 'affection', 'trust', 'route', ...Object.keys(chapter.vars ?? {})]),
      });
      chapter.report = report;
      for (const issue of report.errors) this.log(`✖ ${issue.where ?? chapterId}: ${issue.message}`, 'error');
      for (const issue of report.warnings) this.log(`⚠ ${issue.where ?? chapterId}: ${issue.message}`, 'warn');
      if (!report.ok) {
        const error = new ScriptError(`章节 ${chapterId} 结构校验未通过（${report.errors.length} 个错误）`, {
          chapter: chapterId,
        });
        error.report = report;
        // 仍然把章节挂上去：开发模式下可以「强制进入」看看到底哪句话炸了
        chapter.invalid = true;
      }
    }

    return chapter;
  }

  /** 预取（玩家在菜单上悬停 / 读到章末时，趁空档先把下一章代码拉下来） */
  prefetch(chapterId) {
    if (!chapterId || this.loaded.has(chapterId) || this.pending.has(chapterId)) return;
    this.load(chapterId, { validate: false }).catch(() => {});
  }

  /* ------------------------------- 查询 ------------------------------- */

  has(chapterId) {
    return this.loaded.has(chapterId);
  }

  get(chapterId) {
    return this.loaded.get(chapterId) ?? null;
  }

  /**
   * 供菜单渲染：合并清单信息 + 加载状态 + 解锁状态。
   * status:'hidden' 的章节（结局分支）会被过滤掉 —— 它们只能从剧本里跳进去，
   * 不出现在章节选择界面。这样「结局不是选出来的」才有说服力。
   */
  async list({ progress = null, includeHidden = false } = {}) {
    const entries = await this.loadManifest();
    const cleared = progress?.cleared ?? {};
    const endings = progress?.endings ?? {};

    return entries
      .filter((entry) => includeHidden || entry.status !== 'hidden')
      .map((entry) => {
        const loaded = this.loaded.get(entry.id);
        const failure = this.failures.get(entry.id);
        const locked = entry.unlockAfter
          ? !(Array.isArray(entry.unlockAfter) ? entry.unlockAfter : [entry.unlockAfter]).every((id) => !!cleared[id])
          : false;
        return {
          ...entry,
          loaded: !!loaded,
          invalid: !!loaded?.invalid,
          failure: failure ? failure.error?.message ?? String(failure.error) : null,
          locked,
          cleared: !!cleared[entry.id],
          endingCount: loaded ? Object.keys(loaded.endings).length : (entry.endings ?? 0),
          achieved: loaded
            ? Object.keys(loaded.endings).filter((id) => !!endings[id]).length
            : Object.keys(endings).filter((id) => id.startsWith(`${entry.id}:`)).length,
        };
      });
  }

  /** 调试面板用 */
  status() {
    return {
      manifest: this.entries.length,
      loaded: [...this.loaded.keys()],
      pending: [...this.pending.keys()],
      failures: [...this.failures.values()].map((failure) => ({
        id: failure.id,
        message: failure.error?.message ?? String(failure.error),
      })),
      characters: Object.keys(this.characters),
    };
  }
}
