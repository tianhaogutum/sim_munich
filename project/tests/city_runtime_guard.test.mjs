import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature } from '../src/city_runtime_guard.mjs';

class Events {
  listeners = new Map();
  on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  off(type, fn) { this.listeners.get(type)?.delete(fn); }
  addEventListener(type, fn) { this.on(type, fn); }
  removeEventListener(type, fn) { this.off(type, fn); }
  emit(type, event = {}) { for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event); }
  count() { return [...this.listeners.values()].reduce((n, fns) => n + fns.size, 0); }
}
class Element extends Events {
  children = []; dataset = {}; attributes = {}; textContent = ''; hidden = false;
  append(...children) { this.children.push(...children); for (const child of children) child.parent = this; }
  setAttribute(key, value) { this.attributes[key] = value; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}
function fixture({ dom = true } = {}) {
  let time = 0, style = true, tiles = true, persistCalls = 0, disposeHook;
  const loaded = new Map([['streets', true], ['labels', true]]), calls = [];
  const map = new Events(), window = new Events(), document = new Events(), ui = new Element();
  window.navigator = { onLine: true }; document.hidden = false; document.createElement = () => new Element();
  const sources = { streets: { setUrl(url) { calls.push(['streets', url]); loaded.set('streets', false); tiles = false; } }, labels: { setTiles(value) { calls.push(['labels', value]); loaded.set('labels', false); tiles = false; } } };
  map.getSource = id => sources[id];
  map.getStyle = () => ({ sources: { streets: { type: 'vector', url: 'https://example.test/streets.json' }, labels: { type: 'raster', tiles: ['https://example.test/labels/{z}/{x}/{y}'] } } });
  map.isStyleLoaded = () => style; map.areTilesLoaded = () => tiles;
  map.isSourceLoaded = id => loaded.get(id) ?? false;
  map.setStyle = () => { throw new Error('Style replacement forbidden'); };
  const engine = { map, window, document: dom ? document : undefined, ui, metrics: {}, now: () => time,
    getState: () => ({ ready: true, sourceReady: loaded.get('streets') }), persist: () => persistCalls++,
    onDispose(fn) { disposeHook = fn; return () => { disposeHook = null; }; } };
  const feature = createFeature(engine);
  return { feature, engine, map, window, document, ui, calls, loaded, sources,
    advance(ms) { time += ms; feature.update(); }, setStyle(value) { style = value; }, setTiles(value) { tiles = value; },
    get persistCalls() { return persistCalls; }, get disposeHook() { return disposeHook; },
    fail(id = 'streets', message = 'HTTP 503') { map.emit('error', { sourceId: id, error: new Error(message) }); },
    recover(id = 'streets') { loaded.set(id, true); tiles = true; map.emit('sourcedata', { sourceId: id, isSourceLoaded: true, sourceDataType: 'content' }); } };
}

test('map source loading, slow connection, recovery and offline states follow real events', () => {
  const f = fixture(); assert.equal(f.feature.getStatus().mode, 'ready');
  f.loaded.set('streets', false); f.setTiles(false);
  f.map.emit('sourcedataloading', { sourceId: 'streets' });
  assert.equal(f.feature.getStatus().mode, 'loading');
  f.advance(15000); assert.equal(f.feature.getStatus().mode, 'slow');
  f.recover(); assert.equal(f.feature.getStatus().mode, 'ready');
  f.window.navigator.onLine = false; f.window.emit('offline');
  assert.equal(f.feature.getStatus().mode, 'offline');
  f.window.navigator.onLine = true; f.window.emit('online');
  assert.equal(f.feature.getStatus().mode, 'ready');
  f.feature.dispose();
});

test('a failed request remains visible despite areTilesLoaded/isSourceLoaded returning true', () => {
  const f = fixture(); f.fail(); f.map.emit('idle'); f.advance(20000);
  assert.equal(f.feature.getStatus().mode, 'error');
  assert.equal(f.feature.getStatus().failedSources[0].error, 'HTTP 503');
  f.map.emit('sourcedata', { sourceId: 'streets', sourceDataType: 'metadata' });
  assert.equal(f.feature.getStatus().mode, 'error');
  f.recover(); assert.equal(f.feature.getStatus().mode, 'ready'); f.feature.dispose();
});

test('manual retries target only the failed source, never prefetch or replace style', () => {
  const f = fixture(); f.fail();
  assert.deepEqual(f.calls, []);
  assert.equal(f.feature.retry(), true);
  assert.deepEqual(f.calls, [['streets', 'https://example.test/streets.json']]);
  assert.equal(f.feature.getStatus().mode, 'error'); // requested is not recovered
  assert.equal(f.feature.retry(), false);
  f.recover(); assert.equal(f.feature.getStatus().mode, 'ready'); f.feature.dispose();
});

test('retries enforce cooldown and a lifetime cap even after recovery', () => {
  const f = fixture();
  for (let attempt = 0; attempt < 3; attempt++) {
    f.fail(); assert.equal(f.feature.retry(), true); f.recover();
    f.fail(); assert.equal(f.feature.retry(), false); f.advance(5000);
  }
  assert.equal(f.feature.retry(), false);
  assert.equal(f.feature.getStatus().retriesRemaining, 0);
  assert.equal(f.calls.length, 3); f.feature.dispose();
});

test('offline does not request retry; going online does not pretend a failed source recovered', () => {
  const f = fixture(); f.fail(); f.window.navigator.onLine = false; f.window.emit('offline');
  assert.equal(f.feature.retry(), false); assert.deepEqual(f.calls, []);
  f.window.navigator.onLine = true; f.window.emit('online');
  assert.equal(f.feature.getStatus().mode, 'error');
  assert.equal(f.feature.getStatus().canRetry, true); f.feature.dispose();
});

test('tile sources use public setTiles, and unsupported or general failures fall back safely', () => {
  const f = fixture(); f.fail('labels'); assert.equal(f.feature.retry(), true);
  assert.deepEqual(f.calls[0], ['labels', ['https://example.test/labels/{z}/{x}/{y}']]);
  f.recover('labels'); f.advance(5000); f.fail('missing');
  assert.equal(f.feature.retry(), false); assert.equal(f.feature.getStatus().mode, 'error');
  f.feature.dispose();
  const g = fixture(); g.setStyle(false); g.map.emit('error', { error: new Error('style JSON failed') });
  assert.equal(g.feature.retry(), false); g.map.emit('idle');
  assert.equal(g.feature.getStatus().mode, 'error');
  g.setStyle(true); g.map.emit('styledata'); assert.equal(g.feature.getStatus().mode, 'ready'); g.feature.dispose();
});

test('retry exceptions consume the bounded attempt and remain reviewable', () => {
  const f = fixture(); f.sources.streets.setUrl = () => { throw new Error('source unavailable'); };
  f.fail(); assert.equal(f.feature.retry(), true);
  assert.equal(f.feature.getStatus().attempts, 1);
  assert.equal(f.feature.getStatus().failedSources[0].error, 'source unavailable'); f.feature.dispose();
});

test('collision refresh coalesces tile events, responds to movement, and has a sparse-event backstop', () => {
  const f = fixture();
  assert.equal(f.feature.shouldRefreshCollision(0), true);
  assert.equal(f.feature.shouldRefreshCollision(150), false);
  f.map.emit('moveend'); assert.equal(f.feature.shouldRefreshCollision(149), false);
  assert.equal(f.feature.shouldRefreshCollision(150), true);
  assert.equal(f.feature.shouldRefreshCollision(2149), false);
  assert.equal(f.feature.shouldRefreshCollision(2150), true);
  f.recover(); assert.equal(f.feature.shouldRefreshCollision(2300), true);
  assert.equal(f.feature.shouldRefreshCollision(NaN), false); f.feature.dispose();
});

test('measured frame/collision cost slows scheduling; invalid telemetry is ignored and pressure recovers', () => {
  const f = fixture(); Object.assign(f.engine.metrics, { frameMs: 45, collisionMs: 14 }); f.advance(100);
  assert.equal(f.feature.getStatus().pressure, 'high');
  assert.equal(f.feature.shouldRefreshCollision(0), true); f.map.emit('moveend');
  assert.equal(f.feature.shouldRefreshCollision(599), false); assert.equal(f.feature.shouldRefreshCollision(600), true);
  assert.equal(f.feature.shouldPersist(0), true); assert.equal(f.feature.shouldPersist(2999), false);
  assert.equal(f.feature.shouldPersist(3000), true);
  Object.assign(f.engine.metrics, { frameMs: NaN, collisionMs: -1 }); f.advance(100);
  assert.equal(f.feature.getStatus().pressure, 'high');
  Object.assign(f.engine.metrics, { frameMs: 12, collisionMs: 1 });
  for (let i = 0; i < 20; i++) f.advance(100);
  assert.equal(f.feature.getStatus().pressure, 'normal'); f.feature.dispose();
});

test('persistence is gated, hidden pages skip periodic writes, and pagehide flush is owned and cleaned', () => {
  const f = fixture(); assert.equal(f.feature.shouldPersist(0), true);
  assert.equal(f.feature.shouldPersist(1499), false); assert.equal(f.feature.shouldPersist(1500), true);
  f.document.hidden = true; assert.equal(f.feature.shouldPersist(3000), false);
  f.window.emit('pagehide'); assert.equal(f.persistCalls, 1);
  f.feature.dispose(); f.window.emit('pagehide'); assert.equal(f.persistCalls, 1);
});

test('badge uses textContent for external errors, an accessible status, and a working retry button', () => {
  const f = fixture(); const badge = f.ui.children[0], [label, details, retry, fallback] = badge.children;
  assert.equal(label.attributes.role, 'status'); assert.equal(retry.hidden, true);
  f.fail('streets', '<img src=x onerror=alert(1)>');
  assert.ok(details.textContent.includes('<img src=x onerror=alert(1)>'));
  assert.equal(details.children.length, 0); assert.equal(fallback.hidden, false);
  assert.equal(retry.disabled, false); retry.emit('click'); assert.equal(f.calls.length, 1);
  f.feature.dispose(); assert.equal(retry.count(), 0); assert.equal(f.ui.children.length, 0);
});

test('host disposal is idempotent, removes every listener and deactivates scheduling', () => {
  const f = fixture(); assert.ok(f.map.count() > 0); assert.ok(f.window.count() > 0);
  const dispose = f.disposeHook; dispose(); f.feature.dispose();
  assert.equal(f.map.count(), 0); assert.equal(f.window.count(), 0); assert.equal(f.document.count(), 0);
  assert.equal(f.disposeHook, null); assert.equal(f.ui.children.length, 0);
  assert.equal(f.feature.shouldRefreshCollision(10000), false);
  assert.equal(f.feature.shouldPersist(10000), false); assert.equal(f.feature.retry(), false);
  f.map.emit('error', { error: new Error('late') }); assert.deepEqual(f.feature.getStatus().failedSources, []);
});

test('works without DOM, telemetry, storage, or complete MapLibre introspection', () => {
  const listeners = new Events();
  const feature = createFeature({ map: listeners, now: () => 0, getState: () => ({ ready: true }) });
  assert.equal(feature.getStatus().mode, 'ready');
  assert.equal(feature.shouldRefreshCollision(), true); assert.equal(feature.shouldPersist(), true);
  feature.dispose(); assert.equal(listeners.count(), 0);
});
