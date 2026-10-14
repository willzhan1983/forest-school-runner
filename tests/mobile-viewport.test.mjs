import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);

function createElement() {
  const classes = new Set();
  const listeners = new Map();
  return {
    style: {},
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    fire(type) { return listeners.get(type)?.(); },
    getContext() {
      return new Proxy({}, { get: () => () => {} });
    },
  };
}

async function runGameWithViewport({ innerWidth, innerHeight, viewportWidth, viewportHeight }) {
  const source = (await Promise.all(['tuning', 'config', 'audio', 'asset-loader', 'game']
    .map(name => readFile(new URL('js/' + name + '.js', root), 'utf8')))).join('\n');
  const canvas = createElement();
  const stage = createElement();
  const tip = createElement();
  const fsBtn = createElement();
  const tipText = createElement();
  const windowListeners = new Map();
  const elements = new Map([
    ['game', canvas],
    ['stage', stage],
    ['tip', tip],
    ['tipText', tipText],
    ['fsBtn', fsBtn],
    ['closeTip', createElement()],
    ['picInput', createElement()],
  ]);

  const window = {
    innerWidth,
    innerHeight,
    devicePixelRatio: 1,
    visualViewport: {
      width: viewportWidth,
      height: viewportHeight,
      addEventListener() {},
    },
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    fire(type) { return windowListeners.get(type)?.(); },
    localStorage: { getItem() { return null; }, setItem() {} },
  };
  const document = {
    hidden: false,
    documentElement: createElement(),
    getElementById(id) { return elements.get(id) || null; },
    addEventListener() {},
  };
  const context = {
    window,
    document,
    localStorage: window.localStorage,
    Image: class { set src(_value) {} },
    requestAnimationFrame() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    console,
    Math,
    Date,
  };
  window.document = document;
  window.Image = context.Image; window.setTimeout = context.setTimeout;
  vm.runInNewContext(source, context);
  return { canvas, stage, tip, tipText, fsBtn, window, document, game:window.__fsr,
    resize:() => window.fire('resize') };
}

test('mobile landscape uses the visual viewport and fills its height without fixed padding', async () => {
  const { canvas, game } = await runGameWithViewport({
    innerWidth: 900,
    innerHeight: 500,
    viewportWidth: 844,
    viewportHeight: 390,
  });

  assert.equal(canvas.style.width, '693px');
  assert.equal(canvas.style.height, '390px');
  for (const rect of [game.pauseBtnRect(), game.musicBtnRect(), game.linkRect()]) {
    assert.ok(rect.w * 390 / 540 >= 44);
    assert.ok(rect.h * 390 / 540 >= 44);
  }
});

test('smaller landscape phones keep separate 44px pause and music targets', async () => {
  const { game } = await runGameWithViewport({
    innerWidth:667, innerHeight:375, viewportWidth:667, viewportHeight:375,
  });
  const pause = game.pauseBtnRect(), music = game.musicBtnRect(), link = game.linkRect();
  assert.ok(pause.w * 375 / 540 >= 44);
  assert.ok(music.w * 375 / 540 >= 44);
  assert.ok(link.h * 375 / 540 >= 44);
  assert.ok(music.x >= pause.x + pause.w);
});

test('phone portrait keeps the landscape prompt visible', async () => {
  const { tip, canvas } = await runGameWithViewport({
    innerWidth:390, innerHeight:844, viewportWidth:390, viewportHeight:844,
  });
  assert.equal(tip.classList.contains('show'), true);
  assert.equal(tip.classList.contains('portrait'), true);
  assert.equal(canvas.style.height, '219px');
});

test('rotating into the portrait prompt pauses play before it hides the game', async () => {
  const { game, window, resize } = await runGameWithViewport({
    innerWidth:844, innerHeight:390, viewportWidth:844, viewportHeight:390,
  });
  game.startGame(); game.Input.pointerDown = true; game.Input.jumpHeld = true;
  window.visualViewport.width = 390; window.visualViewport.height = 844;
  resize();
  assert.equal(game.Game.paused, true);
  assert.equal(game.Input.pointerDown, false);
  assert.equal(game.Input.jumpHeld, false);
});

test('landscape button requests fullscreen and orientation, then clears portrait prompt', async () => {
  const { fsBtn, tip, window, document, resize } = await runGameWithViewport({
    innerWidth:390, innerHeight:844, viewportWidth:390, viewportHeight:844,
  });
  const calls = [];
  document.documentElement.requestFullscreen = () => { calls.push('fullscreen'); return Promise.resolve(); };
  window.screen = { orientation:{ lock:async direction => { calls.push(direction); } } };
  fsBtn.fire('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['fullscreen', 'landscape']);
  document.fullscreenElement = document.documentElement;
  window.visualViewport.width = 844;
  window.visualViewport.height = 390;
  resize();
  assert.equal(tip.classList.contains('portrait'), false);
  assert.equal(tip.classList.contains('show'), false);
});

test('unsupported fullscreen keeps the prompt and offers manual rotation', async () => {
  const { fsBtn, tip, tipText } = await runGameWithViewport({
    innerWidth:390, innerHeight:844, viewportWidth:390, viewportHeight:844,
  });
  fsBtn.fire('click');
  assert.equal(tip.classList.contains('show'), true);
  assert.match(tipText.textContent, /手动横过手机/);
});
