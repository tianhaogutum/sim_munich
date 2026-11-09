import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_CITY_PLACES, ALL_CITY_TRAILS } from '../src/city_research_data.mjs';
import { initialCityProgress, discoverCityPlaces, missionProgress, loadCityProgress, saveCityProgress } from '../src/city_rules.mjs';

const pack=JSON.parse(readFileSync(new URL('../assets/city_research/session02.json',import.meta.url),'utf8'));

test('session02 destinations retain research coordinates, sources and outdoor navigation metadata',()=>{
 for(const reference of pack.places){
  const place=ALL_CITY_PLACES.find(p=>p.id===reference.id);
  assert.ok(place,reference.id);
  for(const key of ['name','lon','lat','description','source'])assert.equal(place[key],reference[key]);
  assert.equal(place.district,pack.district);
  assert.equal(place.coordinateStatus,reference.accuracy);
  const map=new URL(place.mapSource);
  assert.equal(Number(map.searchParams.get('mlon')),place.lon);
  assert.equal(Number(map.searchParams.get('mlat')),place.lat);
  assert.equal(discoverCityPlaces(initialCityProgress(),place,{now:42}).found[place.id],42);
 }
});

test('session02 walking route keeps its stop order and survives saving midway',()=>{
 const reference=pack.routes[0],trail=ALL_CITY_TRAILS.find(t=>t.id===reference.id);
 assert.deepEqual(trail.places,reference.stops);
 let state={...initialCityProgress(),activeTrail:trail.id};
 let saved;
 const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 for(const id of trail.places){
  state=discoverCityPlaces(state,ALL_CITY_PLACES.find(p=>p.id===id),{now:42});
  assert.ok(saveCityProgress(state,storage));
  state=loadCityProgress(storage);
  assert.equal(state.activeTrail,trail.id);
  assert.equal(state.found[id],42);
 }
 assert.equal(missionProgress(state).done,true);
 assert.equal(missionProgress(state).next,null);
});
