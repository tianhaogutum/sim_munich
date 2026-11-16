import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createFeature, INTERACTION_STOPS, INTERACTION_RADIUS,
  INTERACTIONS_STORAGE_KEY, nearestInteraction, readCollection,
} from '../src/city_interactions.mjs';

const distance = (a, b) => Math.hypot((a.lon - b.lon) * 74300, (a.lat - b.lat) * 111320);
function harness(extra = {}) {
  const data = new Map();
  const notices = [];
  const engine = {
    player: { ...INTERACTION_STOPS[0] }, distance,
    getState: () => ({ ready: true, paused: false }),
    isInputBlocked: () => false,
    now: () => 1000,
    storage: { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) },
    notify: value => notices.push(value),
    ...extra,
  };
  return { engine, data, notices };
}

test('five sourced outdoor stops agree with existing research pack coordinates', () => {
  assert.equal(INTERACTION_STOPS.length, 5);
  assert.equal(new Set(INTERACTION_STOPS.map(stop => stop.id)).size, 5);
  assert.deepEqual(new Set(INTERACTION_STOPS.map(stop => stop.kind)), new Set(['bench', 'monument', 'cafe-exterior']));
  for (const stop of INTERACTION_STOPS) {
    const packId = stop.placeId.split('-')[0];
    const pack = JSON.parse(readFileSync(new URL(`../assets/city_research/${packId}.json`, import.meta.url)));
    const place = pack.places.find(place => place.id === stop.placeId);
    assert.ok(place, stop.placeId);
    assert.equal(stop.lon, place.lon);
    assert.equal(stop.lat, place.lat);
    assert.match(stop.source, /^https:\/\/(www\.muenchen\.de|www\.residenz-muenchen\.de|schloesser\.bayern\.de)\//);
    assert.ok(stop.credit);
    assert.match(stop.coordinateStatus, /approximate/);
  }
});

test('proximity is bounded; missing coordinates and invalid distances cannot consume E', () => {
  const stop = INTERACTION_STOPS[0];
  assert.equal(nearestInteraction(stop, distance).stop, stop);
  assert.equal(nearestInteraction(stop, () => INTERACTION_RADIUS).stop, INTERACTION_STOPS.at(-1));
  assert.equal(nearestInteraction(stop, () => INTERACTION_RADIUS + .01), null);
  assert.equal(nearestInteraction({}, distance), null);
  assert.equal(nearestInteraction(stop, () => NaN), null);
  assert.equal(nearestInteraction(stop, () => -1), null);
});

test('E collects once, provides observation feedback, and persists only the separate collection', () => {
  const { engine, data, notices } = harness();
  const feature = createFeature(engine);
  assert.equal(feature.handleKey('l'), false);
  assert.equal(feature.handleKey('e'), true);
  assert.equal(feature.getCollection().length, 1);
  assert.match(notices[0], /已收藏/);
  assert.match(notices[0], /石凳/);
  assert.deepEqual([...data.keys()], [INTERACTIONS_STORAGE_KEY]);
  assert.equal(feature.handleKey('e', { repeat: true }), true);
  assert.equal(notices.length, 1);
  assert.equal(feature.interact(), true);
  assert.match(notices[1], /再次观察/);
  assert.equal(feature.getCollection().length, 1);
  assert.equal(createFeature(engine).getCollection().length, 1);
  feature.dispose();
});

test('rechecks position on action so stale prompts do not collect or steal east landmark E', () => {
  const { engine, notices } = harness();
  const feature = createFeature(engine);
  assert.ok(feature.getNearest());
  Object.assign(engine.player, { lon: 11.7, lat: 48.13 });
  assert.equal(feature.handleKey('e'), false);
  assert.equal(feature.interact(), false);
  assert.equal(feature.getCollection().length, 0);
  assert.equal(notices.length, 0);
});

test('all five observations can be collected and survive reload without modifying city progress', () => {
  const { engine, data } = harness({ persist() { assert.fail('Must not write common progress'); } });
  const feature = createFeature(engine);
  for (const stop of INTERACTION_STOPS) {
    Object.assign(engine.player, stop);
    assert.equal(feature.interact(), true);
  }
  assert.equal(feature.getCollection().length, 5);
  assert.equal(data.size, 1);
  assert.equal(createFeature(engine).getCollection().length, 5);
  feature.getCollection().pop();
  assert.equal(feature.getCollection().length, 5);
});

test('modal, paused, not-ready and disposed states yield contextual input', () => {
  for (const overrides of [
    { isInputBlocked: () => true },
    { getState: () => ({ ready: false }) },
    { getState: () => ({ ready: true, paused: true }) },
  ]) {
    const { engine } = harness(overrides);
    const feature = createFeature(engine);
    assert.equal(feature.handleKey('e'), false);
    assert.equal(feature.interact(), false);
    assert.equal(feature.getNearest(), null);
  }
  const feature = createFeature(harness().engine);
  feature.dispose();
  feature.dispose();
  assert.equal(feature.handleKey('e'), false);
});

test('malformed, foreign and duplicated save entries are safely filtered', () => {
  for (const raw of ['no json', 'null', '{"version":2,"collected":[]}', '{"version":1,"collected":"bad"}']) {
    assert.equal(readCollection({ getItem: () => raw }).size, 0);
  }
  const id = INTERACTION_STOPS[0].id;
  const raw = JSON.stringify({ version: 1, collected: [id, id, 'mission-id', {}, null] });
  assert.deepEqual([...readCollection({ getItem: () => raw })], [id]);
  assert.equal(readCollection({ getItem() { throw new Error('denied'); } }).size, 0);
});

test('storage failure keeps session collection and a subsequent observation retries saving', () => {
  const { engine, notices } = harness({ storage: { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } } });
  const feature = createFeature(engine);
  assert.equal(feature.interact(), true);
  assert.equal(feature.getCollection().length, 1);
  assert.match(notices[0], /仅保留本次会话/);
  let saved;
  engine.storage.setItem = (key, value) => { saved = JSON.parse(value); };
  feature.interact();
  assert.equal(saved.collected.length, 1);
  assert.doesNotMatch(notices[1], /仅保留本次会话/);
});

class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.listeners = new Map(); this.attributes = {}; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
}
test('DOM prompt has a working mobile action, collection sources, modal gating and cleanup', () => {
  const ui = new Node('div');
  const body = new Node('div');
  let opened = false;
  let disposeCount = 0;
  let hostDispose;
  let unregisterCount = 0;
  const panel = { body, isOpen: () => opened, open() { opened = true; }, dispose() { disposeCount++; } };
  const { engine } = harness({
    document: { createElement: tag => new Node(tag) }, ui,
    createPanel(id, options) { assert.equal(id, 'city-interactions'); assert.equal(options.key, undefined); return panel; },
    onDispose(fn) { hostDispose = fn; return () => unregisterCount++; },
  });
  const feature = createFeature(engine);
  const prompt = ui.children[0];
  assert.equal(prompt.hidden, false);
  const button = prompt.children[1];
  button.listeners.get('click')();
  assert.equal(feature.getCollection().length, 1);
  const rows = body.children[0].children.filter(node => node.tagName === 'section');
  assert.equal(rows.length, 5);
  for (const row of rows) assert.match(row.children.find(node => node.tagName === 'a').href, /^https:/);
  feature.openCollection();
  assert.equal(feature.isOpen(), true);
  assert.equal(prompt.hidden, true);
  assert.equal(feature.handleKey('e'), false);
  opened = false;
  engine.player.lon = 11.7;
  engine.now = () => 12000;
  feature.update();
  assert.equal(prompt.hidden, true);
  hostDispose();
  feature.dispose();
  assert.equal(disposeCount, 1);
  assert.equal(unregisterCount, 1);
  assert.equal(ui.children.length, 0);
  assert.equal(button.listeners.size, 0);
});

test('injected THREE tokens delegate geographic transforms to host and release resources', () => {
  const registrations = [];
  let detached = 0, geometriesDisposed = 0, materialsDisposed = 0;
  class Group { add(mesh) { this.mesh = mesh; } }
  class Geometry { dispose() { geometriesDisposed++; } }
  class Material {
    constructor() { this.color = { setHex: hex => { this.hex = hex; } }; }
    dispose() { materialsDisposed++; }
  }
  class Mesh { constructor(geometry, material) { Object.assign(this, { geometry, material, position: {} }); } }
  const { engine } = harness({
    THREE: { Group, OctahedronGeometry: Geometry, MeshBasicMaterial: Material, Mesh },
    addGeoObject(options) { registrations.push(options); return () => detached++; },
  });
  const feature = createFeature(engine);
  assert.equal(registrations.length, 5);
  for (const entry of registrations) {
    assert.equal(entry.replaceBuildings, false);
    assert.equal(entry.group.position, undefined);
  }
  feature.interact();
  assert.equal(registrations[0].group.mesh.material.hex, 0x6bb892);
  feature.dispose();
  feature.dispose();
  assert.deepEqual([detached, geometriesDisposed, materialsDisposed], [5, 5, 5]);
});
