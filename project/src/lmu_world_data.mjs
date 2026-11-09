// Geographic atlas data derived from the retained OpenStreetMap snapshots.
// +X north, +Z east, 1 unit = 1 m. No network request is needed during play.
import { BUILDINGS as north, LANDMARKS as northPlaces } from './lmu_block_siegestor_data.mjs';
import { BUILDINGS as east, LANDMARKS as eastPlaces } from './lmu_block_huberplatz_data.mjs';
import { BUILDINGS as west, LANDMARKS as westPlaces } from './lmu_block_maxvorstadt_west_data.mjs';
import { BUILDINGS as church, LANDMARKS as churchPlaces } from './lmu_block_ludwigskirche_data.mjs';
import { FOOTPRINTS as south, LANDMARKS as southPlaces } from './lmu_block_ludwig_west_geometry.mjs';
import { LANDMARKS as roadPlaces, LANES } from './lmu_block_ludwigstrasse_plan.mjs';
import { ringToWorld } from './date_geo.mjs';
import { CORE_BUILDINGS } from './lmu_core_data.mjs';

export const DISTRICTS = Object.freeze([
  { id:'ludwigstrasse', name:'路德维希大街', subtitle:'沿真实道路向南北漫游', places:roadPlaces, color:'#d9c4a0', source:'https://www.openstreetmap.org/copyright' },
  { id:'siegestor', name:'凯旋门与美术学院', subtitle:'北段 · 纪念建筑与学院庭院', places:northPlaces, color:'#d7b48b', source:'https://www.muenchen.de/sehenswuerdigkeiten/bauwerke-und-denkmaeler/siegestor' },
  { id:'huberplatz', name:'胡贝尔广场东侧', subtitle:'大学街区 · Georgianum 与兽医街', places:eastPlaces, color:'#b7cab0', source:'https://www.lmu.de/' },
  { id:'ludwig_west', name:'大学南侧西段', subtitle:'历史立面、图书馆与街角', places:southPlaces, color:'#c7b1a6', source:'https://www.ub.uni-muenchen.de/' },
  { id:'maxvorstadt_west', name:'Maxvorstadt', subtitle:'阿玛莉恩街 · 谢林街 · 土耳其街', places:westPlaces, color:'#d7bba4', source:'https://commons.wikimedia.org/wiki/Category:Maxvorstadt' },
  { id:'ludwigskirche', name:'教堂与州立图书馆', subtitle:'双塔、圆拱与学者阶梯', places:churchPlaces, color:'#d6cdaf', source:'https://www.bsb-muenchen.de/' },
]);
export const LANDMARKS = Object.freeze(DISTRICTS.flatMap(d => d.places.map(p => Object.freeze({...p, district:d.id, districtName:d.name, color:d.color, source:d.source}))));
export const BUILDING_RINGS = Object.freeze([
  ...CORE_BUILDINGS.map(b=>b.ring), ...north.map(b=>b.ring), ...east.map(b=>b.ring), ...west.map(b=>b.ring),
  ...south.map(b=>b.ring), ...church.map(b=>ringToWorld(b.ring)),
].filter(r=>Array.isArray(r)&&r.length>=3));
export const ROAD_LINES = Object.freeze(LANES.filter(l=>l.mode==='motor').map(l=>l.points));
export const WORLD_STORAGE = 'lmu-world-discoveries-v1';

export function normalizeDiscoveries(raw, places=LANDMARKS) {
  if (!Array.isArray(raw)) return [];
  const ids=new Set(places.map(p=>p.id));
  return [...new Set(raw.filter(id=>typeof id==='string'&&ids.has(id)))];
}

/** A conservative landing point: centre and shoulder samples must all be free. */
export function findSafeArrival(place, blocked, bounds, radius=24) {
  if (!place || !Number.isFinite(place.x) || !Number.isFinite(place.z)) return null;
  const safe=(x,z)=> (!bounds || (x>=bounds.minX+1&&x<=bounds.maxX-1&&z>=bounds.minZ+1&&z<=bounds.maxZ-1)) &&
    [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]].every(([dx,dz])=>!blocked(x+dx,z+dz));
  if (safe(place.x,place.z)) return {x:place.x,z:place.z};
  for(let r=1;r<=radius;r++) for(let i=0;i<32;i++) {
    const a=i*Math.PI/16, x=place.x+Math.cos(a)*r, z=place.z+Math.sin(a)*r;
    if(safe(x,z))return {x,z};
  }
  return null;
}
