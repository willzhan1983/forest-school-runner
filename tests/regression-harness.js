/* =============================================================
 * regression-harness.js —— DIFF-003B 独立回归验证 公共脚手架
 *
 * 设计要点（针对上一个 QA 的 Puppeteer 超时教训）：
 *  1) protocolTimeout: 600000（10 分钟）
 *  2) 用 evaluateOnNewDocument 劫持 requestAnimationFrame，
 *     把时间推进权交给 Node：window.__step(dtMs) 每次只跑 1 帧。
 *     => 单次 page.evaluate 只跑 CHUNK 帧（默认 30），绝不会超时。
 *  3) 可选：劫持 CanvasRenderingContext2D 记录所有绘制调用的
 *     逻辑坐标包围盒，用于 D 组布局的程序化验证（不靠肉眼看图）。
 *  4) 全程监听 pageerror / console.error / requestfailed。
 * ============================================================= */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = __dirname;
const FILE_URL = 'file://' + path.resolve(DIR, '..', 'index.html');

const LOGIC_W = 960, LOGIC_H = 540;

function log(name) {
  const f = path.join(DIR, name + '.log');
  const t0 = Date.now();
  return {
    f,
    w(line) {
      const s = (typeof line === 'string') ? line : JSON.stringify(line);
      fs.appendFileSync(f, s + '\n');
      console.log(s);
    },
    sec() { return ((Date.now() - t0) / 1000).toFixed(1) + 's'; }
  };
}

function freshLog(name) {
  const f = path.join(DIR, name + '.log');
  try { fs.unlinkSync(f); } catch (e) { }
  return log(name);
}

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--force-device-scale-factor=1'
    ]
  });
}

/* ---- 在页面里安装：① rAF 步进器 ② 绘制记录仪 ③ 可选 Math.random 固定值 ---- */
const INSTALL = function (opts) {
  /* ① rAF 步进器 */
  window.__raf = { cbs: [], t: 0 };
  window.requestAnimationFrame = function (cb) { window.__raf.cbs.push(cb); return window.__raf.cbs.length; };
  window.cancelAnimationFrame = function () { };
  window.__step = function (dtMs) {
    var list = window.__raf.cbs.splice(0, window.__raf.cbs.length);
    window.__raf.t += (dtMs === undefined ? 16.6667 : dtMs);
    for (var i = 0; i < list.length; i++) list[i](window.__raf.t);
  };

  /* ② 绘制记录仪 */
  window.__rec = { on: false, items: [] };
  var P = CanvasRenderingContext2D.prototype;
  var orig = {};
  function wrap(name, fn) {
    if (typeof P[name] !== 'function') return;
    orig[name] = P[name];
    P[name] = fn;
  }
  function acc(ctx, x, y) {
    if (!window.__rec.on) return;
    var m = ctx.getTransform();
    var dx = m.a * x + m.c * y + m.e;
    var dy = m.b * x + m.d * y + m.f;
    var bb = ctx.__bb;
    if (!bb) { ctx.__bb = { x0: dx, y0: dy, x1: dx, y1: dy }; return; }
    if (dx < bb.x0) bb.x0 = dx; if (dx > bb.x1) bb.x1 = dx;
    if (dy < bb.y0) bb.y0 = dy; if (dy > bb.y1) bb.y1 = dy;
  }
  function toLogic(ctx, bb) {
    var s = ctx.canvas.width / 960;
    return { x0: bb.x0 / s, y0: bb.y0 / s, x1: bb.x1 / s, y1: bb.y1 / s };
  }
  function emit(ctx, kind, extra, ownBB) {
    var bb = ownBB || ctx.__bb;
    if (!window.__rec.on || !bb) return;
    var L = toLogic(ctx, bb);
    var it = {
      kind: kind, x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1,
      fill: String(ctx.fillStyle || ''), stroke: String(ctx.strokeStyle || ''),
      alpha: +ctx.globalAlpha.toFixed(3), font: String(ctx.font || ''),
      align: String(ctx.textAlign || ''), baseline: String(ctx.textBaseline || ''),
      lw: ctx.lineWidth
    };
    if (extra) for (var k in extra) it[k] = extra[k];
    window.__rec.items.push(it);
  }
  /* 文字：独立计算包围盒，不污染当前路径 bbox */
  function emitText(ctx, kind, text, x, y) {
    if (!window.__rec.on) return;
    var w = 0;
    try { w = ctx.measureText(String(text)).width; } catch (e) { }
    var fs2 = parseFloat((String(ctx.font).match(/(\d+(\.\d+)?)px/) || [0, 12])[1]) || 12;
    var left = x, right = x + w;
    if (ctx.textAlign === 'center') { left = x - w / 2; right = x + w / 2; }
    else if (ctx.textAlign === 'right' || ctx.textAlign === 'end') { left = x - w; right = x; }
    var asc = fs2 * 0.82, desc = fs2 * 0.24;
    if (ctx.textBaseline === 'middle') { asc = fs2 * 0.56; desc = fs2 * 0.56; }
    else if (ctx.textBaseline === 'top') { asc = 0; desc = fs2 * 1.04; }
    var m = ctx.getTransform();
    function tp(px, py) { return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f }; }
    var a = tp(left, y - asc), b = tp(right, y + desc);
    emit(ctx, kind, { text: String(text), w: w, fs: fs2 },
      { x0: a.x, y0: a.y, x1: b.x, y1: b.y });
  }
  wrap('beginPath', function () { this.__bb = null; return orig.beginPath.apply(this, arguments); });
  wrap('moveTo', function (x, y) { acc(this, x, y); return orig.moveTo.apply(this, arguments); });
  wrap('lineTo', function (x, y) { acc(this, x, y); return orig.lineTo.apply(this, arguments); });
  wrap('quadraticCurveTo', function (cx, cy, x, y) { acc(this, cx, cy); acc(this, x, y); return orig.quadraticCurveTo.apply(this, arguments); });
  wrap('bezierCurveTo', function (a, b, c, d, x, y) { acc(this, a, b); acc(this, c, d); acc(this, x, y); return orig.bezierCurveTo.apply(this, arguments); });
  wrap('arcTo', function (x1, y1, x2, y2) { acc(this, x1, y1); acc(this, x2, y2); return orig.arcTo.apply(this, arguments); });
  wrap('arc', function (x, y, r) { acc(this, x - r, y - r); acc(this, x + r, y + r); return orig.arc.apply(this, arguments); });
  wrap('ellipse', function (x, y, rx, ry) { acc(this, x - rx, y - ry); acc(this, x + rx, y + ry); return orig.ellipse.apply(this, arguments); });
  wrap('rect', function (x, y, w, h) { acc(this, x, y); acc(this, x + w, y + h); return orig.rect.apply(this, arguments); });
  wrap('fillRect', function (x, y, w, h) { acc(this, x, y); acc(this, x + w, y + h); emit(this, 'fillRect'); return orig.fillRect.apply(this, arguments); });
  wrap('strokeRect', function (x, y, w, h) { acc(this, x, y); acc(this, x + w, y + h); emit(this, 'strokeRect'); return orig.strokeRect.apply(this, arguments); });
  wrap('fill', function () { emit(this, 'fill'); return orig.fill.apply(this, arguments); });
  wrap('stroke', function () { emit(this, 'stroke'); return orig.stroke.apply(this, arguments); });
  wrap('fillText', function (t, x, y) {
    emitText(this, 'fillText', t, x, y);
    return orig.fillText.apply(this, arguments);
  });
  wrap('strokeText', function (t, x, y) {
    emitText(this, 'strokeText', t, x, y);
    return orig.strokeText.apply(this, arguments);
  });

  /* ③ 可选：固定 Math.random */
  if (opts && opts.fixedRandom !== null && opts.fixedRandom !== undefined) {
    var v = opts.fixedRandom;
    Math.random = function () { return v; };
  }
};

async function newPage(browser, opts) {
  opts = opts || {};
  const page = await browser.newPage();
  await page.setViewport(opts.viewport || { width: 1200, height: 800, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push('pageerror: ' + (e && e.message)); });
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
    else if (m.type() === 'warning' && /Uncaught/.test(m.text())) errors.push('console.warn: ' + m.text());
  });
  page.on('requestfailed', r => { errors.push('requestfailed: ' + r.url()); });

  if (opts.seedStorage) {
    await page.evaluateOnNewDocument((seed) => {
      try { for (var k in seed) localStorage.setItem(k, seed[k]); } catch (e) { }
    }, opts.seedStorage);
  }
  await page.evaluateOnNewDocument(INSTALL, { fixedRandom: (opts.fixedRandom === undefined ? null : opts.fixedRandom) });
  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__fsr, { timeout: 30000 });

  /* 步进器：分块，保证单次 evaluate 远小于 10s */
  const step = async function (frames, dtMs) {
    const CHUNK = opts.chunk || 30;
    dtMs = (dtMs === undefined) ? 16.6667 : dtMs;
    let left = frames;
    while (left > 0) {
      const n = Math.min(CHUNK, left);
      await page.evaluate((n, dt) => { for (let i = 0; i < n; i++) window.__step(dt); }, n, dtMs);
      left -= n;
    }
  };

  /* 逻辑坐标 -> 视口 CSS 坐标（用于真实鼠标/触摸事件） */
  const toClient = async function (lx, ly) {
    return page.evaluate((lx, ly) => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { x: r.left + lx * (r.width / 960), y: r.top + ly * (r.height / 540) };
    }, lx, ly);
  };

  /* 在指定逻辑坐标做一次真实点击（pointerdown+pointerup） */
  const clickLogic = async function (lx, ly) {
    const p = await toClient(lx, ly);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
  };

  /* 读取画布像素（逻辑坐标 -> 设备像素） */
  const pixel = async function (lx, ly) {
    return page.evaluate((lx, ly) => {
      const c = document.querySelector('canvas');
      const s = c.width / 960;
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(Math.round(lx * s), Math.round(ly * s), 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    }, lx, ly);
  };

  /* 区域平均亮度（0..255）与"有内容像素"比例 */
  const regionStats = async function (x0, y0, x1, y1) {
    return page.evaluate((x0, y0, x1, y1) => {
      const c = document.querySelector('canvas');
      const s = c.width / 960;
      const ctx = c.getContext('2d');
      const px = Math.max(1, Math.round((x1 - x0) * s));
      const py = Math.max(1, Math.round((y1 - y0) * s));
      const d = ctx.getImageData(Math.round(x0 * s), Math.round(y0 * s), px, py).data;
      let sum = 0, n = px * py, black = 0;
      const lum = [];
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        lum.push(L); sum += L;
        if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) black++;
      }
      lum.sort((a, b) => a - b);
      return {
        n: n, mean: sum / n, blackRatio: black / n,
        p05: lum[Math.floor(n * 0.05)], p50: lum[Math.floor(n * 0.5)], p95: lum[Math.floor(n * 0.95)],
        max: lum[n - 1], min: lum[0]
      };
    }, x0, y0, x1, y1);
  };

  /* 采集绘制记录：先清空 -> 跑 n 帧（只记录最后一帧） -> 取回 */
  const recordFrame = async function (setupFn, frames) {
    await page.evaluate(() => { window.__rec.items = []; window.__rec.on = false; });
    if (setupFn) await page.evaluate(setupFn);
    await step((frames || 1) - 1, 16.6667);
    await page.evaluate(() => { window.__rec.items = []; window.__rec.on = true; });
    await step(1, 16.6667);
    return page.evaluate(() => { window.__rec.on = false; return window.__rec.items; });
  };

  const snap = async function (name) {
    const f = path.join(DIR, name);
    await page.screenshot({ path: f });
    return f;
  };

  return { page, errors, step, toClient, clickLogic, pixel, regionStats, recordFrame, snap };
}

/* ---- 结果收集器 ---- */
function results(name) {
  const rows = [];
  return {
    rows,
    add(id, ok, title, detail) {
      rows.push({ id, ok: (ok === true), status: ok === true ? 'PASS' : (ok === 'N/A' ? 'N/A' : 'FAIL'), title, detail });
      return ok;
    },
    na(id, title, detail) {
      rows.push({ id, ok: true, status: 'N/A', title, detail });
    },
    summary() {
      const p = rows.filter(r => r.status === 'PASS').length;
      const f = rows.filter(r => r.status === 'FAIL').length;
      const n = rows.filter(r => r.status === 'N/A').length;
      return { pass: p, fail: f, na: n, total: rows.length };
    }
  };
}

function lum(rgb) { return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; }

module.exports = {
  FILE_URL, DIR, LOGIC_W, LOGIC_H,
  launch, newPage, log, freshLog, results, lum
};
