import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature, atmospherePaint, rainBudget, normalizeAtmosphere, WEATHER, TIMES } from '../src/city_atmosphere.mjs';

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.attributes = {}; this.events = new Map(); this.classList = { add() {} }; }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, fn) { this.events.set(name, fn); }
  removeEventListener(name, fn) { if (this.events.get(name) === fn) this.events.delete(name); }
  getBoundingClientRect() { return { width: 800, height: 500 }; }
}
class Color {
  constructor(value) { this.value = value; }
  clone() { return new Color(this.value); }
  copy(other) { this.value = other.value; return this; }
  lerp(other, amount) { this.value = [this.value, other.value, amount]; return this; }
}
function harness({ stored, noCanvas = false, storageThrows = false, systemReducedMotion = false } = {}) {
  let settings = { quality: 'medium', reducedMotion: false }, settingListener, hostDispose;
  const container = new Element('div'), body = new Element('section'), mapEvents = new Map();
  const context = { draws: 0, clearRect() {}, setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { this.draws++; } };
  const doc = { createElement(tag) { const node = new Element(tag); if (tag === 'canvas') node.getContext = () => noCanvas ? null : context; return node; } };
  let light = { color: '#fff', intensity: .5, anchor: 'viewport', position: [1, 2, 3] };
  let layers = [
    { id: 'ground', type: 'background', paint: { 'background-color': '#e0e0e0' } },
    { id: 'buildings', type: 'fill-extrusion', paint: { 'fill-extrusion-color': ['get', 'color'] } },
    { id: 'labels', type: 'symbol', paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff' } },
    { id: 'custom', type: 'custom' },
  ];
  const map = {
    getStyle: () => ({ layers }), getContainer: () => container, getLayer: id => layers.find(l => l.id === id),
    getPaintProperty(id, key) { return this.getLayer(id)?.paint?.[key]; },
    setPaintProperty(id, key, value) { this.getLayer(id).paint[key] = value; },
    getLight: () => light, setLight: value => { light = value; }, triggerRepaint() {},
    on: (event, fn) => mapEvents.set(event, fn), off: event => mapEvents.delete(event),
  };
  const originalLight = structuredClone(light), originalPaint = structuredClone(layers);
  const sun = { isLight: true, isDirectionalLight: true, intensity: 2.4, color: new Color('#ffe4c5') };
  const hemisphere = { isLight: true, intensity: 2.2, color: new Color('#ffffff'), groundColor: new Color('#586953') };
  let open = false, panelDisposed = 0, unsubscribeCount = 0, unregisterCount = 0;
  const panel = { body, open: () => { open = true; }, toggle: () => { open = !open; }, isOpen: () => open, dispose: () => { panelDisposed++; open = false; } };
  const media = { matches: systemReducedMotion, listener: null, addEventListener(_, fn) { this.listener = fn; }, removeEventListener() { this.listener = null; } };
  const engine = {
    document: doc, window: { devicePixelRatio: 3, matchMedia: () => media }, ui: container, map, THREE: { Color }, cast: { scene: { traverse: fn => [sun, hemisphere].forEach(fn) } },
    storage: { getItem() { if (storageThrows) throw Error('blocked'); return stored; }, setItem(key, value) { if (storageThrows) throw Error('quota'); stored = value; } },
    getSettings: () => settings, onSettings: fn => { settingListener = fn; return () => { unsubscribeCount++; }; },
    createPanel(id, options) { assert.equal(id, 'city-atmosphere'); assert.equal(options.key, 't'); return panel; },
    onDispose: fn => { hostDispose = fn; return () => { unregisterCount++; }; },
  };
  const feature = createFeature(engine);
  return { feature, map, body, container, sun, hemisphere, context, mapEvents, originalPaint, originalLight, media,
    get stored() { return stored; }, get light() { return light; },
    settings(next) { settings = { ...settings, ...next }; settingListener(settings); },
    reload() { layers = structuredClone(originalPaint); light = structuredClone(originalLight); mapEvents.get('style.load')(); },
    hostDispose: () => hostDispose(), counts: () => ({ panelDisposed, unsubscribeCount, unregisterCount }),
  };
}

// Evaluate the emitted arithmetic independently to catch invalid ranges, alpha loss,
// and data-driven colors being replaced by a flat preset.
function evaluate(expression, properties = {}, vars = {}) {
  if (!Array.isArray(expression)) return expression;
  const [op, ...args] = expression;
  const ev = a => evaluate(a, properties, vars);
  if (op === 'let') return evaluate(args[2], properties, { ...vars, [args[0]]: ev(args[1]) });
  if (op === 'var') return vars[args[0]];
  if (op === 'get') return properties[args[0]];
  if (op === 'to-rgba') { const color = ev(args[0]); return Array.isArray(color) ? color : [...color.slice(1).match(/../g).map(s => parseInt(s, 16)), 1]; }
  if (op === 'at') return ev(args[1])[args[0]];
  if (op === 'rgba') return args.map(ev);
  if (op === '+') return ev(args[0]) + ev(args[1]);
  if (op === '*') return ev(args[0]) * ev(args[1]);
  if (op === 'min') return Math.min(...args.map(ev));
  if (op === 'max') return Math.max(...args.map(ev));
  throw new Error(`Unsupported expression ${op}`);
}

test('validated presets and bounded budgets reject corrupt or unknown state', () => {
  assert.deepEqual(normalizeAtmosphere({ time: 'tomorrow', weather: 'snow' }), { time: 'daylight', weather: 'clear' });
  assert.deepEqual(normalizeAtmosphere(null), { time: 'daylight', weather: 'clear' });
  assert.equal(rainBudget({ quality: 'low' }), 24);
  assert.equal(rainBudget({ quality: 'high' }), 100);
  assert.equal(rainBudget({ quality: 'ultra' }), 60);
  assert.equal(rainBudget({ quality: 'high', reducedMotion: true }), 0);
});

test('all nine combinations produce bounded colors, preserve expression inputs and alpha', () => {
  const source = ['get', 'paint'];
  for (const weather of WEATHER) for (const time of TIMES) {
    const out = atmospherePaint(source, { weather, time });
    const rgba = evaluate(out, { paint: [224, 190, 110, .35] });
    if (weather !== 'clear' || time !== 'daylight') {
      assert.equal(rgba.length, 4);
      assert.ok(rgba.slice(0, 3).every(n => n >= 0 && n <= 255));
      assert.equal(rgba[3], .35);
    }
    assert.deepEqual(source, ['get', 'paint']);
  }
  const day = evaluate(atmospherePaint('#eeeeee', { time: 'dusk' }));
  const night = evaluate(atmospherePaint('#eeeeee', { time: 'night' }));
  assert.ok(night[0] < day[0]);
  const label = evaluate(atmospherePaint('#333333', { time: 'night' }, 'text-color'));
  assert.ok(label[0] > night[0]);
  const legacy = { stops: [[0, '#ffffff'], [18, '#333333']] };
  assert.deepEqual(atmospherePaint(legacy, { time: 'night' }), legacy);
});

test('managed T panel, button controls, actual map and character lights, restoration', () => {
  const h = harness();
  assert.equal(h.feature.handleKey('g'), false);
  assert.equal(h.feature.handleKey('t', { repeat: true }), false);
  assert.equal(h.feature.handleKey('t', { ctrlKey: true }), false);
  assert.equal(h.feature.handleKey('t'), true);
  assert.equal(h.feature.isOpen(), true);
  const fields = h.body.children.filter(child => child.tag === 'fieldset');
  const rain = fields[0].children.find(child => child.textContent === '下雨');
  rain.events.get('click')();
  assert.equal(rain.attributes['aria-pressed'], 'true');
  h.feature.setAtmosphere({ time: 'night' });
  assert.equal(h.feature.getState().particleCount, 60);
  assert.ok(h.sun.intensity < 1);
  assert.ok(h.hemisphere.intensity < 1);
  assert.notEqual(h.sun.color.value, '#ffe4c5');
  assert.ok(h.light.intensity < h.originalLight.intensity);
  assert.equal(h.map.getPaintProperty('ground', 'background-color')[0], 'let');
  const first = structuredClone(h.map.getPaintProperty('ground', 'background-color'));
  h.feature.setAtmosphere({ time: 'night' });
  assert.deepEqual(h.map.getPaintProperty('ground', 'background-color'), first, 'changes never compound');
  h.feature.setAtmosphere({ time: 'daylight', weather: 'clear' });
  assert.equal(h.map.getPaintProperty('ground', 'background-color'), '#e0e0e0');
  assert.equal(h.sun.intensity, 2.4);
  assert.equal(h.sun.color.value, '#ffe4c5');
  assert.equal(h.feature.getState().particleCount, 0);
  h.feature.setAtmosphere({ weather: 'rain', time: 'dusk' });
  h.feature.dispose(); h.feature.dispose();
  assert.deepEqual(h.map.getStyle().layers, h.originalPaint);
  assert.deepEqual(h.light, h.originalLight);
  assert.equal(h.hemisphere.groundColor.value, '#586953');
  assert.equal(h.sun.intensity, 2.4);
  assert.equal(h.container.children.length, 0);
  assert.equal(h.mapEvents.size, 0);
  assert.deepEqual(h.counts(), { panelDisposed: 1, unsubscribeCount: 1, unregisterCount: 1 });
  assert.equal(h.feature.handleKey('t'), false);
  assert.equal(h.feature.isOpen(), false);
  assert.equal(rain.events.size, 0);
});

test('rain obeys settings live, clamps elapsed time, and stops rendering after disposal', () => {
  const h = harness(); h.feature.setAtmosphere({ weather: 'rain' });
  assert.equal(h.container.children[0].width, 1200, 'device pixel ratio is capped at 1.5');
  h.feature.update(NaN); h.feature.update(-1); h.feature.update(.01);
  assert.equal(h.context.draws, 0);
  h.feature.update(.04); assert.equal(h.context.draws, 1);
  h.settings({ quality: 'low' }); assert.equal(h.feature.getState().particleCount, 24);
  h.feature.update(.04); assert.equal(h.context.draws, 1);
  h.feature.update(.04); assert.equal(h.context.draws, 2);
  h.settings({ reducedMotion: true }); assert.equal(h.feature.getState().particleCount, 0);
  h.feature.update(500); assert.equal(h.context.draws, 2);
  assert.equal(h.feature.getState().weather, 'rain', 'reduced motion keeps the weather lighting');
  h.settings({ reducedMotion: false, quality: 'high' }); assert.equal(h.feature.getState().particleCount, 100);
  h.feature.update(500); assert.equal(h.context.draws, 3, 'no catch-up loop after a stalled frame');
  h.hostDispose(); h.feature.update(.1); assert.equal(h.context.draws, 3);
});

test('style reload reapplies the selected effect using fresh originals', () => {
  const h = harness(); h.feature.setAtmosphere({ time: 'night' });
  const before = structuredClone(h.map.getPaintProperty('ground', 'background-color'));
  h.reload();
  assert.deepEqual(h.map.getPaintProperty('ground', 'background-color'), before);
  h.feature.dispose(); assert.deepEqual(h.map.getStyle().layers, h.originalPaint);
});

test('saved choices restore and persist; blocked storage and missing 2D canvas stay usable', () => {
  const saved = harness({ stored: JSON.stringify({ weather: 'rain', time: 'night' }) });
  assert.deepEqual(saved.feature.getState(), { weather: 'rain', time: 'night', particleCount: 60 });
  saved.feature.setAtmosphere({ time: 'dusk' });
  assert.deepEqual(JSON.parse(saved.stored), { weather: 'rain', time: 'dusk' });
  saved.feature.dispose();
  for (const options of [{ stored: 'broken json' }, { storageThrows: true }, { noCanvas: true }]) {
    const h = harness(options);
    assert.doesNotThrow(() => h.feature.setAtmosphere({ time: 'night', weather: 'rain' }));
    assert.doesNotThrow(() => h.feature.update(.1));
    if (options.noCanvas) assert.equal(h.feature.getState().particleCount, 0);
    h.feature.dispose();
  }
});


test('system reduced motion suppresses particles and responds to preference changes', () => {
  const h = harness({ systemReducedMotion: true });
  h.feature.setAtmosphere({ weather: 'rain', time: 'night' });
  assert.equal(h.feature.getState().particleCount, 0);
  h.media.matches = false; h.media.listener();
  assert.equal(h.feature.getState().particleCount, 60);
  h.media.matches = true; h.media.listener();
  assert.equal(h.feature.getState().particleCount, 0);
  h.feature.dispose(); assert.equal(h.media.listener, null);
});
