import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECTOR, BUILDINGS, HIGHWAYS, GRASS_PATCHES, TREES, BIKE_PARKING, DEFERRED_FEATURES, LANDMARKS } from '../src/lmu_block_huberplatz_data.mjs';
import { ORIGIN, toWorld, fromWorld, pointInPolygon } from '../src/date_geo.mjs';
import { CORE_BOUNDS } from '../src/date_route.mjs';
const raw = JSON.parse(readFileSync(new URL('../assets/osm/huberplatz.json', import.meta.url)));
const byId = new Map(raw.elements.map(e => [e.id, e]));
const signedArea = ring => ring.reduce((a,p,i) => { const q=ring[(i+1)%ring.length];return a+p.x*q.z-q.x*p.z; },0)/2;
const inside = (p,b) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;

test('north/east mapping and source portal are not transposed', () => {
  assert.deepEqual(toWorld(ORIGIN.lat, ORIGIN.lon), {x:0,z:0});
  assert.ok(Math.abs(toWorld(ORIGIN.lat+.001, ORIGIN.lon).x-110.574)<1e-7);
  assert.ok(toWorld(ORIGIN.lat, ORIGIN.lon+.001).z>74);
  for(const p of [{x:-60,z:118},{x:150,z:300},...LANDMARKS]) {
    const geo=fromWorld(p.x,p.z), q=toWorld(geo.lat,geo.lon);
    assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<1e-7);
  }
});

test('every retained building has an OSM source, positive footprint, and bounded height', () => {
  assert.equal(BUILDINGS.length,36);
  assert.equal(new Set(BUILDINGS.map(b=>b.id)).size,36);
  for(const b of BUILDINGS) {
    const source=byId.get(b.id);
    assert.ok(source?.tags?.building, `${b.id} must have an OSM building way`);
    assert.ok(b.ring.length>=3 && Math.abs(signedArea(b.ring))>.8,b.name);
    assert.ok(b.height>3 && b.height<=30,b.name);
    if(source.tags.height) assert.equal(b.totalHeight,Number(source.tags.height), 'OSM height includes roof');
    const world=source.geometry.map(p=>toWorld(p.lat,p.lon));
    for(const p of b.originalRing) assert.ok(world.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<.0001),`original coordinate drift: ${b.id}`);
  }
});

test('all building and lawn footprints remain strictly east of CORE_BOUNDS and inside the sector', () => {
  for(const feature of [...BUILDINGS,...GRASS_PATCHES]) for(const p of feature.ring) {
    assert.ok(inside(p,SECTOR),`${feature.id}: ${JSON.stringify(p)}`);
    assert.ok(p.z > CORE_BOUNDS.maxZ,`${feature.id} enters protected core`);
    assert.ok(!inside(p,CORE_BOUNDS));
  }
  // Since every vertex has z > maxZ, no polygon edge or interior can cross the core either.
});

test('Chinese landmarks are walkable, inside the sector, and sourced', () => {
  for(const p of LANDMARKS) {
    assert.ok(inside(p,SECTOR),p.id);
    assert.ok(!BUILDINGS.some(b=>pointInPolygon(p.x,p.z,b.ring)),p.id);
    assert.ok(Math.hypot(p.x+8.6138,p.z-191.2441)>1.65,p.id);
    assert.ok(p.text.includes('来源：') && p.text.split('\n').length<=3,p.id);
  }
});

test('real fountain and east U-Bahn entrance are explicitly deferred, never silently relocated', () => {
  const f=DEFERRED_FEATURES.find(p=>p.id===201979156);
  const u=DEFERRED_FEATURES.find(p=>p.id===288676926);
  assert.ok(Math.abs(f.x+24.1936)<.001 && Math.abs(f.z-97.8875)<.001);
  assert.ok(Math.abs(u.x-43.0133)<.001 && Math.abs(u.z-115.3706)<.001);
  assert.ok(inside(f,CORE_BOUNDS) && inside(u,CORE_BOUNDS));
  assert.ok(DEFERRED_FEATURES.every(p=>!LANDMARKS.some(q=>q.id===p.id)));
});

test('roads, trees, lawns and parking retain source provenance and do not invent an English Garden', () => {
  assert.equal(TREES.length,19);assert.equal(GRASS_PATCHES.length,7);assert.equal(BIKE_PARKING.length,9);
  assert.ok(HIGHWAYS.some(r=>r.name==='Veterinärstraße'));
  for(const feature of [...HIGHWAYS,...TREES,...GRASS_PATCHES,...BIKE_PARKING]) assert.ok(byId.has(feature.id),feature.id);
  assert.ok(raw.elements.every(e=>e.tags?.leisure!=='park'));
  assert.ok(readFileSync(new URL('../assets/osm/huberplatz.json',import.meta.url)).byteLength<300_000);
});
