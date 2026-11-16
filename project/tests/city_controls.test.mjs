import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeadzone, readGamepad, createFeature } from '../src/city_controls.mjs';

class Target {
  constructor() { this.events = new Map(); }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
  removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
  emit(type, data = {}) {
    const event = { button: 0, pointerId: 1, clientX: 50, clientY: 50, preventDefault() {}, stopPropagation() {}, ...data };
    for (const fn of [...this.events.get(type) || []]) fn(event);
  }
  listenerCount() { return [...this.events.values()].reduce((n, set) => n + set.size, 0); }
}
class Element extends Target {
  constructor(tag) {
    super(); this.tag = tag; this.children = []; this.attrs = new Map(); this.hidden = false; this.captures = new Set();
    const properties = new Map();
    this.style = { setProperty(k, v, p = '') { properties.set(k, [v, p]); }, getPropertyValue(k) { return properties.get(k)?.[0] || ''; },
      getPropertyPriority(k) { return properties.get(k)?.[1] || ''; }, removeProperty(k) { properties.delete(k); } };
    const classes = new Set();
    this.classList = { add: k => classes.add(k), remove: k => classes.delete(k), contains: k => classes.has(k),
      toggle(k, enabled) { if (enabled) classes.add(k); else classes.delete(k); } };
  }
  setAttribute(k, v) { this.attrs.set(k, v); }
  getAttribute(k) { return this.attrs.get(k); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  getBoundingClientRect() { return { width: 132, height: 132 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
}
function pad({ axes = [0, 0, 0, 0], buttons = [], index = 0, mapping = 'standard' } = {}) {
  return { axes, index, mapping, connected: true, buttons: Array.from({ length: 11 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })) };
}
function setup() {
  const doc = new Target(), win = new Target(), ui = new Element('div'), legacy = new Element('div');
  legacy.style.setProperty('display', 'grid', 'important');
  let pads = [], input, blocked = false, interactions = 0, closes = 0, clears = 0, cleanup, unregistered = 0;
  Object.assign(doc, { hidden: false, createElement: tag => new Element(tag), querySelectorAll: () => [legacy] });
  win.navigator = { getGamepads: () => pads };
  const feature = createFeature({ document: doc, window: win, ui,
    setInput: value => { input = value; }, clearInput: () => { clears++; }, isInputBlocked: () => blocked,
    interact: () => { interactions++; }, closePanels: () => { closes++; blocked = false; },
    onDispose: fn => { cleanup = fn; return () => { unregistered++; }; } });
  const root = ui.children[0], [move, look, actions] = root.children, [run, interact] = actions.children;
  return { feature, doc, win, ui, root, legacy, move, look, run, interact,
    set pads(value) { pads = value; }, set blocked(value) { blocked = value; }, get input() { return input; },
    get interactions() { return interactions; }, get closes() { return closes; }, get clears() { return clears; },
    get unregistered() { return unregistered; }, cleanup: () => cleanup() };
}
const zero = { right: 0, forward: 0, run: false, lookX: 0, lookY: 0 };

test('radial deadzone rejects drift, rescales travel, clamps diagonals and nonfinite axes', () => {
  assert.deepEqual(applyDeadzone(0.1, -0.1), { x: 0, y: 0 });
  assert.ok(Math.abs(applyDeadzone(0.59, 0).x - 0.5) < 1e-12);
  const diagonal = applyDeadzone(2, 2);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
  assert.deepEqual(applyDeadzone(NaN, Infinity), { x: 0, y: 0 });
});

test('standard gamepad axes and A/B/L3 map to the frozen engine contract', () => {
  const state = readGamepad(pad({ axes: [1, -1, -0.59, 0], buttons: [0, 1, 10] }));
  assert.ok(state.right > 0 && state.forward > 0);
  assert.ok(Math.abs(state.lookX + 0.5) < 1e-12);
  assert.equal(state.lookY, 0);
  assert.equal(state.run, true); assert.equal(state.interact, true); assert.equal(state.close, true);
  assert.deepEqual(readGamepad(pad({ mapping: '', axes: [1, 1, 1, 1], buttons: [0] })), { ...zero, interact: false, close: false });
  assert.deepEqual(readGamepad(null), { ...zero, interact: false, close: false });
});

test('polls gamepads each frame, debounces A/B and clears immediately on disconnect', () => {
  const s = setup();
  s.pads = [null, pad({ axes: [0, -1, 1, 0], buttons: [0, 10] })];
  s.feature.update(); s.feature.update();
  assert.equal(s.input.forward, 1); assert.equal(s.input.lookX, 1); assert.equal(s.input.run, true);
  assert.equal(s.interactions, 1);
  s.pads = [pad({ buttons: [1] })]; s.feature.update(); s.feature.update();
  assert.equal(s.closes, 1); assert.deepEqual(s.input, zero);
  s.pads = [pad()]; s.feature.update();
  s.pads = [pad({ axes: [1, 0, 0, 0] })]; s.feature.update(); assert.equal(s.input.right, 1);
  s.win.emit('gamepaddisconnected', { gamepad: { index: 0 } }); assert.deepEqual(s.input, zero);
  s.pads = []; s.feature.update(); assert.deepEqual(s.input, zero);
  s.feature.dispose();
});

test('simultaneous move/look/run touches use independent captures and release without sticking', () => {
  const s = setup();
  s.move.emit('pointerdown', { pointerId: 1 });
  s.move.emit('pointerdown', { pointerId: 7 }); // second finger must not steal the zone
  s.move.emit('pointermove', { pointerId: 7, clientY: 0 });
  s.feature.update(); assert.equal(s.input.forward, 0);
  s.move.emit('pointermove', { pointerId: 1, clientY: -50 });
  s.look.emit('pointerdown', { pointerId: 2 });
  s.look.emit('pointermove', { pointerId: 2, clientX: 150 });
  s.run.emit('pointerdown', { pointerId: 3 });
  s.feature.update();
  assert.equal(s.input.forward, 1); assert.equal(s.input.lookX, 1); assert.equal(s.input.run, true);
  s.win.emit('pointercancel', { pointerId: 1 });
  s.look.releasePointerCapture(2);
  s.win.emit('pointerup', { pointerId: 3 });
  s.feature.update(); assert.deepEqual(s.input, zero);
  assert.equal(s.run.getAttribute('aria-pressed'), 'false');
  s.interact.emit('click'); assert.equal(s.interactions, 1);
  s.feature.dispose();
});

test('modal isolation clears touches, blocks A and requires neutral before resumed gamepad motion', () => {
  const s = setup();
  s.move.emit('pointerdown'); s.move.emit('pointermove', { clientY: -100 });
  s.blocked = true; s.pads = [pad({ axes: [1, 0, 0, 0], buttons: [0] })];
  s.feature.update(); s.interact.emit('click');
  assert.deepEqual(s.input, zero); assert.equal(s.interactions, 0); assert.ok(s.root.classList.contains('is-blocked'));
  s.pads = [pad({ axes: [1, 0, 0, 0], buttons: [1] })]; s.feature.update();
  assert.equal(s.closes, 1); assert.deepEqual(s.input, zero);
  s.pads = [pad({ axes: [1, 0, 0, 0] })]; s.feature.update(); assert.deepEqual(s.input, zero);
  s.pads = [pad()]; s.feature.update();
  s.pads = [pad({ axes: [1, 0, 0, 0], buttons: [0] })]; s.feature.update();
  assert.equal(s.input.right, 1); assert.equal(s.interactions, 1);
  s.feature.dispose();
});

test('blur and hidden document suspend all actions until focus/visibility returns and sticks reset', () => {
  const s = setup();
  s.pads = [pad({ axes: [0, -1, 0, 0], buttons: [10] })]; s.feature.update();
  s.win.emit('blur'); assert.deepEqual(s.input, zero);
  s.pads = [pad({ buttons: [0, 1] })]; s.feature.update();
  assert.equal(s.interactions, 0); assert.equal(s.closes, 0);
  s.win.emit('focus'); s.feature.update(); assert.deepEqual(s.input, zero);
  s.pads = [pad()]; s.feature.update();
  s.pads = [pad({ axes: [0, -1, 0, 0] })]; s.feature.update(); assert.equal(s.input.forward, 1);
  s.doc.hidden = true; s.doc.emit('visibilitychange'); assert.deepEqual(s.input, zero);
  s.feature.update(); assert.deepEqual(s.input, zero);
  s.doc.hidden = false; s.doc.emit('visibilitychange'); s.feature.update(); assert.deepEqual(s.input, zero);
  s.feature.dispose();
});

test('denied gamepad API and missing devices do not break touch input', () => {
  const s = setup();
  s.win.navigator.getGamepads = () => { throw new Error('permission denied'); };
  s.move.emit('pointerdown'); s.move.emit('pointermove', { clientX: 150 });
  assert.doesNotThrow(() => s.feature.update()); assert.equal(s.input.right, 1);
  delete s.win.navigator.getGamepads;
  assert.doesNotThrow(() => s.feature.update());
  s.feature.dispose();
});

test('dispose restores legacy controls, releases captures and removes all owned listeners/DOM', () => {
  const s = setup();
  assert.equal(s.legacy.hidden, true); assert.equal(s.legacy.style.getPropertyValue('display'), 'none');
  s.move.emit('pointerdown'); s.run.emit('pointerdown', { pointerId: 3 });
  s.cleanup(); s.feature.dispose();
  assert.deepEqual(s.input, zero); assert.equal(s.ui.children.length, 0);
  assert.equal(s.legacy.hidden, false); assert.equal(s.legacy.style.getPropertyValue('display'), 'grid');
  assert.equal(s.legacy.style.getPropertyPriority('display'), 'important');
  assert.equal(s.win.listenerCount(), 0); assert.equal(s.doc.listenerCount(), 0);
  for (const node of [s.move, s.look, s.run, s.interact]) { assert.equal(node.listenerCount(), 0); assert.equal(node.captures.size, 0); }
  assert.equal(s.unregistered, 1);
  s.pads = [pad({ buttons: [0] })]; s.feature.update(); assert.equal(s.interactions, 0);
});
