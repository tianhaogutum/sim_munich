import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeature, planOlympicTower, OLYMPIC_TOWER, OLYMPIC_SOURCES} from '../src/city_landmark_olympic.mjs';

// Contract-focused THREE doubles exercise actual construction, instancing and cleanup.
function fixture({headless = false, failAttach = false} = {}) {
  const allocated = [], attached = [], panels = [], calls = {detach: 0, unsubscribe: 0, unregister: 0};
  class Vector { set(x, y, z) { Object.assign(this, {x, y, z}); } }
  class Object3D {
    constructor() { this.children = []; this.position = new Vector(); this.visible = true; this.matrix = {}; }
    add(child) { child.parent = this; this.children.push(child); }
    removeFromParent() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    traverse(fn) { fn(this); for (const child of this.children) child.traverse(fn); }
    updateMatrix() { this.matrix = {...this.position}; }
  }
  class Resource {
    constructor(...args) { this.args = args; this.disposals = 0; allocated.push(this); }
    dispose() { this.disposals++; }
  }
  class Mesh extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
  class InstancedMesh extends Mesh {
    constructor(geometry, material, count) { super(geometry, material); this.count = count; this.instances = []; this.instanceMatrix = {}; this.isInstancedMesh = true; this.disposals = 0; }
    setMatrixAt(i, matrix) { this.instances[i] = {...matrix}; }
    computeBoundingSphere() { this.bounded = true; }
    dispose() { this.disposals++; }
  }
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; }
    appendChild(child) { this.children.push(child); }
  }
  const scene = new Object3D();
  const settings = {quality: 'medium'};
  let settingsCallback, cleanup;
  let distance = 100, center = {lng: 11.55, lat: 48.17}, distanceOrigin;
  const engine = {
    THREE: {Group: Object3D, Object3D, Mesh, InstancedMesh, CylinderGeometry: Resource, MeshLambertMaterial: Resource},
    player: {lon: 11.58, lat: 48.15}, map: {getCenter: () => center},
    distance: origin => { distanceOrigin = origin; return distance; },
    getSettings: () => settings,
    onSettings: cb => { settingsCallback = cb; return () => calls.unsubscribe++; },
    onDispose: cb => { cleanup = cb; return () => calls.unregister++; },
    addGeoObject: options => { if (failAttach) throw Error('attach failed'); attached.push(options); scene.add(options.group); return () => {calls.detach++; options.group.removeFromParent();}; },
    ...headless ? {} : {
      document: {createElement: tag => new Element(tag)},
      createPanel(id, options) {
        let open = false;
        const panel = {id, options, body: new Element('body'), open: () => {open = true;}, isOpen: () => open, dispose() { this.disposed = true; open = false; }};
        panels.push(panel); return panel;
      },
    },
  };
  return {engine, allocated, attached, panels, calls, scene, setDistance: d => {distance = d;}, setCenter: c => {center = c;}, getOrigin: () => distanceOrigin, settings: quality => {settings.quality = quality; settingsCallback(settings);}, cleanup: () => cleanup()};
}

test('tower plan preserves silhouette with bounded finite geometry and sourced height', () => {
  const plan = planOlympicTower();
  assert.ok(plan.length < 230);
  for (const p of plan) {
    assert.ok(Number.isFinite(p.bottom) && Number.isFinite(p.top));
    assert.ok(p.bottom >= 0 && p.top > p.bottom && p.top <= OLYMPIC_TOWER.height + 1e-9, p.name);
    const radius = p.shape === 'post' ? Math.hypot(p.x, p.z) + p.radius : Math.max(p.radiusBottom, p.radiusTop);
    assert.ok(radius > 0 && radius <= 15, p.name);
  }
  assert.equal(Math.max(...plan.map(p => p.top)), 291.28);
  const shaft = plan.find(p => p.name === 'tapered-shaft');
  assert.ok(shaft.radiusBottom > shaft.radiusTop);
  assert.ok(plan.find(p => p.name === 'lower-basket-bowl').top < plan.find(p => p.name === 'public-basket-bowl').bottom);
  assert.equal(plan.filter(p => p.name.startsWith('observation-platform')).length, 3);
  assert.equal(plan.filter(p => p.name.startsWith('antenna-tip')).length, 7);
});

test('factory registers one local metre model, keeps ownership of transform with host', () => {
  const f = fixture(), feature = createFeature(f.engine);
  assert.equal(f.attached.length, 1);
  const options = f.attached[0];
  assert.equal(options.group, feature.group);
  assert.equal(options.lon, OLYMPIC_TOWER.lon); assert.equal(options.lat, OLYMPIC_TOWER.lat);
  assert.equal(options.replaceBuildings, false); // approximate anchor must not suppress neighbours
  assert.equal(options.minZoom, 11); assert.equal(options.maxDistance, 9000);
  assert.deepEqual({...feature.group.position}, {});
  const meshes = [];
  feature.group.traverse(o => {if (o.geometry) meshes.push(o);});
  assert.ok(meshes.length < 55);
  const instances = meshes.filter(o => o.isInstancedMesh);
  assert.ok(instances.length > 0 && instances.length < 10);
  for (const mesh of instances) { assert.equal(mesh.instances.length, mesh.count); assert.ok(mesh.bounded); assert.equal(mesh.instanceMatrix.needsUpdate, true); }
  feature.dispose();
});

test('distance detail has hysteresis, map-centre origin and shared quality control', () => {
  const f = fixture(), feature = createFeature(f.engine);
  assert.equal(feature.getDetailLevel(), 'near');
  assert.deepEqual(f.getOrigin(), {lon: 11.55, lat: 48.17});
  f.setDistance(950); feature.update(); assert.equal(feature.getDetailLevel(), 'near');
  f.setDistance(1001); feature.update(); assert.equal(feature.getDetailLevel(), 'far');
  f.setDistance(950); feature.update(); assert.equal(feature.getDetailLevel(), 'far');
  f.settings('high'); assert.equal(feature.getDetailLevel(), 'near');
  f.settings('low'); assert.equal(feature.getDetailLevel(), 'far');
  f.settings('medium'); f.setDistance(899); feature.update(); assert.equal(feature.getDetailLevel(), 'near');
  f.setDistance(NaN); feature.update(); assert.equal(feature.getDetailLevel(), 'far');
  f.setCenter(null); feature.update(); assert.equal(f.getOrigin(), f.engine.player);
  feature.dispose();
});

test('source links and photographer attribution are accessible through managed panel and public API', () => {
  const f = fixture(), feature = createFeature(f.engine), panel = f.panels[0];
  assert.equal(feature.sources, OLYMPIC_SOURCES); assert.equal(feature.group.userData.sources, OLYMPIC_SOURCES);
  assert.equal(panel.options.key, undefined);
  assert.equal(feature.isOpen(), false); feature.openSources(); assert.equal(feature.isOpen(), true);
  const elements = [];
  const walk = e => {elements.push(e); e.children.forEach(walk);}; walk(panel.body);
  for (const source of OLYMPIC_SOURCES) assert.ok(elements.some(e => e.href === source.url));
  assert.ok(elements.some(e => e.textContent?.includes('Alexander Migl')));
  assert.ok(elements.some(e => e.textContent?.includes('not a surveyed')));
  assert.ok(elements.filter(e => e.tag === 'a').every(e => e.rel === 'noopener noreferrer'));
  feature.dispose(); assert.equal(panel.disposed, true); assert.equal(feature.isOpen(), false);
});

test('host and explicit disposal are idempotent and release all owned GPU resources', () => {
  const f = fixture(), feature = createFeature(f.engine), instances = [];
  feature.group.traverse(o => {if (o.isInstancedMesh) instances.push(o);});
  f.cleanup(); feature.dispose(); feature.update(); feature.openSources();
  assert.deepEqual(f.calls, {detach: 1, unsubscribe: 1, unregister: 1});
  assert.equal(f.scene.children.length, 0);
  assert.ok(f.allocated.every(resource => resource.disposals === 1));
  assert.ok(instances.every(mesh => mesh.disposals === 1));
  assert.equal(feature.getDetailLevel(), 'disposed');
});

test('headless factory works and failed host attachment releases partial construction', () => {
  const f = fixture({headless: true}), feature = createFeature(f.engine);
  feature.openSources(); assert.equal(feature.isOpen(), false); feature.dispose();
  const broken = fixture({failAttach: true});
  assert.throws(() => createFeature(broken.engine), /attach failed/);
  assert.ok(broken.allocated.every(resource => resource.disposals === 1));
  assert.throws(() => createFeature({}), /requires engine.THREE/);
});
