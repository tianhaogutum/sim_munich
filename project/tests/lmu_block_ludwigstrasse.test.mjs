import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORIGIN, toWorld, fromWorld, pointInPolygon } from '../src/date_geo.mjs';
import { CORE_BOUNDS } from '../src/date_route.mjs';
import {
  FOOTPRINTS, VISTA_FOOTPRINTS, LANDMARKS, LANES, ROADS, CYCLE_PATHS, WALK_PATHS,
  CROSS_STREETS, TREES, LAMPS, STOPS, ENTRANCES, DEFERRED_ENTRANCES,
  inSector, clipToSectors, ribbon, rectangle, blockContains, axisZ, clipPath,
} from '../src/lmu_block_ludwigstrasse_plan.mjs';
import { TREE_NODES, ROAD_WAYS } from '../src/lmu_block_ludwigstrasse_data.mjs';

const inCore = p => p.x > CORE_BOUNDS.minX && p.x < CORE_BOUNDS.maxX && p.z > CORE_BOUNDS.minZ && p.z < CORE_BOUNDS.maxZ;
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
test('conversion uses the LMU origin, +X north and +Z east, with reversible metres', () => {
  assert.deepEqual(toWorld(ORIGIN.lat, ORIGIN.lon), { x: 0, z: 0 });
  near(toWorld(ORIGIN.lat + .001, ORIGIN.lon).x, 110.574);
  assert.ok(toWorld(ORIGIN.lat, ORIGIN.lon + .001).z > 74);
  const ll = fromWorld(-480, -74.2), p = toWorld(ll.lat, ll.lon);
  near(p.x, -480); near(p.z, -74.2);
});
test('every local solid footprint is inside its street sector, never in the core', () => {
  assert.ok(FOOTPRINTS.length > 80);
  for (const f of FOOTPRINTS) for (const p of f.points) {
    assert.ok(inSector(p.x, p.z, -1e-6), `${f.id} outside sector`);
    assert.ok(!inCore(p), `${f.id} overlaps core`);
  }
});
test('all surface polygons are clipped on the exact ±150/±480 seams', () => {
  for (const paths of [ROADS, CYCLE_PATHS, WALK_PATHS, CROSS_STREETS]) {
    for (const path of paths) for (const ring of clipToSectors(ribbon(path.points, (path.width || 10) + 8))) {
      for (const p of ring) { assert.ok(inSector(p.x, p.z, -1e-6)); assert.ok(!inCore(p)); }
    }
  }
  assert.deepEqual(clipToSectors(rectangle(0, 80, 100, 100)), []);
});
test('clipping a path through the plaza makes two segments, with no invisible core bridge', () => {
  const paths = clipPath([{ x: -480, z: axisZ(-480) }, { x: 480, z: axisZ(480) }]);
  assert.equal(paths.length, 2);
  near(paths[0].at(-1).x, -150); near(paths[1][0].x, 150);
});
test('Chinese landmark interaction points are in-sector and clear of all registered solids', () => {
  for (const p of LANDMARKS) {
    assert.ok(inSector(p.x, p.z)); assert.equal(blockContains(p.x, p.z), false);
    assert.match(p.text, /来源/); assert.ok(p.text.split('\n').length <= 3);
    for (const dx of [-.4, 0, .4]) for (const dz of [-.4, 0, .4]) assert.equal(blockContains(p.x + dx, p.z + dz), false);
  }
});
test('motor and cycle paths retain travel order, distinct north/south directions and the core gap', () => {
  assert.ok(LANES.some(l => l.mode === 'motor' && l.vehicleTypes.includes('bus')));
  for (const mode of ['motor', 'cycle']) for (const direction of ['northbound', 'southbound']) assert.ok(LANES.some(l => l.mode === mode && l.direction === direction));
  for (const lane of LANES) {
    assert.ok(lane.points.length >= 2);
    for (const p of lane.points) assert.ok(inSector(p.x, p.z, -1e-6), lane.id);
    assert.equal(lane.direction, lane.points.at(-1).x > lane.points[0].x ? 'northbound' : 'southbound');
    for (const next of lane.next) assert.ok(LANES.find(l => l.id === next));
  }
});
test('six/seven southern lanes and four/five northern lanes follow retained OSM tags', () => {
  assert.ok(ROADS.some(r => r.points[0].x < 0 && r.count === 6));
  assert.ok(ROADS.some(r => r.points[0].x < 0 && r.count === 7));
  assert.ok(ROADS.some(r => r.tags.name === 'Leopoldstraße' && r.count === 4));
  for (const r of ROADS) assert.equal(r.count, Number(ROAD_WAYS.find(w => w.id === r.osmWayId).tags.lanes || 2));
});
test('all rendered trees have an OSM point; estimated positions are restricted to lamps', () => {
  assert.ok(TREES.length > 20);
  for (const tree of TREES) assert.deepEqual(tree, TREE_NODES.find(p => p.id === tree.id));
  assert.ok(LAMPS.some(p => p.source === 'estimated'));
});
test('Universität C/D stairs and stop platforms outside the core are selected; core entries deferred', () => {
  assert.deepEqual(ENTRANCES.map(p => p.tags.ref).sort(), ['C', 'D']);
  for (const p of ENTRANCES) assert.ok(inSector(p.x, p.z, 5));
  assert.ok(DEFERRED_ENTRANCES.some(p => p.tags.ref === 'A'));
  assert.ok(DEFERRED_ENTRANCES.some(p => p.tags.ref === 'B'));
  assert.deepEqual(STOPS.map(p => p.tags.name).sort(), ['Georgenstraße', 'Universität']);
});
test('only the two explicitly requested southern vistas may be outside the street sectors', () => {
  assert.equal(VISTA_FOOTPRINTS.length, 2);
  for (const f of VISTA_FOOTPRINTS) {
    assert.equal(f.distantScenery, true); assert.match(f.source, /openstreetmap.org\/way\//);
    for (const p of f.points) assert.ok(p.x < -900 && !inCore(p));
    // Interior samples of the real outline are blocked even beyond the current walkable world.
    const p = f.points[0], q = f.points[1], r = f.points[2];
    const x = (p.x + q.x + r.x) / 3, z = (p.z + q.z + r.z) / 3;
    if (pointInPolygon(x, z, f.points)) assert.equal(blockContains(x, z), true);
  }
});
test('retained raw OSM snapshot stays below 300 KB with query, time and ODbL attribution', () => {
  const path = new URL('../assets/osm/ludwigstrasse.json', import.meta.url);
  assert.ok(fs.statSync(path).size <= 300_000);
  const raw = JSON.parse(fs.readFileSync(path));
  assert.ok(raw.elements.length > 50);
  const sources = JSON.parse(fs.readFileSync(new URL('../assets/osm/ludwigstrasse.sources.json', import.meta.url)));
  assert.match(sources.query, /out:json/); assert.match(sources.retrieved_at, /^2026-/); assert.match(sources.attribution, /OpenStreetMap contributors, ODbL/);
});
test('German right-hand motor traffic is on the east side northbound and west side southbound', () => {
  // Straight two-way surveyed segment at x≈-350. +Z is east, the right side when heading north.
  const lanes = LANES.filter(l => l.mode === 'motor' && l.osmWayId === 40317920);
  const road = ROADS.find(r => r.osmWayId === 40317920);
  const a = road.points[0], b = road.points[1];
  const centerZ = x => a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x);
  for (const l of lanes) {
    const p = l.points[0];
    assert.ok(l.direction === 'northbound' ? p.z > centerZ(p.x) : p.z < centerZ(p.x), l.id);
  }
});
test('surveyed carriageway/cycle centerlines avoid the neighbouring agents’ OSM buildings', async () => {
  const { BUILDING_BOUNDARIES } = await import('../src/lmu_block_ludwigstrasse_data.mjs');
  const { samplePath } = await import('../src/lmu_block_ludwigstrasse_plan.mjs');
  for (const path of [...ROADS, ...CYCLE_PATHS]) for (const p of samplePath(path.points, 1)) {
    for (const building of BUILDING_BOUNDARIES) assert.equal(pointInPolygon(p.x, p.z, building.points), false, `${path.id} crosses building ${building.id}`);
  }
});
test('generated survey coordinates match the retained raw WGS84 elements', async () => {
  const data = await import('../src/lmu_block_ludwigstrasse_data.mjs');
  const raw = JSON.parse(fs.readFileSync(new URL('../assets/osm/ludwigstrasse.json', import.meta.url)));
  for (const entries of Object.values(data)) for (const feature of entries) {
    const original = raw.elements.find(e => e.id === feature.id);
    assert.ok(original, `raw element missing: ${feature.id}`);
    if (feature.points) {
      assert.equal(feature.points.length, original.geometry.length);
      feature.points.forEach((p, i) => {
        const expected = toWorld(original.geometry[i].lat, original.geometry[i].lon);
        near(p.x, expected.x, .000051); near(p.z, expected.z, .000051);
      });
    } else {
      const expected = toWorld(original.lat, original.lon);
      near(feature.x, expected.x, .000051); near(feature.z, expected.z, .000051);
    }
  }
});
test('paving subtraction preserves the area around a neighbouring footprint in either winding', async () => {
  const { subtractConvex } = await import('../src/lmu_block_ludwigstrasse_plan.mjs');
  const area = ring => Math.abs(ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a.x * b.z - b.x * a.z; }, 0) / 2);
  const subject = rectangle(0, 0, 10, 10), cutter = rectangle(0, 0, 5, 5);
  for (const points of [cutter, [...cutter].reverse()]) {
    const pieces = subtractConvex(subject, points);
    near(pieces.reduce((sum, ring) => sum + area(ring), 0), 75);
    for (const ring of pieces) {
      const p = ring.reduce((v, p) => ({ x: v.x + p.x / ring.length, z: v.z + p.z / ring.length }), { x: 0, z: 0 });
      assert.equal(pointInPolygon(p.x, p.z, cutter), false);
    }
  }
});
