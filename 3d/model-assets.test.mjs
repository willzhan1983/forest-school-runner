import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('./', import.meta.url);
const source = await readFile(new URL('world.js', root), 'utf8');
const modelPaths = [...source.matchAll(/'(\.\/assets\/chars\/[^']+\.glb)'/g)].map(match => match[1]);

test('every character model referenced by the renderer exists locally', async () => {
  assert.equal(modelPaths.length, 2);
  await Promise.all(modelPaths.map(path => access(new URL(path, root))));
  await access(new URL('vendor/meshopt_decoder.mjs', root));
  await access(new URL('vendor/meshoptimizer-LICENSE.md', root));
});

test('compressed Fuzzy keeps its skin and all nine named animation clips', async () => {
  const bytes = await readFile(new URL(modelPaths.find(path => path.includes('/fuzzy/')), root));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.ok(json.extensionsRequired.includes('EXT_meshopt_compression'));
  assert.ok(json.skins.length > 0);
  assert.deepEqual(json.animations.map(clip => clip.name).sort(),
    ['dash', 'fall', 'hurt', 'idle', 'jump', 'land', 'run', 'slide', 'win']);
  assert.ok(json.animations.every(clip => clip.channels.length > 0));
});
