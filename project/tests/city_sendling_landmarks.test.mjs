import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SENDLING_LANDMARKS,planSendlingLandmark,isSendlingLandmarkSolid,replacedSendlingBuildingIds} from '../src/city_sendling_landmarks.mjs';
const pack=JSON.parse(readFileSync(new URL('../assets/city_research/session06.json',import.meta.url),'utf8'));

test('Sendling models use researched building anchors, distinct from outdoor arrival points',()=>{
 assert.equal(SENDLING_LANDMARKS.length,4);
 for(const s of SENDLING_LANDMARKS){
  assert.ok(pack.places.some(p=>p.id===s.id));
  if(s.photoPage){const b=pack.buildings.find(b=>b.photoPage===s.photoPage);assert.ok(b);assert.equal(s.lon,b.lon);assert.equal(s.lat,b.lat);}
 }
});

test('all modeled parts have finite positive geometry inside bounded local footprints',()=>{
 for(const s of SENDLING_LANDMARKS){
  const parts=planSendlingLandmark(s.kind);assert.ok(parts.length>10&&parts.length<180);
  for(const p of parts){
   assert.ok(p.position.every(Number.isFinite));assert.ok(p.size.every(n=>Number.isFinite(n)&&n>0));
   assert.ok(Math.abs(p.position[0])+p.size[0]/2<=s.halfWidth,s.id);
   assert.ok(Math.abs(p.position[2])+p.size[2]/2<=s.halfDepth,s.id);
   assert.ok(p.position[1]-p.size[1]/2>=-.001);
  }
 }
 assert.throws(()=>planSendlingLandmark('unknown'),TypeError);
});

test('new church retains a single north-offset tower; post office has no onion dome',()=>{
 const newDomes=planSendlingLandmark('new-church').filter(p=>p.shape==='onion');
 assert.equal(newDomes.length,1);assert.ok(newDomes[0].position[0]<0&&newDomes[0].position[2]<0);
 const oldDome=planSendlingLandmark('old-church').find(p=>p.shape==='onion');
 assert.ok(newDomes[0].position[1]>oldDome.position[1]*2);
 assert.ok(!planSendlingLandmark('post-office').some(p=>p.shape==='onion'));
});

test('landmark solids block walls while researched arrival points remain outside the models',()=>{
 for(const s of SENDLING_LANDMARKS)assert.ok(isSendlingLandmarkSolid(s.lon,s.lat),s.id);
 for(const p of pack.places.filter(p=>p.id!=='session06-schmied-von-kochel'))assert.equal(isSendlingLandmarkSolid(p.lon,p.lat),false,p.id);
 assert.equal(isSendlingLandmarkSolid(NaN,48.12),false);
});

test('tile replacement only selects identified polygons containing a building anchor, respecting holes',()=>{
 const s=SENDLING_LANDMARKS[0],ring=[[s.lon-.0001,s.lat-.0001],[s.lon+.0001,s.lat-.0001],[s.lon+.0001,s.lat+.0001],[s.lon-.0001,s.lat+.0001],[s.lon-.0001,s.lat-.0001]];
 const feature=(id,coordinates,type='Polygon')=>({id,geometry:{type,coordinates}});
 assert.deepEqual(replacedSendlingBuildingIds([feature(12,[ring]),feature(12,[ring]),feature(undefined,[ring]),feature(13,[ring,ring]),feature(14,[[ring]],'MultiPolygon'),feature(15,[[[11,48],[11.1,48],[11,48.1],[11,48]]])]),[12,14]);
});
