import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeature,readPhotoAlbum,writePhotoAlbum,nearestPhotoPlace,PHOTO_STORAGE_KEY,PHOTO_LIMITS} from '../src/city_photo.mjs';

const PNG='data:image/png;base64,b3JpZ2luYWw=';
const JPEG='data:image/jpeg;base64,dGh1bWI=';
function storage(initial=null) {
  let raw=initial;
  return {getItem:key=>{assert.equal(key,PHOTO_STORAGE_KEY);return raw;},setItem(key,value){assert.equal(key,PHOTO_STORAGE_KEY);if(this.fail)throw new Error('QuotaExceededError');raw=value;},get raw(){return raw;}};
}
function fixture(store=storage()) {
  const events=new Map(), downloads=[], canvases=[];
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();this.attributes={};this.classList={add(){}};}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=nodes;}
    remove() {this.removed=true;}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(key,fn){this.listeners.set(key,fn);}
    removeEventListener(key,fn){if(this.listeners.get(key)===fn)this.listeners.delete(key);}
    click(){if(this.tag==='a') downloads.push({href:this.href,download:this.download}); else this.listeners.get('click')?.();}
  }
  const doc={body:new Element('body'),createElement(tag){
    const el=new Element(tag);
    if(tag==='canvas') {el.getContext=()=>({fillRect(){},drawImage(source){assert.equal(source,canvas);}});el.toDataURL=()=>JPEG;canvases.push(el);}
    return el;
  }};
  const canvas={width:1600,height:900,toDataURL(type){assert.equal(type,'image/png');if(this.fail)throw new Error('SecurityError');assert.equal(map.rendering,true,'pixels read during render callback');return PNG;}};
  let open=false, cleanup, timerId=0;
  const timers=new Map();
  const panel={body:new Element('section'),open(){open=true;},close(){open=false;},toggle(){open=!open;},isOpen:()=>open,dispose(){this.disposed=true;}};
  const map={getCanvas:()=>canvas,getCenter:()=>({lng:11.58,lat:48.15}),getContainer:()=>({querySelector:()=>({textContent:'© OpenStreetMap contributors · © Test tiles'})}),
    on(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},off(type,fn){events.get(type)?.delete(fn);},
    triggerRepaint(){if(this.stall)return;this.rendering=true;for(const fn of [...(events.get('render')||[])]) fn();this.rendering=false;}};
  const notices=[];
  const engine={document:doc,window:{setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)},storage:store,map,
    player:{lon:0,lat:0},places:[{id:'lmu',name:'LMU',lon:11.5807,lat:48.1507}],getState:()=>({ready:true}),notify:message=>notices.push(message),
    createPanel(id,options){assert.equal(id,'city-photo');assert.equal(options.key,'l');return panel;},onDispose(fn){cleanup=fn;return ()=>{cleanup=null;};}};
  const feature=createFeature(engine);
  return {feature,engine,map,canvas,store,downloads,notices,panel,events,canvases,timers,cleanup:()=>cleanup?.()};
}

test('capture uses fresh rendered map pixels, image thumbnail, timestamp and nearest view-center tag',async()=>{
  const f=fixture();const result=await f.feature.capture();
  assert.equal(result.ok,true);assert.equal(result.saved,true);assert.ok(Number.isFinite(Date.parse(result.photo.timestamp)));
  assert.equal(result.photo.place.id,'lmu');assert.ok(result.photo.place.distance<100);
  assert.deepEqual(result.photo.center,{lon:11.58,lat:48.15});assert.equal(result.photo.width,1600);
  assert.equal(result.photo.thumbnail,JPEG);assert.equal(f.canvases[0].width,360);assert.equal(f.canvases[0].height,203);
  assert.match(result.photo.credits,/OpenStreetMap/);assert.equal(f.downloads.length,0,'capture never auto downloads');
  assert.equal(f.events.get('render').size,0);assert.equal(f.timers.size,0);
  assert.equal(f.feature.exportPhoto(result.photo.id),true);assert.equal(f.downloads[0].href,PNG);
  assert.match(f.downloads[0].download,/original.png$/);
  assert.equal(f.feature.exportPhoto(result.photo.id,'thumbnail'),true);assert.equal(f.downloads[1].href,JPEG);
  f.feature.dispose();
});

test('thumbnail album restores across refresh; originals are explicitly session-only',async()=>{
  const f=fixture();const {photo}=await f.feature.capture();f.feature.dispose();
  const next=fixture(f.store);assert.equal(next.feature.getPhotos().length,1);
  assert.equal(next.feature.exportPhoto(photo.id),false);assert.equal(next.feature.exportPhoto(photo.id,'thumbnail'),true);
  assert.equal(next.feature.handleKey('p'),false);assert.equal(next.feature.handleKey('l'),true);assert.equal(next.feature.isOpen(),true);
  next.feature.handleKey('l',{repeat:true});assert.equal(next.feature.isOpen(),true);
  next.feature.handleKey('l');assert.equal(next.feature.isOpen(),false);next.feature.dispose();
});

test('persistent album and full-resolution memory are bounded',async()=>{
  const f=fixture();const ids=[];
  for(let i=0;i<PHOTO_LIMITS.count+2;i++) ids.push((await f.feature.capture()).photo.id);
  const stored=readPhotoAlbum(f.store).photos;assert.equal(stored.length,PHOTO_LIMITS.count);
  assert.equal(stored[0].id,ids.at(-1));assert.equal(stored.at(-1).id,ids[2]);
  assert.ok(!f.store.raw.includes(PNG),'originals never enter localStorage');assert.ok(f.store.raw.length<PHOTO_LIMITS.albumChars);
  assert.equal(f.feature.exportPhoto(ids.at(-4)),false);assert.equal(f.feature.exportPhoto(ids.at(-3)),true);
  f.feature.dispose();
});

test('capture security failure and thumbnail failure preserve every existing save',async()=>{
  const f=fixture();await f.feature.capture();const before=f.store.raw;
  f.canvas.fail=true;assert.equal((await f.feature.capture()).ok,false);
  assert.equal(f.store.raw,before);assert.equal(f.feature.getPhotos().length,1);
  f.canvas.fail=false;const create=f.engine.document.createElement;
  f.engine.document.createElement=tag=>{const el=create(tag);if(tag==='canvas')el.toDataURL=()=> 'data:,';return el;};
  assert.equal((await f.feature.capture()).ok,false);assert.equal(f.store.raw,before);assert.equal(f.feature.getPhotos().length,1);f.feature.dispose();
});

test('quota failure retains old persistent album and makes new image manually exportable',async()=>{
  const f=fixture();const first=await f.feature.capture(), before=f.store.raw;f.store.fail=true;
  const second=await f.feature.capture();assert.equal(second.ok,true);assert.equal(second.saved,false);
  assert.equal(f.store.raw,before);assert.equal(readPhotoAlbum(f.store).photos[0].id,first.photo.id);
  assert.equal(f.feature.isOpen(),true);assert.equal(f.feature.exportPhoto(second.photo.id),true);
  assert.equal(f.feature.remove(first.photo.id),false);assert.equal(f.store.raw,before);
  f.canvas.fail=true;await f.feature.capture();assert.equal(f.feature.getPhotos()[0].id,second.photo.id);
  f.canvas.fail=false;f.store.fail=false;assert.equal((await f.feature.capture()).saved,true);
  assert.equal(f.feature.getPhotos().length,2);f.feature.dispose();
});

test('unavailable, malformed and oversized storage is never overwritten',async()=>{
  for(const store of [undefined,{getItem(){throw new Error('blocked');},setItem(){assert.fail('must not write');}},storage('{broken'),storage('x'.repeat(PHOTO_LIMITS.albumChars+1))]) {
    if(store===undefined) {assert.equal(readPhotoAlbum(store).writable,false);continue;}
    const f=fixture(store);const before=store.raw;
    const result=await f.feature.capture();assert.equal(result.ok,true);assert.equal(result.saved,false);
    assert.equal(store.raw,before);assert.equal(f.feature.exportPhoto(result.photo.id),true);f.feature.dispose();
  }
});

test('render timeout, readiness, overlapping requests, and disposal clean up without writes',async()=>{
  const f=fixture();f.engine.getState=()=>({ready:false});assert.equal((await f.feature.capture()).reason,'not-ready');
  f.engine.getState=()=>({ready:true});f.map.stall=true;
  const first=f.feature.capture();assert.equal((await f.feature.capture()).reason,'busy');
  [...f.timers.values()][0]();assert.equal((await first).ok,false);assert.equal(f.events.get('render').size,0);
  const pending=f.feature.capture();f.cleanup();assert.equal((await pending).reason,'disposed');
  assert.equal(f.events.get('render').size,0);assert.equal(f.timers.size,0);assert.equal(f.store.raw,null);assert.equal(f.panel.disposed,true);
  assert.equal(f.feature.handleKey('l'),false);assert.equal((await f.feature.capture()).reason,'disposed');f.feature.dispose();
});

test('delete commits before visible changes and malformed photo records are rejected',async()=>{
  const f=fixture();const {photo}=await f.feature.capture();
  const copy=f.feature.getPhotos();copy[0].center.lon=0;assert.equal(f.feature.getPhotos()[0].center.lon,11.58);
  assert.equal(f.feature.remove(photo.id),true);assert.equal(readPhotoAlbum(f.store).photos.length,0);
  assert.equal(f.feature.exportPhoto(photo.id),false);
  for(const malformed of [{...photo,thumbnail:'javascript:alert(1)'},{...photo,timestamp:'bad'},{...photo,center:{lon:999,lat:48}},{...photo,thumbnail:JPEG+'a'.repeat(PHOTO_LIMITS.thumbnailChars)}]) {
    assert.equal(writePhotoAlbum(f.store,[malformed]),false);
    assert.equal(readPhotoAlbum(storage(JSON.stringify({version:1,photos:[malformed]}))).writable,false);
  }
  f.feature.dispose();
});

test('nearest place handles missing catalog, invalid coordinates and injected distance',()=>{
  assert.equal(nearestPhotoPlace({lon:0,lat:0}),null);assert.equal(nearestPhotoPlace({lon:NaN,lat:0}),null);
  const places=[{id:'bad',lon:Infinity,lat:0},{id:'a',name:'A',lon:0,lat:0},{id:'b',name:'B',lon:1,lat:1}];
  assert.equal(nearestPhotoPlace({lon:0,lat:0},places).id,'a');
  assert.equal(nearestPhotoPlace({lon:0,lat:0},places,(_p,p)=>p.id==='b'?5:100).id,'b');
});
