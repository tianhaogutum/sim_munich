import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFeature,planNymphenburg,NYMPHENBURG,NYMPHENBURG_SOURCES,NYMPHENBURG_ROOF} from '../src/city_landmark_nymphenburg.mjs';

const pack=JSON.parse(readFileSync(new URL('../assets/city_research/session09.json',import.meta.url),'utf8'));

test('building anchor and credited facade source match existing research, separate from arrival',()=>{
  const building=pack.buildings.find(b=>b.photoPage===NYMPHENBURG_SOURCES[2].url);
  assert.ok(building);
  assert.equal(NYMPHENBURG.lon,building.lon);assert.equal(NYMPHENBURG.lat,building.lat);
  const arrival=pack.places.find(p=>p.id==='session09-nymphenburg-forecourt');
  assert.notEqual(NYMPHENBURG.lon,arrival.lon);
  assert.match(NYMPHENBURG.accuracy,/approximate/i);assert.match(NYMPHENBURG.accuracy,/not surveyed/);
  assert.ok(NYMPHENBURG_SOURCES.every(s=>pack.sources.some(p=>p.url===s.url) || s.url.endsWith('/park/plan.htm')));
  assert.match(NYMPHENBURG_SOURCES[2].credit,/Johannes Schlund/);
  assert.match(NYMPHENBURG_SOURCES[2].credit,/West facade/);
});

test('bounded, positive model has central mass, stepped gallery/pavilion rhythm and east forecourt',()=>{
  const parts=planNymphenburg();
  assert.ok(parts.length>400 && parts.length<1500);
  for(const p of parts){
    assert.ok(p.position.every(Number.isFinite),p.label);
    assert.ok(p.size.every(n=>Number.isFinite(n)&&n>0),p.label);
    assert.ok(p.position[1]-p.size[1]/2>=-1e-8,p.label);
    assert.ok(Math.abs(p.position[0])+p.size[0]/2<50,p.label);
    assert.ok(Math.abs(p.position[2])+p.size[2]/2<140,p.label);
  }
  const central=parts.find(p=>p.label==='central-pavilion');
  assert.deepEqual(central.position,[0,12,0]);
  assert.equal(parts.filter(p=>p.label==='inner-pavilion').length,2);
  assert.equal(parts.filter(p=>p.label==='outer-pavilion').length,2);
  assert.equal(parts.filter(p=>p.shape==='hip').length,9);
  for(const p of parts.filter(p=>/^(inner|outer)-(gallery|pavilion)$/.test(p.label))){
    assert.ok(parts.some(q=>q.label===p.label&&q.position[0]===p.position[0]&&q.position[2]===-p.position[2]));
    assert.ok(p.size[1]<central.size[1]);
  }
  for(const p of parts.filter(p=>p.label.startsWith('forecourt-'))){assert.ok(p.position[0]-p.size[0]/2>15);assert.ok(p.size[1]<.3);}
  // Mutation by a caller cannot poison subsequent feature instances.
  parts[0].position[0]=1234;assert.equal(planNymphenburg()[0].position[0],0);
});

test('hipped roof is closed and all nondegenerate triangle normals point outward',()=>{
  const {positions:v,indices}=NYMPHENBURG_ROOF,edges=new Map();
  const point=i=>v.slice(i*3,i*3+3);
  for(let i=0;i<indices.length;i+=3){
    const ids=indices.slice(i,i+3),[a,b,c]=ids.map(point);
    const ab=b.map((n,j)=>n-a[j]),ac=c.map((n,j)=>n-a[j]);
    const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const centroid=a.map((n,j)=>(n+b[j]+c[j])/3);
    assert.ok(normal.reduce((sum,n,j)=>sum+n*centroid[j],0)>0);
    for(let j=0;j<3;j++){const key=[ids[j],ids[(j+1)%3]].sort().join(':');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].every(count=>count===2));
});

// Recording Three/DOM adapter verifies host contract and GPU ownership without
// fetching dependencies, opening a browser, starting a server or requiring GL.
function harness({failAttach=false,withDOM=false}={}){
  const geometries=[],materials=[],meshes=[],calls=[],panels=[];
  class Vector {set(...v){this.values=v;return this;}}
  class Object3D {
    constructor(){this.position=new Vector();this.scale=new Vector();this.children=[];this.userData={};}
    updateMatrix(){this.matrix={position:[...this.position.values],scale:[...this.scale.values]};}
    add(child){this.children.push(child);}
    clear(){this.children=[];}
  }
  class Geometry {
    constructor(){this.disposals=0;geometries.push(this);}
    setAttribute(key,value){this[key]=value;}
    setIndex(indices){this.indices=indices;}
    computeVertexNormals(){this.normalsComputed=true;}
    dispose(){this.disposals++;}
  }
  class Material{constructor(options){this.options=options;this.disposals=0;materials.push(this);}dispose(){this.disposals++;}}
  class InstancedMesh extends Object3D {
    constructor(geometry,material,count){super();Object.assign(this,{geometry,material,count,instanceMatrix:{},instances:[],disposals:0});meshes.push(this);}
    setMatrixAt(i,matrix){this.instances[i]=matrix;}
    computeBoundingSphere(){this.boundsComputed=true;}
    dispose(){this.disposals++;}
  }
  const THREE={Group:Object3D,Object3D,BoxGeometry:Geometry,BufferGeometry:Geometry,
    Float32BufferAttribute:class{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}},MeshLambertMaterial:Material,InstancedMesh};
  let detachments=0,unregistrations=0,callback;
  const engine={THREE,addGeoObject(options){calls.push(options);if(failAttach)throw new Error('attach failed');return()=>detachments++;},
    onDispose(fn){callback=fn;return()=>unregistrations++;}};
  if(withDOM){
    engine.document={createElement(tag){return {tag,children:[],appendChild(el){this.children.push(el);}};}};
    engine.createPanel=(id,options)=>{const panel={id,options,body:engine.document.createElement('div'),opened:false,disposals:0,
      open(){this.opened=true;},isOpen(){return this.opened;},dispose(){this.disposals++;}};panels.push(panel);return panel;};
  }
  return {engine,geometries,materials,meshes,calls,panels,get detachments(){return detachments;},get unregistrations(){return unregistrations;},shutdown(){callback();}};
}

test('host receives exactly one local group; instancing shares resources and bounded draw calls',()=>{
  const h=harness(),feature=createFeature(h.engine);
  assert.equal(h.calls.length,1);
  const {replacementOffsets,...placement}=h.calls[0];
  assert.deepEqual(placement,{group:feature.group,lon:NYMPHENBURG.lon,lat:NYMPHENBURG.lat,minZoom:13,maxDistance:6000,replaceBuildings:true});
  // The host also suppresses the base-map polygons under each wing, not only the anchor.
  assert.ok(replacementOffsets.length>=5&&replacementOffsets.every(o=>o.length===2&&o.every(Number.isFinite)));
  assert.equal(feature.group.name,NYMPHENBURG.id);
  assert.equal(feature.group.position.values,undefined,'feature leaves geographic placement to host');
  assert.equal(h.geometries.length,2);
  assert.ok(h.materials.length<=8);assert.ok(h.meshes.length<=9);
  assert.equal(h.meshes.reduce((n,m)=>n+m.count,0),planNymphenburg().length);
  assert.ok(h.meshes.every(m=>m.instances.length===m.count&&m.instanceMatrix.needsUpdate&&m.boundsComputed));
  assert.equal(feature.credits,NYMPHENBURG_SOURCES);
  feature.dispose();h.shutdown();feature.dispose();
  assert.equal(h.detachments,1);assert.equal(h.unregistrations,1);
  assert.ok([...h.geometries,...h.materials,...h.meshes].every(r=>r.disposals===1));
  assert.equal(feature.group.children.length,0);
});

test('managed sources panel exposes credits and licenses with no keyboard ownership',()=>{
  const h=harness({withDOM:true}),feature=createFeature(h.engine),panel=h.panels[0];
  assert.equal(panel.options.key,undefined);assert.equal(panel.options.modal,true);
  assert.equal(feature.handleKey,undefined);
  assert.equal(feature.isOpen(),false);feature.openSources();assert.equal(feature.isOpen(),true);
  const all=[];const walk=el=>{all.push(el);el.children.forEach(walk);};walk(panel.body);
  const links=all.filter(el=>el.tag==='a');
  assert.equal(links.length,4);
  assert.ok(links.some(el=>el.href===NYMPHENBURG_SOURCES[2].license));
  assert.ok(links.every(el=>el.rel==='noopener noreferrer'));
  assert.ok(all.some(el=>el.textContent?.includes('Johannes Schlund')));
  h.shutdown();assert.equal(panel.disposals,1);assert.equal(feature.isOpen(),false);
});

test('failed host registration releases allocated GPU resources; invalid engine fails clearly',()=>{
  assert.throws(()=>createFeature({}),/engine.THREE/);
  const h=harness({failAttach:true});
  assert.throws(()=>createFeature(h.engine),/attach failed/);
  assert.ok([...h.geometries,...h.materials,...h.meshes].every(r=>r.disposals===1));
});
