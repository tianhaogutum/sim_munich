import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toWorld, fromWorld, pointInPolygon, polygonBounds } from '../src/date_geo.mjs';
import { CORE_BOUNDS } from '../src/date_route.mjs';
import {
  BUILDINGS, FOOTPRINTS, LANDMARKS, SECTOR, PLACEMENT_OFFSET,
  containsBuilding, isSolidPoint, localPoint, CHURCH_FRAME, LIBRARY_FRAME, ARCHIVE_FRAGMENT,
} from '../src/lmu_block_ludwigskirche_data.mjs';

const eps=1e-7;
test('WGS84 origin, directions and metre round-trip match date_geo',()=>{
  assert.deepEqual(toWorld(48.15075,11.58035),{x:0,z:0});
  for(const [x,z] of [[-480,100],[-205,176],[-330,250]]) {
    const ll=fromWorld(x,z),p=toWorld(ll.lat,ll.lon);
    assert.ok(Math.abs(x-p.x)<eps && Math.abs(z-p.z)<eps);
  }
  assert.ok(toWorld(48.151,11.581).x>0 && toWorld(48.151,11.581).z>0);
});
test('every building and arcade pier stays inside the owned sector and outside the core',()=>{
  for(const footprint of FOOTPRINTS) {
    const b=polygonBounds(footprint.outer);
    assert.ok(b.cx-b.hw>=SECTOR.minX-eps && b.cx+b.hw<=SECTOR.maxX+eps,footprint.id+' x');
    assert.ok(b.cz-b.hd>=SECTOR.minZ-eps && b.cz+b.hd<=SECTOR.maxZ+eps,footprint.id+' z');
    const overlap=b.cx+b.hw>CORE_BOUNDS.minX && b.cx-b.hw<CORE_BOUNDS.maxX && b.cz+b.hd>CORE_BOUNDS.minZ && b.cz-b.hd<CORE_BOUNDS.maxZ;
    assert.equal(overlap,false,footprint.id+' overlaps the protected plaza');
  }
});
test('surveyed footprints keep all OSM vertices and both library courtyards',()=>{
  const raw=JSON.parse(readFileSync(new URL('../assets/osm/ludwigskirche.json',import.meta.url)));
  const c=raw.elements.find(e=>e.id===25440202);
  assert.equal(BUILDINGS[0].outer.length,c.geometry.length);
  for(let i=0;i<c.geometry.length;i++) {
    const expected=toWorld(c.geometry[i].lat,c.geometry[i].lon),actual=BUILDINGS[0].outer[i];
    assert.ok(Math.abs(actual.x-expected.x)<eps);
    assert.ok(Math.abs(actual.z-expected.z-PLACEMENT_OFFSET.z)<eps);
  }
  assert.equal(BUILDINGS[1].inner.length,2);
  for(const ring of BUILDINGS[1].inner) {
    const b=polygonBounds(ring);
    assert.ok(pointInPolygon(b.cx,b.cz,BUILDINGS[1].outer));
    assert.equal(containsBuilding(BUILDINGS[1],b.cx,b.cz),false);
  }
});
test('all three landmark approach points are walkable, including the stair collision',()=>{
  assert.equal(LANDMARKS.length,3);
  for(const p of LANDMARKS) {
    assert.ok(p.x>=SECTOR.minX && p.x<=SECTOR.maxX && p.z>=SECTOR.minZ && p.z<=SECTOR.maxZ,p.id);
    assert.equal(isSolidPoint(p.x,p.z),false,p.id+' inside a building or stair');
    assert.equal(p.z>100 && p.z<300,true);
  }
  const stair=localPoint(LIBRARY_FRAME,0,-5);
  assert.equal(isSolidPoint(stair.x,stair.z),true);
  const entrance=localPoint(CHURCH_FRAME,0,14);
  assert.equal(containsBuilding(BUILDINGS[0],entrance.x,entrance.z),true);
});
test('raw OSM asset is bounded and has provenance without copied photo assets',()=>{
  const raw=readFileSync(new URL('../assets/osm/ludwigskirche.json',import.meta.url));
  const source=JSON.parse(readFileSync(new URL('../assets/osm/ludwigskirche.sources.json',import.meta.url)));
  assert.ok(raw.length<=300*1024);
  assert.match(source.attribution,/OpenStreetMap contributors, ODbL/);
  assert.ok(source.query.includes('out body geom'));
  assert.equal(source.downloadedImageAssets.length,0);
  assert.ok(source.retrievedAt && source.placement.offsetMetres.z===145);
});

test('archive estimate is explicitly labeled and clipped, without being passed off as OSM',()=>{
  assert.match(ARCHIVE_FRAGMENT.source,/estimate/);
  assert.ok(ARCHIVE_FRAGMENT.outer.length>=4);
  assert.ok(ARCHIVE_FRAGMENT.outer.every(p=>p.x>=-479.8-eps && p.z>=100.2-eps));
});
