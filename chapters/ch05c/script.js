/**
 * chapters/ch05c/script.js —— 结局 C · 分道扬镳
 *
 * 解锁条件：兜底（friction >= 8 或 trust <= 3，其余情况都落这里）
 *
 * ★ 这一章刻意用大量「空白」—— 短句、停顿、没有背景音乐。
 *   因为遗憾的本质不是「坏事发生了」，而是「什么都没有发生」。
 *
 *   最重的一笔在最后：老板说有人来问过那本书，
 *   而主角**没有问那个人长什么样**。
 *   —— 遗憾的本质是你自己放弃了追问。
 */

export default {
  id: 'ch05c',
  title: '第五章 C · 半行值日表',
  subtitle: 'Ending C · Farewell',

  start: 'too_late',

  vars: {},

  assets: {
    bg: ['empty_classroom', 'classroom_blur', 'corridor', 'convenience_store', 'city_street', 'old_bookstore_window', 'black', 'white'],
    sprite: [
      { character: 'miyuki', expr: 'neutral' },
      { character: 'miyuki', expr: 'sad' },
      { character: 'miyuki', expr: 'away' },
      { character: 'miyuki', expr: 'cry' },
      { character: 'kaede', expr: 'neutral' },
    ],
    cg: ['end_farewell'],
    bgm: [],
    se: [],
  },

  endings: [
    {
      id: 'farewell',
      title: 'BAD END · 半行值日表',
      description: '你们都没有做错什么，只是在错的时间用错了方式。黑板上她抄的那一半还在，另一半被擦掉了。',
      cover: 'empty_classroom',
    },
  ],

  settings: { cps: 40, autoWait: 1800 },

  blocks: {
    /* ======================== 太晚了 ======================== */
    too_late: [
      { type: 'bg', bg: 'empty_classroom', transition: 'fade', duration: 1200 },
      { type: 'hide', all: true, duration: 400 },
      { type: 'show', character: 'miyuki', expr: 'sad', at: 'center', transition: 'fade', duration: 800 },
      { type: 'wait', duration: 450 },
      ['miyuki', '……太晚了。', 'sad'],
      { type: 'wait', duration: 450 },
      '「什么太晚了。」',
      { type: 'wait', duration: 450 },
      '她没有回答。',
      { type: 'wait', duration: 450 },
      '窗外有人在操场上跑步。',
      '脚步声一下，一下，一下。',
      { type: 'wait', duration: 450 },
      ['miyuki', '手续办完了。', 'away'],
      ['miyuki', '下周三走。'],
      { type: 'wait', duration: 450 },
      '「……这么快。」',
      ['miyuki', '嗯。', 'away'],
      { type: 'wait', duration: 450 },
      '然后是很长的沉默。',
      '长到我能听见走廊尽头那个坏掉的日光灯在响。',
      { type: 'goto', target: 'she_walks_out' },
    ],

    she_walks_out: [
      { type: 'wait', duration: 450 },
      '她站起来，把书包背上。',
      '动作很慢，像是给我留了足够的时间说点什么。',
      { type: 'wait', duration: 450 },
      '我什么都没说。',
      { type: 'wait', duration: 450 },
      '不是不想说。是不知道从哪一句开始。',
      '——有些话，一旦错过了那个最好的时机，剩下的每一个时机都会变得更难开口。',
      { type: 'wait', duration: 450 },
      '门开了。',
      { type: 'hide', character: 'miyuki', duration: 800 },
      '门关上了。',
      { type: 'wait', duration: 450 },
      '我坐在空教室里，坐到天完全黑。',
      { type: 'goto', target: 'blackboard' },
    ],

    /* ==================== 黑板上那半行字 ==================== */
    blackboard: [
      { type: 'bg', bg: 'empty_classroom', transition: 'none' },
      { type: 'wait', duration: 450 },
      '走的时候我回头看了一眼黑板。',
      '角落上还留着半行值日表。',
      { type: 'wait', duration: 450 },
      '是她抄的那一半。',
      '字很小，很用力，一笔一笔的。',
      { type: 'wait', duration: 450 },
      '另外一半不知道什么时候被擦掉了。',
      '——大概是哪个班的值日生嫌占地方。',
      { type: 'wait', duration: 450 },
      '我拿起板擦，站在那犹豫了很久。',
      '最后我什么都没擦，把板擦放回去了。',
      { type: 'goto', target: 'one_year_later' },
    ],

    /* ===================== 一年后 · 便利店 ===================== */
    one_year_later: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1400 },
      { type: 'wait', duration: 450 },
      '——一年后。',
      { type: 'bg', bg: 'convenience_store', transition: 'fade', duration: 1100 },
      '我在便利店买泡面。',
      '收银台旁边的杂志架上摆着几本打折的书。',
      { type: 'wait', duration: 450 },
      '最上面那本是它。',
      { type: 'wait', duration: 450 },
      '我拿起来翻到最后一页，又翻回第一页。',
      '「第八遍。」我在心里说。',
      { type: 'wait', duration: 450 },
      '她终于背下来了。',
      '只是没有人在旁边听。',
      { type: 'wait', duration: 450 },
      '我把它买了。',
      { type: 'goto', target: 'bookshelf' },
    ],

    bookshelf: [
      { type: 'bg', bg: 'white', transition: 'fade', duration: 1200 },
      { type: 'wait', duration: 450 },
      '那本书在我的书架上放了很久。',
      '一直没翻开。',
      { type: 'wait', duration: 450 },
      '不是不想看。',
      '是每次伸手去拿的时候，都会想起那天下午的黑板。',
      '想起她站在门口，等我说点什么。',
      { type: 'wait', duration: 450 },
      '而我什么都没说。',
      { type: 'goto', target: 'many_years' },
    ],

    /* ================= 很多年后 · 旧书店橱窗 ================= */
    many_years: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1600 },
      { type: 'wait', duration: 450 },
      '——很多年后。',
      { type: 'bg', bg: 'old_bookstore_window', transition: 'fade', duration: 1400 },
      '我路过一家旧书店。',
      '橱窗里摆着一本，封面已经泛黄了。',
      { type: 'wait', duration: 450 },
      '同一本书。',
      { type: 'wait', duration: 450 },
      '我站在橱窗外看了很久，然后推门进去。',
      { type: 'bg', bg: 'old_bookstore_window', transition: 'none' },
      '「老板，这本书……」',
      '「有人来问过吗？」',
      { type: 'wait', duration: 450 },
      '老板从老花镜上面看我一眼。',
      { type: 'wait', duration: 450 },
      '「有啊。」',
      '「前几天有个客人，翻了很久。」',
      '「最后没买。」',
      { type: 'wait', duration: 450 },
      '「……是吗。」',
      { type: 'goto', target: 'the_question' },
    ],

    /* ======================== 最后 ======================== */
    the_question: [
      { type: 'wait', duration: 450 },
      '我在店里站了一会儿。',
      { type: 'wait', duration: 450 },
      '老板在等我问下一句。',
      '——那个人长什么样，多大年纪，是不是一个人来的。',
      { type: 'wait', duration: 450 },
      '我没有问。',
      { type: 'wait', duration: 450 },
      { type: 'goto', target: 'ending' },
    ],

    ending: [
      { type: 'cg', cg: 'end_farewell', transition: 'fade', duration: 2000 },
      { type: 'wait', duration: 450 },
      '我走了。',
      { type: 'wait', duration: 450 },
      '不是因为我不好奇。',
      { type: 'wait', duration: 450 },
      '是因为我怕问了之后，会发现真的是她。',
      '更怕发现不是她。',
      { type: 'wait', duration: 450 },
      '有些事，你不去确认，它就永远还有别的可能。',
      { type: 'wait', duration: 450 },
      '——那天下午的黑板上，',
      '她抄的那一半还在。',
      '另一半，被擦掉了。',
      { type: 'wait', duration: 450 },
      { type: 'end', ending: 'farewell' },
    ],

    _cheat_sheet: [
      { type: 'cg', cg: 'end_farewell', transition: 'none' },
      { type: 'wait', duration: 250 },
      { type: 'cg', hide: true },
      { type: 'end' },
    ],
  },
};
