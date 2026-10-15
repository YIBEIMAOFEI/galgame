/**
 * chapters/ch02/index.js —— 第二章入口
 *
 * 复制这个文件夹开新章时要改三处：
 *   1. 本文件的 id / title / next
 *   2. script.js 里的 id（必须一致，校验器会检查）
 *   3. chapters/index.js 里加一条目录
 */

import script from './script.js';

const chapter = {
  ...script,
  id: 'ch02',
  title: '第二章 · 一起走过的路',
  summary: '一把伞、一家旧书店、一条河堤。你开始分不清这份舒服到底是什么。',
  author: '示例作者',
  next: 'ch03',
  unlockAfter: 'ch01',
};

export default chapter;
