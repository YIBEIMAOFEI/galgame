/**
 * ui/textbox.js —— 对话框（打字机 / 已完成等待 / 自动 / 快进）
 *
 * 打字机不是「一个字一个字 setTimeout」，而是用 requestAnimationFrame
 * 按「字/秒」计算应该显示到第几个字 —— 掉帧时也不会变慢，
 * 并且任何一个输入都能立刻 finish()（这是视觉小说的基本礼貌）。
 */

import { autoWaitDuration, typingDuration, textWeight } from '../core/util.js';

export class TextBox {
  constructor(root, { settings = {} } = {}) {
    this.root = root;
    this.settings = { cps: 45, autoWait: 1100, ...settings };

    this.el = document.createElement('div');
    this.el.className = 'textbox';
    this.el.innerHTML = `
      <div class="textbox__nameplate"><span class="textbox__name"></span></div>
      <div class="textbox__body"><p class="textbox__text"></p></div>
      <div class="textbox__next" aria-hidden="true">▼</div>
    `;
    root.appendChild(this.el);

    this.nameEl = this.el.querySelector('.textbox__name');
    this.textEl = this.el.querySelector('.textbox__text');
    this.plateEl = this.el.querySelector('.textbox__nameplate');

    this.fullText = '';
    this.visibleChars = 0;
    this.typing = false;
    this.frame = null;
    this.onFinish = null;
    this.mode = 'normal';
    this.backgroundColor = null;
  }

  configure(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  /** 显示一句对白，返回一个 Promise：打字结束就 resolve（不等玩家点击） */
  async show(line, { mode = 'normal' } = {}) {
    this.mode = mode;
    this.root.classList.remove('textbox-host--hidden');

    const narration = !!line.narration;
    this.el.classList.toggle('textbox--narration', narration);
    const showPlate = !narration && !!line.displayName;
    this.plateEl.style.display = showPlate ? '' : 'none';
    this.nameEl.textContent = showPlate ? line.displayName : '';
    if (line.color) this.nameEl.style.color = line.color;
    else this.nameEl.style.removeProperty('color');

    this.fullText = String(line.text ?? '');
    this.textEl.classList.toggle('textbox__text--narration', narration);
    this.textEl.style.removeProperty('color');
    if (line.color && !narration) this.textEl.style.color = null;

    return this.#type(this.fullText, line.cps ?? this.settings.cps, mode);
  }

  /** 立即显示全部文字 */
  finish() {
    if (!this.typing) return false;
    this.visibleChars = [...this.fullText].length;
    this.textEl.textContent = this.fullText;
    this.#stopFrame();
    this.typing = false;
    this.el.classList.remove('is-typing');
    this.el.classList.add('is-ready');
    this.onFinish?.();
    return true;
  }

  #type(text, cps, mode) {
    this.#stopFrame();
    return new Promise((resolve) => {
      const chars = [...text];

      // 快进模式 / 打字速度为 0：直接整句出现
      const speed = mode === 'skip' ? 0 : Number(cps) || this.settings.cps;
      if (speed <= 0 || chars.length === 0) {
        this.textEl.textContent = text;
        this.visibleChars = chars.length;
        this.typing = false;
        this.el.classList.add('is-ready');
        this.el.classList.remove('is-typing');
        this.onFinish = null;
        resolve();
        return;
      }

      this.typing = true;
      this.visibleChars = 0;
      this.textEl.textContent = '';
      this.el.classList.add('is-typing');
      this.el.classList.remove('is-ready');

      const total = typingDuration(text, speed);

      const tick = () => {
        const elapsed = performance.now() - startedAt;
        const ratio = total <= 0 ? 1 : Math.min(1, elapsed / total);
        const target = Math.floor(ratio * chars.length);
        if (target !== this.visibleChars) {
          this.visibleChars = target;
          this.textEl.textContent = chars.slice(0, target).join('');
        }
        if (ratio >= 1) {
          this.visibleChars = chars.length;
          this.textEl.textContent = text;
          this.typing = false;
          this.el.classList.remove('is-typing');
          this.el.classList.add('is-ready');
          this.onFinish = null;
          resolve();
          return;
        }
        this.frame = requestAnimationFrame(tick);
      };

      const startedAt = performance.now();
      this.onFinish = () => resolve();
      this.frame = requestAnimationFrame(tick);
    });
  }

  #stopFrame() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /** 玩家点击后到底要等多久（自动播放模式用） */
  waitForAdvance({ auto = false, skip = false } = {}) {
    if (skip) return Promise.resolve('skip');
    if (!auto) return Promise.resolve('manual');
    const delay = autoWaitDuration(this.fullText, this.settings.cps, this.settings.autoWait);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve('auto'), delay);
      this.autoCancel = () => {
        clearTimeout(timer);
        resolve('auto-cancelled');
      };
    });
  }

  cancelAuto() {
    this.autoCancel?.();
    this.autoCancel = null;
  }

  setVisible(visible) {
    this.el.classList.toggle('is-hidden', !visible);
  }

  clear() {
    this.#stopFrame();
    this.typing = false;
    this.textEl.textContent = '';
    this.nameEl.textContent = '';
    this.plateEl.style.display = 'none';
    this.el.classList.remove('is-ready', 'is-typing');
  }

  get isTyping() {
    return this.typing;
  }

  /** 文本权重：调试面板显示用 */
  get weight() {
    return textWeight(this.fullText);
  }
}
