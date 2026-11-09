import { ALL_CITY_PLACES as CITY_PLACES, ALL_CITY_TRAILS as CITY_TRAILS, RESEARCH_PACKS as CITY_RESEARCH } from './city_research_data.mjs';
import { CITY_BOUNDS, CITY_DISTRICTS, CITY_RESEARCH, registerCityResearch, cityToLocal, localToCity } from './city_data.mjs';
import { loadCityProgress, saveCityProgress, discoverCityPlaces, missionProgress, insideCity } from './city_rules.mjs';
import { createCityCastLayer } from './city_scene.js';
import { installSession05Places } from './city_session05.mjs';

const START={lon:11.58077,lat:48.15058};
const POSITION_SAVE='munich-city-position-v1';
const ui=document.getElementById('city-ui'),loading=document.getElementById('city-loading');
ui.innerHTML=`<header class="ci-header"><div class="ci-kicker">MÜNCHEN · OPEN WORLD</div><h1>把慕尼黑，慢慢走一遍。</h1><p>真实街道 · 建筑轮廓按位置加载</p><div class="ci-status" role="status" aria-live="polite">正在连接地图…</div></header>
<nav class="ci-toolbar" aria-label="漫游工具"><button data-action="atlas">地点 <kbd>G</kbd></button><button data-action="follow">跟随人物 <kbd>F</kbd></button><button data-action="overview">全城俯瞰</button><button data-action="photo">保存照片 <kbd>P</kbd></button><button data-action="reset">回到 LMU</button><a href="./index.html">精细约会场景 ↗</a></nav>
<aside class="ci-atlas"><h2>下一站，去哪儿？</h2><div class="ci-tabs"><button data-tab="places" aria-pressed="true">城市风景</button><button data-tab="districts" aria-pressed="false">25 个城区</button><button data-tab="references" aria-pressed="false">建筑参考</button></div><input class="ci-search" type="search" placeholder="搜索地点或城区" aria-label="搜索地点或城区"><div class="ci-place-list"></div></aside>
<aside class="ci-progress"><span class="ci-progress-count"></span><div class="ci-trails">沿街漫游，靠近地点自动留下足迹。</div></aside>
<footer class="ci-hint">WASD / 方向键移动 · Shift 奔跑 · 鼠标拖拽看城市 · F 回到人物 · G 地点 · P 拍照<br><small>建筑高度缺失时为近似值。全城依靠在线矢量数据加载；仅 LMU 周边有单独精细场景。</small></footer>
<div class="ci-touch" aria-label="触屏移动"><button data-move="w" aria-label="向前">↑</button><button data-move="a" aria-label="向左">←</button><button data-move="s" aria-label="向后">↓</button><button data-move="d" aria-label="向右">→</button><button class="ci-run" aria-pressed="false">跑</button></div>`;
const $=s=>ui.querySelector(s),status=$('.ci-status');
// Research is compiled into the same catalog used by discovery and saved progress.
let progress=loadCityProgress();
const player={...START,yaw:0}, motion={speed:0,heading:0};
try { const p=JSON.parse(localStorage.getItem(POSITION_SAVE)||'null'); if(insideCity(p?.lon,p?.lat))Object.assign(player,{lon:p.lon,lat:p.lat,yaw:Number.isFinite(p.yaw)?p.yaw:0}); } catch {}
const keys=new Set(), discovered=new Set(Object.keys(progress.found));
let follow=true,ready=false,paused=false,tab='places',runTouch=false,last=0,totalWalk=progress.walkedMeters,lastPersist=0,sourceReady=false;
let collisionPolygons=[],lastCollisionRefresh=0,errorText='',errorAt=0;

let cityStyle='https://tiles.openfreemap.org/styles/liberty';
try {
 const response=await fetch(cityStyle,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(`Map style HTTP ${response.status}`);
 cityStyle=await response.json();
 const buildings=cityStyle.layers?.find(layer=>layer.id==='building-3d');
 if(buildings){buildings.paint={...buildings.paint,'fill-extrusion-height':['coalesce',['get','render_height'],12],'fill-extrusion-base':['coalesce',['get','render_min_height'],0]};}
} catch {status.textContent='地图样式连接较慢，正在重试…';}
const map=new maplibregl.Map({container:'city-map',style:cityStyle,center:[player.lon,player.lat],zoom:19.8,pitch:66,bearing:0,antialias:true,preserveDrawingBuffer:true,maxBounds:[[CITY_BOUNDS.minLon,CITY_BOUNDS.minLat],[CITY_BOUNDS.maxLon,CITY_BOUNDS.maxLat]],minZoom:10,maxZoom:21,attributionControl:true,collectResourceTiming:true});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right');
map.keyboard.disable();
map.on('styleimagemissing',event=>{
 if(map.hasImage(event.id))return;
 // Some public-style categories lack a sprite. Keep their text labels and use a
 // neutral wayfinding dot rather than leaving repeated missing-image warnings.
 const size=16,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=76;data[i+1]=99;data[i+2]=82;data[i+3]=Math.hypot(x-7.5,y-7.5)<4?220:0;}
 map.addImage(event.id,{width:size,height:size,data},{pixelRatio:2});
});
const cast=createCityCastLayer(map,player,motion);
let session05Layer;

function insideRing(lon,lat,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++) {const a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function inPolygon(lon,lat,rings){return insideRing(lon,lat,rings[0])&&!rings.slice(1).some(r=>insideRing(lon,lat,r));}
function collisionAt(lon,lat){
 if(lon<CITY_BOUNDS.minLon||lon>CITY_BOUNDS.maxLon||lat<CITY_BOUNDS.minLat||lat>CITY_BOUNDS.maxLat)return true;
 return collisionPolygons.some(p=>lon>=p.minLon&&lon<=p.maxLon&&lat>=p.minLat&&lat<=p.maxLat&&inPolygon(lon,lat,p.rings));
}
function refreshCollision(){
 if(!ready||map.getZoom()<15){collisionPolygons=[];sourceReady=false;return;}
 const features=map.querySourceFeatures('openmaptiles',{'sourceLayer':'building'}),polygons=[],ids=new Set();
 for(const f of features){
  const geometry=f.geometry;if(!['Polygon','MultiPolygon'].includes(geometry.type))continue;
  const list=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  for(const rings of list){if(!rings?.[0]?.length)continue;const outer=rings[0],k=`${f.id}:${outer[0][0]}:${outer[0][1]}`;if(ids.has(k))continue;ids.add(k);
   const minLon=Math.min(...outer.map(p=>p[0])),maxLon=Math.max(...outer.map(p=>p[0])),minLat=Math.min(...outer.map(p=>p[1])),maxLat=Math.max(...outer.map(p=>p[1]));
   const center=map.getCenter();if(maxLon<center.lng-.005||minLon>center.lng+.005||maxLat<center.lat-.0035||minLat>center.lat+.0035)continue;
   polygons.push({rings,minLon,maxLon,minLat,maxLat});
  }
 }
 collisionPolygons=polygons;sourceReady=map.isSourceLoaded('openmaptiles')&&features.length>0;
}
function canStand(lon,lat) {
 const dx=.4/(111320*Math.cos(lat*Math.PI/180)),dy=.4/110574;
 return [[0,0],[dx,0],[-dx,0],[0,dy],[0,-dy]].every(([x,y])=>!collisionAt(lon+x,lat+y));
}
async function chooseArrivalView(){
 map.stop();const position=cityToLocal(player.lon,player.lat);
 // A tilted camera's ground projection can sit inside the opposite street wall.
 // Choose the longest free radial street view, then shorten its boom by zooming.
 const baseZoom=19.8,pitch=66,mpp=40075016.686*Math.cos(player.lat*Math.PI/180)/(512*2**baseZoom);
 const boom=map.getCanvas().clientHeight*1.5*mpp*Math.sin(pitch*Math.PI/180);
 let best={bearing:0,clear:0};
 for(const bearing of [0,45,90,135,180,225,270,315]){
  const angle=bearing*Math.PI/180;let clear=0;
  for(let d=1;d<=boom;d+=1){const point=localToCity(position.x-Math.sin(angle)*d,position.z+Math.cos(angle)*d);if(collisionAt(point.lon,point.lat))break;clear=d;}
  if(clear>best.clear)best={bearing,clear};
 }
 const zoom=Math.min(21,baseZoom+Math.max(0,Math.log2(boom/Math.max(6,best.clear-2))));
 map.jumpTo({center:[player.lon,player.lat],zoom,pitch,bearing:best.bearing});
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 refreshCollision();
}

function safeArrival(place){
 const origin=cityToLocal(place.lon,place.lat);
 for(let r=0;r<=80;r+=2)for(let i=0;i<(r?24:1);i++){
  const a=i*Math.PI/12,q=localToCity(origin.x+Math.cos(a)*r,origin.z+Math.sin(a)*r);
  if(canStand(q.lon,q.lat))return q;
 }
 return null;
}
function setFollow(on){follow=on;if(on){sourceReady=false;map.stop();map.jumpTo({center:[player.lon,player.lat],zoom:Math.max(19.8,map.getZoom()),pitch:66});refreshCollision();}$('.ci-toolbar [data-action="follow"]').setAttribute('aria-pressed',String(on));}
function persist(){progress.walkedMeters=totalWalk;saveCityProgress(progress);try{localStorage.setItem(POSITION_SAVE,JSON.stringify({lon:player.lon,lat:player.lat,yaw:player.yaw}));}catch{}}
const trails=$('.ci-trails');trails.innerHTML='<label>主题路线 <select class="ci-trail-select" aria-label="选择主题路线"></select></label><p class="ci-trail-status"></p><button data-action="trail">前往下一站 ↗</button>';
for(const trail of CITY_TRAILS){const option=document.createElement('option');option.value=trail.id;option.textContent=trail.name;trails.querySelector('select').append(option);}trails.querySelector('select').value=progress.activeTrail;
trails.querySelector('select').onchange=e=>{progress.activeTrail=e.target.value;persist();renderProgress();};
function renderProgress(){$('.ci-progress-count').textContent=`城市足迹 · ${discovered.size} / ${CITY_PLACES.length} · ${(totalWalk/1000).toFixed(2)} km`;const m=missionProgress(progress);$('.ci-trail-status').textContent=`${m.completed}/${m.total} · ${m.done?'这条路线已走完':`下一站 ${m.next?.name??''}`}`;}
function discover(){const next=discoverCityPlaces(progress,player);for(const id of Object.keys(next.found)){if(!discovered.has(id)){discovered.add(id);status.textContent=`已留下足迹 · ${CITY_PLACES.find(p=>p.id===id)?.name??id}`;}}progress=next;persist();renderProgress();}
async function travel(place){
 if(typeof place==='string')place=[...CITY_PLACES,...CITY_DISTRICTS].find(p=>String(p.id)===place);
 if(!place||!Number.isFinite(place.lon)||!Number.isFinite(place.lat))return false;
 paused=true;keys.clear();follow=false;status.textContent=`正在展开 ${place.name??'这里'} 的街道…`;
 map.jumpTo({center:[place.lon,place.lat],zoom:19.8,pitch:66});
 await new Promise(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;map.off('idle',finish);resolve();};map.once('idle',finish);setTimeout(finish,6500);});
 refreshCollision();if(!sourceReady){status.textContent='这里的在线街道尚未到达，保留原位置。请稍后再试。';paused=false;return false;}const spot=safeArrival(place);
 if(!spot){status.textContent='附近暂未找到安全落脚点，请在俯瞰模式选择附近街道。';paused=false;return false;}
 Object.assign(player,spot);player.yaw=0;follow=true;await chooseArrivalView();$('.ci-toolbar [data-action="follow"]').setAttribute('aria-pressed','true');paused=false;discover();renderProgress();session05Layer?.showPlace(place.id);return true;
}
function renderList(){
 if(tab==='references'){
  const list=$('.ci-place-list'),query=$('.ci-search').value.trim().toLowerCase();list.replaceChildren();
  for(const pack of CITY_RESEARCH)for(const b of pack.buildings){
   if(!`${b.name} ${pack.district}`.toLowerCase().includes(query))continue;
   const card=document.createElement('div'),heading=document.createElement('h3'),features=document.createElement('p'),credit=document.createElement('small'),photo=document.createElement('a'),source=document.createElement('a');
   heading.textContent=b.name;features.textContent=b.features.join(' ');credit.textContent=`${b.author} · ${b.license}`;
   photo.textContent='摄影参考 ↗';photo.href=b.photoPage;source.textContent='建筑资料 ↗';source.href=b.source;
   for(const a of [photo,source]){a.target='_blank';a.rel='noopener noreferrer';}
   card.append(heading,features,credit,document.createElement('br'),photo,document.createTextNode(' · '),source);list.append(card);
  }
  return;
 }
 const query=$('.ci-search').value.trim().toLowerCase(),items=(tab==='places'?CITY_PLACES:CITY_DISTRICTS).filter(p=>`${p.name} ${p.district??''} ${CITY_DISTRICTS.find(d=>d.id===p.district)?.name??''}`.toLowerCase().includes(query));
 const list=$('.ci-place-list');list.replaceChildren();
 for(const p of items){const button=document.createElement('button');button.type='button';button.dataset.place=String(p.id);const h=document.createElement('h3');h.textContent=p.name;const small=document.createElement('small');small.textContent=tab==='places'?(discovered.has(p.id)?'◆ 已到访 · ':'◇ ')+(p.description??''): '城区导航中心 · 按街道继续探索';button.append(h,small);button.onclick=()=>void travel(p);list.append(button);}
}
function photograph(){if(!ready)return;try{map.triggerRepaint();const a=document.createElement('a');a.href=map.getCanvas().toDataURL('image/png');a.download=`munich-city-${Date.now()}.png`;a.click();status.textContent='城市照片已保存';}catch{status.textContent='照片暂未保存，请等街道加载完成后再试。';}}
ui.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='follow')setFollow(true);if(action==='overview'){follow=false;map.easeTo({center:[11.578,48.145],zoom:11.7,pitch:40,duration:800});}if(action==='photo')photograph();if(action==='reset')void travel({...START,name:'LMU 大学'});if(action==='trail'){const next=missionProgress(progress).next;if(next)void travel(next);}if(action==='atlas')$('.ci-atlas').classList.toggle('closed');const next=e.target.closest('[data-tab]')?.dataset.tab;if(next){tab=next;for(const b of ui.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));renderList();}});
$('.ci-search').addEventListener('input',renderList);
map.on('dragstart',e=>{if(e.originalEvent)follow=false;});map.on('rotatestart',e=>{if(e.originalEvent)follow=false;});map.on('zoomstart',e=>{if(e.originalEvent)follow=false;});
addEventListener('keydown',e=>{
 if(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable))return;
 const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){keys.add(k);if(!follow)setFollow(true);e.preventDefault();}
 if(e.repeat)return;if(k==='f')setFollow(true);if(k==='g')$('.ci-atlas').classList.toggle('closed');if(k==='p')photograph();if(k==='escape'){$('.ci-atlas').classList.add('closed');keys.clear();}
});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();motion.speed=0;});
for(const b of ui.querySelectorAll('[data-move]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);if(!follow)setFollow(true);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.move));}
$('.ci-run').onclick=()=>{runTouch=!runTouch;$('.ci-run').setAttribute('aria-pressed',String(runTouch));};
map.on('load',()=>{
 ready=true;loading.hidden=true;
 if(map.getLayer('building-3d')){map.setPaintProperty('building-3d','fill-extrusion-color','#c6b89f');map.setPaintProperty('building-3d','fill-extrusion-opacity',1);map.setPaintProperty('building-3d','fill-extrusion-height',['coalesce',['get','render_height'],12]);map.setPaintProperty('building-3d','fill-extrusion-base',['coalesce',['get','render_min_height'],0]);}
 map.addLayer(cast.layer);session05Layer=installSession05Places(map,{Popup:maplibregl.Popup,onTravel:travel});refreshCollision();const restored=safeArrival(player);if(restored)Object.assign(player,restored);map.jumpTo({center:[player.lon,player.lat]});renderProgress();renderList();status.textContent='街道已展开 · 从 LMU 出发';
});
map.on('idle',()=>{if(ready)refreshCollision();});
addEventListener('pagehide',persist);
map.on('error',event=>{errorText=event.error?.message??'在线地图暂时未能加载';errorAt=performance.now();status.textContent='部分街道数据暂未到达，正在重试。';loading.textContent='地图连接较慢。可返回 LMU 精细场景，或等待在线街道数据。';});
setTimeout(()=>{if(!ready){loading.innerHTML='地图暂未连接。<a href="./index.html">返回 LMU 精细场景</a>';loading.setAttribute('role','alert');}},18000);
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,Math.max(0,(now-last)/1000||0));last=now;if(!ready)return;
 if(now-lastCollisionRefresh>700){lastCollisionRefresh=now;refreshCollision();}
 motion.speed=0;
 if(!paused&&!document.hidden&&sourceReady){
  let right=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
  const length=Math.hypot(right,forward);if(length){right/=length;forward/=length;const angle=map.getBearing()*Math.PI/180,speed=keys.has('shift')||runTouch?8:3.4;
   const dx=(right*Math.cos(angle)+forward*Math.sin(angle))*speed*dt,dz=(right*Math.sin(angle)-forward*Math.cos(angle))*speed*dt;
   const p=cityToLocal(player.lon,player.lat),n=localToCity(p.x+dx,p.z+dz),before={...player};
   if(canStand(n.lon,player.lat))player.lon=n.lon;if(canStand(player.lon,n.lat))player.lat=n.lat;
   const actual=cityToLocal(player.lon,player.lat);totalWalk+=Math.hypot(actual.x-p.x,actual.z-p.z);motion.speed=Math.hypot(actual.x-p.x,actual.z-p.z)/Math.max(dt,.001);motion.heading=Math.atan2(-(actual.x-p.x),-(actual.z-p.z));player.yaw=motion.heading;
   if(follow)map.jumpTo({center:[player.lon,player.lat]});
  }
 }
 if(now-lastPersist>1000){lastPersist=now;discover();persist();renderProgress();if(now-errorAt>4000)status.textContent=paused?'正在寻找街道落脚点…':`${sourceReady?'街道已加载':'附近街道加载中'} · ${collisionPolygons.length} 个建筑轮廓 · ${player.lat.toFixed(5)}° N / ${player.lon.toFixed(5)}° E`;}
}
renderList();renderProgress();requestAnimationFrame(tick);
window.__city={map,player,motion,travel,collisionAt,setFollow,cast,research:CITY_RESEARCH,getState:()=>({ready,follow,paused,sourceReady,buildings:collisionPolygons.length,discovered:[...discovered],walked:totalWalk,progress,mission:missionProgress(progress),lastError:errorText})};
