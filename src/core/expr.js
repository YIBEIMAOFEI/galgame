/**
 * core/expr.js —— 极小的表达式求值器 + `${}` 模板插值
 *
 * 为什么不用 `new Function`：
 *   1. 服务器上可能有 CSP 策略（'unsafe-eval' 常常被禁），new Function 会直接抛错；
 *   2. 章节脚本是「内容」，将来可能来自别人写的模组，不应该拥有执行任意代码的能力。
 *
 * 支持：数字 / 字符串 / 布尔 / null、标识符、点号与下标取值、
 *       算术 + - * / %、比较 == != < <= > >=、逻辑 ! && ||、括号、一元负号。
 * 变量统一从 scope 取，例如 `affection >= 3 && flags.met_yuki`。
 */

import { clampNumber } from './util.js';
import { StoryVars } from './vars.js';

/* ------------------------------- 词法分析 ------------------------------- */

const PUNCT = [
  '===', // 容错：把 === 当成 ==
  '!==',
  '&&',
  '||',
  '==',
  '!=',
  '<=',
  '>=',
  '(', ')', '.', ',', '[', ']',
  '+', '-', '*', '/', '%', '!', '<', '>',
];

const KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'and', 'or', 'not']);

const isDigit = (ch) => ch >= '0' && ch <= '9';
const isIdentStart = (ch) => /[A-Za-z_$\u4e00-\u9fff]/.test(ch);
const isIdentPart = (ch) => /[A-Za-z0-9_$\u4e00-\u9fff]/.test(ch);
const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

export function tokenize(input) {
  const src = String(input ?? '');
  const tokens = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (isSpace(ch)) {
      i += 1;
      continue;
    }

    // 字符串字面量
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = '';
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < src.length) {
          const next = src[i + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
        } else {
          value += src[i];
          i += 1;
        }
      }
      if (i >= src.length) throw new SyntaxError('字符串缺少收尾引号');
      i += 1;
      tokens.push({ type: 'string', value });
      continue;
    }

    // 数字字面量
    if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1]))) {
      let text = '';
      while (i < src.length && /[0-9._]/.test(src[i])) {
        if (src[i] !== '_') text += src[i];
        i += 1;
      }
      const num = Number(text);
      if (!Number.isFinite(num)) throw new SyntaxError(`非法数字: ${text}`);
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // 标识符 / 关键字
    if (isIdentStart(ch)) {
      let text = '';
      while (i < src.length && isIdentPart(src[i])) {
        text += src[i];
        i += 1;
      }
      tokens.push({
        type: KEYWORDS.has(text) ? 'keyword' : 'ident',
        value: text,
      });
      continue;
    }

    // 多字符运算符优先
    const punct = PUNCT.find((p) => src.startsWith(p, i));
    if (punct) {
      i += punct.length;
      tokens.push({ type: 'punct', value: punct });
      continue;
    }

    throw new SyntaxError(`表达式里出现无法识别的字符: ${ch}`);
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

/* ------------------------------- 语法分析 ------------------------------- */

export function parseExpression(input) {
  const tokens = tokenize(input);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const check = (type, value) => {
    const token = peek();
    return token.type === type && (value === undefined || token.value === value);
  };
  const match = (type, value) => (check(type, value) ? next() : null);
  const expect = (type, value) => {
    const token = match(type, value);
    if (!token) throw new SyntaxError(`表达式语法错误：期望 ${value ?? type}，实际是 ${peek().value || '结尾'}`);
    return token;
  };

  function parseOr() {
    let left = parseAnd();
    while (check('punct', '||') || check('keyword', 'or')) {
      next();
      left = { type: 'logic', op: '||', left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd() {
    let left = parseEquality();
    while (check('punct', '&&') || check('keyword', 'and')) {
      next();
      left = { type: 'logic', op: '&&', left, right: parseEquality() };
    }
    return left;
  }

  function parseEquality() {
    let left = parseComparison();
    for (;;) {
      if (check('punct', '==') || check('punct', '===')) {
        next();
        left = { type: 'binary', op: '==', left, right: parseComparison() };
      } else if (check('punct', '!=') || check('punct', '!==')) {
        next();
        left = { type: 'binary', op: '!=', left, right: parseComparison() };
      } else return left;
    }
  }

  function parseComparison() {
    let left = parseTerm();
    for (;;) {
      if (check('punct', '<')) {
        next();
        left = { type: 'binary', op: '<', left, right: parseTerm() };
      } else if (check('punct', '<=')) {
        next();
        left = { type: 'binary', op: '<=', left, right: parseTerm() };
      } else if (check('punct', '>')) {
        next();
        left = { type: 'binary', op: '>', left, right: parseTerm() };
      } else if (check('punct', '>=')) {
        next();
        left = { type: 'binary', op: '>=', left, right: parseTerm() };
      } else return left;
    }
  }

  function parseTerm() {
    let left = parseFactor();
    for (;;) {
      if (check('punct', '+')) {
        next();
        left = { type: 'binary', op: '+', left, right: parseFactor() };
      } else if (check('punct', '-')) {
        next();
        left = { type: 'binary', op: '-', left, right: parseFactor() };
      } else return left;
    }
  }

  function parseFactor() {
    let left = parseUnary();
    for (;;) {
      if (check('punct', '*')) {
        next();
        left = { type: 'binary', op: '*', left, right: parseUnary() };
      } else if (check('punct', '/')) {
        next();
        left = { type: 'binary', op: '/', left, right: parseUnary() };
      } else if (check('punct', '%')) {
        next();
        left = { type: 'binary', op: '%', left, right: parseUnary() };
      } else return left;
    }
  }

  function parseUnary() {
    if (check('punct', '!') || check('keyword', 'not')) {
      next();
      return { type: 'not', argument: parseUnary() };
    }
    if (check('punct', '-')) {
      next();
      return { type: 'negate', argument: parseUnary() };
    }
    if (check('punct', '+')) {
      next();
      return parseUnary();
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let node = parsePrimary();
    for (;;) {
      if (check('punct', '.')) {
        next();
        const name = next();
        if (name.type !== 'ident' && name.type !== 'keyword') {
          throw new SyntaxError('点号后面必须是属性名');
        }
        node = { type: 'member', object: node, property: { type: 'literal', value: name.value }, computed: false };
      } else if (check('punct', '[')) {
        next();
        const property = parseOr();
        expect('punct', ']');
        node = { type: 'member', object: node, property, computed: true };
      } else return node;
    }
  }

  function parsePrimary() {
    const token = peek();

    if (token.type === 'number' || token.type === 'string') {
      next();
      return { type: 'literal', value: token.value };
    }
    if (token.type === 'keyword') {
      if (token.value === 'true' || token.value === 'false') {
        next();
        return { type: 'literal', value: token.value === 'true' };
      }
      if (token.value === 'null' || token.value === 'undefined') {
        next();
        return { type: 'literal', value: null };
      }
    }
    if (token.type === 'ident') {
      next();
      return { type: 'identifier', name: token.value };
    }
    if (check('punct', '(')) {
      next();
      const inner = parseOr();
      expect('punct', ')');
      return inner;
    }
    throw new SyntaxError(`表达式语法错误：无法解析 ${token.value || '结尾'}`);
  }

  const ast = parseOr();
  if (!check('eof')) throw new SyntaxError(`表达式尾部有多余内容: ${peek().value}`);
  return ast;
}

/* -------------------------------- 求值 --------------------------------- */

const MAX_ARITH = 1e9;

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function looseEquals(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined || b === 0 || b === false;
  if (b === null || b === undefined) return a === 0 || a === false;
  if (typeof a === 'number' || typeof b === 'number') return toNumber(a) === toNumber(b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return toNumber(a) === toNumber(b);
  return String(a) === String(b);
}

function safeDivide(a, b) {
  return b === 0 ? 0 : a / b;
}

function safeModulo(a, b) {
  return b === 0 ? 0 : a % b;
}

/**
 * 在给定作用域中求值。
 * @param {object|string} astOrSource AST 或表达式源码
 * @param {object} scope 变量表（通常是一个 Proxy，读不到的名字返回 0）
 */
export function evaluate(astOrSource, scope = {}) {
  const ast = typeof astOrSource === 'string' ? parseExpression(astOrSource) : astOrSource;

  const walk = (node) => {
    switch (node.type) {
      case 'literal':
        return node.value;
      case 'identifier':
        return scope[node.name];
      case 'member': {
        const object = walk(node.object);
        if (object === null || object === undefined) return undefined;
        const key = node.computed ? walk(node.property) : node.property.value;
        if (key === null || key === undefined) return undefined;
        return object[key];
      }
      case 'not':
        return !truthy(walk(node.argument));
      case 'negate':
        return -toNumber(walk(node.argument));
      case 'logic': {
        const left = walk(node.left);
        if (node.op === '&&') return truthy(left) ? walk(node.right) : left;
        return truthy(left) ? left : walk(node.right);
      }
      case 'binary': {
        const a = walk(node.left);
        const b = walk(node.right);
        switch (node.op) {
          case '+':
            if (typeof a === 'string' || typeof b === 'string') return `${coerceText(a)}${coerceText(b)}`;
            return clampNumber(toNumber(a) + toNumber(b), -MAX_ARITH, MAX_ARITH);
          case '-':
            return clampNumber(toNumber(a) - toNumber(b), -MAX_ARITH, MAX_ARITH);
          case '*':
            return clampNumber(toNumber(a) * toNumber(b), -MAX_ARITH, MAX_ARITH);
          case '/':
            return clampNumber(safeDivide(toNumber(a), toNumber(b)), -MAX_ARITH, MAX_ARITH);
          case '%':
            return clampNumber(safeModulo(toNumber(a), toNumber(b)), -MAX_ARITH, MAX_ARITH);
          case '==':
            return looseEquals(a, b);
          case '!=':
            return !looseEquals(a, b);
          case '<':
            return toNumber(a) < toNumber(b);
          case '<=':
            return toNumber(a) <= toNumber(b);
          case '>':
            return toNumber(a) > toNumber(b);
          case '>=':
            return toNumber(a) >= toNumber(b);
          default:
            return undefined;
        }
      }
      default:
        return undefined;
    }
  };

  return walk(ast);
}

function coerceText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** JS 风格的真值判断 */
export function truthy(value) {
  if (value === null || value === undefined || value === false) return false;
  if (value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** 安全求值：出错时返回 fallback，并把错误交给 onError，绝不炸掉整个流程 */
export function safeEvaluate(source, scope, { fallback = false, onError } = {}) {
  try {
    return evaluate(source, scope);
  } catch (err) {
    onError?.(err, source);
    return fallback;
  }
}

/**
 * 生成一个「变量作用域」Proxy。
 * 读取：真实变量 / 内置量 / 读不到的名字返回 0（而不是 undefined），
 *       这样 `affection >= 3` 在 affection 还没定义时也安全。
 * 写入：直接落到 state，方便章节在条件里做副作用（不推荐但允许）。
 */
export function createScope(vars, extra = {}) {
  const store = vars instanceof StoryVars ? vars.raw : vars;
  const builtins = store?.builtins ?? {};
  const overrides = extra && typeof extra === 'object' ? extra : {};
  const hasOverride = Object.keys(overrides).length > 0;

  return new Proxy(
    {},
    {
      has: () => true,
      get(_, key) {
        if (typeof key === 'symbol') return undefined;
        if (hasOverride && key in overrides) return overrides[key];
        if (key in builtins) return builtins[key];
        const value = store?.[key];
        return value === undefined ? 0 : value;
      },
      set(_, key, value) {
        if (store) store[key] = value;
        return true;
      },
      ownKeys() {
        return [...new Set([...Object.keys(builtins), ...Object.keys(store ?? {})])];
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      },
    },
  );
}

/**
 * `${...}` 模板插值。`$$` 转义成字面 `$`。
 * 例：'好感度：${affection}' / '${playerName}'
 */
export function interpolate(text, scope) {
  const src = String(text ?? '');
  if (!src.includes('$')) return src;

  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch !== '$') {
      out += ch;
      i += 1;
      continue;
    }
    const nextCh = src[i + 1];
    if (nextCh === '$') {
      out += '$';
      i += 2;
      continue;
    }
    if (nextCh !== '{') {
      out += ch;
      i += 1;
      continue;
    }
    // 找到配对的右花括号
    let depth = 0;
    let j = i + 1;
    let closed = false;
    for (; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) {
          closed = true;
          break;
        }
      }
    }
    if (!closed) {
      out += ch;
      i += 1;
      continue;
    }
    const expression = src.slice(i + 2, j);
    const value = safeEvaluate(expression, scope, { fallback: '' });
    out += coerceText(value);
    i = j + 1;
  }
  return out;
}

/** 带 AST 缓存的批量求值器：同一条件反复判断时不必重复 parse */
export function createConditionCache(limit = 512) {
  const cache = new Map();
  return function test(source, scope, onError) {
    let ast = cache.get(source);
    if (!ast) {
      try {
        ast = parseExpression(source);
      } catch (err) {
        onError?.(err, source);
        return false;
      }
      if (cache.size >= limit) cache.clear();
      cache.set(source, ast);
    }
    try {
      return truthy(evaluate(ast, scope));
    } catch (err) {
      onError?.(err, source);
      return false;
    }
  };
}
