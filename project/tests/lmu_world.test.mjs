import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, LANDMARKS, BUILDING_RINGS, ROAD_LINES, normalizeDiscoveries, findSafeArrival } from '../src/lmu_world_data.mjs';

test('atlas has six districts and eighteen unique finite standing viewpoints',()=>{
  assert.equal(DISTRICTS.length,6);assert.equal(LANDMARKS.length,18);
  assert.equal(new Set(LANDMARKS.map(p=>p.id)).size,18);
  for(const p of LANDMARKS){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.ok(p.name&&p.text&&p.district&&p.source.startsWith('https://'));}
});
test('atlas renders the retained mapped geometry, not a synthetic grid of buildings',()=>{
  assert.ok(BUILDING_RINGS.length>200);
  for(const ring of BUILDING_RINGS)for(const p of ring)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));
  assert.ok(ROAD_LINES.length>10);
});
test('saved discoveries discard foreign, malformed and duplicate ids',()=>{
  const id=LANDMARKS[0].id;
  assert.deepEqual(normalizeDiscoveries([id,id,'missing',null,{},4]),[id]);
  assert.deepEqual(normalizeDiscoveries({found:[id]}),[]);
});
test('fast travel checks shoulders and finds a free alternative near an occupied viewpoint',()=>{
  const bounds={minX:-10,maxX:10,minZ:-10,maxZ:10};
  const blocked=(x,z)=>x*x+z*z<4;
  const result=findSafeArrival({x:0,z:0},blocked,bounds);
  assert.ok(result);assert.ok(Math.hypot(result.x,result.z)>=2.6);
  assert.equal(blocked(result.x+.6,result.z),false);
  assert.equal(findSafeArrival({x:0,z:0},()=>true,bounds),null);
});
test('fast travel never exits bounds or accepts non-finite destinations',()=>{
  const bounds={minX:-2,maxX:2,minZ:-2,maxZ:2};
  const p=findSafeArrival({x:3,z:0},()=>false,bounds);
  assert.ok(p&&Math.abs(p.x)<=1&&Math.abs(p.z)<=1);
  assert.equal(findSafeArrival({x:NaN,z:0},()=>false,bounds),null);
});
