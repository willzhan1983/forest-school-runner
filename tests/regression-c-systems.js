/* =============================================================
 * regression-c-systems.js —— C 组既有功能回归（2/2）
 *   C3 道具系统（护盾 / 磁铁 / 双倍分）
 *   C4 BGM 与音效开关
 *   C6 两个角色与技能
 *   C9 触屏滑铲手势未被 pointermove 悬停监听破坏
 * ============================================================= */
const H = require('./regression-harness');
const fs = require('fs');
const path = require('path');
const L = H.freshLog('regression-c-systems');
const R = H.results();

(async () => {
  const browser = await H.launch();
  let ALLERR = [];

  /* ==================== C3 道具系统 ==================== */
  {
    const { page, errors, step } = await H.newPage(browser);
    L.w('\n=== C3-a 护盾：撞障碍时护盾 -1 而生命不变 ===');
    await page.evaluate(() => { window.__fsr.setDifficulty('normal'); window.__fsr.startGame(); });
    await step(20);

    const shield = await page.evaluate(() => {
      const f = window.__fsr, G = f.Game, p = f.getPlayer();
      const out = {};
      out.before = { shield: f.Buff.shield, lives: G.lives };
      f.grantPowerup('shield');
      out.granted = f.Buff.shield;
      // 清掉保护，注入一个与玩家重叠的障碍
      p.invuln = 0; p.hurtTimer = 0;
      const obs = { x: p.x, y: p.y, w: 52, h: 68, type: 'rock', dead: false, deadT: 0, deadRot: 0, scored: false };
      f.getObstacles().push(obs);
      window.__step(16.6667);
      out.afterHit1 = { shield: f.Buff.shield, lives: G.lives, shake: G.shake };
      // 二次撞击（清掉无敌帧）应开始掉血
      p.invuln = 0; p.hurtTimer = 0;
      f.getObstacles().push({ x: p.x, y: p.y, w: 52, h: 68, type: 'rock', dead: false, deadT: 0, deadRot: 0, scored: false });
      window.__step(16.6667);
      out.afterHit2 = { shield: f.Buff.shield, lives: G.lives };
      // 护盾上限 2
      f.grantPowerup('shield'); f.grantPowerup('shield'); f.grantPowerup('shield');
      out.cap = f.Buff.shield;
      return out;
    });
    L.w('  ' + JSON.stringify(shield));
    const okShield = shield.before.shield === 0 && shield.granted === 1 &&
      shield.afterHit1.shield === 0 && shield.afterHit1.lives === 3 &&
      shield.afterHit2.lives === 2 && shield.cap === 2;
    R.add('C3-a', okShield, 'C3 护盾抵挡一次伤害不掉血、二次撞击才掉血、上限 2 层',
      JSON.stringify(shield));

    // 磁铁 / 双倍分：用固定 Math.random 保证两次运行完全可复现，做 A/B 对照
    L.w('\n=== C3-b/c 磁铁吸附 & 双倍分（固定 Math.random=0.5，A/B 对照）===');
    await page.close();
  }
  {
    const { page, errors, step } = await H.newPage(browser, { fixedRandom: 0.5 });

    /* 关键点（踩过的坑）：
       - 页面首帧 lastTs=0 → dt 被算成 0，导致"第一次运行"与"后续运行"不等价；
         故先空跑 10 帧预热，把首帧异常吃掉。
       - __step(16) 时 t 按整数 16 累加，(t_new-t_old)/16.6667 每帧位级相同，
         整段模拟可位级复现；用 16.6667 则浮点累加会引入 ~1e-13 抖动。 */
    await step(10, 16);

    // 一次跑完：startGame → 30 帧 → 设定 Buff → 注入物件 → 1 帧 → 读结果
    const runOnce = (cfg) => page.evaluate((cfg) => {
      const f = window.__fsr, G = f.Game;
      G.state = 'menu';
      f.setDifficulty('normal');
      f.startGame();
      const pl = f.getPlayer();
      pl.invuln = 1e9;
      for (let i = 0; i < 30; i++) window.__step(16);
      const p = f.getPlayer();
      const pk = {
        x: cfg.x, y: cfg.y, w: 26, h: 26,
        kind: cfg.kind, tint: '#5b8fd4', seed: 0, taken: false
      };
      f.getPickups().push(pk);
      f.Buff.magnet = cfg.magnet || 0;
      f.Buff.double = cfg.double || 0;
      const t0 = G.time, d0 = G.distance, s0 = G.score, n0 = f.getPickups().length;
      const px0 = pk.x, py0 = pk.y;
      window.__step(16);
      const arr = f.getPickups();
      return {
        t0, d0, s0, n0, px0, py0,
        px1: pk.x, py1: pk.y,
        t1: G.time, d1: G.distance, s1: G.score, n1: arr.length,
        collected: arr.indexOf(pk) < 0,
        speed: G.speed,
        px: p.x, py: p.y, pw: p.w, ph: p.h,
        books: G.books, acorns: G.acorns
      };
    }, cfg);

    // -- 先做"可复现性自检"：同一配置连跑两次必须位级一致，否则 A/B 对照无效
    const base = { x: 136, y: 395, kind: 'acorn', magnet: 0, double: 0 };
    const repA = await runOnce(base);
    const repB = await runOnce(base);
    const det = repA.d0 === repB.d0 && repA.s0 === repB.s0 && repA.t0 === repB.t0 &&
      repA.px0 === repB.px0 && repA.d1 === repB.d1 && repA.px1 === repB.px1;
    L.w('  可复现性自检: ' + det + '  (d0=' + repA.d0 + '/' + repB.d0 + ', d1=' + repA.d1 + '/' + repB.d1 + ')');
    R.add('C3-det', det, 'C3 A/B 两次运行位级一致（对照有效的前提）',
      'A: d0=' + repA.d0 + ' d1=' + repA.d1 + ' | B: d0=' + repB.d0 + ' d1=' + repB.d1);

    // -- 磁铁：同一初始状态，磁铁开/关两次运行的 x 位移差应等于吸附量 7*dt*(dx/d)
    const magOff = await runOnce({ x: 136, y: 395, kind: 'acorn', magnet: 0, double: 0 });
    const magOn = await runOnce({ x: 136, y: 395, kind: 'acorn', magnet: 520, double: 0 });
    L.w('  磁铁关: ' + JSON.stringify({ px0: magOff.px0, px1: magOff.px1, d0: magOff.d0, d1: magOff.d1 }));
    L.w('  磁铁开: ' + JSON.stringify({ px0: magOn.px0, px1: magOn.px1, d0: magOn.d0, d1: magOn.d1 }));

    const dt = magOn.t1 - magOn.t0;
    const move = magOn.d1 - magOn.d0;
    const xAfterScroll = magOn.px0 - move;
    const pcx = magOn.px + magOn.pw / 2, pcy = magOn.py + magOn.ph / 2;
    const bob = Math.sin(magOn.t1 * 0.09 + 0) * 5;      // seed = 0
    const ddx = pcx - xAfterScroll, ddy = pcy - (magOn.py0 + bob);
    const dd = Math.sqrt(ddx * ddx + ddy * ddy);
    const expected = 7 * dt * (ddx / dd);
    const observed = magOn.px1 - magOff.px1;
    L.w('  dt=' + dt + ' move=' + move.toFixed(6) + ' d=' + dd.toFixed(4) +
      ' 吸附预期=' + expected.toFixed(8) + ' 实测=' + observed.toFixed(8));
    const magOk = observed > 0 && Math.abs(observed - expected) < 1e-6 && dd < 161;
    R.add('C3-b', magOk, 'C3 磁铁吸附生效（位移量 == 7*dt*dx/d，误差 <1e-6）',
      'observed=' + observed.toFixed(10) + ' expected=' + expected.toFixed(10) +
      ' dt=' + dt + ' d=' + dd.toFixed(4) + ' (吸附半径 161)');

    // -- 双倍分：注入一个必被吃到的 book，比较得分增量
    const dblOff = await runOnce({ x: 210, y: 400, kind: 'book', magnet: 0, double: 0 });
    const dblOn = await runOnce({ x: 210, y: 400, kind: 'book', magnet: 0, double: 620 });
    L.w('  双倍关: collected=' + dblOff.collected + ' scoreDelta=' + (dblOff.s1 - dblOff.s0).toFixed(8) + ' books=' + dblOff.books);
    L.w('  双倍开: collected=' + dblOn.collected + ' scoreDelta=' + (dblOn.s1 - dblOn.s0).toFixed(8) + ' books=' + dblOn.books);
    const gainOff = dblOff.s1 - dblOff.s0, gainOn = dblOn.s1 - dblOn.s0;
    const diff = gainOn - gainOff;
    /* 注意：addScore 是统一入口，双倍分会把"跑动得分 move*0.036"一并翻倍，
       所以额外得分 = book 的 15 + 该帧跑动得分（也被多翻了一倍）。 */
    const moveScore = (dblOn.d1 - dblOn.d0) * 0.036;
    const expectDiff = 15 + moveScore;
    L.w('  双倍分带来的额外得分 = ' + diff.toFixed(10) +
      '  (= book 基础 15 + 该帧跑动得分 ' + moveScore.toFixed(10) + ' 被一并翻倍)');
    L.w('  gainOn / gainOff = ' + (gainOn / gainOff) + ' （应恰为 2）');
    R.add('C3-c', dblOff.collected && dblOn.collected &&
      Math.abs(gainOn - gainOff * 2) < 1e-9 && Math.abs(diff - expectDiff) < 1e-9,
      'C3 双倍分生效（book 15→30，且全部 addScore 统一翻倍）',
      'gainOff=' + gainOff.toFixed(8) + ' gainOn=' + gainOn.toFixed(8) +
      ' ratio=' + (gainOn / gainOff) + ' diff=' + diff.toFixed(10) + ' expectDiff=' + expectDiff.toFixed(10));

    // 磁铁/双倍 buff 时长与护盾初值
    const buffVals = await page.evaluate(() => {
      const f = window.__fsr;
      f.Buff.magnet = 0; f.Buff.double = 0; f.Buff.shield = 0;
      f.grantPowerup('magnet');
      f.grantPowerup('double');
      return { magnet: f.Buff.magnet, double: f.Buff.double };
    });
    L.w('  grantPowerup 时长: ' + JSON.stringify(buffVals));
    R.add('C3-d', buffVals.magnet === 520 && buffVals.double === 620,
      'C3 磁铁 520 帧 / 双倍分 620 帧', JSON.stringify(buffVals));

    const ge = errors.length;
    R.add('C3-e', ge === 0, 'C3 道具系统零错误', 'errors=' + ge + (ge ? ' ' + JSON.stringify(errors) : ''));
    ALLERR = ALLERR.concat(errors.map(e => 'C3: ' + e));
    await page.close();
  }

  /* ==================== C4 BGM 与音效 ==================== */
  {
    const { page, errors, step } = await H.newPage(browser);
    L.w('\n=== C4 BGM 与音效开关 ===');
    const A = () => page.evaluate(() => ({
      musicOn: window.__fsr.Audio2.musicOn,
      ctx: !!window.__fsr.Audio2.ctx,
      musicCtx: !!window.__fsr.Audio2.musicCtx,
      enabled: window.__fsr.Audio2.enabled,
      ls: (function () { try { return localStorage.getItem('fsr_music'); } catch (e) { return 'ERR'; } })()
    }));

    L.w('  初始: ' + JSON.stringify(await A()));
    await page.evaluate(() => { window.__fsr.setDifficulty('normal'); window.__fsr.startGame(); });
    await step(4);
    const a1 = await A(); L.w('  开局后: ' + JSON.stringify(a1));

    await page.evaluate(() => window.__fsr.Audio2.toggleMusic());
    await step(3);
    const a2 = await A(); L.w('  关音乐: ' + JSON.stringify(a2));

    await page.evaluate(() => window.__fsr.Audio2.toggleMusic());
    await step(3);
    const a3 = await A(); L.w('  开音乐: ' + JSON.stringify(a3));

    // 暂停应停 BGM
    await page.evaluate(() => { window.__fsr.Game.paused = true; });
    await step(4);
    const a4 = await A(); L.w('  暂停: ' + JSON.stringify(a4));

    // 恢复应续 BGM
    await page.evaluate(() => { window.__fsr.Game.paused = false; });
    await step(4);
    const a5 = await A(); L.w('  恢复: ' + JSON.stringify(a5));

    // 结算页 BGM 延续到结算页（PR #2 改动），不再自动停
    await page.evaluate(() => window.__fsr.gameOver());
    await step(3);
    const a6 = await A(); L.w('  结算: ' + JSON.stringify(a6));
    await page.evaluate(() => { window.__fsr.Game.state = 'menu'; });

    // HUD 上的音乐按钮可点击
    await page.evaluate(() => { window.__fsr.setDifficulty('easy'); window.__fsr.startGame(); });
    await step(3);
    const before = (await A()).musicOn;
    const pt = await page.evaluate(() => {
      const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
      return { x: r.left + 108 * (r.width / 960), y: r.top + 42 * (r.height / 540) };
    });
    await page.mouse.click(pt.x, pt.y);
    await step(3);
    const after = (await A()).musicOn;
    L.w('  点击 HUD 音乐按钮: ' + before + ' → ' + after);
    R.add('C4-f', before !== after, 'C4 HUD 音乐按钮可点击且翻转 musicOn', before + ' → ' + after);

    const ctxOk = a1.ctx === true;
    if (!ctxOk) {
      R.na('C4', 'C4 BGM 启停', 'AudioContext 在无头环境不可用（ctx=false），无法判定');
      L.w('  ⚠ AudioContext 不可用，C4 主体判 N/A');
    } else {
      R.add('C4-a', a1.musicCtx === true, 'C4 开局自动启动 BGM', JSON.stringify(a1));
      R.add('C4-b', a2.musicOn === false && a2.musicCtx === false, 'C4 关闭音乐后 musicCtx 释放', JSON.stringify(a2));
      R.add('C4-c', a3.musicOn === true && a3.musicCtx === true, 'C4 重新开启后 BGM 续播', JSON.stringify(a3));
      R.add('C4-d', a4.musicCtx === false, 'C4 暂停自动停 BGM', JSON.stringify(a4));
      R.add('C4-e', a5.musicCtx === true, 'C4 恢复自动续 BGM', JSON.stringify(a5));
      R.add('C4-g', a6.musicCtx === true, 'C4 结算页 BGM 延续', JSON.stringify(a6));
      R.add('C4-h', a2.ls === '0' && a3.ls === '1', 'C4 音乐开关写入 localStorage 持久化',
        'off=' + a2.ls + ' on=' + a3.ls);
    }

    const ge = errors.length;
    R.add('C4-i', ge === 0, 'C4 音频流程零错误', 'errors=' + ge + (ge ? ' ' + JSON.stringify(errors) : ''));
    ALLERR = ALLERR.concat(errors.map(e => 'C4: ' + e));
    await page.close();
  }

  /* ==================== C6 两个角色 ==================== */
  {
    const { page, errors, step, clickLogic, recordFrame } = await H.newPage(browser);
    L.w('\n=== C6 两个角色：钱钱 Fuzzy（冲刺）/ 涂涂 Doodle（滑翔）===');

    const chars = await page.evaluate(() => {
      const C = window.__fsr.CHARACTERS;
      return Object.keys(C).map(k => ({ id: C[k].id, name: C[k].name, en: C[k].enName, skill: C[k].skill, maxJumps: k === 'owl' ? 2 : 1 }));
    });
    L.w('  角色表: ' + JSON.stringify(chars));
    R.add('C6-a', chars.length === 2 && chars[0].id === 'cat' && chars[1].id === 'owl' &&
      chars[0].en === 'Fuzzy' && chars[1].en === 'Doodle',
      'C6 两个角色存在且为 Fuzzy(猫)/Doodle(猫头鹰)', JSON.stringify(chars));

    // 菜单点卡片选角色
    await page.evaluate(() => { window.__fsr.Game.state = 'menu'; window.__fsr.Game.charId = 'cat'; });
    await step(2);
    await clickLogic(690, 300);            // 第二张卡片（涂涂）
    const c1 = await page.evaluate(() => window.__fsr.Game.charId);
    await clickLogic(298, 300);            // 第一张卡片（钱钱）
    const c2 = await page.evaluate(() => window.__fsr.Game.charId);
    L.w('  点卡片选角色: owl卡片→' + c1 + '  cat卡片→' + c2);
    R.add('C6-b', c1 === 'owl' && c2 === 'cat', 'C6 菜单点卡片可选中两个角色', 'owl→' + c1 + ' cat→' + c2);

    // 钱钱：D 键冲刺
    await page.evaluate(() => { window.__fsr.Game.charId = 'cat'; window.__fsr.startGame(); });
    await step(20);
    await page.keyboard.press('KeyD');
    await step(1);
    const dash = await page.evaluate(() => {
      const p = window.__fsr.getPlayer();
      return { dashing: p.dashing, dashTimer: p.dashTimer, dashCd: p.dashCd, gliding: p.gliding };
    });
    L.w('  钱钱按 D: ' + JSON.stringify(dash));
    R.add('C6-c', dash.dashing === true && dash.dashTimer > 0, 'C6 钱钱冲刺技能可触发', JSON.stringify(dash));

    // 涂涂：长按空格滑翔（需要离地且 vy>0）
    await page.evaluate(() => { window.__fsr.Game.charId = 'owl'; window.__fsr.startGame(); });
    await step(10);
    await page.keyboard.down('Space');
    const glideTrace = [];
    for (let i = 0; i < 40; i++) {
      await step(1);
      const s = await page.evaluate(() => {
        const p = window.__fsr.getPlayer();
        return { g: p.gliding, gr: p.grounded, vy: +p.vy.toFixed(3) };
      });
      glideTrace.push(s.g);
      if (s.g) break;
    }
    await page.keyboard.up('Space');
    const glided = glideTrace.some(Boolean);
    const glideState = await page.evaluate(() => {
      const p = window.__fsr.getPlayer();
      return { gliding: p.gliding, grounded: p.grounded, vy: +p.vy.toFixed(3) };
    });
    L.w('  涂涂长按空格: gliding 采样=' + JSON.stringify(glideTrace.slice(0, 12)) + ' ... 触发=' + glided);
    L.w('  松开后: ' + JSON.stringify(glideState));
    R.add('C6-d', glided, 'C6 涂涂滑翔技能可触发（离地下落中长按）',
      'gliding 采样=' + JSON.stringify(glideTrace.slice(0, 15)));

    // 两个角色都能正常渲染且能结算
    let renderOk = true, detail = [];
    for (const id of ['cat', 'owl']) {
      await page.evaluate((id) => {
        const G = window.__fsr.Game;
        G.state = 'menu'; G.charId = id;
        window.__fsr.startGame();
        window.__fsr.getPlayer().invuln = 1e9;
      }, id);
      await step(30);
      const rec = await recordFrame(null, 1);
      const n = rec.length;
      await page.evaluate(() => window.__fsr.gameOver());
      await step(2);
      const s = await page.evaluate(() => window.__fsr.Game.state);
      detail.push(id + ':draws=' + n + ',gameover=' + s);
      if (n < 100 || s !== 'gameover') renderOk = false;
      await page.evaluate(() => { window.__fsr.Game.state = 'menu'; });
      await step(2);
    }
    L.w('  两角色渲染/结算: ' + JSON.stringify(detail));
    R.add('C6-e', renderOk, 'C6 两个角色都能正常渲染并结算', JSON.stringify(detail));

    const ge = errors.length;
    R.add('C6-f', ge === 0, 'C6 角色流程零错误', 'errors=' + ge + (ge ? ' ' + JSON.stringify(errors) : ''));
    ALLERR = ALLERR.concat(errors.map(e => 'C6: ' + e));
    await page.close();
  }

  /* ==================== C9 触屏滑铲手势 ==================== */
  {
    // 9a 静态源码检查：必须有两个独立的 pointermove 监听，且第一个保留 pointerDown 守卫
    L.w('\n=== C9 触屏滑铲手势未被悬停监听破坏 ===');
    const gameJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
    const moves = gameJs.match(/canvas\.addEventListener\('pointermove'/g) || [];
    const idx = gameJs.indexOf("canvas.addEventListener('pointermove'");
    const firstBlock = gameJs.slice(idx, idx + 400);
    const guard = /if\(!Input\.pointerDown\)\s*return;/.test(firstBlock);
    L.w('  pointermove 监听数量: ' + moves.length + '（期望 2：原生滑铲 + 新增悬停）');
    L.w('  第一个监听保留 `if(!Input.pointerDown) return;` 守卫: ' + guard);
    R.add('C9-a', moves.length === 2 && guard,
      'C9 存在 2 个独立 pointermove 监听，且原滑铲监听的 pointerDown 守卫未被改动',
      'count=' + moves.length + ' guardIntact=' + guard);

    const { page, errors, step, toClient } = await H.newPage(browser);
    await page.evaluate(() => { window.__fsr.setDifficulty('normal'); window.__fsr.startGame(); window.__fsr.getPlayer().invuln = 1e9; });
    await step(20);

    // 9b 负例：只移动不按下，不得触发滑铲
    const p0 = await toClient(300, 200);
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.move(p0.x, p0.y + 100);
    await step(2);
    const neg = await page.evaluate(() => ({ fired: window.__fsr.Input.slideFired, sliding: window.__fsr.getPlayer().sliding }));
    L.w('  未按下时下滑: ' + JSON.stringify(neg));
    R.add('C9-b', neg.fired === false && neg.sliding === false,
      'C9 未按下时 pointermove 不触发滑铲（悬停监听未误触发）', JSON.stringify(neg));

    // 9c 正例：按下后下滑 >34 逻辑像素，应触发滑铲
    const a = await toClient(300, 200);
    const b = await toClient(300, 268);      // 逻辑 +68px
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x, a.y + 30);
    await page.mouse.move(b.x, b.y);
    await step(1);
    const pos = await page.evaluate(() => ({
      fired: window.__fsr.Input.slideFired,
      sliding: window.__fsr.getPlayer().sliding,
      slideTimer: window.__fsr.getPlayer().slideTimer,
      pointerDown: window.__fsr.Input.pointerDown
    }));
    await page.mouse.up();
    L.w('  按下后下滑 68px: ' + JSON.stringify(pos));
    R.add('C9-c', pos.fired === true && pos.sliding === true && pos.slideTimer > 0,
      'C9 按下后下滑仍能触发滑铲（slideFired + player.sliding）', JSON.stringify(pos));

    // 9d 悬停监听在菜单态工作，且不影响游玩态手势
    await page.evaluate(() => { window.__fsr.Game.state = 'menu'; });
    await step(2);
    const hp = await toClient(162, 166);
    await page.mouse.move(hp.x, hp.y);
    await step(1);
    const hov = await page.evaluate(() => ({ hover: window.__fsr.getHover(), cursor: document.querySelector('canvas').style.cursor }));
    L.w('  菜单态悬停难度按钮: ' + JSON.stringify(hov));
    R.add('C9-d', hov.hover === 0 && hov.cursor === 'pointer',
      'C9 菜单态悬停独立生效且光标变 pointer', JSON.stringify(hov));

    const ge = errors.length;
    R.add('C9-e', ge === 0, 'C9 手势流程零错误', 'errors=' + ge + (ge ? ' ' + JSON.stringify(errors) : ''));
    ALLERR = ALLERR.concat(errors.map(e => 'C9: ' + e));
    await page.close();
  }

  await browser.close();
  const s = R.summary();
  L.w('\n================ C 组(2/2)：PASS ' + s.pass + ' / FAIL ' + s.fail + ' / N/A ' + s.na + ' ================');
  R.rows.filter(r => r.status === 'FAIL').forEach(r => L.w('  FAIL ' + r.id + ' ' + r.title + ' | ' + r.detail));
  R.rows.filter(r => r.status === 'N/A').forEach(r => L.w('  N/A  ' + r.id + ' ' + r.title + ' | ' + r.detail));
  L.w('累计全局错误: ' + ALLERR.length + (ALLERR.length ? '\n' + ALLERR.join('\n') : ''));
})().catch(e => { L.w('FATAL ' + e.stack); process.exit(1); });
