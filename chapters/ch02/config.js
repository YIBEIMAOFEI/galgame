/**
 * chapters/ch02/config.js —— 本章专用数值
 *
 * 策划备注（不参与运行）：
 *   本章四次选择，是全局变量拉开差距最主要的一章：
 *     affection  0 ~ +6
 *     trust     -1 ~ +6
 *     friction   0 ~ +4
 *   「雨中伞」和「河堤」是两个关键分歧点：
 *     - 河堤选「散了也没关系」会拿到 flag:keep_memory，但不加 affection ——
 *       这是**故意**的，它是指向「永恒的朋友」结局的主要路径。
 *       玩家如果一路都在追求好感，反而拿不到这个结局。
 *     - 「你想太多了」会加 friction，是分道扬镳结局的早期积累点。
 */

export default {
  settings: {
    cps: 46,
    autoWait: 1100,
  },

  design: {
    maxAffection: 6,
    maxTrust: 6,
    maxFriction: 4,
    keyFlags: ['listened', 'changed_pace', 'keep_memory', 'honest_answer'],
  },
};
