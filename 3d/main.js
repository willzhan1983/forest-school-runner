import { Runner, LEVELS, MAPS, LANE_WIDTH, DASH_DURATION, DASH_COOLDOWN, seededRandom, collectibleFor } from './engine.js?v=speed-1235-20261004';
import { createWorld } from './world.js?v=fuzzy-plush-game-20261004';
import { createMapMusic } from './music.js';
import { reduceGesture } from './gestures.js';
const $ = s => document.querySelector(s);
const testMode = new URLSearchParams(location.search).has('test');
const testFuzzyModel = new URLSearchParams(location.search).has('testFuzzyModel');
const testFuzzyRig = new URLSearchParams(location.search).has('testFuzzyRig');
const testFuzzyV5 = new URLSearchParams(location.search).has('testFuzzyV5');
const testDoodle = new URLSearchParams(location.search).has('testDoodle');
const testSceneV2 = new URLSearchParams(location.search).has('testSceneV2');
const game = new Runner(testMode ? seededRandom(73) : Math.random, { sceneV2: testSceneV2 });
const world = createWorld($('#scene'), { sceneV2: testSceneV2 });
const sceneLead = '躲开冲来的小动物，收集红莓和金种子。<br>紫蘑菇、蛛网要避开！';
if (testSceneV2) $('#menu-lead').innerHTML = sceneLead;
if (testSceneV2) for (const kind of ['shield', 'magnet']) {
  const icon = $(`#${kind}-status img`);
  icon.src = `./assets/items/v2/${kind}.png`;
  icon.addEventListener('error', () => { icon.src = `./assets/items/${kind}.png`; }, { once: true });
}
if (testSceneV2) {
  const icon = $('#double-status img');
  icon.src = './assets/items/v2/double.png';
  icon.addEventListener('error', () => { icon.hidden = true; }, { once: true });
}
if (testFuzzyModel) {
  $('.model-note').textContent = 'Fuzzy 静态模型测试';
  $('.prototype-label').textContent = 'FOREST SCHOOL LAB · Fuzzy 静态模型测试 · 暂无骨骼动画';
}
if (testFuzzyRig) {
  $('.model-note').textContent = 'Fuzzy 骨骼动作测试';
  $('.prototype-label').textContent = 'FOREST SCHOOL LAB · Fuzzy 骨骼动作测试版';
}
if (testFuzzyV5) {
  $('.model-note').textContent = 'Fuzzy 毛绒站立版';
  $('.prototype-label').textContent = 'FOREST SCHOOL LAB · 3D 线上试玩版';
}
let selectedLevel = 'easy', selectedMap = 0, unlockedMap = 0, modeShown = '', lastTime = 0, clock = 0, toastTime = 0;
let best = 0, soundOn = true, audio = null;
const music = createMapMusic();
const boostKeys = new Set();
function clearBoost() { boostKeys.clear(); game.setBoost(false); }
try { best = Number(localStorage.getItem('forest-runner-3d-best-v1')) || 0; } catch { /* Private browsing: still playable. */ }
try { unlockedMap = Math.max(0, Math.min(MAPS.length - 1, Math.floor(Number(localStorage.getItem('forest-runner-3d-unlocked-map-v1')) || 0))); } catch { /* Private browsing: still playable. */ }
const previewMap = testSceneV2 ? MAPS.findIndex(map => map.id === new URLSearchParams(location.search).get('testMap')) : -1;
if (previewMap >= 0) { selectedMap = previewMap; unlockedMap = Math.max(unlockedMap, previewMap); }
$('#best').textContent = best;
function syncMapOptions() {
  $('#map-select').innerHTML = MAPS.map((map, index) => `<option value="${map.id}" ${index > unlockedMap ? 'disabled' : ''}>${map.label}${index > unlockedMap ? ' · 未解锁' : ` · ${map.goal}米`}</option>`).join('');
  $('#map-select').value = MAPS[selectedMap].id;
  $('#menu-map-name').textContent = MAPS[selectedMap].label;
  $('#character-power').textContent = game.character === 'doodle' ? `空中滑翔 · 磁铁吸取${collectibleFor(MAPS[selectedMap].id, testSceneV2).name}` : `冲撞障碍 · 磁铁吸取${collectibleFor(MAPS[selectedMap].id, testSceneV2).name}`;
  world.setMap(MAPS[selectedMap].id);
}
syncMapOptions();
if (testDoodle) $('#character-options').hidden = false;
function selectCharacter(character) {
  game.setCharacter(character);
  world.setCharacter(game.character);
  document.querySelectorAll('[data-character]').forEach(button => {
    const selected = button.dataset.character === game.character;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
  $('#character-avatar').textContent = game.character === 'doodle' ? 'D' : 'F';
  $('#character-name').textContent = game.character === 'doodle' ? '涂涂 Doodle' : '钱钱 Fuzzy';
  $('#menu-lead').innerHTML = testSceneV2 ? sceneLead : game.character === 'doodle' ? '和涂涂一起，跑进立体的森林。<br>跳过倒木，展翅滑翔，收集一路的小惊喜。' : '和钱钱一起，跑进立体的森林。<br>跳过倒木，穿过树影，收集一路的小惊喜。';
  $('#skill-control-hint').textContent = game.character === 'doodle' ? '滑翔' : '冲刺';
  $('.model-note').textContent = game.character === 'doodle' ? 'Doodle 绿色羽尾版' : testFuzzyV5 ? 'Fuzzy 毛绒站立版' : testFuzzyRig ? 'Fuzzy 骨骼动作测试' : '临时模型';
  $('.prototype-label').textContent = game.character === 'doodle' || testFuzzyV5 ? 'FOREST SCHOOL LAB · 3D 线上试玩版' : testFuzzyRig ? 'FOREST SCHOOL LAB · Fuzzy 骨骼动作测试版' : 'FOREST SCHOOL LAB · 3D 原型';
  syncMapOptions(); syncUI();
}
if (testDoodle) document.querySelectorAll('[data-character]').forEach(button => button.addEventListener('click', () => selectCharacter(button.dataset.character)));
function beep(freq, duration = 0.1) {
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.07, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  } catch { /* Sound is optional. */ }
}
function syncMusic() {
  if (!soundOn || game.mode !== 'running') { music.stop(); return; }
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    music.play(game.mapId, audio);
  } catch { music.stop(); /* Audio is optional. */ }
}
function toast(text, duration = 1.7) { $('#toast').textContent = text; toastTime = duration; $('#toast').classList.add('visible'); }
function events() {
  for (const event of game.events) {
    if (event.type === 'collect') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 3, testSceneV2 ? game.collectible.kind : 'gold', event.y); beep(740, 0.065); }
    if (event.type === 'jump') beep(400, 0.1);
    if (event.type === 'break') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance)); toast('撞碎障碍 +20'); beep(240, 0.12); }
    if (event.type === 'animal-warning') beep(590, 0.12);
    if (event.type === 'precision') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), event.combo ? 16 : 8, 'gold'); toast(event.combo ? '精准三连！越障 +10 · 连击奖励 +30' : `精准越障 +10 · 连击 ${event.streak}/3`, 2); beep(event.combo ? 1040 : 800, 0.15); }
    if (event.type === 'animal-evade') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 8, 'gold'); toast('小动物被冲刺吓跑了！'); beep(500, 0.12); }
    if (event.type === 'dash') { toast('冲刺保护！撞碎前方障碍'); beep(520, 0.2); }
    if (event.type === 'glide') { toast('涂涂展翅！缓慢下降，越过障碍'); beep(620, 0.2); }
    if (event.type === 'shield') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 16, 'shield', event.y); toast('获得护盾：挡下一次撞击'); beep(680, 0.18); }
    if (event.type === 'magnet') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 16, 'magnet', event.y); toast(`磁铁启动：8 秒吸取${game.collectible.name}`); beep(760, 0.18); }
    if (event.type === 'double') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 18, 'double', event.y); toast(`双倍积分！8 秒内${game.collectible.name}和距离加倍`, 2.2); beep(900, 0.2); }
    if (event.type === 'dash-refill') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 18, 'dash-refill', event.y); toast(event.bonus ? '技能已就绪 · +50 分' : '技能冷却已重置！', 2.2); beep(820, 0.2); }
    if (event.type === 'heal-berry') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 14, 'heal-berry', event.y); toast(event.bonus ? '生命已满 · 红莓 +80 分' : '吃到红莓 · 恢复一颗心'); beep(880, 0.18); }
    if (event.type === 'golden-seed') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 16, 'golden-seed', event.y); toast('金种子 · +120 分'); beep(940, 0.2); }
    if (event.type === 'poison-mushroom') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 12, 'poison-mushroom', event.y); toast(event.dashProtected ? '冲撞保护挡住毒蘑菇' : event.absorbed ? '护盾挡住毒蘑菇' : event.immune ? '无敌状态避开毒蘑菇' : '误食毒蘑菇 · 失去一颗心'); beep(180, 0.2); }
    if (event.type === 'sticky-web') { world.burst(event.lane * LANE_WIDTH, -(event.distance - game.distance), 12, 'sticky-web', event.y); toast(event.immune ? '冲撞保护穿过蛛网' : '碰到蛛网 · 技能冷却延长'); beep(210, 0.2); }
    if (event.type === 'shield-hit') { toast('护盾挡住了撞击！'); beep(300, 0.2); }
    if (event.type === 'hurt') { toast(event.cause === 'animal' ? '被小动物撞到了！换道或跳过它' : '碰到了，换条小路试试'); beep(150, 0.18); }
    if (event.type === 'heal') { toast('满 3000 分，恢复一颗心 ♥'); beep(880, 0.2); }
    if (event.type === 'mission-complete') { toast(`${event.label}完成 · +150 分`, 2.2); beep(960, 0.18); }
  }
  game.events.length = 0;
}
function syncUI() {
  $('#score').textContent = game.score;
  $('#distance').textContent = Math.floor(game.distance);
  $('#hearts').textContent = `♥ ${game.hearts}/${game.maxHearts}`;
  $('#hearts').setAttribute('aria-label', `${game.hearts} / ${game.maxHearts} 颗心`);
  $('#health-track').setAttribute('aria-valuemax', String(game.maxHearts));
  $('#health-track').setAttribute('aria-valuenow', String(game.hearts));
  $('#health-fill').style.width = `${game.hearts / game.maxHearts * 100}%`;
  $('#powerups').hidden = !game.shield && game.magnet <= 0 && game.doubleScore <= 0;
  $('#shield-status').hidden = !game.shield;
  $('#magnet-status').hidden = game.magnet <= 0;
  $('#magnet-time').textContent = Math.ceil(game.magnet);
  $('#double-status').hidden = !testSceneV2 || game.doubleScore <= 0;
  $('#double-time').textContent = Math.ceil(game.doubleScore);
  $('#speed').textContent = `${game.speed.toFixed(1)} m/s${game.boosting ? ' ⚡' : ''}`;
  $('#map-num').textContent = String(MAPS.findIndex(map => map.id === game.mapId) + 1).padStart(2, '0');
  $('#map-name').textContent = game.map.label;
  $('#map-goal').textContent = `终点 ${game.map.goal}m`;
  $('#mission-label').textContent = game.mission.completed ? '短任务完成 · +150分' : `短任务 · ${game.mission.label}`;
  $('#mission-progress').textContent = `${game.mission.progress}/${game.mission.target}`;
  $('#mission-fill').style.width = `${game.mission.progress / game.mission.target * 100}%`;
  $('#mission').classList.toggle('done', game.mission.completed);
  $('#mission-alert').textContent = game.mission.completed ? '✓' : '!';
  const dangerLanes = [...new Set(game.obstacles.filter(ob => ob.type === 'animal' && ob.warned && !ob.passed && !ob.broken && ob.distance > game.distance - 1.7).map(ob => ob.lane))];
  $('#animal-warning').hidden = !dangerLanes.length || game.mode !== 'running';
  $('#animal-warning').textContent = dangerLanes.length ? `⚠ ${dangerLanes.map(lane => ['左跑道', '中跑道', '右跑道'][lane + 1]).join('、')} · 小动物！换道或跳跃` : '';
  const doodle = game.character === 'doodle';
  const activeSkill = doodle ? game.glide : game.dash;
  const dashState = activeSkill > 0 ? 'active' : game.cooldown > 0 ? 'cooling' : 'ready';
  $('#dash-status').dataset.state = dashState;
  $('#skill-label').textContent = doodle ? '✦ 滑翔技能' : 'ϟ 冲撞技能';
  $('#skill-icon').textContent = doodle ? '✦' : 'ϟ';
  $('#dash-state').textContent = dashState === 'active' ? '生效中' : dashState === 'cooling' ? '冷却' : '可使用';
  $('#dash-time').textContent = dashState === 'ready' ? doodle ? '跳起后可滑翔' : '撞碎前方障碍' : `${(dashState === 'active' ? activeSkill : game.cooldown).toFixed(1)}s`;
  $('#dash-fill').style.width = `${dashState === 'active' ? activeSkill / (doodle ? 2.2 : DASH_DURATION) * 100 : dashState === 'cooling' ? (1 - game.cooldown / DASH_COOLDOWN) * 100 : 100}%`;
  $('#dash').disabled = game.cooldown > 0 || doodle && game.mode === 'running' && game.y <= 0.08;
  $('#dash small').textContent = dashState === 'active' ? '生效中' : dashState === 'cooling' ? `${game.cooldown.toFixed(1)}s` : doodle ? '滑翔' : '冲撞';
  $('#dash').setAttribute('aria-label', doodle ? dashState === 'active' ? `滑翔生效中，剩余 ${game.glide.toFixed(1)} 秒` : dashState === 'cooling' ? `滑翔冷却，剩余 ${game.cooldown.toFixed(1)} 秒` : '滑翔，跳起后使用' : dashState === 'active' ? `冲撞生效中，剩余 ${game.dash.toFixed(1)} 秒` : dashState === 'cooling' ? `冲撞冷却，剩余 ${game.cooldown.toFixed(1)} 秒` : '冲撞，可撞碎前方障碍');
  if (game.mode === 'menu') {
    const loading = world.modelState.status === 'loading';
    $('#start-btn').disabled = loading || doodle && world.modelState.status !== 'ready';
    $('#start-btn span').textContent = loading ? `${doodle ? '涂涂' : '钱钱'}正在准备…` : world.modelState.status === 'fallback' ? doodle ? '涂涂模型加载失败' : '使用备用角色开始' : '开始森林冒险';
    if (loading) $('.model-note').textContent = '角色载入中';
    else if (world.modelState.status === 'fallback') $('.model-note').textContent = '角色载入失败 · 备用造型';
    else if (world.modelState.status === 'ready') $('.model-note').textContent = doodle ? 'Doodle 绿色羽尾版' : testFuzzyV5 ? 'Fuzzy 毛绒站立版' : '角色准备好了';
  }
  $('#toast').classList.toggle('visible', toastTime > 0);
  if (modeShown === game.mode) return;
  modeShown = game.mode;
  syncMusic();
  $('#app').dataset.mode = game.mode;
  $('#menu').hidden = game.mode !== 'menu';
  $('#hud').hidden = !['running', 'paused'].includes(game.mode);
  $('#pause').hidden = game.mode !== 'running';
  $('#dialog').hidden = !['paused', 'over', 'complete'].includes(game.mode);
  $('#resume').hidden = game.mode !== 'paused'; $('#restart').hidden = !['over', 'complete'].includes(game.mode); $('#next-map').hidden = true; $('#result-stats').hidden = !['over', 'complete'].includes(game.mode);
  if (game.mode === 'paused') {
    $('#dialog-title').textContent = '森林等你回来'; $('#dialog-kicker').textContent = 'TAKE A LITTLE BREAK'; $('#dialog-copy').textContent = '歇一小会儿，再继续你的冒险。';
    $('#resume').focus({ preventScroll: true });
  }
  if (game.mode === 'over') {
    const record = game.score > best;
    best = Math.max(best, game.score); $('#best').textContent = best;
    try { localStorage.setItem('forest-runner-3d-best-v1', String(best)); } catch { /* No storage does not stop replay. */ }
    $('#dialog-title').textContent = record ? '这是你的新纪录！' : '这一趟，跑得真棒';
    $('#dialog-kicker').textContent = 'A LITTLE ADVENTURE, WELL DONE';
    $('#dialog-copy').textContent = '下一条小路，还藏着新的惊喜。';
    $('#result-stats').innerHTML = `<div class="result-number">${game.score}<small style="font-size:13px"> 分</small></div><div class="result-detail"><span>${Math.floor(game.distance)} 米</span><span>${game.acorns} ${game.collectible.unit}${game.collectible.name}</span></div>`;
    $('#restart').textContent = '再跑一次 ↗';
    $('#restart').focus({ preventScroll: true });
  }
  if (game.mode === 'complete') {
    const index = MAPS.findIndex(map => map.id === game.mapId);
    if (index < MAPS.length - 1 && unlockedMap < index + 1) {
      unlockedMap = index + 1;
      try { localStorage.setItem('forest-runner-3d-unlocked-map-v1', String(unlockedMap)); } catch { /* Still playable without storage. */ }
      syncMapOptions();
    }
    best = Math.max(best, game.score); $('#best').textContent = best;
    try { localStorage.setItem('forest-runner-3d-best-v1', String(best)); } catch { /* Still playable without storage. */ }
    $('#dialog-title').textContent = `${game.map.label}通关！`;
    $('#dialog-kicker').textContent = 'WORLD TOUR · MAP COMPLETE';
    $('#dialog-copy').textContent = index < MAPS.length - 1 ? `已解锁下一站：${MAPS[index + 1].label}` : '全部地图通关，下一段旅程等着你！';
    $('#result-stats').innerHTML = `<div class="result-number">${game.score}<small style="font-size:13px"> 分</small></div><div class="result-detail"><span>${game.map.goal} 米</span><span>${game.acorns} ${game.collectible.unit}${game.collectible.name}</span></div>`;
    $('#next-map').hidden = index === MAPS.length - 1;
    $('#next-map').textContent = index < MAPS.length - 1 ? `前往${MAPS[index + 1].label} →` : '';
    $('#restart').textContent = '重玩本地图 ↗';
    (index < MAPS.length - 1 ? $('#next-map') : $('#restart')).focus({ preventScroll: true });
  }
}
function start() {
  if (world.modelState.status === 'loading' || game.character === 'doodle' && world.modelState.status !== 'ready') return;
  clearBoost(); game.reset(selectedLevel, MAPS[selectedMap].id); world.setMap(game.mapId); if (testSceneV2) { world.resetViews(); world.resetEffects(); } toastTime = 0; events(); syncUI(); $('#scene').focus({ preventScroll: true });
  toast('空格跳跃 · 按住 W/↑ 加速 · 左右换道', 3.3);
}
function action(value) { game.act(value); events(); syncUI(); }
$('#start-btn').disabled = false; $('#start-btn span').textContent = '开始森林冒险';
$('#start-btn').addEventListener('click', start); $('#restart').addEventListener('click', start);
$('#next-map').addEventListener('click', () => { selectedMap = Math.min(MAPS.findIndex(map => map.id === game.mapId) + 1, unlockedMap); syncMapOptions(); start(); });
$('#map-select').addEventListener('change', event => { const index = MAPS.findIndex(map => map.id === event.target.value); if (index >= 0 && index <= unlockedMap) { selectedMap = index; syncMapOptions(); } });
document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
  selectedLevel = button.dataset.level;
  document.querySelectorAll('[data-level]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
}));
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); action(button.dataset.action); });
  button.addEventListener('click', event => { if (event.detail === 0) action(button.dataset.action); });
});
$('#pause').addEventListener('click', () => { clearBoost(); game.pause(); syncUI(); });
$('#resume').addEventListener('click', () => { game.resume(); syncUI(); $('#scene').focus({ preventScroll: true }); });
$('#home').addEventListener('click', () => { clearBoost(); game.mode = 'menu'; toastTime = 0; syncUI(); $('#start-btn').focus({ preventScroll: true }); });
$('#sound').addEventListener('click', () => { soundOn = !soundOn; $('#sound').textContent = soundOn ? '♪' : '♫'; $('#sound').setAttribute('aria-label', soundOn ? '关闭音乐和音效' : '开启音乐和音效'); $('#sound').style.opacity = soundOn ? '1' : '.65'; syncMusic(); beep(600); });
async function fullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('#app').requestFullscreen) await $('#app').requestFullscreen(); }
  catch { toast('这个浏览器暂不支持全屏'); }
}
$('#fullscreen').addEventListener('click', fullscreen);
window.addEventListener('keydown', event => {
  if (event.repeat) return;
  // Native buttons keep Enter/Space semantics; canvas supports game shortcuts.
  if (event.target.closest('button,a') && ['Enter', ' '].includes(event.key)) return;
  const key = event.key.toLowerCase();
  if (event.target.closest('select,input,textarea')) return;
  if (key === 'w' || key === 'arrowup') { event.preventDefault(); boostKeys.add(key); game.setBoost(true); syncUI(); return; }
  const keys = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'jump', arrowdown: 'slide', s: 'slide', shift: 'dash' };
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(key)) event.preventDefault();
  if (key === 'f') { fullscreen(); return; }
  if (key === 'escape' || key === 'p') { clearBoost(); if (game.mode === 'paused') game.resume(); else game.pause(); syncUI(); return; }
  if (game.mode === 'menu' && (key === 'enter' || key === ' ')) { start(); return; }
  if (keys[key]) action(keys[key]);
});
window.addEventListener('keyup', event => {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') { boostKeys.delete(key); game.setBoost(boostKeys.size > 0); syncUI(); }
});
let gesture = null;
$('#scene').addEventListener('pointerdown', e => {
  if (game.mode !== 'running') return;
  const result = reduceGesture(gesture, 'down', e);
  if (result.state === gesture) return;
  gesture = result.state;
  try { $('#scene').setPointerCapture(e.pointerId); } catch { /* Pointer may already be canceled. */ }
});
for (const type of ['move', 'up', 'cancel']) $('#scene').addEventListener(`pointer${type}`, e => {
  const result = reduceGesture(gesture, type, e); gesture = result.state;
  if (result.action) action(result.action);
  if (type !== 'move' && $('#scene').hasPointerCapture(e.pointerId)) $('#scene').releasePointerCapture(e.pointerId);
});
$('#scene').addEventListener('lostpointercapture', e => { gesture = reduceGesture(gesture, 'cancel', e).state; });
window.addEventListener('blur', () => { gesture = null; clearBoost(); game.pause(); syncUI(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearBoost(); game.pause(); syncUI(); } lastTime = 0; });
window.addEventListener('resize', world.resize); document.addEventListener('fullscreenchange', world.resize);
$('#scene').addEventListener('webglcontextlost', e => { e.preventDefault(); game.pause(); syncUI(); $('#failure').hidden = false; });
function tick(dt) {
  game.advance(dt); events();
  if (game.mode === 'running' || game.mode === 'menu') { clock += dt; toastTime = Math.max(0, toastTime - dt); }
  syncUI(); world.draw(game, game.mode === 'paused' ? 0 : dt, clock);
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
  lastTime = now;
  tick(testMode ? 0 : dt);
}
window.render_game_to_text = () => JSON.stringify({ ...game.snapshot(), character: game.character, unlockedMap: MAPS[unlockedMap].id, ...(testFuzzyModel || testFuzzyRig || testFuzzyV5 || testDoodle ? { model: world.modelState.status, animation: world.modelState.active || null } : {}) });
window.advanceTime = ms => {
  let left = Math.max(0, ms / 1000);
  while (left > 0.000001) { const dt = Math.min(left, 1 / 60); tick(dt); left -= dt; }
};
// Deterministic browser QA only. Normal play exposes no state mutation hook.
if (testMode) window.__runnerTest = { game, action, start, world, music, syncUI, selectCharacter, setLevel: level => { selectedLevel = level; } };
syncUI(); world.draw(game, 0, 0); requestAnimationFrame(loop);
