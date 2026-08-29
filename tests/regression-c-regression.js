/* =============================================================
 * regression-c-regression.js —— C 组既有功能回归（1/2）
 *   C1 完整往返两轮   C2 三主题循环   C5 昼夜循环
 *   C7 竖屏不黑屏     C8 最高分整数   C10 四档各自开局并结算
 * ============================================================= */
const H = require('./regression-harness');
const L = H.freshLog('regression-c-regression');
const R = H.results();

(async () => {
  const browser = await H.launch();
  let ALLERR = [];

  /* ==================== C1 完整往返两轮 ==================== */
  {
    const { page, errors, step, clickLogic, snap } = await H.newPage(browser);
    L.w('\n=== C1 完整往返两轮：菜单→游戏→结算→再来一局→结算→返回菜单 ===');
    const trace = [];
    const st = () => page.evaluate(() => window.__fsr.Game.state);

    trace.push('init=' + await st());
    await clickLogic(480, 468);                  // 开始跑
    trace.push('clickStart=' + await st());
    await step(120);
    await page.evaluate(() => window.__fsr.gameOver());
    await step(2);
    trace.push('gameOver1=' + await st());
    await snap('regression-c1-gameover1.png');

    await clickLogic(338, 463);                  // 再跑一次
    trace.push('clickAgain=' + await st());
    await step(120);
    await page.evaluate(() => window.__fsr.gameOver());
    await step(2);
    trace.push('gameOver2=' + await st());

    await clickLogic(622, 463);                  // 换个小伙伴 → 菜单
    trace.push('clickHome=' + await st());
    await step(3);
    trace.push('afterMenuFrames=' + await st());

    // 第二轮
    await clickLogic(480, 468);
    trace.push('r2clickStart=' + await st());
    await step(90);
    await page.evaluate(() => window.__fsr.gameOver());
    await step(2);
    trace.push('r2gameOver=' + await st());
    await clickLogic(338, 463);
    trace.push('r2clickAgain=' + await st());
    await step(90);
    await page.evaluate(() => window.__fsr.gameOver());
    await step(2);
    trace.push('r2gameOver2=' + await st());
    await clickLogic(622, 463);
    trace.push('r2clickHome=' + await st());

    L.w('状态轨迹: ' + trace.join(' → '));
    const expect = ['init=menu', 'clickStart=playing', 'gameOver1=gameover', 'clickAgain=playing',
      'gameOver2=gameover', 'clickHome=menu', 'afterMenuFrames=menu',
      'r2clickStart=playing', 'r2gameOver=gameover', 'r2clickAgain=playing',
      'r2gameOver2=gameover', 'r2clickHome=menu'];
    const ok = JSON.stringify(trace) === JSON.stringify(expect);
    R.add('C1', ok, 'C1 两轮完整往返状态机不卡死',
      ok ? trace.join(' → ') : '实际=' + JSON.stringify(trace) + ' 预期=' + JSON.stringify(expect));

    // 键盘 Enter 也应能从菜单开局
    await page.keyboard.press('Enter');
    const s2 = await st();
    await page.evaluate(() => window.__fsr.gameOver());
    await page.evaluate(() => { window.__fsr.Game.state = 'menu'; });
    L.w('菜单按 Enter → ' + s2);
    R.add('C1-b', s2 === 'playing', 'C1 菜单态 Enter 可开局', 'state=' + s2);

    ALLERR = ALLERR.concat(errors.map(e => 'C1: ' + e));
    L.w('C1 错误数: ' + errors.length + (errors.length ? ' ' + JSON.stringify(errors) : ''));
    await page.close();
  }

  /* ==================== C2 三主题循环 ==================== */
  {
    const { page, errors, step, regionStats, snap } = await H.newPage(browser);
    L.w('\n=== C2 三主题循环（森林 / 教室 / 树屋）===');
    await page.evaluate(() => { window.__fsr.setDifficulty('normal'); window.__fsr.startGame(); window.__fsr.getPlayer().invuln = 1e9; });
    await step(30);

    const names = await page.evaluate(() => {
      // THEMES 未导出，靠 currentTheme 渲染标题反查
      const out = [];
      for (let t = 0; t < 3; t++) {
        window.__fsr.Game.themeIndex = t;
        window.__fsr.Game.themeBlend = 0;
        window.__fsr.Game.transitioning = false;
        out.push(t);
      }
      return out;
    });

    const shots = [];
    for (let t = 0; t < 3; t++) {
      await page.evaluate((t) => {
        const G = window.__fsr.Game;
        G.themeIndex = t; G.themeBlend = 0; G.transitioning = false;
        G.time = 750; G.shake = 0;             // 固定昼夜相位，排除亮度干扰
      }, t);
      await step(3);
      const s = await regionStats(60, 20, 900, 240);
      const p = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        const sc = c.width / 960;
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(Math.round(120 * sc), Math.round(60 * sc), 1, 1).data;
        return [d[0], d[1], d[2]];
      });
      shots.push({ t, sky: p, mean: +s.mean.toFixed(2), p95: +s.p95.toFixed(2) });
      await snap('regression-c2-theme' + t + '.png');
    }
    L.w('三主题天空采样: ' + JSON.stringify(shots));

    const distinct = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) > 12;
    const d01 = distinct(shots[0].sky, shots[1].sky);
    const d12 = distinct(shots[1].sky, shots[2].sky);
    const d02 = distinct(shots[0].sky, shots[2].sky);
    L.w('主题两两可区分: 0vs1=' + d01 + ' 1vs2=' + d12 + ' 0vs2=' + d02);
    R.add('C2-a', d01 && d12 && d02, 'C2 三个主题渲染结果两两不同（非同一画面）',
      'sky0=' + shots[0].sky + ' sky1=' + shots[1].sky + ' sky2=' + shots[2].sky);

    // 自然过渡：distance 超过 themeAt 后应依次 0→1→2→0
    const seq = [];
    await page.evaluate(() => {
      const G = window.__fsr.Game;
      G.themeIndex = 0; G.themeBlend = 0; G.transitioning = false;
    });
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { window.__fsr.Game.themeAt = window.__fsr.Game.distance + 5; });
      await step(120);
      seq.push(await page.evaluate(() => window.__fsr.Game.themeIndex));
    }
    L.w('自然过渡序列: 0 → ' + seq.join(' → '));
    R.add('C2-b', JSON.stringify(seq) === '[1,2,0]', 'C2 自然过渡 0→1→2→0 循环正常',
      'seq=0→' + seq.join('→'));

    const ge = errors.length;
    L.w('C2 错误数: ' + ge + (ge ? ' ' + JSON.stringify(errors) : ''));
    R.add('C2-c', ge === 0, 'C2 三主题渲染/过渡零错误', 'errors=' + ge);
    ALLERR = ALLERR.concat(errors.map(e => 'C2: ' + e));
    await page.close();
  }

  /* ==================== C5 昼夜循环 ==================== */
  {
    const { page, errors, step, regionStats, snap } = await H.newPage(browser);
    L.w('\n=== C5 昼夜循环（白天亮度应比夜晚高 30% 以上）===');
    await page.evaluate(() => {
      window.__fsr.setDifficulty('normal'); window.__fsr.startGame();
      window.__fsr.getPlayer().invuln = 1e9;
    });
    await step(20);

    async function at(time) {
      await page.evaluate((t) => {
        const G = window.__fsr.Game;
        G.time = t; G.shake = 0; G.themeIndex = 0; G.themeBlend = 0; G.transitioning = false;
      }, time);
      await step(2);
      const s = await regionStats(60, 20, 760, 200);   // 天空带，避开太阳/月亮(840,78)
      return s;
    }
    const day = await at(750);      // cycle=0.25 纯白天
    await snap('regression-c5-day.png');
    const night = await at(2100);   // cycle=0.70 夜最深
    await snap('regression-c5-night.png');
    const ratio = day.mean / night.mean;
    L.w('白天 mean=' + day.mean.toFixed(2) + ' (p95=' + day.p95.toFixed(1) + ')');
    L.w('夜晚 mean=' + night.mean.toFixed(2) + ' (p95=' + night.p95.toFixed(1) + ')');
    L.w('白天/夜晚 = ' + ratio.toFixed(3) + ' （要求 ≥ 1.30）');
    R.add('C5', ratio >= 1.30, 'C5 白天天空亮度 ≥ 夜晚 1.30 倍',
      'day.mean=' + day.mean.toFixed(2) + ' night.mean=' + night.mean.toFixed(2) + ' ratio=' + ratio.toFixed(3));

    const ge = errors.length;
    R.add('C5-b', ge === 0, 'C5 昼夜推进零错误', 'errors=' + ge);
    ALLERR = ALLERR.concat(errors.map(e => 'C5: ' + e));
    await page.close();
  }

  /* ==================== C7 竖屏不黑屏 ==================== */
  {
    const { page, errors, step, snap } = await H.newPage(browser, { viewport: { width: 390, height: 844, deviceScaleFactor: 1 } });
    L.w('\n=== C7 竖屏 390×844 不黑屏 ===');
    await step(6);
    const info = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, black = 0, n = c.width * c.height;
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += L;
        if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) black++;
      }
      const r = c.getBoundingClientRect();
      return {
        canvasW: c.width, canvasH: c.height,
        cssW: Math.round(r.width), cssH: Math.round(r.height),
        mean: sum / n, blackRatio: black / n
      };
    });
    L.w('竖屏画布: ' + JSON.stringify(info));
    await snap('regression-c7-portrait.png');

    const ok = info.mean > 10 && info.blackRatio < 0.5 && info.canvasW > 100 && info.canvasH > 50;
    R.add('C7', ok, 'C7 竖屏 390×844 画面非全黑（历史回归项）',
      'canvas=' + info.canvasW + 'x' + info.canvasH + ' mean=' + info.mean.toFixed(2) +
      ' blackRatio=' + (info.blackRatio * 100).toFixed(2) + '%');

    // 竖屏下也进游戏跑一段，确认不黑屏
    await page.evaluate(() => { window.__fsr.setDifficulty('easy'); window.__fsr.startGame(); window.__fsr.getPlayer().invuln = 1e9; });
    await step(40);
    const info2 = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0, black = 0, n = c.width * c.height;
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += L; if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) black++;
      }
      return { mean: sum / n, blackRatio: black / n };
    });
    L.w('竖屏游玩中: ' + JSON.stringify(info2));
    await snap('regression-c7-portrait-playing.png');
    R.add('C7-b', info2.mean > 10 && info2.blackRatio < 0.5, 'C7 竖屏游玩中画面非全黑',
      'mean=' + info2.mean.toFixed(2) + ' blackRatio=' + (info2.blackRatio * 100).toFixed(2) + '%');

    const ge = errors.length;
    R.add('C7-c', ge === 0, 'C7 竖屏零错误', 'errors=' + ge + (ge ? ' ' + JSON.stringify(errors) : ''));
    ALLERR = ALLERR.concat(errors.map(e => 'C7: ' + e));
    await page.close();
  }

  /* ==================== C8 最高分整数 ==================== */
  {
    const { page, errors, step, recordFrame } = await H.newPage(browser, { seedStorage: { fsr_best: '0', fsr_diff: 'normal' } });
    L.w('\n=== C8 最高分必须是整数，结算页无小数 ===');
    await page.evaluate(() => {
      window.__fsr.setDifficulty('normal'); window.__fsr.startGame();
      window.__fsr.getPlayer().invuln = 1e9;
    });
    await step(30);
    await page.evaluate(() => { window.__fsr.Game.score = 1234.78; window.__fsr.gameOver(); });
    const best = await page.evaluate(() => ({
      ls: localStorage.getItem('fsr_best'),
      best: window.__fsr.Game.best,
      state: window.__fsr.Game.state
    }));
    L.w('score=1234.78 → ' + JSON.stringify(best));
    const isInt = /^\d+$/.test(String(best.ls)) && Number.isInteger(best.best) && best.best === 1234;
    R.add('C8-a', isInt, 'C8 fsr_best 存整数且等于 floor(score)',
      'ls=' + JSON.stringify(best.ls) + ' Game.best=' + best.best);

    // 结算页渲染：总得分行必须是 '1234' 而不是 '1234.78'
    const rec = await recordFrame(null, 1);
    const texts = rec.filter(i => i.kind === 'fillText').map(i => i.text);
    L.w('结算页文本: ' + JSON.stringify(texts.filter(t => /\d/.test(t))));
    const hasInt = texts.indexOf('1234') >= 0;
    const hasDec = texts.some(t => t.indexOf('.') >= 0 && /^\d+\.\d/.test(t));
    R.add('C8-b', hasInt && !hasDec, 'C8 结算页总得分渲染为整数（无小数）',
      '渲染含 "1234"=' + hasInt + ' 含小数文本=' + hasDec + ' 数字文本=' + JSON.stringify(texts.filter(t => /^\d/.test(t))));

    // HUD 分数也必须是整数（注意每帧 addScore(move*0.036) 会继续累加，
    // 故不能断言具体数值，只能断言"渲染值 === floor(渲染时的 score) 且无小数"）
    await page.evaluate(() => { window.__fsr.startGame(); window.__fsr.getPlayer().invuln = 1e9; });
    await step(5);
    await page.evaluate(() => { window.__fsr.Game.score = 55.9; });
    const rec2 = await recordFrame(null, 1);
    const scoreAfter = await page.evaluate(() => window.__fsr.Game.score);
    const t2 = rec2.filter(i => i.kind === 'fillText').map(i => i.text);
    const hudScore = t2[0];
    const expectTxt = String(Math.floor(scoreAfter));
    L.w('HUD 文本: ' + JSON.stringify(t2.slice(0, 6)) + '  score(渲染时)=' + scoreAfter + '  预期文本=' + expectTxt);
    R.add('C8-c', /^\d+$/.test(hudScore) && hudScore === expectTxt,
      'C8 HUD 分数渲染为 floor(score) 整数（无小数）',
      '渲染="' + hudScore + '" 预期="' + expectTxt + '" score=' + scoreAfter + ' 全部文本=' + JSON.stringify(t2.slice(0, 6)));

    const ge = errors.length;
    R.add('C8-d', ge === 0, 'C8 最高分流程零错误', 'errors=' + ge);
    ALLERR = ALLERR.concat(errors.map(e => 'C8: ' + e));
    await page.close();
  }

  /* ==================== C10 四档各自开局并结算 ==================== */
  {
    const { page, errors, step, recordFrame, snap, regionStats } = await H.newPage(browser);
    L.w('\n=== C10 四档各自正常开局并结算，结算页显示难度 ===');
    const out = {};
    for (const id of ['easy', 'normal', 'hard', 'nightmare']) {
      await page.evaluate((id) => {
        const f = window.__fsr, G = f.Game;
        G.state = 'menu';
        f.setDifficulty(id);
        f.startGame();
        f.getPlayer().invuln = 1e9;
      }, id);
      await step(90);
      const mid = await page.evaluate(() => ({ dist: window.__fsr.Game.distance, lives: window.__fsr.Game.lives, state: window.__fsr.Game.state }));
      await page.evaluate(() => window.__fsr.gameOver());
      await step(2);
      const rec = await recordFrame(null, 1);
      const texts = rec.filter(i => i.kind === 'fillText').map(i => i.text);
      const diffLine = texts.find(t => t.indexOf('难 度') === 0);
      // 结算面板非空白
      const s = await regionStats(250, 140, 710, 390);
      out[id] = { mid, state: await page.evaluate(() => window.__fsr.Game.state), diffLine, panelMean: +s.mean.toFixed(1) };
      await snap('regression-c10-' + id + '.png');
      L.w('  ' + id.padEnd(10) + ' ' + JSON.stringify(out[id]));
      // 回菜单准备下一档
      await page.evaluate(() => { window.__fsr.Game.state = 'menu'; });
      await step(2);
    }
    const allOk = ['easy', 'normal', 'hard', 'nightmare'].every(id => out[id].state === 'gameover' && out[id].diffLine);
    const names = { easy: '简 单', normal: '普 通', hard: '困 难', nightmare: '噩 梦' };
    const nameOk = ['easy', 'normal', 'hard', 'nightmare'].every(id => out[id].diffLine === '难 度 · ' + names[id]);
    const panelOk = ['easy', 'normal', 'hard', 'nightmare'].every(id => out[id].panelMean > 120);
    L.w('四档结算页难度行: ' + JSON.stringify(['easy', 'normal', 'hard', 'nightmare'].map(id => out[id].diffLine)));
    R.add('C10-a', allOk, 'C10 四档都能开局并进入结算页', JSON.stringify(out, null, 0));
    R.add('C10-b', nameOk, 'C10 结算页难度文案与档位一致',
      JSON.stringify(['easy', 'normal', 'hard', 'nightmare'].map(id => id + '=' + out[id].diffLine)));
    R.add('C10-c', panelOk, 'C10 结算面板正常渲染（非空白）',
      JSON.stringify(['easy', 'normal', 'hard', 'nightmare'].map(id => id + '=' + out[id].panelMean)));

    const ge = errors.length;
    R.add('C10-d', ge === 0, 'C10 四档开局/结算零错误', 'errors=' + ge + (ge ? ' ' + JSON.stringify(errors) : ''));
    ALLERR = ALLERR.concat(errors.map(e => 'C10: ' + e));
    await page.close();
  }

  await browser.close();
  const s = R.summary();
  L.w('\n================ C 组(1/2)：PASS ' + s.pass + ' / FAIL ' + s.fail + ' / N/A ' + s.na + ' ================');
  R.rows.filter(r => r.status === 'FAIL').forEach(r => L.w('  FAIL ' + r.id + ' ' + r.title + ' | ' + r.detail));
  L.w('累计全局错误: ' + ALLERR.length + (ALLERR.length ? '\n' + ALLERR.join('\n') : ''));
})().catch(e => { L.w('FATAL ' + e.stack); process.exit(1); });
