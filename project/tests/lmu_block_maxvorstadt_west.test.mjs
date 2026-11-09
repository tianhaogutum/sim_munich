import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { toWorld, fromWorld, ORIGIN, pointInPolygon } from '../src/date_geo.mjs';
import { CORE_BOUNDS } from '../src/date_route.mjs';
import { SOURCE_FEATURES, SECTOR, BUILDINGS, STREETS, TREES, LANDMARKS, insideSector, insideBuilding, clipRing, clipSegment, signedArea, nearestStreet } from '../src/lmu_block_maxvorstadt_west_data.mjs';

const approximately=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('WGS84 origin, axis directions and metre round trip',()=>{
  assert.deepEqual(toWorld(ORIGIN.lat,ORIGIN.lon),{x:0,z:0});
  assert.ok(toWorld(ORIGIN.lat+.001,ORIGIN.lon).x>110);
  assert.ok(toWorld(ORIGIN.lat,ORIGIN.lon+.001).z>70);
  const geo=fromWorld(-132,-271),p=toWorld(geo.lat,geo.lon);
  approximately(p.x,-132);approximately(p.z,-271);
});

test('all OSM building footprints stay strictly in the assigned west sector',()=>{
  assert.ok(BUILDINGS.length>100);
  assert.equal(new Set(BUILDINGS.map(b=>b.id)).size,BUILDINGS.length);
  for(const b of BUILDINGS){
    assert.ok(b.ring.length>=3);assert.ok(signedArea(b.ring)>0);
    assert.ok(b.height>0&&Number.isFinite(b.height));
    for(const p of b.ring){
      assert.ok(insideSector(p.x,p.z),`OSM ${b.id} vertex outside sector: ${JSON.stringify(p)}`);
      assert.ok(p.z<CORE_BOUNDS.minZ,'footprint enters core');
    }
    assert.ok(b.bounds.cz+b.bounds.hd<=SECTOR.maxZ+1e-9);
  }
});

test('footprints retain OSM geometry and dimensions after projection and clipping',()=>{
  const source=JSON.parse(readFileSync(new URL('../assets/osm/maxvorstadt_west.json',import.meta.url)));
  for(const b of BUILDINGS){
    const raw=source.elements.find(e=>e.id===b.id);assert.ok(raw,'OSM ID preserved');
    const clipped=clipRing(raw.geometry.map(p=>toWorld(p.lat,p.lon)));
    assert.deepEqual(b.ring,clipped);
    if(raw.tags['building:levels'])assert.equal(b.levels,Number(raw.tags['building:levels']));
  }
  assert.ok(statSync(new URL('../assets/osm/maxvorstadt_west.json',import.meta.url)).size<300000);
  assert.ok(SOURCE_FEATURES.some(f=>f.tags['roof:shape']==='gambrel'));
  assert.ok(SOURCE_FEATURES.some(f=>f.tags['roof:shape']==='flat'));
});

test('roads, paths and tree positions are clipped to ownership',()=>{
  for(const s of STREETS)for(const segment of s.segments)for(const p of segment)assert.ok(insideSector(p.x,p.z));
  assert.ok(STREETS.some(s=>s.name==='Amalienstraße'));
  assert.ok(STREETS.some(s=>s.name==='Schellingstraße'));
  assert.ok(STREETS.some(s=>s.name==='Türkenstraße'));
  assert.ok(STREETS.some(s=>s.name==='Adalbertstraße'));
  assert.ok(TREES.length>=40);
  for(const p of TREES){assert.ok(insideSector(p.x,p.z,3.8));assert.ok(!insideBuilding(p.x,p.z));}
});

test('landmarks and a standing radius around them are walkable mapped sidewalks',()=>{
  assert.equal(LANDMARKS.length,3);
  for(const p of LANDMARKS){
    assert.ok(insideSector(p.x,p.z,2));assert.ok(!insideBuilding(p.x,p.z));
    for(let i=0;i<16;i++){const a=i*Math.PI/8;assert.ok(!insideBuilding(p.x+Math.cos(a)*.7,p.z+Math.sin(a)*.7),p.id);}
    const street=nearestStreet(p.x,p.z);assert.ok(street.distance>street.street.width/2);assert.ok(street.distance<street.street.width/2+4);
    assert.match(p.text,/来源/);assert.ok(p.text.split('\n').length<=3);
  }
});

test('polygon collision leaves a concave courtyard open',()=>{
  const ring=clipRing([{x:-80,z:-80},{x:-40,z:-80},{x:-40,z:-40},{x:-50,z:-40},{x:-50,z:-70},{x:-70,z:-70},{x:-70,z:-40},{x:-80,z:-40}]);
  assert.ok(pointInPolygon(-75,-60,ring));assert.ok(!pointInPolygon(-60,-60,ring));
});

test('clipping handles crossing and entirely outside polygons and segments',()=>{
  const ring=clipRing([{x:-180,z:-330},{x:180,z:-330},{x:180,z:0},{x:-180,z:0}]);
  assert.equal(ring.length,4);approximately(Math.abs(signedArea(ring)),300*270);
  assert.deepEqual(clipRing([{x:160,z:-50},{x:180,z:-50},{x:180,z:-60}]),[]);
  assert.deepEqual(clipSegment({x:-200,z:-100},{x:200,z:-100}),[{x:-150,z:-100},{x:150,z:-100}]);
  assert.equal(clipSegment({x:180,z:-200},{x:180,z:-50}),null);
});
