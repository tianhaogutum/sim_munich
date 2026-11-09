import { RESEARCH_PACKS } from './city_research_data.mjs';

export const AU_HAIDHAUSEN = RESEARCH_PACKS.find(pack => pack.id === 'session05');
// Explicit associations keep the nearby Muffatwerk and Volksbad separate.
const buildingPlaces = {
 'session05-mariahilfplatz':'Mariahilfkirche',
 'session05-johannisplatz':'St. Johann Baptist',
 'session05-volksbad':'Müllersches Volksbad',
};
export function session05PlaceDetails(id) {
 const place = AU_HAIDHAUSEN?.places.find(place => place.id === id);
 if (!place) return null;
 const name=buildingPlaces[id];
 return { place, building:name ? AU_HAIDHAUSEN.buildings.find(building=>building.name.includes(name)) ?? null : null };
}

export function session05GeoJSON() {
 return { type:'FeatureCollection', features:(AU_HAIDHAUSEN?.places ?? []).map(place => ({
  type:'Feature', geometry:{type:'Point',coordinates:[place.lon,place.lat]},
  properties:{id:place.id,name:place.name},
 })) };
}

export function installSession05Places(map, { Popup, onTravel, document:doc = globalThis.document }) {
 const source='session05-places', layer='session05-place-points';
 map.addSource(source,{type:'geojson',data:session05GeoJSON()});
 map.addLayer({id:layer,type:'circle',source,minzoom:12,paint:{
  'circle-radius':['interpolate',['linear'],['zoom'],12,4,18,8],
  'circle-color':'#e8c687','circle-stroke-color':'#213b3c','circle-stroke-width':2,
 }});
 map.addLayer({id:'session05-place-labels',type:'symbol',source,minzoom:16,layout:{
  'text-field':['get','name'],'text-size':12,'text-anchor':'top','text-offset':[0,1],
 },paint:{'text-color':'#213b3c','text-halo-color':'#fff5dc','text-halo-width':2}});
 let popup;
 function showPlace(id) {
  const details=session05PlaceDetails(id);
  if(!details)return false;
  const {place,building}=details, card=doc.createElement('article');
  card.className='ci-session05-card';
  Object.assign(card.style,{color:'#213b3c',font:'13px/1.6 system-ui,sans-serif',maxHeight:'min(50vh, 420px)',overflowY:'auto',padding:'8px'});
  const append=(tag,text,parent=card)=>{const element=doc.createElement(tag);element.textContent=text;parent.append(element);return element;};
  const link=(label,url)=>{const a=append('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='block';};
  append('small','Au-Haidhausen · 户外发现');
  append('h3',place.name);
  append('p',place.description);
  append('small','近似户外导航点；以现场步道与围挡为准。');
  link('地点来源 ↗',place.source);
  if(building){
   append('h4','建筑观察');
   const list=append('ul','');
   for(const feature of building.features)append('li',feature,list);
   link('建筑资料 ↗',building.source);
   link('Commons 照片参考 ↗',building.photoPage);
   append('p',`${building.author} · ${building.license}`);
  }
  const travel=append('button','前往这里 ↗');
  travel.type='button';
  travel.onclick=()=>void onTravel(place);
  popup?.remove();
  popup=new Popup({maxWidth:'min(340px, calc(100vw - 32px))',offset:12})
   .setLngLat([place.lon,place.lat]).setDOMContent(card).addTo(map);
  return true;
 }
 map.on('click',layer,event=>showPlace(event.features?.[0]?.properties?.id));
 map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});
 map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});
 return {showPlace};
}
