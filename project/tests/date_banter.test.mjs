import test from 'node:test';
import assert from 'node:assert/strict';
import { BANTER_POOLS, REPEAT_WINDOW, pickLine } from '../src/date_banter_lines.mjs';

const a = { id: 'a', text: '第一句话', weight: 1, priority: 1 };
const b = { id: 'b', text: '第二句话', weight: 3, priority: 1 };

test('empty, absent and fully filtered pools return null without drawing', () => {
  const neverDraw = () => assert.fail('rng called for an empty selection');
  assert.equal(pickLine([], {}, new Map(), neverDraw), null);
  assert.equal(pickLine(undefined, {}, new Map(), neverDraw), null);
  assert.equal(pickLine([a], { now: 10 }, new Map([['a', 0]]), neverDraw), null);
  assert.equal(pickLine([null, { text: '' }, { ...a, weight: 0 }, { ...b, weight: -1 }]), null);
});

test('id dedupe lasts ten minutes including timestamp zero, then permits the boundary', () => {
  const history = new Map([['a', 0]]);
  assert.equal(pickLine([a], { now: 599.999 }, history), null);
  assert.equal(pickLine([a], { now: 600 }, history), a);
  assert.equal(pickLine([a], { now: 50 }, { a: 0 }), null);
});

test('same text under another id cannot bypass the repeat window', () => {
  const sameText = { ...a, id: 'different-pool' };
  const history = new Map([[a.id, 50], [a.text, 50]]);
  assert.equal(pickLine([sameText, b], { now: 649 }, history, () => 0), b);
  assert.equal(pickLine([sameText], { now: 650 }, history), sameText);
});

test('longer per-line cooldowns apply, shorter ones never relax dedupe', () => {
  const history = new Map([['a', 100]]);
  assert.equal(pickLine([{ ...a, cooldown: 10 }], { now: 200 }, history), null);
  assert.equal(pickLine([{ ...a, cooldown: 1200 }], { now: 1000 }, history), null);
  assert.ok(pickLine([{ ...a, cooldown: 1200 }], { now: 1300 }, history));
});

test('higher priority wins irrespective of lower-priority weight or pool order', () => {
  const urgent = { ...b, priority: 3, weight: .01 };
  const common = { ...a, weight: 999 };
  for (const value of [0, .5, .999, 1]) {
    assert.equal(pickLine([common, urgent], {}, new Map(), () => value), urgent);
    assert.equal(pickLine([urgent, common], {}, new Map(), () => value), urgent);
  }
  assert.equal(pickLine([urgent, common], { now: 10 }, new Map([['b', 0]]), () => 0), common);
});

test('deterministic weighted draws use the entire eligible weight', () => {
  const choose = rngValue => pickLine([a, b], {}, new Map(), () => rngValue);
  assert.equal(choose(0), a);
  assert.equal(choose(.249), a);
  assert.equal(choose(.25), b);
  assert.equal(choose(.9), b);
  assert.equal(choose(1), b);
  assert.equal(choose(NaN), a);
});

test('context filters stage and clock period without excluding general lines', () => {
  const morning = { ...a, period: 'morning', stage: 'meet', priority: 9 };
  assert.equal(pickLine([morning, b], { period: 'evening', stage: 'meet' }, {}, () => 0), b);
  assert.equal(pickLine([morning, b], { period: 'morning', stage: 'photos' }, {}, () => 0), b);
  assert.equal(pickLine([morning, b], { period: 'morning', stage: 'meet' }, {}, () => 0), morning);
});

test('selection leaves frozen pool, context and caller-owned history unchanged', () => {
  const lines = Object.freeze([Object.freeze({ ...a }), Object.freeze({ ...b })]);
  const context = Object.freeze({ now: 700 });
  const history = Object.freeze({ a: 0 });
  assert.equal(pickLine(lines, context, history, () => 0), lines[0]);
  assert.deepEqual(history, { a: 0 });
});

test('a pool exhausts once per window instead of repeating when no candidate remains', () => {
  const lines = [a, b], history = new Map();
  for (const expected of [a, b]) {
    const chosen = pickLine(lines, { now: 42 }, history, () => 0);
    assert.equal(chosen, expected);
    history.set(chosen.id, 42);
    history.set(chosen.text, 42);
  }
  assert.equal(pickLine(lines, { now: 641 }, history), null);
  assert.equal(pickLine(lines, { now: 642 }, history, () => 0), a);
});

test('all shipped lines are unique, short Chinese dialogue with valid reply pools', () => {
  const ids = new Set(), texts = new Set();
  const lines = Object.values(BANTER_POOLS).flat();
  assert.equal(lines.length, 80);
  for (const entry of lines) {
    assert.ok(!ids.has(entry.id), entry.id);
    assert.ok(!texts.has(entry.text), entry.text);
    ids.add(entry.id); texts.add(entry.text);
    assert.ok(Array.from(entry.text).length >= 4 && Array.from(entry.text).length <= 18, entry.text);
    assert.ok(entry.cooldown >= REPEAT_WINDOW, entry.id);
    assert.ok(['companion', 'player'].includes(entry.who));
    if (entry.reply) assert.ok(BANTER_POOLS[entry.reply].every(reply => reply.who === 'player'));
  }
  for (const stage of ROUTE_STAGES) assert.ok(BANTER_POOLS[`stage_${stage}`]?.length);
  for (const id of ['facade', 'fountain', 'couple']) assert.ok(BANTER_POOLS[`photo_${id}`]?.length);
  for (const index of [0, 1, 2]) assert.ok(BANTER_POOLS[`choice_${index}`]?.length);
});

const ROUTE_STAGES = ['meet', 'fountain_talk', 'find_memento', 'photos', 'postcard', 'done'];
