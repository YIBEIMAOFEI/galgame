/**
 * chapters/ch02/script.js —— 第二章 · 一起走过的路
 *
 * 剧情依据：docs/剧情大纲.md
 * 本章目标：把「舒服」这件事铺实，让玩家开始分不清这是友情还是别的
 * 产出变量：affection、trust、friction、flag:listened、flag:changed_pace
 *
 * 本章四次选择，其中「雨中伞」和「河堤」是两个关键分歧点。
 */

export default {
  id: 'ch02',
  title: '第二章 · 一起走过的路',
  subtitle: 'The road we walked',

  start: 'morning',

  vars: {
    /** 本章局部变量 */
    sawHerBook: 0,
  },

  assets: {
    bg: ['classroom', 'school_gate', 'bookstore', 'riverbank_dusk', 'black'],
    sprite: [
      { character: 'miyuki', expr: 'neutral' },
      { character: 'miyuki', expr: 'smile' },
      { character: 'miyuki', expr: 'sad' },
      { character: 'miyuki', expr: 'surprised' },
      { character: 'miyuki', expr: 'away' },
      { character: 'kaede', expr: 'neutral' },
      { character: 'kaede', expr: 'smile' },
    ],
    cg: ['event_rain'],
    bgm: [],
    se: [],
  },

  endings: [],

  settings: { cps: 46, autoWait: 1100 },

  blocks: {
    /* ========================== 枫登场 ========================== */
    morning: [
      { type: 'bg', bg: 'classroom', transition: 'fade', duration: 800 },
      { type: 'hide', all: true, duration: 300 },
      '第二天早上。',
      '我刚把书包放下，后排就伸过来一颗脑袋。',
      { type: 'show', character: 'kaede', expr: 'smile', at: 'right', transition: 'fade', duration: 500 },
      ['kaede', '哟。', 'smile'],
      ['kaede', '你跟那个转学生，什么情况？'],
      '枫。全班最不需要睡觉的人。',
      { type: 'goto', target: 'choice_kaede' },
    ],

    choice_kaede: [
      {
        type: 'choice',
        prompt: '枫一脸等着听故事的表情。',
        options: [
          {
            text: '「就是同学。」',
            hint: '最省事的回答',
            effects: ['flag:told_kaede_nothing'],
            goto: 'just_classmates',
          },
          {
            text: '「她挺有意思的。」',
            effects: ['affection += 1', 'flag:told_kaede_interesting'],
            goto: 'interesting',
          },
          {
            text: '（不接话，继续收拾书包）',
            effects: ['friction += 1', 'flag:avoided'],
            goto: 'ignore_kaede',
          },
        ],
      },
    ],

    just_classmates: [
      ['kaede', '同学。', 'smile'],
      ['kaede', '行吧，同学。'],
      ['kaede', '那你昨天放学跟她一起走的那段路，也是同学之间的路？'],
      '「你怎么知道。」',
      ['kaede', '我住校门口啊大哥。', 'smile'],
      { type: 'effects', effects: ['flag:kaede_knows'] },
      { type: 'goto', target: 'after_school' },
    ],

    interesting: [
      ['kaede', '「她挺有意思的。」'],
      ['kaede', '哦——', 'smile'],
      ['kaede', '「有意思」。'],
      ['kaede', '你知道你刚才那个表情吧？'],
      '「什么表情。」',
      ['kaede', '没什么。当我没说。', 'smile'],
      '他笑着转回去了。',
      { type: 'effects', effects: ['flag:kaede_knows'] },
      { type: 'goto', target: 'after_school' },
    ],

    ignore_kaede: [
      '我没接话。',
      ['kaede', '……', 'neutral'],
      ['kaede', '行。'],
      '他转回去了。',
      '一整天他都没再跟我说话 —— 他不是生气，他是真的不知道该说什么。',
      { type: 'effects', effects: ['flag:kaede_awkward'] },
      { type: 'goto', target: 'after_school' },
    ],

    /* ======================== 雨中 · 校门 ======================== */
    after_school: [
      { type: 'bg', bg: 'classroom', transition: 'fade', duration: 600 },
      { type: 'hide', all: true, duration: 400 },
      '放学的时候下雨了。',
      '那种不大不小、但是一定会把人淋透的雨。',
      { type: 'bg', bg: 'school_gate', transition: 'fade', duration: 900 },
      '我撑着伞走到校门口，看见一个站在那里不动的人。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 500 },
      '她没带伞。',
      '她也没有躲雨。就那么站着，看着雨。',
      { type: 'goto', target: 'choice_umbrella' },
    ],

    choice_umbrella: [
      {
        type: 'choice',
        prompt: '她站在雨里，一动不动。',
        options: [
          {
            text: '把伞塞给她，自己冲进雨里',
            hint: '你会湿透',
            effects: ['affection += 2', 'trust += 1', 'flag:gave_umbrella'],
            goto: 'give_umbrella',
          },
          {
            text: '走过去，把伞举到两个人中间',
            effects: ['affection += 1', 'trust += 2', 'flag:listened'],
            goto: 'share_umbrella',
          },
          {
            text: '「我先走了。」',
            effects: ['affection -= 1', 'friction += 1', 'flag:avoided'],
            goto: 'leave_her',
          },
        ],
      },
    ],

    give_umbrella: [
      '我把伞塞进她手里，转身就跑。',
      ['miyuki', '……喂！', 'surprised'],
      '雨很大。跑到拐角的时候我回头看了一眼。',
      '她还站在原地，举着伞，看着我跑掉的方向。',
      '她没有追上来。但她也没有走。',
      '——我后来才知道，她在那站了半个小时。',
      { type: 'hide', character: 'miyuki', duration: 500 },
      { type: 'goto', target: 'bookstore_intro' },
    ],

    share_umbrella: [
      '我走过去，把伞举到两个人中间。',
      '伞不大。要遮住两个人，我们得靠得很近。',
      ['miyuki', '……', 'surprised'],
      ['miyuki', '你自己会淋到的。', 'neutral'],
      '「那就一起淋。」',
      { type: 'cg', cg: 'event_rain', transition: 'fade', duration: 1200 },
      { type: 'wait', duration: 400 },
      '她沉默了大概一分钟。',
      '然后她说：',
      ['miyuki', '我从小到大，没有跟别人一起撑过伞。'],
      '「为什么？」',
      ['miyuki', '因为伞会歪。'],
      ['miyuki', '两个人一起撑，总有一个人要淋到。所以我一般不带伞。'],
      '「那今天呢？」',
      ['miyuki', '……今天是你举的。', 'smile'],
      { type: 'cg', hide: true, duration: 700 },
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center', transition: 'fade', duration: 600 },
      '雨停的时候，我的右肩是湿的。她左边一点都没湿。',
      { type: 'goto', target: 'bookstore_intro' },
    ],

    leave_her: [
      '「我先走了。」',
      '她没回头，也没说话。',
      '走到拐角的时候我停了一下 —— 只要转身，只要说一句「要不要一起」，',
      '这件事就是另一个形状。',
      '但我没有。',
      { type: 'hide', character: 'miyuki', duration: 500 },
      { type: 'goto', target: 'bookstore_intro' },
    ],

    /* ======================== 旧书店 ======================== */
    bookstore_intro: [
      { type: 'bg', bg: 'bookstore', transition: 'fade', duration: 900 },
      { type: 'wait', duration: 200 },
      '星期三。',
      '我路过学校后面那条街的时候，从旧书店的窗户里看见了她。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 500 },
      '她站在最里面那排书架前，手里拿着一本书。',
      '翻了很久。然后合上，放回去。',
      '然后从第一页重新翻开。',
      { type: 'effects', effects: ['sawHerBook = 1'] },
      { type: 'goto', target: 'bookstore_talk' },
    ],

    bookstore_talk: [
      '我推门进去。铃响了一声。',
      ['miyuki', '……你怎么在这。', 'surprised'],
      '「路过。」',
      ['miyuki', '哦。', 'neutral'],
      '她把书合上，但没有放回去。',
      '「你在看什么？」',
      ['miyuki', '这本我看了七遍了。'],
      '「七遍？」',
      ['miyuki', '嗯。'],
      ['miyuki', '因为第八遍我就会背下来了。'],
      ['miyuki', '背下来之后，它就不会丢了。', 'neutral'],
      '她说这话的时候没有看我，看着书。',
      { type: 'goto', target: 'choice_book' },
    ],

    choice_book: [
      {
        type: 'choice',
        prompt: '她把书抱在怀里，像抱着什么很轻又很重的东西。',
        options: [
          {
            text: '「那我陪你看到第八遍。」',
            hint: '这句话你要负责',
            effects: ['trust += 2', 'affection += 1', 'flag:changed_pace'],
            goto: 'read_together',
          },
          {
            text: '「买一本不就得了。」',
            hint: '你说得没错',
            effects: ['trust -= 1', 'friction += 1'],
            goto: 'just_buy_it',
          },
          {
            text: '什么都不说，从旁边抽一本坐下',
            effects: ['trust += 1', 'affection += 1', 'flag:listened'],
            goto: 'sit_quietly',
          },
        ],
      },
    ],

    read_together: [
      ['miyuki', '……', 'surprised'],
      ['miyuki', '你知道那要多久吗。'],
      '「不知道。」',
      ['miyuki', '可能很久。'],
      '「那就很久。」',
      { type: 'wait', duration: 350 },
      '她低头看着书，很久没有出声。',
      '然后她翻到第一页，把书往我这边推了一点。',
      ['miyuki', '那你从这页开始。', 'smile'],
      '那天我们在那家书店待到关门。',
      '店长来赶人的时候，她说了句「明天还来」。',
      { type: 'effects', effects: ['flag:knows_notebook', 'flag:bookstore_regular'] },
      { type: 'goto', target: 'riverbank_intro' },
    ],

    just_buy_it: [
      '「买一本不就得了。」',
      ['miyuki', '……', 'sad'],
      ['miyuki', '嗯。你说得对。'],
      '她把书放回架子上，很轻地放回去。',
      '然后她说她还有事，先走了。',
      '我在书店门口站了一会儿。',
      '那本书还在架子上，第八遍还差一遍。',
      { type: 'effects', effects: ['flag:book_left_behind'] },
      { type: 'goto', target: 'riverbank_intro' },
    ],

    sit_quietly: [
      '我什么都没说，从旁边抽了一本，在她对面坐下。',
      '她看了我一眼，没说话。',
      '我们就这样看了大概一个小时。',
      '中间她起身去倒了杯水，回来的时候多倒了一杯，放在我手边。',
      '没有说「给你」，也没有说「谢谢」。',
      '就是放在那里。',
      { type: 'effects', effects: ['flag:knows_notebook', 'flag:quiet_company'] },
      { type: 'goto', target: 'riverbank_intro' },
    ],

    /* ======================== 河堤 · 黄昏 ======================== */
    riverbank_intro: [
      { type: 'bg', bg: 'riverbank_dusk', transition: 'fade', duration: 1100 },
      { type: 'hide', all: true, duration: 400 },
      { type: 'wait', duration: 250 },
      '回家的路上我们走了河堤。',
      '那天的云烧得很红。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 600 },
      '走着走着她忽然说：',
      ['miyuki', '我转过六次学。'],
      ['miyuki', '小学三次，初中两次，高中一次。'],
      '「……为什么？」',
      ['miyuki', '我爸工作调来调去。'],
      ['miyuki', '一开始我还会哭。后来就不哭了。'],
      ['miyuki', '因为我发现，只要不交朋友，走的时候就不会难过。', 'neutral'],
      '她说这话的语气很平，像在说明天的天气。',
      ['miyuki', '所以你看，我从来不主动跟人说话。'],
      ['miyuki', '反正都会散的。'],
      { type: 'goto', target: 'choice_riverbank' },
    ],

    choice_riverbank: [
      {
        type: 'choice',
        prompt: '夕阳把两个人的影子拉得很长。',
        options: [
          {
            text: '「那这次别散。」',
            hint: '很重的一句话',
            effects: ['affection += 2', 'trust += 2', 'flag:promised_stay'],
            goto: 'dont_leave',
          },
          {
            text: '「散了也没关系。记得就行。」',
            hint: '你自己也没想清楚这是不是真心话',
            effects: ['trust += 2', 'flag:keep_memory'],
            goto: 'memory_is_enough',
          },
          {
            text: '「你想太多了。」',
            effects: ['friction += 2', 'flag:dismissed_her'],
            goto: 'overthinking',
          },
        ],
      },
    ],

    dont_leave: [
      '「那这次别散。」',
      { type: 'wait', duration: 400 },
      '她停下来，看着我。',
      ['miyuki', '……你凭什么这么说。', 'surprised'],
      '「没凭什么。」',
      ['miyuki', '你根本不知道我家什么时候又要搬。'],
      '「那到时候再说。」',
      ['miyuki', '你这人——', 'sad'],
      '她没说完。',
      '但她也没有再往前走。我们在河堤上站了很久，直到天完全黑掉。',
      { type: 'goto', target: 'chapter_close' },
    ],

    memory_is_enough: [
      '「散了也没关系。记得就行。」',
      ['miyuki', '……', 'surprised'],
      ['miyuki', '你这个人说话真奇怪。'],
      ['miyuki', '别人都说「不会散的」「我保证」。'],
      ['miyuki', '只有你说「散了也没关系」。'],
      '「因为保证没有用。」',
      '「但我可以保证我记得。」',
      { type: 'wait', duration: 400 },
      '她笑了。',
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center' },
      '不是那种客气的笑。是那种「终于有人说了句实话」的笑。',
      ['miyuki', '……好。', 'smile'],
      ['miyuki', '那你记得。'],
      { type: 'effects', effects: ['flag:keep_memory', 'flag:honest_answer'] },
      { type: 'goto', target: 'chapter_close' },
    ],

    overthinking: [
      '「你想太多了。」',
      ['miyuki', '……', 'sad'],
      ['miyuki', '嗯。'],
      '她加快了脚步。',
      '剩下的路我们一句话都没说。',
      '在岔路口她说了句「明天见」，声音很轻。',
      '——「明天见」这三个字，她后来说了很多次。',
      '每一次都比上一次轻一点。',
      { type: 'goto', target: 'chapter_close' },
    ],

    /* ========================= 章末 ========================= */
    chapter_close: [
      { type: 'bg', bg: 'black', transition: 'fade', duration: 1000 },
      { type: 'hide', all: true, duration: 500 },
      { type: 'wait', duration: 350 },
      '那天晚上我做了一个梦。',
      '梦见她在书店里翻那本书，翻到第八遍的时候书变成了空白。',
      '她抬头看我，说：「你看，我还是没记住。」',
      { type: 'wait', duration: 400 },
      '——第二天早上，她比我早到教室。',
      '看见我进来，她抬起头。',
      '然后她说了一句话。',
      '那是她第一次主动跟我说话。',
      { type: 'wait', duration: 250 },
      '「早。」',
      { type: 'wait', duration: 450 },
      '就一个字。',
      '但我知道那是什么意思。',
      { type: 'end' },
    ],

    _cheat_sheet: [
      { type: 'bg', bg: 'black', transition: 'none' },
      { type: 'show', character: 'kaede', expr: 'smile', at: 'left' },
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'right' },
      { type: 'hide', all: true },
      { type: 'end' },
    ],
  },
};
