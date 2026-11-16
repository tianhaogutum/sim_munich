import test from 'node:test';
import assert from 'node:assert/strict';
import {cityPlacesGeoJSON,installCityPlaceLayer} from '../src/city_place_layer.mjs';
import {ALL_CITY_PLACES} from '../src/city_research_data.mjs';

test('full catalog has a marker and discovery state without changing source data',()=>{
 const found={[ALL_CITY_PLACES[0].id]:0};
 const data=cityPlacesGeoJSON(ALL_CITY_PLACES,found);
 assert.equal(data.features.length,ALL_CITY_PLACES.length);
 assert.equal(new Set(data.features.map(f=>f.properties.id)).size,ALL_CITY_PLACES.length);
 assert.equal(data.features.filter(f=>f.properties.visited).length,1);
 for(let i=0;i<data.features.length;i++)assert.deepEqual(data.features[i].geometry.coordinates,[ALL_CITY_PLACES[i].lon,ALL_CITY_PLACES[i].lat]);
});
test('marker offers independent walking and fast travel, updates once and removes listeners',()=>{
 const handlers=new Map(),layers=new Map(),sources=new Map();let updates=0,destination,walked,popup;
 const map={addSource:(id,data)=>sources.set(id,{...data,setData(){updates++;}}),addLayer:data=>layers.set(data.id,data),
  getLayer:id=>layers.get(id),getSource:id=>sources.get(id),removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),
  on:(type,id,fn)=>handlers.set(type+id,fn),off:(type,id)=>handlers.delete(type+id),getCanvas:()=>({style:{}})};
 const document={createElement:tag=>({tag,children:[],append(child){this.children.push(child);}})};
 class Popup{constructor(){popup=this;}setLngLat(){return this;}setDOMContent(card){this.card=card;return this;}addTo(){return this;}remove(){this.removed=true;}}
 const places=ALL_CITY_PLACES.slice(0,2),layer=installCityPlaceLayer(map,{places,Popup,document,onTravel:p=>destination=p,onNavigate:p=>walked=p});
 assert.equal(layer.showPlace('missing'),false);layer.showPlace(places[0].id);
 popup.card.children.find(el=>el.textContent==='设为步行目标').onclick();assert.equal(walked,places[0]);assert.equal(popup.removed,true);
 layer.showPlace(places[1].id);popup.card.children.find(el=>el.textContent==='快速前往').onclick();assert.equal(destination,places[1]);
 layer.update({[places[0].id]:42});layer.update({[places[0].id]:42});assert.equal(updates,1);
 layer.dispose();layer.dispose();assert.equal(layers.size,0);assert.equal(sources.size,0);assert.equal(handlers.size,0);assert.equal(layer.showPlace(places[0].id),false);
});
