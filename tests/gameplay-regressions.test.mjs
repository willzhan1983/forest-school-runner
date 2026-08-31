import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);

async function loadGame() {
  const source = await readFile(new URL('js/game.js', root), 'utf8');
  const canvas = {
    style: {},
    getContext() { return new Proxy({}, { get: () => () => {} }); },
    addEventListener() {},
  };
  const element = () => ({ style:{}, classList:{ add() {}, remove() {} }, addEventListener() {} });
  const elements = new Map([
    ['game', canvas], ['stage', element()], ['tip', element()],
    ['fsBtn', element()], ['closeTip', element()], ['picInput', element()]
  ]);
  const window = {
    innerWidth:960, innerHeight:540, devicePixelRatio:1,
    location:{ search:'' }, addEventListener() {},
    localStorage:{ getItem() { return null; }, setItem() {} },
  };
  const document = {
    hidden:false, documentElement:element(),
    getElementById(id) { return elements.get(id) || null; },
    addEventListener() {},
  };
  const context = {
    window, document, localStorage:window.localStorage,
    Image:class { set src(_value) {} }, requestAnimationFrame() {},
    setTimeout() { return 1; }, clearTimeout() {}, Math, Date,
  };
  window.document = document;
  vm.runInNewContext(source, context);
  return window.__fsr;
}

test('every 1000 points restores exactly one missing heart and advances the next threshold', async () => {
  const fsr = await loadGame();
  fsr.Game.maxLives = 5;
  fsr.Game.lives = 2;
  fsr.Game.score = 999;
  fsr.Game.nextHealScore = 1000;

  fsr.addScore(1);
  assert.deepEqual(
    { score:fsr.Game.score, lives:fsr.Game.lives, next:fsr.Game.nextHealScore },
    { score:1000, lives:3, next:2000 }
  );

  fsr.addScore(1000);
  assert.deepEqual(
    { score:fsr.Game.score, lives:fsr.Game.lives, next:fsr.Game.nextHealScore },
    { score:2000, lives:4, next:3000 }
  );
});

test('difficulty levels keep gradually accelerating at 1000 m milestones with safe spacing', async () => {
  const fsr = await loadGame();
  const levels = ['easy', 'normal', 'hard', 'nightmare'].map(id => fsr.DIFF[id]);

  for (const level of levels.slice(1)) {
    assert.equal(fsr.speedForDistance(level, 0), level.speedBase, level.id + ' starts at its base speed');
    assert.equal(fsr.speedForDistance(level, 9999), level.speedBase, level.id + ' does not accelerate before 1000 m');
    assert.equal(fsr.speedForDistance(level, 10000), level.speedBase + level.speedStep, level.id + ' steps up at 1000 m');
    assert.equal(fsr.speedForDistance(level, 20000), level.speedBase + level.speedStep * 2, level.id + ' steps up again at 2000 m');
    assert.equal(fsr.speedForDistance(level, 50000), level.speedBase + level.speedStep * 5, level.id + ' keeps accelerating after 2000 m');
    assert.ok(level.gapSpeedFactor >= 100, level.id + ' expands obstacle gaps as speed rises');
    const longRunSpeed = fsr.speedForDistance(level, 100000);
    assert.ok(fsr.obstacleGapFor(level, 100000, longRunSpeed) / longRunSpeed >= level.gapSpeedFactor,
      level.id + ' keeps the same obstacle reaction time during a long run');
    assert.equal(level.dblProb, 0, level.id + ' has no double obstacles');
  }
  assert.equal(fsr.speedForDistance(levels[0], 50000), levels[0].speedBase);
  assert.deepEqual(levels.map(level => level.maxLives), [5, 4, 3, 2]);
});

test('the completion screen selects the Win action while menu preview remains Idle', async () => {
  const fsr = await loadGame();
  const p = { preview:false, hurtTimer:0, dashing:false, gliding:false, sliding:false, grounded:true, landTimer:0, vy:0 };

  fsr.Game.state = 'gameover';
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.cat, p), 'win');
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.owl, p), 'win');

  p.preview = true;
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.cat, p), 'idle');
});

test('test scene loading starts with the current forest scene and preloads later scenes during play', async () => {
  const source = await readFile(new URL('js/game.js', root), 'utf8');

  assert.match(source, /function loadTestSceneAssets\(\)[\s\S]*ensureTestSceneAssets\('forest'\)/);
  assert.match(source, /function preloadNextTestSceneAssets\(\)/);
  assert.match(source, /player = createPlayer\(Game\.charId\);[\s\S]*preloadNextTestSceneAssets\(\);/);
  assert.match(source, /Game\.themeIndex = \(Game\.themeIndex \+ 1\) % THEMES\.length;[\s\S]*preloadNextTestSceneAssets\(\);/);
});
