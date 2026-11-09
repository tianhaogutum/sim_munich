import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { toWorld, fromWorld, pointInPolygon } from '../src/date_geo.mjs';
import { CORE_BOUNDS } from '../src/date_route.mjs';
import { BUILDINGS, GATE, GATE_PIERS, ACADEMY_PLINTHS, LANDMARKS, SECTOR, gateToWorld } from '../src/lmu_block_siegestor_data.mjs';
const raw=JSON.parse(readFileSync(new URL('../assets/osm/siegestor.json',import.meta.url)));
const allRings=[...BUILDINGS.map(b=>b.ring),...GATE_PIERS,...ACADEMY_PLINTHS];
const inRect=(p,r)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;

test('all 85 OSM building features fit the north sector, clear of the protected core',()=>{
 assert.equal(BUILDINGS.length,84);
 assert.equal(new Set(BUILDINGS.map(b=>b.id)).size,84);
 for(const ring of allRings){
  assert.ok(ring.length>=3);
  for(const p of ring){assert.ok(inRect(p,SECTOR),JSON.stringify(p));assert.ok(!inRect(p,CORE_BOUNDS));}
  const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a.x*b.z-b.x*a.z;},0)/2;
  assert.ok(Math.abs(area)>.3,'nondegenerate footprint');
 }
});

test('landmarks are walkable and outside every registered footprint',()=>{
 for(const p of LANDMARKS){
  assert.ok(inRect(p,SECTOR),p.id);assert.ok(p.text.includes('来源：'),p.id);
  for(const ring of allRings)assert.ok(!pointInPolygon(p.x,p.z,ring),p.id);
 }
});

test('three gate passages stay open through their full depth while all four piers collide',()=>{
 for(const u of [-7.3,0,7.3])for(let v=-7;v<=7;v+=.25){
  const p=gateToWorld(u,v);
  for(const ring of allRings)assert.ok(!pointInPolygon(p.x,p.z,ring),`passage ${u} / ${v}`);
 }
 for(const ring of GATE_PIERS){
  const p={x:ring.reduce((s,a)=>s+a.x,0)/4,z:ring.reduce((s,a)=>s+a.z,0)/4};
  assert.ok(pointInPolygon(p.x,p.z,ring));
 }
});

test('WGS84 conversion matches saved OSM geometry and known gate location',()=>{
 const o=toWorld(48.15075,11.58035);assert.deepEqual(o,{x:0,z:0});
 assert.ok(toWorld(48.15175,11.58035).x>110);
 assert.ok(toWorld(48.15075,11.58135).z>74);
 for(const p of [GATE,...LANDMARKS]){
  const ll=fromWorld(p.x,p.z),q=toWorld(ll.lat,ll.lon);
  assert.ok(Math.abs(q.x-p.x)<1e-6&&Math.abs(q.z-p.z)<1e-6);
 }
 for(const b of BUILDINGS.filter(b=>!b.clipped)){
  const osm=raw.elements.find(e=>e.id===b.id);assert.ok(osm);
  assert.equal(b.ring.length,osm.geometry.length-1);
  b.ring.forEach((p,i)=>{
   const q=toWorld(osm.geometry[i].lat,osm.geometry[i].lon);
   assert.ok(Math.abs(p.x-q.x)<.001&&Math.abs(p.z-q.z)<.001);
  });
 }
 const gate=raw.elements.find(e=>e.id===22727580);assert.equal(gate.tags.height,'21');
 assert.ok(GATE.x>168&&GATE.x<186&&GATE.z>120&&GATE.z<146);
});

test('raw OSM is within budget, credited and retains architecture tags',()=>{
 assert.ok(statSync(new URL('../assets/osm/siegestor.json',import.meta.url)).size<300_000);
 const src=JSON.parse(readFileSync(new URL('../assets/osm/siegestor.sources.json',import.meta.url)));
 assert.equal(src.attribution,'© OpenStreetMap contributors, ODbL');assert.ok(src.query.includes('out geom'));
 assert.ok(BUILDINGS.some(b=>b.id===173135247));
 assert.ok(BUILDINGS.some(b=>b.tags['roof:shape']==='hipped'));
});
