import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGIN, toWorld, fromWorld, pointInPolygon, polygonBounds } from '../src/date_geo.mjs';
import { CORE_BOUNDS } from '../src/date_route.mjs';
import {
  BUILDINGS, FOOTPRINTS, LANDMARKS, SECTOR, STREET_OVERLAPS,
  containsBuilding, isSolidPoint, localPoint, CHURCH_FRAME, LIBRARY_FRAME,
} from '../src/lmu_block_ludwigskirche_data.mjs';
const eps=1e-7;

test('shared WGS84 origin, directions and metre round-trip',()=>{
  assert.deepEqual(toWorld(ORIGIN.lat,ORIGIN.lon),{x:0,z:0});
  for(const [x,z] of [[-480,-40],[-205,31],[-330,70]]) {
    const ll=fromWorld(x,z),p=toWorld(ll.lat,ll.lon);
    assert.ok(Math.abs(x-p.x)<eps && Math.abs(z-p.z)<eps);
  }
});
test('every footprint stays in the geographic block extent and outside the core',()=>{
  for(const f of FOOTPRINTS) {
    const b=polygonBounds(f.outer);
    assert.ok(b.cx-b.hw>=SECTOR.minX-eps && b.cx+b.hw<=SECTOR.maxX+eps,f.id+' x');
    assert.ok(b.cz-b.hd>=SECTOR.minZ-eps && b.cz+b.hd<=SECTOR.maxZ+eps,f.id+' z');
    assert.equal(b.cx+b.hw>CORE_BOUNDS.minX && b.cx-b.hw<CORE_BOUNDS.maxX &&
      b.cz+b.hd>CORE_BOUNDS.minZ && b.cz-b.hd<CORE_BOUNDS.maxZ,false,f.id+' core');
  }
});
test('both building rings are exact toWorld projections with no local offset',()=>{
  const raw=JSON.parse(readFileSync(new URL('../assets/osm/ludwigskirche.json',import.meta.url)));
  for(const b of BUILDINGS) {
    const e=raw.elements.find(e=>e.id===b.osmId);
    const g=e.type==='way'?e.geometry:e.members.find(m=>m.role==='outer').geometry;
    assert.equal(b.outer.length,g.length);
    g.forEach((p,i)=>assert.deepEqual(b.outer[i],toWorld(p.lat,p.lon)));
  }
  assert.equal(BUILDINGS[1].inner.length,2);
  for(const h of BUILDINGS[1].inner) {
    const b=polygonBounds(h);
    assert.ok(pointInPolygon(b.cx,b.cz,BUILDINGS[1].outer));
    assert.equal(containsBuilding(BUILDINGS[1],b.cx,b.cz),false);
  }
});
test('landmarks remain walkable, including the stair collision',()=>{
  for(const p of LANDMARKS) {
    assert.ok(p.x>=SECTOR.minX && p.x<=SECTOR.maxX && p.z>=SECTOR.minZ && p.z<=SECTOR.maxZ,p.id);
    assert.equal(isSolidPoint(p.x,p.z),false,p.id);
  }
  const p=localPoint(LIBRARY_FRAME,0,-5);
  assert.equal(isSolidPoint(p.x,p.z),true);
  const q=localPoint(CHURCH_FRAME,0,14);
  assert.equal(containsBuilding(BUILDINGS[0],q.x,q.z),true);
});
test('street overlap polygons are actual intersections of the surveyed rings',()=>{
  assert.deepEqual(STREET_OVERLAPS.map(b=>b.id),['st-ludwig','staatsbibliothek']);
  for(const b of STREET_OVERLAPS) for(const p of b.outer) {
    assert.ok(p.x<=-150+eps && p.z>=55-eps && p.z<=105+eps);
  }
});
test('all geographic anchors follow a recalibrated shared conversion automatically',async()=>{
  const geo=new URL('../src/date_geo.mjs',import.meta.url).href;
  const route=new URL('../src/date_route.mjs',import.meta.url).href;
  const mock=`import * as base from ${JSON.stringify(geo)};
    export const toWorld=(lat,lon)=>{const p=base.toWorld(lat,lon);return {x:p.x-5,z:p.z+180}};
    export const ringToWorld=ring=>ring.map(([lon,lat])=>toWorld(lat,lon));
    export const pointInPolygon=base.pointInPolygon,polygonBounds=base.polygonBounds;`;
  const mockURL='data:text/javascript;base64,'+Buffer.from(mock).toString('base64');
  let source=readFileSync(new URL('../src/lmu_block_ludwigskirche_data.mjs',import.meta.url),'utf8');
  source=source.replace("'./date_geo.mjs'",JSON.stringify(mockURL)).replace("'./date_route.mjs'",JSON.stringify(route));
  const moved=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  for(let i=0;i<BUILDINGS.length;i++) BUILDINGS[i].outer.forEach((p,j)=>{
    assert.ok(Math.abs(moved.BUILDINGS[i].outer[j].x-p.x+5)<eps);
    assert.ok(Math.abs(moved.BUILDINGS[i].outer[j].z-p.z-180)<eps);
  });
  for(let i=0;i<LANDMARKS.length;i++) {
    assert.ok(Math.abs(moved.LANDMARKS[i].x-LANDMARKS[i].x+5)<eps);
    assert.ok(Math.abs(moved.LANDMARKS[i].z-LANDMARKS[i].z-180)<eps);
  }
});
test('raw data has bounded size, attribution and no copied photo assets',()=>{
  const source=JSON.parse(readFileSync(new URL('../assets/osm/ludwigskirche.sources.json',import.meta.url)));
  for(const file of ['ludwigskirche.json','ludwigskirche_alignment.json'])
    assert.ok(readFileSync(new URL('../assets/osm/'+file,import.meta.url)).length<=300*1024);
  assert.match(source.attribution,/OpenStreetMap contributors, ODbL/);
  assert.match(source.placement.method,/Unshifted/);
  assert.equal(source.downloadedImageAssets.length,0);
});
