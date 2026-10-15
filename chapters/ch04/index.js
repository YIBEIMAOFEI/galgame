import script from './script.js';

const chapter = {
  ...script,
  id: 'ch04',
  title: '第四章 · 摩擦',
  summary: '迟到四十分钟、两个星期的躲闪、空教室里的那句「我下个月要转学」。三件小事，没有一件是大事。',
  author: '示例作者',
  /** 本章有内部分流，走完之后由 route_split 决定去哪一章 */
  next: null,
  unlockAfter: 'ch03',
};

export default chapter;
