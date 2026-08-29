import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('loads external CSS and JavaScript without inline game blocks', async () => {
  const html = await readProjectFile('index.html');

  assert.match(html, /href="css\/game\.css"/);
  assert.match(html, /src="js\/game\.js"/);
  assert.doesNotMatch(html, /<style>/);
  assert.doesNotMatch(html, /<script>/);
});

test('keeps the baseline runner compatibility anchors', async () => {
  const gameJs = await readProjectFile('js/game.js');

  for (const key of ['fsr_pic_', 'fsr_music', 'fsr_diff', 'fsr_best']) {
    assert.match(gameJs, new RegExp(key));
  }

  for (const marker of ['function doSlide', 'function doSkill', 'dashing', 'gliding', 'var DIFF']) {
    assert.match(gameJs, new RegExp(marker));
  }
});

test('keeps the legacy game URL pointed at the split entry page', async () => {
  const legacyHtml = await readProjectFile('forest-school-runner.html');

  assert.match(legacyHtml, /http-equiv="refresh" content="0; url=\.\/"/);
  assert.match(legacyHtml, /href="\.\/"/);
});
