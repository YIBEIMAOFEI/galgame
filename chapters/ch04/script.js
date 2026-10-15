/**
 * chapters/ch04/script.js —— 第四章 · 摩擦
 *
 * 剧情依据：docs/剧情大纲.md
 * 本章目标：让「不合适」这件事变得具体、可信，而不是突然翻脸
 *
 * ★ 本章核心设计：摩擦由**三件小事**累积，没有一件是"大吵"。
 *   迟到四十分钟、她开始躲你、她终于说出口 —— 全是节奏问题，谁都没错。
 *
 * ★ 章末分流：用 choice 的条件选项分流到第五章 A/B/C。
 *   玩家不会看到"三个结局任选"，只会看到自己挣来的那一个（其余是灰的）。
 *   这是刻意的 —— 结局不是选出来的，是一路走出来的。
 */

export default {
  id: 'ch04',
  title: '第四章 · 摩擦',
  subtitle: 'Friction',

  start: 'waiting',

  vars: {},

  assets: {
    bg: ['classroom', 'corridor_rain', 'library', 'empty_classroom', 'classroom_blur', 'black'],
    sprite: [
      { character: 'miyuki', expr: 'neutral' },
      { character: 'miyuki', expr: 'sad' },
      { character: 'miyuki', expr: 'serious' },
      { character: 'miyuki', expr: 'away' },
      { character: 'miyuki', expr: 'cry' },
      { character: 'miyuki', expr: 'surprised' },
      { character: 'kaede', expr: 'neutral' },
      { character: 'kaede', expr: 'serious' },
    ],
    cg: ['event_empty_classroom'],
    bgm: [],
    se: [],
  },

  endings: [],

  settings: { cps: 44, autoWait: 1300 },

  blocks: {
    /* ===================== 小事① 迟到四十分钟 ===================== */
    waiting: [
      { type: 'bg', bg: 'school_gate', transition: 'fade', duration: 900 },
      { type: 'hide', all: true, duration: 300 },
      '约的是三点。',
      '三点四十的时候，她还没来。',
      { type: 'wait', duration: 300 },
      '我站在校门口，把手机看了十七次。',
      '第十七次的时候，她跑过来了。',
      { type: 'show', character: 'miyuki', expr: 'surprised', at: 'center', transition: 'fade', duration: 500 },
      ['miyuki', '……对不起。', 'surprised'],
      ['miyuki', '我记错时间了。'],
      '她喘得很厉害，头发被风吹得乱七八糟。',
      '——她确实记错了。她记错东西这件事，我早就知道。',
      { type: 'goto', target: 'choice_late' },
    ],

    choice_late: [
      {
        type: 'choice',
        prompt: '她站在你面前，还在喘。',
        options: [
          {
            text: '「没事，我也刚到。」',
            hint: '善意的谎',
            effects: ['trust += 1', 'flag:white_lie'],
            goto: 'kind_lie',
          },
          {
            text: '「你下次能不能准时。」',
            hint: '你等得确实很难受',
            effects: ['friction += 2'],
            goto: 'blame',
          },
          {
            text: '（什么都不说，转身就走）',
            effects: ['friction += 3', 'flag:avoided'],
            goto: 'walk_away',
          },
        ],
      },
    ],

    kind_lie: [
      '「没事，我也刚到。」',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center' },
      ['miyuki', '……骗人。', 'neutral'],
      ['miyuki', '你的鞋都湿了。'],
      '「……下雨了嘛。」',
      ['miyuki', '今天没下雨。'],
      '她看着我，看了很久。',
      ['miyuki', '你为什么要这样说。', 'sad'],
      '「因为你在跑。」',
      { type: 'wait', duration: 350 },
      '她低下头，说了一句很轻的话。',
      ['miyuki', '……你这个人真的很奇怪。', 'neutral'],
      '但那天她走在我旁边，走得比平时近。',
      { type: 'goto', target: 'avoidance' },
    ],

    blame: [
      '「你下次能不能准时。」',
      { type: 'show', character: 'miyuki', expr: 'sad', at: 'center' },
      ['miyuki', '……嗯。', 'sad'],
      ['miyuki', '对不起。'],
      '她道歉了。',
      '但那天下午她几乎没有主动说过话。',
      '——我说得没错。她确实应该准时，或者至少提前说一声。',
      '我只是没意识到，「说得没错」和「说得是时候」是两件事。',
      { type: 'goto', target: 'avoidance' },
    ],

    walk_away: [
      '我转身就走。',
      ['miyuki', '……喂。', 'surprised'],
      '她在后面叫了我一声。',
      '我没有回头。',
      { type: 'wait', duration: 400 },
      '走到第二个路口的时候，我停下来回头看。',
      '她还站在校门口。',
      '站在那，没有走。',
      '——很久以后我才明白，那天她本来是要告诉我一件事的。',
      '因为我没有回头，所以那件事又多压了两个星期。',
      { type: 'goto', target: 'avoidance' },
    ],

    /* ===================== 小事② 她开始躲你 ===================== */
    avoidance: [
      { type: 'bg', bg: 'classroom', transition: 'fade', duration: 900 },
      { type: 'hide', all: true, duration: 400 },
      '接下来的两个星期，她开始躲我。',
      '不是那种明显的躲 —— 她还是会说「早」，还是会一起做值日。',
      '只是每次快说到什么的时候，她就换话题。',
      { type: 'wait', duration: 250 },
      { type: 'show', character: 'kaede', expr: 'serious', at: 'right', transition: 'fade', duration: 500 },
      ['kaede', '……我跟你说个事。', 'serious'],
      ['kaede', '你别问我怎么知道的。'],
      ['kaede', '她又在办转学手续了。'],
      { type: 'wait', duration: 450 },
      '「什么时候的事。」',
      ['kaede', '两个星期前。', 'serious'],
      '两个星期前。',
      '正好是她迟到的那天。',
      { type: 'goto', target: 'choice_ask' },
    ],

    choice_ask: [
      {
        type: 'choice',
        prompt: '枫看着你，等你说话。',
        options: [
          {
            text: '直接去问她：「你要走？」',
            hint: '不留退路',
            effects: ['friction += 1', 'trust += 2', 'flag:confronted'],
            goto: 'confront',
          },
          {
            text: '装作不知道，等她开口',
            effects: ['friction += 2', 'flag:avoided', 'flag:pretended'],
            goto: 'pretend',
          },
          {
            text: '让枫再多打听一点',
            effects: ['friction += 1', 'trust -= 1', 'flag:asked_around'],
            goto: 'gossip',
          },
        ],
      },
    ],

    confront: [
      { type: 'bg', bg: 'corridor_rain', transition: 'fade', duration: 900 },
      { type: 'hide', all: true, duration: 400 },
      '我在走廊上拦住了她。',
      { type: 'show', character: 'miyuki', expr: 'surprised', at: 'center', transition: 'fade', duration: 500 },
      '「你要走？」',
      { type: 'wait', duration: 400 },
      ['miyuki', '……谁告诉你的。', 'surprised'],
      '「是不是真的。」',
      ['miyuki', '……', 'away'],
      '她没有回答。',
      '她只是看着窗外 —— 外面在下雨。',
      { type: 'goto', target: 'confession_scene' },
    ],

    pretend: [
      { type: 'bg', bg: 'classroom_blur', transition: 'fade', duration: 1000 },
      { type: 'hide', all: true, duration: 400 },
      '我装作不知道。',
      { type: 'wait', duration: 350 },
      '接下来的每一天都很难熬。',
      '我看着她收拾书包，看着她把课本一本本装进去，',
      '看着她好几次张开嘴又闭上。',
      '而我每次都在心里说：你要说啊。',
      { type: 'wait', duration: 400 },
      '她一直没说。',
      '我也一直没有问。',
      '——我们两个人，用了整整两个星期，比赛谁先撑不住。',
      '结果谁都没赢。',
      { type: 'goto', target: 'confession_scene' },
    ],

    gossip: [
      { type: 'bg', bg: 'classroom_blur', transition: 'fade', duration: 1000 },
      { type: 'hide', all: true, duration: 400 },
      '「你帮我再问问。」',
      ['kaede', '……', 'serious'],
      ['kaede', '行。', 'serious'],
      ['kaede', '但我说句难听的。', 'serious'],
      ['kaede', '这种事你让我去问，她知道了会怎么想。'],
      '我没接话。',
      { type: 'wait', duration: 400 },
      '三天后枫给了我答案：手续办了一半，家里在等房子。',
      '我拿到了我想要的信息。',
      '但我没拿到她的信任。',
      '——她后来知道我去打听了。她什么都没说，只是从那天起，',
      '她再也没在我面前提过家里的事。',
      { type: 'goto', target: 'confession_scene' },
    ],

    /* =================== 小事③ 她终于开口 =================== */
    confession_scene: [
      { type: 'bg', bg: 'empty_classroom', transition: 'fade', duration: 1200 },
      { type: 'hide', all: true, duration: 500 },
      { type: 'wait', duration: 350 },
      '星期五放学。',
      '她把我叫到了空教室。',
      { type: 'show', character: 'miyuki', expr: 'serious', at: 'center', transition: 'fade', duration: 800 },
      '夕阳从窗户斜进来，把桌子照成一条一条的。',
      { type: 'wait', duration: 400 },
      ['miyuki', '我下个月要转学。', 'serious'],
      ['miyuki', '我已经跟老师说好了。'],
      { type: 'wait', duration: 450 },
      '她说这句话的时候，一直在看地板。',
      { type: 'goto', target: 'choice_response' },
    ],

    choice_response: [
      {
        type: 'choice',
        prompt: '她终于说出来了。',
        options: [
          {
            text: '「那你为什么现在才说。」',
            effects: ['friction += 2'],
            goto: 'why_now',
          },
          {
            text: '「……你早就决定了吧。」',
            effects: ['friction += 1', 'trust -= 1'],
            goto: 'already_decided',
          },
          {
            text: '「你想去哪。我听着。」',
            hint: '唯一不加摩擦的选项',
            effects: ['trust += 3', 'flag:listened'],
            goto: 'i_am_listening',
          },
        ],
      },
    ],

    why_now: [
      '「那你为什么现在才说。」',
      ['miyuki', '……', 'sad'],
      ['miyuki', '因为我不知道怎么说。', 'sad'],
      '「两个星期前就办好了，你用了两个星期想怎么说？」',
      ['miyuki', '……嗯。'],
      ['miyuki', '对不起。'],
      '她说了对不起。',
      '这两个字她今天说了第三次了。',
      { type: 'goto', target: 'final_words' },
    ],

    already_decided: [
      '「……你早就决定了吧。」',
      ['miyuki', '……是。', 'away'],
      '「那你叫我来干什么。」',
      { type: 'wait', duration: 400 },
      ['miyuki', '……', 'sad'],
      ['miyuki', '我不知道。'],
      ['miyuki', '我只是觉得应该跟你说一声。'],
      '「说一声。」',
      '「你已经决定了，然后你通知我一声。」',
      { type: 'wait', duration: 350 },
      '她没有反驳。',
      '因为我说的是事实。',
      '但事实这个东西，有时候说出来只是为了让对方更难受。',
      { type: 'goto', target: 'final_words' },
    ],

    i_am_listening: [
      { type: 'cg', cg: 'event_empty_classroom', transition: 'fade', duration: 1200 },
      { type: 'wait', duration: 400 },
      '「你想去哪。我听着。」',
      { type: 'wait', duration: 450 },
      '她抬起头。',
      '眼睛红了，但没有掉下来。',
      ['miyuki', '……你怎么不生气。', 'cry'],
      '「生气有用吗。」',
      ['miyuki', '别人都会生气的。'],
      '「我不是别人。」',
      { type: 'wait', duration: 450 },
      '她坐下来，坐在课桌上，抱着膝盖。',
      '然后她开始说 —— 说了很久。',
      '说她爸的工作，说她妈的态度，说她已经转过的六所学校，',
      '说她每一次都在心里给自己定一个规矩：不要记住任何人。',
      { type: 'wait', duration: 400 },
      ['miyuki', '但是我这次没做到。', 'cry'],
      { type: 'cg', hide: true, duration: 900 },
      { type: 'show', character: 'miyuki', expr: 'cry', at: 'center', transition: 'fade', duration: 700 },
      { type: 'goto', target: 'final_words' },
    ],

    /* ==================== 章末 · 结局分流 ==================== */
    final_words: [
      { type: 'bg', bg: 'empty_classroom', transition: 'none' },
      { type: 'wait', duration: 400 },
      '教室安静了下来。',
      '窗外有人在操场上跑步，脚步声一下一下的。',
      { type: 'wait', duration: 300 },
      ['miyuki', '你知道吗。'],
      ['miyuki', '我最怕的不是转学。', 'sad'],
      { type: 'wait', duration: 400 },
      ['miyuki', '我最怕的是 ——'],
      ['miyuki', '有一天我走了，你会觉得「也没什么」。'],
      { type: 'wait', duration: 450 },
      '【这是最后一段路了。接下来会发生什么，取决于你们一路是怎么走过来的。】',
      { type: 'goto', target: 'route_split' },
    ],

    /**
     * ★ 分流点。
     *
     * 三个选项对应三个结局，用 condition 控制哪个可点。
     * 玩家**看不到**"任选一个结局"，只会看到自己挣来的那个是可点的，
     * 其余两个是灰的 —— 这是刻意的设计：结局不是选出来的，是走出来的。
     *
     * 判定条件（与 docs/剧情大纲.md 一致，先命中先算）：
     *   A 恋爱→婚姻   affection >= 12 且 trust >= 7 且 friction <= 5 且 flag:said_love
     *   B 永恒的朋友   affection >= 6  且 trust >= 5  且 not flag:said_love
     *   C 分道扬镳    兜底（其余情况）
     */
    route_split: [
      {
        type: 'choice',
        prompt: '你要怎么回答她？',
        autoPick: false,
        options: [
          {
            text: '「不会的。因为我记得你。」',
            hint: '你们之间已经足够近了',
            style: 'important',
            condition: 'affection >= 12 && trust >= 7 && friction <= 5 && flags.said_love',
            goto: 'route_a',
          },
          {
            text: '「朋友也会记得。」',
            hint: '有些关系不需要那个名字',
            style: 'important',
            condition: 'affection >= 6 && trust >= 5 && !flags.said_love',
            goto: 'route_b',
          },
          {
            text: '「……我不知道该说什么。」',
            style: 'important',
            condition: 'true',
            goto: 'route_c',
          },
        ],
      },
    ],

    route_a: [
      '「不会的。」',
      '「因为我记得你抄值日表的样子。」',
      { type: 'wait', duration: 450 },
      ['miyuki', '……', 'surprised'],
      ['miyuki', '你连那个都记得。', 'cry'],
      '「我记得。所以不会也没什么。」',
      { type: 'wait', duration: 450 },
      '她终于哭了。',
      '不是那种掉眼泪的哭，是那种肩膀一直在抖、但是没有声音的哭。',
      '我走过去，站在她旁边。',
      '没有抱她，也没有说什么。',
      '就是站着。',
      { type: 'wait', duration: 450 },
      '天完全黑下来的时候，她说了一句话。',
      ['miyuki', '我去跟我爸说。', 'cry'],
      '「说什么？」',
      ['miyuki', '说我不走。', 'cry'],
      { type: 'wait', duration: 400 },
      '——她后来真的说了。',
      '用了一个暑假的时间，跟她家里吵了大概二十次。',
      { type: 'wait', duration: 400 },
      // ★ 跳到结局章节。结局自成一章，这样每个结局可以有自己的 CG、音乐和节奏，
      //   也让「章节目录」直接就是「结局目录」。
      { type: 'goto', target: 'ch05a' },
    ],

    route_b: [
      '「朋友也会记得。」',
      { type: 'wait', duration: 450 },
      ['miyuki', '……', 'surprised'],
      ['miyuki', '你说什么。', 'surprised'],
      '「我说，朋友也会记得。」',
      '「你不用为了不忘记我而留下来。」',
      '「你走，我记得你。就这么简单。」',
      { type: 'wait', duration: 450 },
      '她看着我，很久很久。',
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center' },
      '然后她笑了。',
      '是那种终于放下什么的、很轻的笑。',
      ['miyuki', '……你这个人。', 'smile'],
      ['miyuki', '真的很奇怪。', 'smile'],
      ['miyuki', '但是谢谢你。', 'smile'],
      { type: 'wait', duration: 450 },
      '「谢什么。」',
      ['miyuki', '谢谢你没有说喜欢我。', 'smile'],
      ['miyuki', '因为那样的话，我就必须拒绝了。', 'smile'],
      { type: 'wait', duration: 450 },
      '——她说得对。',
      '有些关系，一旦被命名，就会变形。',
      '而有些关系，保持没有名字，反而能一直活下去。',
      { type: 'goto', target: 'ch05b' },
    ],

    route_c: [
      '「……我不知道该说什么。」',
      { type: 'wait', duration: 450 },
      '这是实话。',
      '但实话在这个场合，听起来像放弃。',
      ['miyuki', '……嗯。', 'sad'],
      ['miyuki', '我知道。'],
      { type: 'wait', duration: 450 },
      '她站起来，把书包背上。',
      '走到门口的时候停了一下。',
      ['miyuki', '……太晚了。', 'sad'],
      { type: 'wait', duration: 400 },
      '「什么太晚了？」',
      '她没有回答。',
      '门在她身后关上，声音很轻。',
      { type: 'wait', duration: 450 },
      '我坐在空教室里，坐到天完全黑。',
      '黑板上还留着半行值日表 —— 是她抄的那一半。',
      '另一半，不知道什么时候被擦掉了。',
      { type: 'goto', target: 'ch05c' },
    ],

    _cheat_sheet: [
      { type: 'bg', bg: 'empty_classroom', transition: 'none' },
      { type: 'show', character: 'miyuki', expr: 'cry', at: 'center' },
      { type: 'wait', duration: 200 },
      { type: 'hide', all: true },
      { type: 'end' },
    ],
  },
};
