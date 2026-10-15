/**
 * core/vars.js —— 剧本变量容器（内核层）
 *
 * 设计要点：
 *  - 两个命名空间：变量本体（顶层） + 标记 flags（flags.xxx），两者都会存档。
 *  - builtins 是「只读的派生视图」：章节可以注册 `好感层级` 这种便于写剧本的别名。
 *    它不参与存档，每次读的时候现算，所以永远不会和真相不一致。
 *  - 变量只存 JSON 可序列化的值（数字 / 字符串 / 布尔 / 数组 / 普通对象），
 *    这样存档就是一次 JSON.stringify，换引擎、换浏览器都不会烂。
 */

import { clampNumber, clone, isPlainObject } from './util.js';

const MAX_CHANGE = 1e6;
const MAX_HISTORY = 200;

export class StoryVars {
  /**
   * @param {object} [initial] 初始变量
   * @param {Record<string, () => any>} [builtins] 派生只读量
   */
  constructor(initial = {}, builtins = {}) {
    this.raw = clone(initial) ?? {};
    if (!isPlainObject(this.raw)) this.raw = {};
    if (!isPlainObject(this.raw.flags)) this.raw.flags = {};
    this.builtins = { ...builtins };
    /** 最近一次变更记录，调试面板与「快速回退」用 */
    this.history = [];
  }

  /* ------------------------------ 基础读写 ------------------------------ */

  get(key, fallback = 0) {
    if (key === undefined) return fallback;
    if (key in this.builtins) return this.builtins[key]();
    const value = this.raw[key];
    return value === undefined ? fallback : value;
  }

  set(key, value) {
    if (typeof key !== 'string' || key === '' || key === '__proto__' || key === 'prototype') return;
    this.raw[key] = this.normalize(value);
    this.record('set', key, this.raw[key]);
  }

  has(key) {
    return key in this.raw || key in this.builtins;
  }

  /** 数值增减，返回新值（脚本里最常用） */
  change(key, delta = 1, { min = -MAX_CHANGE, max = MAX_CHANGE } = {}) {
    const next = clampNumber(Number(this.raw[key] ?? 0) + Number(delta || 0), min, max);
    this.raw[key] = next;
    this.record('change', key, next);
    return next;
  }

  /* -------------------------------- 标记 -------------------------------- */

  getFlag(name) {
    return this.raw.flags?.[name];
  }

  setFlag(name, value = true) {
    if (typeof name !== 'string' || name === '') return;
    this.raw.flags[name] = value === undefined ? true : this.normalize(value);
    this.record('flag', name, this.raw.flags[name]);
  }

  hasFlag(name) {
    return !!this.raw.flags?.[name];
  }

  get flags() {
    return this.raw.flags;
  }

  /* ------------------------------ 批量应用 ------------------------------ */

  /**
   * 应用一条 effect 声明。声明可以是：
   *   "affection += 1"            —— 算术
   *   "flag:met_yuki"             —— 置标记（等价 flag:met_yuki=true）
   *   "flag:route=kaede"          —— 标记赋值
   *   "name = '小雪'"             —— 赋值（字符串要用引号）
   *   { set: {a: 1}, change: {b: 2}, flag: ['x'], unflag: ['y'] }  —— 对象形式
   * 返回实际发生的变更列表，验证器会检查这些 key 是否在声明过的变量白名单里。
   */
  applyAll(effects) {
    const applied = [];
    const list = Array.isArray(effects) ? effects : effects ? [effects] : [];
    for (const effect of list) {
      try {
        applied.push(...this.applyOne(effect));
      } catch (err) {
        applied.push({ kind: 'error', effect, message: err?.message ?? String(err) });
      }
    }
    return applied;
  }

  applyOne(effect) {
    if (effect === null || effect === undefined) return [];

    if (typeof effect === 'string') {
      const source = effect.trim();
      if (!source) return [];

      if (source.startsWith('flag:')) {
        const body = source.slice(5);
        const eq = body.indexOf('=');
        if (eq === -1) {
          this.setFlag(body.trim());
          return [{ kind: 'flag', key: body.trim(), value: true }];
        }
        const name = body.slice(0, eq).trim();
        const rawValue = body.slice(eq + 1).trim();
        const value = rawValue === '' ? true : this.parseLiteral(rawValue);
        this.setFlag(name, value);
        return [{ kind: 'flag', key: name, value }];
      }

      if (source.startsWith('unflag:')) {
        const name = source.slice(7).trim();
        this.setFlag(name, false);
        return [{ kind: 'flag', key: name, value: false }];
      }

      // 赋值 / 算术
      const match = source.match(/^([A-Za-z_$\u4e00-\u9fff][\w$\u4e00-\u9fff.]*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/);
      if (!match) return [{ kind: 'error', effect, message: `无法解析的 effect: ${source}` }];

      const [, path, operator, rawValue] = match;
      const value = this.parseLiteral(rawValue.trim());

      if (path.startsWith('flags.')) {
        const name = path.slice(6);
        if (operator === '=') {
          this.setFlag(name, value);
          return [{ kind: 'flag', key: name, value }];
        }
        const base = Number(this.getFlag(name) ?? 0);
        const next = this.compute(base, operator, value);
        this.setFlag(name, next);
        return [{ kind: 'flag', key: name, value: next }];
      }

      if (operator === '=') {
        this.set(path, value);
        return [{ kind: 'set', key: path, value }];
      }
      const next = this.compute(Number(this.get(path, 0) ?? 0), operator, value);
      this.set(path, next);
      return [{ kind: 'change', key: path, value: next }];
    }

    if (isPlainObject(effect)) {
      const applied = [];
      for (const [key, value] of Object.entries(effect.set ?? {})) {
        this.set(key, value);
        applied.push({ kind: 'set', key, value: this.get(key) });
      }
      for (const [key, value] of Object.entries(effect.change ?? {})) {
        const next = this.change(key, value);
        applied.push({ kind: 'change', key, value: next });
      }
      for (const name of toArray(effect.flag)) {
        this.setFlag(name, true);
        applied.push({ kind: 'flag', key: name, value: true });
      }
      for (const name of toArray(effect.unflag)) {
        this.setFlag(name, false);
        applied.push({ kind: 'flag', key: name, value: false });
      }
      for (const [name, value] of Object.entries(effect.flags ?? {})) {
        this.setFlag(name, value);
        applied.push({ kind: 'flag', key: name, value });
      }
      return applied;
    }

    return [{ kind: 'error', effect, message: '不支持的 effect 类型' }];
  }

  /* ------------------------------ 派生只读量 ---------------------------- */

  defineBuiltin(name, getter) {
    this.builtins[name] = typeof getter === 'function' ? getter : () => getter;
  }

  /** 只读的求值作用域（供 expr.js 使用） */
  get scope() {
    return new Proxy(
      {},
      {
        has: () => true,
        get: (_, key) => {
          if (typeof key === 'symbol') return undefined;
          if (key in this.builtins) return this.builtins[key]();
          const value = this.raw[key];
          return value === undefined ? 0 : value;
        },
        set: (_, key, value) => {
          if (typeof key === 'string') this.set(key, value);
          return true;
        },
        ownKeys: () => [...new Set([...Object.keys(this.builtins), ...Object.keys(this.raw)])],
        getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
      },
    );
  }

  /* -------------------------------- 存档 -------------------------------- */

  /** 只导出可序列化的真相（不含 builtins / history） */
  serialize() {
    return clone(this.raw);
  }

  restore(snapshot) {
    if (!isPlainObject(snapshot)) return;
    this.raw = clone(snapshot);
    if (!isPlainObject(this.raw.flags)) this.raw.flags = {};
    this.history = [];
  }

  /** 调试用：单行摘要 */
  summary() {
    const entries = Object.entries(this.raw)
      .filter(([key]) => key !== 'flags')
      .map(([key, value]) => `${key}=${format(value)}`);
    const flags = Object.entries(this.raw.flags ?? {})
      .filter(([, value]) => !!value)
      .map(([key]) => `✔${key}`);
    return [...entries, ...flags].join('  ');
  }

  /* ------------------------------- 内部实现 ----------------------------- */

  parseLiteral(raw) {
    if (raw === '') return '';
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return raw.slice(1, -1);
    }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    const num = Number(raw);
    if (raw !== '' && Number.isFinite(num)) return num;
    return raw; // 当作裸字符串（剧本里写 name=小雪 也能work）
  }

  compute(base, operator, operand) {
    const value = Number(operand) || 0;
    switch (operator) {
      case '+=':
        return clampNumber(base + value);
      case '-=':
        return clampNumber(base - value);
      case '*=':
        return clampNumber(base * value);
      case '/=':
        return clampNumber(value === 0 ? 0 : base / value);
      default:
        return clampNumber(value);
    }
  }

  normalize(value) {
    if (typeof value === 'number') return clampNumber(value);
    if (typeof value === 'string' || typeof value === 'boolean' || value === null) return value;
    return clone(value);
  }

  record(kind, key, value) {
    this.history.push({ kind, key, value });
    if (this.history.length > MAX_HISTORY) this.history.shift();
  }
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function format(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (typeof value === 'object') return Array.isArray(value) ? `[${value.length}]` : '{…}';
  return String(value);
}
