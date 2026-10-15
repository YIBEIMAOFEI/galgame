/**
 * core/loader.js —— 按需资源加载器（图片 / 音频 / JSON）
 *
 * 这就是「玩家玩到对应章节才加载对应素材」那句话的落点：
 *   - 图片与音频只有被显式请求（或章节声明 preload）时才发起网络请求；
 *   - 加载结果进缓存，第二次进入同一章节是零请求的；
 *   - 每个 URL 的加载状态都记在 stats 里，调试面板和构建期校验都读它；
 *   - **永远不会因为一张图 404 就崩掉整局游戏**：失败会返回 null 并通知 onError，
 *     上层用「占位提示 + 继续走剧情」兜底。
 *
 * 注意：这里刻意不用 DOM，只依赖 createImage / createAudio 两个可注入的工厂，
 * 所以 Node 里也能直接跑（tools/validate.mjs 就是这么做的）。
 */

import { isPlainObject } from './util.js';
import { ASSET_EXT, PathResolver } from './paths.js';

const MERGE_WINDOW_MS = 90;
const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

export class AssetLoader {
  /**
   * @param {object} options
   * @param {PathResolver} options.paths
   * @param {string} [options.manifestUrl] 可选：构建期扫描出的清单（assets/manifest.json）
   * @param {boolean} [options.verify]   是否用 HEAD 探测文件是否存在（开发模式建议开）
   * @param {(info: {url: string, kind: string, status: string, error?: any}) => void} [options.onError]
   */
  constructor({ paths, manifestUrl, verify, onError, chapters = [] } = {}) {
    this.paths = paths ?? new PathResolver();
    this.chapters = chapters;
    this.onError = typeof onError === 'function' ? onError : () => {};
    this.verify = verify === undefined ? !this.paths.config.strict : !!verify;
    this.manifestUrl = manifestUrl ?? null;

    /** @type {Map<string, HTMLImageElement>} */
    this.images = new Map();
    /** @type {Map<string, HTMLAudioElement>} */
    this.audio = new Map();
    /** @type {Map<string, Promise<any>>} 同一资源的并发请求合并 */
    this.pending = new Map();
    /** @type {Map<string, object>} 加载状态台账 */
    this.entries = new Map();
    /** 构建期清单：url -> {bytes, ext}；有它就不需要 HEAD 探测 */
    this.manifest = null;
    this.manifestLoaded = false;
    this.stats = { requested: 0, loaded: 0, failed: 0, bytes: 0, probes: 0 };
  }

  /* ------------------------------ 清单与探测 ----------------------------- */

  /** 尝试读取 assets/manifest.json；没有也不影响运行（只是会多几次 HEAD 探测） */
  async loadManifest() {
    if (this.manifestLoaded) return this.manifest;
    this.manifestLoaded = true;
    const url = this.manifestUrl ?? this.paths.absolute(`${this.paths.config.assets}/manifest.json`);
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) return null;
      const data = await response.json();
      if (isPlainObject(data?.files)) this.manifest = data;
      return this.manifest;
    } catch {
      return null;
    }
  }

  /** 清单里有没有这个相对路径（用来跳过探测） */
  manifestHas(relative) {
    return !!this.manifest?.files?.[relative];
  }

  /**
   * 探测真实扩展名。探测模式的核心：
   * 优先查清单 -> 否则 HEAD 依次试候选扩展名 -> 命中后写回 PathResolver，
   * 之后所有同 id 的资源都是零探测直达。
   */
  async resolveUrl(kind, spec = {}) {
    const resolved = this.paths.resolve(kind, spec);
    const { relative, candidates } = resolved;

    // 强制扩展名 / 自定义模板 / 严格模式：不需要探测
    if (!candidates || candidates.length === 0 || spec.ext || this.paths.config.strict) return resolved;

    if (this.manifest) {
      for (const ext of candidates) {
        if (this.manifestHas(`${relative}.${ext}`)) {
          this.paths.rememberExt(relative, ext);
          return { ...resolved, url: this.paths.absolute(`${this.paths.config.assets}/${relative}.${ext}`), ext };
        }
      }
      return { ...resolved, missing: true };
    }

    if (!this.verify || typeof fetch !== 'function') return resolved;

    if (!this.probeCache) this.probeCache = new Map();
    // 缓存键带上候选列表：改了扩展名配置也不会吃到旧结果的亏
    const cacheKey = `${relative}|${candidates.join(',')}`;
    const cached = this.probeCache.get(cacheKey);
    if (cached !== undefined) {
      if (cached === null) return { ...resolved, missing: true };
      return {
        ...resolved,
        url: this.paths.absolute(`${this.paths.config.assets}/${relative}.${cached}`),
        ext: cached,
      };
    }

    for (const ext of candidates) {
      const probeUrl = this.paths.absolute(`${this.paths.config.assets}/${relative}.${ext}`);
      this.stats.probes += 1;
      try {
        const response = await fetch(probeUrl, { method: 'HEAD' });
        if (response.ok) {
          this.probeCache.set(cacheKey, ext);
          this.paths.rememberExt(relative, ext);
          return { ...resolved, url: probeUrl, ext };
        }
      } catch {
        /* 探测失败就试下一个 */
      }
    }

    this.probeCache.set(cacheKey, null);
    return { ...resolved, missing: true };
  }

  /* -------------------------------- 图片 -------------------------------- */

  async image(kind, spec = {}) {
    const { url, relative, missing } = await this.resolveUrl(kind, spec);
    if (missing) return this.fail(url, kind, new Error(`资源不存在: ${relative}`), spec);

    const cached = this.images.get(url);
    if (cached) return cached;
    if (this.pending.has(url)) return this.pending.get(url);

    const task = this.loadImage(url, kind, relative, spec);
    this.pending.set(url, task);
    try {
      return await task;
    } finally {
      this.pending.delete(url);
    }
  }

  loadImage(url, kind, label, spec) {
    this.track(url, kind, 'loading', spec);
    const promise = new Promise((resolve) => {
      const ImageCtor = this.createImage ?? (IS_BROWSER ? window.Image : null);
      if (!ImageCtor) {
        resolve(this.fail(url, kind, new Error('当前环境不支持图片加载')));
        return;
      }
      const element = new ImageCtor();
      if ('decoding' in element) element.decoding = 'async';
      if (label && kind === 'sprite') element.alt = label;

      element.onload = () => {
        this.images.set(url, element);
        this.stats.loaded += 1;
        this.track(url, kind, 'loaded', spec);
        resolve(element);
      };
      element.onerror = () => {
        resolve(this.fail(url, kind, new Error(`图片加载失败: ${url}`), spec));
      };
      element.src = url;
    });
    return promise;
  }

  /** 预加载一批图片；返回 {loaded, failed, missing} */
  async preload(requests = [], { onProgress } = {}) {
    const list = (Array.isArray(requests) ? requests : [requests]).filter(Boolean);
    const report = { loaded: 0, failed: 0, missing: [], total: list.length };

    // 小批量并发，既快又不会把浏览器连接池打满
    const BATCH = 6;
    for (let i = 0; i < list.length; i += BATCH) {
      const slice = list.slice(i, i + BATCH);
      const results = await Promise.all(slice.map((request) => this.image(request.kind, request)));
      results.forEach((result, index) => {
        const request = slice[index];
        if (result) report.loaded += 1;
        else {
          report.failed += 1;
          report.missing.push(`${request.kind}:${request.id ?? request.expr ?? request.character ?? '?'}`);
        }
      });
      onProgress?.(Math.min(i + BATCH, list.length), list.length);
    }
    return report;
  }

  /* -------------------------------- 音频 -------------------------------- */

  async sound(kind, spec = {}) {
    const { url, relative, missing } = await this.resolveUrl(kind, spec);
    if (missing) return this.fail(url, kind, new Error(`音频不存在: ${relative}`), spec);

    const cached = this.audio.get(url);
    if (cached) return cached;
    if (this.pending.has(url)) return this.pending.get(url);

    const task = new Promise((resolve) => {
      const AudioCtor = this.createAudio ?? (IS_BROWSER ? window.Audio : null);
      if (!AudioCtor) {
        resolve(this.fail(url, kind, new Error('当前环境不支持音频')));
        return;
      }
      this.track(url, kind, 'loading', spec);
      const element = new AudioCtor();
      element.preload = kind === 'bgm' ? 'auto' : 'none';
      element.addEventListener(
        'canplaythrough',
        () => {
          this.stats.loaded += 1;
          this.track(url, kind, 'loaded', spec);
          resolve(element);
        },
        { once: true },
      );
      element.addEventListener(
        'error',
        () => resolve(this.fail(url, kind, new Error(`音频加载失败: ${url}`), spec)),
        { once: true },
      );
      element.src = url;
    });

    this.pending.set(url, task);
    try {
      return await task;
    } finally {
      this.pending.delete(url);
    }
  }

  /* ------------------------------ 文本 / JSON --------------------------- */

  async text(url, { asJson = false, optional = false } = {}) {
    const absolute = this.paths.absolute(url);
    try {
      const response = await fetch(absolute, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.text();
      return asJson ? JSON.parse(raw) : raw;
    } catch (err) {
      if (optional) return null;
      return this.fail(absolute, 'text', err);
    }
  }

  /* -------------------------------- 账务 -------------------------------- */

  fail(url, kind, error, spec) {
    this.stats.failed += 1;
    this.track(url, kind, 'failed', spec, error);
    this.onError({ url, kind, status: 'failed', error, spec });
    return null;
  }

  track(url, kind, status, spec, error) {
    const entry = this.entries.get(url) ?? { url, kind, spec: spec ?? null };
    entry.status = status;
    entry.error = error ?? null;
    this.entries.set(url, entry);
    if (status === 'loading') this.stats.requested += 1;
  }

  entryFor(kind, spec) {
    const { url } = this.paths.resolve(kind, spec);
    return this.entries.get(url) ?? null;
  }

  listFailures() {
    return [...this.entries.values()].filter((entry) => entry.status === 'failed');
  }

  summary() {
    const { requested, loaded, failed, probes } = this.stats;
    return `${loaded}/${requested} 已加载，失败 ${failed}，探测 ${probes} 次`;
  }

  clear() {
    this.images.clear();
    this.audio.clear();
    this.pending.clear();
    this.entries.clear();
    this.probeCache?.clear();
    this.stats = { requested: 0, loaded: 0, failed: 0, bytes: 0, probes: 0 };
  }

  /* ------------------------- 章节资源需求收集 --------------------------- */

  /**
   * 从章节 manifest 里提取「本章需要哪些资源」。
   * 章节可以自己声明，也可以留空由 AssetLoader 从脚本里扫（buildRequirements 做兜底）。
   *
   * 注意 scoped：
   *   false（默认）—— 资源在全局 assets/ 下，**不带章节子目录**。运行时用这个。
   *   true —— 资源在 assets/<chapters>/<章节id>/ 下。章节完全自带美术时用。
   * 之前这里默认塞了 chapter，导致所有全局资源都被拼成 assets/chapters/ch01/bg/xxx —— 已修。
   */
  static buildRequirements(chapter, { scoped = false } = {}) {
    const list = [];
    const seen = new Set();
    const push = (kind, spec) => {
      const normalized = scoped ? { ...spec, chapter: chapter.id } : spec;
      const signature = `${kind}:${JSON.stringify(normalized)}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      list.push({ kind, ...normalized });
    };

    const declared = chapter.assets ?? {};
    for (const item of declared.bg ?? []) push('bg', { id: typeof item === 'string' ? item : item.id });
    for (const item of declared.cg ?? []) push('cg', { id: typeof item === 'string' ? item : item.id });
    for (const item of declared.sprite ?? []) {
      push('sprite', {
        character: item.character,
        expr: item.expr,
        id: item.id,
      });
    }
    for (const item of declared.ui ?? []) push('ui', { id: typeof item === 'string' ? item : item.id });
    for (const item of declared.bgm ?? []) push('bgm', { id: typeof item === 'string' ? item : item.id });
    for (const item of declared.se ?? []) push('se', { id: typeof item === 'string' ? item : item.id });

    if (chapter.script && declared.autoScan !== false) {
      for (const asset of scanScriptAssets(chapter.script.blocks)) push(asset.kind, asset);
    }
    return list;
  }
}

/** 扫描脚本，收集所有出现的资源引用（验证器与预加载都靠它） */
export function scanScriptAssets(script) {
  const found = [];
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      // 紧凑对白行：["bg", "id"] / ["show", "char", "expr", ...]
      if (typeof node[0] === 'string') {
        const [verb, ...rest] = node;
        if (verb === 'bg' && typeof rest[0] === 'string') found.push({ kind: 'bg', id: rest[0] });
        if (verb === 'cg' && typeof rest[0] === 'string') found.push({ kind: 'cg', id: rest[0] });
        if (verb === 'show' && typeof rest[0] === 'string') {
          found.push({ kind: 'sprite', character: rest[0], expr: typeof rest[1] === 'string' ? rest[1] : 'neutral' });
        }
        if (verb === 'bgm' && typeof rest[0] === 'string') found.push({ kind: 'bgm', id: rest[0] });
        if (verb === 'se' && typeof rest[0] === 'string') found.push({ kind: 'se', id: rest[0] });
      }
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;

    switch (node.type) {
      case 'bg':
        node.bg && found.push({ kind: 'bg', id: node.bg });
        break;
      case 'cg':
        node.cg && found.push({ kind: 'cg', id: node.cg });
        break;
      case 'show':
      case 'sprite':
        node.character && found.push({ kind: 'sprite', character: node.character, expr: node.expr ?? 'neutral' });
        break;
      case 'bgm':
        node.bgm && found.push({ kind: 'bgm', id: node.bgm });
        break;
      case 'se':
        node.se && found.push({ kind: 'se', id: node.se });
        break;
      case 'sfx':
        node.id && found.push({ kind: 'se', id: node.id });
        break;
      default:
        break;
    }

    for (const value of Object.values(node)) walk(value);
  };
  walk(script);
  return found;
}
