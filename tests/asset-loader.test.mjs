import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/asset-loader.js', import.meta.url), 'utf8');

function setup(){
  const timers = [];
  class Image {
    constructor(){ this.requests = []; }
    set src(value){ this.requests.push(value); }
    get src(){ return this.requests.at(-1); }
    fail(){ this.onerror?.(); }
    succeed(){ this.onload?.(); }
  }
  const window = { Image, setTimeout(callback, delay){ timers.push({ callback, delay }); } };
  vm.runInNewContext(source, { window });
  return { assets: window.FSRAssets, timers };
}

test('successful images load once and status snapshots cannot mutate totals', () => {
  const { assets, timers } = setup();
  const states = [];
  const image = assets.load('book.png', { onStatus: event => states.push(event.state) });
  assert.equal(assets.getStatus().pending, 1);
  image.succeed();
  assert.deepEqual(states, ['loading', 'loaded']);
  assert.equal(image.requests.length, 1);
  assert.equal(timers.length, 0);
  const snapshot = assets.getStatus();
  snapshot.loaded = 100;
  assert.equal(assets.getStatus().loaded, 1);
  assert.equal(assets.getStatus().pending, 0);
  assert.equal(assets.getStatus().recovered, 0);
});

test('WebP immediately falls back to the original PNG before retrying', () => {
  const { assets, timers } = setup();
  const states = [];
  const image = assets.load('forest.webp?v=2#layer', { onStatus: event => states.push(event.state) });
  image.fail();
  assert.equal(image.src, 'forest.png?v=2#layer');
  assert.equal(timers.length, 0);
  image.succeed();
  assert.deepEqual(states, ['loading', 'fallback', 'loaded']);
  assert.equal(assets.getStatus().recovered, 1);
  assert.equal(assets.getStatus().failed, 0);
});

test('transient failures recover after a delayed cache-busting retry', () => {
  const { assets, timers } = setup();
  const image = assets.load('book.png?version=2#sprite');
  image.fail();
  assert.equal(image.requests.length, 1);
  assert.equal(timers[0].delay, 500);
  timers.shift().callback();
  assert.equal(image.src, 'book.png?version=2&r=1#sprite');
  image.succeed();
  assert.equal(assets.getStatus().recovered, 1);
  assert.equal(assets.getStatus().retries, 1);
  assert.equal(assets.getStatus().failed, 0);
});

test('unavailable WebP and PNG stop after two retries and report final failure', () => {
  const { assets, timers } = setup();
  const events = [];
  const image = assets.load('forest.webp', { onStatus: event => events.push(event) });
  image.fail();
  image.fail();
  assert.equal(timers[0].delay, 500);
  timers.shift().callback();
  assert.equal(image.src, 'forest.png?r=1');
  image.fail();
  assert.equal(timers[0].delay, 1000);
  timers.shift().callback();
  assert.equal(image.src, 'forest.png?r=2');
  image.fail();
  image.fail();
  assert.equal(image.requests.length, 4);
  assert.equal(timers.length, 0);
  assert.equal(events.at(-1).state, 'failed');
  assert.equal(events.at(-1).totals.failed, 1);
  assert.equal(assets.getStatus().errors, 4);
  assert.equal(assets.getStatus().retries, 2);
  assert.equal(assets.getStatus().pending, 0);
  assert.equal(assets.getStatus().loaded, 0);
});

test('multiple assets report independent recovery and final failure totals', () => {
  const { assets, timers } = setup();
  const good = assets.load('good.png');
  const recovered = assets.load('recovered.webp');
  const missing = assets.load('missing.png');
  good.succeed();
  recovered.fail();
  recovered.succeed();
  missing.fail();
  timers.shift().callback();
  missing.fail();
  timers.shift().callback();
  missing.fail();
  const status = assets.getStatus();
  assert.equal(status.loaded, 2);
  assert.equal(status.recovered, 1);
  assert.equal(status.failed, 1);
  assert.equal(status.pending, 0);
});
