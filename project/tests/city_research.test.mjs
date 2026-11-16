import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CITY_PLACES,CITY_TRAILS,CITY_RESEARCH,registerCityResearch } from '../src/city_data.mjs';
import { initialCityProgress,discoverCityPlaces,missionProgress,normalizeCityProgress } from '../src/city_rules.mjs';
const pack=JSON.parse(fs.readFileSync(new URL('../assets/city_research/session01.json',import.meta.url)));
test('invalid research is rejected atomically, including broken route references',()=>{
 const before=CITY_PLACES;
 const broken=structuredClone(pack);broken.routes[0].stops.push('missing');
 assert.throws(()=>registerCityResearch(broken),TypeError);assert.equal(CITY_PLACES,before);assert.equal(CITY_RESEARCH.length,0);
 const badPoint=structuredClone(pack);badPoint.places[0].lon=0;assert.throws(()=>registerCityResearch(badPoint),TypeError);
});
test('session01 becomes playable and discoveries and active walk survive normalization',()=>{
 const count=CITY_PLACES.length;assert.equal(registerCityResearch(pack),true);assert.equal(CITY_PLACES.length,count+8);
 assert.equal(registerCityResearch(pack),false);assert.equal(CITY_PLACES.length,count+8);
 const route=CITY_TRAILS.find(t=>t.id===pack.routes[0].id);assert.deepEqual(route.places,pack.routes[0].stops);
 let progress={...initialCityProgress(),activeTrail:route.id};
 for(const id of route.places)progress=discoverCityPlaces(progress,CITY_PLACES.find(p=>p.id===id),{now:42});
 assert.equal(missionProgress(normalizeCityProgress(progress)).done,true);
 assert.equal(normalizeCityProgress(progress).activeTrail,route.id);
 assert.equal(CITY_RESEARCH[0].buildings.length,3);assert.ok(Object.isFrozen(CITY_RESEARCH[0].buildings[0].features));
 pack.buildings[0].name='changed';assert.notEqual(CITY_RESEARCH[0].buildings[0].name,'changed');
});
