/**
 * core/story.js —— 剧本读取器（内核层，纯逻辑、无 DOM）
 *
 * 它是一台「生成器」：把章节脚本解释成一串对宿主环境的指令，交给上层去演。
 * 这样同一份剧本可以在浏览器里演，也可以在 Node 里跑冒烟测试，
 * 还可以将来换成另一个渲染后端 —— 内核永远不需要认识舞台。
 *
 * 脚本格式（章节模块导出 script: {...}）
 * ---------------------------------------------------------------
 * {
 *   id: 'ch01',
 *   blocks: {
 *     start: [
 *       { type:'bg', bg:'classroom', transition:'fade', duration:600 },
 *       { type:'show', character:'yuki', expr:'smile', at:'center' },
 *       ['yuki', '早上好，${playerName}。'],          // 紧凑对白：["角色", "文本", 表情, 姓名]
 *       { type:'text', who:'yuki', text:'……', voice:'v001', cps: 40 },
 *       { type:'choice', prompt:'要怎么回答？', options:[
 *          { text:'「早上好。」', condition:'affection >= 1', effects:['affection += 1'], goto:'morning_warm' },
 *          { text:'（沉默）', goto:'morning_cold' }
 *       ]},
 *       { type:'goto', target:'next' },              // 也可以 { goto:'next' }
 *       { type:'end', ending:'true_end' }
 *     ]
 *   }
 * }
 *
 * 语句类型：text / narration / bg / show / hide / move / shake / wait /
 *          choice / jump / goto / effects / bgm / se / sfx / end
 */

import { isPlainObject, textWeight } from './util.js';
import { createConditionCache, interpolate, safeEvaluate } from './expr.js';

/** 归一化后的语句类型 */
const TYPE_ALIASES = {
  bg: 'bg',
  cg: 'cg',
  still: 'cg',
  show: 'show',
  sprite: 'show',
  hide: 'hide',
  exit: 'hide',
  move: 'move',
  text: 'text',
  say: 'text',
  dialogue: 'text',
  narrate: 'narration',
  narration: 'narration',
  choice: 'choice',
  choose: 'choice',
  goto: 'goto',
  jump: 'goto',
  effects: 'effects',
  effect: 'effects',
  wait: 'wait',
  se: 'se',
  sfx: 'se',
  bgm: 'bgm',
  music: 'bgm',
  shake: 'shake',
  end: 'end',
  finish: 'end',
  label: 'label',
};

export class ScriptError extends Error {
  constructor(message, { chapter, blockId, index } = {}) {
    super(`[${chapter ?? '?'}${blockId ? `#${blockId}` : ''}${index !== undefined ? `:${index}` : ''}] ${message}`);
    this.name = 'ScriptError';
    this.context = { chapter, blockId, index };
  }
}

export function isCompactLine(value) {
  return Array.isArray(value) && typeof value[0] === 'string' && !isPlainObject(value[0]) && TYPE_ALIASES[value[0]] === undefined;
}

export function normalizeStatement(raw, { chapter, blockId, index, knownCharacters = null } = {}) {
  if (raw === null || raw === undefined) throw new ScriptError('语句为空', { chapter, blockId, index });

  // 紧凑数组：["yuki", "台词"] / ["雪见", "台词", "smile"] / ["yuki","台词","smile","雪见"]
  if (Array.isArray(raw)) {
    if (raw.length === 0) throw new ScriptError('空数组语句', { chapter, blockId, index });
    const [who, text, expr, name] = raw;
    return normalizeStatement({ type: 'text', who, text, expr, name }, { chapter, blockId, index });
  }

  if (typeof raw === 'string') {
    return { type: 'narration', text: raw };
  }

  if (!isPlainObject(raw)) throw new ScriptError(`不支持的语句类型: ${typeof raw}`, { chapter, blockId, index });

  const rawType = raw.type ?? raw.kind ?? inferType(raw);
  const type = TYPE_ALIASES[rawType];
  if (!type) throw new ScriptError(`未知语句 type: ${rawType}`, { chapter, blockId, index });

  const statement = { ...raw, type };

  switch (type) {
    case 'text': {
      if (statement.text === undefined && statement.lines !== undefined) statement.text = statement.lines;
      if (typeof statement.text !== 'string') {
        throw new ScriptError('对白缺少字符串 text', { chapter, blockId, index });
      }
      if (statement.who === undefined && statement.character) statement.who = statement.character;
      if (statement.who === undefined && statement.speaker) statement.who = statement.speaker;
      if (statement.who === undefined || statement.who === null || statement.who === '') {
        // 没写说话人 -> 当成旁白处理，比报错友好
        return { ...statement, type: 'narration', text: statement.text };
      }
      statement.who = String(statement.who);
      statement.displayName = statement.name ?? null;
      if (knownCharacters && !knownCharacters[statement.who] && !statement.displayName) {
        statement.displayName = statement.who;
      }
      return statement;
    }
    case 'narration':
      if (typeof statement.text !== 'string') {
        throw new ScriptError('旁白缺少字符串 text', { chapter, blockId, index });
      }
      return statement;
    case 'bg':
      if (!statement.bg && !statement.id) throw new ScriptError('bg 语句缺少 bg 参数', { chapter, blockId, index });
      statement.bg = statement.bg ?? statement.id;
      return statement;
    case 'cg': {
      // { type:'cg', cg:'end_marriage' }          显示定格 CG
      // { type:'cg', hide:true }                  关掉 CG 回到舞台
      if (statement.hide) {
        statement.cg = null;
        return statement;
      }
      statement.cg = statement.cg ?? statement.id ?? statement.name;
      if (!statement.cg) throw new ScriptError('cg 语句缺少 cg 参数（或用 hide:true 关闭）', { chapter, blockId, index });
      return statement;
    }
    case 'show':
      if (!statement.character) throw new ScriptError('show 语句缺少 character', { chapter, blockId, index });
      statement.expr = statement.expr ?? statement.expression ?? 'neutral';
      statement.at = statement.at ?? statement.slot ?? 'center';
      if (knownCharacters && !knownCharacters[statement.character]) {
        throw new ScriptError(`未定义的角色: ${statement.character}`, { chapter, blockId, index });
      }
      return statement;
    case 'hide': {
      if (!statement.character && !statement.all) {
        throw new ScriptError('hide 语句需要 character 或 all:true', { chapter, blockId, index });
      }
      return statement;
    }
    case 'choice': {
      const options = statement.options ?? statement.choices;
      if (!Array.isArray(options) || options.length === 0) {
        throw new ScriptError('choice 语句缺少非空 options', { chapter, blockId, index });
      }
      statement.options = options.map((option, optionIndex) => {
        if (Array.isArray(option)) return { text: String(option[0] ?? ''), goto: option[1] };
        if (typeof option === 'string') return { text: option };
        if (!isPlainObject(option)) {
          throw new ScriptError(`options[${optionIndex}] 格式不对`, { chapter, blockId, index });
        }
        return { ...option, text: String(option.text ?? option.label ?? '') };
      });
      return statement;
    }
    case 'goto':
      statement.target = statement.target ?? statement.goto ?? statement.to;
      if (!statement.target) throw new ScriptError('goto 语句缺少 target', { chapter, blockId, index });
      return statement;
    case 'effects': {
      const effects = statement.effects ?? statement.list ?? statement.value;
      if (!Array.isArray(effects)) throw new ScriptError('effects 需要数组', { chapter, blockId, index });
      statement.effects = effects;
      return statement;
    }
    case 'end': {
      statement.kind = statement.kind ?? (statement.ending || statement.endingId ? 'ending' : 'end');
      statement.ending = statement.ending ?? statement.endingId ?? null;
      return statement;
    }
    case 'se':
    case 'bgm': {
      const id = statement.id ?? statement.se ?? statement.bgm ?? statement.name;
      if (!id) throw new ScriptError(`${type} 语句缺少 id`, { chapter, blockId, index });
      statement.id = id;
      return statement;
    }
    case 'label':
      statement.name = statement.name ?? statement.label ?? statement.id;
      return statement;
    default:
      return statement;
  }
}

function inferType(raw) {
  if (raw.text !== undefined && raw.character === undefined && raw.who === undefined) return 'narration';
  if (raw.text !== undefined && (raw.who !== undefined || raw.character !== undefined)) return 'text';
  if (raw.options || raw.choices) return 'choice';
  if (raw.target || raw.goto) return 'goto';
  if (raw.ending || raw.endingId) return 'end';
  if (raw.bg) return 'bg';
  if (raw.expr && raw.character) return 'show';
  if (raw.effects) return 'effects';
  return undefined;
}

/* ------------------------------------------------------------------ */
/*                           章节内容归一化                            */
/* ------------------------------------------------------------------ */

/** 按 id 排序的自然序（ch01 < ch02 < ch10） */
function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
}

/** 索引器：数组或对象都能按 id 取 */
function toIndex(collection) {
  if (!collection) return {};
  if (Array.isArray(collection)) {
    const out = {};
    for (const item of collection) {
      if (isPlainObject(item) && item.id) out[item.id] = item;
    }
    return out;
  }
  return collection;
}

/**
 * 把章节模块导出的定义补全成引擎内部使用的规范结构。
 * @param {object} definition 模块导出（或 export default）
 * @param {object} context { chapterId, knownCharacters, engineVersion }
 */
export function normalizeChapter(definition, { chapterId, knownCharacters = null, engineVersion = '1.0.0' } = {}) {
  const def = unwrapDefinition(definition);
  if (!isPlainObject(def)) throw new ScriptError('章节模块没有导出对象', { chapter: chapterId });

  const id = def.id ?? chapterId;
  if (!id) throw new ScriptError('章节缺少 id', { chapter: chapterId });

  /**
   * 章节可以有两种写法，都支持：
   *   A. { script: { start, blocks }, ...元数据 }        —— 把正文和其他字段分开（本项目采用）
   *   B. { start, blocks, ...元数据 }                    —— 全部平铺，短章节写起来更省
   * 之所以两种都认，是因为内容作者不该为了「少包一层」去翻引擎代码。
   */
  const scriptSource = isPlainObject(def.script) ? def.script : def;
  const rawBlocks = scriptSource.blocks ?? def.blocks ?? {};
  const blocks = {};
  const labelOwner = new Map();

  for (const [blockId, statements] of Object.entries(rawBlocks)) {
    if (!Array.isArray(statements)) {
      throw new ScriptError(`blocks.${blockId} 必须是数组`, { chapter: id, blockId });
    }
    blocks[blockId] = statements.map((raw, index) => {
      const statement = normalizeStatement(raw, { chapter: id, blockId, index, knownCharacters });
      if (statement.type === 'label' && statement.name) labelOwner.set(statement.name, blockId);
      return statement;
    });
  }

  if (Object.keys(blocks).length === 0) {
    throw new ScriptError(
      '章节没有任何 blocks —— 检查一下是写在 { script: { blocks: {...} } } 里，还是直接平铺成 { blocks: {...} }（两种都行）',
      { chapter: id },
    );
  }

  const start = scriptSource.start ?? def.start ?? Object.keys(blocks)[0];
  if (!blocks[start]) throw new ScriptError(`起始块 ${start} 不存在`, { chapter: id });
  const rawScript = scriptSource.raw ?? null;

  const chapters = toIndex(def.chapters);
  const endings = toIndex(def.endings);
  const roles = toIndex(def.roles);

  return {
    id,
    order: def.order ?? 0,
    title: def.title ?? id,
    subtitle: def.subtitle ?? '',
    summary: def.summary ?? '',
    status: def.status ?? 'released', // released | planned —— planned 只在开发面板里显示
    version: def.version ?? '1.0.0',
    engineVersion: def.engineVersion ?? engineVersion,
    author: def.author ?? '',

    /** 下一章：字符串 / 数组 / { label, chapter } */
    next: def.next ?? null,
    /** 解锁条件：requireCleared 里的章节都通关后才解锁 */
    unlockAfter: def.unlockAfter ?? null,

    /** 本章变量初值（每章可以有自己的局部变量） */
    vars: isPlainObject(def.vars) ? def.vars : {},
    /** 章节内按 flag 分支的文本替换表 */
    textOverrides: isPlainObject(def.textOverrides) ? def.textOverrides : {},
    /** 本章对全局设置的覆盖（打字速度、自动播放等待等） */
    settings: isPlainObject(def.settings) ? def.settings : {},
    /** 本章的角色补充/覆盖（章节可以临时加一个只在本章出现的角色） */
    characters: isPlainObject(def.characters) ? def.characters : {},
    /** 本章的资源声明（不写也行，会自动扫描脚本） */
    assets: isPlainObject(def.assets) ? def.assets : {},
    /** 章节内的性能/错误钩子 */
    hooks: isPlainObject(def.hooks) ? def.hooks : {},

    script: {
      start,
      blocks,
      labels: Object.fromEntries(labelOwner),
      /** 允许章节在运行时追加块（例如程序化生成的对白） */
      register(blockId, statements) {
        if (blocks[blockId]) throw new ScriptError(`块 ${blockId} 已存在`, { chapter: id, blockId });
        blocks[blockId] = statements.map((raw, index) =>
          normalizeStatement(raw, { chapter: id, blockId, index, knownCharacters }),
        );
        return blocks[blockId];
      },
      raw: rawScript,
    },

    /** 子章节（同一文件夹里拆出的剧本文件） */
    chapters: Object.fromEntries(
      Object.entries(chapters).map(([key, value]) => [key, { id: key, ...value }]),
    ),
    endings: Object.fromEntries(
      Object.entries(endings).map(([key, value]) => [
        key,
        { id: key, title: value?.title ?? key, ...(isPlainObject(value) ? value : {}) },
      ]),
    ),
    roles: Object.fromEntries(
      Object.entries(roles).map(([key, value]) => [key, { id: key, ...(isPlainObject(value) ? value : {}) }]),
    ),

    /** 只有 role 是主角视角时才自动插入名字询问 */
    hasEndings: Object.keys(endings).length > 0,
    definition: def,
  };
}

function unwrapDefinition(value) {
  if (isPlainObject(value) && isPlainObject(value.default)) return value.default;
  return value;
}

/* ------------------------------------------------------------------ */
/*                             剧本读取器                              */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  cps: 45, // 打字机速度（字/秒）
  autoWait: 1100, // 自动播放额外停留
  textOverridesBanner: true,
};

export class StoryReader {
  /**
   * @param {object} options
   * @param {object} options.chapter 已归一化的章节
   * @param {import('./vars.js').StoryVars} options.vars
   * @param {object} options.host 演出宿主（见下方 yield 协议）
   */
  constructor({ chapter, vars, host, settings = {}, log = () => {} }) {
    this.chapter = chapter;
    this.vars = vars;
    this.host = host;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.log = log;

    this.blockId = chapter.script.start;
    this.index = 0;
    this.finished = false;
    this.ending = null;
    this.visitedBlocks = [];
    this.check = createConditionCache();
    this.errors = [];
    this.lastChoice = null;
  }

  /* ------------------------------- 存档 ------------------------------- */

  get cursor() {
    return { chapterId: this.chapter.id, blockId: this.blockId, index: this.index };
  }

  restoreCursor(cursor) {
    if (!cursor) return;
    if (cursor.blockId && this.chapter.script.blocks[cursor.blockId]) {
      this.blockId = cursor.blockId;
      this.index = Number(cursor.index) || 0;
    }
  }

  /* ------------------------------ 求值工具 ----------------------------- */

  scope() {
    return this.vars.scope;
  }

  /** 文本插值：先做 ${} 变量替换，再套章节的 textOverrides 分支替换 */
  renderText(text) {
    const interpolated = interpolate(text, this.scope());
    return this.applyTextOverrides(interpolated);
  }

  /**
   * textOverrides 让「同一句对白在不同分支下说不同的话」不需要复制整个块：
   *   textOverrides: { '天台那句': [ { when: 'flag:route_kaede', text: '……' } ] }
   */
  applyTextOverrides(text) {
    const table = this.chapter.textOverrides;
    if (!isPlainObject(table)) return text;
    const entries = table[text];
    if (!Array.isArray(entries)) return text;
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.when === undefined || this.test(entry.when)) return this.renderText(String(entry.text ?? ''));
    }
    return text;
  }

  test(condition) {
    if (condition === undefined || condition === null || condition === '' || condition === true) return true;
    if (condition === false) return false;
    if (typeof condition === 'function') {
      try {
        return !!condition({ vars: this.vars, scope: this.scope(), chapter: this.chapter });
      } catch (err) {
        this.reportError(err, `函数条件执行失败`);
        return false;
      }
    }
    if (typeof condition !== 'string') return !!condition;
    return this.check(condition, this.scope(), (err, source) => this.reportError(err, `条件求值失败: ${source}`));
  }

  applyEffects(effects) {
    const applied = this.vars.applyAll(effects);
    const errors = applied.filter((item) => item.kind === 'error');
    for (const item of errors) this.reportError(new Error(item.message), `effect 应用失败`);
    if (applied.length) this.host?.onEffects?.(applied, effects);
    return applied;
  }

  reportError(error, context) {
    const entry = { message: `${context} —— ${error?.message ?? error}`, error };
    this.errors.push(entry);
    this.host?.onScriptError?.(entry);
    this.log(`⚠️ ${entry.message}`);
  }

  /**
   * 让这个 reader 立刻失效。
   * 场景：玩家在第一章演到一半时点了「章节选择」跳去第二章 ——
   * 旧 reader 的生成器还挂在某个 await 上，醒来后如果继续跑，
   * 就会把 state.chapter 改回旧章节，表现为「跳章之后又自己跳回去」。
   * 所以每个 yield 点都要检查这个开关。
   */
  stop() {
    this.stopped = true;
  }

  get isStopped() {
    return !!this.stopped;
  }

  /** 跳到某个块或标签 */
  goTo(target) {
    const blocks = this.chapter.script.blocks;
    if (blocks[target]) {
      this.blockId = target;
      this.index = 0;
      if (!this.visitedBlocks.includes(target)) this.visitedBlocks.push(target);
      return true;
    }
    const owner = this.chapter.script.labels[target];
    if (owner && blocks[owner]) {
      this.blockId = owner;
      this.index = this.findLabelIndex(owner, target);
      if (!this.visitedBlocks.includes(owner)) this.visitedBlocks.push(owner);
      return true;
    }
    // 跨章节跳转：交给宿主
    if (this.host?.canLoadChapter?.(target)) {
      this.pendingChapter = target;
      return true;
    }
    this.reportError(new Error(`找不到跳转目标: ${target}`), 'goto');
    return false;
  }

  findLabelIndex(blockId, label) {
    const statements = this.chapter.script.blocks[blockId] ?? [];
    const found = statements.findIndex((statement) => statement.type === 'label' && statement.name === label);
    return found === -1 ? 0 : found;
  }

  /* ------------------------------- 主循环 ------------------------------ */

  /**
   * 逐条执行剧本。
   * 每一次 yield 都是交给宿主演出的一个「指令」；宿主处理完再回来取下一步。
   * 宿主返回值约定：
   *   - 'advance'  —— 玩家已经推进到下一句
   *   - 'stop'     —— 玩家要退出本章（回标题 / 读档）
   *   - 其他        —— 当 undefined 处理
   */
  *run() {
    if (!this.visitedBlocks.includes(this.blockId)) this.visitedBlocks.push(this.blockId);

    while (!this.finished) {
      const entryBlock = this.blockId;
      const statements = this.chapter.script.blocks[entryBlock];
      if (!statements) {
        this.reportError(new Error(`块不存在: ${entryBlock}`), 'run');
        this.finished = true;
        break;
      }

      let jumped = false;

      while (this.index < statements.length && !this.finished) {
        if (this.stopped) return this.#stoppedResult();

        const statement = statements[this.index];
        this.index += 1;

        const signal = yield* this.execute(statement);

        // execute() 里可能 await 了很久（转场、图片加载），醒来先看有没有被叫停
        if (this.stopped) return this.#stoppedResult();

        // 语句内部（goto / choice 分支）已经换了块 -> 本块剩余内容作废
        if (this.blockId !== entryBlock) {
          jumped = true;
          break;
        }

        if (signal === 'stop') {
          this.finished = true;
          jumped = true;
          break;
        }
      }

      if (jumped || this.finished) continue;

      // 走到这里说明块「自然结束」了：没有显式跳转。
      if (this.autoNextBlock) {
        const nextBlock = this.autoNextBlock;
        this.autoNextBlock = null;
        this.goTo(nextBlock);
        continue;
      }

      // 约定：存在名为 end 的块时自动落进去当收尾（方便只写一个 end 块）
      if (entryBlock !== 'end' && this.chapter.script.blocks.end) {
        this.goTo('end');
        continue;
      }

      this.finished = true;
      yield { type: 'chapterEnd', chapter: this.chapter, ending: this.ending, next: this.chapter.next };
    }

    return { chapterId: this.chapter.id, ending: this.ending, errors: this.errors, cursor: this.cursor };
  }

  /** 被 stop() 叫停时的收尾信息 */
  #stoppedResult() {
    this.finished = true;
    return { chapterId: this.chapter.id, ending: this.ending, errors: this.errors, cursor: this.cursor, stopped: true };
  }

  /** 执行单条语句，产出指令 */
  *execute(statement) {
    // 每条语句都先看一眼有没有被叫停（读档、跳章、退出都会叫停）
    if (this.stopped) return 'stop';

    switch (statement.type) {
      case 'label':
        return undefined;

      case 'text': {
        const line = this.buildLine(statement);
        const signal = yield { type: 'text', line };
        return signal;
      }

      case 'narration': {
        const line = {
          who: null,
          displayName: null,
          text: this.renderText(statement.text),
          narration: true,
          style: statement.style ?? null,
          cps: statement.cps,
        };
        return yield { type: 'text', line };
      }

      case 'bg':
        yield {
          type: 'bg',
          id: statement.bg,
          transition: statement.transition ?? 'fade',
          duration: statement.duration ?? 600,
        };
        return undefined;

      case 'cg':
        yield {
          type: 'cg',
          id: statement.cg ?? null,
          hide: !!statement.hide,
          transition: statement.transition ?? 'fade',
          duration: statement.duration ?? 800,
          hideSprites: statement.hideSprites !== false,
        };
        return undefined;

      case 'show':
        yield {
          type: 'show',
          character: statement.character,
          expr: this.renderText(statement.expr ?? 'neutral'),
          at: statement.at,
          transition: statement.transition ?? 'fade',
          duration: statement.duration ?? 320,
          flip: !!statement.flip,
        };
        return undefined;

      case 'hide':
        yield {
          type: 'hide',
          character: statement.character ?? null,
          all: !!statement.all,
          duration: statement.duration ?? 320,
        };
        return undefined;

      case 'move':
        yield { type: 'move', character: statement.character, at: statement.at, duration: statement.duration ?? 320 };
        return undefined;

      case 'shake':
        yield { type: 'shake', intensity: statement.intensity ?? 8, duration: statement.duration ?? 400 };
        return undefined;

      case 'wait':
        yield { type: 'wait', duration: statement.duration ?? statement.ms ?? 500 };
        return undefined;

      case 'effects':
        this.applyEffects(statement.effects);
        return undefined;

      case 'bgm':
        yield {
          type: 'bgm',
          id: statement.id,
          action: statement.action ?? 'play',
          volume: statement.volume,
          fade: statement.fade ?? 800,
          loop: statement.loop !== false,
        };
        return undefined;

      case 'se':
        yield { type: 'se', id: statement.id, volume: statement.volume };
        return undefined;

      case 'choice':
        return yield* this.executeChoice(statement);

      case 'goto': {
        if (statement.condition !== undefined && !this.test(statement.condition)) return undefined;
        if (!this.goTo(statement.target)) return 'stop';
        // 跳向「别的章节」时，本块剩余内容作废，并且要立刻告诉宿主换章。
        // 早先这里只记了 pendingChapter 就返回了，于是本块继续往下走、
        // 走到块尾又被「有 end 块就自动落进去」的兜底逻辑接走 ——
        // 表现为：明明写了 goto ch05a，最后却进了本地的 end 块。
        if (this.pendingChapter) {
          this.finished = true;
          yield { type: 'chapterEnd', chapter: this.chapter, ending: null, next: this.pendingChapter };
          return undefined;
        }
        return 'jumped';
      }

      case 'end': {
        this.finished = true;
        this.ending = statement.ending ?? null;
        // 跳向别的章节（pendingChapter）优先于本章的 next
        const following = this.pendingChapter ?? this.chapter.next ?? null;
        yield { type: 'chapterEnd', chapter: this.chapter, ending: this.ending, next: following };
        return undefined;
      }

      default:
        this.reportError(new Error(`未实现的语句类型: ${statement.type}`), 'execute');
        return undefined;
    }
  }

  buildLine(statement) {
    const character = this.host?.character?.(statement.who) ?? null;
    const expr = statement.expr ? this.renderText(statement.expr) : null;
    return {
      who: statement.who,
      displayName: this.renderText(
        statement.displayName ?? statement.name ?? character?.name ?? statement.who ?? '',
      ),
      text: this.renderText(statement.text),
      narration: false,
      voice: statement.voice ?? null,
      cps: statement.cps,
      expr,
      style: statement.style ?? null,
      color: statement.color ?? character?.color ?? null,
    };
  }

  /** 选项：先过滤条件，再交给宿主渲染；被禁用的选项可以显示为灰色 */
  *executeChoice(statement) {
    const options = [];
    for (const [index, option] of statement.options.entries()) {
      const visible = option.showIf === undefined ? true : this.test(option.showIf);
      if (!visible) continue;
      const enabled = option.condition === undefined ? true : this.test(option.condition);
      options.push({
        index,
        text: this.renderText(option.text),
        enabled,
        hint: option.hint ? this.renderText(option.hint) : null,
        style: option.style ?? null,
        /**
         * effects 也一并交给宿主。
         * 渲染界面用不到它（engine 自己会应用），但任何想「预判这个选项的后果」的
         * 东西都需要 —— 比如 tools/playthrough.mjs 的按目标走策略，
         * 以及将来想做「选项预览提示」的界面。
         * 早先漏了这个字段，导致那些工具只能瞎猜，最后所有策略选出一模一样的结果。
         */
        effects: option.effects ?? null,
      });
    }

    if (options.length === 0) {
      this.reportError(new Error('所有选项都被条件过滤掉了'), 'choice');
      return undefined;
    }

    const enabledOptions = options.filter((option) => option.enabled);
    if (enabledOptions.length === 1 && statement.autoPick !== false) {
      // 只剩一个可选项：直接走，不弹菜单（很多视觉小说都这么做）
      const chosen = enabledOptions[0];
      this.lastChoice = { statement, option: statement.options[chosen.index] };
      this.host?.onChoice?.(chosen.text, chosen.index);
      this.applyEffects(statement.options[chosen.index].effects);
      return yield* this.afterChoice(statement.options[chosen.index]);
    }

    const chosen = yield { type: 'choice', prompt: statement.prompt ? this.renderText(statement.prompt) : null, options };
    const option = statement.options[chosen?.index ?? options[0].index];
    if (!option) return undefined;

    this.lastChoice = { statement, option };
    this.host?.onChoice?.(this.renderText(option.text), chosen?.index ?? 0);
    this.applyEffects(option.effects);
    return yield* this.afterChoice(option);
  }

  *afterChoice(option) {
    if (option.goto) {
      if (!this.goTo(option.goto)) return 'stop';
      return 'jumped';
    }
    return undefined;
  }
}
