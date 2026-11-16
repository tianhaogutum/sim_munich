import { ALL_CITY_PLACES as PLACES } from './city_research_data.mjs';
import { validPosition, navigationDistance, navigationSnapshot, formatNavigationDistance, compassLabel, recordBreadcrumb } from './city_navigation_rules.mjs';
let navigatorCount=0;
export function createCityNavigator({map,player,notify=()=>{},getState=()=>({}),addAction,places=PLACES}){
 const id=`city-navigation-${++navigatorCount}`,lineId=`${id}-bearing`,traceId=`${id}-trace`,pointId=`${id}-point`;
 const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./city_navigator.css',import.meta.url).href;document.head.append(stylesheet);
 const root=document.createElement('section');root.className='cn-navigator';root.setAttribute('aria-label','步行目标指引');
 root.innerHTML=`<button class="cn-toggle" aria-expanded="false">步行指引 <kbd>V</kbd><span class="cn-summary">选择目的地</span></button>
 <div class="cn-panel" hidden><label>搜索步行目标<input class="cn-search" type="search" placeholder="地点 / 城区" autocomplete="off"></label><label>附近地点<select class="cn-places" aria-label="选择步行目的地"></select></label><div class="cn-actions"><button class="cn-start">步行到这里</button><button class="cn-route">当前路线下一站</button></div><p class="cn-empty" hidden>没有匹配地点，请尝试其他名称。</p><p class="cn-caution">虚线仅为直线方位，未经步行路网验证。请沿街道、入口与过街点绕行。</p></div>
 <div class="cn-guidance" hidden><div class="cn-target"></div><div class="cn-reading"><span class="cn-compass" aria-hidden="true"><span class="cn-north">N</span><span class="cn-arrow">↑</span></span><div><strong class="cn-distance"></strong><span class="cn-heading"></span></div></div><p class="cn-progress"></p><p class="cn-mode">直线方位 · 非逐路口导航</p><div class="cn-actions"><button class="cn-next" hidden>路线下一站</button><button class="cn-cancel">取消目标</button></div></div>`;
 (document.getElementById('city-ui')??document.body).append(root);
 const $=selector=>root.querySelector(selector);let destination=null,initialDistance=0,arrived=false,elapsed=0,disposed=false,breadcrumbs=[],panelOpen=false;
 const placesById=new Map(places.map(p=>[String(p.id),p]));
 const toggle=$('.cn-toggle'),panel=$('.cn-panel'),guidance=$('.cn-guidance'),select=$('.cn-places');
 function setPanel(open){panelOpen=open;if(!open&&panel.contains(document.activeElement))toggle.focus();panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(addAction)root.hidden=!open&&!destination;if(open)renderChoices();}
 function renderChoices(){
  const previous=select.value,query=$('.cn-search').value.trim().toLocaleLowerCase();
  const matches=places.filter(p=>`${p.name} ${p.district??''}`.toLocaleLowerCase().includes(query)).map(p=>({p,d:navigationDistance(player,p)})).sort((a,b)=>a.d-b.d).slice(0,60);
  select.replaceChildren(...matches.map(({p,d})=>{const option=document.createElement('option');option.value=p.id;option.textContent=`${formatNavigationDistance(d)} · ${p.name}`;return option;}));
  if(matches.some(({p})=>String(p.id)===previous))select.value=previous;
  $('.cn-start').disabled=!matches.length;$('.cn-empty').hidden=!!matches.length;
 }
 function routeNext(){
  const state=getState()??{},next=state.mission?.next;
  if(next&&(!destination||next.id!==destination.id||!arrived)){setDestination(next);return;}
  notify('当前路线暂无下一站；可在主题路线中选择新的路线。');
 }
 function ownedLayers(){
  if(disposed||!map.isStyleLoaded?.())return;
  try{
   if(!map.getSource(id))map.addSource(id,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   if(!map.getLayer(traceId))map.addLayer({id:traceId,type:'line',source:id,filter:['==',['get','kind'],'trace'],paint:{'line-color':'#a8cfbb','line-width':3,'line-opacity':.7}});
   if(!map.getLayer(lineId))map.addLayer({id:lineId,type:'line',source:id,filter:['==',['get','kind'],'bearing'],paint:{'line-color':'#f6cf78','line-width':3,'line-dasharray':[2,3]}});
   if(!map.getLayer(pointId))map.addLayer({id:pointId,type:'circle',source:id,filter:['==',['get','kind'],'destination'],paint:{'circle-radius':9,'circle-color':'#f6cf78','circle-stroke-color':'#163431','circle-stroke-width':3}});
  }catch{/* The map may be replacing its style; retry on the next bounded update. */}
 }
 function renderMap(){
  ownedLayers();const source=map.getSource(id);if(!source)return;
  const features=[];
  if(destination&&validPosition(player)){
   features.push({type:'Feature',properties:{kind:'bearing'},geometry:{type:'LineString',coordinates:[[player.lon,player.lat],[destination.lon,destination.lat]]}},{type:'Feature',properties:{kind:'destination'},geometry:{type:'Point',coordinates:[destination.lon,destination.lat]}});
   if(breadcrumbs.length>1)features.push({type:'Feature',properties:{kind:'trace'},geometry:{type:'LineString',coordinates:breadcrumbs.map(p=>[p.lon,p.lat])}});
  }
  source.setData({type:'FeatureCollection',features});
 }
 function renderGuidance(){
  if(!destination)return;
  const snapshot=navigationSnapshot(player,destination,map.getBearing());
  $('.cn-target').textContent=destination.name;
  $('.cn-distance').textContent=`${formatNavigationDistance(snapshot.distance)} 直线距离`;
  $('.cn-summary').textContent=`${formatNavigationDistance(snapshot.distance)} · ${destination.name}`;
  $('.cn-arrow').style.transform=`rotate(${snapshot.relative}deg)`;
  $('.cn-north').style.transform=`rotate(${-map.getBearing()}deg)`;
  $('.cn-heading').textContent=snapshot.bearing===null?'已在目标位置':`${compassLabel(snapshot.bearing)} · ${Math.round(snapshot.bearing)}°（相对正北）`;
  const firstArrival=snapshot.arrived&&!arrived;
  // Arrival is latched until a new target is chosen: hovering around the boundary never repeats feedback.
  if(firstArrival){arrived=true;root.classList.add('cn-arrived');notify(`已接近 ${destination.name} · 目标点 ${snapshot.radius} 米内`);}
  $('.cn-progress').textContent=arrived?'已抵达目标附近 · 看看周围，留下足迹。':`较出发时${snapshot.distance<=initialDistance?'接近':'远离'} ${formatNavigationDistance(Math.abs(initialDistance-snapshot.distance))} · 箭头相对画面上方`;
  $('.cn-next').hidden=!arrived;
 }
 function setDestination(place){
  if(disposed)return false;
  if(typeof place==='string')place=placesById.get(place);
  if(!validPosition(place))return false;
  destination={id:place.id,name:place.name??'所选地点',lon:place.lon,lat:place.lat,arrivalRadius:place.arrivalRadius};initialDistance=navigationDistance(player,destination);arrived=false;breadcrumbs=recordBreadcrumb([],player);root.classList.remove('cn-arrived');guidance.hidden=false;setPanel(false);renderGuidance();renderMap();return true;
 }
 function cancel(){destination=null;breadcrumbs=[];arrived=false;guidance.hidden=true;root.classList.remove('cn-arrived');$('.cn-summary').textContent='选择目的地';if(addAction)root.hidden=!panelOpen;renderMap();}
 toggle.onclick=()=>setPanel(!panelOpen);$('.cn-search').oninput=renderChoices;$('.cn-start').onclick=()=>setDestination(select.value);$('.cn-route').onclick=routeNext;$('.cn-next').onclick=routeNext;$('.cn-cancel').onclick=cancel;
 // Root owns global game events. Only consume panel keys through its dispatcher.
 function handleKey(key,event){if(disposed||event?.repeat)return false;if(String(key).toLowerCase()==='v'){setPanel(!panelOpen);event?.preventDefault();return true;}if(String(key).toLowerCase()==='escape'&&panelOpen){setPanel(false);return true;}return false;}
 function update(dt){if(disposed)return;elapsed+=Number.isFinite(dt)?Math.max(0,dt):0;if(elapsed<.2)return;elapsed=0;if(destination){breadcrumbs=recordBreadcrumb(breadcrumbs,player);renderGuidance();renderMap();}}
 const removeAction=addAction?.('步行指引','V',()=>setPanel(!panelOpen));if(addAction)root.hidden=true;
 const onStyle=()=>{if(destination)renderMap();};map.on('style.load',onStyle);
 return {update,handleKey,isOpen:()=>panelOpen,close:()=>setPanel(false),setDestination,getDestination:()=>destination?{...destination}:null,dispose(){if(disposed)return;disposed=true;removeAction?.();map.off('style.load',onStyle);for(const layer of [pointId,lineId,traceId])if(map.getLayer(layer))map.removeLayer(layer);if(map.getSource(id))map.removeSource(id);root.remove();stylesheet.remove();}};
}
