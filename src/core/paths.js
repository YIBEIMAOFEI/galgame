/**
 * core/paths.js —— 唯一的「地址解析者」
 *
 * 这是「给服务器静态托管」这件事的地基，也是让 assets/ 变成
 * 「可命名约定」而不是「到处硬编码路径」的关键。
 *
 * 规则（全部是「缺省约定 + 显式覆盖」）：
 *   背景：  bg/<id>.<ext>              例 bg/rooftop_dusk.png
 *   立绘：  characters/<charId>/<expr>.<ext>
 *   头像：  characters/<charId>/icon_<expr>.<ext>（找不到会回退到立绘）
 *   BGM：   audio/bgm/<id>.<ext>
 *   音效：  audio/se/<id>.<ext>
 *   语音：  audio/voice/<charId>/<clipId>.<ext>
 *   界面图：ui/<id>.<ext>
 *
 * 章节里写 `bg: 'rooftop_dusk'` 就够了，不用关心扩展名是 png 还是 webp，
 * 也不用关心 baseUrl 是 `/` 还是 `https://cdn.example.com/gal/`。
 */

import { deepFreeze, isPlainObject } from './util.js';

export const ASSET_EXT = deepFreeze({
  image: ['avif', 'webp', 'png', 'jpg', 'jpeg', 'gif'],
  audio: ['ogg', 'mp3', 'm4a', 'wav'],
});

export const DEFAULT_PATHS = deepFreeze({
  /** 资源根目录（相对站点根） */
  assets: 'assets',
  /** 章节根目录 */
  chapters: 'chapters',
  /** 角色定义文件 —— 也是 index.js，好处是可以用注释写「这个角色是谁画的、授权是什么」 */
  charactersFile: 'characters/index.js',
  /** 音效/BGM 根 */
  audio: 'audio',
  /** 默认扩展名（严格模式下只试这一个，省掉一堆 404 探测） */
  ext: 'png',
  audioExt: 'ogg',
  /**
   * true  = 严格模式：只按默认扩展名拼路径，命中不到就直接报错。
   * false = 探测模式：按候选扩展名依次 HEAD 探测，第一次命中即缓存。
   * 本地开发建议 false（丢文件进文件夹就能用），上线建议 true（零多余请求）。
   */
  strict: false,
});

/** 把可能残缺的路径配置补齐成一张完整的表 */
export function normalizePathConfig(input = {}) {
  const merged = { ...DEFAULT_PATHS, ...(isPlainObject(input) ? input : {}) };
  if (!isPlainObject(merged.templates)) merged.templates = {};
  return merged;
}

/** 把路径拼成 URL，并压掉多余斜杠 */
function joinUrl(...parts) {
  const cleaned = parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part, index) => {
      const text = String(part);
      return index === 0 ? text.replace(/\/+$/, '') : text.replace(/^\/+|\/+$/g, '');
    })
    .filter((part) => part !== '');
  return cleaned.join('/') || './';
}

function stripKnownExt(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/\.(avif|webp|png|jpe?g|gif|ogg|mp3|m4a|wav)$/i, '');
}

export class PathResolver {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl] 站点根，默认用当前模块所在位置推导（支持子目录部署）
   * @param {object} [options.paths]   路径约定覆盖
   */
  constructor({ baseUrl, paths } = {}) {
    this.baseUrl = baseUrl ?? resolveBaseUrl();
    this.config = normalizePathConfig(paths);
    /** 运行时探测出来的真实扩展名：`bg/classroom` -> 'webp' */
    this.extOverrides = new Map();
  }

  configure({ baseUrl, paths } = {}) {
    if (baseUrl) this.baseUrl = baseUrl;
    if (paths) this.config = normalizePathConfig({ ...this.config, ...paths });
    return this;
  }

  get assetsRoot() {
    return joinUrl(this.baseUrl, this.config.assets);
  }

  get chaptersRoot() {
    return joinUrl(this.baseUrl, this.config.chapters);
  }

  absolute(relativeUrl) {
    if (typeof relativeUrl !== 'string') return relativeUrl;
    if (/^(https?:)?\/\//i.test(relativeUrl) || relativeUrl.startsWith('data:') || relativeUrl.startsWith('blob:')) {
      return relativeUrl;
    }
    return joinUrl(this.baseUrl, relativeUrl);
  }

  /** 角色定义文件 URL */
  charactersFile() {
    return this.absolute(this.config.charactersFile);
  }

  /** 章节入口模块 URL —— 这是动态 import() 的地址 */
  chapterEntry(chapterId) {
    return this.absolute(joinUrl(this.config.chapters, chapterId, 'index.js'));
  }

  /** 章节文件夹 URL（章节自己要额外 fetch 相对资源时用） */
  chapterBase(chapterId) {
    return this.absolute(joinUrl(this.config.chapters, chapterId));
  }

  /**
   * 任意资源的 URL。
   *
   * 返回三样东西：
   *   relative —— 相对 assets/ 的路径（**不带扩展名**），构建期清单和缓存都用它做键
   *   url      —— 默认扩展名拼出的 URL（探测模式下只是「第一候选」）
   *   candidates —— 探测模式下要依次试的扩展名；严格模式只有默认那一个
   *
   * @param {'bg'|'sprite'|'icon'|'bgm'|'se'|'voice'|'ui'} kind
   * @param {object} spec
   * @param {string} [spec.id]        逻辑 id
   * @param {string} [spec.chapter]   章节 id（章节自带资源时才用，会插到 assets/<chapters>/<id>/ 下）
   * @param {string} [spec.character] 角色 id
   * @param {string} [spec.expr]      表情 id
   * @param {string} [spec.ext]       强制扩展名（覆盖一切推断）
   * @returns {{url: string, relative: string, key: string, candidates: string[]}}
   */
  resolve(kind, spec = {}) {
    const audio = kind === 'bgm' || kind === 'se' || kind === 'voice';

    // 1) 自定义模板优先（章节可以彻底重写某类资源的取法）
    const custom = this.config.templates?.[kind];
    if (typeof custom === 'function') {
      const raw = custom({ ...spec, resolver: this });
      if (typeof raw === 'string' && raw) {
        const url = this.materialize(raw, spec);
        return { url, relative: url, key: url, candidates: [] };
      }
    }

    // 2) 组成「相对 assets/ 的路径」
    const base = this.relativeFor(kind, spec);
    const relative = spec.chapter ? `${this.config.chapters}/${spec.chapter}/${base}` : base;

    // 3) 决定扩展名
    const configured = audio ? this.config.audioExt : this.config.ext;
    const list = Array.isArray(this.config.candidates) && this.config.candidates.length
      ? this.config.candidates
      : audio
        ? ASSET_EXT.audio
        : ASSET_EXT.image;

    const forced = spec.ext ? String(spec.ext).replace(/^\./, '') : null;
    const remembered = this.extOverrides.get(relative);
    const candidates = forced
      ? [forced]
      : this.config.strict
        ? [String(configured)]
        : remembered
          ? [remembered, ...list.filter((ext) => ext !== remembered)]
          : [...list];

    const primary = candidates[0];
    return {
      url: joinUrl(this.assetsRoot, `${relative}.${primary}`),
      relative,
      key: relative,
      candidates,
    };
  }

  /**
   * 某类资源在 assets/ 下的相对路径（不带扩展名）。
   * 这是「命名约定」的唯一落点 —— 想改成别的目录结构，只改这里。
   */
  relativeFor(kind, spec) {
    switch (kind) {
      case 'bg':
        return joinUrl('bg', stripKnownExt(spec.id ?? spec.name ?? ''));
      case 'cg':
        return joinUrl('cg', stripKnownExt(spec.id ?? ''));
      case 'ui':
        return joinUrl('ui', stripKnownExt(spec.id ?? ''));
      case 'sprite':
        return joinUrl('characters', spec.character ?? '', stripKnownExt(spec.expr ?? spec.id ?? ''));
      case 'icon':
        return joinUrl('characters', spec.character ?? '', `icon_${stripKnownExt(spec.expr ?? '')}`);
      case 'bgm':
        return joinUrl(this.config.audio, 'bgm', stripKnownExt(spec.id ?? ''));
      case 'se':
        return joinUrl(this.config.audio, 'se', stripKnownExt(spec.id ?? ''));
      case 'voice':
        return joinUrl(this.config.audio, 'voice', spec.character ?? '', stripKnownExt(spec.id ?? ''));
      default:
        return joinUrl(kind, stripKnownExt(spec.id ?? ''));
    }
  }

  /** 模板返回的地址可能是 res:// 风格，统一成真实 URL */
  materialize(raw, spec) {
    if (raw.startsWith('res://')) return joinUrl(this.assetsRoot, raw.slice(6));
    if (raw.startsWith('chapter://')) {
      return joinUrl(this.chaptersRoot, spec.chapter ?? '', raw.slice(10));
    }
    return this.absolute(raw);
  }

  /** AssetLoader 探测到真实扩展名后写回，后续章节零探测 */
  rememberExt(relative, ext) {
    if (relative && ext) this.extOverrides.set(relative, String(ext).replace(/^\./, ''));
  }

  static stripKnownExt = stripKnownExt;
}

/**
 * 推导 baseUrl：优先用文档里声明的 data-base（便于部署到子目录 / CDN），
 * 否则用当前模块 URL 往上找到站点根。
 */
export function resolveBaseUrl() {
  if (typeof document !== 'undefined') {
    const declared = document.documentElement?.dataset?.base;
    if (declared) return declared.replace(/\/+$/, '');
    const baseTag = document.querySelector('base')?.getAttribute('href');
    if (baseTag) return baseTag.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const { origin, pathname } = window.location;
    if (pathname.endsWith('/')) return `${origin}${pathname}`.replace(/\/+$/, '');
    const dir = pathname.replace(/[^/]*$/, '');
    return `${origin}${dir}`.replace(/\/+$/, '');
  }
  return '';
}

export { joinUrl };
