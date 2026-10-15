/**
 * ui/hud.js —— 顶部/底部控件条 + 回想(backlog) + 提示气泡(toast)
 *
 * 这些是「播放器」而不是「剧情」：它们只发事件给 App，自己不改任何状态。
 */

import { escapeHtml, textWeight } from '../core/util.js';

export class Toast {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'toast';
    root.appendChild(this.el);
    this.timer = null;
  }

  show(message, { level = 'info', duration = 2600 } = {}) {
    this.el.textContent = message;
    this.el.className = `toast toast--${level} is-visible`;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('is-visible'), duration);
  }
}

export class Backlog {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'overlay is-hidden';
    this.el.innerHTML = `
      <div class="overlay__panel">
        <header class="overlay__header">
          <h2>回想</h2>
          <button type="button" class="btn btn--ghost" data-action="close">关闭 (Esc)</button>
        </header>
        <div class="backlog__list"></div>
      </div>
    `;
    root.appendChild(this.el);
    this.list = this.el.querySelector('.backlog__list');
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
  }

  render(entries) {
    if (!entries.length) {
      this.list.innerHTML = '<p class="backlog__empty">还没有可以回想的内容。</p>';
    } else {
      this.list.innerHTML = entries
        .map((entry) => {
          const name = entry.displayName
            ? `<span class="backlog__name">${escapeHtml(entry.displayName)}</span>`
            : '<span class="backlog__name backlog__name--narration">旁白</span>';
          return `<div class="backlog__row">${name}<span class="backlog__text">${escapeHtml(entry.text)}</span></div>`;
        })
        .join('');
    }
    this.list.scrollTop = this.list.scrollHeight;
  }

  open(entries) {
    this.render(entries);
    this.el.classList.remove('is-hidden');
    this.opened = true;
  }

  close() {
    this.el.classList.add('is-hidden');
    this.opened = false;
  }

  toggle(entries) {
    if (this.opened) this.close();
    else this.open(entries);
  }
}

const CONTROL_DEFS = [
  { id: 'auto', label: '自动', key: 'A', hint: '自动播放（A）' },
  { id: 'skip', label: '快进', key: 'Ctrl', hint: '按住 Ctrl 快进' },
  { id: 'backlog', label: '回想', key: 'L', hint: '查看历史文本（L）' },
  { id: 'save', label: '存档', key: 'S', hint: '存档 / 读档' },
  { id: 'settings', label: '设置', key: 'O', hint: '文字速度、音量等' },
  { id: 'menu', label: '菜单', key: 'Esc', hint: '返回章节选择' },
];

export class Hud {
  constructor(root, { title = '', onAction = () => {} } = {}) {
    this.onAction = onAction;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud__chapter"><span class="hud__chapter-title">${escapeHtml(title)}</span></div>
      <div class="hud__controls">
        ${CONTROL_DEFS.map(
          (control) => `
          <button type="button" class="hud__btn" data-control="${control.id}" title="${escapeHtml(control.hint)}">
            ${escapeHtml(control.label)}
          </button>`,
        ).join('')}
        <button type="button" class="hud__btn hud__btn--debug" data-control="debug" title="调试面板 (F2)">F2</button>
      </div>
    `;
    root.appendChild(this.el);

    this.el.querySelectorAll('[data-control]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onAction(button.dataset.control);
      });
    });
    this.buttons = new Map(
      [...this.el.querySelectorAll('[data-control]')].map((button) => [button.dataset.control, button]),
    );
  }

  setTitle(title) {
    this.el.querySelector('.hud__chapter-title').textContent = title ?? '';
  }

  setActive(controlId, active) {
    this.buttons.get(controlId)?.classList.toggle('is-active', !!active);
  }

  setVisible(visible) {
    this.el.classList.toggle('is-hidden', !visible);
  }
}

/** 设置面板：改的都是 settings 对象，App 负责持久化 */
export class SettingsPanel {
  constructor(root, { settings = {}, onChange = () => {} } = {}) {
    this.onChange = onChange;
    this.settings = settings;
    this.el = document.createElement('div');
    this.el.className = 'overlay is-hidden';
    this.el.innerHTML = `
      <div class="overlay__panel">
        <header class="overlay__header">
          <h2>设置</h2>
          <button type="button" class="btn btn--ghost" data-action="close">关闭 (Esc)</button>
        </header>
        <div class="settings__body">
          <label class="field">
            <span>文字速度 <output data-out="cps"></output> 字/秒</span>
            <input type="range" min="10" max="120" step="5" data-field="cps" />
          </label>
          <label class="field">
            <span>自动播放停留 <output data-out="autoWait"></output> 毫秒</span>
            <input type="range" min="200" max="4000" step="100" data-field="autoWait" />
          </label>
          <label class="field">
            <span>主音量 <output data-out="masterVolume"></output>%</span>
            <input type="range" min="0" max="100" step="5" data-field="masterVolume" />
          </label>
          <label class="field field--row">
            <input type="checkbox" data-field="skipUnread" />
            <span>快进时跳过未读文本</span>
          </label>
          <div class="settings__meta"></div>
        </div>
      </div>
    `;
    root.appendChild(this.el);

    this.el.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    for (const input of this.el.querySelectorAll('[data-field]')) {
      input.addEventListener('input', () => this.#readInput(input));
    }
    this.sync();
  }

  #readInput(input) {
    const field = input.dataset.field;
    const value = input.type === 'checkbox' ? input.checked : Number(input.value);
    this.settings[field] = value;
    const out = this.el.querySelector(`[data-out="${field}"]`);
    if (out) out.textContent = String(value);
    this.onChange(field, value, this.settings);
  }

  sync() {
    for (const input of this.el.querySelectorAll('[data-field]')) {
      const field = input.dataset.field;
      const value = this.settings[field];
      if (value === undefined) continue;
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = String(value);
      const out = this.el.querySelector(`[data-out="${field}"]`);
      if (out) out.textContent = String(value);
    }
  }

  setMeta(html) {
    this.el.querySelector('.settings__meta').innerHTML = html;
  }

  open() {
    this.sync();
    this.el.classList.remove('is-hidden');
    this.opened = true;
  }

  close() {
    this.el.classList.add('is-hidden');
    this.opened = false;
  }
}

export const CONTROLS = CONTROL_DEFS;
export { textWeight };
