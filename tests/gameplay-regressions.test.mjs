import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);

async function loadGame() {
  const source = await readFile(new URL('js/game.js', root), 'utf8');
  const loadedImages = [];
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
    Image:class { set src(value) { loadedImages.push(value); } }, requestAnimationFrame() {},
    setTimeout() { return 1; }, clearTimeout() {}, Math, Date,
  };
  window.document = document;
  vm.runInNewContext(source, context);
  return { ...window.__fsr, loadedImages };
}

test('2D scene and item art load on the normal homepage without test parameters', async () => {
  const fsr = await loadGame();
  assert.ok(fsr.loadedImages.includes('assets/backgrounds/forest/v1-test/distant-lake.png'));
  assert.ok(fsr.loadedImages.includes('assets/items/v2-test/shield.png'));
  assert.ok(fsr.loadedImages.includes('assets/obstacles/classroom/v4-test/supply-crate.png'));
  await Promise.all(fsr.loadedImages.filter(path => path.startsWith('assets/'))
    .map(path => access(new URL(path, root))));
});

test('every 3000 points restores exactly one missing heart and advances the next threshold', async () => {
  const fsr = await loadGame();
  fsr.Game.maxLives = 5;
  fsr.Game.lives = 2;
  fsr.Game.score = 2999;
  fsr.Game.nextHealScore = 3000;

  fsr.addScore(0);
  assert.equal(fsr.Game.lives, 2, 'no healing before 3000 points');

  fsr.addScore(1);
  assert.deepEqual(
    { score:fsr.Game.score, lives:fsr.Game.lives, next:fsr.Game.nextHealScore },
    { score:3000, lives:3, next:6000 }
  );

  fsr.addScore(3000);
  assert.deepEqual(
    { score:fsr.Game.score, lives:fsr.Game.lives, next:fsr.Game.nextHealScore },
    { score:6000, lives:4, next:9000 }
  );
  fsr.addScore(9000);
  assert.equal(fsr.Game.lives, 5, 'healing cannot exceed max lives');
  assert.equal(fsr.Game.nextHealScore, 18000, 'full-health milestones are not banked');
  fsr.startGame();
  assert.equal(fsr.Game.nextHealScore, 3000, 'a new run resets the threshold');
});

test('difficulty levels keep gradually accelerating at 1000 m milestones with safe spacing', async () => {
  const fsr = await loadGame();
  const levels = ['easy', 'normal', 'hard', 'nightmare'].map(id => fsr.DIFF[id]);

  assert.deepEqual(levels.map(level => level.speedBase), [1, 2, 3, 3.5].map(multiplier => 4.4 * multiplier));

  for (const level of levels.slice(1)) {
    assert.equal(fsr.speedForDistance(level, 0), level.speedBase, level.id + ' starts at its base speed');
    assert.equal(fsr.speedForDistance(level, 9999), level.speedBase, level.id + ' does not accelerate before 1000 m');
    assert.equal(fsr.speedForDistance(level, 10000), level.speedBase + level.speedStep, level.id + ' steps up at 1000 m');
    assert.equal(fsr.speedForDistance(level, 20000), level.speedBase + level.speedStep * 2, level.id + ' steps up again at 2000 m');
    assert.equal(fsr.speedForDistance(level, 50000), level.speedBase + level.speedStep * 5, level.id + ' keeps accelerating after 2000 m');
    assert.ok(level.gapSpeedFactor >= 100, level.id + ' expands obstacle gaps as speed rises');
    const longRunSpeed = fsr.speedForDistance(level, 100000);
    assert.ok(fsr.obstacleGapFor(level, 100000, longRunSpeed) >= longRunSpeed * level.gapSpeedFactor,
      level.id + ' keeps the same obstacle reaction time during a long run');
    assert.equal(level.dblProb, 0, level.id + ' has no double obstacles');
  }
  assert.equal(fsr.speedForDistance(levels[0], 50000), levels[0].speedBase);
  assert.deepEqual(levels.map(level => level.maxLives), [5, 4, 3, 2]);
});

test('high-speed obstacles keep collision detection across a single frame', async () => {
  const fsr = await loadGame();
  const player = { x:120, y:390, w:52, h:68 };
  const obstacle = { x:40, y:390, w:52, h:68 };

  assert.equal(fsr.hitsObstacle(player.x, player.y, player.w, player.h, obstacle, 220), true,
    'an obstacle crossing the player in one fast frame still hits');
  assert.equal(fsr.hitsObstacle(player.x, 260, player.w, player.h, obstacle, 220), false,
    'a jump above a crossing obstacle remains safe');
});

test('fast rewards are collected across a frame without collecting rewards above the player', async () => {
  const fsr = await loadGame();
  assert.equal(fsr.hitsReward(194, 390, 44, 68, 158, 420, 13, 300), true);
  assert.equal(fsr.hitsReward(194, 390, 44, 68, 158, 300, 13, 300), false);
  assert.equal(fsr.hitsReward(194, 390, 44, 68, 300, 420, 13, 320), false);
  assert.equal(fsr.hitsReward(194, 390, 44, 68, 215, 420, 17), true);
});

test('high-speed obstacles spawn with warning time and dead obstacles do not warn', async () => {
  const fsr = await loadGame();
  const p = { x:190, w:52 };
  for (const speed of [4.4, 8.8, 13.2, 22]) {
    const x = fsr.obstacleSpawnX(p, speed);
    assert.ok(x >= 1000);
    assert.ok((x - p.x - p.w) / speed >= 75);
  }
  assert.equal(fsr.obstacleWarning([{x:1500,w:50,dead:false}], p, 22), true);
  assert.equal(fsr.obstacleWarning([{x:1500,w:50,dead:true}], p, 22), false);
  assert.equal(fsr.obstacleWarning([{x:100,w:50,dead:false}], p, 22), false);
});

test('run frames follow one continuous stride and wrap cleanly', async () => {
  const fsr = await loadGame();
  assert.equal(fsr.runFrameIndex(0, 4), 0);
  assert.equal(fsr.runFrameIndex(Math.PI, 4), 2);
  assert.equal(fsr.runFrameIndex(Math.PI * 2, 4), 0);
  assert.equal(fsr.runFrameIndex(Math.PI * 2.5, 4), 1);
});

test('a nightmare dash collects crossed rewards once and activates the crossed shield', async () => {
  const fsr = await loadGame();
  fsr.setDifficulty('nightmare');
  fsr.startGame();
  const p = fsr.getPlayer();
  p.dashing = true;
  p.dashTimer = 34;
  fsr.getPickups().push({ x:260, y:p.y + 34, kind:'book', seed:0 });
  fsr.getPowerups().push({ x:260, y:p.y + 34, kind:'shield', seed:0 });
  fsr.update(3);
  assert.equal(fsr.Game.books, 1);
  assert.equal(fsr.Buff.shield, 1);
  assert.equal(fsr.getPickups().length, 0);
  assert.equal(fsr.getPowerups().length, 0);
  fsr.update(3);
  assert.equal(fsr.Game.books, 1);
  assert.equal(fsr.Buff.shield, 1);
});

test('running follows distance while pausing leaves the stride unchanged', async () => {
  const fsr = await loadGame();
  fsr.startGame();
  const p = fsr.getPlayer();
  fsr.update(1);
  assert.equal(p.runPhase, fsr.Game.speed * 0.024);
  const phase = p.runPhase;
  fsr.Game.paused = true;
  fsr.update(3);
  assert.equal(p.runPhase, phase);
});

test('existing jump, fall, landing, dash and owl glide actions remain distinct', async () => {
  const fsr = await loadGame();
  fsr.Game.state = 'playing';
  const p = { grounded:false, vy:-5 };
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.cat, p), 'jump');
  p.vy = 5;
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.cat, p), 'fall');
  p.grounded = true; p.landTimer = 9;
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.cat, p), 'land');
  p.dashing = true;
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.cat, p), 'dash');
  p.dashing = false; p.gliding = true;
  assert.equal(fsr.getTestActionState(fsr.CHARACTERS.owl, p), 'glide');
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
