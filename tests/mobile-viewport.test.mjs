import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);

function createElement() {
  return {
    style: {},
    classList: { add() {}, remove() {} },
    addEventListener() {},
    getContext() {
      return new Proxy({}, { get: () => () => {} });
    },
  };
}

async function runGameWithViewport({ innerWidth, innerHeight, viewportWidth, viewportHeight }) {
  const source = await readFile(new URL('js/game.js', root), 'utf8');
  const canvas = createElement();
  const elements = new Map([
    ['game', canvas],
    ['stage', createElement()],
    ['tip', createElement()],
    ['fsBtn', createElement()],
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
    addEventListener() {},
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
  vm.runInNewContext(source, context);
  return canvas;
}

test('mobile landscape uses the visual viewport and fills its height without fixed padding', async () => {
  const canvas = await runGameWithViewport({
    innerWidth: 900,
    innerHeight: 500,
    viewportWidth: 844,
    viewportHeight: 390,
  });

  assert.equal(canvas.style.width, '693px');
  assert.equal(canvas.style.height, '390px');
});
