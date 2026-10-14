import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPixelRatio, sampleRenderQuality } from './render-quality.js';

const initial = () => ({ lastTime: null, slowMs: 0, reduced: false });

test('small screens preserve existing orientation caps and lower device pixel ratios', () => {
  assert.equal(renderPixelRatio(390, 844, 3), 1.2);
  assert.equal(renderPixelRatio(800, 600, 1), 1);
  assert.equal(renderPixelRatio(1000, 600, 3), 1.6);
});

test('4K and Retina canvases stay within the absolute two megapixel budget', () => {
  for (const [width, height, dpr] of [[3840, 2160, 2], [2560, 1440, 2], [2160, 3840, 3]]) {
    const ratio = renderPixelRatio(width, height, dpr);
    assert.ok(width * height * ratio ** 2 <= 2_000_000 + 0.001);
    assert.ok(Math.floor(width * ratio) * Math.floor(height * ratio) <= 2_000_000);
    assert.equal(renderPixelRatio(width, height, dpr, true), ratio * 0.75);
  }
});

test('sustained slow gameplay reduces once and does not upgrade after fast frames', () => {
  let state = initial();
  for (let now = 0; now <= 1980; now += 33) state = sampleRenderQuality(state, now, true);
  assert.equal(state.reduced, false);
  state = sampleRenderQuality(state, 2013, true);
  assert.equal(state.reduced, true);
  assert.equal(sampleRenderQuality(state, 2029, true), state);
  assert.equal(sampleRenderQuality(state, 2100, false), state);
});

test('inactive sampling resets the streak and ignores the gap before resuming', () => {
  let state = initial();
  for (let now = 0; now <= 990; now += 33) state = sampleRenderQuality(state, now, true);
  state = sampleRenderQuality(state, 2000, false);
  assert.equal(state.slowMs, 0);
  state = sampleRenderQuality(state, 5000, true);
  assert.equal(state.slowMs, 0);
  assert.equal(state.reduced, false);
});

test('isolated stalls and fast frames reset the streak without reducing quality', () => {
  let state = sampleRenderQuality(initial(), 0, true);
  state = sampleRenderQuality(state, 1000, true);
  assert.equal(state.slowMs, 0);
  state = sampleRenderQuality(state, 1033, true);
  state = sampleRenderQuality(state, 1049, true);
  assert.equal(state.slowMs, 0);
  assert.equal(state.reduced, false);
});
