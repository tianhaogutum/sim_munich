import { ALL_CITY_PLACES as CITY_PLACES, ALL_CITY_TRAILS as CITY_TRAILS } from './city_research_data.mjs';
import { CITY_BOUNDS,CITY_SECTORS } from './city_data.mjs';
import { placeArrivalRadius } from './city_navigation_rules.mjs';
export const CITY_SAVE_KEY='lmu-munich-city-v1';
export const CITY_SAVE_VERSION=1;
const finite=Number.isFinite;
export function insideCity(lon,lat){return finite(lon)&&finite(lat)&&lon>=CITY_BOUNDS.minLon&&lon<=CITY_BOUNDS.maxLon&&lat>=CITY_BOUNDS.minLat&&lat<=CITY_BOUNDS.maxLat;}
export function clampCityPosition(point){return {lon:Math.max(CITY_BOUNDS.minLon,Math.min(CITY_BOUNDS.maxLon,finite(point?.lon)?point.lon:11.58035)),lat:Math.max(CITY_BOUNDS.minLat,Math.min(CITY_BOUNDS.maxLat,finite(point?.lat)?point.lat:48.15075))};}
export function cityDistance(a,b){
 if(![a?.lon,a?.lat,b?.lon,b?.lat].every(finite))return Infinity;
 const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(Math.max(0,h)),Math.sqrt(Math.max(0,1-h)));
}
export function initialCityProgress(){return {version:CITY_SAVE_VERSION,found:{},walkedMeters:0,activeTrail:'university-old-town'};}
export function normalizeCityProgress(raw){
 const out=initialCityProgress();if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==CITY_SAVE_VERSION)return out;
 const ids=new Set(CITY_PLACES.map(p=>p.id));
 if(raw.found&&typeof raw.found==='object'&&!Array.isArray(raw.found))for(const [id,time] of Object.entries(raw.found))if(ids.has(id)&&finite(time)&&time>=0)out.found[id]=time;
 out.walkedMeters=finite(raw.walkedMeters)?Math.min(1e8,Math.max(0,raw.walkedMeters)):0;
 if(CITY_TRAILS.some(t=>t.id===raw.activeTrail))out.activeTrail=raw.activeTrail;
 return out;
}
export function discoverCityPlaces(progress,position,{radius,now=Date.now()}={}){
 const next=normalizeCityProgress(progress);if(!insideCity(position?.lon,position?.lat))return next;
 for(const p of CITY_PLACES){
  const distance=finite(radius)?Math.max(1,Math.min(radius,200)):placeArrivalRadius(p,65);
  if(!Object.hasOwn(next.found,p.id)&&cityDistance(position,p)<=distance)next.found[p.id]=finite(now)&&now>=0?now:Date.now();
 }
 return next;
}
export function recordCityMovement(progress,previous,next,{maxStep=80}={}){
 const out=normalizeCityProgress(progress),distance=cityDistance(previous,next);
 // Fast travel and implausible discontinuities never count as walked distance.
 if(insideCity(previous?.lon,previous?.lat)&&insideCity(next?.lon,next?.lat)&&distance<=maxStep)out.walkedMeters+=distance;
 return out;
}
export function missionProgress(progress,trailId=progress?.activeTrail){
 const state=normalizeCityProgress(progress),trail=CITY_TRAILS.find(t=>t.id===trailId)??CITY_TRAILS[0];
 const completed=trail.places.filter(id=>Object.hasOwn(state.found,id));
 const nextId=trail.places.find(id=>!Object.hasOwn(state.found,id))??null;
 return {id:trail.id,name:trail.name,completed:completed.length,total:trail.places.length,done:nextId===null,nextId,next:nextId?CITY_PLACES.find(p=>p.id===nextId):null};
}
export function sectorForPosition(lon,lat){if(!insideCity(lon,lat))return null;const col=Math.min(9,Math.floor((lon-CITY_BOUNDS.minLon)/(CITY_BOUNDS.maxLon-CITY_BOUNDS.minLon)*10)),row=Math.min(9,Math.floor((lat-CITY_BOUNDS.minLat)/(CITY_BOUNDS.maxLat-CITY_BOUNDS.minLat)*10));return CITY_SECTORS[row*10+col];}
export function loadCityProgress(storage){try{storage??=globalThis.localStorage;return normalizeCityProgress(JSON.parse(storage?.getItem(CITY_SAVE_KEY)??'null'));}catch{return initialCityProgress();}}
export function saveCityProgress(progress,storage){try{storage??=globalThis.localStorage;if(!storage?.setItem)return false;storage.setItem(CITY_SAVE_KEY,JSON.stringify(normalizeCityProgress(progress)));return true;}catch{return false;}}
