/**
 * core/util.js —— 零依赖工具集（不碰 DOM，不打日志）
 *
 * 本文件属于「内核层」：它永远不认识任何章节、任何角色。
 * 章节要用的东西，一律通过模块导出的工厂函数注入进去。
 */

/** 索引器：把数组或 {id:...} 对象统一变成 (key) => item | undefined */
export function keyed(collection) {
  if (!collection) return () => undefined;
  if (Array.isArray(collection)) return (key) => collection[key];
  return (key) => collection[key];
}

/** 是否是普通对象 */
export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 深合并：b 覆盖 a；对象递归、数组整体替换。
 * 用于「章节配置覆盖全局默认配置」这类场景。
 */
export function deepMerge(a, b) {
  if (!isPlainObject(a) || !isPlainObject(b)) return b === undefined ? a : b;
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) {
    out[key] = isPlainObject(value) && isPlainObject(a[key]) ? deepMerge(a[key], value) : value;
  }
  return out;
}

/** 节流：同一帧内多次调用只执行最后一次 */
export function rafThrottle(fn) {
  let pending = false;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (pending) return;
    pending = true;
    const run = () => {
      pending = false;
      fn(...lastArgs);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 16);
  };
}

/** 睡眠（可被 AbortSignal 打断） */
export function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    }
  });
}

/** 转义 HTML —— 正文允许写 <b> 这类标签，所以只在「纯文本」字段上用它 */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON 深拷贝，失败时退回浅拷贝 */
export function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return Array.isArray(value) ? value.slice() : { ...value };
  }
}

/**
 * 在允许范围内把 n 解析成整数。
 * 表达式求值的每一步都会被夹范围，避免 `1e9` 之类把内存吃爆。
 */
export function clampNumber(n, min = -1e6, max = 1e6) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.min(max, Math.max(min, num));
}

/** 递归冻结（只用于默认配置，避免章节误改全局） */
export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) deepFreeze(value);
  }
  return obj;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 中英混排的字数估算：CJK 记 1，拉丁按 2 个字符 1 个字 */
export function textWeight(text) {
  const raw = String(text ?? '');
  let weight = 0;
  for (const ch of raw) weight += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.5;
  return weight;
}

/** 打字机时长（毫秒） */
export function typingDuration(text, cps = 45) {
  const speed = Math.max(5, Number(cps) || 45);
  return Math.min(20000, Math.max(0, Math.round((textWeight(text) / speed) * 1000)));
}

/** 自动播放停留时长（毫秒） */
export function autoWaitDuration(text, cps = 45, extra = 1100) {
  return typingDuration(text, cps) + extra;
}

export { keyed as makeIndex };
