/**
 * src/main.js —— 站点引导（真正的入口）
 *
 * index.html 只负责「挂载 + 报错好看」，逻辑都在这里：
 *   1. 组装配置（src/config.js）
 *   2. new App → init() → 暴露到 window.gal 方便在控制台里调试
 *
 * 调试小抄（浏览器 F12 控制台里直接用）：
 *   gal.startChapter('ch02', { fresh: true })   // 直接跳到某章
 *   gal.registry.status()                       // 哪些章节已加载 / 加载失败
 *   gal.vars.summary()                          // 当前变量
 *   gal.loader.summary()                        // 资源加载统计
 *   gal.saves.exportAll()                       // 导出存档 JSON 文本
 *   gal.logs                                    // 引擎日志
 */

import { App, DEFAULT_CONFIG, ENGINE_VERSION } from './app.js';

export async function start(root, configOverrides = {}) {
  const { default: userConfig } = await import('./config.js');
  const config = { ...DEFAULT_CONFIG, ...userConfig, ...configOverrides };

  const app = new App(root, config);
  await app.init();

  // 暴露给控制台 / 自动化测试
  globalThis.gal = app;
  root.dataset.engineVersion = ENGINE_VERSION;
  return app;
}

export { App, ENGINE_VERSION };
