/**
 * ui/stage.js —— 舞台：背景 + 立绘 + 特效
 *
 * 只有这一层知道「像素和 DOM」，内核只发「把 yuki 换成 smile」这种指令。
 * 立绘是 layered DOM：一个角色一个层，切表情时只换 img.src，不重建节点，
 * 所以不会闪、也保得住位移/缩放的过渡动画。
 */

import { ASSET_EXT } from '../core/paths.js';

/** 立绘站位：用百分比，天然适配任意分辨率 */
export const SLOTS = {
  left: 24,
  mid_left: 36,
  center: 50,
  mid_right: 64,
  right: 76,
  far_left: 12,
  far_right: 88,
};

export function resolveSlot(at) {
  if (typeof at === 'number') return at;
  if (typeof at === 'string') {
    if (at in SLOTS) return SLOTS[at];
    const numeric = Number(at);
    if (Number.isFinite(numeric)) return numeric;
  }
  return SLOTS.center;
}

export class Stage {
  /**
   * @param {HTMLElement} root 舞台根节点
   * @param {object} options
   * @param {import('../core/loader.js').AssetLoader} options.loader
   * @param {object} [options.characters]
   * @param {() => void} [options.onSpriteAdded] 新增立绘后回调，让 App 重算尺寸
   */
  constructor(root, { loader, characters = {}, onError, onSpriteAdded } = {}) {
    this.root = root;
    this.loader = loader;
    this.characters = characters;
    this.onError = onError ?? (() => {});
    this.onSpriteAdded = typeof onSpriteAdded === 'function' ? onSpriteAdded : () => {};

    this.layers = {
      bgCurrent: document.createElement('div'),
      bgNext: document.createElement('div'),
      cg: document.createElement('div'),
      sprites: document.createElement('div'),
      fx: document.createElement('div'),
      fade: document.createElement('div'),
    };

    for (const [name, element] of Object.entries(this.layers)) {
      element.className = `stage-layer stage-layer--${name}`;
      element.dataset.layer = name;
      this.root.appendChild(element);
    }
    this.layers.fade.classList.add('stage-fade');
    this.layers.bgNext.style.opacity = '0';

    this.currentBg = null;
    /** @type {Map<string, {el: HTMLElement, img: HTMLImageElement, expr: string, at: string}>} */
    this.sprites = new Map();
    this.fxTimers = new Set();
  }

  setCharacters(characters) {
    this.characters = characters ?? {};
    for (const [id, sprite] of this.sprites) {
      if (!this.characters[id]) this.hide(id);
    }
  }

  /* -------------------------------- 定格 CG ----------------------------- */

  /**
   * 显示一张定格 CG（事件图 / 结局图）。
   * 约定路径：assets/cg/<id>.<ext>
   *
   * 用法（脚本里）：
   *   { type:'cg', cg:'end_marriage', transition:'fade', duration:900 }
   *   { type:'cg', hide:true }        // 关掉 CG，回到普通舞台
   *
   * @param {string} id CG 的 id
   * @param {object} [options]
   * @param {'fade'|'none'} [options.transition]
   * @param {number} [options.duration]
   * @param {boolean} [options.hideSprites] 显示 CG 时是否把立绘藏起来（默认藏）
   */
  async showCg(id, { transition = 'fade', duration = 800, hideSprites = true } = {}) {
    if (!id) return null;
    const image = await this.loader.image('cg', { id });
    const layer = this.layers.cg;

    if (!image) {
      this.onError({ kind: 'cg', id, message: `CG ${id} 加载失败` });
      return null;
    }

    if (hideSprites) this.hideAll({ duration: Math.min(300, duration) });

    layer.style.backgroundImage = `url("${image.src}")`;
    layer.style.transition = transition === 'none' ? 'none' : `opacity ${duration}ms ease`;
    if (transition === 'none' || duration <= 0) layer.style.opacity = '1';
    else {
      layer.style.opacity = '0';
      void layer.offsetWidth;
      requestAnimationFrame(() => {
        layer.style.opacity = '1';
      });
    }
    this.currentCg = id;
    if (duration > 0) await wait(duration);
    return image;
  }

  /** 关掉 CG，回到普通舞台 */
  async hideCg({ duration = 500 } = {}) {
    const layer = this.layers.cg;
    if (!this.currentCg) return;
    layer.style.transition = `opacity ${duration}ms ease`;
    layer.style.opacity = '0';
    this.currentCg = null;
    if (duration > 0) await wait(duration);
    layer.style.backgroundImage = 'none';
  }

  /* -------------------------------- 背景 -------------------------------- */

  async setBackground(id, { transition = 'fade', duration = 600 } = {}) {
    if (!id) return null;
    const image = await this.loader.image('bg', { id });
    if (!image) {
      this.onError({ kind: 'bg', id, message: `背景 ${id} 加载失败` });
      // 兜底：给个纯色，让剧情继续
      this.layers.bgNext.style.backgroundImage = 'none';
      this.layers.bgNext.style.backgroundColor = '#151a26';
    } else {
      this.layers.bgNext.style.backgroundImage = `url("${image.src}")`;
      this.layers.bgNext.style.backgroundColor = 'transparent';
    }

    const { bgCurrent, bgNext } = this.layers;
    bgCurrent.style.transition = `opacity ${duration}ms ease`;
    bgNext.style.transition = `opacity ${duration}ms ease`;

    if (transition === 'none' || duration <= 0) {
      bgCurrent.style.backgroundImage = bgNext.style.backgroundImage;
      bgCurrent.style.backgroundColor = bgNext.style.backgroundColor;
      bgNext.style.opacity = '0';
    } else {
      bgNext.style.opacity = '1';
      await wait(duration);
      bgCurrent.style.backgroundImage = bgNext.style.backgroundImage;
      bgCurrent.style.backgroundColor = bgNext.style.backgroundColor;
      bgCurrent.style.transition = 'none';
      bgNext.style.opacity = '0';
      // 强制一次回流，避免下一帧 transition 被吞掉
      void bgCurrent.offsetWidth;
    }

    this.currentBg = id;
    return image;
  }

  /* -------------------------------- 立绘 -------------------------------- */

  async show(characterId, expression = 'neutral', { at = 'center', transition = 'fade', duration = 320, flip = false } = {}) {
    const character = this.characters[characterId] ?? {};
    const existing = this.sprites.get(characterId);

    if (existing) {
      await this.setExpression(characterId, expression, { duration });
      if (existing.at !== at) this.move(characterId, at, duration);
      return existing.img;
    }

    const element = document.createElement('div');
    element.className = 'sprite';
    element.dataset.character = characterId;
    // 角色个体缩放记在 dataset 上，由 App 统一算高度（内联 style，优先级最高）
    element.dataset.scale = String(character.scale ?? 1);
    element.style.left = `${resolveSlot(at)}%`;
    if (flip) element.classList.add('is-flipped');
    if (character.color) element.style.setProperty('--sprite-tint', character.color);
    element.style.opacity = '0';

    const img = document.createElement('img');
    img.className = 'sprite__image';
    img.alt = character.name ?? characterId;
    img.draggable = false;
    element.appendChild(img);
    this.layers.sprites.appendChild(element);

    const loaded = await this.#applyExpressionImage(img, characterId, expression);
    this.sprites.set(characterId, { el: element, img, expr: expression, at });

    // 新立绘的尺寸由 App 统一算（内联 style），这里通知它刷一次
    this.onSpriteAdded(element);

    if (transition === 'none' || duration <= 0) element.style.opacity = '1';
    else {
      requestAnimationFrame(() => {
        element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
        element.style.opacity = '1';
      });
    }
    return loaded ? img : null;
  }

  async setExpression(characterId, expression, { duration = 220 } = {}) {
    const sprite = this.sprites.get(characterId);
    if (!sprite) return this.show(characterId, expression, { duration });
    if (sprite.expr === expression) return sprite.img;

    // 关键：交叉淡入，避免 src 切换时出现空白帧
    const next = document.createElement('img');
    next.className = 'sprite__image sprite__image--next';
    next.draggable = false;
    const ok = await this.#applyExpressionImage(next, characterId, expression);
    if (!ok) return sprite.img;

    next.style.opacity = '0';
    sprite.el.appendChild(next);
    requestAnimationFrame(() => {
      next.style.transition = `opacity ${duration}ms ease`;
      next.style.opacity = '1';
    });
    await wait(duration);
    sprite.img.remove();
    next.classList.remove('sprite__image--next');
    sprite.img = next;
    sprite.expr = expression;
    return next;
  }

  async #applyExpressionImage(img, characterId, expression) {
    // 先试「头像/差分」约定路径，再试主立绘
    let element = await this.loader.image('sprite', { character: characterId, expr: expression });
    if (!element) {
      const character = this.characters[characterId];
      const fallback = character?.fallbackExpr ?? 'neutral';
      if (fallback !== expression) {
        element = await this.loader.image('sprite', { character: characterId, expr: fallback });
      }
    }
    if (!element) {
      this.onError({ kind: 'sprite', character: characterId, expr: expression, message: `立绘缺失 ${characterId}/${expression}` });
      // 占位：一块带角色名的色板，绝不空白
      img.removeAttribute('src');
      img.classList.add('sprite__image--missing');
      img.alt = `${this.characters[characterId]?.name ?? characterId}（缺 ${expression}）`;
      return false;
    }
    img.src = element.src;
    img.classList.remove('sprite__image--missing');
    return true;
  }

  move(characterId, at, duration = 320) {
    const sprite = this.sprites.get(characterId);
    if (!sprite) return;
    sprite.at = at;
    sprite.el.style.transition = `left ${duration}ms cubic-bezier(.4,0,.2,1)`;
    sprite.el.style.left = `${resolveSlot(at)}%`;
  }

  /** 说话时把非说话人压暗一点，是很便宜但很有效的「谁在说话」提示 */
  focus(characterId) {
    for (const [id, sprite] of this.sprites) {
      sprite.el.classList.toggle('is-dimmed', !!characterId && id !== characterId);
      sprite.el.classList.toggle('is-speaking', !!characterId && id === characterId);
    }
  }

  hide(characterId, { duration = 320 } = {}) {
    const sprite = this.sprites.get(characterId);
    if (!sprite) return;
    this.sprites.delete(characterId);
    sprite.el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
    sprite.el.style.opacity = '0';
    setTimeout(() => sprite.el.remove(), duration + 60);
  }

  hideAll(options) {
    for (const id of [...this.sprites.keys()]) this.hide(id, options);
  }

  /* -------------------------------- 特效 -------------------------------- */

  shake({ intensity = 8, duration = 400 } = {}) {
    const container = this.layers.fx;
    container.style.setProperty('--shake-intensity', `${intensity}px`);
    container.classList.remove('is-shaking');
    void container.offsetWidth;
    container.classList.add('is-shaking');
    const timer = setTimeout(() => container.classList.remove('is-shaking'), duration);
    this.fxTimers.add(timer);
  }

  /** 全屏淡入淡出：章节切换、回忆闪现都用它 */
  async fade(to = 'black', duration = 500) {
    const layer = this.layers.fade;
    layer.style.background = to === 'white' ? '#fff' : to === 'black' ? '#000' : to;
    layer.style.transition = `opacity ${duration}ms ease`;
    layer.style.opacity = '1';
    await wait(duration);
    return {
      out: async (nextDuration = duration) => {
        layer.style.transition = `opacity ${nextDuration}ms ease`;
        layer.style.opacity = '0';
        await wait(nextDuration);
      },
    };
  }

  /** 当前舞台快照：存档缩略图用它（返回 dataURL，可能很大，做缩略图要压） */
  snapshot({ width = 320 } = {}) {
    const bg = this.currentBg ? this.loader.paths.resolve('bg', { id: this.currentBg }).url : null;
    return { bg, sprites: [...this.sprites.keys()] };
  }

  destroy() {
    for (const timer of this.fxTimers) clearTimeout(timer);
    this.fxTimers.clear();
    this.sprites.clear();
    this.root.innerHTML = '';
  }
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** 供调试面板显示：已知扩展名统计 */
export function extensions() {
  return ASSET_EXT;
}
