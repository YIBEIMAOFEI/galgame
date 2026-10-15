/**
 * ui/choices.js —— 选项菜单
 *
 * 一个容易被忽略的细节：条件不满足的选项**要显示成灰色而不是消失**，
 * 玩家才能意识到「我刚才的选择改变了什么」。所以 options 里带 enabled 的
 * 一律渲染出来，只是不可点。
 */

import { escapeHtml } from '../core/util.js';

export class ChoiceMenu {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'choices is-hidden';
    this.el.setAttribute('role', 'group');
    root.appendChild(this.el);
    this.active = false;
    this.keyHandler = null;
  }

  /**
   * 显示选项，返回被选中的 { index }
   * @param {{prompt?: string, options: {index:number,text:string,enabled:boolean}[]}} payload
   */
  open(payload) {
    this.active = true;
    this.el.innerHTML = '';
    this.el.classList.remove('is-hidden');

    if (payload.prompt) {
      const prompt = document.createElement('p');
      prompt.className = 'choices__prompt';
      prompt.innerHTML = escapeHtml(payload.prompt);
      this.el.appendChild(prompt);
    }

    const list = document.createElement('div');
    list.className = 'choices__list';
    this.el.appendChild(list);

    const buttons = [];
    payload.options.forEach((option, position) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choices__item';
      if (!option.enabled) button.classList.add('is-disabled');
      if (option.style === 'important') button.classList.add('is-important');
      button.disabled = !option.enabled;
      button.dataset.index = String(option.index);
      button.innerHTML = `
        <span class="choices__bullet" aria-hidden="true">${position + 1}</span>
        <span class="choices__label">${escapeHtml(option.text)}</span>
        ${option.hint ? `<span class="choices__hint">${escapeHtml(option.hint)}</span>` : ''}
      `;
      if (option.enabled) {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          this.#pick(option.index);
        });
      }
      list.appendChild(button);
      buttons.push(button);
    });

    this.buttons = buttons;
    this.resolve = null;
    return new Promise((resolve) => {
      this.resolve = resolve;
      const firstEnabled = buttons.find((button) => !button.disabled);
      firstEnabled?.focus();
    });
  }

  /** 数字键 1-9 直接选 */
  handleKey(event) {
    if (!this.active) return false;
    const num = Number(event.key);
    if (Number.isFinite(num) && num >= 1 && num <= (this.buttons?.length ?? 0)) {
      const button = this.buttons[num - 1];
      if (button && !button.disabled) {
        this.#pick(Number(button.dataset.index));
        return true;
      }
    }
    // 上下键移动焦点
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const enabled = this.buttons.filter((button) => !button.disabled);
      if (enabled.length === 0) return true;
      const current = enabled.indexOf(document.activeElement);
      const nextIndex = event.key === 'ArrowDown'
        ? (current + 1) % enabled.length
        : (current - 1 + enabled.length) % enabled.length;
      enabled[nextIndex]?.focus();
      return true;
    }
    return false;
  }

  #pick(index) {
    if (typeof this.resolve !== 'function') return;
    const resolve = this.resolve;
    this.resolve = null;
    this.close();
    resolve({ index });
  }

  close() {
    this.active = false;
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.buttons = [];
  }
}
