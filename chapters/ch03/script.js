/**
 * chapters/ch03/script.js —— 第三章 · 文化祭
 *
 * 剧情依据：docs/剧情大纲.md
 * 本章目标：给玩家「要不要说出口」的真正压力
 * 关键产出：flag:said_love（结局 A 的硬条件）
 *
 * ★ choice_confession 是全剧核心分歧点：
 *   说了 → 通往结局 A；没说 → 通往结局 B 或 C（取决于信任与摩擦）。
 */

export default {
  id: 'ch03',
  title: '第三章 · 文化祭',
  subtitle: 'The festival',

  start: 'prep_start',

  vars: {
    /** 展板完成度 */
    boardProgress: 0,
  },

  assets: {
    bg: ['classroom', 'classroom_night', 'festival_night', 'rooftop_night', 'black'],
    sprite: [
      { character: 'miyuki', expr: 'neutral' },
      { character: 'miyuki', expr: 'smile' },
      { character: 'miyuki', expr: 'blush' },
      { character: 'miyuki', expr: 'surprised' },
      { character: 'miyuki', expr: 'away' },
      { character: 'miyuki', expr: 'serious' },
      { character: 'kaede', expr: 'smile' },
      { character: 'kaede', expr: 'neutral' },
      { character: 'kaede', expr: 'serious' },
    ],
    /**
     * 「她趴在课桌上睡着了」用**全屏定格 CG**（event_desk_sleep），不是立绘。
     * 那一幕的构图本来就是全屏的，做成立绘反而不对 ——
     * 而且这一章最需要「停下来看一眼」的就是这一幕。
     */
    cg: ['event_fireworks', 'event_desk_sleep'],
    bgm: [],
    se: [],
  },

  endings: [],

  settings: { cps: 46, autoWait: 1100 },

  blocks: {
    /* ======================= 准备 · 分组 ======================= */
    prep_start: [
      { type: 'bg', bg: 'classroom', transition: 'fade', duration: 800 },
      { type: 'hide', all: true, duration: 300 },
      '文化祭前一周。',
      '班主任在讲台上念分组名单。',
      '念到我的时候，紧接着念了另一个名字。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 500 },
      ['miyuki', '……', 'neutral'],
      '全班的视线在我们两个之间来回扫了两遍。',
      '她没什么反应，只是把课本翻到下一页。',
      { type: 'goto', target: 'kaede_tease' },
    ],

    kaede_tease: [
      { type: 'show', character: 'kaede', expr: 'smile', at: 'right', transition: 'fade', duration: 400 },
      ['kaede', '哟。', 'smile'],
      ['kaede', '一组的。'],
      ['kaede', '你最近笑得很奇怪，你知道吗。'],
      { type: 'goto', target: 'choice_kaede' },
    ],

    choice_kaede: [
      {
        type: 'choice',
        prompt: '枫一脸坏笑。',
        options: [
          {
            text: '「可能吧。」',
            hint: '承认了',
            effects: ['affection += 1', 'flag:admitted_to_kaede'],
            goto: 'admit',
          },
          {
            text: '「你想多了。」',
            effects: ['friction += 1', 'flag:denied_to_kaede'],
            goto: 'deny',
          },
          {
            text: '「你觉得她怎么想？」',
            hint: '把球踢回去',
            effects: ['flag:asked_kaede_advice'],
            goto: 'ask_back',
          },
        ],
      },
    ],

    admit: [
      ['kaede', '……哦。', 'neutral'],
      ['kaede', '你居然承认了。'],
      ['kaede', '那我说句正经的。', 'serious'],
      ['kaede', '那姑娘跟谁都不说话，但上次你值日的时候，她留下来等你扫完地才走的。', 'serious'],
      '「……真的？」',
      ['kaede', '我骗你干嘛。'],
      { type: 'effects', effects: ['trust += 1', 'flag:kaede_told_truth'] },
      { type: 'goto', target: 'board_night' },
    ],

    deny: [
      ['kaede', '行，你想多了。', 'smile'],
      ['kaede', '那我也不说了。'],
      '他转回去了。',
      '——他后来说，那天他本来是想告诉我一件事的。',
      '但我没让他说。',
      { type: 'goto', target: 'board_night' },
    ],

    ask_back: [
      '「你觉得她怎么想？」',
      ['kaede', '……', 'neutral'],
      ['kaede', '你问我？', 'smile'],
      ['kaede', '我连我自己的事都想不明白。'],
      ['kaede', '不过——', 'serious'],
      ['kaede', '你要是真想知道，别问我，去问她。', 'serious'],
      ['kaede', '她那种人，你不问，她一辈子都不会说。'],
      { type: 'effects', effects: ['trust += 1', 'flag:kaede_advice'] },
      { type: 'goto', target: 'board_night' },
    ],

    /* ===================== 夜里 · 做展板 ===================== */
    board_night: [
      { type: 'bg', bg: 'classroom_night', transition: 'fade', duration: 1000 },
      { type: 'hide', all: true, duration: 400 },
      { type: 'wait', duration: 250 },
      '文化祭前三天。晚上八点。',
      '整栋楼只剩我们这一间还开着灯。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 600 },
      '她在剪贴纸。我在写说明文字。',
      '两个小时里我们没说超过十句话，但不觉得尴尬。',
      { type: 'effects', effects: ['boardProgress += 1'] },
      { type: 'goto', target: 'she_sleeps' },
    ],

    she_sleeps: [
      { type: 'wait', duration: 250 },
      '十一点。',
      '我写完最后一行字，抬头。',
      '她趴在桌上睡着了。',
      { type: 'cg', cg: 'event_desk_sleep', transition: 'fade', duration: 1100 },
      { type: 'wait', duration: 450 },
      '手里还捏着半张没剪完的贴纸。',
      '贴纸剪歪了。她连睡着的时候，眉头都是皱着的。',
      { type: 'wait', duration: 300 },
      '窗外的风把窗帘吹起来一点，又落下去。',
      '她动了一下，没醒。',
      { type: 'cg', hide: true, duration: 700 },
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 500 },
      { type: 'goto', target: 'choice_blanket' },
    ],

    choice_blanket: [
      {
        type: 'choice',
        prompt: '她睡着了。你手里有一件外套。',
        options: [
          {
            text: '把外套盖上去，继续做展板',
            hint: '不要叫醒她',
            effects: ['trust += 2', 'affection += 2', 'flag:changed_pace'],
            goto: 'cover_her',
          },
          {
            text: '叫醒她：「回家了。」',
            effects: ['friction += 1'],
            goto: 'wake_her',
          },
          {
            text: '就这样看着她，什么都不做',
            effects: ['affection += 1', 'trust += 1'],
            goto: 'just_watch',
          },
        ],
      },
    ],

    cover_her: [
      '我把外套盖在她肩上。',
      '动作很轻，但她还是动了一下 —— 没有醒。',
      '我回到自己的位置，继续把剩下的说明文字写完。',
      { type: 'wait', duration: 350 },
      '凌晨一点，她醒了。',
      { type: 'show', character: 'miyuki', expr: 'surprised', at: 'center' },
      ['miyuki', '……几点了。', 'surprised'],
      '「一点。」',
      ['miyuki', '你为什么不叫我。'],
      '「你在睡。」',
      { type: 'wait', duration: 300 },
      '她低头看肩上的外套，看了很久。',
      ['miyuki', '……', 'blush'],
      ['miyuki', '你这个人。', 'blush'],
      '她把外套还给我，站起来收拾书包。',
      '走到门口的时候她说：',
      ['miyuki', '展板……你写完了？'],
      '「写完了。」',
      ['miyuki', '嗯。', 'smile'],
      ['miyuki', '那明天见。'],
      { type: 'effects', effects: ['flag:covered_her'] },
      { type: 'goto', target: 'festival_day' },
    ],

    wake_her: [
      '「回家了。」',
      { type: 'show', character: 'miyuki', expr: 'surprised', at: 'center' },
      ['miyuki', '……！', 'surprised'],
      ['miyuki', '我睡了多久。'],
      '「一会儿。」',
      ['miyuki', '……', 'away'],
      '她很快收拾好东西，说了句「明天见」就走了。',
      '走得比平时快。',
      { type: 'goto', target: 'festival_day' },
    ],

    just_watch: [
      '我就那样看着她。',
      '看了大概十分钟。',
      '她没有醒。',
      { type: 'wait', duration: 300 },
      '我起身把窗帘拉上 —— 外面起风了，吹得她头发在动。',
      '然后回到座位，把剩下的字写完。',
      '凌晨一点她醒了，看见我还在，愣了一下。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center' },
      ['miyuki', '……你一直在这？'],
      '「嗯。」',
      ['miyuki', '……', 'neutral'],
      '她没有再说什么，收拾东西走了。',
      '但第二天早上，我的桌上多了一盒牛奶。',
      { type: 'effects', effects: ['flag:silent_vigil'] },
      { type: 'goto', target: 'festival_day' },
    ],

    /* ====================== 文化祭 · 烟花 ====================== */
    festival_day: [
      { type: 'bg', bg: 'festival_night', transition: 'fade', duration: 1200 },
      { type: 'hide', all: true, duration: 400 },
      { type: 'wait', duration: 300 },
      '文化祭最后一天。',
      '灯笼一盏一盏亮起来，人群把走廊堵得走不动。',
      '我们的展板拿了个不大不小的奖。枫在旁边说「都是我的功劳」。',
      { type: 'wait', duration: 250 },
      '烟花是晚上八点。',
      '所有人都在往操场走。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 600 },
      '只有她，站在人群外面。',
      ['miyuki', '……人太多了。', 'away'],
      { type: 'goto', target: 'fireworks' },
    ],

    fireworks: [
      { type: 'cg', cg: 'event_fireworks', transition: 'fade', duration: 1400 },
      { type: 'wait', duration: 450 },
      '第一发烟花炸开的时候，整个操场安静了一秒。',
      '然后是第二发、第三发。',
      { type: 'wait', duration: 350 },
      '光落在她脸上，一闪一闪的。',
      '她一直仰着头，没有看别的地方。',
      ['miyuki', '……我每次转学，都会看一次烟花。'],
      ['miyuki', '因为烟花这个东西，看完就没了。'],
      ['miyuki', '跟人一样。'],
      { type: 'wait', duration: 400 },
      { type: 'cg', hide: true, duration: 800 },
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 700 },
      '她说完这句，转过头看我。',
      '【这是最后的机会。之后无论说什么，都收不回来了。】',
      { type: 'goto', target: 'choice_confession' },
    ],

    /* ★★★ 全剧核心选择 ★★★ */
    choice_confession: [
      {
        type: 'choice',
        prompt: '烟花还在放。她看着你。',
        autoPick: false,
        options: [
          {
            text: '「深雪，我喜欢你。」',
            hint: '说出口就不能收回了',
            style: 'important',
            effects: ['flag:said_love', 'affection += 3'],
            goto: 'confess_love',
          },
          {
            text: '「以后也一起吧。」',
            hint: '真诚，但是留了余地',
            effects: ['affection += 1', 'trust += 1', 'flag:said_together'],
            goto: 'say_together',
          },
          {
            text: '（什么都没说）',
            hint: '她会等你的',
            effects: ['friction += 2', 'flag:said_nothing'],
            goto: 'say_nothing',
          },
        ],
      },
    ],

    confess_love: [
      { type: 'wait', duration: 450 },
      { type: 'show', character: 'miyuki', expr: 'surprised', at: 'center' },
      '烟花炸在头顶上，我听不见自己说话。',
      '但她听见了。',
      ['miyuki', '……', 'surprised'],
      { type: 'wait', duration: 400 },
      '她没有说话。',
      '第四发烟花的光落下来的时候，我看见她的耳朵红了。',
      { type: 'show', character: 'miyuki', expr: 'blush', at: 'center' },
      ['miyuki', '……我知道了。', 'blush'],
      '就这样。',
      '她没有回答，也没有走开。',
      '她只是站在那，跟我一起把那场烟花看完了。',
      { type: 'wait', duration: 350 },
      '——后来我才明白，「我知道了」这四个字的重量。',
      '她不是在敷衍。',
      '她是在说：我听见了，我需要时间。',
      { type: 'goto', target: 'chapter_close' },
    ],

    say_together: [
      { type: 'wait', duration: 400 },
      '「以后也一起吧。」',
      ['miyuki', '……以后？', 'neutral'],
      '「嗯。以后。」',
      { type: 'wait', duration: 350 },
      ['miyuki', '「以后」是多久。', 'neutral'],
      '「不知道。」',
      ['miyuki', '……', 'neutral'],
      ['miyuki', '好吧。', 'smile'],
      '她笑了。但我看得出来，那不是「答应了」的笑。',
      '那是「谢谢你，但我知道以后这种东西靠不住」的笑。',
      { type: 'goto', target: 'chapter_close' },
    ],

    say_nothing: [
      { type: 'wait', duration: 450 },
      '我什么都没说。',
      '烟花放到第七发的时候，她转回去看天了。',
      { type: 'show', character: 'miyuki', expr: 'away', at: 'center' },
      { type: 'wait', duration: 300 },
      '最后一发是最亮的一发。',
      '亮完之后，操场安静下来，人群开始散。',
      ['miyuki', '……走吧。', 'away'],
      '她走在前面，走得比平时慢。',
      '慢到我好几次以为她要停下来。',
      '但她没有。',
      { type: 'effects', effects: ['flag:she_waited'] },
      { type: 'goto', target: 'chapter_close' },
    ],

    /* ========================== 章末 ========================== */
    chapter_close: [
      { type: 'bg', bg: 'rooftop_night', transition: 'fade', duration: 1100 },
      { type: 'hide', all: true, duration: 500 },
      { type: 'wait', duration: 350 },
      '散场以后我一个人上了天台。',
      '城市还亮着，但学校已经黑了。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 900 },
      '身后的门响了一声。',
      '她上来了。',
      ['miyuki', '……你怎么每次都在这。', 'neutral'],
      '「因为上面没有人。」',
      ['miyuki', '……', 'smile'],
      ['miyuki', '那句话是我说的。'],
      '她在围栏边坐下，还是那个位置。',
      { type: 'wait', duration: 400 },
      ['miyuki', '我跟你说件事。', 'neutral'],
      ['miyuki', '我爸昨天接到通知了。'],
      ['miyuki', '可能要调走。'],
      { type: 'wait', duration: 450 },
      '风很大。',
      '她说完这句之后，一直在等我说点什么。',
      '而我在想 —— 我刚才在烟花下面说的那句话，到底算不算数。',
      { type: 'end' },
    ],

    _cheat_sheet: [
      { type: 'bg', bg: 'classroom_night', transition: 'none' },
      { type: 'cg', cg: 'event_desk_sleep' },
      { type: 'wait', duration: 250 },
      { type: 'hide', all: true },
      { type: 'end' },
    ],
  },
};
