import script from './script.js';

const chapter = {
  ...script,
  id: 'ch05a',
  title: '第五章 A · 并肩的黄昏',
  summary: '她没有走。你们一起走完了后面的很多年。',
  author: '示例作者',
  next: null,
  /** 解锁条件：通关第四章（具体走哪条线由 ch04 内部的条件选项决定） */
  unlockAfter: 'ch04',
};

export default chapter;
