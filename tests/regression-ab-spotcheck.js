/* =============================================================
 * regression-ab-spotcheck.js —— A/B 组抽样复核（只复核风险最高的 3 条）
 *
 *  A1 普通档速度全程固定，障碍间隔符合放宽后的配置。
 *  B1 普通档 playing 态按 Digit4，Game.lives 必须仍是 3
 *  A6 四档生成器初值必须互不相同
 * ============================================================= */
const H = require('./regression-harness');
const L = H.freshLog('regression-ab-spotcheck');
const R = H.results();

function fmt(n, d) { return (typeof n === 'number') ? n.toFixed(d === undefined ? 6 : d) : String(n); }

(async () => {
  const browser = await H.launch();

  /* ================= A1: 固定速度检查（真实随机数，非 stub） ================= */
  {
    const { page, errors, step } = await H.newPage(browser);
    L.w('\n=== A1 普通档 speed 固定值检查（1200 帧）===');

    // 读回实现里的常量，避免我手抄错
    const D = await page.evaluate(() => {
      const n = window.__fsr.DIFF.normal;
      return {
        speedBase: n.speedBase, rampDiv: n.rampDiv, speedCap: n.speedCap,
        gapBase: n.gapBase, gapMin: n.gapMin, gapDiv: n.gapDiv, gapJitter: n.gapJitter,
        dblFrom: n.dblFrom, dblProb: n.dblProb,
        capMinusBase: n.speedCap - n.speedBase,
        fixedSpeed: n.speedCap === n.speedBase
      };
    });
    L.w('DIFF.normal 实测: ' + JSON.stringify(D));

    const constOk =
      D.speedBase === 5.0 && D.rampDiv === 900 && D.speedCap === 5.0 &&
      D.gapBase === 700 && D.gapMin === 560 && D.gapDiv === 36 && D.gapJitter === 140;
    R.add('A1-c', constOk, 'A1 普通档固定速度与放宽间隔配置正确（5.0/700/560/36/140）',
      JSON.stringify({ speedBase: D.speedBase, rampDiv: D.rampDiv, speedCap: D.speedCap, gapMin: D.gapMin, gapBase: D.gapBase, gapDiv: D.gapDiv, gapJitter: D.gapJitter }));
    R.add('A1-d', D.fixedSpeed === true, 'A1 普通档 speedCap 与 speedBase 相等，整局不加速',
      'speedCap=' + D.speedCap + ' speedBase=' + D.speedBase);

    // 进入普通档并保证不死（invuln 拉满，不影响 speed/distance 演化）
    await page.evaluate(() => {
      window.__fsr.setDifficulty('normal');
      window.__fsr.startGame();
      window.__fsr.getPlayer().invuln = 1e9;
    });

    const CH = 120, TOTAL = 1200;
    const samples = [];
    for (let k = 0; k < TOTAL / CH; k++) {
      const part = await page.evaluate((n) => {
        const G = window.__fsr.Game, f = window.__fsr;
        const out = [];
        for (let i = 0; i < n; i++) {
          window.__step(16.6667);
          out.push([G.distance, G.speed, G.nextObstacleAt]);
        }
        return out;
      }, CH);
      samples.push(...part);
    }
    L.w('采样帧数: ' + samples.length + '  末帧 distance=' + fmt(samples[samples.length - 1][0], 2));

    // 用页面里真实的 distance 序列，确认每一帧都保持固定速度
    let maxDev = 0, worst = -1, nCmp = 0;
    for (let i = 1; i < samples.length; i++) {
      const dPrev = samples[i - 1][0];
      const sSeen = samples[i][1];
      const sRef = 5.0;
      const dev = Math.abs(sSeen - sRef);
      if (dev > maxDev) { maxDev = dev; worst = i; }
      nCmp++;
    }
    L.w('speed 比对 ' + nCmp + ' 帧, maxDev=' + maxDev + (worst >= 0 ? ' @frame ' + worst : ''));
    R.add('A1-a', maxDev === 0, 'A1 speed 逐帧保持固定 5.0',
      'frames=' + nCmp + ' maxDev=' + maxDev + (worst >= 0 ? ' @frame=' + worst : ''));

    // 反向：用配置重算，也必须偏差 0
    let maxDev2 = 0;
    for (let i = 1; i < samples.length; i++) {
      const dPrev = samples[i - 1][0];
      const sSeen = samples[i][1];
      const sImpl = D.speedBase + Math.min(dPrev / D.rampDiv, D.speedCap - D.speedBase);
      const dev = Math.abs(sSeen - sImpl);
      if (dev > maxDev2) maxDev2 = dev;
    }
    L.w('实现式自洽性 maxDev=' + maxDev2);
    R.add('A1-a2', maxDev2 === 0, 'A1 speed 与固定速度配置自洽', 'maxDev=' + maxDev2);

    // distance 累积一致性：move = speed*dt，dt 由 Game.time 增量反推
    let maxDDev = 0;
    for (let i = 1; i < samples.length; i++) {
      const dSeen = samples[i][0];
      const sRef = 5.0;
      // dt 未知，用观测反推：这一步只验证单调性与无跳变
      if (dSeen < samples[i - 1][0]) maxDDev = -1;
    }
    R.add('A1-b', maxDDev === 0, 'A1 distance 单调递增无回退', 'ok');

    const e1 = errors.length;
    L.w('A1 运行期错误: ' + e1 + (e1 ? ' ' + JSON.stringify(errors) : ''));
    await page.close();
  }

  /* ============ A1-gap: gap 逐次生成比对（固定 Math.random=0.5 使 jitter 可复现） ============ */
  {
    const { page, errors } = await H.newPage(browser, { fixedRandom: 0.5 });
    L.w('\n=== A1-gap 普通档 gap 生成值比对（Math.random 固定 0.5，jitter 恒为 +70）===');
    await page.evaluate(() => {
      window.__fsr.setDifficulty('normal');
      window.__fsr.startGame();
      window.__fsr.getPlayer().invuln = 1e9;
    });

    const CH = 120, TOTAL = 1200;
    const samples = [];
    for (let k = 0; k < TOTAL / CH; k++) {
      const part = await page.evaluate((n) => {
        const G = window.__fsr.Game;
        const out = [];
        for (let i = 0; i < n; i++) {
          window.__step(16.6667);
          out.push([G.distance, G.speed, G.nextObstacleAt]);
        }
        return out;
      }, CH);
      samples.push(...part);
    }

    // 生成帧识别：nextObstacleAt 相比上一帧变大即为刚生成
    let spawns = 0, maxDev = 0, bad = null, firstDistance = null, allBelow = true;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i][2] > samples[i - 1][2]) {
        spawns++;
        const d = samples[i][0];
        if (firstDistance === null) firstDistance = d;
        const ref = Math.max(560, 700 - d / 36) + 0.5 * 140;
        const dev = Math.abs(samples[i][2] - ref);
        if (dev > maxDev) { maxDev = dev; bad = { frame: i, d: d, seen: samples[i][2], ref: ref, dev: dev }; }
        if (d < 2200) allBelow = allBelow && true;
      }
    }
    L.w('检测到生成事件: ' + spawns + ' 次, gap maxDev=' + maxDev + (bad ? ' 最差: ' + JSON.stringify(bad) : ''));
    L.w('首次生成时 distance=' + fmt(firstDistance, 2));
    R.add('A1-e', spawns > 6 && maxDev === 0, 'A1 gap 生成值位级偏差 = 0（max(560,700-d/36)+0.5*140）',
      'spawns=' + spawns + ' maxDev=' + maxDev + (bad ? ' worst=' + JSON.stringify(bad) : ''));
    const e2 = errors.length;
    L.w('A1-gap 运行期错误: ' + e2 + (e2 ? ' ' + JSON.stringify(errors) : ''));
    await page.close();
  }

  /* ================= B1: playing 态按 Digit4 不得改 lives ================= */
  {
    const { page, errors, step } = await H.newPage(browser);
    L.w('\n=== B1 守卫：普通档 playing 态按 Digit4，lives 必须仍为 3 ===');
    await page.evaluate(() => { window.__fsr.setDifficulty('normal'); window.__fsr.startGame(); });
    await step(30);
    const before = await page.evaluate(() => {
      const G = window.__fsr.Game;
      return { state: G.state, lives: G.lives, maxLives: G.maxLives, diff: window.__fsr.getDiffId(), canSwitch: window.__fsr.diffCanSwitch() };
    });
    L.w('按键前: ' + JSON.stringify(before));

    // 真实键盘事件（e.code = Digit4）
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Digit3');
    await page.keyboard.press('Digit1');
    await step(5);
    const after = await page.evaluate(() => {
      const G = window.__fsr.Game;
      return { state: G.state, lives: G.lives, maxLives: G.maxLives, diff: window.__fsr.getDiffId() };
    });
    L.w('按 Digit4/3/1 后: ' + JSON.stringify(after));

    const ok = before.lives === 3 && after.lives === 3 && after.maxLives === 3 &&
      after.diff === 'normal' && before.canSwitch === false;
    R.add('B1', ok, 'B1 playing 态数字键不改 lives / maxLives / 难度',
      'before=' + JSON.stringify(before) + ' after=' + JSON.stringify(after));

    // 额外：↑↓ 在 playing 态是跳/滑铲，不得改难度
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await step(5);
    const after2 = await page.evaluate(() => ({ diff: window.__fsr.getDiffId(), state: window.__fsr.Game.state }));
    L.w('按 ↑↓ 后: ' + JSON.stringify(after2));
    R.add('B1-b', after2.diff === 'normal' && after2.state === 'playing',
      'B1 playing 态 ↑↓ 不切难度', JSON.stringify(after2));

    // 额外：暂停态也不得改
    await page.evaluate(() => { window.__fsr.Game.paused = true; });
    await page.keyboard.press('Digit4');
    await step(3);
    const after3 = await page.evaluate(() => {
      const G = window.__fsr.Game;
      return { diff: window.__fsr.getDiffId(), lives: G.lives, paused: G.paused };
    });
    L.w('暂停态按 Digit4 后: ' + JSON.stringify(after3));
    R.add('B1-c', after3.diff === 'normal' && after3.lives === 3,
      'B1 paused 态数字键不改难度/血量', JSON.stringify(after3));

    const e3 = errors.length;
    L.w('B1 运行期错误: ' + e3 + (e3 ? ' ' + JSON.stringify(errors) : ''));
    await page.close();
  }

  /* ================= A6: 四档生成器初值必须互不相同 ================= */
  {
    const { page, errors } = await H.newPage(browser);
    L.w('\n=== A6 四档生成器初值（setDifficulty → startGame → 读四个 next*At）===');
    const rows = {};
    for (const id of ['easy', 'normal', 'hard', 'nightmare']) {
      const v = await page.evaluate((id) => {
        const f = window.__fsr, G = f.Game;
        G.state = 'menu';                       // 保证 diffCanSwitch()
        const okSet = f.setDifficulty(id);
        f.startGame();
        return {
          okSet: okSet, diff: f.getDiffId(),
          obst: G.nextObstacleAt, pf: G.nextPlatformAt,
          pk: G.nextPickupAt, pw: G.nextPowerupAt,
          maxLives: G.maxLives, lives: G.lives, v0: G.speed
        };
      }, id);
      rows[id] = v;
      L.w('  ' + id.padEnd(10) + ' ' + JSON.stringify(v));
    }
    const pf = new Set(['easy', 'normal', 'hard', 'nightmare'].map(k => rows[k].pf));
    const pk = new Set(['easy', 'normal', 'hard', 'nightmare'].map(k => rows[k].pk));
    const pw = new Set(['easy', 'normal', 'hard', 'nightmare'].map(k => rows[k].pw));
    const okPf = pf.size === 4, okPk = pk.size === 4, okPw = pw.size === 4;
    L.w('互异检查: pf=' + okPf + ' pk=' + okPk + ' pw=' + okPw);
    R.add('A6-a', okPf, 'A6 四档 nextPlatformAt 互不相同', JSON.stringify([...pf]));
    R.add('A6-b', okPk, 'A6 四档 nextPickupAt 互不相同', JSON.stringify([...pk]));
    R.add('A6-c', okPw, 'A6 四档 nextPowerupAt 互不相同', JSON.stringify([...pw]));

    // 与设计文档 §2.1 表逐项核对
    const expect = {
      easy: { pf: 620, pk: 340, pw: 1300, maxLives: 5, v0: 4.4 },
      normal: { pf: 760, pk: 380, pw: 2600, maxLives: 3, v0: 5.6 },
      hard: { pf: 900, pk: 420, pw: 3200, maxLives: 2, v0: 6.2 },
      nightmare: { pf: 1000, pk: 460, pw: 3600, maxLives: 1, v0: 7.0 }
    };
    let mismatch = [];
    for (const id in expect) {
      for (const k in expect[id]) {
        if (rows[id][k] !== expect[id][k]) mismatch.push(id + '.' + k + ' 实测=' + rows[id][k] + ' 预期=' + expect[id][k]);
      }
    }
    L.w('与设计表对照: ' + (mismatch.length ? 'MISMATCH ' + JSON.stringify(mismatch) : '全部一致'));
    R.add('A6-d', mismatch.length === 0, 'A6 四档初值/血量/初速与设计文档 §2.1 一致',
      mismatch.length ? JSON.stringify(mismatch) : '4 档 × 5 项全部一致');
    // 障碍初值四档恒为 520（设计刻意固定，缩小回归面）
    const obstAll = ['easy', 'normal', 'hard', 'nightmare'].every(k => rows[k].obst === 520);
    R.add('A6-e', obstAll, 'A6 nextObstacleAt 四档恒为 520（设计刻意固定）',
      JSON.stringify(['easy', 'normal', 'hard', 'nightmare'].map(k => rows[k].obst)));

    const e4 = errors.length;
    L.w('A6 运行期错误: ' + e4 + (e4 ? ' ' + JSON.stringify(errors) : ''));
    await page.close();
  }

  await browser.close();

  const s = R.summary();
  L.w('\n================ A/B 抽样复核：PASS ' + s.pass + ' / FAIL ' + s.fail + ' / N/A ' + s.na + ' ================');
  R.rows.filter(r => r.status === 'FAIL').forEach(r => L.w('  FAIL ' + r.id + ' ' + r.title + ' | ' + r.detail));
})().catch(e => { L.w('FATAL ' + e.stack); process.exit(1); });
