import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFeature, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY,
  normalizeSettings, loadSettings, saveSettings,
} from '../src/city_settings.mjs';

function memoryStorage() {
  const data = new Map(), writes = [];
  return {data, writes, getItem: key => data.get(key) ?? null,
    setItem(key, value) { data.set(key, value); writes.push(key); }};
}

// Minimal DOM models the controls' event/focus contract without a browser dependency.
function harness({storage = memoryStorage(), starting = {}, denyStorage = false} = {}) {
  let activeElement;
  class Element {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.attributes = {};
      this.listeners = new Map(); this.hidden = false;
    }
    append(...children) {
      for (const child of children) { child.parentNode = this; this.children.push(child); }
    }
    remove() {
      this.removed = true;
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    fire(type) { for (const fn of this.listeners.get(type) ?? []) fn({target: this}); }
    focus() { activeElement = this; }
  }
  const body = new Element('section'), subscriptions = new Set(), cleanups = new Set();
  let current = {...DEFAULT_SETTINGS, ...starting}, opened = false, panelDisposals = 0;
  const calls = [];
  const panel = {body, open: () => { opened = true; }, close: () => { opened = false; },
    toggle: () => { opened = !opened; }, isOpen: () => opened,
    dispose: () => { opened = false; panelDisposals++; }};
  const engine = {
    document: {createElement: tag => new Element(tag)}, storage,
    getSettings: () => ({...current}),
    setSettings(patch) {
      calls.push({...patch}); current = {...current, ...patch};
      for (const fn of subscriptions) fn({...current});
    },
    createPanel(id, options) {
      assert.equal(id, 'city-settings'); assert.equal(options.key, 'o'); assert.equal(options.modal, true);
      return panel;
    },
    onSettings(fn) { subscriptions.add(fn); return () => subscriptions.delete(fn); },
    onDispose(fn) { cleanups.add(fn); return () => cleanups.delete(fn); },
  };
  if (denyStorage) Object.defineProperty(engine, 'storage', {get() { throw new Error('denied'); }});
  const feature = createFeature(engine);
  const all = (node = body) => [node, ...node.children.flatMap(child => all(child))];
  const byId = id => all().find(node => node.id === id);
  const byText = text => all().find(node => node.textContent === text);
  const status = () => all().find(node => node.attributes.role === 'status').textContent;
  return {feature, engine, panel, calls, storage, body, all, byId, byText, status,
    subscriptions, cleanups, get activeElement() { return activeElement; },
    get panelDisposals() { return panelDisposals; }};
}

const custom = {quality: 'high', sound: false, hints: false, moveSensitivity: 0.6,
  cameraSensitivity: 1.8, reducedMotion: true};

test('normalization limits values and strips non-settings keys without coercion', () => {
  assert.deepEqual(normalizeSettings({quality: 'ultra', sound: 'false', hints: 0,
    moveSensitivity: -5, cameraSensitivity: 99, reducedMotion: true, progress: 'erase'}), {
    ...DEFAULT_SETTINGS, moveSensitivity: 0.25, cameraSensitivity: 2, reducedMotion: true,
  });
  for (const value of [null, [], 'bad', 12]) assert.deepEqual(normalizeSettings(value), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({moveSensitivity: NaN, cameraSensitivity: Infinity}), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings(custom), custom);
  assert.equal(Object.isFrozen(DEFAULT_SETTINGS), true);
});

test('versioned persistence round trips only own six settings', () => {
  const storage = memoryStorage();
  storage.data.set('lmu-munich-city-v1', 'progress remains');
  assert.equal(saveSettings({...custom, found: {x: true}}, storage), true);
  assert.deepEqual(loadSettings(storage), custom);
  assert.deepEqual(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY)), {version: 1, settings: custom});
  assert.deepEqual(storage.writes, [SETTINGS_STORAGE_KEY]);
  assert.equal(storage.data.get('lmu-munich-city-v1'), 'progress remains');
});

test('corrupt, unsupported and partially invalid records safely restore defaults', () => {
  const storage = memoryStorage();
  for (const raw of ['{', 'null', '[]', '{}', '{"version":2,"settings":{}}',
    '{"version":1,"settings":[]}', '{"version":1,"settings":{"quality":"unknown","sound":"false","moveSensitivity":null}}']) {
    storage.data.set(SETTINGS_STORAGE_KEY, raw);
    assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS, raw);
  }
  storage.data.set(SETTINGS_STORAGE_KEY, '{"version":1,"settings":{"hints":false}}');
  assert.deepEqual(loadSettings(storage), {...DEFAULT_SETTINGS, hints: false});
});

test('missing, blocked and quota storage never throw or mutate defaults', () => {
  const blocked = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }};
  assert.deepEqual(loadSettings(blocked), DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings(undefined), DEFAULT_SETTINGS);
  assert.equal(saveSettings(custom, blocked), false);
  assert.equal(saveSettings(custom, undefined), false);
  assert.equal(DEFAULT_SETTINGS.sound, true);
});

test('factory restores saved values through setSettings and renders all controls', () => {
  const storage = memoryStorage(); saveSettings(custom, storage);
  const h = harness({storage});
  assert.deepEqual(h.calls, [custom]);
  assert.equal(h.byId('city-settings-quality').value, 'high');
  assert.equal(h.byId('city-settings-sound').checked, false);
  assert.equal(h.byId('city-settings-hints').checked, false);
  assert.equal(h.byId('city-settings-reducedMotion').checked, true);
  assert.equal(h.byId('city-settings-moveSensitivity').value, '0.6');
  assert.equal(h.byId('city-settings-cameraSensitivity').attributes['aria-valuetext'], '1.80×');
  assert.match(h.status(), /载入/);
  h.feature.dispose();
});

test('accessible controls immediately update the shared engine and survive reload', () => {
  const h = harness();
  for (const [key, value] of Object.entries(custom)) {
    const control = h.byId(`city-settings-${key}`);
    assert.ok(h.all().find(node => node.tagName === 'label' && node.htmlFor === control.id));
    assert.ok(h.byId(control.attributes['aria-describedby']));
    if (typeof value === 'boolean') control.checked = value;
    else control.value = String(value);
    control.fire(key.endsWith('Sensitivity') ? 'input' : 'change');
    assert.equal(h.engine.getSettings()[key], value);
  }
  assert.deepEqual(h.feature.getSettings(), custom);
  assert.equal(h.storage.writes.length, 6, 'synchronous onSettings does not double-save');
  const reloaded = harness({storage: h.storage});
  assert.deepEqual(reloaded.feature.getSettings(), custom);
  const copy = h.feature.getSettings(); copy.sound = true;
  assert.equal(h.feature.getSettings().sound, false);
  h.feature.dispose(); reloaded.feature.dispose();
});

test('O toggles the managed panel; repeats and unrelated keys do not trigger actions', () => {
  const h = harness();
  assert.equal(h.feature.isOpen(), false);
  assert.equal(h.feature.handleKey('o'), true);
  assert.equal(h.feature.isOpen(), true);
  assert.equal(h.feature.handleKey('o', {repeat: true}), true);
  assert.equal(h.feature.isOpen(), true);
  assert.equal(h.feature.handleKey('n'), false);
  assert.equal(h.feature.handleKey('escape'), false, 'host handles normal Escape');
  h.feature.handleKey('o'); assert.equal(h.feature.isOpen(), false);
  h.feature.dispose();
});

test('reset requires confirmation; cancel/Escape preserve settings and restore focus', () => {
  const h = harness({starting: custom}); h.feature.open();
  const reset = h.byText('恢复默认设置…'); reset.fire('click');
  assert.equal(h.byId('city-settings-reset-confirm').hidden, false);
  assert.equal(h.activeElement, h.byText('取消'));
  assert.equal(reset.attributes['aria-expanded'], 'true');
  assert.equal(h.calls.length, 1);
  h.byText('取消').fire('click');
  assert.deepEqual(h.engine.getSettings(), custom);
  assert.equal(h.activeElement, reset);
  reset.fire('click');
  assert.equal(h.feature.handleKey('escape'), true);
  assert.equal(h.byId('city-settings-reset-confirm').hidden, true);
  assert.equal(h.feature.isOpen(), true);
  assert.deepEqual(h.feature.getSettings(), custom);
  assert.equal(h.storage.writes.length, 0);
  h.feature.dispose();
});

test('confirmed reset persists defaults and never clears progress or position', () => {
  const storage = memoryStorage();
  storage.data.set('lmu-munich-city-v1', 'visited places');
  storage.data.set('munich-city-position-v1', 'position');
  saveSettings(custom, storage);
  const h = harness({storage}); h.feature.open();
  h.byText('恢复默认设置…').fire('click');
  h.byText('确认恢复默认设置').fire('click');
  assert.deepEqual(h.engine.getSettings(), DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
  assert.equal(storage.data.get('lmu-munich-city-v1'), 'visited places');
  assert.equal(storage.data.get('munich-city-position-v1'), 'position');
  assert.ok(storage.writes.every(key => key === SETTINGS_STORAGE_KEY));
  assert.equal(h.byId('city-settings-reset-confirm').hidden, true);
  assert.match(h.status(), /进度已保留/);
  h.feature.dispose();
});

test('storage quota and denied getter leave live controls and reset working', () => {
  const quota = {getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }};
  for (const options of [{storage: quota}, {denyStorage: true}]) {
    const h = harness(options);
    const sound = h.byId('city-settings-sound'); sound.checked = false; sound.fire('change');
    assert.equal(h.engine.getSettings().sound, false);
    assert.match(h.status(), /无法保存/);
    h.feature.open(); h.feature.requestReset();
    h.byText('确认恢复默认设置').fire('click');
    assert.deepEqual(h.engine.getSettings(), DEFAULT_SETTINGS);
    assert.match(h.status(), /无法保存/);
    h.feature.dispose();
  }
});

test('external shared settings changes sync controls and persistence without setter loops', () => {
  const h = harness();
  h.engine.setSettings(custom);
  assert.deepEqual(h.feature.getSettings(), custom);
  assert.deepEqual(loadSettings(h.storage), custom);
  assert.equal(h.byId('city-settings-quality').value, 'high');
  assert.equal(h.calls.length, 2);
  assert.equal(h.storage.writes.length, 1);
  h.engine.setSettings(custom);
  assert.equal(h.storage.writes.length, 1, 'identical settings do not write again');
  h.feature.dispose();
});

test('host panel closure discards pending reset and disposal removes all owned resources', () => {
  const h = harness(); h.feature.open(); h.feature.requestReset();
  h.panel.close(); h.feature.update();
  assert.equal(h.byId('city-settings-reset-confirm').hidden, true);
  const nodes = h.all();
  for (const cleanup of [...h.cleanups]) cleanup();
  assert.equal(h.feature.isOpen(), false);
  assert.equal(h.body.children.length, 0);
  assert.equal(h.subscriptions.size, 0);
  assert.equal(h.cleanups.size, 0);
  for (const node of nodes) for (const handlers of node.listeners.values()) assert.equal(handlers.size, 0);
  assert.equal(h.feature.requestReset(), false);
  assert.equal(h.feature.handleKey('o'), false);
  assert.doesNotThrow(() => { h.feature.open(); h.feature.close(); h.feature.update(); h.feature.dispose(); });
  assert.equal(h.panelDisposals, 1);
});
