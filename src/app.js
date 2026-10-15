/**
 * app.js —— 总装：把「内核」和「表现层」缝起来
 *
 * 职责边界（这条线很重要）：
 *   内核(src/core)  —— 剧本怎么走、变量怎么变、存档怎么存。不知道 DOM 存在。
 *   表现(src/ui)    —— 怎么好看。不知道剧情存在。
 *   App(本文件)     —— 唯一同时认识两边的地方，做翻译：
 *                      {type:'show', character:'yuki'} → stage.show('yuki', ...)
 *                      'advance'                      → story 生成器的下一个 yield
 *
 * 想换渲染方式（Canvas / PixiJS / 甚至 Electron 窗口）只需要换掉 ui/ 目录 + 这里的
 * 转发逻辑，chapters/ 和 core/ 一行都不用动。
 */

import { deepFreeze, sleep } from './core/util.js';
import { PathResolver } from './core/paths.js';
import { AssetLoader } from './core/loader.js';
import { StoryVars } from './core/vars.js';
import { SaveManager } from './core/save.js';
import { ChapterRegistry } from './core/registry.js';
import { StoryReader } from './core/story.js';
import { Stage } from './ui/stage.js';
import { TextBox } from './ui/textbox.js';
import { ChoiceMenu } from './ui/choices.js';
import { Backlog, Hud, SettingsPanel, Toast } from './ui/hud.js';
import {
  ChapterSelect,
  DebugPanel,
  EndingScreen,
  LoadingOverlay,
  SaveScreen,
  TitleScreen,
} from './ui/screens.js';

export const ENGINE_VERSION = '1.0.0';

/** 全局默认配置：章节可以覆盖其中任意一项 */
export const DEFAULT_CONFIG = deepFreeze({
  title: '无名之夏',
  subtitle: '一个可替换立绘 / 章节文本的视觉小说骨架',
  namespace: 'gal',
  gameVersion: '0.1.0',
  /** 首次进入时需要玩家输入名字 */
  askPlayerName: true,
  defaultPlayerName: '悠',
  /** 起始章节：null 表示取清单里第一个 */
  startChapter: null,

  story: {
    cps: 45,
    autoWait: 1100,
  },

  audio: {
    masterVolume: 0.8,
    bgmVolume: 0.55,
    seVolume: 0.8,
  },

  paths: {},
  /** 资源探测：开发时 true（丢文件进目录就能用），上线可改 false + 生成 manifest */
  verifyAssets: true,
  debug: false,
});

export class App {
  /**
   * 私有字段必须在类体里显式声明。
   * 今天已经因为漏声明 #emptyState 导致整个游戏起不来一次，别再犯。
   */
  #inWait = false;

  /**
   * @param {HTMLElement} root 游戏挂载点
   * @param {object} [config] 覆盖 DEFAULT_CONFIG
   */
  constructor(root, config = {}) {
    this.root = root;
    this.config = mergeConfig(DEFAULT_CONFIG, config);
    this.logs = [];
    this.state = this.#emptyState();

    this.paths = new PathResolver({ baseUrl: this.config.baseUrl, paths: this.config.paths });
    this.registry = new ChapterRegistry({
      paths: this.paths,
      log: (message, level) => this.log(message, level),
      engineVersion: ENGINE_VERSION,
    });
    this.loader = new AssetLoader({
      paths: this.paths,
      verify: this.config.verifyAssets,
      onError: (info) => this.log(`⚠ 资源: ${info.message ?? info.url}`, 'warn'),
    });
    this.saves = new SaveManager({
      namespace: this.config.namespace,
      gameVersion: this.config.gameVersion,
    });
    this.saves.onError = (err) => this.toast?.show(`存档写入失败：${err.message}`, { level: 'error' });

    this.timers = new Set();
    this.busy = true;
    this.buildDom();
  }

  /** 一局的运行时状态（可存档的部分在 #savePayload 里挑出来） */
  #emptyState() {
    return {
      /** 是否正在播放（决定「点击推进」生不生效） */
      playing: false,
      /** 当前章节 id */
      chapterId: null,
      /** 当前章节对象（含 report 校验结果） */
      chapter: null,
      /** 主角名字（读档时会被存档里的值覆盖） */
      playerName: null,
      /** 已读标记：`章节#块:序号` → 次数。快进时「跳过未读」要用 */
      visited: {},
      /** 本次游玩时长（毫秒），每秒累加一次 */
      playTimeMs: 0,
      /** 章末要提示的下一章 id */
      pendingNext: null,
      startedAt: null,
      endedAt: null,
    };
  }

  /* ================================================================== */
  /*                              初始化                                */
  /* ================================================================== */

  async init() {
    this.buildStage();

    this.loading.show(this.config.title, '正在读取章节清单…');
    await this.registry.loadManifest();
    await this.registry.loadCharacters();
    this.stage.setCharacters(this.registry.characters);

    // 顺手读一次资源清单（assets/manifest.json）：
    // 有它就不需要为每个资源发 HEAD 探测请求。没有也不影响运行。
    await this.loader.loadManifest();
    if (this.loader.manifest) {
      this.log(`资源清单已加载：${this.loader.manifest.count} 个文件（零探测模式）`);
    }

    this.settings = this.saves.settings({
      cps: this.config.story.cps,
      autoWait: this.config.story.autoWait,
      masterVolume: Math.round(this.config.audio.masterVolume * 100),
      skipUnread: false,
    });
    this.applySettings();

    this.titleScreen.update({
      title: this.config.title,
      subtitle: this.config.subtitle,
      hasSave: !!this.saves.latest(),
      meta: this.#titleMeta(),
    });

    this.loading.hide();
    this.showTitle();
    this.log(`引擎 ${ENGINE_VERSION} 就绪；章节 ${this.registry.entries.length} 个，角色 ${Object.keys(this.registry.characters).length} 个`);
    return this;
  }

  #titleMeta() {
    const progress = this.saves.progress();
    const cleared = Object.keys(progress.cleared).length;
    const endings = Object.keys(progress.endings).length;
    const failures = this.registry.manifestError ? ' · <span class="warn">章节清单未能加载</span>' : '';
    return `引擎 v${ENGINE_VERSION} · 已通关 ${cleared} 章 · 已达成结局 ${endings} 个${failures}`;
  }

  buildDom() {
    this.root.classList.add('gal-root');
    this.root.innerHTML = `
      <div class="viewport">
        <div class="screen-host"></div>
        <div class="stage" data-stage></div>
      </div>
    `;
    this.viewport = this.root.querySelector('.viewport');
    this.screenHost = this.root.querySelector('.screen-host');
    this.stageRoot = this.root.querySelector('[data-stage]');
  }

  buildStage() {
    this.stage = new Stage(this.stageRoot, {
      loader: this.loader,
      characters: this.registry.characters,
      onError: (info) => this.log(`⚠ 舞台: ${info.message}`, 'warn'),
      // 新立绘上场时重算它的尺寸（尺寸由 App 统一控制，见 applySpriteLayout）
      onSpriteAdded: () => this.refreshSpriteSizes(),
    });
    this.textbox = new TextBox(this.stageRoot, { settings: this.settings });
    this.choices = new ChoiceMenu(this.stageRoot);
    this.toast = new Toast(this.stageRoot);

    this.hud = new Hud(this.stageRoot, {
      title: '',
      onAction: (action) => this.onHudAction(action),
    });
    this.backlog = new Backlog(this.stageRoot);
    this.backlogEntries = [];

    this.titleScreen = new TitleScreen(this.screenHost, {
      onStart: () => this.continueOrStart(),
      onContinue: () => this.continueFromSave(),
      onChapters: () => this.showChapterSelect(),
      onImport: () => this.importArchive(),
    });
    this.chapterSelect = new ChapterSelect(this.screenHost, {
      onPick: (chapter) => this.startChapter(chapter.id, { fresh: true }),
      onBack: () => this.showTitle(),
    });
    this.endingScreen = new EndingScreen(this.screenHost, {
      onBack: () => this.showChapterSelect(),
      onReplay: () => this.state.chapterId && this.startChapter(this.state.chapterId, { fresh: true }),
      onNext: () => this.state.pendingNext && this.startChapter(this.state.pendingNext, { fresh: false }),
    });
    this.loading = new LoadingOverlay(this.screenHost);

    // 音频总线：浏览器在玩家第一次交互之前禁止出声，所以这里挂一个一次性的解锁
    this.audio = new AudioBus(this.loader, {
      onBlocked: () => this.toast?.show('浏览器拦截了自动播放，点一下画面即可恢复声音', { level: 'warn' }),
    });
    const unlock = () => {
      this.audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.saveScreen = new SaveScreen(this.screenHost, {
      onSave: (slot) => this.saveToSlot(slot),
      onLoad: (slot) => this.loadFromSlot(slot),
      onDelete: (slot) => {
        this.saves.remove(slot);
        this.refreshSaveScreen();
      },
      onClose: () => this.saveScreen.close(),
      onExport: () => this.exportArchive(),
    });
    this.settingsPanel = new SettingsPanel(this.stageRoot, {
      settings: {},
      onChange: () => {
        this.applySettings();
        this.saves.saveSettings(this.settings);
      },
    });
    this.debugPanel = new DebugPanel(this.stageRoot, {
      onReload: () => this.reloadChapter(),
      onForce: () => this.forceContinue(),
      onClose: () => this.debugPanel.close(),
    });

    this.bindInput();
    this.bindViewport();
  }

  /**
   * 双向自适应布局。
   *
   * 设计思路：**宽度恒定 1280，高度跟着窗口走**。
   *
   *   · 所有 UI 都按 1280 宽排版，字号用 --vunit（= 窗口宽/1280）算，
   *     所以在任何窗口宽度下文字和按钮的比例都正常。
   *   · 画布高度 = 窗口高 / 缩放系数，也就是**永远填满窗口**，不留黑边。
   *   · 立绘站在「按画布高度算出来的位置」——由 --sprite-lift 决定，
   *     所以窗口高的时候它下移、窗口矮的时候它上移，头永远不会被切掉。
   *
   * 为什么不用「固定 1280x720 画布 + 等比缩放」：
   *   那个做法在宽屏（1920x1080）下必须放大 1.5 倍才能填满宽度，
   *   结果 720 的设计高度乘 1.5 变成 1080，立绘（640 设计高）顶到了 y=-459 ——
   *   头直接被切出画面。实测 7 个典型视口里有 2 个是这样。
   *
   * 高度上下限的意义：
   *   · 不小于 620 —— 太扁的窗口（比如 1400x400）会让对话框挤满整个画面
   *   · 不大于窗口高对应的值 —— 超过就没有意义了
   */
  bindViewport() {
    this.designWidth = 1280;
    /**
     * 画布高度下限。
     *
     * 为什么要 760：如果画布太扁（比如手机横屏 844x390 → 画布只有 620 高），
     * 按 62% 算出来的立绘加上底部偏移会顶到顶部按钮上。760 是实测出来的
     * 安全下限（见 tools/viewport-test.mjs 的 7 个典型视口）。
     * 代价：特别扁的窗口会有轻微上下裁切 —— 但比「立绘头被按钮压住」好得多。
     */
    this.canvasMinHeight = 760;

    this.onResize = () => {
      const width = Math.max(320, window.innerWidth || this.designWidth);
      const height = Math.max(240, window.innerHeight || 720);

      // 缩放系数只由宽度决定 —— 这样字号和按钮在任何宽度下比例一致
      const scale = width / this.designWidth;
      const vunit = Math.max(0.1, scale);
      this.currentVunit = vunit;

      // 画布高度：填满窗口，但不小于下限
      const canvasHeight = Math.max(this.canvasMinHeight, Math.round(height / vunit));

      this.canvasHeight = canvasHeight;
      this.setProperty('--vw', String(this.designWidth));
      this.setProperty('--vh', String(canvasHeight));
      this.setProperty('--vscale', String(vunit));
      this.setProperty('--vunit', `${vunit}px`);

      // 立绘：先按画布高度定基准高度，再算出底边应该放多低
      this.applySpriteLayout();
    };

    this.onResize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  setProperty(name, value) {
    this.root.style.setProperty(name, value);
    document.documentElement.style.setProperty(name, value);
  }

  /**
   * 立绘站位 —— 直接写内联样式，单位是**设计单位（px）**。
   *
   * ⚠️ 千万别在这里乘 --vunit。
   *    .viewport 本身已经有 transform: scale(vunit)，里面的元素只要写设计值，
   *    缩放由最外层统一处理。之前这里多乘了一次 vunit，等于把缩放平方了：
   *    446 × 1.5 × 1.5 ≈ 1004px，立绘被撑高一倍、头直接切出画面。
   *
   * 站位逻辑：
   *    对话框是 bottom 定位，占据画布底部约 240 设计单位。
   *    立绘底边比对话框顶边再低 60 → 下半身被挡住，像「站在桌子后面」，脚不悬空。
   *
   * 立绘高度 = 画布高度的 62%，夹在 420~780：
   *    宽屏（画布矮）→ 小一点，头仍在画面里；竖屏（画布高）→ 大一点，不显空。
   */
  applySpriteLayout() {
    const canvasHeight = this.canvasHeight ?? 720;
    const textboxBand = 240; // 对话框占据的设计高度

    this.spriteBaseHeight = Math.max(420, Math.min(780, Math.round(canvasHeight * 0.62)));

    /**
     * 立绘底边 = 对话框顶边 + 170 设计单位。
     *
     * 为什么要往下压这么多：立绘图的下缘留了空白（原始素材裁的是全身 + 一点边距），
     * 所以「图的下缘对齐对话框顶边」会让人物悬空一百多像素。
     * 压下去之后腿被对话框挡住一截 —— 这正是视觉小说想要的效果：
     * 人物像站在桌子后面，而不是浮在地板上。
     */
    this.spriteBottomDesign = Math.max(0, textboxBand - 170);
    this.refreshSpriteSizes();
  }

  /**
   * 把算好的尺寸刷到舞台上已有的立绘上。
   * 新增立绘时也要调用（Stage 通过 onSpriteAdded 回调），否则新角色会用旧尺寸。
   */
  refreshSpriteSizes() {
    if (!this.stageRoot) return;
    const base = this.spriteBaseHeight ?? 620;
    const bottom = this.spriteBottomDesign ?? 180;

    for (const element of this.stageRoot.querySelectorAll('.sprite')) {
      const scale = Number(element.dataset.scale || '1') || 1;
      element.style.height = `${Math.round(base * scale)}px`;
      element.style.bottom = `${Math.round(bottom)}px`;
    }
  }

  /* ================================================================== */
  /*                                 输入                                */
  /* ================================================================== */

  bindInput() {
    const stageClick = (event) => {
      if (event.target.closest('button, input, .choices, .overlay, .debug, .hud')) return;
      this.advance();
    };
    this.stageRoot.addEventListener('click', stageClick);

    this.onKeyDown = (event) => {
      if (event.repeat && event.key !== 'Control') return;
      const key = event.key;

      if (key === 'F2') {
        event.preventDefault();
        this.debugPanel.toggle(this.debugData());
        return;
      }
      if (this.choices.active && this.choices.handleKey(event)) {
        event.preventDefault();
        return;
      }
      if (key === 'Escape') {
        event.preventDefault();
        if (this.backlog.opened) this.backlog.close();
        else if (this.settingsPanel.opened) this.settingsPanel.close();
        else if (this.saveScreen.opened) this.saveScreen.close();
        else if (this.debugPanel.opened) this.debugPanel.close();
        else if (!this.state.playing) this.showTitle();
        else this.onHudAction('menu');
        return;
      }
      if (this.settingsPanel.opened || this.saveScreen.opened || this.backlog.opened) return;

      switch (key) {
        case 'Enter':
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          this.advance();
          break;
        case 'a':
        case 'A':
          this.onHudAction('auto');
          break;
        case 'l':
        case 'L':
          this.onHudAction('backlog');
          break;
        case 's':
        case 'S':
          this.onHudAction('save');
          break;
        case 'o':
        case 'O':
          this.onHudAction('settings');
          break;
        case 'Control':
          this.setSkip(true);
          break;
        default:
          break;
      }
    };

    this.onKeyUp = (event) => {
      if (event.key === 'Control') this.setSkip(false);
    };

    this.onBlur = () => {
      this.setSkip(false);
      this.setAuto(false);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.audio?.stopBgm(0);
    this.stage?.destroy();
    this.root.innerHTML = '';
  }

  /* ================================================================== */
  /*                              宿主接口                               */
  /*   下面这些方法就是「内核眼里的世界」，内核只调它们、不关心实现       */
  /* ================================================================== */

  /** @type {import('./core/story.js').StoryReader | null} */
  reader = null;

  character(id) {
    return this.registry.getCharacter(id);
  }

  /**
   * 只读的「等待状态」查询。
   * 给自动化测试用：脚本驱动的测试无法像人一样「看到文字已经出完了」，
   * 只能问引擎「现在是不是在等我输入」。真正玩的时候用不到它。
   */
  get inputState() {
    return {
      playing: !!this.state.playing,
      chapterId: this.state.chapterId,
      cursor: this.reader?.cursor ?? null,
      typing: !!this.textbox?.isTyping,
      waiting: typeof this.pendingAdvance === 'function',
      choiceOpen: !!this.choices?.active,
      choiceCount: this.choices?.buttons?.length ?? 0,
      auto: !!this.autoPlay,
      skip: !!this.skip,
      textboxHidden: document.querySelector('.textbox')?.classList.contains('is-hidden') ?? true,
      busy: this.loading ? !document.querySelector('.loading')?.classList.contains('is-hidden') : false,
    };
  }

  canLoadChapter(id) {
    return (this.registry.entries ?? []).some((entry) => entry.id === id) || !!this.registry.get(id);
  }

  onEffects(applied) {
    this.log(`变量变化: ${applied.map((item) => `${item.key}${item.kind === 'change' ? '→' : '='}${format(item.value)}`).join(', ')}`);
  }

  onScriptError(entry) {
    this.toast.show(`剧本出错（已跳过）: ${entry.message}`, { level: 'error', duration: 4200 });
  }

  /* ================================================================== */
  /*                              播放循环                               */
  /* ================================================================== */

  /**
   * 从存档或章节开头开始播放。
   * @param {{chapterId: string, cursor?: object, snapshot?: object, fresh?: boolean}} options
   */
  async play({ chapterId, cursor = null, snapshot = null, fresh = true }) {
    // 先让上一章的播放循环失效。不然它的生成器会从某个 await 里醒过来，
    // 继续写 state.chapter，表现为「跳章之后又自己跳回旧章节」。
    this.reader?.stop();
    this.#cancelPendingAdvance();
    this.choices?.close();
    this.state.playing = true;
    await this.loader.loadManifest();
    this.state.chapterId = chapterId;
    this.endingScreen.hide();
    this.chapterSelect.hide();
    this.titleScreen.hide();
    this.hud.setVisible(true);

    if (fresh) {
      this.state.visited = {};
      this.state.playTimeMs = 0;
      this.state.startedAt = Date.now();
      this.backlogEntries = [];
      this.reader = null;
    }

    // 1) 动态加载章节模块（这一步就是「玩到第 N 章才下载第 N 章」）
    let chapter;
    try {
      this.loading.show('正在加载章节…', chapterId);
      chapter = await this.registry.load(chapterId);
    } catch (err) {
      this.loading.hide();
      this.toast.show(`章节 ${chapterId} 加载失败：${err.message}`, { level: 'error', duration: 6000 });
      this.showChapterSelect();
      return;
    }
    this.state.chapter = chapter;
    this.hud.setTitle(chapter.title);

    // 2) 预加载本章声明的资源
    const requirements = AssetLoader.buildRequirements(chapter);
    if (requirements.length) {
      this.loading.show(chapter.title, `准备素材 0/${requirements.length}`);
      const report = await this.loader.preload(requirements, {
        onProgress: (done, total) => this.loading.progress(done, total),
      });
      if (report.failed) {
        this.toast.show(`有 ${report.failed} 个素材缺失，已用占位继续`, { level: 'warn', duration: 4000 });
      }
    }
    this.loading.hide();

    // 2.5) 后台偷偷预取「下一章」的代码和素材。
    //      这样玩家走到章末时，下一章几乎是瞬开的 —— 不用再看一次加载条。
    //      刻意放在 preload 之后、且不 await：不能拖慢当前章的进场。
    if (chapter.next) {
      this.#prefetchChapter(Array.isArray(chapter.next) ? chapter.next[0] : chapter.next);
    }

    // 3) 变量：读档就恢复，否则用章节初值
    let vars;
    if (snapshot?.vars) {
      vars = new StoryVars(snapshot.vars, this.#builtins());
    } else {
      vars = new StoryVars({ playerName: this.state.playerName, ...chapter.vars }, this.#builtins());
    }
    this.vars = vars;
    vars.defineBuiltin('chapter', () => this.state.chapterId);
    vars.defineBuiltin('chapterTitle', () => this.state.chapter?.title ?? '');

    if (fresh && this.config.askPlayerName && !this.state.playerName) {
      this.state.playerName = await this.askPlayerName();
      vars.set('playerName', this.state.playerName);
    }

    // 4) 建剧本读取器
    const reader = new StoryReader({
      chapter,
      vars,
      host: this,
      settings: { ...this.settings, ...chapter.settings },
      log: (message) => this.log(message),
    });
    if (cursor) reader.restoreCursor(cursor);
    this.reader = reader;

    await this.stage.fade('black', 380).then((fade) => fade.out(520));
    this.textbox.setVisible(true);
    this.runLoop(reader);
  }

  #builtins() {
    return {
      isEnding: () => !!this.reader?.ending,
      visited: (blockId) => (blockId ? !!this.state.visited?.[blockId] : 0),
    };
  }

  /**
   * 后台预取下一章：先加载模块，再把它的素材预热进缓存。
   *
   * 这是解决「频繁加载章节惹人烦」的主要手段 ——
   * 玩家还在读本章对白的时候，下一章已经在后台准备好了。
   * 全程静默：不显示加载条，失败也不打扰玩家（真走到那一步会正常重试）。
   */
  async #prefetchChapter(chapterId) {
    if (!chapterId || this.prefetching?.has(chapterId) || this.registry.has(chapterId)) return;
    if (!this.prefetching) this.prefetching = new Set();
    this.prefetching.add(chapterId);

    try {
      const chapter = await this.registry.load(chapterId, { validate: false });
      const requirements = AssetLoader.buildRequirements(chapter);
      // 只预热图片和音频，且复用已有缓存 —— 重复请求会被 loader 合并掉
      await this.loader.preload(requirements);
      this.log(`已预取下一章：${chapterId}（${requirements.length} 个资源）`);
    } catch (error) {
      // 预取失败不是错误：玩家真走到那里时会正常加载并报错
      this.log(`预取 ${chapterId} 失败（不影响当前章）：${error.message}`, 'warn');
    } finally {
      this.prefetching?.delete(chapterId);
    }
  }

  /** 生成器主循环 */
  async runLoop(reader) {
    this.ticker = setInterval(() => this.tickStats(), 1000);
    const iterator = reader.run();

    try {
      let input = undefined;
      for (;;) {
        const step = iterator.next(input);
        if (step.done) break;
        input = await this.handleInstruction(step.value);
        // 每处理完一条指令确认一次：这个循环还是「当前」的那一个吗？
        if (reader.isStopped) break;
        if (input === 'stop') break;
      }
    } catch (err) {
      this.log(`✖ 播放中断: ${err.stack ?? err.message}`, 'error');
      this.toast.show(`播放中断：${err.message}`, { level: 'error', duration: 6000 });
    } finally {
      clearInterval(this.ticker);
      this.ticker = null;
    }

    // 被叫停（跳章/读档）的旧循环不许再改状态 —— 新循环已经在跑了
    if (reader.isStopped) return;

    this.state.playing = false;
    this.state.endedAt = Date.now();
    this.autoPlay = false;
    this.hud.setActive('auto', false);
    this.autoSave(`${reader.chapter.id}:auto-end`);
  }

  /** 内核指令 → 具体演出，返回下一个 input 值 */
  async handleInstruction(instruction) {
    if (!instruction) return undefined;

    // 每处理一条指令，之前那个「等待玩家点击」的状态就作废了。
    // 不清掉的话它会一直挂在那儿，advance() 就会去兑现一个早就完成的函数。
    this.#cancelPendingAdvance();

    switch (instruction.type) {
      case 'text':
        return this.showLine(instruction.line);

      case 'choice':
        this.textbox.setVisible(false);
        this.stage.focus(null);
        const chosen = await this.choices.open(instruction);
        this.textbox.setVisible(true);
        return chosen;

      case 'bg':
        await this.stage.setBackground(instruction.id, {
          transition: instruction.transition,
          duration: instruction.duration,
        });
        return undefined;

      case 'cg':
        if (instruction.hide || !instruction.id) {
          await this.stage.hideCg({ duration: instruction.duration });
        } else {
          await this.stage.showCg(instruction.id, {
            transition: instruction.transition,
            duration: instruction.duration,
            hideSprites: instruction.hideSprites,
          });
        }
        return undefined;

      case 'show':
        await this.stage.show(instruction.character, instruction.expr, {
          at: instruction.at,
          transition: instruction.transition,
          duration: instruction.duration,
          flip: instruction.flip,
        });
        return undefined;

      case 'hide':
        if (instruction.all) this.stage.hideAll({ duration: instruction.duration });
        else this.stage.hide(instruction.character, { duration: instruction.duration });
        return undefined;

      case 'move':
        this.stage.move(instruction.character, instruction.at, instruction.duration);
        return undefined;

      case 'shake':
        this.stage.shake({ intensity: instruction.intensity, duration: instruction.duration });
        await sleep(instruction.duration);
        return undefined;

      case 'wait':
        // 可跳过的等待：这是视觉小说的基本礼貌。
        // 之前这里是「死等」，玩家在 1~2 秒的停顿里点鼠标完全没反应，
        // 会以为游戏卡住了（实测最长单条 2.5 秒，一章累积约 40 秒）。
        await this.#interruptibleWait(instruction.duration);
        return undefined;

      case 'bgm':
        await this.audio?.bgm(instruction.id, instruction);
        return undefined;

      case 'se':
        this.audio?.se(instruction.id, instruction);
        return undefined;

      case 'chapterEnd':
        await this.finishChapter(instruction);
        return 'stop';

      default:
        this.log(`未知指令: ${instruction.type}`, 'warn');
        return undefined;
    }
  }

  /** 显示一行对白并等待玩家推进 */
  async showLine(line) {
    // 记录「已读」：快进时跳过未读文本要靠它
    const key = `${this.state.chapterId}#${this.reader.blockId}:${this.reader.index}`;
    const seenBefore = !!this.state.visited[key];
    this.state.visited[key] = (this.state.visited[key] ?? 0) + 1;

    this.backlogEntries.push({ displayName: line.displayName, text: line.text });
    if (this.backlogEntries.length > 300) this.backlogEntries.shift();

    this.stage.focus(line.narration ? null : line.who);

    const skip = this.skip && (!this.settings.skipUnread || seenBefore);
    const mode = skip ? 'skip' : 'normal';

    await this.textbox.show(line, { mode });
    if (skip) return 'advance';

    const reason = await this.waitForAdvance();
    if (reason === 'stop') return 'stop';
    return 'advance';
  }

  /** 等待玩家推进（同时处理自动播放 / 快进） */
  waitForAdvance() {
    // 快进模式不需要等
    if (this.skip) return Promise.resolve('skip');

    // 自动播放：交给对话框自己计时
    if (this.autoPlay) {
      const token = ++this.autoToken;
      return this.textbox.waitForAdvance({ auto: true }).then((reason) => {
        // 计时期间玩家自己点了 -> 上面那个 promise 已经被兑现，这里直接放行
        if (token !== this.autoToken) return 'advance';
        return reason === 'auto-cancelled' ? 'stop' : reason;
      });
    }

    // 手动模式：登记一个「一次性的」兑现函数
    this.#cancelPendingAdvance();
    return new Promise((resolve) => {
      let settled = false;
      const settle = (reason) => {
        if (settled) return;
        settled = true;
        if (this.pendingAdvance === settle) this.pendingAdvance = null;
        resolve(reason);
      };
      settle.text = this.textbox.fullText;
      this.pendingAdvance = settle;
    });
  }

  /**
   * 取消并释放「等待玩家推进」的状态。
   * 必须成对使用：任何「不再需要玩家输入」的时刻（开始等待、读档、跳章、退出）
   * 都要调用它，否则会留下一个已经兑现过、却还被当成「还在等」的旧函数 ——
   * advance() 会一直去兑现那个死函数，表现为「怎么点都不动」。
   */
  #cancelPendingAdvance() {
    const previous = this.pendingAdvance;
    this.pendingAdvance = null;
    this.autoToken = (this.autoToken ?? 0) + 1;
    previous?.(false);
  }

  /**
   * 玩家点了 / 按了空格。
   *
   * 优先级（这个顺序很重要，改之前踩过坑）：
   *   ① 正在演一段「等待」      → 让等待立刻收尾
   *   ② 文字还在打字            → 补完这一句
   *   ③ 正在等玩家推进          → 放行，进入下一句
   *
   * ① 必须排在 ③ 前面，而且**不能**附加「当前在等输入」这种条件：
   * 等待期间本来就不在等输入，如果加上那个条件，玩家点击就会被走到 ③，
   * 而 ③ 在等待期间是空的 —— 表现为「点了完全没反应」。
   * 这正是用户反馈的「便利店那段卡住了」。
   */
  advance() {
    if (!this.state.playing) return;
    if (this.choices.active) return;
    if (this.saveScreen.opened || this.settingsPanel.opened || this.backlog.opened || this.debugPanel.opened) return;

    // ① 正在等待 -> 记下跳过请求，等待循环会在下一个 40ms 心跳里收尾
    if (this.#inWait) {
      this.waitSkipRequested = true;
      // 顺手把「等玩家推进」也放行，避免等待结束后又停在同一句
      const pending = this.pendingAdvance;
      this.pendingAdvance = null;
      pending?.('advance');
      return;
    }

    // ② 还在打字：先补完这一句
    if (this.textbox.isTyping) {
      this.textbox.finish();
      return;
    }

    // ③ 正常推进
    const resolve = this.pendingAdvance;
    this.pendingAdvance = null;
    resolve?.('advance');
  }

  /**
   * 可被打断的等待。
   *
   * 四种情况会提前结束：
   *   ① 玩家点击 / 按空格  → waitSkipRequested（这就是「点击跳过停顿」）
   *   ② 快进模式开启
   *   ③ 这个 reader 被叫停了（跳章 / 读档）
   *   ④ 等待时长为 0
   *
   * 为什么分片轮询而不是直接 setTimeout：
   *   setTimeout 排下去就不可取消，而这里需要在一个 await 里同时响应多个外部信号。
   *
   * 为什么点击后只压到 120ms 而不是 0：
   *   完全瞬间跳过会让转场失去节奏感；留 120ms 既让玩家觉得"响应了"，
   *   又保住了「这里本来有一拍停顿」的演出意图。
   */
  async #interruptibleWait(ms) {
    const total = Math.max(0, Number(ms) || 0);
    if (total === 0) return;
    if (this.skip || this.reader?.isStopped) return;

    this.waitSkipRequested = false;
    this.#inWait = true;

    const step = 40;
    let elapsed = 0;
    while (elapsed < total) {
      if (this.skip || this.reader?.isStopped) break;
      if (this.waitSkipRequested) {
        await sleep(Math.min(120, total - elapsed));
        break;
      }
      await sleep(step);
      elapsed += step;
    }

    this.#inWait = false;
    this.waitSkipRequested = false;
  }

  tickStats() {
    if (!this.state.playing) return;
    this.state.playTimeMs += 1000;
    if (this.debugPanel.opened) this.debugPanel.render(this.debugData());
  }

  /* ================================================================== */
  /*                              章节收尾                               */
  /* ================================================================== */

  async finishChapter({ chapter, ending, next }) {
    this.#cancelPendingAdvance();
    this.choices.close();
    this.textbox.setVisible(false);
    this.stage.hideAll({ duration: 400 });
    await this.stage.fade('black', 600).then((fade) => fade.out(0));

    const endingDef = ending ? chapter.endings?.[ending] : null;
    const endingId = ending ? `${chapter.id}:${ending}` : null;

    this.saves.markCleared(chapter.id, {
      endingId,
      nextChapterIds: [].concat(next ?? [], chapter.next ?? []).filter(Boolean),
    });

    // 自动存档
    this.autoSave(`${chapter.id}:clear`);

    const stats = this.#chapterStats(chapter);
    this.state.pendingNext = (Array.isArray(next) ? next[0] : next) ?? chapter.next ?? null;
    if (Array.isArray(this.state.pendingNext)) this.state.pendingNext = this.state.pendingNext[0];

    this.endingScreen.show({
      endingId,
      title: endingDef?.title ?? `第 ${String(chapter.order).padStart(2, '0')} 章 · ${chapter.title}`,
      description: endingDef?.description ?? endingDef?.summary ?? chapter.summary ?? '—— 本章结束 ——',
      stats,
      hasNext: !!this.state.pendingNext,
    });

    this.titleScreen.update({
      title: this.config.title,
      subtitle: this.config.subtitle,
      hasSave: !!this.saves.latest(),
      meta: this.#titleMeta(),
    });
    this.log(`✔ 章节 ${chapter.id} 结束${endingId ? `，结局 ${endingId}` : ''}`);
  }

  #chapterStats(chapter) {
    const report = chapter.report;
    const vars = this.vars?.summary() ?? '';
    const rows = [
      ['已加载章节', `${this.registry.loaded.size} 个`],
      ['本章语句', report ? `${report.stats.statements} 句 / ${report.stats.blocks} 块` : '—'],
      ['本章分支', report ? `${report.stats.choices} 处选择` : '—'],
      ['本次游玩', formatDuration(this.state.playTimeMs)],
      ['关键变量', vars || '—'],
    ];
    return `<dl class="stats">${rows
      .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`)
      .join('')}</dl>`;
  }

  /* ================================================================== */
  /*                              界面切换                               */
  /* ================================================================== */

  showTitle() {
    this.reader?.stop();
    this.#cancelPendingAdvance();
    this.state.playing = false;
    this.choices.close();
    this.textbox.setVisible(false);
    this.textbox.clear();
    this.hud.setVisible(false);
    this.chapterSelect.hide();
    this.endingScreen.hide();
    this.titleScreen.update({
      title: this.config.title,
      subtitle: this.config.subtitle,
      hasSave: !!this.saves.latest(),
      meta: this.#titleMeta(),
    });
    this.titleScreen.show();
  }

  async showChapterSelect() {
    const list = await this.registry.list({ progress: this.saves.progress() });
    this.chapterSelect.render(list);
    this.titleScreen.hide();
    this.endingScreen.hide();
    this.textbox.setVisible(false);
    this.hud.setVisible(false);
    this.chapterSelect.show();
    this.log(`章节列表: ${list.map((chapter) => `${chapter.id}${chapter.loaded ? '(已加载)' : ''}`).join(', ')}`);
  }

  async continueOrStart() {
    const latest = this.saves.latest();
    if (latest) return this.continueFromSave();
    const chapters = await this.registry.list({ progress: this.saves.progress() });
    const first = chapters.find((chapter) => !chapter.locked && chapter.status !== 'planned');
    if (!first) {
      this.toast?.show('没有可玩的章节，请先在 chapters/index.js 里登记', { level: 'warn' });
      return this.showChapterSelect();
    }
    return this.startChapter(this.config.startChapter ?? first.id, { fresh: true });
  }

  continueFromSave() {
    const latest = this.saves.latest();
    if (!latest) {
      this.toast?.show('还没有存档，开始新游戏吧', { level: 'info' });
      return this.continueOrStart();
    }
    return this.startChapter(latest.payload.chapterId, {
      fresh: false,
      cursor: latest.payload.cursor,
      snapshot: latest.payload,
    });
  }

  async startChapter(chapterId, { fresh = true, cursor = null, snapshot = null } = {}) {
    if (!chapterId) return this.showChapterSelect();
    this.chapterSelect.hide();
    this.endingScreen.hide();
    return this.play({ chapterId, fresh, cursor, snapshot });
  }

  async reloadChapter() {
    if (!this.state.chapterId) return;
    this.registry.loaded.delete(this.state.chapterId);
    this.debugPanel.close();
    this.toast.show('重新加载本章…');
    return this.startChapter(this.state.chapterId, { fresh: true });
  }

  /** 章节结构校验没过时，开发模式可以强行继续看是哪句炸的 */
  forceContinue() {
    const chapter = this.state.chapter;
    if (!chapter) return;
    chapter.invalid = false;
    this.debugPanel.close();
    this.toast.show('已忽略校验错误继续播放', { level: 'warn' });
    this.play({ chapterId: chapter.id, fresh: false, snapshot: { vars: this.vars?.serialize() }, cursor: this.reader?.cursor });
  }

  /* ================================================================== */
  /*                               HUD 动作                              */
  /* ================================================================== */

  onHudAction(action) {
    switch (action) {
      case 'auto':
        this.setAuto(!this.autoPlay);
        break;
      case 'skip':
        this.setSkip(!this.skip);
        break;
      case 'backlog':
        this.backlog.toggle(this.backlogEntries);
        break;
      case 'save':
        this.openSaveScreen('save');
        break;
      case 'settings':
        this.settingsPanel.opened ? this.settingsPanel.close() : this.settingsPanel.open();
        break;
      case 'menu':
        this.showChapterSelect();
        break;
      case 'debug':
        this.debugPanel.toggle(this.debugData());
        break;
      default:
        break;
    }
  }

  setAuto(enabled) {
    this.autoPlay = enabled;
    this.hud.setActive('auto', enabled);
    if (enabled) {
      this.setSkip(false);
      // 如果正在等玩家点击，立刻放行，自动播放马上接手
      this.pendingAdvance?.('auto');
      this.pendingAdvance = null;
    } else {
      this.textbox.cancelAuto();
    }
  }

  setSkip(enabled) {
    if (enabled && !this.state.playing) return;
    this.skip = enabled;
    this.hud.setActive('skip', enabled);
    if (enabled) {
      this.setAuto(false);
      this.textbox.finish();
      this.pendingAdvance?.('skip');
      this.pendingAdvance = null;
    }
  }

  applySettings() {
    const settings = this.settings ?? {};
    this.textbox?.configure({ cps: settings.cps, autoWait: settings.autoWait });
    this.audio?.setVolume({
      master: (settings.masterVolume ?? 80) / 100,
      bgm: this.config.audio.bgmVolume,
      se: this.config.audio.seVolume,
    });
    this.settingsPanel && (this.settingsPanel.settings = settings);
  }

  /* ================================================================== */
  /*                                存档                                 */
  /* ================================================================== */

  #savePayload(preview) {
    return {
      chapterId: this.state.chapterId,
      cursor: this.reader?.cursor ?? null,
      vars: this.vars?.serialize() ?? {},
      visited: this.state.visited ?? {},
      playTimeMs: this.state.playTimeMs ?? 0,
      playerName: this.state.playerName ?? null,
      preview: preview ?? this.backlogEntries.slice(-1)[0]?.text ?? '',
    };
  }

  autoSave(tag) {
    const payload = this.#savePayload();
    const record = this.saves.save('auto', payload, {
      chapterId: this.state.chapterId,
      chapterTitle: this.state.chapter?.title ?? '',
      tag,
    });
    if (record.ok) this.log(`自动存档 → ${tag}`);
    return record;
  }

  saveToSlot(slot) {
    const payload = this.#savePayload(`手动存档 · ${this.backlogEntries.slice(-1)[0]?.text?.slice(0, 24) ?? ''}`);
    const record = this.saves.save(slot, payload, {
      chapterId: this.state.chapterId,
      chapterTitle: this.state.chapter?.title ?? '',
    });
    this.toast.show(record.ok ? '已存档' : '存档失败（浏览器可能禁止了本地存储）', {
      level: record.ok ? 'info' : 'error',
    });
    this.refreshSaveScreen();
  }

  async loadFromSlot(slot) {
    const record = this.saves.load(slot);
    if (!record) {
      this.toast.show('这个存档是空的', { level: 'warn' });
      return;
    }
    if (record.unsupported) {
      this.toast.show('这个存档来自更新的版本，无法读取', { level: 'error' });
      return;
    }
    this.saveScreen.close();
    this.state.playerName = record.payload.playerName ?? this.state.playerName;
    this.state.visited = record.payload.visited ?? {};
    this.state.playTimeMs = record.payload.playTimeMs ?? 0;
    this.log(`读档 ${slot} → ${record.payload.chapterId}`);
    await this.play({
      chapterId: record.payload.chapterId,
      fresh: false,
      cursor: record.payload.cursor,
      snapshot: record.payload,
    });
  }

  openSaveScreen(mode = 'save') {
    this.saveMode = mode;
    this.refreshSaveScreen();
    this.saveScreen.open();
  }

  refreshSaveScreen() {
    const titles = Object.fromEntries((this.registry.entries ?? []).map((entry) => [entry.id, entry.title]));
    const slots = this.saves.listSlots({ chapterTitleById: titles }).map((slot) =>
      slot.id === 'auto' && this.state.chapterId && slot.empty === false && !slot.chapterTitle
        ? { ...slot, chapterTitle: titles[this.state.chapterId] ?? this.state.chapterId }
        : slot,
    );
    this.saveScreen.render({ mode: this.saveMode ?? 'save', slots });
  }

  exportArchive() {
    const blob = new Blob([this.saves.exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.config.namespace}-saves.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    this.toast.show('已导出存档文件');
  }

  importArchive() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = this.saves.importAll(text);
      this.toast.show(result.ok ? `导入成功（${result.imported} 个存档）` : `导入失败：${result.error}`, {
        level: result.ok ? 'info' : 'error',
      });
      this.titleScreen.update({
        title: this.config.title,
        subtitle: this.config.subtitle,
        hasSave: !!this.saves.latest(),
        meta: this.#titleMeta(),
      });
    });
    input.click();
  }

  /* ================================================================== */
  /*                              杂项                                   */
  /* ================================================================== */

  async askPlayerName() {
    const fallback = this.state.playerName || this.config.defaultPlayerName;
    const answer = typeof window.prompt === 'function'
      ? window.prompt('请输入主角的名字（可留空使用默认名）', fallback)
      : fallback;
    return (answer ?? '').trim() || fallback;
  }

  debugData() {
    const failures = this.loader.listFailures();
    const report = this.state.chapter?.report;
    const reportText = report
      ? [
          `章节 ${report.stats.blocks} 块 / ${report.stats.statements} 句 / ${report.stats.choices} 处选择`,
          `错误 ${report.errors.length}，警告 ${report.warnings.length}`,
          ...report.errors.map((issue) => `✖ ${issue.where ?? ''} ${issue.message}`),
          ...report.warnings.slice(0, 12).map((issue) => `⚠ ${issue.where ?? ''} ${issue.message}`),
        ].join('\n')
      : '（未校验）';

    return {
      cursor: this.reader
        ? `${this.reader.chapter.id} # ${this.reader.blockId} [${this.reader.index}/${this.reader.chapter.script.blocks[this.reader.blockId]?.length ?? 0}]`
        : '—',
      vars: this.vars?.summary() ?? '—',
      assets: [
        this.loader.summary(),
        `已加载章节: ${[...this.registry.loaded.keys()].join(', ') || '无'}`,
        `进行中: ${[...this.registry.pending.keys()].join(', ') || '无'}`,
        ...failures.slice(0, 10).map((entry) => `✖ ${entry.kind} ${entry.url}`),
      ].join('\n'),
      report: reportText,
      errors: this.logs.filter((entry) => entry.level === 'error').slice(-10).map((entry) => entry.message),
    };
  }

  log(message, level = 'info') {
    const entry = { message, level, at: Date.now() };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
    if (this.config.debug) console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[gal] ${message}`);
    return entry;
  }
}

/* ------------------------------------------------------------------ */
/*                              工具函数                               */
/* ------------------------------------------------------------------ */

function mergeConfig(base, override) {
  const out = { ...base, ...(override ?? {}) };
  out.story = { ...base.story, ...(override?.story ?? {}) };
  out.audio = { ...base.audio, ...(override?.audio ?? {}) };
  out.paths = { ...base.paths, ...(override?.paths ?? {}) };
  return out;
}

function format(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return Array.isArray(value) ? `[${value.length}]` : '{…}';
  return String(value);
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/*                              音频管理                               */
/* ------------------------------------------------------------------ */

/**
 * 音频：浏览器不允许没交互就出声，所以这里记住「是否已解锁」，
 * 第一次点击后才真正 play；BGM 切换用 WebAudio 之外的最简做法（音量渐变）。
 */
export class AudioBus {
  constructor(loader, { onBlocked = () => {} } = {}) {
    this.loader = loader;
    this.onBlocked = onBlocked;
    this.unlocked = false;
    this.current = null;
    this.volume = { master: 0.8, bgm: 0.55, se: 0.8 };
    this.fadeTimers = new Set();
  }

  unlock() {
    this.unlocked = true;
  }

  setVolume({ master, bgm, se } = {}) {
    if (master !== undefined) this.volume.master = master;
    if (bgm !== undefined) this.volume.bgm = bgm;
    if (se !== undefined) this.volume.se = se;
    if (this.current) this.current.volume = this.#bgmVolume();
  }

  #bgmVolume() {
    return Math.min(1, Math.max(0, this.volume.master * this.volume.bgm));
  }

  async bgm(id, { action = 'play', fade = 800, loop = true } = {}) {
    if (action === 'stop') return this.stopBgm(fade);
    const element = await this.loader.sound('bgm', { id });
    if (!element) return null;

    if (this.current?.src === element.src) {
      if (this.current.paused && this.unlocked) this.current.play().catch(() => {});
      return this.current;
    }

    const previous = this.current;
    this.current = element;
    element.loop = loop;
    element.volume = 0;
    if (this.unlocked) {
      try {
        await element.play();
      } catch {
        this.onBlocked();
      }
    }
    this.#ramp(element, this.#bgmVolume(), fade);
    if (previous) {
      this.#ramp(previous, 0, fade, () => previous.pause());
    }
    return element;
  }

  stopBgm(fade = 600) {
    if (!this.current) return;
    const element = this.current;
    this.current = null;
    this.#ramp(element, 0, fade, () => element.pause());
  }

  async se(id, { volume = 1 } = {}) {
    const element = await this.loader.sound('se', { id });
    if (!element || !this.unlocked) return null;
    const clone = element.cloneNode(true);
    clone.volume = Math.min(1, Math.max(0, this.volume.master * this.volume.se * volume));
    clone.play().catch(() => {});
    return clone;
  }

  #ramp(element, target, duration, done) {
    const steps = Math.max(1, Math.round(duration / 50));
    const from = Number(element.volume) || 0;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      element.volume = Math.min(1, Math.max(0, from + ((target - from) * step) / steps));
      if (step >= steps) {
        clearInterval(timer);
        this.fadeTimers.delete(timer);
        done?.();
      }
    }, 50);
    this.fadeTimers.add(timer);
  }
}
