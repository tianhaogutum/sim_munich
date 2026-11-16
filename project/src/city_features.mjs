import {normalizeSettings,DEFAULT_SETTINGS} from './city_settings.mjs';

export function containsAnchor(feature, lon, lat) {
 const inside=ring=>{
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const a=ring[i],b=ring[j];
   if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
 };
 const polygons=feature.geometry?.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry?.type==='MultiPolygon'?feature.geometry.coordinates:[];
 return polygons.some(r=>r[0]?.length&&inside(r[0])&&!r.slice(1).some(inside));
}

// All ten features share one WebGL renderer, modal/input owner and coordinate frame.
export function createCityEngine(base,host) {
 const {document:doc,window:win,map,cast,THREE}=base;
 const root=doc.createElement('div');root.className='city-features';base.ui.append(root);
 const toolbar=doc.createElement('nav');toolbar.className='city-feature-toolbar';toolbar.setAttribute('aria-label','城市功能');root.append(toolbar);
 const cleanups=new Set(),settingsListeners=new Set(),geoObjects=new Set(),panels=new Set();
 const input={right:0,forward:0,run:false,lookX:0,lookY:0};
 let settings={...DEFAULT_SETTINGS},disposed=false,audio;
 const clearInput=()=>{base.clearInput();Object.assign(input,{right:0,forward:0,run:false,lookX:0,lookY:0});};
 let suppression=null,baseFilter=null;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function refreshReplacements(){
  if(disposed||!map.getLayer('building-3d')||!map.getSource('openmaptiles'))return;
  const features=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});
  let changed=false;
  for(const entry of geoObjects)if(entry.replaceBuildings){
   for(const feature of features)if(feature.id!==undefined&&entry.anchors.some(a=>containsAnchor(feature,a.lon,a.lat))&&!entry.ids.has(feature.id)){
    entry.ids.add(feature.id);changed=true;
   }
  }
  if(!changed)return;
  const current=map.getFilter('building-3d');
  if(!suppression||!same(current,suppression))baseFilter=current;
  const ids=[...new Set([...geoObjects].flatMap(e=>[...e.ids]))];
  const exclude=['!', ['in',['id'],['literal',ids]]];
  suppression=baseFilter?['all',baseFilter,exclude]:exclude;
  map.setFilter('building-3d',suppression);
 }
 map.on('idle',refreshReplacements);
 function updateGeo(anchor,units){
  const mercator=base.MercatorCoordinate,view=map.getCenter(),zoom=map.getZoom();
  const center=mercator.fromLngLat([view.lng,view.lat]);
  for(const item of geoObjects){
   const p=item.mercator;
   // Scale model metres at its latitude into the same player-anchored scene.
   const scale=p.meterInMercatorCoordinateUnits()/units;
   item.group.position.set((p.x-anchor.x)/units,0,(p.y-anchor.y)/units);
   item.group.scale.setScalar(scale);
   item.group.visible=zoom>=item.minZoom&&Math.hypot(p.x-center.x,p.y-center.y)/units<item.maxDistance*(settings.quality==='low'?.65:1);
  }
 }
 const engine={...base,ui:root,metrics:{frameMs:0,collisionMs:0},now:()=>win.performance.now(),
  storage:(()=>{try{return win.localStorage;}catch{return null;}})(),
  getSettings:()=>({...settings}),
  setSettings(patch){
   settings=normalizeSettings({...settings,...patch});
   root.dataset.quality=settings.quality;
   doc.documentElement.classList.toggle('city-reduced-motion',settings.reducedMotion);
   base.ui.classList.toggle('city-hide-hints',!settings.hints);
   cast.setReducedMotion?.(settings.reducedMotion);
   for(const fn of settingsListeners)fn({...settings});
   map.triggerRepaint();return {...settings};
  },
  onSettings(fn){settingsListeners.add(fn);return ()=>settingsListeners.delete(fn);},
  setInput(value){for(const key of ['right','forward','lookX','lookY'])input[key]=Number.isFinite(value[key])?Math.max(-1,Math.min(1,value[key])):0;input.run=!!value.run;},
  input,clearInput,isInputBlocked:()=>disposed||host.isInputBlocked(),
  closePanels:()=>host.closePanels(),
  interact(){if(!engine.isInputBlocked())host.handleKey('e',{repeat:false,preventDefault(){}});},
  onDispose(fn){cleanups.add(fn);return ()=>cleanups.delete(fn);},
  createPanel(id,{title,key,modal=true}={}){
   const panel=doc.createElement('section');panel.className='city-feature-panel';panel.id=id;panel.hidden=true;
   panel.setAttribute('role',modal?'dialog':'region');if(modal)panel.setAttribute('aria-modal','true');
   panel.setAttribute('aria-label',title??id);panel.tabIndex=-1;
   const heading=doc.createElement('h2');heading.textContent=title??id;
   const close=doc.createElement('button');close.type='button';close.textContent='关闭 ×';close.className='city-panel-close';
   const body=doc.createElement('div');body.className='city-feature-panel-body';panel.append(heading,close,body);root.append(panel);
   const button=doc.createElement('button');button.type='button';button.textContent=title+(key?` ${key.toUpperCase()}`:'');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id);toolbar.append(button);
   let lastFocus,dead=false;
   const api={root:panel,body,button,
    open(){if(dead)return;host.closePanels();base.closeAtlas?.();clearInput();lastFocus=doc.activeElement;panel.hidden=false;button.setAttribute('aria-expanded','true');panel.focus();},
    close(){if(dead)return;panel.hidden=true;button.setAttribute('aria-expanded','false');if(panel.contains(doc.activeElement))doc.activeElement.blur();clearInput();},
    toggle(){if(panel.hidden)api.open();else api.close();},isOpen:()=>!dead&&!panel.hidden,
    handleKey(k,event){if(dead)return false;if(k==='escape'&&api.isOpen()){api.close();lastFocus?.focus?.();return true;}if(key&&k===key&&!event?.repeat){api.toggle();return true;}return false;},
    dispose(){if(dead)return;api.close();dead=true;unregister();panel.remove();button.remove();panels.delete(api);},
   };
   const unregister=host.registerPanel(api);panels.add(api);button.onclick=()=>api.toggle();close.onclick=()=>api.close();
   panel.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const focusable=[...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===panel)){last?.focus();e.preventDefault();}
    else if(!e.shiftKey&&doc.activeElement===last){first?.focus();e.preventDefault();}
   });return api;
  },
  addGeoObject({group,lon,lat,minZoom=13,maxDistance=6000,replaceBuildings=false,replacementOffsets=[]}){
   if(!group||!Number.isFinite(lon)||!Number.isFinite(lat))throw new TypeError('Invalid geographic model');
   const entry={group,lon,lat,minZoom,maxDistance,replaceBuildings,mercator:base.MercatorCoordinate.fromLngLat([lon,lat]),ids:new Set()};
   entry.anchors=[{lon,lat},...replacementOffsets.map(([x,z])=>{const m=entry.mercator,u=m.meterInMercatorCoordinateUnits();const ll=new base.MercatorCoordinate(m.x+x*u,m.y+z*u,m.z).toLngLat();return {lon:ll.lng,lat:ll.lat};})];
   group.visible=false;geoObjects.add(entry);cast.scene.add(group);refreshReplacements();
   return ()=>{geoObjects.delete(entry);group.removeFromParent();};
  },
  updateGeo,
  notify(text){base.notify(text);if(settings.sound){
   try{audio??=new(win.AudioContext||win.webkitAudioContext)();if(audio.state==='suspended')void audio.resume();
    const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.frequency.value=660;gain.gain.setValueAtTime(.025,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.09);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   }catch{/* Audio is optional. */}
  }},
  dispose(){
   if(disposed)return;disposed=true;clearInput();
   for(const cleanup of [...cleanups].reverse())try{cleanup();}catch(error){console.warn('City feature cleanup',error);}
   cleanups.clear();for(const panel of [...panels])panel.dispose();
   map.off('idle',refreshReplacements);
   if(suppression&&map.getLayer('building-3d')&&same(map.getFilter('building-3d'),suppression))map.setFilter('building-3d',baseFilter??null);
   for(const item of geoObjects)item.group.removeFromParent();geoObjects.clear();settingsListeners.clear();
   cast.setBeforeRender?.(null);audio?.close().catch(()=>{});root.remove();
   doc.documentElement.classList.remove('city-reduced-motion');base.ui.classList.remove('city-hide-hints');
  },
 };
 cast.setBeforeRender?.(updateGeo);
 return engine;
}
