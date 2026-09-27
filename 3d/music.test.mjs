import assert from 'node:assert/strict';
import test from 'node:test';
import { createMapMusic, MAP_MUSIC } from './music.js';

function fakeAudio() {
  const notes = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
  return {
    currentTime: 0, destination: {}, notes,
    resume() { return Promise.resolve(); },
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; },
    createOscillator() {
      const oscillator = { frequency: { value: 0 }, connect() {}, stop() {} };
      oscillator.start = () => notes.push({ frequency: oscillator.frequency.value, wave: oscillator.type });
      return oscillator;
    }
  };
}

test('all four maps have distinct background-music motifs', () => {
  assert.deepEqual(Object.keys(MAP_MUSIC).sort(), ['amazon', 'china', 'europe', 'japan']);
  assert.equal(new Set(Object.values(MAP_MUSIC).map(theme => theme.lead.join(','))).size, 4);
});

test('music switches maps without stacking loops and stops when muted or paused', () => {
  const context = fakeAudio(), music = createMapMusic();
  music.play('china', context);
  assert.deepEqual(music.state(), { mapId: 'china', playing: true });
  const firstNotes = context.notes.length;
  assert.ok(firstNotes > 0);
  music.play('china', context);
  assert.equal(context.notes.length, firstNotes, 'replaying the same map does not start another loop');
  music.play('japan', context);
  assert.deepEqual(music.state(), { mapId: 'japan', playing: true });
  assert.ok(context.notes.length > firstNotes);
  music.stop();
  assert.deepEqual(music.state(), { mapId: null, playing: false });
});
