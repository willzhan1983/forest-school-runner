/* regression-00-smoke.js —— 脚手架自检：
 *  __fsr 键清单 / rAF 步进器可用 / 单帧耗时（决定是否要缩小 CHUNK）/ 绘制记录仪可用
 */
const H = require('./regression-harness');
const L = H.freshLog('regression-00-smoke');

(async () => {
  const browser = await H.launch();
  const { page, errors, step, recordFrame } = await H.newPage(browser);
  L.w('=== 0. 脚手架自检 ===');

  const keys = await page.evaluate(() => Object.keys(window.__fsr));
  L.w('__fsr keys: ' + JSON.stringify(keys));

  const hasStep = await page.evaluate(() => typeof window.__step === 'function');
  L.w('window.__step: ' + hasStep);
  if (!hasStep) { L.w('FATAL 步进器未安装'); await browser.close(); process.exit(1); }

  // 单帧耗时（菜单态）
  let t0 = Date.now();
  await step(60, 16.6667);
  L.w('菜单态 60 帧耗时: ' + ((Date.now() - t0) / 1000).toFixed(2) + 's');

  // 游玩态单帧耗时
  await page.evaluate(() => { window.__fsr.setDifficulty('normal'); window.__fsr.startGame(); });
  t0 = Date.now();
  await step(60, 16.6667);
  L.w('游玩态 60 帧耗时: ' + ((Date.now() - t0) / 1000).toFixed(2) + 's');

  const st = await page.evaluate(() => {
    const G = window.__fsr.Game;
    return { state: G.state, dist: G.distance, speed: G.speed, lives: G.lives, maxLives: G.maxLives, diff: window.__fsr.getDiffId() };
  });
  L.w('游玩态: ' + JSON.stringify(st));

  // 绘制记录仪
  const items = await recordFrame(null, 1);
  L.w('游玩态单帧绘制记录条数: ' + items.length);
  L.w('样例: ' + JSON.stringify(items.slice(0, 6)));

  // 菜单态记录
  await page.evaluate(() => { window.__fsr.Game.state = 'menu'; window.__fsr.Game.shake = 0; window.__fsr.Game.time = 1680; window.__fsr.Game.scroll = 0; });
  const menuItems = await recordFrame(null, 1);
  L.w('菜单态单帧绘制记录条数: ' + menuItems.length);
  const big = menuItems.filter(i => (i.x1 - i.x0) < 900 || (i.y1 - i.y0) < 400);
  L.w('滤掉全屏底后的条数: ' + big.length);
  L.w('文本记录: ' + JSON.stringify(big.filter(i => i.kind === 'fillText').map(i => ({ t: i.text, x0: +i.x0.toFixed(1), y0: +i.y0.toFixed(1), x1: +i.x1.toFixed(1), y1: +i.y1.toFixed(1) }))));

  L.w('errors: ' + errors.length + (errors.length ? ' -> ' + JSON.stringify(errors) : ''));
  L.w('=== 自检完成 ' + L.sec() + ' ===');
  await browser.close();
})().catch(e => { L.w('FATAL ' + e.stack); process.exit(1); });
