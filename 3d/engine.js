// World units: x across lanes, y upward, distance forward along the path.
export const LANE_WIDTH = 2.5;
export const BOOST_MULTIPLIER = 1.3;
export const DASH_DURATION = 1.5, DASH_COOLDOWN = 6;
export const LEVELS = {
  easy: { label: '简单', hearts: 5, speedFactor: 1, gapPenalty: 0, minGap: 2.05, double: 0, doubleCap: 0.65 },
  normal: { label: '普通', hearts: 4, speedFactor: 1.5, gapPenalty: 0.1, minGap: 2, double: 0.3, doubleCap: 0.75 },
  hard: { label: '困难', hearts: 3, speedFactor: 2, gapPenalty: 0.2, minGap: 1.95, double: 0.5, doubleCap: 0.85 },
  nightmare: { label: '挑战', hearts: 2, speedFactor: 2.5, gapPenalty: 0.3, minGap: 1.9, double: 0.65, doubleCap: 0.92 }
};
export const MAPS = [
  { id: 'china', label: '中国竹林', goal: 20000, speed: 24, reaction: 2.7, double: 0.18 },
  { id: 'japan', label: '日本樱花林', goal: 20000, speed: 26, reaction: 2.55, double: 0.25 },
  { id: 'europe', label: '欧洲针叶林', goal: 20000, speed: 28, reaction: 2.4, double: 0.32 },
  { id: 'amazon', label: '亚马逊雨林', goal: 20000, speed: 30, reaction: 2.25, double: 0.38 }
];
const COLLECTIBLES = {
  default: { kind: 'acorn', name: '橡果', unit: '颗' },
  china: { kind: 'bamboo-shoot', name: '竹笋', unit: '根' },
  japan: { kind: 'cherry-blossom', name: '樱花', unit: '朵' },
  europe: { kind: 'pine-cone', name: '松果', unit: '颗' },
  amazon: { kind: 'cacao-pod', name: '可可果', unit: '颗' }
};
export const collectibleFor = (mapId, sceneV2 = false) => sceneV2 && COLLECTIBLES[mapId] || COLLECTIBLES.default;
const MISSIONS = [
  { kind: 'collect', label: '收集橡果', target: 12 },
  { kind: 'dodge', label: '无伤通过障碍', target: 5 },
  { kind: 'break', label: '冲刺撞碎障碍', target: 1 }
];
const ROUTES = [
  { lanes: [0, -1, 1], types: ['crate', 'log', 'branch'] },
  { lanes: [1, 0, -1], types: ['log', 'branch', 'crate'] },
  { lanes: [-1, 1, 0], types: ['branch', 'crate', 'log'] },
  { lanes: [0, 1, -1], types: ['log', 'crate', 'branch'] },
  { lanes: [1, -1, 0], types: ['crate', 'branch', 'log'] }
];
const SCENE_ROUTES = {
  china: [
    { lanes: [-1, 0, 1], types: ['log', 'branch', 'crate'] },
    { lanes: [1, 0, -1], types: ['branch', 'crate', 'log'] }
  ],
  japan: [
    { lanes: [0, -1, 1], types: ['branch', 'crate', 'log'] },
    { lanes: [-1, 1, 0], types: ['log', 'crate', 'branch'] }
  ]
};
export function seededRandom(seed = 31) {
  return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
}
export class Runner {
  constructor(random = Math.random, { sceneV2 = false } = {}) { this.random = random; this.sceneV2 = sceneV2; this.character = 'fuzzy'; this.reset('easy'); this.mode = 'menu'; }
  setCharacter(character) { if (this.mode === 'menu') this.character = character === 'doodle' ? 'doodle' : 'fuzzy'; }
  reset(level = 'easy', mapId = 'china') {
    this.level = LEVELS[level] ? level : 'easy';
    this.map = MAPS.find(map => map.id === mapId) || MAPS[0];
    this.mapId = this.map.id;
    this.sceneV2Active = this.sceneV2 && (this.mapId === 'china' || this.mapId === 'japan');
    this.collectible = collectibleFor(this.mapId, this.sceneV2);
    this.mode = 'running'; this.distance = 0; this.speed = this.map.speed * LEVELS[this.level].speedFactor; this.boosting = false; this.time = 0;
    this.lane = 0; this.x = 0; this.y = 0; this.vy = 0;
    this.slide = 0; this.dash = 0; this.glide = 0; this.cooldown = 0; this.invincible = 0;
    this.jumpBuffer = 0; this.landing = 0;
    this.hearts = LEVELS[this.level].hearts; this.maxHearts = this.hearts;
    this.shield = 0; this.magnet = 0; this.doubleScore = 0;
    this.score = 0; this.acorns = 0; this.nextHeal = 3000;
    this.mission = { segment: 0, ...MISSIONS[0], progress: 0, completed: false };
    this.mission.label = `收集${this.collectible.name}`;
    this.obstacles = []; this.pickups = []; this.events = []; this.rows = [];
    this.nextRow = Math.max(65, this.speed * Math.max(LEVELS[this.level].minGap, this.map.reaction - LEVELS[this.level].gapPenalty));
    this.rowIndex = 0; this.id = 0; this.route = null; this.previousSafe = null; this.generate();
  }
  setBoost(active) {
    this.boosting = !!active && this.mode === 'running';
    this.speed = (this.map.speed + 12 * Math.min(this.distance / this.map.goal, 1)) * LEVELS[this.level].speedFactor * (this.boosting ? BOOST_MULTIPLIER : 1);
  }
  act(action) {
    if (this.mode !== 'running') return false;
    if (action === 'left' || action === 'right') {
      this.lane = Math.max(-1, Math.min(1, this.lane + (action === 'left' ? -1 : 1)));
    } else if (action === 'jump') {
      if (this.y <= 0.001) { this.vy = 9.6; this.slide = 0; this.jumpBuffer = 0; this.events.push({ type: 'jump' }); }
      else this.jumpBuffer = 0.14;
    } else if (action === 'slide') {
      if (this.y > 0.08) return false;
      this.slide = 1.05; this.jumpBuffer = 0;
    } else if (action === 'dash') {
      if (this.cooldown > 0 || this.character === 'doodle' && this.y <= 0.08) return false;
      this.cooldown = DASH_COOLDOWN;
      if (this.character === 'doodle') {
        this.glide = 2.2; this.vy = Math.max(this.vy, 1.2); this.events.push({ type: 'glide' });
      } else {
        this.dash = DASH_DURATION; this.events.push({ type: 'dash' });
      }
    } else return false;
    return true;
  }
  addScore(amount, { doubleEligible = false } = {}) {
    this.score += doubleEligible && this.doubleScore > 0 ? amount * 2 : amount;
    while (this.score >= this.nextHeal) {
      this.nextHeal += 3000;
      if (this.hearts < this.maxHearts) { this.hearts++; this.events.push({ type: 'heal' }); }
    }
  }
  progressMission(kind) {
    if (this.mission.kind !== kind || this.mission.completed) return;
    this.mission.progress++;
    if (this.mission.progress === this.mission.target) {
      this.mission.completed = true;
      this.addScore(150);
      this.events.push({ type: 'mission-complete', label: this.mission.label });
    }
  }
  generate() {
    while (this.nextRow < Math.min(this.distance + 190, this.map.goal - 20)) {
      const n = this.rowIndex++, z = this.nextRow;
      // At most two blocked lanes, always one complete open route.
      if (n % 3 === 0) {
        const routes = this.sceneV2Active ? [...ROUTES, ...SCENE_ROUTES[this.mapId]] : ROUTES;
        this.route = routes[Math.floor(this.random() * routes.length)];
      }
      const lane = this.route.lanes[n % 3];
      const type = this.route.types[n % 3];
      const options = [-1, 0, 1].filter(l => l !== lane && (this.previousSafe === null || Math.abs(l - this.previousSafe) <= 1));
      const safe = options[Math.floor(this.random() * options.length)];
      const blocked = [lane];
      const progress = Math.min(z / this.map.goal, 1);
      if (n > 2 && n % 5 !== 0 && this.random() < Math.min(LEVELS[this.level].doubleCap, LEVELS[this.level].double + this.map.double + 0.53 * progress)) {
        blocked.push([-1, 0, 1].find(l => l !== lane && l !== safe));
      }
      this.previousSafe = safe;
      blocked.forEach(l => this.obstacles.push({ id: ++this.id, lane: l, distance: z, type, passed: false, broken: false }));
      this.rows.push({ distance: z, blocked: [...blocked], safe, passed: false, hit: false });
      for (let i = 0; i < 3; i++) this.pickups.push({ id: ++this.id, kind: 'acorn', lane: safe, distance: z - 12 + i * 4, y: 0.8, taken: false });
      for (let i = 0; i < 6; i++) this.pickups.push({ id: ++this.id, kind: 'acorn', lane, distance: z - 10 + i * 3, y: type === 'branch' ? 0.8 : 1.8, taken: false });
      if (blocked.length === 2) for (let i = 0; i < 3; i++) this.pickups.push({ id: ++this.id, kind: 'acorn', lane: blocked[1], distance: z - 12 + i * 4, y: type === 'branch' ? 0.8 : 1.8, taken: false });
      if (n % 7 === 0) {
        const kind = this.sceneV2Active ? ['shield', 'magnet', 'double', 'dash-refill'][n / 7 % 4] : n % 14 === 0 ? 'shield' : 'magnet';
        this.pickups.push({ id: ++this.id, kind, lane: kind === 'shield' ? safe : lane, distance: z - 20, y: 0.85, taken: false });
      }
      // Increase decisions per second at cruise speed; boosting trades reaction time for pace.
      const futureSpeed = (this.map.speed + 12 * progress) * LEVELS[this.level].speedFactor;
      const gapTime = Math.max(LEVELS[this.level].minGap, this.map.reaction - LEVELS[this.level].gapPenalty - 0.6 * progress);
      this.nextRow += Math.max(34, futureSpeed * gapTime) + this.random() * 5;
    }
  }
  step(dt) {
    if (this.mode !== 'running') return;
    this.time += dt;
    this.speed = (this.map.speed + 12 * Math.min(this.distance / this.map.goal, 1)) * LEVELS[this.level].speedFactor * (this.boosting ? BOOST_MULTIPLIER : 1);
    const previous = this.distance;
    this.distance += this.speed * dt;
    const reachedGoal = previous < this.map.goal && this.distance >= this.map.goal;
    if (reachedGoal) this.distance = this.map.goal;
    const segment = Math.floor(Math.min(this.distance, this.map.goal - 1) / 500);
    if (segment !== this.mission.segment) {
      const mission = MISSIONS[segment % MISSIONS.length];
      this.mission = { segment, ...(this.character === 'doodle' && mission.kind === 'break' ? { kind: 'glide', label: '滑翔越过障碍', target: 1 } : mission), progress: 0, completed: false };
      if (this.mission.kind === 'collect') this.mission.label = `收集${this.collectible.name}`;
    }
    this.x += Math.sign(this.lane * LANE_WIDTH - this.x) * Math.min(Math.abs(this.lane * LANE_WIDTH - this.x), 17 * dt);
    for (const key of ['slide', 'dash', 'glide', 'cooldown', 'invincible', 'jumpBuffer', 'landing', 'magnet', 'doubleScore']) this[key] = Math.max(0, this[key] - dt);
    if (this.y > 0 || this.vy > 0) {
      this.vy -= (this.glide > 0 ? 5 : 24) * dt;
      if (this.glide > 0) this.vy = Math.max(this.vy, -1.4);
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.glide = 0; this.landing = 0.13; this.events.push({ type: 'land' });
        if (this.jumpBuffer > 0) this.act('jump');
      }
    }
    this.addScore((Math.floor(this.distance / 5) - Math.floor(previous / 5)) * 2, { doubleEligible: true });
    if (reachedGoal) {
      this.mode = 'complete'; this.doubleScore = 0; this.setBoost(false);
      this.events.push({ type: 'complete', mapId: this.mapId });
      return;
    }
    for (const ob of this.obstacles) {
      if (ob.passed || ob.broken) continue;
      if (ob.distance < this.distance - 1.7) { ob.passed = true; continue; }
      const near = ob.distance - this.distance < 1.65 && ob.distance - previous > -1.65;
      if (!near || Math.abs(ob.lane * LANE_WIDTH - this.x) > 1.02) continue;
      if (this.dash > 0) {
        ob.broken = true; this.addScore(20);
        this.events.push({ type: 'break', lane: ob.lane, distance: ob.distance });
        this.progressMission('break');
      } else {
        const clears = ob.type === 'branch' ? this.slide > 0 && this.y < 0.1 : this.y > 1.02;
        if (!clears) {
          const row = this.rows.find(candidate => candidate.distance === ob.distance);
          if (row) row.hit = true;
          if (this.invincible <= 0) {
            this.invincible = 1.8; ob.passed = true;
            if (this.shield) { this.shield = 0; this.events.push({ type: 'shield-hit' }); }
            else {
              this.hearts--; this.events.push({ type: 'hurt' });
              if (this.hearts <= 0) { this.mode = 'over'; this.doubleScore = 0; this.setBoost(false); this.events.push({ type: 'over' }); break; }
            }
          }
        }
      }
    }
    if (this.mode === 'running') for (const row of this.rows) {
      if (row.passed || row.distance >= this.distance - 1.7) continue;
      row.passed = true;
      if (!row.hit) { this.progressMission('dodge'); if (this.glide > 0) this.progressMission('glide'); }
    }
    if (this.mode === 'running') for (const coin of this.pickups) {
      if (coin.taken) continue;
      const acorn = !coin.kind || coin.kind === 'acorn';
      const near = this.magnet > 0 && acorn
        ? Math.abs(coin.lane * LANE_WIDTH - this.x) < 5.1 && Math.abs(coin.distance - this.distance) < 2.5
        : Math.abs(coin.lane * LANE_WIDTH - this.x) < 0.88 && Math.abs(coin.distance - this.distance) < 1.15 && Math.abs(coin.y - (this.y + 0.85)) < 0.9;
      if (!near) continue;
      coin.taken = true;
      if (acorn) { this.acorns++; this.addScore(10, { doubleEligible: true }); this.progressMission('collect'); this.events.push({ type: 'collect', lane: coin.lane, distance: coin.distance, y: coin.y }); }
      else if (coin.kind === 'shield') { this.shield = 1; this.events.push({ type: 'shield', lane: coin.lane, distance: coin.distance, y: coin.y }); }
      else if (coin.kind === 'magnet') { this.magnet = 8; this.events.push({ type: 'magnet', lane: coin.lane, distance: coin.distance, y: coin.y }); }
      else if (this.sceneV2Active && coin.kind === 'double') { this.doubleScore = 8; this.events.push({ type: 'double', lane: coin.lane, distance: coin.distance, y: coin.y }); }
      else if (this.sceneV2Active && coin.kind === 'dash-refill') { const bonus = this.cooldown <= 0 ? 50 : 0; this.cooldown = 0; if (bonus) this.addScore(bonus); this.events.push({ type: 'dash-refill', bonus, lane: coin.lane, distance: coin.distance, y: coin.y }); }
    }
    this.obstacles = this.obstacles.filter(o => o.distance > this.distance - 18);
    this.pickups = this.pickups.filter(o => o.distance > this.distance - 12);
    this.rows = this.rows.filter(o => o.distance > this.distance - 20);
    this.generate();
  }
  advance(seconds) {
    // Bound every physics step, including testing and slow frames, to avoid tunnelling.
    while (seconds > 0.000001) { const dt = Math.min(seconds, 1 / 120); this.step(dt); seconds -= dt; }
  }
  pause() { if (this.mode === 'running') { this.setBoost(false); this.mode = 'paused'; } }
  resume() { if (this.mode === 'paused') this.mode = 'running'; }
  snapshot() {
    return {
      mode: this.mode, level: this.level, map: this.mapId, goal: this.map.goal, coordinates: 'x: left(-)/right(+); y: up; ahead: positive metres forward',
      distance: +this.distance.toFixed(1), speed: +this.speed.toFixed(2), boosting: this.boosting, score: this.score, acorns: this.acorns, hearts: this.hearts, maxHearts: this.maxHearts,
      shield: this.shield, magnet: +this.magnet.toFixed(2), doubleScore: +this.doubleScore.toFixed(2), mission: { ...this.mission }, collectible: { ...this.collectible, count: this.acorns },
      player: { lane: this.lane, x: +this.x.toFixed(2), y: +this.y.toFixed(2), slide: +this.slide.toFixed(2), dash: +this.dash.toFixed(2), glide: +this.glide.toFixed(2), cooldown: +this.cooldown.toFixed(2), invincible: +this.invincible.toFixed(2) },
      obstacles: this.obstacles.filter(o => !o.broken && o.distance - this.distance < 80).map(o => ({ type: o.type, lane: o.lane, ahead: +(o.distance - this.distance).toFixed(1) })),
      pickups: this.pickups.filter(o => !o.taken && o.distance - this.distance < 50).map(o => ({ kind: !o.kind || o.kind === 'acorn' ? this.collectible.kind : o.kind, lane: o.lane, y: o.y, ahead: +(o.distance - this.distance).toFixed(1) }))
    };
  }
}
