/**
 * chapters/ch01/script.js —— 第一章 · 转学生
 *
 * 剧情依据：docs/剧情大纲.md
 * 本章目标：建立「她有点特别」的印象，给玩家三次表态机会
 * 产出变量：affection 起点、trust 起点、flag:listened
 *
 * 语法速查（详细见 docs/添加内容.md）：
 *   ['miyuki', '台词']            角色台词
 *   ['miyuki', '台词', 'smile']   顺带换表情
 *   '旁白'                        直接写字符串
 *   { type:'bg', bg:'classroom' } 换背景（id 就是 assets/bg 里的文件名）
 *   { type:'cg', cg:'event_rooftop' }   定格 CG
 *   { type:'goto', target:'块名', condition:'affection >= 3' }
 */

export default {
  id: 'ch01',
  title: '第一章 · 转学生',
  subtitle: 'The transfer student',

  start: 'opening',

  /**
   * 全局变量在这里「立规矩」。
   *
   * 第一章是所有路线的起点，所以它把全剧要用的变量都声明一遍 ——
   * 后面每一章都只是继续加减它们。这么做的好处是校验器能发现拼错的变量名：
   * 「写入了未声明的变量 friction」这种警告，往往就是打错字了。
   */
  vars: {
    playerName: '悠',
    /** 好感：想不想靠近她 */
    affection: 0,
    /** 信任：她敢不敢跟你说真话 */
    trust: 0,
    /** 摩擦：你们之间的磨损。结局 C 的主要判据 */
    friction: 0,
    /** 本章局部变量 */
    metAtRooftop: 0,
  },

  assets: {
    bg: ['classroom', 'classroom_blur', 'corridor', 'rooftop_dusk', 'black'],
    sprite: [
      { character: 'miyuki', expr: 'neutral' },
      { character: 'miyuki', expr: 'smile' },
      { character: 'miyuki', expr: 'surprised' },
      { character: 'miyuki', expr: 'sad' },
      { character: 'miyuki', expr: 'away' },
    ],
    cg: ['event_rooftop'],
    bgm: [],
    se: [],
  },

  endings: [],

  settings: { cps: 44, autoWait: 1200 },

  blocks: {
    /* ============================ 开场 ============================ */
    opening: [
      { type: 'bg', bg: 'classroom', transition: 'fade', duration: 900 },
      '开学第二周的星期二。',
      '蝉已经叫不动了，教室里的风扇转得有气无力。',
      '班主任推门进来的时候，身后跟着一个女生。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 600 },
      ['miyuki', '……深雪。', 'neutral'],
      ['miyuki', '请多指教。'],
      '就这样。',
      '没有「我来自哪里」，没有「我的爱好是」，没有「请大家多多关照」。',
      '教室里安静了一下 —— 那种不知道该怎么接的安静。',
      { type: 'hide', character: 'miyuki', duration: 400 },
      '然后班主任说：「那你先坐那边吧。」',
      '她走过来，在我旁边的空位坐下。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 400 },
      '她把书包放在桌上，没有看我一眼。',
      { type: 'goto', target: 'first_contact' },
    ],

    /* ======================= 选择① 怎么搭话 ======================= */
    first_contact: [
      {
        type: 'choice',
        prompt: '第一节课还有五分钟。要做点什么吗？',
        options: [
          {
            text: '「你之前在哪个学校？」',
            hint: '最安全的开场白',
            effects: ['affection += 1', 'flag:asked_school'],
            goto: 'ask_school',
          },
          {
            text: '把多带的一块橡皮推过去',
            hint: '她桌上什么文具都没有',
            effects: ['affection += 2', 'trust += 1', 'flag:gave_eraser'],
            goto: 'give_eraser',
          },
          {
            text: '什么都不说',
            hint: '有些人不需要被搭话',
            effects: ['flag:stayed_silent'],
            goto: 'stay_silent',
          },
        ],
      },
    ],

    ask_school: [
      ['miyuki', '「你之前在哪个学校？」'],
      ['miyuki', '……很多个。', 'neutral'],
      '「很多个」是什么意思？',
      ['miyuki', '就是很多个。', 'away'],
      '她没有再解释。上课铃响了。',
      { type: 'effects', effects: ['flag:knows_transfer'] },
      { type: 'goto', target: 'afternoon' },
    ],

    give_eraser: [
      '我把橡皮推到她桌角。',
      { type: 'show', character: 'miyuki', expr: 'surprised', at: 'center' },
      ['miyuki', '……', 'surprised'],
      ['miyuki', '你怎么知道我——'],
      '她停住了，把后半句咽了回去。',
      ['miyuki', '谢谢。', 'neutral'],
      '她收下了，没有再多说。但我注意到她把橡皮放进了笔袋最里面的那一层。',
      { type: 'effects', effects: ['flag:knows_transfer'] },
      { type: 'goto', target: 'afternoon' },
    ],

    stay_silent: [
      '我什么都没说。',
      '过了大概两分钟。',
      ['miyuki', '……你不问吗？', 'neutral'],
      '「问什么？」',
      ['miyuki', '别人都会问的。从哪里来，为什么转学。'],
      '「你想说的时候会说。」',
      ['miyuki', '……', 'surprised'],
      '她侧过头看了我一眼，很快又转回去了。',
      { type: 'effects', effects: ['trust += 1', 'flag:stayed_silent', 'flag:knows_transfer'] },
      { type: 'goto', target: 'afternoon' },
    ],

    /* ====================== 放学后 · 值日 ====================== */
    afternoon: [
      { type: 'bg', bg: 'classroom', transition: 'fade', duration: 700 },
      { type: 'hide', all: true, duration: 400 },
      '放学后轮到我值日。',
      '擦完黑板回头，教室里只剩一个人。',
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 500 },
      '她坐在座位上，低着头，在抄黑板角落的值日表。',
      '一笔一笔，抄得很慢，很用力。',
      '抄完，她合上本子，又从第一页翻开，再看一遍。',
      { type: 'goto', target: 'choice_duty' },
    ],

    choice_duty: [
      {
        type: 'choice',
        prompt: '她还在抄。',
        options: [
          {
            text: '走过去：「我帮你抄吧。」',
            effects: ['trust += 2', 'affection += 1', 'flag:listened'],
            goto: 'help_her',
          },
          {
            text: '「明天再抄也行吧。」',
            effects: [],
            goto: 'tomorrow',
          },
          {
            text: '「你……记不住吗？」',
            effects: ['trust += 1'],
            goto: 'ask_directly',
          },
        ],
      },
    ],

    help_her: [
      ['miyuki', '不用。', 'neutral'],
      '「我不是要帮你。我是要抄我自己那份。」',
      '她愣了一下。',
      ['miyuki', '……那你自己拿本子。', 'smile'],
      '我在她旁边坐下，两个人一起抄同一个值日表。',
      '抄到最后一行，她忽然说：',
      ['miyuki', '我不太能记住东西。'],
      ['miyuki', '所以什么都写下来。', 'neutral'],
      '「那抄下来的呢？」',
      ['miyuki', '抄下来的……就是我的了。'],
      { type: 'effects', effects: ['flag:knows_notebook'] },
      { type: 'goto', target: 'rooftop_intro' },
    ],

    tomorrow: [
      ['miyuki', '嗯。明天再说。', 'neutral'],
      '她把本子收起来，站起来走了。',
      '走到门口的时候她停了一下，像是想说什么，但最后什么都没说。',
      '——我后来才知道，她那天抄的不是值日表。是课程表。',
      '她怕第二天又走错教室。',
      { type: 'goto', target: 'rooftop_intro' },
    ],

    ask_directly: [
      '「你……记不住吗？」',
      { type: 'show', character: 'miyuki', expr: 'away', at: 'center' },
      '她的手停住了。',
      ['miyuki', '……你说话真直接。', 'away'],
      '「抱歉。」',
      ['miyuki', '不用道歉。你说对了。', 'neutral'],
      ['miyuki', '我不太能记住东西。所以什么都写下来。'],
      ['miyuki', '写下来的就是我的了。'],
      '她把本子合上，第一次正眼看我。',
      ['miyuki', '你叫什么？'],
      '我报上了名字。她点点头，像是把这三个字也抄进了什么地方。',
      { type: 'effects', effects: ['flag:knows_notebook', 'affection += 1'] },
      { type: 'goto', target: 'rooftop_intro' },
    ],

    /* ======================== 天台 · 相遇 ======================== */
    rooftop_intro: [
      { type: 'bg', bg: 'corridor', transition: 'fade', duration: 700 },
      { type: 'hide', all: true, duration: 400 },
      '锁门的时候发现天台的门虚掩着。',
      '我上去看了一眼。',
      { type: 'bg', bg: 'rooftop_dusk', transition: 'fade', duration: 1100 },
      { type: 'wait', duration: 200 },
      '夕阳把水泥地烤成橘色。',
      '围栏边坐着一个人。',
      { type: 'show', character: 'miyuki', expr: 'surprised', at: 'center', transition: 'fade', duration: 500 },
      ['miyuki', '……你怎么会在这里。', 'surprised'],
      ['miyuki', '（她很快转回去，像是被抓到了什么。）', 'away'],
      { type: 'effects', effects: ['metAtRooftop = 1'] },
      { type: 'goto', target: 'choice_rooftop' },
    ],

    choice_rooftop: [
      {
        type: 'choice',
        prompt: '她背对着你。',
        options: [
          {
            text: '「那我也不说话。」然后坐下',
            hint: '她是上来躲人的',
            effects: ['trust += 2', 'affection += 1', 'flag:listened'],
            goto: 'sit_silent',
          },
          {
            text: '「上面风景不错。」',
            effects: [],
            goto: 'talk_scenery',
          },
          {
            text: '「随便走走。」',
            effects: ['affection += 1'],
            goto: 'just_walking',
          },
        ],
      },
    ],

    sit_silent: [
      '我没再说话，走过去，在离她三米的地方坐下。',
      { type: 'wait', duration: 250 },
      '风把她的头发吹起来一点。',
      { type: 'wait', duration: 250 },
      '大概过了十分钟。',
      ['miyuki', '……你为什么上来。', 'neutral'],
      '「因为你在。」',
      ['miyuki', '……', 'surprised'],
      '她没有接话。',
      '但过了一会儿，她笑了一下。',
      { type: 'show', character: 'miyuki', expr: 'smile', at: 'center' },
      '很淡，几乎看不出来。但我看见了。',
      ['miyuki', '你这个人，有点奇怪。', 'smile'],
      ['miyuki', '奇怪的人，我一般记不住。'],
      ['miyuki', '但你——'],
      '她停住了，没有说完。',
      { type: 'goto', target: 'rooftop_end' },
    ],

    talk_scenery: [
      '「上面风景不错。」',
      ['miyuki', '嗯。', 'neutral'],
      '然后就没有然后了。',
      '她一直看着远处的楼，我一直在看她的后脑勺。',
      '十分钟后她站起来，拍了拍裙子。',
      ['miyuki', '我先走了。'],
      { type: 'goto', target: 'rooftop_end' },
    ],

    just_walking: [
      '「随便走走。」',
      ['miyuki', '……随便走走走到天台上来。', 'neutral'],
      ['miyuki', '那你挺会走的。'],
      '她说完自己也愣了一下，像是没想到会说出这种话。',
      { type: 'show', character: 'miyuki', expr: 'away', at: 'center' },
      '然后她站起来走了。',
      { type: 'goto', target: 'rooftop_end' },
    ],

    /* ========================= 章末 ========================= */
    rooftop_end: [
      { type: 'bg', bg: 'rooftop_dusk', transition: 'none' },
      { type: 'cg', cg: 'event_rooftop', transition: 'fade', duration: 1200 },
      { type: 'wait', duration: 400 },
      '天彻底黑下来之前，她站起来，走到门口。',
      '手放在门把上，停了一下。',
      { type: 'cg', hide: true, duration: 600 },
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'center', transition: 'fade', duration: 600 },
      ['miyuki', '明天……你还会来吗？', 'neutral'],
      '她没有回头。',
      '「会。」',
      ['miyuki', '嗯。'],
      { type: 'hide', character: 'miyuki', duration: 600 },
      { type: 'wait', duration: 300 },
      '门在身后合上了。',
      '我站在原地，听见自己的心跳。',
      '——那时候我还不知道，这句话她问过很多人。',
      '而回答「会」的，只有我一个。',
      { type: 'end' },
    ],

    /* ===================== 开发用：语句速查 ===================== */
    _cheat_sheet: [
      { type: 'bg', bg: 'black', transition: 'none' },
      { type: 'cg', cg: 'event_rooftop', transition: 'fade' },
      { type: 'cg', hide: true },
      { type: 'show', character: 'miyuki', expr: 'neutral', at: 'left' },
      { type: 'move', character: 'miyuki', at: 'right' },
      { type: 'wait', duration: 150 },
      { type: 'shake', intensity: 8, duration: 400 },
      { type: 'se', id: 'se_click' },
      { type: 'bgm', id: 'bgm_summer', action: 'play' },
      { type: 'bgm', id: 'bgm_summer', action: 'stop' },
      { type: 'hide', all: true },
      { type: 'end' },
    ],
  },

  /** 章节内子分组（只影响资料显示，不影响播放） */
  chapters: {
    part1: { title: '上午 · 座位旁边的人', blocks: ['opening', 'first_contact', 'ask_school', 'give_eraser', 'stay_silent'] },
    part2: { title: '放学后 · 值日表', blocks: ['afternoon', 'choice_duty', 'help_her', 'tomorrow', 'ask_directly'] },
    part3: { title: '天台 · 夕阳', blocks: ['rooftop_intro', 'choice_rooftop', 'sit_silent', 'rooftop_end'] },
  },
};
