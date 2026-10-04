import * as THREE from './vendor/three.module.js';
import { addFuzzyShortFur } from './fuzzy-fur.js?v=standing-fur-20261002';
import { addFuzzyPlushFur } from './fuzzy-plush-fur.js?v=plush-20261004';
import { LANE_WIDTH, MAPS } from './engine.js';

const MAP_LOOKS = {
  china: { sky: 0xc4dfcf, ground: 0x729663, path: 0xccbe91, trunk: 0x6c8a59, crown: 0x70a56b, cone: 0x4d8e61, bank: 0x91ab65, petals: 0xe8db8e },
  japan: { sky: 0xf1dce5, ground: 0x92b387, path: 0xd4bca5, trunk: 0x806656, crown: 0xe9a7ba, cone: 0xd783a5, bank: 0xb0c49a, petals: 0xf8c4d6 },
  europe: { sky: 0xcbdde2, ground: 0x748f88, path: 0xc4c4ae, trunk: 0x62594c, crown: 0x5c8579, cone: 0x2e6055, bank: 0x8da9a1, petals: 0xe8efe6 },
  amazon: { sky: 0xa7d4bc, ground: 0x4e8157, path: 0xb3a077, trunk: 0x6d5136, crown: 0x347d53, cone: 0x58a65f, bank: 0x68a366, petals: 0xf0c760 }
};
const SCENE_PLANTS = {
  china: ['china-bamboo-tall', 'china-bamboo-grove'],
  japan: ['japan-cherry-full', 'japan-cherry-sparse'],
  europe: ['europe-spruce', 'europe-fir'],
  amazon: ['amazon-canopy', 'amazon-palm']
};
const CHINA_ROCKS = ['rock-boulder', 'rock-slab'];
const SCENE_OBSTACLES = {
  china: { crate: 'bamboo-stumps', log: 'fallen-bamboo', branch: 'bamboo-arch' },
  europe: { crate: 'europe-stumps', log: 'europe-fallen-fir', branch: 'europe-spruce-arch' },
  amazon: { crate: 'amazon-roots', log: 'amazon-fallen-log', branch: 'amazon-vine-arch' }
};
const WILDLIFE = { china: 'china-squirrel', japan: 'japan-white-eye', europe: 'europe-hare', amazon: 'amazon-toucanet' };
const sceneVersion = mapId => mapId === 'europe' || mapId === 'amazon' ? 'v3' : 'v2';

export function createWorld(canvas, { sceneV2 = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0xc4dfcf);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc4dfcf);
  scene.fog = new THREE.Fog(0xc4dfcf, 38, 155);
  const camera = new THREE.PerspectiveCamera(57, 1, 0.1, 230);
  scene.add(new THREE.HemisphereLight(0xf5fff2, 0x487257, 2.6));
  const sun = new THREE.DirectionalLight(0xffebc4, 3.2); sun.position.set(-30, 50, 25); scene.add(sun);
  const materials = new Map();
  const mat = (color, extra = '') => {
    const key = `${color}:${extra}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
    return materials.get(key);
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const ballGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 1, 7);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const tmp = new THREE.Object3D();
  function mesh(geo, color, x, y, z, sx = 1, sy = 1, sz = 1, parent = scene) {
    const object = new THREE.Mesh(geo, mat(color)); object.position.set(x, y, z); object.scale.set(sx, sy, sz); parent.add(object); return object;
  }
  function box(color, x, y, z, sx, sy, sz, parent) { return mesh(boxGeo, color, x, y, z, sx, sy, sz, parent); }
  function ball(color, x, y, z, sx, sy = sx, sz = sx, parent) { return mesh(ballGeo, color, x, y, z, sx, sy, sz, parent); }
  const ground = box(0x729663, 0, -0.22, -70, 250, 0.4, 300);
  box(0xb8ad7f, 0, -0.025, -70, 8.3, 0.12, 300);
  const path = box(0xccbe91, 0, 0.04, -70, 7.8, 0.035, 300);
  for (const x of [-1.25, 1.25]) box(0xe5d9b2, x, 0.064, -70, 0.045, 0.012, 300);
  // Lane boundaries are physical gravel in the 3D world, not a flat background.
  const gravel = new THREE.InstancedMesh(ballGeo, mat(0xd8d4b0), 160); scene.add(gravel);
  const bank = new THREE.InstancedMesh(ballGeo, mat(0x91ab65), 100); scene.add(bank);
  const rockReady = {};
  const rockBank = sceneV2 ? CHINA_ROCKS.map(name => {
    const layer = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 50);
    layer.frustumCulled = false; layer.visible = false; scene.add(layer);
    new THREE.TextureLoader().load(`./assets/scenes/v2/${name}.png`, texture => {
      texture.colorSpace = THREE.SRGBColorSpace; layer.material.map = texture; layer.material.needsUpdate = true; rockReady[name] = true;
    }, undefined, () => { rockReady[name] = false; });
    return layer;
  }) : [];
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x6b6850), 100); scene.add(trunks);
  const leavesA = new THREE.InstancedMesh(ballGeo, mat(0x397961), 100); scene.add(leavesA);
  const leavesB = new THREE.InstancedMesh(coneGeo, mat(0x558756), 100); scene.add(leavesB);
  const petals = new THREE.InstancedMesh(ballGeo, mat(0xf6d595), 110); scene.add(petals);
  const plantLayers = sceneV2 ? [0, 1].map(() => {
    const layer = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 20);
    layer.frustumCulled = false; layer.visible = false; scene.add(layer); return layer;
  }) : [];
  for (const object of [gravel, bank, trunks, leavesA, leavesB, petals]) object.frustumCulled = false;
  const noise = n => { const v = Math.sin(n * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };
  const wrap = (v, span = 200) => ((v + 24) % span + span) % span - 24;
  const put = (batch, i, x, y, z, sx, sy, sz, rotation = 0) => {
    tmp.position.set(x, y, z); tmp.scale.set(sx, sy, sz); tmp.rotation.set(0, rotation, 0); tmp.updateMatrix(); batch.setMatrixAt(i, tmp.matrix);
  };
  const distantHills = new THREE.Group(); scene.add(distantHills);
  for (let i = 0; i < 8; i++) ball(i % 2 ? 0x89b3a0 : 0x98bdab, (i - 4) * 24, 5, -150 - noise(i) * 24, 26, 24 + noise(i) * 18, 18, distantHills);
  ball(0xffefc5, -24, 44, -130, 8, 8, 8, distantHills);
  const gate = new THREE.Group(); scene.add(gate);
  for (const x of [-4.9, 4.9]) {
    box(0x74664b, x, 2.8, 0, 0.48, 5.6, 0.55, gate);
    ball(0x326b51, x, 5.2, 0, 1.9, 1.3, 1.5, gate);
  }
  box(0x74664b, 0, 5.1, 0, 10.3, 0.38, 0.65, gate);
  box(0xc4a268, 0, 5, 0.45, 3.1, 1.25, 0.14, gate);
  for (const x of [-0.55, 0, 0.55]) mesh(coneGeo, 0x245c44, x, 5.06, 0.56, 0.5, 0.7, 0.12, gate);
  const flags = [];
  for (let i = 0; i < 8; i++) flags.push(mesh(coneGeo, i % 2 ? 0xe9be68 : 0x64876c, -4.2 + i * 1.2, 4.63, 0.3, 0.48, -0.55, 0.06, gate));

  const player = new THREE.Group(); scene.add(player);
  const pose = new THREE.Group(); player.add(pose);
  const procedural = new THREE.Group(); pose.add(procedural);
  const modelState = { status: 'off' };
  // Temporary geometric Fuzzy. It is deliberately kept separate from approved 2D assets.
  ball(0x9da9ae, 0, 0.91, 0, 0.5, 0.63, 0.4, procedural);
  ball(0xeeeadd, 0, 0.89, -0.29, 0.37, 0.46, 0.18, procedural);
  const head = new THREE.Group(); head.position.y = 1.56; procedural.add(head);
  ball(0xabb5b7, 0, 0, 0, 0.64, 0.55, 0.49, head);
  ball(0xf6f0dd, -0.24, -0.12, -0.36, 0.32, 0.28, 0.22, head);
  ball(0xf6f0dd, 0.24, -0.12, -0.36, 0.32, 0.28, 0.22, head);
  for (const x of [-0.41, 0.41]) {
    mesh(coneGeo, 0x98a5ac, x, 0.44, 0, 0.4, 0.63, 0.35, head);
    mesh(coneGeo, 0xe9b3a1, x, 0.44, -0.12, 0.23, 0.39, 0.1, head);
    ball(0x254c56, x * 0.63, 0.04, -0.443, 0.155, 0.2, 0.09, head);
    ball(0x74c9e9, x * 0.63, 0.06, -0.512, 0.115, 0.15, 0.04, head);
    ball(0x132d34, x * 0.63, 0.07, -0.542, 0.066, 0.11, 0.02, head);
    ball(0xffffff, x * 0.63 - 0.025, 0.13, -0.56, 0.027, 0.035, 0.012, head);
  }
  ball(0xd28e87, 0, -0.135, -0.582, 0.09, 0.062, 0.055, head);
  const scarf = box(0x429dbb, 0, 1.16, 0, 1.05, 0.19, 0.7, procedural);
  const flap = box(0x3798b9, 0.22, 0.95, 0.42, 0.23, 0.53, 0.09, procedural); flap.rotation.x = -0.35;
  const limbs = [];
  for (const [x, z] of [[-0.33, -0.05], [0.33, -0.05]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.43, z); procedural.add(leg);
    ball(0xd3d5cc, 0, -0.12, 0, 0.18, 0.34, 0.18, leg);
    ball(0xf5eedf, 0, -0.31, -0.07, 0.22, 0.16, 0.27, leg); limbs.push(leg);
    const arm = ball(0xa8b2b4, x * 1.64, 0.85, -0.04, 0.16, 0.32, 0.19, procedural); limbs.push(arm);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.7, 0.27); procedural.add(tail);
  for (let i = 0; i < 4; i++) ball(i === 3 ? 0xf0ecdd : 0x8b9ba4, Math.sin(i * 0.5) * 0.32, i * 0.15, 0.24 + i * 0.17, 0.2 - i * 0.025, 0.22, 0.25, tail);
  const params = new URLSearchParams(location.search);
  const v5Preview = params.has('testFuzzyV5');
  const rigPreview = params.has('testFuzzyRig') || v5Preview;
  let modelRequest = 0, loadedModel = null;
  let footSamples = [];
  const footPoint = new THREE.Vector3();
  function disposeModel(model) {
    model.userData.disposeShortFur?.();
    model.traverse(child => {
      child.geometry?.dispose();
      child.skeleton?.dispose();
      for (const material of child.material ? Array.isArray(child.material) ? child.material : [child.material] : []) {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    });
  }
  function setCharacter(character) {
    const request = ++modelRequest;
    if (loadedModel) { modelState.mixer?.stopAllAction(); modelState.mixer?.uncacheRoot(loadedModel); pose.remove(loadedModel); disposeModel(loadedModel); loadedModel = null; }
    modelState.mixer = null; modelState.actions = null; modelState.active = null; modelState.clips = []; footSamples = [];
    procedural.visible = true;
    if (character !== 'doodle' && !rigPreview && !params.has('testFuzzyModel')) {
      modelState.status = 'off'; return;
    }
    modelState.status = 'loading';
    import('./vendor/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
      const path = character === 'doodle' ? './assets/chars/doodle/v4-test/doodle-green-tail-test.glb'
        : v5Preview ? './assets/chars/fuzzy/v5-test/fuzzy-v5-plush-run-test.glb' : rigPreview ? './assets/chars/fuzzy/fuzzy-rig-v1.glb' : './assets/chars/fuzzy/fuzzy-test.glb';
      const loader = new GLTFLoader();
      let gltf;
      if (character !== 'doodle' && v5Preview && typeof DecompressionStream !== 'undefined') {
        try {
          const response = await fetch(`${path}.gz`);
          if (!response.ok) throw new Error(`Character download failed: ${response.status}`);
          const blob = await response.blob();
          // Servers may already decode Content-Encoding: gzip before fetch returns.
          const buffer = await blob.slice(0, 4).text() === 'glTF' ? await blob.arrayBuffer()
            : await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
          gltf = await loader.parseAsync(buffer, new URL('.', new URL(path, location.href)).href);
        } catch { gltf = await loader.loadAsync(path); }
      } else gltf = await loader.loadAsync(path);
      if (request !== modelRequest) { disposeModel(gltf.scene); return; }
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      if (!size.y) { disposeModel(model); throw new Error('Character model has no height'); }
      const scale = 2.3 / size.y;
      model.scale.setScalar(scale);
      // Meshy's front faces +Z; this runner's character faces -Z.
      model.rotation.y = Math.PI;
      model.position.set(-(bounds.min.x + size.x / 2) * scale, -bounds.min.y * scale, -(bounds.min.z + size.z / 2) * scale);
      pose.add(model);
      loadedModel = model;
      procedural.visible = false;
      if ((rigPreview || character === 'doodle') && gltf.animations.length) {
        modelState.mixer = new THREE.AnimationMixer(model);
        modelState.actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, modelState.mixer.clipAction(clip)]));
        modelState.clips = gltf.animations.map(clip => clip.name);
      }
      if (character === 'fuzzy' && v5Preview) model.traverse(child => {
        if (!child.isSkinnedMesh) return;
        const positions = child.geometry.attributes.position;
        child.geometry.computeBoundingBox();
        const bounds = child.geometry.boundingBox, size = bounds.getSize(new THREE.Vector3());
        const cells = new Map();
        // Spread support samples across the paws; never scan the full plush mesh per frame.
        for (let index = 0; index < positions.count; index++) {
          const y = positions.getY(index);
          if (y > bounds.min.y + size.y * 0.2) continue;
          const x = Math.min(15, Math.floor((positions.getX(index) - bounds.min.x) / size.x * 16));
          const z = Math.min(15, Math.floor((positions.getZ(index) - bounds.min.z) / size.z * 16));
          const cell = x * 16 + z, previous = cells.get(cell);
          if (previous === undefined || y < positions.getY(previous)) cells.set(cell, index);
        }
        footSamples.push({ mesh: child, indices: [...cells.values()] });
      });
      if (character === 'fuzzy' && v5Preview && !params.has('flatFur')) model.userData.disposeShortFur = params.has('shortFur')
        ? addFuzzyShortFur(model, { standing: true, length: 0.018 }) : addFuzzyPlushFur(model);
      modelState.status = 'ready';
    }).catch(error => { if (request === modelRequest) { console.warn('Character loader unavailable; using fallback', error); modelState.status = 'fallback'; } });
  }
  if (rigPreview || params.has('testFuzzyModel')) setCharacter('fuzzy');
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.78, 24), new THREE.MeshBasicMaterial({ color: 0x314c32, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.07; scene.add(shadow);
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), new THREE.MeshBasicMaterial({ color: 0x65e4e4, transparent: true, opacity: 0.55, depthWrite: false, wireframe: true }));
  aura.position.y = 1; player.add(aura);
  const dashRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.065, 6, 32), new THREE.MeshBasicMaterial({ color: 0xa3fff0, transparent: true, opacity: 0.9, depthWrite: false }));
  dashRing.rotation.x = Math.PI / 2; dashRing.position.y = 0.75; player.add(dashRing);
  const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0x65d8f6, transparent: true, opacity: 0.19, depthWrite: false, wireframe: true }));
  shieldBubble.position.y = 1.1; player.add(shieldBubble);
  const magnetRing = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.08, 6, 30), new THREE.MeshBasicMaterial({ color: 0xffae3b, transparent: true, opacity: 0.95, depthWrite: false }));
  magnetRing.position.y = 1.05; player.add(magnetRing);
  const magnetBeads = Array.from({ length: 3 }, () => {
    const bead = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xffc45c, depthWrite: false }));
    bead.scale.setScalar(0.12); player.add(bead); return bead;
  });
  const obstacleViews = new Map(), pickupViews = new Map();
  const warningMarkers = [-1, 0, 1].map(lane => {
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.9, 24), new THREE.MeshBasicMaterial({ color: 0xff7e27, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.set(lane * LANE_WIDTH, 0.09, -9); marker.visible = false; scene.add(marker); return marker;
  });
  const obstacleReady = {};
  const obstacleMaterials = sceneV2 ? Object.fromEntries(Object.entries(SCENE_OBSTACLES).flatMap(([mapId, types]) => Object.values(types).map(name => [name, new THREE.SpriteMaterial({
    map: new THREE.TextureLoader().load(`./assets/obstacles/${sceneVersion(mapId)}/${name}.png`, texture => { texture.colorSpace = THREE.SRGBColorSpace; obstacleReady[name] = true; }, undefined, () => { obstacleReady[name] = false; }),
    transparent: true, alphaTest: 0.08, depthWrite: false, toneMapped: false
  })]))) : {};
  function makeObstacle(ob, mapId) {
    const group = new THREE.Group(); scene.add(group);
    if (ob.type === 'animal') {
      const fallback = new THREE.Group(); group.add(fallback);
      ball(0x77513c, 0, 0.56, 0, 0.66, 0.52, 0.43, fallback);
      ball(0x77513c, 0, 1.12, 0.05, 0.38, 0.36, 0.34, fallback);
      for (const x of [-0.24, 0.24]) mesh(coneGeo, 0x654335, x, 1.46, 0.05, 0.2, 0.42, 0.18, fallback);
      const icon = sceneV2 && wildlifeMaterials[mapId] ? new THREE.Sprite(wildlifeMaterials[mapId]) : null;
      if (icon) { icon.scale.set(2, 2, 1); icon.position.y = 1; group.add(icon); }
      group.userData = { theme: mapId, visualKind: WILDLIFE[mapId], icon, fallbackParts: [fallback], wildlifeMap: mapId };
      return group;
    }
    if (sceneV2 && SCENE_PLANTS[mapId]) {
      group.userData.theme = mapId;
      if (mapId === 'china' && ob.type === 'crate') {
        box(0xb89055, 0, 0.55, 0, 1.55, 1.1, 1, group);
        for (const x of [-0.56, -0.18, 0.18, 0.56]) box(0x6d914d, x, 0.56, 0.53, 0.1, 1.06, 0.08, group);
        box(0x416e43, 0, 1.1, 0, 1.65, 0.12, 1.1, group);
      } else if (mapId === 'china' && ob.type === 'log') {
        for (const y of [0.33, 0.65]) {
          const culm = mesh(new THREE.CylinderGeometry(0.19, 0.22, 1.72, 8), 0x6f9b52, 0, y, 0, 1, 1, 1, group); culm.rotation.z = Math.PI / 2;
        }
        for (const x of [-0.5, 0.5]) box(0xb19658, x, 0.49, 0.21, 0.1, 0.73, 0.1, group);
      } else if (mapId === 'china') {
        for (const x of [-0.98, 0.98]) box(0x628d4e, x, 1.06, 0, 0.16, 2.12, 0.18, group);
        box(0x628d4e, 0, 1.78, 0, 2.1, 0.65, 0.34, group);
        for (const x of [-0.63, 0, 0.63]) ball(0x75a65a, x, 2.13, 0.08, 0.48, 0.27, 0.32, group);
      } else if (mapId === 'europe' || mapId === 'amazon') {
        const wood = mapId === 'europe' ? 0x665a48 : 0x66503a, leaf = mapId === 'europe' ? 0x366455 : 0x3d8151;
        if (ob.type === 'branch') {
          for (const x of [-0.98, 0.98]) box(wood, x, 1.08, 0, 0.2, 2.16, 0.22, group);
          box(wood, 0, 1.82, 0, 2.15, 0.38, 0.3, group);
          for (const x of [-0.6, 0, 0.6]) ball(leaf, x, 2.1, 0, 0.45, 0.2, 0.3, group);
        } else if (ob.type === 'log') {
          const trunk = mesh(new THREE.CylinderGeometry(0.44, 0.46, 1.75, 8), wood, 0, 0.47, 0, 1, 1, 1, group); trunk.rotation.z = Math.PI / 2;
        } else {
          for (const x of [-0.5, 0, 0.5]) box(wood, x, 0.47, 0, 0.45, 0.95, 0.72, group);
        }
      } else if (ob.type === 'crate') {
        box(0x9f9b8b, 0, 0.2, 0, 1.45, 0.38, 1.02, group);
        box(0xb9b6a5, 0, 0.63, 0, 0.96, 0.68, 0.82, group);
        box(0x77796f, 0, 1.04, 0, 1.18, 0.16, 1.05, group);
        box(0x9f9b8b, 0, 1.23, 0, 0.74, 0.27, 0.7, group);
      } else if (ob.type === 'log') {
        const trunk = mesh(new THREE.CylinderGeometry(0.43, 0.47, 1.72, 9), 0x806c5d, 0, 0.47, 0, 1, 1, 1, group); trunk.rotation.z = Math.PI / 2;
        for (const x of [-0.55, 0.45]) ball(0xeeb9ce, x, 0.86, -0.08, 0.27, 0.12, 0.22, group);
      } else {
        for (const x of [-0.98, 0.98]) box(0x715c53, x, 1.07, 0, 0.16, 2.14, 0.2, group);
        box(0x715c53, 0, 1.8, 0, 2.08, 0.62, 0.28, group);
        for (const x of [-0.65, 0, 0.65]) ball(0xf1b8cf, x, 2.14, 0.1, 0.47, 0.3, 0.3, group);
      }
      if (SCENE_OBSTACLES[mapId]) {
        const name = SCENE_OBSTACLES[mapId][ob.type];
        const fallbackParts = [...group.children];
        const icon = new THREE.Sprite(obstacleMaterials[name]);
        const size = ob.type === 'branch' ? [2.35, 2.65] : ob.type === 'crate' ? [1.9, 1.5] : [2.05, 1.05];
        icon.scale.set(size[0], size[1], 1); icon.position.y = size[1] / 2; group.add(icon);
        group.userData.visualKind = name; group.userData.icon = icon; group.userData.fallbackParts = fallbackParts;
      }
      return group;
    }
    if (ob.type === 'branch') {
      box(0x6b5b3e, -0.98, 1.1, 0, 0.17, 2.2, 0.24, group); box(0x6b5b3e, 0.98, 1.1, 0, 0.17, 2.2, 0.24, group);
      box(0x866a41, 0, 1.74, 0, 2.14, 0.76, 0.58, group);
      for (let i = -1; i <= 1; i++) ball(0x3d8054, i * 0.67, 2.15, 0, 0.52, 0.3, 0.48, group);
      const arrow = mesh(coneGeo, 0xffe7a0, 0, 1.75, 0.35, 0.45, -0.45, 0.12, group); arrow.rotation.z = 0;
    } else if (ob.type === 'log') {
      const geo = new THREE.CylinderGeometry(0.48, 0.48, 1.65, 10);
      const log = mesh(geo, 0x806448, 0, 0.49, 0, 1, 1, 1, group); log.rotation.z = Math.PI / 2;
      for (const x of [-0.84, 0.84]) { const end = mesh(new THREE.CircleGeometry(0.39, 10), 0xdbc093, x, 0.49, 0, 1, 1, 1, group); end.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; }
      mesh(coneGeo, 0xffdf8e, 0, 0.68, 0.46, 0.4, 0.34, 0.08, group);
    } else {
      box(0xaa7f4f, 0, 0.57, 0, 1.58, 1.14, 1.02, group);
      for (const y of [0.13, 1.02]) box(0xe0b772, 0, y, 0.55, 1.65, 0.16, 0.12, group);
      for (const x of [-0.68, 0.68]) box(0xe0b772, x, 0.57, 0.56, 0.14, 1.06, 0.13, group);
      mesh(coneGeo, 0xffe8a2, 0, 0.57, 0.58, 0.4, 0.4, 0.08, group);
    }
    return group;
  }
  const acornGeo = new THREE.SphereGeometry(0.19, 7, 5);
  const itemLoader = new THREE.TextureLoader();
  const wildlifeReady = {};
  const wildlifeMaterials = sceneV2 ? Object.fromEntries(Object.entries(WILDLIFE).map(([mapId, name]) => [mapId, new THREE.SpriteMaterial({
    map: itemLoader.load(`./assets/wildlife/v1-test/${name}.png`, texture => { texture.colorSpace = THREE.SRGBColorSpace; wildlifeReady[mapId] = true; }, undefined, () => { wildlifeReady[mapId] = false; }),
    transparent: true, alphaTest: 0.08, depthWrite: false, toneMapped: false
  })])) : {};
  const itemReady = { shield: false, magnet: false };
  const itemMaterials = Object.fromEntries(['shield', 'magnet'].map(kind => [kind, new THREE.SpriteMaterial({
    map: itemLoader.load(`./assets/items/${kind}.png`, () => { itemReady[kind] = true; }), transparent: true, depthWrite: false, toneMapped: false
  })]));
  const sceneItemReady = {};
  const sceneItemMaterials = sceneV2 ? Object.fromEntries(['acorn', 'bamboo-shoot', 'cherry-blossom', 'pine-cone', 'cacao-pod', 'shield', 'magnet', 'double', 'dash-refill', 'heal-berry', 'golden-seed', 'poison-mushroom', 'sticky-web'].map(kind => [kind, new THREE.SpriteMaterial({
    map: itemLoader.load(`./assets/items/${['heal-berry', 'golden-seed', 'poison-mushroom', 'sticky-web'].includes(kind) ? 'v4-test' : kind === 'pine-cone' || kind === 'cacao-pod' ? 'v3' : 'v2'}/${kind}.png`, () => { sceneItemReady[kind] = true; }, undefined, () => { sceneItemReady[kind] = false; }), transparent: true, depthWrite: false, toneMapped: false
  })])) : {};
  function addAcorn(parent) {
    mesh(acornGeo, 0xd69235, 0, 0, 0, 1, 1.2, 1, parent);
    mesh(ballGeo, 0x895e33, 0, 0.17, 0, 0.215, 0.08, 0.215, parent);
    box(0x6a5736, 0, 0.26, 0, 0.055, 0.12, 0.055, parent);
  }
  function makePickup(kind, mapId) {
    const g = new THREE.Group(); scene.add(g);
    if (sceneV2 && SCENE_PLANTS[mapId] && sceneItemMaterials[kind || 'acorn']) {
      const fallback = new THREE.Group(); g.add(fallback);
      if (kind === 'poison-mushroom' || kind === 'sticky-web') ball(kind === 'poison-mushroom' ? 0x8c58bc : 0x665caa, 0, 0, 0, 0.35, 0.35, 0.35, fallback);
      else addAcorn(fallback);
      const legacy = itemMaterials[kind] ? new THREE.Sprite(itemMaterials[kind]) : null;
      if (legacy) { legacy.scale.set(1.55, 1.55, 1); g.add(legacy); }
      const icon = new THREE.Sprite(sceneItemMaterials[kind || 'acorn']); icon.scale.set(1.55, 1.55, 1); g.add(icon);
      g.userData = { fallback, legacy, icon, v2: true, visualKind: kind || 'acorn' };
    } else if (itemMaterials[kind]) {
      const fallback = new THREE.Group(); g.add(fallback); addAcorn(fallback);
      const icon = new THREE.Sprite(itemMaterials[kind]); icon.scale.set(1.55, 1.55, 1); g.add(icon);
      g.userData = { fallback, icon };
    } else addAcorn(g);
    return g;
  }
  const particles = [];
  const particleMaterials = Object.fromEntries(Object.entries({ gold: 0xffdf89, 'bamboo-shoot': 0xb4db69, 'cherry-blossom': 0xf5a9ca, 'pine-cone': 0xeec279, 'cacao-pod': 0xffbd68, shield: 0x68e6fb, magnet: 0xffba6a, double: 0x528fee, 'dash-refill': 0x36e2c4, 'heal-berry': 0xff6d81, 'golden-seed': 0xffd254, 'poison-mushroom': 0xa675ce, 'sticky-web': 0x8a87b9 }).map(([key, color]) => [key, new THREE.MeshBasicMaterial({ color })]));
  for (let i = 0; i < 28; i++) { const p = new THREE.Mesh(ballGeo, particleMaterials.gold); p.visible = false; scene.add(p); particles.push({ mesh: p, age: 0, vx: 0, vy: 0, vz: 0 }); }
  function burst(x, z, count = 10, color = 'gold', y = 0.8) {
    particles.filter(p => p.age <= 0).slice(0, count).forEach((p, i) => {
      p.age = 0.7; p.mesh.position.set(x, y, z); p.mesh.material = particleMaterials[color] || particleMaterials.gold; p.mesh.scale.setScalar(0.08 + noise(i) * 0.07);
      p.vx = (noise(i + 20) - 0.5) * 7; p.vy = 2 + noise(i + 3) * 3; p.vz = (noise(i + 30) - 0.5) * 6; p.mesh.visible = true;
    });
  }
  function resetEffects() { particles.forEach(particle => { particle.age = 0; particle.mesh.visible = false; }); }
  function cleanViews(map, entities) {
    const ids = new Set(entities.map(e => e.id));
    for (const [id, object] of map) if (!ids.has(id)) {
      scene.remove(object);
      object.traverse(child => { if (child.geometry && ![boxGeo, ballGeo, trunkGeo, coneGeo, acornGeo].includes(child.geometry)) child.geometry.dispose(); });
      map.delete(id);
    }
  }
  function resetViews() { cleanViews(obstacleViews, []); cleanViews(pickupViews, []); }
  let portrait = false, cameraReady = false, previewMapId = null, activeMapId = null;
  const plantTextures = new Map(), requestedPlants = new Set();
  function applyScenePlants(mapId) {
    const textures = plantTextures.get(mapId);
    const ready = !!(sceneV2 && textures && SCENE_PLANTS[mapId]);
    for (const old of [trunks, leavesA, leavesB]) old.visible = !ready;
    plantLayers.forEach((layer, index) => {
      layer.visible = ready;
      const useFog = mapId === 'china' || mapId === 'japan';
      if (layer.material.fog !== useFog) { layer.material.fog = useFog; layer.material.needsUpdate = true; }
      if (ready && layer.material.map !== textures[index]) { layer.material.map = textures[index]; layer.material.needsUpdate = true; }
    });
    if (!sceneV2 || !SCENE_PLANTS[mapId] || requestedPlants.has(mapId)) return;
    requestedPlants.add(mapId);
    const loaded = [];
    SCENE_PLANTS[mapId].forEach((name, index) => {
      itemLoader.load(`./assets/scenes/${sceneVersion(mapId)}/${name}.png`, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        loaded[index] = texture;
        if (loaded[0] && loaded[1]) {
          plantTextures.set(mapId, loaded);
          if (activeMapId === mapId) applyScenePlants(mapId);
        }
      }, undefined, () => { if (activeMapId === mapId) applyScenePlants(mapId); });
    });
  }
  const photos = new Map(), requestedPhotos = new Set();
  const backgroundLoader = new THREE.TextureLoader();
  function applyBackground(mapId) {
    const shape = portrait ? 'portrait' : 'landscape', key = `${mapId}-${shape}`;
    if (!requestedPhotos.has(key)) {
      requestedPhotos.add(key);
      backgroundLoader.load(`./assets/backgrounds/${mapId}-${shape}-v1.jpg`, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        photos.set(key, texture);
        if (activeMapId === mapId && (portrait ? 'portrait' : 'landscape') === shape) { scene.background = texture; distantHills.visible = false; }
      }, undefined, () => {});
    }
    const photo = photos.get(key);
    scene.background = photo || new THREE.Color(MAP_LOOKS[mapId].sky);
    distantHills.visible = !photo;
  }
  function setMap(mapId) { previewMapId = MAP_LOOKS[mapId] ? mapId : MAPS[0].id; }
  function applyMap(mapId) {
    if (mapId === activeMapId) return;
    if (sceneV2) { resetViews(); resetEffects(); }
    activeMapId = mapId;
    const look = MAP_LOOKS[mapId] || MAP_LOOKS.china;
    applyBackground(mapId);
    scene.fog.color.setHex(look.sky);
    scene.fog.near = mapId === 'europe' || mapId === 'amazon' ? 75 : 38;
    scene.fog.far = mapId === 'europe' || mapId === 'amazon' ? 190 : 155;
    ground.material.color.setHex(look.ground); path.material.color.setHex(look.path);
    for (const [object, color] of [[trunks, look.trunk], [leavesA, look.crown], [leavesB, look.cone], [bank, look.bank], [petals, look.petals]]) object.material.color.setHex(color);
    applyScenePlants(mapId);
  }
  const cameraTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    portrait = h > w; renderer.setPixelRatio(Math.min(devicePixelRatio, portrait ? 1.2 : 1.6)); renderer.setSize(w, h, false); camera.aspect = w / h;
    if (activeMapId) applyBackground(activeMapId);
    camera.fov = portrait ? 62 : 52; camera.updateProjectionMatrix(); cameraReady = false;
  }
  resize();
  function draw(game, dt, clock) {
    const menu = game.mode === 'menu';
    const mapId = menu && previewMapId ? previewMapId : game.mapId;
    applyMap(mapId);
    const mountainRocks = sceneV2 && mapId === 'china' && CHINA_ROCKS.every(name => rockReady[name]);
    bank.visible = !mountainRocks;
    rockBank.forEach(layer => { layer.visible = mountainRocks; });
    const dist = menu ? clock * 1.1 : game.distance;
    const rockCounts = [0, 0];
    for (let i = 0; i < 100; i++) {
      const side = i % 2 ? 1 : -1, z = -wrap(Math.floor(i / 2) * 4.1 - dist);
      const x = side * (5.5 + noise(i + 4) * 16), scale = 0.8 + noise(i) * 0.9;
      if (mapId === 'china') {
        put(trunks, i, x, scale * 2.5, z, scale * 0.18, scale * 5, scale * 0.18);
        put(leavesA, i, x, scale * 5.1, z, scale * 0.55, scale * 0.24, scale * 0.6, i);
        put(leavesB, i, x + side * 0.3, scale * 5.5, z - 0.3, scale * 0.55, scale * 0.65, scale * 0.55, i);
      } else if (mapId === 'japan') {
        put(trunks, i, x, scale * 2, z, scale, scale * 4, scale);
        put(leavesA, i, x, scale * 4.5, z, scale * 2.4, scale * 1.75, scale * 2.2, i);
        put(leavesB, i, x + side * 1.1, scale * 5.2, z - 0.3, scale * 1.1, scale * 1.2, scale * 1.1, i);
      } else if (mapId === 'europe') {
        put(trunks, i, x, scale * 2.5, z, scale * 0.9, scale * 5, scale * 0.9);
        put(leavesA, i, x, scale * 4.5, z, scale * 0.1, scale * 0.1, scale * 0.1, i);
        put(leavesB, i, x, scale * 5.5, z - 0.3, scale * 2.1, scale * 5.2, scale * 2.1, i);
      } else {
        put(trunks, i, x, scale * 2.4, z, scale * 1.25, scale * 4.8, scale * 1.25);
        put(leavesA, i, x, scale * 5.2, z, scale * 2.7, scale * 2.2, scale * 2.7, i);
        put(leavesB, i, x + side * 1.2, scale * 6, z - 0.3, scale * 1.2, scale * 2, scale * 1.2, i);
      }
      put(bank, i, side * (4.6 + noise(i + 8)), 0.1, z, 0.8, 0.45 + noise(i) * 0.5, 1.1);
      if (mountainRocks) {
        const variation = Math.floor(i / 2) % 2, scale = 0.8 + noise(i + 9) * 0.45;
        put(rockBank[variation], rockCounts[variation]++, side * (5.1 + noise(i + 8) * 0.7), scale * 0.48, z, scale * 1.75, scale * 1.15, 1);
      }
    }
    if (mountainRocks) rockBank.forEach(layer => { layer.instanceMatrix.needsUpdate = true; });
    if (plantLayers[0]?.visible) for (const [layerIndex, layer] of plantLayers.entries()) {
      for (let i = 0; i < 20; i++) {
        const side = i % 2 ? 1 : -1, z = -wrap(Math.floor(i / 2) * 18 + layerIndex * 8 - dist);
        const x = side * (9.5 + noise(i + layerIndex * 20) * 5), scale = 0.85 + noise(i + 4) * 0.5;
        const height = mapId === 'china' ? (layerIndex ? 8 : 10) : mapId === 'amazon' ? (layerIndex ? 7 : 11) : (layerIndex ? 6 : 8);
        put(layer, i, x, height * scale / 2, z, height * scale * (mapId === 'china' ? 0.72 : mapId === 'amazon' ? 1.2 : 1.05), height * scale, 1);
      }
      layer.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < 160; i++) {
      const side = i % 4, x = [-4, -1.25, 1.25, 4][side];
      put(gravel, i, x + (noise(i) - 0.5) * 0.04, 0.075, -wrap(Math.floor(i / 4) * 5 - dist), 0.06, 0.04, side === 0 || side === 3 ? 0.48 : 0.23);
    }
    for (let i = 0; i < 110; i++) {
      const x = (i % 2 ? 1 : -1) * (4.65 + noise(i) * 1.7);
      put(petals, i, x, 0.32, -wrap(i * 1.85 - dist), 0.12, 0.15, 0.12);
    }
    for (const batch of [trunks, leavesA, leavesB, bank, gravel, petals]) batch.instanceMatrix.needsUpdate = true;
    gate.position.z = menu ? -100 : -(game.map.goal - dist);
    flags.forEach((f, i) => { f.rotation.x = Math.sin(clock * 2 + i) * 0.15; });
    player.position.set(menu ? (portrait ? 0 : 0.4) : game.x, menu ? 0 : game.y, menu ? (portrait ? -16 : -1.5) : 0);
    player.rotation.y = menu ? Math.PI + Math.sin(clock * 0.4) * 0.16 : -game.x * 0.045;
    player.scale.setScalar(menu ? (portrait ? 1.7 : 1.35) : 1);
    const running = game.mode === 'running', phase = game.time * 14 * (game.speed / 12);
    const slide = !menu && game.slide > 0 && game.y < 0.1;
    const rigged = !!modelState.mixer;
    pose.scale.set(1, rigged ? 1 : slide ? 0.38 : game.landing > 0 && running ? 0.88 : 1, rigged ? 1 : slide ? 1.3 : 1);
    pose.position.y = rigged ? 0 : running && game.y === 0 && !slide ? Math.abs(Math.sin(phase)) * 0.055 : 0;
    pose.rotation.x = rigged ? 0 : !menu && game.dash > 0 ? -0.23 : game.y > 0 ? -0.08 : 0;
    limbs.forEach((limb, i) => { limb.rotation.x = running && game.y === 0 ? Math.sin(phase + (i < 2 ? 0 : Math.PI)) * (i % 2 ? -0.55 : 0.7) : 0; });
    if (rigged) {
      const clip = menu ? 'idle' : game.mode === 'complete' ? 'win' : game.mode === 'over' ? 'hurt' : game.glide > 0 ? 'glide' : game.dash > 0 ? 'dash' : slide ? 'slide'
        : game.y > 0 ? game.vy > 0 ? 'jump' : 'fall' : game.landing > 0 ? 'land'
        : game.invincible > 1.45 ? 'hurt' : 'run';
      if (clip !== modelState.active) {
        modelState.actions[modelState.active]?.fadeOut(0.12);
        modelState.actions[clip]?.reset().fadeIn(0.12).play();
        modelState.active = clip;
      }
      if (modelState.actions.run) modelState.actions.run.timeScale = Math.min(2.4, 1.55 + Math.max(0, game.speed - 18) * 0.045);
      modelState.mixer.update(dt);
      if (footSamples.length && (menu || game.y === 0 && game.vy <= 0)) {
        player.updateMatrixWorld(true);
        let sole = Infinity;
        for (const { mesh, indices } of footSamples) {
          mesh.skeleton.update();
          for (const index of indices) sole = Math.min(sole, mesh.getVertexPosition(index, footPoint).applyMatrix4(mesh.matrixWorld).y);
        }
        pose.position.y = (0.07 - sole) / player.scale.y;
      }
    }
    tail.rotation.y = Math.sin(clock * 5) * 0.35; flap.rotation.x = -0.4 + Math.sin(clock * 12) * 0.15;
    head.rotation.z = menu ? Math.sin(clock) * 0.04 : 0;
    aura.visible = !menu && game.dash > 0; aura.rotation.y = clock * 5; aura.scale.setScalar(1 + Math.sin(clock * 18) * 0.06);
    dashRing.visible = aura.visible; dashRing.rotation.z = clock * 6;
    shieldBubble.visible = !menu && game.shield > 0; shieldBubble.rotation.y = clock * 0.8;
    magnetRing.visible = !menu && game.magnet > 0; magnetRing.rotation.y = clock * 3; magnetRing.rotation.z = Math.sin(clock * 3) * 0.2;
    magnetBeads.forEach((bead, i) => { const angle = clock * 5 + i * Math.PI * 2 / 3; bead.visible = magnetRing.visible; bead.position.set(Math.cos(angle) * 1.08, 1.1 + Math.sin(clock * 6 + i) * 0.2, Math.sin(angle) * 0.72); });
    pose.visible = menu || game.invincible <= 0 || Math.floor(clock * 14) % 2 === 0;
    shadow.position.x = player.position.x; shadow.position.z = player.position.z;
    shadow.scale.setScalar(menu ? 1.4 : 1 - Math.min(game.y, 2) * 0.18); shadow.material.opacity = 0.22 - Math.min(game.y, 2) * 0.055;
    cleanViews(obstacleViews, game.obstacles); cleanViews(pickupViews, game.pickups);
    warningMarkers.forEach((marker, index) => {
      marker.visible = running && game.obstacles.some(ob => ob.type === 'animal' && ob.warned && !ob.passed && !ob.broken && ob.lane === index - 1 && ob.distance > game.distance - 1.7);
      marker.material.opacity = 0.65 + Math.sin(clock * 12) * 0.25;
      marker.scale.setScalar(1 + Math.sin(clock * 12) * 0.1);
    });
    for (const ob of game.obstacles) {
      if (!obstacleViews.has(ob.id)) obstacleViews.set(ob.id, makeObstacle(ob, mapId));
      const object = obstacleViews.get(ob.id); object.position.set(ob.lane * LANE_WIDTH, ob.type === 'animal' ? Math.sin(clock * (ob.rushing ? 16 : 4) + ob.id) * 0.045 : 0, -(ob.distance - game.distance)); object.visible = !ob.broken && !menu;
      if (object.userData.icon) {
        const ready = object.userData.wildlifeMap ? !!wildlifeReady[object.userData.wildlifeMap] : !!obstacleReady[object.userData.visualKind];
        object.userData.icon.visible = ready;
        object.userData.fallbackParts.forEach(part => { part.visible = !ready; });
      }
    }
    for (const coin of game.pickups) {
      const visualKind = !coin.kind || coin.kind === 'acorn' ? game.collectible.kind : coin.kind;
      if (!pickupViews.has(coin.id)) pickupViews.set(coin.id, makePickup(visualKind, mapId));
      const object = pickupViews.get(coin.id); object.position.set(coin.lane * LANE_WIDTH, coin.y + Math.sin(clock * 3 + coin.id) * 0.06, -(coin.distance - game.distance)); object.rotation.y = clock * 1.8; object.visible = !coin.taken && !menu;
      if (object.userData.icon) {
        const ready = object.userData.v2 ? sceneItemReady[object.userData.visualKind] : itemReady[coin.kind];
        object.userData.icon.visible = !!ready;
        if (object.userData.legacy) object.userData.legacy.visible = !ready && !!itemReady[coin.kind];
        object.userData.fallback.visible = !ready && !(object.userData.legacy && itemReady[coin.kind]);
      }
    }
    for (const p of particles) if (p.age > 0) { p.age -= dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += (p.vz + game.speed) * dt; p.vy -= 9 * dt; p.mesh.visible = p.age > 0 && !menu; }
    if (menu) { cameraTarget.set(portrait ? 0 : 7.8, portrait ? 7.5 : 6.2, portrait ? 12 : 11); lookTarget.set(portrait ? 0 : -4, 0.8, portrait ? -5 : -10); }
    else { cameraTarget.set(game.x * 0.12, portrait ? 6.3 : 5, portrait ? 11.5 : 10.5); lookTarget.set(game.x * 0.08, 0.6, portrait ? -13 : -16); }
    camera.position.lerp(cameraTarget, cameraReady ? 1 - Math.exp(-dt * 5) : 1); camera.lookAt(lookTarget); cameraReady = true;
    renderer.render(scene, camera);
  }
  const getSceneV2State = () => ({ enabled: sceneV2, mapId: activeMapId, backgroundPhoto: !!scene.background?.isTexture, plantsReady: plantLayers[0]?.visible || false, oldTreesVisible: trunks.visible,
    rocksReady: rockBank.length > 0 && rockBank.every(layer => layer.visible), oldBankVisible: bank.visible,
    obstacleThemes: [...obstacleViews.values()].map(view => view.userData.theme).filter(Boolean).sort(),
    obstacleVisuals: [...new Set([...obstacleViews.values()].map(view => view.userData.visualKind).filter(Boolean))].sort(),
    obstacleFallbacks: [...obstacleViews.values()].filter(view => view.userData.icon && !view.userData.icon.visible).length,
    pickupVisuals: [...new Set([...pickupViews.values()].map(view => view.userData.visualKind).filter(Boolean))].sort(),
    pickupFallbacks: [...pickupViews.values()].filter(view => view.userData.fallback?.visible).length,
    wildlifeReady: !!wildlifeReady[activeMapId],
    warningLanes: warningMarkers.map((marker, index) => marker.visible ? index - 1 : null).filter(lane => lane !== null),
    pixelRatio: renderer.getPixelRatio(),
    particlesActive: particles.filter(particle => particle.age > 0).length,
    drawCalls: renderer.info.render.calls, textures: renderer.info.memory.textures });
  return { draw, resize, burst, resetEffects, resetViews, setMap, setCharacter, renderer, modelState, getSceneV2State };
}
