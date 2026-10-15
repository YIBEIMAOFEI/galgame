/**
 * ui/screens.js —— 标题界面 / 章节选择 / 结局一览 / 存读档 / 调试面板
 *
 * 全部是「渲染 + 回调」结构：这些界面不持有游戏状态，
 * 数据由 App 传进来，玩家点了什么用回调抛回去。
 */

import { escapeHtml } from '../core/util.js';

/* ------------------------------ 标题界面 ------------------------------ */

export class TitleScreen {
  constructor(root, { onStart = () => {}, onContinue = () => {}, onChapters = () => {}, onImport = () => {} } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--title';
    this.el.innerHTML = `
      <div class="title__logo">
        <img src="assets/ui/logo.png" alt="" class="title__logo-image" onerror="this.style.display='none'" />
        <h1 class="title__name"></h1>
        <p class="title__subtitle"></p>
      </div>
      <div class="title__buttons">
        <button type="button" class="btn btn--primary" data-action="continue">继续游戏</button>
        <button type="button" class="btn" data-action="start">开始游戏</button>
        <button type="button" class="btn" data-action="chapters">章节选择</button>
        <button type="button" class="btn btn--ghost" data-action="import">导入存档</button>
      </div>
      <p class="title__meta"></p>
    `;
    root.appendChild(this.el);

    this.el.querySelector('[data-action="start"]').addEventListener('click', () => onStart());
    this.el.querySelector('[data-action="continue"]').addEventListener('click', () => onContinue());
    this.el.querySelector('[data-action="chapters"]').addEventListener('click', () => onChapters());
    this.el.querySelector('[data-action="import"]').addEventListener('click', () => onImport());
    this.continueButton = this.el.querySelector('[data-action="continue"]');
  }

  update({ title, subtitle, meta, hasSave }) {
    this.el.querySelector('.title__name').textContent = title ?? '';
    this.el.querySelector('.title__subtitle').textContent = subtitle ?? '';
    this.el.querySelector('.title__meta').innerHTML = meta ?? '';
    this.continueButton.disabled = !hasSave;
    this.continueButton.title = hasSave ? '' : '还没有任何存档';
  }

  show() {
    this.el.classList.remove('is-hidden');
  }

  hide() {
    this.el.classList.add('is-hidden');
  }
}

/* ---------------------------- 章节选择界面 ---------------------------- */

export class ChapterSelect {
  constructor(root, { onPick = () => {}, onBack = () => {} } = {}) {
    this.onPick = onPick;
    this.el = document.createElement('div');
    this.el.className = 'screen screen--chapters is-hidden';
    this.el.innerHTML = `
      <header class="screen__header">
        <h2>章节选择</h2>
        <button type="button" class="btn btn--ghost" data-action="back">返回标题</button>
      </header>
      <div class="chapter-grid"></div>
    `;
    root.appendChild(this.el);
    this.grid = this.el.querySelector('.chapter-grid');
    this.el.querySelector('[data-action="back"]').addEventListener('click', () => onBack());
  }

  /** @param {object[]} chapters registry.list() 的结果 */
  render(chapters) {
    if (!chapters.length) {
      this.grid.innerHTML = '<p class="empty">还没有任何章节。在 chapters/ 下新建文件夹并在 chapters/index.js 里登记即可。</p>';
      return;
    }

    this.grid.innerHTML = chapters
      .map((chapter) => {
        const released = chapter.status !== 'planned';
        const disabled = chapter.locked || !released;
        const badges = [
          chapter.cleared ? '<span class="badge badge--done">已通关</span>' : '',
          chapter.locked ? '<span class="badge badge--lock">未解锁</span>' : '',
          !released ? '<span class="badge">企划中</span>' : '',
          chapter.loaded ? '<span class="badge badge--loaded">已加载</span>' : '',
          chapter.failure ? `<span class="badge badge--error" title="${escapeHtml(chapter.failure)}">加载失败</span>` : '',
          chapter.invalid ? '<span class="badge badge--error">结构有问题</span>' : '',
        ]
          .filter(Boolean)
          .join('');

        return `
          <article class="chapter-card ${disabled ? 'is-disabled' : ''}" data-chapter="${escapeHtml(chapter.id)}">
            <header>
              <span class="chapter-card__order">${String(chapter.order ?? '').padStart(2, '0')}</span>
              <h3>${escapeHtml(chapter.title ?? chapter.id)}</h3>
            </header>
            <p class="chapter-card__summary">${escapeHtml(chapter.summary ?? '')}</p>
            <footer>
              <span class="chapter-card__id">${escapeHtml(chapter.id)}</span>
              ${chapter.endingCount ? `<span class="chapter-card__endings">结局 ${chapter.achieved}/${chapter.endingCount}</span>` : ''}
              ${badges}
            </footer>
            <button type="button" class="btn btn--primary chapter-card__go" ${disabled ? 'disabled' : ''}>
              ${chapter.cleared ? '重玩本章' : '进入'}
            </button>
          </article>
        `;
      })
      .join('');

    this.grid.querySelectorAll('.chapter-card').forEach((card) => {
      const chapter = chapters.find((item) => item.id === card.dataset.chapter);
      const button = card.querySelector('.chapter-card__go');
      button?.addEventListener('click', () => {
        if (chapter && !chapter.locked && chapter.status !== 'planned') this.onPick(chapter);
      });
    });
  }

  show() {
    this.el.classList.remove('is-hidden');
  }

  hide() {
    this.el.classList.add('is-hidden');
  }
}

/* ------------------------------ 存读档界面 ---------------------------- */

export class SaveScreen {
  /**
   * @param {HTMLElement} root
   * @param {object} options
   * @param {'save'|'load'} options.mode
   */
  constructor(root, { onSave = () => {}, onLoad = () => {}, onDelete = () => {}, onClose = () => {}, onExport = () => {} } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'overlay is-hidden';
    this.el.innerHTML = `
      <div class="overlay__panel">
        <header class="overlay__header">
          <h2 class="save__title">存档</h2>
          <div class="save__header-actions">
            <button type="button" class="btn btn--ghost" data-action="export">导出全部存档</button>
            <button type="button" class="btn btn--ghost" data-action="close">关闭 (Esc)</button>
          </div>
        </header>
        <div class="save__grid"></div>
      </div>
    `;
    root.appendChild(this.el);
    this.grid = this.el.querySelector('.save__grid');
    this.handlers = { onSave, onLoad, onDelete, onClose, onExport };
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => onClose());
    this.el.querySelector('[data-action="export"]').addEventListener('click', () => onExport());
  }

  render({ mode, slots }) {
    this.mode = mode;
    this.el.querySelector('.save__title').textContent = mode === 'save' ? '存档' : '读档';
    this.grid.innerHTML = slots
      .map((slot) => {
        const canSave = mode === 'save';
        const canLoad = !slot.empty;
        const when = slot.savedAt ? new Date(slot.savedAt).toLocaleString('zh-CN', { hour12: false }) : '';
        const playTime = slot.playTimeMs ? `${Math.round(slot.playTimeMs / 60000)} 分钟` : '';
        return `
          <article class="save-slot ${slot.empty ? 'is-empty' : ''}" data-slot="${escapeHtml(slot.id)}">
            <header>
              <h3>${escapeHtml(slot.label)}</h3>
              <span class="save-slot__time">${escapeHtml(when)}</span>
            </header>
            <p class="save-slot__chapter">${escapeHtml(slot.chapterTitle ?? (slot.empty ? '空' : slot.chapterId ?? ''))}</p>
            <p class="save-slot__preview">${escapeHtml(slot.preview ?? '')}</p>
            <footer>
              <span class="save-slot__playtime">${escapeHtml(playTime)}</span>
              <div class="save-slot__actions">
                <button type="button" class="btn btn--small btn--primary" data-do="primary" ${canSave || canLoad ? '' : 'disabled'}>
                  ${canSave ? '覆盖' : '读取'}
                </button>
                <button type="button" class="btn btn--small btn--ghost" data-do="delete" ${slot.empty ? 'disabled' : ''}>删除</button>
              </div>
            </footer>
          </article>
        `;
      })
      .join('');

    this.grid.querySelectorAll('.save-slot').forEach((card) => {
      const slotId = card.dataset.slot;
      card.querySelector('[data-do="primary"]')?.addEventListener('click', () => {
        if (this.mode === 'save') this.handlers.onSave(slotId);
        else this.handlers.onLoad(slotId);
      });
      card.querySelector('[data-do="delete"]')?.addEventListener('click', () => this.handlers.onDelete(slotId));
    });
  }

  open() {
    this.el.classList.remove('is-hidden');
    this.opened = true;
  }

  close() {
    this.el.classList.add('is-hidden');
    this.opened = false;
  }
}

/* ------------------------------- 结局一览 ----------------------------- */

export class EndingScreen {
  constructor(root, { onBack = () => {}, onNext = () => {}, onReplay = () => {} } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--ending is-hidden';
    this.el.innerHTML = `
      <div class="ending__card">
        <p class="ending__kicker">Chapter Clear</p>
        <h2 class="ending__title"></h2>
        <p class="ending__desc"></p>
        <div class="ending__stats"></div>
        <div class="ending__actions">
          <button type="button" class="btn btn--primary" data-action="next">继续下一章</button>
          <button type="button" class="btn" data-action="replay">重玩本章</button>
          <button type="button" class="btn btn--ghost" data-action="back">返回章节选择</button>
        </div>
      </div>
    `;
    root.appendChild(this.el);
    this.el.querySelector('[data-action="next"]').addEventListener('click', () => onNext());
    this.el.querySelector('[data-action="replay"]').addEventListener('click', () => onReplay());
    this.el.querySelector('[data-action="back"]').addEventListener('click', () => onBack());
    this.nextButton = this.el.querySelector('[data-action="next"]');
  }

  show({ title, description, stats, hasNext, endingId }) {
    this.el.querySelector('.ending__title').textContent = title ?? '章末';
    this.el.querySelector('.ending__desc').textContent = description ?? '';
    this.el.querySelector('.ending__kicker').textContent = endingId ? `Ending · ${endingId}` : 'Chapter Clear';
    this.el.querySelector('.ending__stats').innerHTML = stats ?? '';
    this.nextButton.disabled = !hasNext;
    this.nextButton.title = hasNext ? '' : '没有配置下一章';
    this.el.classList.remove('is-hidden');
  }

  hide() {
    this.el.classList.add('is-hidden');
  }
}

/* ------------------------------ 加载遮罩 ------------------------------ */

export class LoadingOverlay {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'loading is-hidden';
    this.el.innerHTML = `
      <div class="loading__inner">
        <div class="loading__spinner" aria-hidden="true"></div>
        <p class="loading__title"></p>
        <p class="loading__detail"></p>
        <div class="loading__bar"><span></span></div>
      </div>
    `;
    root.appendChild(this.el);
    this.bar = this.el.querySelector('.loading__bar span');
    this.titleEl = this.el.querySelector('.loading__title');
    this.detailEl = this.el.querySelector('.loading__detail');
  }

  show(title, detail = '') {
    this.titleEl.textContent = title;
    this.detailEl.textContent = detail;
    this.bar.style.width = '0%';
    this.el.classList.remove('is-hidden');
  }

  progress(done, total, detail = '') {
    const ratio = total > 0 ? done / total : 0;
    this.bar.style.width = `${Math.round(ratio * 100)}%`;
    this.detailEl.textContent = detail || `${done}/${total}`;
  }

  hide() {
    this.el.classList.add('is-hidden');
  }
}

/* ------------------------------ 调试面板 ------------------------------ */

export class DebugPanel {
  constructor(root, { onReload = () => {}, onForce = () => {}, onClose = () => {} } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'debug is-hidden';
    this.el.innerHTML = `
      <header class="debug__header">
        <strong>调试面板</strong>
        <div>
          <button type="button" class="btn btn--small btn--ghost" data-action="reload">重载本章</button>
          <button type="button" class="btn btn--small btn--ghost" data-action="force">强制进入</button>
          <button type="button" class="btn btn--small btn--ghost" data-action="close">关闭</button>
        </div>
      </header>
      <div class="debug__body"></div>
    `;
    root.appendChild(this.el);
    this.body = this.el.querySelector('.debug__body');
    this.el.querySelector('[data-action="reload"]').addEventListener('click', () => onReload());
    this.el.querySelector('[data-action="force"]').addEventListener('click', () => onForce());
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => onClose());
  }

  toggle(data) {
    if (this.el.classList.contains('is-hidden')) this.open(data);
    else this.close();
  }

  open(data) {
    this.render(data);
    this.el.classList.remove('is-hidden');
    this.opened = true;
  }

  close() {
    this.el.classList.add('is-hidden');
    this.opened = false;
  }

  render(data) {
    if (!data) return;
    const sections = [];
    sections.push(`<section><h4>剧本进度</h4><pre>${escapeHtml(data.cursor ?? '')}</pre></section>`);
    sections.push(`<section><h4>变量</h4><pre>${escapeHtml(data.vars ?? '')}</pre></section>`);
    sections.push(`<section><h4>资源</h4><pre>${escapeHtml(data.assets ?? '')}</pre></section>`);
    if (data.report) sections.push(`<section><h4>校验</h4><pre>${escapeHtml(data.report)}</pre></section>`);
    if (data.errors?.length) {
      sections.push(`<section><h4>运行时错误</h4><pre>${escapeHtml(data.errors.join('\n'))}</pre></section>`);
    }
    sections.push(`<section><h4>快捷键</h4><pre>Enter/Space/点击 推进 · A 自动 · Ctrl 快进 · L 回想 · S 存档 · O 设置 · F2 调试 · Esc 菜单</pre></section>`);
    this.body.innerHTML = sections.join('');
  }
}
