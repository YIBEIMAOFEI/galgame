/**
 * core/validate.js —— 内容校验器（内核层，可与浏览器共用）
 *
 * 为什么要有它：
 *   模块化最怕的不是「加载失败」，而是「加载成功了，但第 37 句对白引用的
 *   yuki/smirk.png 根本不存在」——玩家玩到那里才看到一张空白立绘。
 *   所以每个章节在「进入时」接受一次快速校验，构建期再跑一次全量校验
 *   （tools/validate.mjs），把人眼看不出来的死链、死跳转、打错的 flag 全挖出来。
 *
 * 校验分三档：
 *   error   —— 必然出问题（跳转目标不存在、角色未定义、结局 id 没声明…）
 *   warning —— 大概率是笔误（变量没在 vars 里声明过、资源缺失、孤立块）
 *   info    —— 统计信息（字数、语句数、分支数）
 */

import { isPlainObject } from './util.js';
import { createConditionCache, parseExpression } from './expr.js';
import { AssetLoader } from './loader.js';

export const SEVERITY = { ERROR: 'error', WARNING: 'warning', INFO: 'info' };

export function createReport() {
  const issues = [];
  return {
    issues,
    error(message, where, hint) {
      issues.push({ severity: SEVERITY.ERROR, message, where, hint });
    },
    warn(message, where, hint) {
      issues.push({ severity: SEVERITY.WARNING, message, where, hint });
    },
    info(message, where) {
      issues.push({ severity: SEVERITY.INFO, message, where });
    },
    get errors() {
      return issues.filter((issue) => issue.severity === SEVERITY.ERROR);
    },
    get warnings() {
      return issues.filter((issue) => issue.severity === SEVERITY.WARNING);
    },
    get ok() {
      return this.errors.length === 0;
    },
  };
}

/** 哪些 effect 声明改了哪个变量（用于「未声明变量」检查） */
function extractWrittenVars(effects, out = new Set()) {
  const list = Array.isArray(effects) ? effects : effects ? [effects] : [];
  for (const effect of list) {
    if (typeof effect === 'string') {
      const match = effect.match(/^([A-Za-z_$\u4e00-\u9fff][\w$\u4e00-\u9fff.]*)\s*(?:\+=|-=|\*=|\/=|=)/);
      if (match) out.add(match[1].replace(/^flags\./, 'flag:'));
      const flagMatch = effect.match(/^(?:un)?flag:([\w$\u4e00-\u9fff]+)/);
      if (flagMatch) out.add(`flag:${flagMatch[1]}`);
      continue;
    }
    if (isPlainObject(effect)) {
      for (const key of Object.keys(effect.set ?? {})) out.add(key);
      for (const key of Object.keys(effect.change ?? {})) out.add(key);
      for (const key of [].concat(effect.flag ?? [], effect.unflag ?? [])) out.add(`flag:${key}`);
      for (const key of Object.keys(effect.flags ?? {})) out.add(`flag:${key}`);
    }
  }
  return out;
}

/** 提取一段文本里用到的变量名 */
function extractReadVars(text, out = new Set()) {
  const src = String(text ?? '');
  const re = /\$\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(src))) {
    const identifiers = match[1].match(/[A-Za-z_$\u4e00-\u9fff][\w$\u4e00-\u9fff]*/g) ?? [];
    for (const identifier of identifiers) {
      if (['true', 'false', 'null', 'undefined', 'and', 'or', 'not'].includes(identifier)) continue;
      out.add(identifier.startsWith('flags') ? identifier : identifier);
    }
  }
  return out;
}

/**
 * 校验一个已归一化的章节。
 *
 * @param {object} chapter normalizeChapter() 的结果
 * @param {object} [options]
 * @param {Record<string, any>} [options.characters] 角色表
 * @param {Record<string, object>} [options.chapterIndex] 章节索引（用于跨章跳转检查）
 * @param {Set<string>} [options.knownVars] 全局已声明的变量（引擎变量 + 各章 vars）
 * @param {boolean} [options.checkAssets] 是否检查资源是否存在
 * @param {import('./loader.js').AssetLoader} [options.loader] 有 loader 时会做真实探测
 * @param {Set<string>} [options.availableAssets] 直接给出「存在的资源」集合（"bg:classroom" 形式）
 * @returns {ReturnType<typeof createReport> & {stats: object}}
 */
export async function validateChapter(chapter, options = {}) {
  const {
    characters = {},
    chapterIndex = {},
    knownVars = new Set(),
    checkAssets = false,
    loader = null,
    availableAssets = null,
    onProgress,
  } = options;

  const report = createReport();
  const blocks = chapter.script.blocks;
  const blockIds = Object.keys(blocks);
  const where = (blockId, index) => `${chapter.id}#${blockId}[${index}]`;

  const declaredVars = new Set([
    'playerName',
    'affection',
    'trust',
    'route',
    'chapter',
    'chapterTitle',
    ...knownVars,
    ...Object.keys(isPlainObject(chapter.definition?.vars) ? chapter.definition.vars : {}),
  ]);

  const writtenVars = new Set();
  const gotoCount = { value: 0, labels: 0, crossChapter: 0, choices: 0, endings: new Set(), textChars: 0, statements: 0 };
  const jumpTargets = [];
  const referencedAssets = [];
  const assetSeen = new Set();
  const characterUsage = new Map();

  const checkCondition = createConditionCache();

  /**
   * 单条 wait 的上限。
   * 超过这个值就提醒：玩家虽然可以点击跳过（引擎支持），
   * 但连续的长停顿叠加起来会让人觉得"游戏卡住了" ——
   * 这是实打实收到过的反馈（第五章一章累积了约 40 秒强制等待）。
   */
  const MAX_SINGLE_WAIT = 2200;
  /** 一章累计的强制等待上限 */
  const MAX_TOTAL_WAIT = 25000;
  let totalWaitMs = 0;
  let waitCount = 0;

  for (const blockId of blockIds) {
    const statements = blocks[blockId];
    let reachableGuaranteed = false;

    for (const [index, statement] of statements.entries()) {
      gotoCount.statements += 1;
      const position = where(blockId, index);

      // 1) 条件表达式语法
      for (const conditionKey of ['condition', 'showIf']) {
        const condition = statement[conditionKey];
        if (typeof condition === 'string') {
          try {
            parseExpression(condition);
          } catch (err) {
            report.error(`条件语法错误 (${conditionKey}): ${err.message}`, position, condition);
          }
          extractReadVars(condition.replace(/([A-Za-z_$\u4e00-\u9fff][\w$\u4e00-\u9fff]*)/g, '${$1}')).forEach((name) => {
            if (!declaredVars.has(name) && !name.startsWith('flag') && !writtenVars.has(name)) {
              report.warn(`条件里用到的变量 "${name}" 没有在任何 vars 里声明（默认当 0/false 处理）`, position);
            }
          });
        }
      }

      // 2) 文本插值里的变量
      if (typeof statement.text === 'string') {
        extractReadVars(statement.text).forEach((name) => {
          if (!declaredVars.has(name) && !writtenVars.has(name)) {
            report.warn(`文本里引用了未声明的变量 "${name}"`, position);
          }
        });
        gotoCount.textChars += [...statement.text].length;
      }

      // 3) 跳转目标
      if (statement.type === 'goto') {
        gotoCount.value += 1;
        jumpTargets.push({ target: statement.target, position });
      }

      if (statement.type === 'choice') {
        gotoCount.choices += 1;
        if (!statement.options.some((option) => option.enabled !== false)) {
          report.warn('choice 的所有选项都带 condition，可能一条都选不了', position);
        }
        for (const option of statement.options) {
          if (option.goto) {
            gotoCount.value += 1;
            jumpTargets.push({ target: option.goto, position: `${position} 选项「${option.text}」` });
          }
          if (option.effects) extractWrittenVars(option.effects, writtenVars);
          if (typeof option.condition === 'string') {
            try {
              parseExpression(option.condition);
            } catch (err) {
              report.error(`选项条件语法错误: ${err.message}`, position, option.condition);
            }
          }
        }
      }

      // 4) 角色存在性 + 表情使用
      if (statement.type === 'show') {
        const known = characters[statement.character];
        const usage = characterUsage.get(statement.character) ?? new Set();
        usage.add(statement.expr);
        characterUsage.set(statement.character, usage);
        if (!known) {
          report.error(`show 引用了未定义的角色 "${statement.character}"`, position);
        } else if (
          isPlainObject(known.expressions) &&
          !Object.prototype.hasOwnProperty.call(known.expressions, statement.expr) &&
          !statement.expr.includes('$')
        ) {
          // ★ 必须用「键是否存在」判断，不能写真值判断：
          //   表情说明允许是空字符串（intake 工具自动登记时就写 ''），
          //   而 '' 是 falsy —— 用真值判断会把已声明的表情误报成没声明。
          report.warn(
            `角色 "${statement.character}" 没有声明表情 "${statement.expr}"（约定路径为 characters/${statement.character}/${statement.expr}.png，文件在就行）`,
            position,
          );
        }
      }

      if (statement.type === 'text' && !characters[statement.who] && !statement.displayName) {
        report.warn(`说话人 "${statement.who}" 不在角色表里，将直接显示 id`, position);
      }

      // 5) 效果写入的变量
      if (statement.type === 'effects') extractWrittenVars(statement.effects, writtenVars);

      // 5.5) 强制等待时长
      //   引擎支持「点击跳过等待」，但连续的长停顿叠加起来依然会让人觉得卡住了。
      //   这条检查来自真实反馈：某章累积了约 40 秒强制等待，玩家以为游戏死了。
      if (statement.type === 'wait') {
        const duration = Number(statement.duration ?? 500) || 0;
        totalWaitMs += duration;
        waitCount += 1;
        if (duration > MAX_SINGLE_WAIT) {
          report.warn(
            `单条 wait ${duration}ms 偏长（建议 ≤ ${MAX_SINGLE_WAIT}ms）。` +
              `虽然玩家能点击跳过，但长停顿连着出现会被当成"卡死"`,
            position,
          );
        }
      }

      // 6) 结局 id
      if (statement.type === 'end' && statement.ending) {
        gotoCount.endings.add(statement.ending);
        if (chapter.hasEndings && !chapter.endings[statement.ending]) {
          report.error(`结局 "${statement.ending}" 没有在 endings 里声明`, position);
        }
      }

      // 7) 可达性：无条件 goto/end 之后的语句永远执行不到
      //    （带 condition 的 goto 不算 —— 它不满足时会继续往下走，这是常见的写法）
      if (!reachableGuaranteed && statement.type === 'end') {
        reachableGuaranteed = true;
        if (index < statements.length - 1 && statements[index + 1].type !== 'label') {
          report.warn(`第 ${index + 2} 句开始永远不会执行（前面已经 end）`, position);
        }
      } else if (!reachableGuaranteed && statement.type === 'goto' && statement.condition === undefined) {
        reachableGuaranteed = true;
        if (index < statements.length - 1 && statements[index + 1].type !== 'label') {
          report.warn(`第 ${index + 2} 句开始永远不会执行（前面已经无条件 goto）`, position);
        }
      }

      if (statement.type === 'label') gotoCount.labels += 1;
    }
  }

  // 跳转目标解析
  for (const { target, position } of jumpTargets) {
    if (blocks[target]) continue;
    if (chapter.script.labels[target]) continue;
    if (chapter.endings[target]) {
      report.warn(`跳转目标 "${target}" 是结局 id，不是块名；如果本意是结束，请用 {type:'end', ending:'${target}'}`, position);
      continue;
    }
    if (chapterIndex[target]) {
      gotoCount.crossChapter += 1;
      continue;
    }
    report.error(`跳转目标 "${target}" 不存在（既不是本块名/标签，也不是已注册章节）`, position);
  }

  // 孤立块：没有任何人跳过来、也不是起始块
  // 以 _ 开头（或 debug_ / cheat_ 开头）的块视为「开发用块」，不报孤立警告。
  const isDevBlock = (blockId) => /^_|^(debug|cheat|test)_/.test(blockId);
  const referenced = new Set(jumpTargets.map((item) => item.target));
  for (const blockId of blockIds) {
    if (blockId === chapter.script.start || blockId === 'end') continue;
    if (referenced.has(blockId) || isDevBlock(blockId)) continue;
    report.warn(`块 "${blockId}" 没有任何入口（不是起始块，也没有 goto 指向它）`, `${chapter.id}#${blockId}`);
  }

  // 结局声明与达成
  for (const endingId of Object.keys(chapter.endings)) {
    if (!gotoCount.endings.has(endingId)) {
      report.warn(`结局 "${endingId}" 声明了但剧本里没有任何 {type:'end', ending:'${endingId}'} 到达它`, chapter.id);
    }
    const ending = chapter.endings[endingId];
    for (const blockId of Object.values(ending.blocks ?? {})) {
      if (blockId && !blocks[blockId]) {
        report.error(`结局 "${endingId}" 引用了不存在的块 "${blockId}"`, chapter.id);
      }
    }
  }

  // 变量使用统计
  for (const name of writtenVars) {
    if (name.startsWith('flag:')) continue;
    if (!declaredVars.has(name)) {
      report.warn(`写入了未声明的变量 "${name}"（存档能存下，但拼错时不会有提示）`, chapter.id);
    }
  }

  // 整章累计等待时长
  if (totalWaitMs > MAX_TOTAL_WAIT) {
    report.warn(
      `本章累计强制等待 ${(totalWaitMs / 1000).toFixed(1)} 秒（${waitCount} 条 wait，建议 ≤ ${MAX_TOTAL_WAIT / 1000} 秒）。` +
        `玩家可以点击跳过，但节奏会显得拖沓 —— 考虑合并或删掉一些停顿`,
      chapter.id,
    );
  }

  // 资源检查
  if (checkAssets) {
    // scoped:true —— 校验器按「章节自带美术」的布局去算相对路径（display 用），
    // 真正的存在性判断统一走 requirementIdentity，与布局无关。
    const requirements = AssetLoader.buildRequirements(chapter, { scoped: true });
    for (const requirement of requirements) {
      const identity = requirementIdentity(requirement);
      if (assetSeen.has(identity)) continue;
      assetSeen.add(identity);
      referencedAssets.push(requirement);
    }

    // 兜底：声明了 assets 却一条都没解析出来 —— 几乎总是「章节入口忘了把 assets 透传下去」。
    // 这个错误以前是静默的（章节能进，只是立绘/背景不预载），所以值得单独报出来。
    const declared = chapter.assets ?? {};
    const declaredCount = ['bg', 'cg', 'sprite', 'ui', 'bgm', 'se'].reduce(
      (sum, key) => sum + (Array.isArray(declared[key]) ? declared[key].length : 0),
      0,
    );
    if (declaredCount > 0 && requirements.length === 0) {
      report.error(
        `声明了 ${declaredCount} 条资源，但一条都没解析出来 —— 检查章节入口是否把 assets 漏在了外面`,
        chapter.id,
      );
    } else if (requirements.length === 0) {
      report.warn('这一章没有任何资源引用（纯文字章节可以忽略）', chapter.id);
    }

    if (availableAssets) {
      for (const requirement of referencedAssets) {
        if (!availableAssets.has(requirementIdentity(requirement))) {
          report.warn(`资源缺失: ${describeAsset(requirement)}`, chapter.id, '补一张同名文件，或改用已有资源');
        }
      }
    } else if (loader) {
      const report2 = await loader.preload(referencedAssets, { onProgress });
      for (const missing of report2.missing) {
        report.warn(`资源缺失: ${missing}`, chapter.id);
      }
    }
  }

  report.stats = {
    blocks: blockIds.length,
    statements: gotoCount.statements,
    choices: gotoCount.choices,
    jumps: gotoCount.value,
    labels: gotoCount.labels,
    crossChapterJumps: gotoCount.crossChapter,
    endings: [...gotoCount.endings],
    declaredEndings: Object.keys(chapter.endings),
    textChars: gotoCount.textChars,
    characters: [...characterUsage.keys()],
    assets: referencedAssets.length,
    words: gotoCount.textChars,
  };

  return report;
}

export function requirementIdentity(requirement) {
  switch (requirement.kind) {
    case 'sprite':
      return `sprite:${requirement.character}/${requirement.expr}`;
    case 'icon':
      return `icon:${requirement.character}/${requirement.expr}`;
    default:
      return `${requirement.kind}:${requirement.id}`;
  }
}

export function describeAsset(requirement) {
  switch (requirement.kind) {
    case 'sprite':
      return `立绘 characters/${requirement.character}/${requirement.expr}.*`;
    case 'icon':
      return `头像 characters/${requirement.character}/icon_${requirement.expr}.*`;
    case 'cg':
      return `定格 CG cg/${requirement.id}.*`;
    case 'bgm':
      return `BGM audio/bgm/${requirement.id}.*`;
    case 'se':
      return `音效 audio/se/${requirement.id}.*`;
    case 'ui':
      return `界面图 ui/${requirement.id}.*`;
    case 'bg':
      return `背景 bg/${requirement.id}.*`;
    default:
      return `${requirement.kind} ${requirement.id}.*`;
  }
}

/** 校验角色表本身 */
export function validateCharacters(characters, { chapterAssets = new Set() } = {}) {
  const report = createReport();
  if (!isPlainObject(characters)) {
    report.error('角色表不是对象', 'characters/index.json');
    return report;
  }
  for (const [id, character] of Object.entries(characters)) {
    if (!isPlainObject(character)) {
      report.error(`角色 "${id}" 不是对象`, 'characters/index.json');
      continue;
    }
    if (!character.name) report.warn(`角色 "${id}" 缺少 name，界面会显示 id`, 'characters/index.json');
    if (character.expressions !== undefined && !isPlainObject(character.expressions)) {
      report.error(`角色 "${id}" 的 expressions 必须是对象`, 'characters/index.json');
    }
    for (const [expr, spec] of Object.entries(character.expressions ?? {})) {
      if (spec !== null && !isPlainObject(spec) && typeof spec !== 'string') {
        report.warn(`角色 "${id}" 的表情 "${expr}" 描述格式不规范`, 'characters/index.json');
      }
    }
    if (character.color !== undefined && !/^#[0-9a-f]{3,8}$/i.test(String(character.color))) {
      report.warn(`角色 "${id}" 的 color 不是合法色值: ${character.color}`, 'characters/index.json');
    }
  }
  return report;
}
