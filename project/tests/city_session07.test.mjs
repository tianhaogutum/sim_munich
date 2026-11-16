import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ALL_CITY_PLACES,ALL_CITY_TRAILS} from '../src/city_research_data.mjs';
import {session07PlaceDetails,session07GeoJSON,installSession07Places} from '../src/city_session07.mjs';
import {initialCityProgress,discoverCityPlaces,missionProgress,loadCityProgress,saveCityProgress} from '../src/city_rules.mjs';
const pack=JSON.parse(readFileSync(new URL('../assets/city_research/session07.json',import.meta.url),'utf8'));

test('Westpark destinations are mapped and discoverable with their research metadata',()=>{
 const features=session07GeoJSON().features;
 assert.equal(features.length,8);
 for(const reference of pack.places){
  const place=ALL_CITY_PLACES.find(p=>p.id===reference.id);
  assert.ok(place,reference.id);
  for(const key of ['name','lon','lat','description','source'])assert.equal(place[key],reference[key]);
  assert.equal(place.district,pack.district);
  assert.equal(place.coordinateStatus,reference.accuracy);
  assert.deepEqual(features.find(f=>f.properties.id===place.id).geometry.coordinates,[place.lon,place.lat]);
  assert.equal(discoverCityPlaces(initialCityProgress(),place,{now:42}).found[place.id],42);
 }
});

test('nearby gardens retain the correct building references',()=>{
 for(const [suffix,index] of [['nepal-pagoda',0],['thai-sala',1],['bayerwald-house',2]]){
  assert.equal(session07PlaceDetails('session07-'+suffix).building.photoPage,pack.buildings[index].photoPage);
 }
 assert.equal(session07PlaceDetails('session07-japanese-garden').building,null);
 assert.equal(session07PlaceDetails('session07-chinese-garden').building,null);
 assert.equal(session07PlaceDetails('unknown'),null);
});

test('Westpark walk survives saving and reaches completion',()=>{
 const reference=pack.routes[0],trail=ALL_CITY_TRAILS.find(t=>t.id===reference.id);
 assert.deepEqual(trail.places,reference.stops);
 let state={...initialCityProgress(),activeTrail:trail.id},saved;
 const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 for(const id of trail.places){
  state=discoverCityPlaces(state,ALL_CITY_PLACES.find(p=>p.id===id),{now:42});
  assert.ok(saveCityProgress(state,storage));state=loadCityProgress(storage);
  assert.equal(state.activeTrail,trail.id);assert.equal(state.found[id],42);
 }
 assert.equal(missionProgress(state).done,true);
});

test('marker clicks show credits, replace popups and invoke the travel callback',()=>{
 const handlers=new Map(),sources=new Map(),layers=[],popups=[],canvas={style:{}};
 const map={addSource:(id,s)=>sources.set(id,s),addLayer:l=>layers.push(l),
  on:(event,layer,fn)=>handlers.set(event+':'+layer,fn),getCanvas:()=>canvas};
 const doc={createElement:tag=>({tag,style:{},children:[],append(...nodes){this.children.push(...nodes);}})};
 class Popup {
  constructor(){popups.push(this);}
  setLngLat(point){this.point=point;return this;}
  setDOMContent(card){this.card=card;return this;}
  addTo(){return this;}
  remove(){this.removed=true;}
 }
 let destination;
 const controller=installSession07Places(map,{Popup,document:doc,onTravel:p=>{destination=p;}});
 assert.equal(sources.get('session07-places').data.features.length,8);
 assert.equal(layers.length,2);
 const click=handlers.get('click:session07-place-points');
 click({features:[{properties:{id:'session07-thai-sala'}}]});
 const popup=popups[0],card=popup.card;
 assert.deepEqual(popup.point,[11.5126,48.1232]);
 const photo=card.children.find(n=>n.href===pack.buildings[1].photoPage);
 assert.ok(photo);assert.equal(photo.rel,'noopener noreferrer');
 assert.ok(card.children.some(n=>n.textContent.includes('Peterf')&&n.textContent.includes('CC BY-SA 4.0')));
 card.children.find(n=>n.tag==='button').onclick();
 assert.equal(destination.id,'session07-thai-sala');
 assert.equal(controller.showPlace('session07-historic-garden'),true);
 assert.equal(popup.removed,true);
 assert.ok(!popups[1].card.children.some(n=>n.textContent==='建筑观察'));
 assert.equal(controller.showPlace('unknown'),false);
 assert.doesNotThrow(()=>click({features:[]}));
 handlers.get('mouseenter:session07-place-points')();assert.equal(canvas.style.cursor,'pointer');
 handlers.get('mouseleave:session07-place-points')();assert.equal(canvas.style.cursor,'');
});
