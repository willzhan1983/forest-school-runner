import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, MAPS, Runner, seededRandom } from './engine.js';

test('difficulty speeds use 1, 2, 3, 5 multipliers', () => {
  for (const [level, factor] of Object.entries({ easy: 1, normal: 2, hard: 3, nightmare: 5 })) {
    assert.equal(LEVELS[level].speedFactor, factor);
    const game = isolated(level);
    assert.equal(game.speed, MAPS[0].speed * factor);
    game.advance(0.01);
    assert.ok(game.speed >= MAPS[0].speed * factor);
  }
});

function isolated(level = 'easy') {
  const game = new Runner(() => 0.5, { sceneV2: true });
  game.reset(level);
  game.obstacles = []; game.rows = []; game.pickups = []; game.nextRow = Infinity; game.events = [];
  return game;
}

function animalAt(game, distance = 1.2) {
  const row = { distance, blocked: [0], safe: 1, passed: false, hit: false };
  const animal = { id: 1, lane: 0, distance, type: 'animal', row, passed: false, broken: false };
  game.obstacles = [animal]; game.rows = [row];
  return animal;
}

function take(kind, setup = () => {}) {
  const game = isolated('normal');
  game.pickups = [{ id: 2, kind, lane: 0, distance: 1.2, y: 0.85, taken: false }];
  setup(game); game.advance(0.02);
  assert.equal(game.pickups[0].taken, true, kind);
  return game;
}

test('all maps and difficulties show an early animal and berry, then all new item kinds', () => {
  for (const map of MAPS) for (const level of Object.keys(LEVELS)) {
    const game = new Runner(seededRandom(31), { sceneV2: true });
    game.reset(level, map.id);
    game.distance = 18000; game.generate();
    assert.equal(game.obstacles.find(ob => ob.row === game.rows[3])?.type, 'animal', `${map.id}: ${level}`);
    assert.equal(game.pickups.find(pickup => pickup.kind === 'heal-berry')?.lane, game.rows[1].safe);
    const kinds = new Set(game.pickups.map(pickup => pickup.kind));
    for (const kind of ['heal-berry', 'golden-seed', 'poison-mushroom', 'sticky-web', 'double', 'dash-refill']) assert.ok(kinds.has(kind), `${map.id}: ${level}: ${kind}`);
    for (const row of game.rows) assert.ok(row.blocked.length <= 2 && !row.blocked.includes(row.safe), `${map.id}: ${level}: safe route`);
    for (const animal of game.obstacles.filter(ob => ob.type === 'animal')) assert.equal(animal.row.blocked.length, 1);
  }
});

test('animal rushes once, tracks its row, and can be avoided by changing lanes', () => {
  const game = isolated();
  const animal = animalAt(game, 30);
  game.advance(0.25);
  assert.ok(animal.distance < 30);
  assert.equal(animal.row.distance, animal.distance);
  game.lane = 1; game.x = 2.5; game.advance(1.5);
  assert.equal(game.hearts, game.maxHearts);
  assert.equal(game.events.filter(event => event.type === 'animal-warning').length, 1);
});

test('landing accepts the latest jump or slide within 0.18 seconds, but expires earlier input', () => {
  for (const level of Object.keys(LEVELS)) for (const action of ['jump', 'slide']) {
    const game = isolated(level); game.y = 0.2; game.vy = -1;
    game.act(action === 'jump' ? 'slide' : 'jump'); game.act(action); game.advance(0.12);
    assert.ok(action === 'slide' ? game.slide > 0 && game.y === 0 : game.vy > 0 && game.slide === 0, `${level}: ${action}`);
    const expired = isolated(level); expired.y = 2; expired.vy = 0; expired.act(action); expired.advance(0.5);
    assert.equal(expired.y, 0); assert.equal(expired.slide, 0); assert.equal(expired.vy, 0);
  }
});

test('Fuzzy dash protects against both negative items without consuming a shield', () => {
  for (const kind of ['poison-mushroom', 'sticky-web']) {
    const game = take(kind, game => { game.shield = 1; game.act('dash'); });
    assert.equal(game.hearts, game.maxHearts); assert.equal(game.shield, 1);
    assert.ok(game.events.find(event => event.type === kind).immune);
    assert.ok(game.cooldown < 6);
  }
});

test('all maps apply double points and skill reset; score healing stays at 3000', () => {
  for (const map of MAPS) {
    const game = isolated('normal'); game.reset('normal', map.id); game.obstacles = []; game.rows = []; game.nextRow = Infinity;
    game.pickups = [{ id: 1, kind: 'double', lane: 0, distance: 1.2, y: 0.85 }]; game.advance(0.02);
    assert.ok(game.doubleScore > 0, map.id);
    game.cooldown = 5; game.pickups = [{ id: 2, kind: 'dash-refill', lane: 0, distance: game.distance + 0.5, y: 0.85 }]; game.advance(0.02);
    assert.equal(game.cooldown, 0, map.id);
  }
});

test('animal warning leaves at least 1.2 seconds even at late boosted challenge speed', () => {
  for (const map of MAPS) for (const level of Object.keys(LEVELS)) {
    const game = isolated(level); game.reset(level, map.id); game.distance = 19000; game.setBoost(true);
    game.pickups = []; game.rows = []; game.nextRow = Infinity; game.events = [];
    const animal = animalAt(game, game.distance + Math.max(190, (game.speed + 12) * 1.2 + 20));
    let warningDistance = null, warningTime = null, collisionTime = null;
    for (let n = 0; n < 500 && game.mode === 'running'; n++) {
      game.advance(1 / 120);
      if (warningTime === null && game.events.some(e => e.type === 'animal-warning')) { warningTime = game.time; warningDistance = animal.distance - game.distance; }
      if (game.hearts < game.maxHearts) { collisionTime = game.time; break; }
    }
    assert.ok(warningDistance > 0 && collisionTime - warningTime >= 1.2, `${map.id}: ${level}: ${collisionTime - warningTime}`);
    assert.equal(game.events.filter(e => e.type === 'animal-warning').length, 1);
  }
});

test('precise obstacles reward once, optional safe lane preserves streak, three clears heal through addScore', () => {
  const game = isolated('normal'); game.score = 2990; game.hearts = 3;
  const clear = (type, lane = 0, hurt = false) => {
    game.y = hurt ? 0 : type === 'branch' ? 0 : 2; game.vy = 0; game.slide = type === 'branch' ? 1 : 0;
    game.obstacles = [{ id: game.id++, type, lane, distance: game.distance + 0.05, passed: false }]; game.advance(0.01);
    game.advance(0.03);
  };
  clear('log'); assert.equal(game.hearts, 4); assert.equal(game.nextHeal, 6000); assert.equal(game.precisionStreak, 1);
  clear('crate', 1); assert.equal(game.precisionStreak, 1);
  clear('branch'); clear('crate'); assert.equal(game.precisionStreak, 0);
  assert.equal(game.events.filter(e => e.type === 'precision').length, 3);
  assert.equal(game.events.filter(e => e.type === 'precision' && e.combo).length, 1);
  assert.equal(game.score, 3050 + Math.floor(game.distance / 5) * 2);
  clear('log'); clear('log', 0, true); assert.equal(game.precisionStreak, 0);
  game.invincible = 0; game.act('dash'); clear('crate'); assert.equal(game.precisionStreak, 0);
});

test('jump and Fuzzy dash avoid animal, while an unprotected hit costs one heart', () => {
  const jump = isolated(); animalAt(jump); jump.y = 2; jump.advance(0.02);
  assert.equal(jump.hearts, jump.maxHearts);
  const dash = isolated(); animalAt(dash); dash.act('dash'); dash.advance(0.02);
  assert.equal(dash.hearts, dash.maxHearts);
  assert.ok(dash.events.some(event => event.type === 'animal-evade'));
  assert.equal(dash.events.some(event => event.type === 'break'), false);
  const hit = isolated(); animalAt(hit); hit.advance(0.02);
  assert.equal(hit.hearts, hit.maxHearts - 1);
  assert.ok(hit.events.some(event => event.type === 'hurt' && event.cause === 'animal'));
  const shielded = isolated(); animalAt(shielded); shielded.shield = 1; shielded.advance(0.02);
  assert.equal(shielded.hearts, shielded.maxHearts);
  assert.equal(shielded.shield, 0);
});

test('new item effects keep the 3000-point healing rule and negative items stay avoidable', () => {
  assert.equal(take('heal-berry', game => { game.hearts = 2; }).hearts, 3);
  assert.equal(take('heal-berry').score, 80);
  const seed = take('golden-seed', game => { game.score = 2990; game.hearts = 3; });
  assert.equal(seed.score, 3110); assert.equal(seed.hearts, 4); assert.equal(seed.nextHeal, 6000);
  assert.equal(take('poison-mushroom').hearts, 3);
  assert.equal(take('poison-mushroom', game => { game.shield = 1; }).hearts, 4);
  assert.equal(take('poison-mushroom', game => { game.hearts = 1; }).mode, 'over');
  const web = take('sticky-web', game => { game.cooldown = 1; });
  assert.ok(web.cooldown > 3.9 && web.cooldown <= 6);
  const magnet = isolated(); magnet.magnet = 8;
  magnet.pickups = [{ id: 3, kind: 'poison-mushroom', lane: 1, distance: 1.2, y: 0.85, taken: false }];
  magnet.advance(0.02);
  assert.equal(magnet.pickups[0].taken, false);
});
