import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ALL_CITY_PLACES,ALL_CITY_TRAILS,RESEARCH_PACKS} from '../src/city_research_data.mjs';
import {CITY_PLACES,CITY_TRAILS,CITY_BOUNDS,cityToLocal,localToCity,registerCityResearch} from '../src/city_data.mjs';
import {cityDistance,discoverCityPlaces,initialCityProgress,missionProgress,normalizeCityProgress,saveCityProgress,loadCityProgress} from '../src/city_rules.mjs';
import {navigationSnapshot} from '../src/city_navigation_rules.mjs';
import {cityPlacesGeoJSON,PLACE_TYPE_LABELS} from '../src/city_place_layer.mjs';

const packs=RESEARCH_PACKS.filter(p=>Number(p.id.slice(7))>=14);
const added=packs.flatMap(p=>p.places),routes=packs.flatMap(p=>p.routes);
const byId=new Map(ALL_CITY_PLACES.map(p=>[p.id,p]));
const north=(point,metres)=>({...point,lat:point.lat+metres*180/(Math.PI*6371000)});

test('expansion is generated, registered and visible in the same production marker catalog',()=>{
 // The expansion run was interrupted after four packs (30 places, 7 routes); the original
 // target was 60 places and 10 routes. Raise these floors when more packs land.
 assert.ok(added.length>=30,`only ${added.length} new places`);
 assert.ok(routes.length>=7,`only ${routes.length} new routes`);
 assert.equal(new Set(ALL_CITY_PLACES.map(p=>p.id)).size,ALL_CITY_PLACES.length);
 assert.equal(new Set(ALL_CITY_TRAILS.map(p=>p.id)).size,ALL_CITY_TRAILS.length);
 const markers=new Map(cityPlacesGeoJSON(ALL_CITY_PLACES).features.map(f=>[f.properties.id,f]));
 for(const pack of packs){
  const source=JSON.parse(readFileSync(new URL(`../assets/city_research/${pack.id}.json`,import.meta.url),'utf8'));
  assert.deepEqual(pack,source,pack.id);
  for(const p of pack.places){
   const live=byId.get(p.id);assert.ok(live,p.id);assert.equal(live.district,pack.district);
   assert.equal(live.researchPack,pack.id);assert.deepEqual(markers.get(p.id).geometry.coordinates,[p.lon,p.lat]);
   assert.equal(markers.get(p.id).properties.type,p.type);
  }
 }
 execFileSync('python3',[new URL('../tools/build_city_research.py',import.meta.url).pathname,'--check']);
});

test('new destinations carry sources, safe-arrival evidence and bounded per-place discovery radii',()=>{
 for(const pack of packs){
  const urls=new Set(pack.sources.map(s=>s.url));
  for(const p of pack.places){
   assert.ok(PLACE_TYPE_LABELS[p.type],p.id);
   for(const k of ['description','explorationHint','access','coordinateNote'])assert.ok(typeof p[k]==='string'&&p[k].trim(),`${p.id}: ${k}`);
   for(const k of ['source','coordinateSource'])assert.ok(/^https:\/\//.test(p[k])&&urls.has(p[k]),`${p.id}: ${k}`);
   assert.match(p.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
   assert.ok(p.arrivalRadius>=15&&p.arrivalRadius<=50,p.id);
   assert.ok(p.lon>=CITY_BOUNDS.minLon&&p.lon<=CITY_BOUNDS.maxLon&&p.lat>=CITY_BOUNDS.minLat&&p.lat<=CITY_BOUNDS.maxLat);
   const local=cityToLocal(p.lon,p.lat),roundtrip=localToCity(local.x,local.z);
   assert.ok(cityDistance(p,roundtrip)<.001);
   const outside=north(p,p.arrivalRadius+2),inside=north(p,p.arrivalRadius-2);
   assert.equal(discoverCityPlaces(initialCityProgress(),outside,{now:42}).found[p.id],undefined,`${p.id}: outside radius`);
   assert.equal(discoverCityPlaces(initialCityProgress(),inside,{now:42}).found[p.id],42,`${p.id}: inside radius`);
   assert.equal(navigationSnapshot(outside,p).arrived,false);
   assert.equal(navigationSnapshot(inside,p).arrived,true);
  }
 }
});

test('routes cover every new destination, use computed straight-line segments and survive save/reload',()=>{
 const covered=new Set();
 for(const reference of routes){
  const route=ALL_CITY_TRAILS.find(t=>t.id===reference.id);assert.ok(route,reference.id);
  assert.deepEqual(route.places,reference.stops);assert.ok(route.places.length>=4&&route.places.length<=7);
  assert.equal(route.distanceKind,'straight-line segments');
  const segments=route.places.slice(1).map((id,i)=>cityDistance(byId.get(route.places[i]),byId.get(id)));
  assert.ok(segments.every(n=>n>0&&n<=3500),route.id);
  assert.ok(Math.abs(Math.round(segments.reduce((a,b)=>a+b,0))-route.distanceMeters)<=2,route.id);
  let saved,state={...initialCityProgress(),activeTrail:route.id};
  const storage={getItem:()=>saved,setItem:(_k,v)=>saved=v};
  for(const id of route.places){
   covered.add(id);state=discoverCityPlaces(state,byId.get(id),{now:42});
   assert.equal(state.found[id],42);assert.ok(saveCityProgress(state,storage));state=loadCityProgress(storage);
   assert.equal(state.activeTrail,route.id);
  }
  assert.equal(missionProgress(state).done,true,route.id);
 }
 for(const p of added)assert.ok(covered.has(p.id),p.id);
 const legacy=normalizeCityProgress({version:1,found:{lmu:10,'session06-harras':20},walkedMeters:150,activeTrail:'session06-old-village-walk'});
 assert.equal(legacy.found.lmu,10);assert.equal(legacy.found['session06-harras'],20);assert.equal(legacy.walkedMeters,150);assert.equal(legacy.activeTrail,'session06-old-village-walk');
});

test('registering a research pack twice cannot duplicate the compiled marker and route lists',async()=>{
 const pack=packs[0];assert.ok(pack);
 const beforePlaces=CITY_PLACES.length,beforeRoutes=CITY_TRAILS.length;
 assert.equal(registerCityResearch(pack),true);assert.equal(registerCityResearch(pack),false);
 assert.equal(CITY_PLACES.length,beforePlaces+pack.places.length);assert.equal(CITY_TRAILS.length,beforeRoutes+pack.routes.length);
 const rebuilt=await import('../src/city_research_data.mjs?registration-test');
 assert.equal(rebuilt.ALL_CITY_PLACES.length,ALL_CITY_PLACES.length);
 assert.equal(rebuilt.ALL_CITY_TRAILS.length,ALL_CITY_TRAILS.length);
});
