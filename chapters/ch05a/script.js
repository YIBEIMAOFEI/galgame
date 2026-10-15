/**
 * chapters/ch05a/script.js —— 结局 A · 恋爱到婚姻
 *
 * 解锁条件（在 ch04 里判定）：affection >= 12 且 trust >= 7 且 friction <= 5 且 flag:said_love
 *
 * 这一章要交代的不是「从此幸福」，而是「我们一直在为对方调整节奏」。
 * 用三次时间跳跃 + 一次回收第一章的意象（她抄值日表 / 第八遍背下来）来收尾。
 */

export default {
  id: 'ch05a',
  title: '第五章 A · 并肩的黄昏',
  subtitle: 'Ending A · To marriage',

  start: 'summer',

  vars: {},

  assets: {
    bg: ['empty_classroom', 'apartment', 'wedding_venue', 'city_street', 'black', 'white'],
    sprite: [
      { character: 'miyuki', expr: 'neutral' },
      { character: 'miyuki', expr: 'smile' },
      { character: 'miyuki', expr: 'laugh' },
      { character: 'miyuki', expr: 'blush' },
      { character: 'miyuki', expr: 'cry' },
      { character: 'miyuki', expr: 'wedding' },
      { character: 'kaede', expr: 'smile' },
    ],
    cg: ['end_marriage'],
    bgm: [],
    se: [],
  },

  endings: [
    {
      id: 'marriage',
      title: 'TRUE END · 并肩的黄昏',
      description: '她没有走。她用了一个暑假跟家里吵了二十次，最后留下来了 —— 然后你们一起走完了后面的很多年。',
      cover: 'wedding_venue',
    },
  ],

  settings: { cps: 42, autoWait: 1400 },

  blocks: {
    /* ===================== 那个暑假 ===================== */
    summer: [
      { type: 'bg', bg: 'empty_classroom', transition: 'fade', duration: 1000 },
      { type: 'hide', all: true, duration: 400 },
      { type: 'wait', duration: 350 },
      '那个暑假很长。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 700 },
      '她回家跟她爸谈了第一次，哭了。',
      '第二次，她妈也进来了，谈崩了。',
      '第三次到第十九次，我都不在场。',
      { type: 'wait', duration: 350 },
      '第二十次的时候她给我发了一条消息。',
      '就两个字：「成了。」',
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center' },
      ['miyuki', '我爸说，只到毕业。', 'smile'],
      ['miyuki', '毕业以后还是要走。'],
      '「那就毕业再说。」',
      ['miyuki', '……你怎么老是这句话。', 'smile'],
      '「因为每次都管用。」',
      { type: 'wait', duration: 400 },
      '她没有走。',
      '她留下来读完了高中。',
      { type: 'goto', target: 'three_years' },
    ],

    /* ======================= 三年后 · 大学 ======================= */
    three_years: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1200 },
      { type: 'hide', all: true, duration: 500 },
      { type: 'wait', duration: 400 },
      '——三年后。',
      { type: 'bg', bg: 'city_street', transition: 'fade', duration: 1000 },
      '我们在同一个城市读大学。',
      '不是同一所 —— 她考得比我好。',
      { type: 'wait', duration: 300 },
      { type: 'bg', bg: 'apartment', transition: 'fade', duration: 1000 },
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 600 },
      '大二那年我们合租了一个很小的房子。',
      '厨房只有一平米，灶台边上就是洗衣机。',
      { type: 'wait', duration: 250 },
      '第一次一起做饭，我把锅烧了。',
      { type: 'show', character: 'miyuki', expr: 'laugh', at: 'center' },
      ['miyuki', '……你在干什么。', 'laugh'],
      ['miyuki', '这是炒菜不是纵火。', 'laugh'],
      '「我在按菜谱做。」',
      ['miyuki', '菜谱让你把油烧到冒烟吗。', 'laugh'],
      { type: 'wait', duration: 300 },
      '她笑了很久。',
      '笑到蹲在地上起不来。',
      { type: 'wait', duration: 350 },
      '那天晚上我们吃的是泡面。',
      '她把最后一口汤让给我，说她不喜欢喝汤。',
      '——她其实很喜欢。这件事我第三年才知道。',
      { type: 'goto', target: 'five_years' },
    ],

    /* ======================= 五年后 · 婚礼 ======================= */
    five_years: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1200 },
      { type: 'hide', all: true, duration: 500 },
      { type: 'wait', duration: 400 },
      '——再五年。',
      { type: 'bg', bg: 'city_street', transition: 'fade', duration: 1000 },
      { type: 'show', character: 'kaede', expr: 'smile', at: 'right', transition: 'fade', duration: 600 },
      '同学会。枫还是那副样子，只是胖了一点。',
      ['kaede', '哟。', 'smile'],
      ['kaede', '你们俩居然真的——'],
      '他没说完，自己笑场了。',
      ['kaede', '不是，我是说，我当年就看出来了。', 'smile'],
      '「你当年说的是『我连我自己的事都想不明白』。」',
      ['kaede', '……你记这么清楚干嘛。', 'smile'],
      { type: 'wait', duration: 350 },
      ['kaede', '说真的。', 'smile'],
      ['kaede', '那姑娘当年办转学手续的时候，我去问过她一次。'],
      ['kaede', '我问她为什么突然不办了。'],
      ['kaede', '她说了一句话我一直没懂。'],
      '「什么话？」',
      ['kaede', '她说：「有人记得我抄值日表的样子。」', 'smile'],
      { type: 'wait', duration: 450 },
      '我愣在那。',
      '那句话是我在空教室里说的。',
      '我不知道她记住了，更不知道她拿它去说服了家里。',
      { type: 'hide', character: 'kaede', duration: 500 },
      { type: 'goto', target: 'the_book' },
    ],

    the_book: [
      { type: 'bg', bg: 'city_street', transition: 'fade', duration: 900 },
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center', transition: 'fade', duration: 700 },
      '回家的路上她一直没说话。',
      { type: 'wait', duration: 300 },
      ['miyuki', '你知道吗。'],
      ['miyuki', '我第八遍背下来了。', 'smile'],
      '「哪本？」',
      { type: 'wait', duration: 400 },
      ['miyuki', '不是书。', 'smile'],
      { type: 'wait', duration: 450 },
      '她说完就加快了脚步，走在前面。',
      '耳朵是红的。',
      { type: 'goto', target: 'wedding' },
    ],

    /* ======================== 结局 · 婚礼 ======================== */
    wedding: [
      { type: 'cg', cg: 'end_marriage', transition: 'fade', duration: 1600 },
      { type: 'wait', duration: 450 },
      '婚礼很小。',
      '在一个旧书店改的场地，只请了二十几个人。',
      { type: 'wait', duration: 450 },
      '她穿的白色礼服是租的，手上还抱着那本书。',
      '司仪问她为什么抱着书，她说：「这是聘礼。」',
      { type: 'wait', duration: 450 },
      '全场笑了。只有我知道那不是玩笑。',
      { type: 'wait', duration: 450 },
      '——那本书她后来真的背下来了。',
      '有一天晚上她背给我听，从头到尾，一个字都没错。',
      '背完她说：「你看，这次它不会丢了。」',
      { type: 'wait', duration: 450 },
      '我说：「我也在。」',
      { type: 'wait', duration: 450 },
      '她说：「嗯。你也是我的了。」',
      { type: 'wait', duration: 450 },
      { type: 'end', ending: 'marriage' },
    ],

    _cheat_sheet: [
      { type: 'cg', cg: 'end_marriage', transition: 'none' },
      { type: 'wait', duration: 250 },
      { type: 'cg', hide: true },
      { type: 'end' },
    ],
  },
};
