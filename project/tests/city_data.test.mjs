import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_BOUNDS,CITY_ORIGIN,CITY_DISTRICTS,CITY_PLACES,CITY_SECTORS,CITY_TRAILS,cityToLocal,localToCity } from '../src/city_data.mjs';
import { insideCity,clampCityPosition,cityDistance,initialCityProgress,normalizeCityProgress,discoverCityPlaces,recordCityMovement,missionProgress,sectorForPosition,loadCityProgress,saveCityProgress } from '../src/city_rules.mjs';
const lmu=CITY_PLACES.find(p=>p.id==='lmu');
test('25 official district names, unique destinations and trails use consistent geographic data',()=>{
 assert.equal(CITY_DISTRICTS.length,25);assert.deepEqual(CITY_DISTRICTS.map(d=>d.id),Array.from({length:25},(_,i)=>i+1));
 assert.equal(new Set(CITY_PLACES.map(p=>p.id)).size,CITY_PLACES.length);assert.ok(CITY_PLACES.length>=30);
 for(const p of [...CITY_PLACES,...CITY_DISTRICTS]){assert.ok(insideCity(p.lon,p.lat),p.name);assert.match(p.source,/^https:\/\//);}
 const ids=new Set(CITY_PLACES.map(p=>p.id));for(const t of CITY_TRAILS){assert.ok(t.places.length>=3);for(const id of t.places)assert.ok(ids.has(id));}
});
test('local frame has east +X, south +Z and geographic round trips',()=>{
 assert.deepEqual(cityToLocal(CITY_ORIGIN.lon,CITY_ORIGIN.lat),{x:0,z:0});
 assert.ok(cityToLocal(CITY_ORIGIN.lon+.01,CITY_ORIGIN.lat).x>0);assert.ok(cityToLocal(CITY_ORIGIN.lon,CITY_ORIGIN.lat-.01).z>0);
 for(const p of CITY_PLACES){const local=cityToLocal(p.lon,p.lat),round=localToCity(local.x,local.z);assert.ok(Math.abs(round.lon-p.lon)<1e-10);assert.ok(Math.abs(round.lat-p.lat)<1e-10);}
});
test('100 sector manifest covers rectangular game extent without pretending to be boundaries',()=>{
 assert.equal(CITY_SECTORS.length,100);assert.equal(new Set(CITY_SECTORS.map(s=>s.id)).size,100);
 for(const s of CITY_SECTORS){assert.ok(s.minLon<s.maxLon&&s.minLat<s.maxLat);assert.equal(sectorForPosition((s.minLon+s.maxLon)/2,(s.minLat+s.maxLat)/2).id,s.id);assert.match(s.status,/pending/);}
 assert.equal(sectorForPosition(CITY_BOUNDS.minLon,CITY_BOUNDS.minLat).id,'munich-001');assert.equal(sectorForPosition(CITY_BOUNDS.maxLon,CITY_BOUNDS.maxLat).id,'munich-100');assert.equal(sectorForPosition(0,0),null);
});
test('discovery uses real geographic proximity and preserves existing timestamps without mutating input',()=>{
 const state=initialCityProgress(),next=discoverCityPlaces(state,lmu,{now:1000});assert.equal(next.found.lmu,1000);assert.equal(Object.keys(state.found).length,0);
 assert.equal(discoverCityPlaces(next,lmu,{now:2000}).found.lmu,1000);assert.equal(discoverCityPlaces(state,{lon:0,lat:0}).found.lmu,undefined);
 assert.equal(discoverCityPlaces(state,{lon:lmu.lon+.01,lat:lmu.lat},{now:1000}).found.lmu,undefined);
});
test('progress sanitizer rejects malformed or future data and excludes forged place ids',()=>{
 assert.deepEqual(normalizeCityProgress({version:99,found:{lmu:10}}),initialCityProgress());
 const s=normalizeCityProgress({version:1,found:{lmu:0,unknown:10,marienplatz:'x'},walkedMeters:-10,activeTrail:'fake'});
 assert.deepEqual(s.found,{lmu:0});assert.equal(s.walkedMeters,0);assert.equal(s.activeTrail,'university-old-town');
});
test('walk tracking counts actual short steps and excludes fast travel',()=>{
 const near={lon:lmu.lon+.0001,lat:lmu.lat};const s=recordCityMovement(initialCityProgress(),lmu,near);assert.ok(s.walkedMeters>5&&s.walkedMeters<10);
 assert.equal(recordCityMovement(s,lmu,CITY_PLACES.find(p=>p.id==='nymphenburg')).walkedMeters,s.walkedMeters);assert.equal(cityDistance(lmu,lmu),0);assert.equal(cityDistance({},{}),Infinity);
});
test('trail progress exposes next destination and reaches completion',()=>{
 let s=initialCityProgress();assert.equal(missionProgress(s).nextId,'lmu');for(const id of CITY_TRAILS[0].places)s=discoverCityPlaces(s,CITY_PLACES.find(p=>p.id===id),{now:1});
 const m=missionProgress(s);assert.equal(m.done,true);assert.equal(m.completed,m.total);assert.equal(m.next,null);
});
test('private/corrupt storage cannot block city exploration',()=>{
 const storage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.deepEqual(loadCityProgress(storage),initialCityProgress());assert.equal(saveCityProgress(initialCityProgress(),storage),false);
 let value;const memory={getItem(){return value},setItem(k,v){value=v}};const s=discoverCityPlaces(initialCityProgress(),lmu,{now:5});assert.ok(saveCityProgress(s,memory));assert.deepEqual(loadCityProgress(memory),s);
 assert.ok(insideCity(...Object.values(clampCityPosition({lon:99,lat:-99}))));
});
