/**
 * chapters/ch01/index.js —— 章节入口（**唯一会被动态 import 的文件**）
 *
 * 引擎只认这个文件名。它要做两件事：
 *   1. 把本章正文（script.js）展开进来
 *   2. 叠上「只有入口层才知道」的信息：解锁条件、下一章、本章设置
 *
 * ⚠️ 写法上刻意用 `...script` 展开而不是逐字段手写：
 *    早先的版本是 `vars: script.vars, assets: script.assets, ...`，
 *    结果漏了 assets —— 表现为「章节能进，但立绘和背景不预载」，而且不报任何错。
 *    展开之后，「忘记透传」这个错误类别在结构上就不存在了。
 *    顺序很重要：先铺 script，再写章节级字段覆盖它。
 */

import script from './script.js';
import chapterConfig from './config.js';

/** @type {import('../../src/core/story.js').ChapterDefinition} */
const chapter = {
  /** ① 正文与它自带的元数据（vars / assets / endings / blocks …） */
  ...script,

  /** ② 章节级信息 */
  id: 'ch01',
  title: '第一章 · 转学生',
  summary: '开学第二周，一个只说了两句话的转学生坐到了你旁边。放学后，你在天台又遇见了她。',
  author: '示例作者',

  /** 下一章 */
  next: 'ch02',

  /** 本章专用设置（合并 script 里的，config.js 优先） */
  settings: { ...script.settings, ...chapterConfig.settings },
};

export default chapter;
