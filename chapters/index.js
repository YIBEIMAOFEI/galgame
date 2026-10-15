/**
 * chapters/index.js —— 章节清单（**必须保持极轻量**）
 *
 * 这个文件是「目录」而不是「内容」：整站启动时只加载它（几百字节），
 * 真正的章节代码和美术要等玩家点进去才下载。
 *
 * 所以规矩是：
 *   ✔ 只写 id / 标题 / 顺序 / 解锁条件 / 一句话简介
 *   ✘ 不要 import 任何章节的剧本、图片、音频
 *   ✘ 不要在这里写任何逻辑
 *
 * 加一章：复制一个文件夹 → 改 id/title → 回这里加一条 → node tools/validate.mjs
 * 删一章：删文件夹 + 删这里的一行。别的章节一行代码都不用改。
 *
 * ⚠️ status:'hidden' 的章节不会出现在章节选择界面里 ——
 *    三个结局章节用这个标记：它们不是「玩的」，是 ch04 分流过去的。
 */

/** @typedef {{id:string, order:number, title:string, summary?:string, status?:'released'|'planned'|'hidden', unlockAfter?:string|string[], next?:string, endings?:number}} ChapterEntry */

/** @type {ChapterEntry[]} */
export const chapters = [
  {
    id: 'ch01',
    order: 1,
    title: '第一章 · 转学生',
    summary: '开学第二周，一个只说了两句话的转学生坐到了你旁边。放学后，你在天台又遇见了她。',
    status: 'released',
  },
  {
    id: 'ch02',
    order: 2,
    title: '第二章 · 一起走过的路',
    summary: '一把伞、一家旧书店、一条河堤。你开始分不清这份舒服到底是什么。',
    status: 'released',
    unlockAfter: 'ch01',
  },
  {
    id: 'ch03',
    order: 3,
    title: '第三章 · 文化祭',
    summary: '展板做到凌晨、烟花下的那句话、以及她最后说出的那个消息。',
    status: 'released',
    unlockAfter: 'ch02',
  },
  {
    id: 'ch04',
    order: 4,
    title: '第四章 · 摩擦',
    summary: '迟到四十分钟、两个星期的躲闪、空教室里的那句「我下个月要转学」。',
    status: 'released',
    unlockAfter: 'ch03',
  },

  /* ------------------------------------------------------------------ */
  /*  以下三章是结局分支。status:'hidden' → 不出现在章节选择界面里，      */
  /*  玩家只能从第四章的结尾分流进入。这样「结局不是选出来的」才有说服力。 */
  /* ------------------------------------------------------------------ */
  {
    id: 'ch05a',
    order: 5,
    title: '结局 A · 并肩的黄昏',
    summary: '她没有走。你们一起走完了后面的很多年。',
    status: 'hidden',
    unlockAfter: 'ch04',
    endings: 1,
  },
  {
    id: 'ch05b',
    order: 6,
    title: '结局 B · 十九遍',
    summary: '她走了，但这次给了你地址。',
    status: 'hidden',
    unlockAfter: 'ch04',
    endings: 1,
  },
  {
    id: 'ch05c',
    order: 7,
    title: '结局 C · 半行值日表',
    summary: '你们都没有做错什么，只是在错的时间用错了方式。',
    status: 'hidden',
    unlockAfter: 'ch04',
    endings: 1,
  },
];

export default chapters;
