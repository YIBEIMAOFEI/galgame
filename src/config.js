/**
 * src/config.js —— 你这个游戏的全局设定
 *
 * 这是「换皮」时最该改的文件：标题、主角默认名、文字速度、音量、
 * 资源探测开关都在这里。核心代码不用动。
 *
 * 部署到子目录或 CDN 时改 baseUrl，例如：
 *   export default { baseUrl: 'https://cdn.example.com/gal/' }
 * 或者干脆不动它 —— 默认会按 index.html 的实际地址自动推导（含子目录）。
 */

export default {
  /** 标题界面显示的名字 */
  title: '无名之夏',
  subtitle: '一个可替换立绘 / 章节文本的视觉小说骨架',

  /** localStorage 前缀，同一域名下放多个游戏时用得上 */
  namespace: 'gal-xuexi',
  gameVersion: '0.1.0',

  /** 开局是否询问主角名字 */
  askPlayerName: true,
  defaultPlayerName: '悠',

  /** 从哪一章开始（null = 用 chapters/index.js 里 order 最小的那章） */
  startChapter: null,

  /** 文字表现 */
  story: {
    cps: 45, // 打字机速度：字/秒
    autoWait: 1100, // 自动播放时每句的额外停留（毫秒）
  },

  /** 音量（0~1） */
  audio: {
    masterVolume: 0.8,
    bgmVolume: 0.55,
    seVolume: 0.8,
  },

  /**
   * 资源路径约定。一般不用改；要改也是改这里而不是改代码。
   * strict:true 会让引擎只按固定扩展名（.png/.ogg）拼路径，零探测请求 —— 上线推荐。
   */
  paths: {
    assets: 'assets',
    chapters: 'chapters',
    charactersFile: 'characters/index.js',
    audio: 'audio',
    ext: 'png',
    audioExt: 'ogg',
    strict: false,
  },

  /** 是否用 HEAD 请求探测资源是否存在（开发时开着，报错更早、更清楚） */
  verifyAssets: true,

  /** 是否把引擎日志打到浏览器控制台 */
  debug: false,
};
