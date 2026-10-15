/**
 * chapters/ch05b/script.js —— 结局 B · 永恒的朋友
 *
 * 解锁条件：affection >= 6 且 trust >= 5 且 not flag:said_love
 *
 * ★ 这是三个结局里最难写的，也是最有分量的一个。
 *   它不是「遗憾」，而是「另一种完整」—— 两个人没有在一起，但不是因为失败。
 *
 *   写作要点：
 *   - 全程不能有一句「要是当初……」的悔意。主角是清醒地选择了不命名这段关系。
 *   - 结尾那句「……那挺好的」必须留白，不能解释。解释了就变成遗憾了。
 */

export default {
  id: 'ch05b',
  title: '第五章 B · 十九遍',
  subtitle: 'Ending B · Eternal friends',

  start: 'not_named',

  vars: {},

  assets: {
    bg: ['empty_classroom', 'bookstore', 'city_street', 'apartment', 'black'],
    sprite: [
      { character: 'miyuki', expr: 'neutral' },
      { character: 'miyuki', expr: 'smile' },
      { character: 'miyuki', expr: 'laugh' },
      { character: 'miyuki', expr: 'sad' },
      { character: 'miyuki', expr: 'cry' },
      { character: 'miyuki', expr: 'away' },
      { character: 'kaede', expr: 'neutral' },
    ],
    cg: ['end_friendship'],
    bgm: [],
    se: [],
  },

  endings: [
    {
      id: 'friendship',
      title: 'GRAND END · 十九遍',
      description: '她走了。但这次她给了你地址，而且真的写信 —— 十九遍，她终于不用再背了，因为有人会替她记得。',
      cover: 'bookstore',
    },
  ],

  settings: { cps: 42, autoWait: 1500 },

  blocks: {
    /* ====================== 空教室 · 不命名 ====================== */
    not_named: [
      { type: 'bg', bg: 'empty_classroom', transition: 'fade', duration: 1000 },
      { type: 'hide', all: true, duration: 400 },
      { type: 'show', character: 'miyuki', expr: 'sad', at: 'center', transition: 'fade', duration: 700 },
      { type: 'wait', duration: 400 },
      ['miyuki', '……朋友？', 'sad'],
      ['miyuki', '就这样？'],
      '「就这样。」',
      { type: 'wait', duration: 450 },
      ['miyuki', '你不觉得可惜吗。', 'sad'],
      '「可惜什么？」',
      ['miyuki', '……我不知道。'],
      ['miyuki', '我以为你会说点别的。', 'away'],
      { type: 'wait', duration: 450 },
      '我想了很久要怎么回答她。',
      '最后我说了一句实话。',
      { type: 'wait', duration: 350 },
      '「我怕我说了别的，我们就连朋友都做不成了。」',
      { type: 'wait', duration: 450 },
      { type: 'show', character: 'miyuki', expr: 'cry', at: 'center' },
      '她哭了。',
      '但她一边哭一边笑了。',
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center' },
      ['miyuki', '……你这个人。', 'smile'],
      ['miyuki', '真的很讨厌。', 'smile'],
      { type: 'goto', target: 'she_leaves' },
    ],

    /* ======================== 她走了 ======================== */
    she_leaves: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1200 },
      { type: 'hide', all: true, duration: 500 },
      { type: 'wait', duration: 450 },
      '她还是走了。',
      '九月一号，她转去了另一个城市。',
      { type: 'wait', duration: 350 },
      '但这次不一样。',
      { type: 'bg', bg: 'city_street', transition: 'fade', duration: 1000 },
      '她给了我地址。',
      '而且她真的写信。',
      { type: 'wait', duration: 300 },
      '第一封信写了三页，讲她新学校的食堂很难吃。',
      '第二封信写了一页，讲她同桌很吵。',
      '第三封信只有一行：「这里的书店没有那本书。」',
      { type: 'wait', duration: 400 },
      '从第四封开始，她每封信的末尾都会写一句：',
      '「你还记得吧？」',
      { type: 'wait', duration: 350 },
      '我每次都回：「记得。」',
      { type: 'goto', target: 'two_years_visit' },
    ],

    /* ===================== 两年后 · 去看她 ===================== */
    two_years_visit: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1200 },
      { type: 'wait', duration: 400 },
      '——两年后。',
      { type: 'bg', bg: 'apartment', transition: 'fade', duration: 1100 },
      '我坐了一夜的火车去看她。',
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center', transition: 'fade', duration: 800 },
      '她住的房间很小，书堆到天花板。',
      '床是靠墙的，因为剩下的地方全被书占了。',
      { type: 'wait', duration: 300 },
      ['miyuki', '你看。', 'smile'],
      '她从书堆最上面抽出一本，举给我看。',
      '是那本。',
      { type: 'wait', duration: 400 },
      '「你还带着它？」',
      ['miyuki', '当然。', 'smile'],
      ['miyuki', '而且我背下来了。'],
      '「第几遍？」',
      { type: 'wait', duration: 350 },
      ['miyuki', '第十九遍。', 'smile'],
      { type: 'wait', duration: 450 },
      ['miyuki', '但是这次不用背了。', 'smile'],
      '「为什么？」',
      { type: 'wait', duration: 450 },
      ['miyuki', '因为有人会替我记得。', 'smile'],
      { type: 'wait', duration: 450 },
      '她把书放回去，去厨房烧水。',
      '我坐在她那一堆书中间，忽然觉得这个房间比任何地方都像家。',
      { type: 'goto', target: 'five_years_wedding' },
    ],

    /* ================== 五年后 · 你来结婚 ================== */
    five_years_wedding: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1200 },
      { type: 'hide', all: true, duration: 500 },
      { type: 'wait', duration: 400 },
      '——又过了三年。',
      '我结婚那天，她来了。',
      { type: 'bg', bg: 'bookstore', transition: 'fade', duration: 1200 },
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center', transition: 'fade', duration: 800 },
      '她抱着一整套书的初版。',
      '用纸包着，包得很仔细。',
      { type: 'wait', duration: 350 },
      ['miyuki', '礼物。', 'smile'],
      ['miyuki', '初版。我找了四年。'],
      '「……四年？」',
      ['miyuki', '嗯。', 'smile'],
      ['miyuki', '因为你说过你会记得。'],
      ['miyuki', '所以我想给你一个值得记的东西。', 'smile'],
      { type: 'wait', duration: 450 },
      '我说不出话。',
      { type: 'wait', duration: 400 },
      ['miyuki', '我一直想问你一件事。', 'neutral'],
      '「什么？」',
      { type: 'wait', duration: 450 },
      ['miyuki', '你当初……', 'neutral'],
      { type: 'wait', duration: 450 },
      '她没有说完。',
      { type: 'wait', duration: 450 },
      '「嗯。」',
      { type: 'wait', duration: 450 },
      ['miyuki', '……那挺好的。', 'smile'],
      { type: 'wait', duration: 450 },
      '然后我们就都没有再说话了。',
      { type: 'goto', target: 'ending' },
    ],

    /* ========================= 结局 ========================= */
    ending: [
      { type: 'cg', cg: 'end_friendship', transition: 'fade', duration: 1800 },
      { type: 'wait', duration: 450 },
      '后来我们还是每年见一次。',
      '有时候在她那个城市，有时候在我这里。',
      '见面就是逛书店，然后吃一顿很随便的饭。',
      { type: 'wait', duration: 450 },
      '她一直没结婚。',
      '别人问起，她就说：「我有很多书。」',
      { type: 'wait', duration: 450 },
      '有一次我们坐在书店里，中间隔着一排书架。',
      '阳光从窗户进来，落在她手上。',
      '她在翻一本新的书，翻到某一页就停下来，抬头看我一眼。',
      { type: 'wait', duration: 450 },
      '我说：「怎么了。」',
      { type: 'wait', duration: 450 },
      ['miyuki', '没什么。', 'smile'],
      ['miyuki', '就是在想 —— 幸好你当初说的是「朋友」。', 'smile'],
      { type: 'wait', duration: 450 },
      '「为什么？」',
      { type: 'wait', duration: 450 },
      ['miyuki', '因为如果是别的，我就要失去你了。', 'smile'],
      { type: 'wait', duration: 450 },
      '我们都没有再说话。',
      '但我们都在笑。',
      { type: 'wait', duration: 450 },
      { type: 'end', ending: 'friendship' },
    ],

    _cheat_sheet: [
      { type: 'cg', cg: 'end_friendship', transition: 'none' },
      { type: 'wait', duration: 250 },
      { type: 'cg', hide: true },
      { type: 'end' },
    ],
  },
};
