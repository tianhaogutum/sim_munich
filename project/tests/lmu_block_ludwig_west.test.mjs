import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toWorld, fromWorld, ringToWorld, pointInPolygon } from '../src/date_geo.mjs';
import { CORE_BOUNDS, BOUNDS } from '../src/date_route.mjs';
import { DATA } from '../src/lmu_block_ludwig_west_data.mjs';
import { SECTOR, BUILD_LIMITS, FOOTPRINTS, LANDMARKS, footprintBlocked } from '../src/lmu_block_ludwig_west_geometry.mjs';

const raw = JSON.parse(readFileSync(new URL('../assets/osm/ludwig_west.json', import.meta.url)));
const area = r => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p.x * q.z - q.x * p.z; }, 0) / 2;

test('WGS84 origin, axes and metre conversion match the shared contract', () => {
  assert.deepEqual(toWorld(48.15075, 11.58035), { x: 0, z: 0 });
  assert.ok(toWorld(48.15175, 11.58035).x > 110);
  assert.ok(toWorld(48.15075, 11.58135).z > 74);
  for (const p of [{ x: -480, z: -250 }, { x: -224, z: -6 }]) {
    const gps = fromWorld(p.x, p.z), restored = toWorld(gps.lat, gps.lon);
    assert.ok(Math.abs(restored.x - p.x) < 1e-7);
    assert.ok(Math.abs(restored.z - p.z) < 1e-7);
  }
});

test('all retained footprints and courtyard rings stay inside this sector and outside the core', () => {
  assert.equal(FOOTPRINTS.length, 75);
  for (const p of FOOTPRINTS) {
    assert.ok(p.ring.length >= 3, p.id);
    assert.ok(Math.abs(area(p.ring)) > 9, p.id);
    for (const v of [p.ring, ...p.holes].flat()) {
      assert.ok(Number.isFinite(v.x) && Number.isFinite(v.z), p.id);
      assert.ok(v.x >= BUILD_LIMITS.minX - 1e-6 && v.x <= BUILD_LIMITS.maxX + 1e-6, p.id);
      assert.ok(v.z >= BUILD_LIMITS.minZ - 1e-6 && v.z <= BUILD_LIMITS.maxZ + 1e-6, p.id);
      assert.ok(v.x < CORE_BOUNDS.minX, p.id);
    }
  }
  assert.ok(BUILD_LIMITS.maxZ < 55, 'leave the street agent strip untouched');
});

test('every building has real OSM provenance; uncut Philologicum vertices retain metre accuracy', () => {
  const ids = new Set(raw.elements.map(e => `${e.type}/${e.id}`));
  for (const b of DATA.buildings) {
    assert.ok(ids.has(b.id.split('/').slice(0, 2).join('/')), b.id);
    assert.ok(b.height > 2 && b.height < 45);
    assert.ok(b.levels > 0 && b.levels <= 8);
  }
  const source = raw.elements.find(e => e.id === 19322270);
  const b = DATA.buildings.find(b => b.id === 'way/19322270');
  assert.equal(b.clipped, false);
  const world = ringToWorld(source.geometry.slice(0, -1).map(g => [g.lon, g.lat]));
  assert.equal(world.length, b.ring.length);
  world.forEach((p, i) => {
    assert.ok(Math.abs(p.x - b.ring[i][0]) < 0.0006);
    assert.ok(Math.abs(p.z - b.ring[i][1]) < 0.0006);
  });
  for (const name of ['Philologicum', 'Ludwigstraße']) assert.ok(JSON.stringify(raw).includes(name));
  assert.ok(!DATA.buildings.some(b => ['way/25440202', 'relation/52412', 'way/1162661907'].includes(b.id)), 'exclude east-side landmarks');
});

test('collision covers the interior of every footprint while keeping the Schelling courtyard open', () => {
  for (const p of FOOTPRINTS) {
    let found = false;
    const sign = area(p.ring) > 0 ? 1 : -1;
    for (let i = 0; i < p.ring.length; i++) {
      const a = p.ring[i], b = p.ring[(i + 1) % p.ring.length];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const x = (a.x + b.x) / 2 - sign * dz / len * 0.1;
      const z = (a.z + b.z) / 2 + sign * dx / len * 0.1;
      if (!pointInPolygon(x, z, p.ring) || p.holes.some(h => pointInPolygon(x, z, h))) continue;
      assert.equal(footprintBlocked(x, z), true, p.id); found = true; break;
    }
    assert.ok(found, `could not find a solid interior probe for ${p.id}`);
  }
  const campus = FOOTPRINTS.find(p => p.id === 'relation/6732402');
  assert.equal(campus.holes.length, 1);
  const courtyard = campus.holes[0];
  const x = courtyard.reduce((s, p) => s + p.x, 0) / courtyard.length;
  const z = courtyard.reduce((s, p) => s + p.z, 0) / courtyard.length;
  assert.ok(pointInPolygon(x, z, courtyard));
  assert.equal(footprintBlocked(x, z), false);
});

test('Chinese landmarks have sources and are walkable inside the engine world', () => {
  assert.equal(new Set(LANDMARKS.map(p => p.id)).size, LANDMARKS.length);
  for (const p of LANDMARKS) {
    assert.equal(footprintBlocked(p.x, p.z), false, p.id);
    assert.ok(p.x > SECTOR.minX && p.x < SECTOR.maxX && p.z > SECTOR.minZ && p.z < SECTOR.maxZ);
    assert.ok(p.x > BOUNDS.minX && p.x < BOUNDS.maxX && p.z > BOUNDS.minZ && p.z < BOUNDS.maxZ);
    assert.match(p.text, /来源/);
    assert.ok(p.text.split('\n').length <= 3);
  }
});

test('raw OSM export fits the asset budget and includes a query and attribution', () => {
  const uri = new URL('../assets/osm/ludwig_west.json', import.meta.url);
  assert.ok(readFileSync(uri).length <= 300_000);
  const source = JSON.parse(readFileSync(new URL('../assets/osm/ludwig_west.sources.json', import.meta.url)));
  assert.match(source.query, /building/);
  assert.match(source.attribution, /© OpenStreetMap contributors, ODbL/);
  assert.ok(Number.isFinite(Date.parse(source.timestamp)));
});
