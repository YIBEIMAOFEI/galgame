/**
 * characters/kaede.js —— 单角色定义（演示「一个角色一个文件」的写法）
 *
 * 角色多起来之后，把每个角色拆成自己的文件、由 index.js 汇总，
 * 好处是：改某个人物的设定不会和别人冲突，git 里也不容易撞车。
 */

/** @type {import('./index.js').Character} */
const kaede = {
  name: '枫',
  /** 名字牌颜色：暖橙，和深雪的冷蓝形成对比，一眼能分清谁在说话 */
  color: '#f0c78a',
  scale: 1.03,
  defaultSlot: 'right',
  fallbackExpr: 'neutral',

  expressions: {
    neutral: '',   // 平静
    smile: '',     // 嬉皮笑脸 —— 他的默认状态
    serious: '',   // 难得认真（第四章问他的那一段）
  },

  bio: '同班同学，男主的损友。嘴上没个正经，但每次男主钻牛角尖，都是他一脚踹醒的。',
};

export default kaede;
