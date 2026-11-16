import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FRIEDENSENGEL as spec,buildFriedensengel,createFeature} from '../src/city_landmark_east.mjs';

// Only the injected engine/Three surface is doubled; no DOM, renderer or network required.
class Vector3 {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  clone(){return new Vector3(this.x,this.y,this.z);}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this;}
  length(){return Math.hypot(this.x,this.y,this.z);}
  normalize(){return this.multiplyScalar(1/this.length());}
  toArray(){return [this.x,this.y,this.z];}
}
class Group {
  constructor(){this.children=[];this.position=new Vector3();this.scale=new Vector3(1,1,1);this.rotation={x:0,y:0,z:0};this.userData={};}
  add(o){this.children.push(o);o.parent=this;}
  removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
  traverse(fn){fn(this);this.children.forEach(c=>c.traverse(fn));}
}
class Resource {constructor(...args){this.args=args;this.disposals=0;}dispose(){this.disposals++;}}
class Mesh extends Group {constructor(geometry,material){super();Object.assign(this,{geometry,material});this.quaternion={setFromUnitVectors(a,b){assert.ok([...a.toArray(),...b.toArray()].every(Number.isFinite));}};}}
class Shape {constructor(){this.points=[];}moveTo(x,y){this.points.push([x,y]);}lineTo(x,y){this.points.push([x,y]);}closePath(){this.closed=true;}}
const THREE={Group,Vector3,Mesh,Shape,MeshStandardMaterial:Resource,BoxGeometry:Resource,SphereGeometry:Resource,CylinderGeometry:Resource,ExtrudeGeometry:Resource};
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.listeners=new Map();this.classList={add:()=>{}};}
  appendChild(c){this.children.push(c);c.parent=this;return c;}
  addEventListener(k,fn){this.listeners.set(k,fn);}
  removeEventListener(k,fn){assert.equal(this.listeners.get(k),fn);this.listeners.delete(k);}
  remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
}
function fixture(options={}) {
  const ui=new Element('div'), scene=new Group();
  let modal=false,unsubscribed=0,detach=0,panelDisposed=0,open=false,disposeCallback,registration;
  const panel={body:new Element('section'),open(){open=true;modal=true;},close(){open=false;modal=false;},isOpen:()=>open,dispose(){panelDisposed++;open=false;}};
  const engine={THREE,document:{createElement:tag=>new Element(tag)},ui,
    player:{lon:spec.lon,lat:spec.lat},
    distance(a,b){return Math.hypot((a.lon-b.lon)*74500,(a.lat-b.lat)*111000);},
    isInputBlocked:()=>modal,getSettings:()=>({hints:true}),
    addGeoObject(args){registration=args;scene.add(args.group);return ()=>{detach++;args.group.removeFromParent();};},
    createPanel(id,args){assert.equal(id,'city-landmark-east');assert.equal(args.modal,true);assert.equal(args.key,undefined);return panel;},
    onDispose(fn){disposeCallback=fn;return ()=>{unsubscribed++;};},...options};
  return {engine,ui,scene,panel,block(value){modal=value;},get registration(){return registration;},
    hostDispose:()=>disposeCallback(),counts:()=>({unsubscribed,detach,panelDisposed})};
}

test('anchor agrees with existing research and published sources and photo credits are explicit',()=>{
  const pack=JSON.parse(readFileSync(new URL('../assets/city_research/session13.json',import.meta.url)));
  const existing=pack.places.find(p=>p.id==='session13-friedensengel');
  assert.equal(existing.lon,spec.lon);assert.equal(existing.lat,spec.lat);
  assert.equal(spec.columnHeight,23);assert.equal(spec.figureHeight,6);
  assert.ok(spec.architectureSource.startsWith('https://www.schloesser.bayern.de/'));
  assert.equal(spec.photoAuthor,'Tiia Monto');assert.equal(spec.photoLicense,'CC BY-SA 4.0');
});

test('builds finite 3D column, open hall, leafy capital, two extruded wings and attributes',()=>{
  const model=buildFriedensengel(THREE),objects=[];model.group.traverse(o=>objects.push(o));
  for(const name of ['column-shaft','capital-acanthus','hall-pier','caryatid-head','nike-head','olive-branch','palladion-head'])
    assert.ok(objects.some(o=>o.name===name),name);
  const wings=objects.filter(o=>o.name.startsWith('nike-wing-'));
  assert.equal(wings.length,2);
  for(const wing of wings){assert.equal(wing.geometry.args[0].closed,true);assert.ok(wing.geometry.args[1].depth>0);}
  const figure=objects.find(o=>o.name==='gilded-winged-nike');
  assert.equal(figure.position.y,32);assert.equal(figure.rotation.y,-Math.PI/2);
  assert.equal(Math.max(...wings.flatMap(w=>w.geometry.args[0].points.map(p=>p[1]))),6);
  for(const o of objects){
    assert.ok([...o.position.toArray(),...o.scale.toArray()].every(Number.isFinite),o.name);
    assert.ok(o.scale.toArray().every(n=>n>0));
    if(o.geometry)for(const arg of o.geometry.args)if(typeof arg==='number')assert.ok(arg>0&&Number.isFinite(arg));
  }
  assert.ok(objects.length<170,'bounded mesh budget');
  const resources=new Set(objects.flatMap(o=>[o.geometry,o.material]).filter(Boolean));
  model.dispose();model.dispose();
  assert.ok([...resources].every(r=>r.disposals===1),'shared resources disposed exactly once');
});

test('registers host geography and tile replacement without changing local origin',()=>{
  const f=fixture(),feature=createFeature(f.engine);
  assert.equal(f.registration.lon,spec.lon);assert.equal(f.registration.lat,spec.lat);
  assert.equal(f.registration.replaceBuildings,true);assert.equal(f.registration.minZoom,13);
  assert.deepEqual(f.registration.group.position.toArray(),[0,0,0]);
  assert.equal(f.scene.children.length,1);feature.dispose();assert.equal(f.scene.children.length,0);
});

test('E only consumes nearby, unblocked, non-repeated interactions',()=>{
  const f=fixture(),feature=createFeature(f.engine);
  assert.equal(feature.handleKey('p'),false);
  f.engine.player.lat+=.001;feature.update();
  assert.equal(feature.canInteract(),false);assert.equal(f.ui.children[0].hidden,true);
  assert.equal(feature.handleKey('e'),false);assert.equal(feature.observe(),false);
  f.engine.player.lat=spec.lat;
  f.block(true);assert.equal(feature.handleKey('e'),false);assert.equal(feature.observe(),false);
  f.block(false);assert.equal(feature.handleKey('e',{repeat:true}),false);
  feature.update();assert.equal(f.ui.children[0].hidden,false);
  assert.equal(feature.handleKey('e'),true);assert.equal(feature.isOpen(),true);
  assert.equal(f.ui.children[0].hidden,true);assert.equal(feature.handleKey('e'),false);
  f.panel.close();assert.equal(feature.handleKey('e'),true);feature.dispose();
});

test('radius boundary, invalid player/distance and hint preference are handled',()=>{
  let d=30;const f=fixture({distance:()=>d,getSettings:()=>({hints:false})}),feature=createFeature(f.engine);
  assert.equal(feature.canInteract(),true);assert.equal(f.ui.children[0].hidden,true);
  d=30.001;assert.equal(feature.canInteract(),false);
  d=NaN;assert.equal(feature.canInteract(),false);
  d=-1;assert.equal(feature.canInteract(),false);
  d=0;f.engine.player.lon=NaN;assert.equal(feature.canInteract(),false);
  feature.dispose();
});

test('touch prompt uses the same proximity and modal gate as E',()=>{
  const f=fixture(),feature=createFeature(f.engine),prompt=f.ui.children[0];
  const click=prompt.listeners.get('click');
  f.block(true);assert.equal(click(),false);
  f.block(false);assert.equal(click(),true);feature.dispose();assert.equal(prompt.listeners.size,0);
});

test('source panel exposes safe source/photo/license links and approximation warning',()=>{
  const f=fixture(),feature=createFeature(f.engine),els=f.panel.body.children;
  const links=els.filter(e=>e.tagName==='a');
  for(const url of [spec.architectureSource,spec.citySource,spec.coordinateSource,spec.photoPage,spec.licenseUrl])
    assert.ok(links.some(e=>e.href===url&&e.rel==='noopener noreferrer'&&e.target==='_blank'));
  assert.ok(els.some(e=>e.textContent.includes(spec.photoAuthor)));
  assert.ok(els.some(e=>e.textContent.includes('近似艺术模型')));
  feature.dispose();
});

test('host or direct disposal cleans scene, panel, prompt and registration exactly once',()=>{
  const f=fixture(),feature=createFeature(f.engine),resources=new Set();
  f.registration.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
  f.hostDispose();feature.dispose();
  assert.deepEqual(f.counts(),{unsubscribed:1,detach:1,panelDisposed:1});
  assert.equal(f.ui.children.length,0);assert.equal(f.scene.children.length,0);
  assert.ok([...resources].every(r=>r.disposals===1));
  assert.equal(feature.handleKey('e'),false);assert.equal(feature.isOpen(),false);feature.update();
});

test('panel setup failure rolls back geographic registration and geometry',()=>{
  const f=fixture({createPanel(){throw new Error('panel unavailable');}});
  assert.throws(()=>createFeature(f.engine),/panel unavailable/);
  assert.equal(f.counts().detach,1);assert.equal(f.scene.children.length,0);
  f.registration.group.traverse(o=>{if(o.geometry)assert.equal(o.geometry.disposals,1);if(o.material)assert.equal(o.material.disposals,1);});
});
