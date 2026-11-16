// Persist only bounded thumbnails. Full-resolution originals stay in memory.
export const PHOTO_STORAGE_KEY = 'munich-city-photo-album-v1';
export const PHOTO_LIMITS = Object.freeze({count:12, thumbnailEdge:360, thumbnailChars:120000, albumChars:1500000, originals:3});
const IMAGE = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const validPoint = p => p && Number.isFinite(p.lon) && Math.abs(p.lon)<=180 && Number.isFinite(p.lat) && Math.abs(p.lat)<=90;
const clip = (text, size=240) => String(text ?? '').slice(0,size);

export function nearestPhotoPlace(point, places=[], distance) {
  if (!validPoint(point)) return null;
  let nearest=null, best=Infinity;
  for (const place of places) {
    if (!validPoint(place)) continue;
    let metres;
    if (distance) metres=distance(point,place);
    else {
      const radians=Math.PI/180, dlat=(place.lat-point.lat)*radians, dlon=(place.lon-point.lon)*radians;
      const a=Math.sin(dlat/2)**2+Math.cos(point.lat*radians)*Math.cos(place.lat*radians)*Math.sin(dlon/2)**2;
      metres=6371000*2*Math.asin(Math.sqrt(Math.min(1,a)));
    }
    if (Number.isFinite(metres) && metres>=0 && metres<best) {
      best=metres; nearest={id:clip(place.id,120),name:clip(place.name),distance:Math.round(metres)};
    }
  }
  return nearest;
}

function validPhoto(p) {
  return p && typeof p.id==='string' && p.id.length<=100 && typeof p.timestamp==='string' &&
    Number.isFinite(Date.parse(p.timestamp)) && validPoint(p.center) &&
    typeof p.thumbnail==='string' && p.thumbnail.length<=PHOTO_LIMITS.thumbnailChars && IMAGE.test(p.thumbnail) &&
    Number.isInteger(p.width) && p.width>0 && Number.isInteger(p.height) && p.height>0 &&
    typeof p.credits==='string' && p.credits.length<=2000 &&
    (p.place===null || (p.place && typeof p.place.id==='string' && p.place.id.length<=120 &&
      typeof p.place.name==='string' && p.place.name.length<=240 && Number.isFinite(p.place.distance) && p.place.distance>=0));
}

export function readPhotoAlbum(storage) {
  try {
    if (!storage) return {photos:[],writable:false,error:'storage-unavailable'};
    const raw=storage.getItem(PHOTO_STORAGE_KEY);
    if (raw===null) return {photos:[],writable:true,error:null};
    if (typeof raw!=='string' || raw.length>PHOTO_LIMITS.albumChars) throw new Error('Invalid album');
    const data=JSON.parse(raw);
    if (data?.version!==1 || !Array.isArray(data.photos) || data.photos.length>PHOTO_LIMITS.count ||
        !data.photos.every(validPhoto) || new Set(data.photos.map(p=>p.id)).size!==data.photos.length) throw new Error('Invalid album');
    return {photos:data.photos,writable:true,error:null};
  } catch { return {photos:[],writable:false,error:'storage-unreadable'}; }
}

// Commit in one localStorage write before changing the visible album. A failed
// write must never replace or remove any previous persisted photo.
export function writePhotoAlbum(storage, photos) {
  try {
    if (!storage || photos.length>PHOTO_LIMITS.count || !photos.every(validPhoto)) return false;
    const raw=JSON.stringify({version:1,photos});
    if (raw.length>PHOTO_LIMITS.albumChars) return false;
    storage.setItem(PHOTO_STORAGE_KEY,raw);
    return true;
  } catch { return false; }
}

export function createFeature(engine) {
  const doc=engine.document, win=engine.window;
  const panel=engine.createPanel('city-photo',{title:'城市相册',key:'l'});
  panel.body.classList.add('city-photo');
  const restored=readPhotoAlbum(engine.storage);
  let photos=restored.photos, writable=restored.writable, unsaved=null, busy=false, disposed=false, cancelFrame=null, serial=0;
  const originals=new Map(), listeners=[];
  const note=doc.createElement('p'), gallery=doc.createElement('div');
  gallery.className='city-photo-gallery'; gallery.setAttribute('aria-label','城市照片');
  note.className='city-photo-note'; note.setAttribute('role','status'); note.setAttribute('aria-live','polite');
  note.textContent=restored.error?'相册存储不可用；已有数据不会被覆盖。拍摄后仍可手动导出。':'最多保存 12 张缩略图；刷新后恢复。最近 3 张原图仅在本次会话可导出。';
  const captureButton=button('拍摄当前地图 · P',()=>void capture());
  const help=doc.createElement('p'); help.className='city-photo-help';
  help.textContent='地点标签取画面中心最近的目录地点，并非实际到访记录。原图不含界面控件；分享时请一并保留照片下方的地图署名。';
  panel.body.append(captureButton,note,help,gallery);

  function button(label, fn) {
    const el=doc.createElement('button'); el.type='button'; el.textContent=label;
    el.addEventListener('click',fn); listeners.push([el,fn]); return el;
  }
  function announce(message) { if (disposed) return; note.textContent=message; engine.notify?.(message); }
  function download(data, filename) {
    try {
      const a=doc.createElement('a'); a.href=data; a.download=filename;
      doc.body.append(a); a.click(); a.remove(); return true;
    } catch { announce('导出未完成，请检查浏览器下载权限。'); return false; }
  }
  function exportPhoto(id, kind='original') {
    const photo=unsaved?.id===id?unsaved:photos.find(p=>p.id===id);
    if (!photo || disposed) return false;
    const data=kind==='thumbnail'?photo.thumbnail:kind==='original'?originals.get(id):null;
    if (!data) { announce('此原图已不在本次会话中；可导出已保存的缩略图。'); return false; }
    const stamp=photo.timestamp.replace(/[:.]/g,'-');
    return download(data,`munich-${stamp}-${kind==='thumbnail'?'thumbnail.jpg':'original.png'}`);
  }
  function render() {
    // Release handlers for cards replaced on every update; retain only the
    // permanent capture button listener.
    for (const [el,fn] of listeners.splice(1)) el.removeEventListener('click',fn);
    gallery.replaceChildren();
    const entries=unsaved?[unsaved,...photos]:photos;
    if (!entries.length) {
      const empty=doc.createElement('p'); empty.textContent='还没有照片。拍下正在探索的街道吧。'; gallery.append(empty); return;
    }
    for (const photo of entries) {
      const card=doc.createElement('article'); card.className='city-photo-card';
      const image=doc.createElement('img'); image.src=photo.thumbnail; image.alt=photo.place?`地图照片 · ${photo.place.name}`:'城市地图照片'; image.loading='lazy';
      const time=doc.createElement('time'); time.dateTime=photo.timestamp; time.textContent=new Date(photo.timestamp).toLocaleString();
      const tag=doc.createElement('p'); tag.textContent=photo.place?`最近地点：${photo.place.name} · 约 ${photo.place.distance} 米`:'附近暂无目录地点';
      const position=doc.createElement('small'); position.textContent=`画面中心 ${photo.center.lat.toFixed(5)}, ${photo.center.lon.toFixed(5)} · ${photo.width} × ${photo.height}`;
      const credits=doc.createElement('p'); credits.className='city-photo-credits'; credits.textContent=photo.credits;
      const state=doc.createElement('small'); state.textContent=photo===unsaved?'未保存：请先导出。下次成功拍摄会替换此临时照片。':'缩略图已保存到本机';
      const actions=doc.createElement('div'); actions.className='city-photo-actions';
      const original=button('导出原图 PNG',()=>exportPhoto(photo.id,'original'));
      original.disabled=!originals.has(photo.id); original.title=original.disabled?'刷新后原图不可恢复；仅最近 3 张原图保留在内存中。':'导出本次会话原始地图截图';
      actions.append(original,button('导出缩略图 JPG',()=>exportPhoto(photo.id,'thumbnail')),button('删除',()=>remove(photo.id)));
      card.append(image,time,tag,position,credits,state,actions); gallery.append(card);
    }
  }
  function remove(id) {
    if (disposed) return false;
    if (unsaved?.id===id) { unsaved=null; originals.delete(id); render(); return true; }
    const next=photos.filter(p=>p.id!==id);
    if (next.length===photos.length) return false;
    if (!writable || !writePhotoAlbum(engine.storage,next)) { announce('删除未保存；原有照片保持不变。'); return false; }
    photos=next; originals.delete(id); render(); announce('照片已删除。'); return true;
  }
  function creditsText() {
    const attribution=engine.map.getContainer?.()?.querySelector?.('.maplibregl-ctrl-attrib-inner')?.textContent;
    return clip(attribution?.trim() || '地图署名请见主地图右下角（MapLibre / 地图数据提供方）。分享照片时请保留相应署名。',2000);
  }
  function snapshot() {
    const source=engine.map.getCanvas();
    if (!source?.width || !source?.height) throw new Error('Empty canvas');
    const original=source.toDataURL('image/png');
    if (!IMAGE.test(original) || !original.startsWith('data:image/png;')) throw new Error('Invalid image');
    const thumb=doc.createElement('canvas');
    const scale=Math.min(1,PHOTO_LIMITS.thumbnailEdge/Math.max(source.width,source.height));
    thumb.width=Math.max(1,Math.round(source.width*scale)); thumb.height=Math.max(1,Math.round(source.height*scale));
    const ctx=thumb.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle='#f4efe5'; ctx.fillRect(0,0,thumb.width,thumb.height); ctx.drawImage(source,0,0,thumb.width,thumb.height);
    const thumbnail=thumb.toDataURL('image/jpeg',.72);
    if (!thumbnail.startsWith('data:image/jpeg;') || !IMAGE.test(thumbnail) || thumbnail.length>PHOTO_LIMITS.thumbnailChars) throw new Error('Thumbnail unavailable');
    const mapCenter=engine.map.getCenter?.();
    const center=mapCenter?{lon:mapCenter.lng,lat:mapCenter.lat}:{lon:engine.player.lon,lat:engine.player.lat};
    if (!validPoint(center)) throw new Error('Invalid center');
    const timestamp=new Date().toISOString();
    const photo={id:`${timestamp}-${++serial}`,timestamp,center,place:nearestPhotoPlace(center,engine.places,engine.distance),
      width:source.width,height:source.height,thumbnail,credits:creditsText()};
    return {photo,original};
  }
  function afterRender() {
    return new Promise((resolve,reject)=>{
      let done=false, timer;
      const cleanup=()=>{ engine.map.off('render',onRender); win.clearTimeout(timer); cancelFrame=null; };
      const finish=(error,value)=>{ if(done)return; done=true; cleanup(); error?reject(error):resolve(value); };
      const onRender=()=>{ try { finish(null,snapshot()); } catch(error) { finish(error); } };
      cancelFrame=()=>finish(new Error('Capture cancelled'));
      timer=win.setTimeout(()=>finish(new Error('Map did not render')),4000);
      try { engine.map.on('render',onRender); engine.map.triggerRepaint(); }
      catch(error) { finish(error); }
    });
  }
  async function capture() {
    if (disposed || busy) return {ok:false,reason:disposed?'disposed':'busy'};
    if (engine.getState?.().ready===false) { announce('地图尚未准备好，请稍后拍摄。'); return {ok:false,reason:'not-ready'}; }
    busy=true; captureButton.disabled=true;
    try {
      // Read pixels inside the render callback: non-preserved WebGL buffers
      // may already be cleared by a later frame or promise continuation.
      const {photo,original}=await afterRender();
      if (disposed) return {ok:false,reason:'disposed'};
      const next=[photo,...photos].slice(0,PHOTO_LIMITS.count);
      const saved=writable && writePhotoAlbum(engine.storage,next);
      if (unsaved) originals.delete(unsaved.id);
      unsaved=saved?null:photo;
      if (saved) photos=next;
      originals.set(photo.id,original);
      for (const id of originals.keys()) if (!photos.some(p=>p.id===id) && id!==unsaved?.id) originals.delete(id);
      while (originals.size>PHOTO_LIMITS.originals) originals.delete(originals.keys().next().value);
      render();
      announce(saved?'照片缩略图已保存。打开相册 L 可手动导出原图。':'照片已拍摄，但存储不可用或已满。请在相册导出；已有保存保持不变。');
      if (!saved) panel.open();
      return {ok:true,saved,photo:{...photo,center:{...photo.center},place:photo.place?{...photo.place}:null}};
    } catch { if (!disposed) announce('拍摄失败（地图未刷新、画布受限或内存不足）。已有照片保持不变。'); return {ok:false,reason:disposed?'disposed':'capture-failed'}; }
    finally { busy=false; captureButton.disabled=false; }
  }
  let unregister;
  function dispose() {
    if (disposed) return; disposed=true; cancelFrame?.();
    for (const [el,fn] of listeners) el.removeEventListener('click',fn);
    listeners.length=0; originals.clear(); photos=[]; unsaved=null; panel.dispose(); unregister?.();
  }
  render(); unregister=engine.onDispose?.(dispose);
  return {capture,exportPhoto,remove,isOpen:()=>panel.isOpen(),
    handleKey(key,event) { if (disposed || key!=='l') return false; if (!event?.repeat) panel.toggle(); return true; },
    getPhotos:()=>JSON.parse(JSON.stringify(unsaved?[unsaved,...photos]:photos)),dispose};
}
