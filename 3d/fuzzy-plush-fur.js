import * as THREE from './vendor/three.module.js';

const FUR_TEXTURE = new URL('./assets/chars/fuzzy/v6-test/textures/fuzzy-ivory-short-fur-v1.png', import.meta.url).href;

// The added short hairs are rendering geometry only; the base GLB/rig stays untouched.
export function addFuzzyPlushFur(model, { strands = 180000, length = 0.038, standing = true } = {}) {
  const sources = [];
  model.traverse(mesh => {
    if (mesh.isSkinnedMesh && !mesh.userData.furShell && !Array.isArray(mesh.material) && mesh.material.map) sources.push(mesh);
  });
  let seed = 7319;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const a = new THREE.Vector3(), b = a.clone(), c = a.clone(), n = a.clone();
  const root = a.clone(), tangent = a.clone(), cross = a.clone(), direction = a.clone(), comb = a.clone();
  const tables = sources.map(source => {
    const { position, normal } = source.geometry.attributes;
    const index = source.geometry.index;
    const cumulative = [], faces = [];
    let area = 0;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      a.fromBufferAttribute(position, ids[0]); b.fromBufferAttribute(position, ids[1]); c.fromBufferAttribute(position, ids[2]);
      const size = b.sub(a).cross(c.sub(a)).length() * 0.5;
      if (size < 1e-10) continue;
      area += size; cumulative.push(area); faces.push(ids);
    }
    return { source, position, normal, faces, cumulative, area };
  });
  const totalArea = tables.reduce((sum, table) => sum + table.area, 0);
  const hairs = [];
  let disposed = false;
  const texture = new THREE.TextureLoader().load(FUR_TEXTURE, () => {
    if (disposed) { texture.dispose(); return; }
    for (const hair of hairs) hair.visible = true;
    model.userData.shortFurReady = true;
  }, undefined, () => { model.userData.shortFurReady = false; });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;

  for (const table of tables) {
    const { source, position, normal, faces, cumulative, area } = table;
    const count = Math.round(strands * area / totalArea);
    const positions = new Float32Array(count * 8 * 3), normals = new Float32Array(positions.length);
    const uvs = new Float32Array(count * 8 * 2), fiberUvs = new Float32Array(count * 8 * 2), joints = new Uint16Array(count * 8 * 4);
    const weights = new Float32Array(joints.length), indices = new Uint32Array(count * 12);
    const attributes = source.geometry.attributes;
    for (let hair = 0; hair < count; hair++) {
      const target = random() * area;
      let low = 0, high = cumulative.length - 1;
      while (low < high) { const mid = (low + high) >>> 1; if (cumulative[mid] < target) low = mid + 1; else high = mid; }
      const ids = faces[low], s = Math.sqrt(random()), t = random(), bary = [1 - s, s * (1 - t), s * t];
      root.set(0, 0, 0); n.set(0, 0, 0);
      const uv = [0, 0], influence = new Map();
      for (let corner = 0; corner < 3; corner++) {
        a.fromBufferAttribute(position, ids[corner]); root.addScaledVector(a, bary[corner]);
        a.fromBufferAttribute(normal, ids[corner]); n.addScaledVector(a, bary[corner]);
        uv[0] += attributes.uv.getX(ids[corner]) * bary[corner]; uv[1] += attributes.uv.getY(ids[corner]) * bary[corner];
        for (let channel = 0; channel < 4; channel++) {
          const joint = attributes.skinIndex.getComponent(ids[corner], channel);
          influence.set(joint, (influence.get(joint) || 0) + attributes.skinWeight.getComponent(ids[corner], channel) * bary[corner]);
        }
      }
      n.normalize();
      const skin = [...influence].sort((left, right) => right[1] - left[1]).slice(0, 4);
      const sum = skin.reduce((value, pair) => value + pair[1], 0);
      // No fur below the paw support band; underside hairs are shorter, not buried in the path.
      const foot = THREE.MathUtils.smoothstep(root.y, standing ? -0.93 : 0.035, standing ? -0.85 : 0.12);
      const down = THREE.MathUtils.lerp(0.20, 1, THREE.MathUtils.smoothstep(n.y, -0.75, 0.1));
      const size = length * (0.45 + random() * 0.75) * foot * down;
      const width = (0.00045 + random() * 0.0003) * foot;
      const head = THREE.MathUtils.smoothstep(root.y, 0.18, 0.5);
      comb.set(root.x * head * 0.65, -0.8, -0.12).addScaledVector(n, -comb.dot(n)).normalize();
      tangent.copy(Math.abs(n.y) < 0.9 ? b.set(0, 1, 0) : b.set(1, 0, 0)).cross(n).normalize();
      cross.crossVectors(n, tangent).normalize();
      const angle = random() * Math.PI;
      direction.copy(tangent).multiplyScalar(Math.cos(angle)).addScaledVector(cross, Math.sin(angle));
      tangent.copy(direction); cross.crossVectors(n, tangent).normalize();
      for (let plane = 0; plane < 2; plane++) {
        direction.copy(plane ? cross : tangent);
        for (let vertex = 0; vertex < 4; vertex++) {
          const offset = (hair * 8 + plane * 4 + vertex);
          a.copy(root).addScaledVector(n, 0.0003);
          if (vertex < 2) a.addScaledVector(direction, width * (vertex === 0 ? -0.5 : 0.5));
          else {
            const height = vertex === 2 ? 0.52 : 1;
            a.addScaledVector(n, size * height * 0.43);
            a.addScaledVector(comb, size * height * height * 0.91);
            a.y -= size * height * height * 0.06;
            if (vertex === 2) a.addScaledVector(direction, -width * 0.27);
          }
          a.toArray(positions, offset * 3); n.toArray(normals, offset * 3); uvs.set(uv, offset * 2);
          fiberUvs.set([[0, 0], [1, 0], [0.23, 0.52], [0.5, 1]][vertex], offset * 2);
          for (let channel = 0; channel < 4; channel++) {
            joints[offset * 4 + channel] = skin[channel]?.[0] || 0;
            weights[offset * 4 + channel] = (skin[channel]?.[1] || 0) / sum;
          }
        }
        const vertex = hair * 8 + plane * 4;
        indices.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], hair * 12 + plane * 6);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('fiberUv', new THREE.BufferAttribute(fiberUvs, 2));
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const isHead = !source.material.name.includes('plush_body') && !source.material.name.includes('plush_tail');
    const material = source.material.clone();
    material.name = source.material.name + '-short-fibers';
    material.transparent = true;
    material.opacity = 0.8;
    material.depthWrite = false;
    material.forceSinglePass = true;
    material.alphaTest = 0.12;
    material.alphaToCoverage = false;
    material.side = THREE.DoubleSide;
    material.roughness = 1;
    material.metalness = 0;
    material.normalMap = null;
    // A small albedo-colored fill approximates light transmitted through soft fibers.
    material.emissive.setRGB(0, 0, 0);
    material.emissiveMap = null;
    material.onBeforeCompile = shader => {
      shader.uniforms.furTexture = { value: texture };
      shader.uniforms.furHead = { value: isHead ? 1 : 0 };
      shader.uniforms.furStanding = { value: standing ? 1 : 0 };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vFurRest;
attribute vec2 fiberUv;
varying vec2 vFiberUv;
`).replace('#include <begin_vertex>', `#include <begin_vertex>
vFurRest = position;
vFiberUv = fiberUv;
`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
// Both faces represent one fiber with the coat's OUTWARD surface normal.
// Three's usual back-face flip would otherwise turn half the hair into dark stubble.
#ifdef DOUBLE_SIDED
normal *= faceDirection;
#endif
`).replace('#include <common>', `#include <common>
uniform sampler2D furTexture;
uniform float furHead;
uniform float furStanding;
varying vec3 vFurRest;
varying vec2 vFiberUv;
`).replace('#include <map_fragment>', `#include <map_fragment>
// The approved short-plush image modulates the fibers; source albedo still supplies their color.
float furDetail = texture2D(furTexture, vFurRest.xy * 0.85).r;
diffuseColor.rgb *= mix(0.92, 1.02, furDetail) * mix(0.85, 1.04, vFiberUv.y);
diffuseColor.a *= smoothstep(0.0, 0.19, vFiberUv.x) * (1.0 - smoothstep(0.81, 1.0, vFiberUv.x));
diffuseColor.a *= 1.0 - smoothstep(0.75, 1.0, vFiberUv.y);
if (furHead > 0.5) {
  vec3 furAlbedo = sampledDiffuseColor.rgb;
  float furLight = dot(furAlbedo, vec3(0.299, 0.587, 0.114));
  float furBlue = smoothstep(0.025, 0.08, furAlbedo.b - furAlbedo.r);
  float furPink = smoothstep(0.055, 0.14, furAlbedo.r - furAlbedo.g);
  diffuseColor.a *= (1.0 - furBlue) * (1.0 - furPink) * smoothstep(0.045, 0.13, furLight);
  // Source albedo blue-ring samples locate the eye disks at x +/- .238,
  // y 1.04, with x/y radii .12/.13; a small margin also protects white glints.
  vec2 furEyeCenter = mix(vec2(0.238, 1.04), vec2(0.265, 0.34), furStanding);
  vec2 furEyeRadius = mix(vec2(0.137, 0.15), vec2(0.19, 0.22), furStanding);
  vec2 furEyePoint = (vec2(abs(vFurRest.x), vFurRest.y) - furEyeCenter) / furEyeRadius;
  float furEye = (1.0 - smoothstep(0.95, 1.08, length(furEyePoint))) * smoothstep(mix(0.745, 0.30, furStanding), mix(0.77, 0.34, furStanding), vFurRest.z);
  diffuseColor.a *= 1.0 - furEye;
  // Only the small mouth-line patch is bare, not the entire white cheek/forehead.
  vec2 furMouthPoint = (vFurRest.xy - mix(vec2(0.0, 0.90), vec2(0.0, 0.10), furStanding)) / mix(vec2(0.085, 0.05), vec2(0.13, 0.14), furStanding);
  float furMouth = (1.0 - smoothstep(0.9, 1.1, length(furMouthPoint))) * smoothstep(mix(0.86, 0.35, furStanding), mix(0.90, 0.40, furStanding), vFurRest.z);
  diffuseColor.a *= 1.0 - furMouth;
  // Keep the standing character's collar and white printed scarf details bare.
  float furCollar = (1.0 - smoothstep(0.10, 0.14, abs(vFurRest.y + 0.08))) * (1.0 - smoothstep(0.38, 0.46, abs(vFurRest.x)));
  diffuseColor.a *= 1.0 - furStanding * furCollar;
}
`);
    };
    material.customProgramCacheKey = () => 'fuzzy-plush-fibers-v1';
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = source.name + '-short-fibers';
    mesh.userData.furShell = true;
    mesh.userData.furGeometryOwned = true;
    mesh.visible = false;
    mesh.position.copy(source.position); mesh.quaternion.copy(source.quaternion); mesh.scale.copy(source.scale);
    mesh.bindMode = source.bindMode; mesh.bind(source.skeleton, source.bindMatrix); mesh.bindMatrixInverse.copy(source.bindMatrixInverse);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = source.receiveShadow;
    source.parent.add(mesh); hairs.push(mesh);
  }
  model.userData.shortFurReady = false;
  model.userData.shortFurStrands = strands;
  model.userData.shortFurShells = hairs.length;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const mesh of hairs) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); }
    texture.dispose();
    model.userData.shortFurReady = false;
    model.userData.shortFurShells = 0;
  };
}
