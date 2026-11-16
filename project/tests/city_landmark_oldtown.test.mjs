import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeature, planOldtownLandmark, oldtownDetailLevel, OLDTOWN_LANDMARK as landmark, OLDTOWN_SOURCES as sources} from '../src/city_landmark_oldtown.mjs';

test('geographic building anchor and sources are accessible, qualified, and separate from arrival',()=>{
  assert.ok(Math.abs(landmark.lon-11.573617)<.000001);
  assert.ok(Math.abs(landmark.lat-48.138578)<.000001);
  assert.match(landmark.accuracy,/approximate/i);
  assert.notEqual(landmark.lon,11.5731);
  assert.ok(sources.every(s=>s.url.startsWith('https://')&&s.credit));
  assert.ok(sources.some(s=>s.credit.includes('Adam Jones')&&s.credit.includes('CC BY-SA 3.0')));
  assert.ok(sources.some(s=>s.credit.includes('Dörrbecker')&&s.credit.includes('CC BY-SA 2.5')));
});

test('recognizable west twin towers retain silhouette at every detail level',()=>{
  const parts=planOldtownLandmark();
  const towers=parts.filter(p=>p.name==='tower-shaft'),domes=parts.filter(p=>p.name==='tower-dome');
  assert.equal(towers.length,2);assert.equal(domes.length,2);
  assert.equal(towers[0].position[0],towers[1].position[0]);
  assert.equal(towers[0].position[2],-towers[1].position[2]);
  assert.ok([...towers,...domes].every(p=>p.level===0&&p.position[0]<0));
  assert.ok(parts.some(p=>p.name==='nave-roof'&&p.level===0));
  assert.ok(parts.some(p=>p.name==='choir'&&p.position[0]>0));
  assert.ok(parts.some(p=>p.name==='clock-face'&&p.level===2));
  for(const p of parts){assert.ok(p.position.every(Number.isFinite));assert.ok(p.rotation.every(Number.isFinite));assert.ok(p.size.every(n=>n>0&&Number.isFinite(n)));}
  assert.ok(parts.length<350);
  parts[0].position[0]=10000;assert.notEqual(planOldtownLandmark()[0].position[0],10000);
});

test('quality and distance progressively reduce work while keeping silhouette',()=>{
  assert.equal(oldtownDetailLevel(100,'medium'),2);
  assert.equal(oldtownDetailLevel(600,'medium'),1);
  assert.equal(oldtownDetailLevel(600,'high'),2);
  assert.equal(oldtownDetailLevel(100,'low'),1);
  assert.equal(oldtownDetailLevel(600,'low'),0);
  for(const distance of [1800,6000,Infinity,NaN,-1])assert.equal(oldtownDetailLevel(distance),0);
});

function harness({failAttach=false,dom=true}={}){
  const resources=[],calls=[],panels=[];
  class Vec {set(...values){this.values=values;return this;}}
  class Obj {
    constructor(){this.position=new Vec();this.rotation=new Vec();this.scale=new Vec();this.children=[];this.visible=true;}
    add(child){this.children.push(child);}
    clear(){this.children=[];}
    removeFromParent(){}
    updateMatrix(){this.matrix={position:[...this.position.values],rotation:[...this.rotation.values],scale:[...this.scale.values]};}
  }
  class Resource {
    constructor(){this.disposals=0;resources.push(this);}
    dispose(){this.disposals++;}
    setAttribute(name,value){this[name]=value;}
    setIndex(value){this.index=value;}
    computeVertexNormals(){}
    translate(){}
  }
  class Mesh extends Obj {
    constructor(geometry,material,count){super();Object.assign(this,{geometry,material,count,instanceMatrix:{},instances:[],disposals:0});resources.push(this);}
    dispose(){this.disposals++;}
    setMatrixAt(i,matrix){this.instances[i]=matrix;}
    computeBoundingSphere(){this.bounded=true;}
  }
  class Shape {moveTo(){} lineTo(){} quadraticCurveTo(){} closePath(){}}
  const THREE={Group:Obj,Object3D:Obj,BoxGeometry:Resource,BufferGeometry:Resource,CylinderGeometry:Resource,LatheGeometry:Resource,ExtrudeGeometry:Resource,Shape,Vector2:Vec,Float32BufferAttribute:class {constructor(array){this.array=array;}},MeshLambertMaterial:Resource,InstancedMesh:Mesh};
  let detachments=0,unsubscribes=0,unregistrations=0,lifetime,settingsListener,distance=50,quality='medium';
  const engine={THREE,player:{lon:11.57,lat:48.14},distance:()=>distance,getSettings:()=>({quality}),
    addGeoObject(options){calls.push(options);if(failAttach)throw Error('attach failed');return()=>detachments++;},
    onSettings(fn){settingsListener=fn;return()=>unsubscribes++;},onDispose(fn){lifetime=fn;return()=>unregistrations++;}};
  if(dom){
    engine.document={createElement(tag){return {tag,children:[],appendChild(child){this.children.push(child);}};}};
    engine.createPanel=(id,options)=>{const panel={id,options,body:engine.document.createElement('div'),opened:false,disposals:0,open(){this.opened=true;},isOpen(){return this.opened;},dispose(){this.disposals++;}};panels.push(panel);return panel;};
  }
  return {engine,resources,calls,panels,setDistance(d){distance=d;},setQuality(q){quality=q;settingsListener();},shutdown(){lifetime();},get counts(){return {detachments,unsubscribes,unregistrations};}};
}

test('one host-managed anchor with tile replacement, instanced meshes and live LOD',()=>{
  const h=harness(),feature=createFeature(h.engine);
  assert.deepEqual(h.calls,[{group:feature.group,lon:landmark.lon,lat:landmark.lat,minZoom:13,maxDistance:6000,replaceBuildings:true}]);
  assert.equal(feature.group.position.values,undefined,'host owns translation');
  const model=feature.group.children[0],levels=model.children,meshes=levels.flatMap(g=>g.children);
  assert.equal(model.rotation.y,landmark.orientation);
  assert.ok(meshes.length<32);
  assert.equal(meshes.reduce((n,m)=>n+m.count,0),planOldtownLandmark().length);
  assert.ok(meshes.every(m=>m.bounded&&m.instanceMatrix.needsUpdate&&m.instances.length===m.count));
  assert.equal(levels[2].visible,true);
  h.setDistance(800);feature.update(.016);assert.equal(levels[1].visible,true);assert.equal(levels[2].visible,false);
  h.setQuality('low');assert.equal(levels[1].visible,false);assert.equal(levels[0].visible,true);
  feature.dispose();h.shutdown();feature.dispose();feature.update(.016);
  assert.deepEqual(h.counts,{detachments:1,unsubscribes:1,unregistrations:1});
  assert.ok(h.resources.every(r=>r.disposals===1));assert.equal(feature.group.children.length,0);
});

test('managed source panel exposes credits safely and claims no key',()=>{
  const h=harness(),feature=createFeature(h.engine),panel=h.panels[0];
  assert.equal(panel.options.key,undefined);assert.equal(panel.options.modal,true);assert.equal(feature.handleKey,undefined);
  assert.equal(feature.isOpen(),false);feature.openSources();assert.equal(feature.isOpen(),true);
  const elements=[];function visit(el){elements.push(el);el.children.forEach(visit);}visit(panel.body);
  assert.equal(elements.filter(el=>el.tag==='a').length,sources.length);
  assert.ok(elements.filter(el=>el.tag==='a').every(el=>el.rel==='noopener noreferrer'));
  assert.ok(elements.some(el=>el.textContent?.includes('not surveyed')));
  assert.ok(elements.some(el=>el.textContent?.includes('Adam Jones')));
  h.shutdown();assert.equal(panel.disposals,1);assert.equal(feature.isOpen(),false);
});

test('headless use works, failed registration releases every allocated GPU resource',()=>{
  const h=harness({dom:false}),feature=createFeature(h.engine);feature.openSources();assert.equal(feature.isOpen(),false);feature.dispose();
  const failed=harness({failAttach:true});assert.throws(()=>createFeature(failed.engine),/attach failed/);
  assert.ok(failed.resources.length>0&&failed.resources.every(r=>r.disposals===1));
  assert.throws(()=>createFeature({}),/engine.THREE/);
});

// Optional actual Three r160 validation, using an already available module. No
// dependency fetch/install, browser or WebGL context is required by these tests.
test('actual Three: finite bounds, outward custom solids and GPU disposal', {skip:!process.env.CITY_OLDTOWN_THREE}, async()=>{
  const THREE=await import(process.env.CITY_OLDTOWN_THREE);
  let detached=0;
  const feature=createFeature({THREE,player:landmark,distance:()=>0,addGeoObject(){return()=>detached++;}});
  feature.group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(feature.group);
  assert.ok(bounds.min.y>=-1e-5);assert.ok(bounds.max.y>98&&bounds.max.y<100);
  assert.ok(bounds.max.x-bounds.min.x>100&&bounds.max.x-bounds.min.x<125);
  const geometrySet=new Set(),materialSet=new Set();let draws=0;
  feature.group.traverse(mesh=>{
    if(!mesh.isInstancedMesh)return;draws++;geometrySet.add(mesh.geometry);materialSet.add(mesh.material);
    const box=new THREE.Box3().setFromObject(mesh);assert.ok([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite));
    if(!['roof','apse','apseRoof'].some(shape=>mesh.name.includes(`-${shape}-`)))return;
    const geometry=mesh.geometry,positions=geometry.attributes.position,indices=geometry.index.array;
    const center=new THREE.Vector3();
    for(let i=0;i<positions.count;i++)center.add(new THREE.Vector3().fromBufferAttribute(positions,i));
    center.multiplyScalar(1/positions.count);
    for(let i=0;i<indices.length;i+=3){
      const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,indices[i+j]));
      const normal=b.clone().sub(a).cross(c.clone().sub(a));
      const centroid=a.clone().add(b).add(c).multiplyScalar(1/3).sub(center);
      assert.ok(normal.dot(centroid)>0,`${mesh.name} triangle ${i/3} winding`);
    }
  });
  assert.ok(draws<32);
  let geometryDisposals=0,materialDisposals=0;
  geometrySet.forEach(g=>g.addEventListener('dispose',()=>geometryDisposals++));
  materialSet.forEach(m=>m.addEventListener('dispose',()=>materialDisposals++));
  feature.dispose();feature.dispose();assert.equal(detached,1);
  assert.equal(geometryDisposals,geometrySet.size);assert.equal(materialDisposals,materialSet.size);
});
