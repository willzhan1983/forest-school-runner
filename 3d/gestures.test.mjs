import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceGesture } from './gestures.js';

const point = (x, y, id = 1) => ({ pointerId: id, clientX: x, clientY: y });
const down = () => reduceGesture(null, 'down', point(100, 100)).state;

test('fast release without move classifies all four swipe directions', () => {
  for (const [x, y, expected] of [[145, 105, 'right'], [55, 105, 'left'], [105, 55, 'jump'], [105, 145, 'slide']]) {
    const result = reduceGesture(down(), 'up', point(x, y));
    assert.equal(result.action, expected);
    assert.equal(result.state, null);
  }
});

test('move then release executes once even after changing direction', () => {
  const moved = reduceGesture(down(), 'move', point(130, 101));
  assert.equal(moved.action, 'right');
  const changed = reduceGesture(moved.state, 'move', point(100, 170));
  assert.equal(changed.action, null);
  assert.equal(reduceGesture(changed.state, 'up', point(100, 170)).action, null);
});

test('28 pixel threshold preserves short tap jumping', () => {
  assert.equal(reduceGesture(down(), 'move', point(127, 100)).action, null);
  assert.equal(reduceGesture(down(), 'up', point(127, 100)).action, 'jump');
  assert.equal(reduceGesture(down(), 'up', point(128, 100)).action, 'right');
});

test('other fingers cannot steal or end the active gesture', () => {
  let state = down();
  for (const type of ['down', 'move', 'up', 'cancel']) {
    const result = reduceGesture(state, type, point(10, 10, 2));
    assert.equal(result.state, state);
    assert.equal(result.action, null);
  }
  assert.equal(reduceGesture(state, 'up', point(150, 100)).action, 'right');
  assert.equal(reduceGesture(null, 'down', { ...point(10, 10, 2), isPrimary: false }).state, null);
});

test('cancel and lost capture leave no pending tap', () => {
  const canceled = reduceGesture(down(), 'cancel', point(100, 100));
  assert.equal(canceled.state, null);
  assert.equal(canceled.action, null);
  assert.equal(reduceGesture(canceled.state, 'up', point(100, 100)).action, null);
});
