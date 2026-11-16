import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AU_HAIDHAUSEN, session05GeoJSON, session05PlaceDetails, installSession05Places } from '../src/city_session05.mjs';
import { ALL_CITY_PLACES, ALL_CITY_TRAILS } from '../src/city_research_data.mjs';
import { initialCityProgress, discoverCityPlaces, missionProgress, saveCityProgress, loadCityProgress } from '../src/city_rules.mjs';

test('session05 map destinations match the research file and production catalog',()=>{
 const file=JSON.parse(readFileSync(new URL('../assets/city_research/session05.json',import.meta.url),'utf8'));
 for(const [key,value] of Object.entries(file)){
  if(key!=='routes')assert.deepEqual(AU_HAIDHAUSEN[key],value,`stale source field: ${key}`);
 }
 assert.equal(AU_HAIDHAUSEN.routes.length,file.routes.length);
 const byId=new Map(file.places.map(place=>[place.id,place]));
 for(const reference of file.routes){
  const route=AU_HAIDHAUSEN.routes.find(route=>route.id===reference.id);
  assert.ok(route,reference.id);
  for(const [key,value] of Object.entries(reference))assert.deepEqual(route[key],value,`stale route field: ${key}`);
  // Independently verify distance metadata when present; legacy packs omit it.
  const lengths=route.stops.slice(1).map((id,index)=>{
   const a=byId.get(route.stops[index]),b=byId.get(id),rad=Math.PI/180;
   const h=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
   return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  });
  if(route.distanceMeters!==undefined){
   assert.equal(route.distanceKind,'straight-line segments');
   assert.equal(route.distanceMeters,Math.round(lengths.reduce((sum,n)=>sum+n,0)));
  }
  if(route.segmentDistancesMeters!==undefined)assert.deepEqual(route.segmentDistancesMeters,lengths.map(Math.round));
  for(const key of Object.keys(route))assert.ok(key in reference||['distanceMeters','distanceKind','segmentDistancesMeters'].includes(key),`unexpected compiled route field: ${key}`);
 }
 const features=session05GeoJSON().features;
 assert.equal(features.length,8);
 for(const feature of features){
  const place=ALL_CITY_PLACES.find(place=>place.id===feature.properties.id);
  assert.deepEqual(feature.geometry.coordinates,[place.lon,place.lat]);
  assert.equal(place.district,'Au-Haidhausen');
  assert.equal(discoverCityPlaces(initialCityProgress(),place,{now:42}).found[place.id],42);
 }
 assert.equal(session05PlaceDetails('session05-mariahilfplatz').building,AU_HAIDHAUSEN.buildings[0]);
 assert.equal(session05PlaceDetails('session05-johannisplatz').building,AU_HAIDHAUSEN.buildings[1]);
 assert.equal(session05PlaceDetails('session05-volksbad').building,AU_HAIDHAUSEN.buildings[2]);
 assert.equal(session05PlaceDetails('session05-muffatwerk').building,null);
 assert.equal(session05PlaceDetails('unknown'),null);
});

test('Au-Haidhausen walk survives saving between every destination',()=>{
 const route=ALL_CITY_TRAILS.find(route=>route.id==='session05-haidhausen-discovery');
 assert.deepEqual(route.places,AU_HAIDHAUSEN.routes[0].stops);
 let saved,state={...initialCityProgress(),activeTrail:route.id};
 const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 for(const id of route.places){
  state=discoverCityPlaces(state,ALL_CITY_PLACES.find(place=>place.id===id),{now:42});
  assert(saveCityProgress(state,storage));state=loadCityProgress(storage);
  assert.equal(state.activeTrail,route.id);assert.equal(state.found[id],42);
 }
 assert.equal(missionProgress(state).done,true);
});

test('map clicks show credited building references and travel uses the selected place',()=>{
 const sources=[],layers=[],handlers=new Map(),popups=[],trips=[],canvas={style:{}};
 const map={addSource:(id,source)=>sources.push({id,source}),addLayer:layer=>layers.push(layer),
  on:(event,layer,handler)=>handlers.set(`${event}:${layer}`,handler),getCanvas:()=>canvas};
 const doc={createElement:tag=>({tag,style:{},children:[],append(child){this.children.push(child);}})};
 class Popup {
  constructor(){popups.push(this);}
  setLngLat(point){this.point=point;return this;}
  setDOMContent(content){this.content=content;return this;}
  addTo(target){assert.equal(target,map);return this;}
  remove(){this.removed=true;}
 }
 const controller=installSession05Places(map,{Popup,onTravel:place=>trips.push(place),document:doc});
 assert.equal(sources[0].source.data.features.length,8);
 assert.deepEqual(layers.map(layer=>layer.type),['circle','symbol']);
 handlers.get('click:session05-place-points')({features:[{properties:{id:'session05-volksbad'}}]});
 const first=popups[0],building=AU_HAIDHAUSEN.buildings[2];
 const links=first.content.children.filter(child=>child.tag==='a');
 assert(links.some(link=>link.href===building.photoPage));
 assert(first.content.children.some(child=>child.textContent?.includes(building.license)));
 for(const link of links){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');}
 first.content.children.find(child=>child.tag==='button').onclick();
 assert.equal(trips[0].id,'session05-volksbad');
 assert(controller.showPlace('session05-wiener-platz'));assert(first.removed);
 assert.equal(controller.showPlace('unknown'),false);assert.equal(popups.length,2);
 handlers.get('click:session05-place-points')({features:[]});assert.equal(popups.length,2);
 handlers.get('mouseenter:session05-place-points')();assert.equal(canvas.style.cursor,'pointer');
 handlers.get('mouseleave:session05-place-points')();assert.equal(canvas.style.cursor,'');
});
