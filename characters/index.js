/**
 * characters/index.js —— 角色表（角色的「数据」，不是「代码」）
 *
 * 这里只声明「这个角色是谁、立绘放哪、名字什么颜色」。
 * 立绘文件按约定放在 assets/characters/<角色id>/<表情>.png，
 * 所以你加表情只要丢一个同名的 png 进去 + 在 expressions 里报个到。
 *
 * ⚠️ 一个真踩过的坑：**不要**在块注释里写「星号 + 斜杠」的组合
 *    （比如写通配路径），那会提前闭合注释，整个模块直接语法错误、游戏起不来。
 *    本项目为此栽过一次，排查了很久。
 */

import kaede from './kaede.js';

/** @typedef {{name:string, color?:string, scale?:number, expressions?:Record<string,string>, bio?:string}} Character */

/** @type {Record<string, Character>} */
const characters = {
  /**
   * 女主角。全剧唯一的恋爱对象。
   * 表情清单和 docs/剧情大纲.md 里的立绘需求表一一对应。
   */
  miyuki: {
    name: '深雪',
    color: '#bcd0f0',
    /** 立绘整体缩放。觉得人太大/太小就调这个，别去改 CSS */
    scale: 1.0,
    defaultSlot: 'center',
    /** 找不到表情时回退到哪张 */
    fallbackExpr: 'neutral',

    expressions: {
      neutral: '',      // 平静（默认）
      smile: '',        // 微笑（很淡的那种）
      laugh: '',        // 真的笑出来（结局用）
      sad: '',          // 低落（第四章）
      surprised: '',    // 微讶（第一章相遇）
      blush: '',        // 脸红（第三章烟花）
      cry: '',          // 含泪（第四章 / 结局 C）
      serious: '',      // 认真、倔（第四章争论）
      away: '',         // 侧头、别开视线（第四章回避）
      wedding: '',      // 白色礼服版（结局 A）
      // 注意：「她趴在课桌上睡着」那一幕用的是**全屏定格 CG**
      //（assets/cg/event_desk_sleep.jpg），不是立绘 ——
      // 因为那一幕的构图是全屏画面，做成立绘反而不对。
    },

    bio: '转学生。话很少，但记得住别人随口说过的小事。因为总是转学，所以从不交朋友 —— 反正都会散的。',
  },

  /**
   * 男配角。男主的损友，全剧唯一「讲人话」的第三者视角。
   * 单独一个文件，演示「一个角色一个文件」的写法。
   */
  kaede: kaede,
};

export default characters;

/** 导出成命名导出，方便章节里 import { characters } 做类型提示 */
export { characters };
