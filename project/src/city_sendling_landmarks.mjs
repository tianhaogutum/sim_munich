// Stylized exterior studies, not surveyed reconstructions. All dimensions below
// are artistic metre-scale estimates; provenance remains in session06.json.
// Scene frame: +X east, +Y up, +Z south (the city cast's MapLibre transform).
const commons='https://commons.wikimedia.org/wiki/';
export const SENDLING_LANDMARKS=Object.freeze([
 {id:'session06-old-st-margaret',name:'旧圣玛格丽特教堂',lon:11.5414,lat:48.1214,kind:'old-church',halfWidth:17,halfDepth:11,photoPage:commons+'File:Munich_Sendling_Old_Church_St_Margaret_seen_from_Stemmerhof.jpg'},
 {id:'session06-new-st-margaret',name:'新圣玛格丽特教堂',lon:11.5394,lat:48.1201,kind:'new-church',halfWidth:37,halfDepth:19,photoPage:commons+'File:Munich_Sendling_New_Church_St_Margaret_West.jpg'},
 {id:'session06-harras',name:'Harras 邮局',lon:11.5394,lat:48.1163,kind:'post-office',halfWidth:33,halfDepth:13,photoPage:commons+'File:Harras_Post_9241.jpg'},
 {id:'session06-schmied-von-kochel',name:'科赫尔铁匠纪念喷泉',lon:11.5416,lat:48.1219,kind:'fountain',halfWidth:5,halfDepth:4,source:'https://stadt.muenchen.de/infos/brunnen-muenchen.html'},
].map(Object.freeze));
const colors={plaster:0xede1c8,trim:0xf9eed9,roof:0x61554b,copper:0x658b7a,glass:0x3f5960,door:0x624b39,stone:0xb6b09e,bronze:0x485e50,water:0x589b9e,post:0xf0eade};

function insideRing(lon,lat,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function replacedSendlingBuildingIds(features){
 const ids=new Set();
 for(const f of features){
  // Only suppress an identified tile building actually containing a model anchor.
  // No radius masks: these could erase neighboring buildings across a street.
  if(typeof f.id!=='number'&&typeof f.id!=='string')continue;
  const polygons=f.geometry?.type==='Polygon'?[f.geometry.coordinates]:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:[];
  if(SENDLING_LANDMARKS.some(s=>s.kind!=='fountain'&&polygons.some(rings=>rings[0]?.length&&insideRing(s.lon,s.lat,rings[0])&&!rings.slice(1).some(r=>insideRing(s.lon,s.lat,r)))))ids.add(f.id);
 }
 return [...ids];
}

// Pure mesh plan allows bounds/placement validation without WebGL or downloads.
export function planSendlingLandmark(kind){
 const parts=[];
 const put=(shape,color,x,y,z,w,h,d=w)=>parts.push({shape,color,position:[x,y,z],size:[w,h,d]});
 const box=(...a)=>put('box',...a),roof=(...a)=>put('roof',...a);
 function tower(x,z,base,height,width){
  box('plaster',x,base+height/2,z,width,height,width);
  for(const y of [base+height*.55,base+height*.84,base+height])box('trim',x,y,z,width+1,.65,width+1);
  for(const side of [-1,1]){
   box('glass',x+side*(width/2+.03),base+height*.88,z,.12,3,1.3);
   box('glass',x,base+height*.88,z+side*(width/2+.03),1.3,3,.12);
  }
  put('onion','copper',x,base+height+width*.8,z,width*1.35,width*1.6,width*1.35);
  box('bronze',x,base+height+width*1.7,z,.18,2,.18);
  box('bronze',x,base+height+width*1.9,z,1.2,.15,.15);
 }
 if(kind==='old-church'){
  box('plaster',0,5.5,0,25,11,12);
  roof('roof',0,13.5,0,28,6,14);
  box('plaster',13,5,0,6,10,9);
  roof('roof',13,12.3,0,8,5,11);
  tower(9,-7,0,19,5);
  for(const z of [-6.08,6.08])for(const x of [-9,-3,3,9]){
   box('trim',x-2,5.5,z,.5,11,.25);
   box('glass',x,6.7,z,1.7,4,.15);
   box('trim',x,9,z,2.2,.35,.25);
  }
  box('door',-12.58,2,0,.18,4,2.3);
  box('trim',0,.3,0,26,.6,13);
 }else if(kind==='new-church'){
  box('plaster',1,12,0,59,24,24);
  roof('roof',1,28.5,0,62,10,27);
  box('plaster',29,11,0,9,22,20);
  roof('roof',29,26,0,11,8,23);
  // West entrance at negative X; single tower offset to the north (-Z).
  box('plaster',-30,13,0,5,26,29);
  box('trim',-32.7,14,0,.7,2,30);
  box('trim',-32.7,25,0,.7,1,30);
  for(const z of [-12,-6,6,12])box('trim',-32.7,12,z,.8,23,1);
  for(const z of [-7,0,7]){
   box('door',-32.75,3,z,.3,6,3.2);
   box('glass',-32.75,19,z,.3,6,3);
  }
  for(const z of [-12.15,12.15])for(const x of [-20,-10,0,10,20]){
   box('trim',x-4,12,z,.9,24,.7);
   box('glass',x,16,z,3.4,7,.22);
   box('trim',x,20,z,4.2,.7,.5);
  }
  tower(-24,-13,0,58,8);
  for(let i=0;i<3;i++)box('stone',-33.5-i*.7,.2+i*.15,0,1.5,.4,17-i*2);
 }else if(kind==='post-office'){
  // Simplified modern street frontage with stepped massing, no historic ornament.
  box('post',-9,10.5,0,44,21,19);
  box('post',22,14.5,0,18,29,19);
  box('roof',-9,21.2,0,44,.4,19.5);
  box('roof',22,29.2,0,18,.4,19.5);
  for(const z of [-9.58,9.58]){
   for(const y of [5,9.5,14,18])for(let x=-27;x<29;x+=4.6){
    if(x>13&&y>14)continue;
    box('glass',x,y,z,2.1,2.7,.14);
   }
   box('trim',0,2.7,z,62,.5,.4);
  }
  box('door',0,1.3,-9.65,4,2.6,.2);
  box('stone',0,.25,-10.4,7,.5,2);
  for(const x of [17,22,27])for(const y of [18,23,27])box('glass',x,y,-9.58,2.1,2.7,.14);
 }else if(kind==='fountain'){
  box('stone',0,.35,1,9,.7,5);
  box('water',0,.72,1,7.5,.08,3.5);
  box('stone',0,2,-1,2.5,4,2.5);
  // Abstract bronze figure/flag/hammer silhouette; not a detailed sculpture copy.
  box('bronze',0,5,-1,.9,2,.6);
  put('sphere','bronze',0,6.4,-1,.75,.85,.75);
  for(const x of [-.25,.25])box('bronze',x,3.9,-1,.3,1.3,.35);
  box('bronze',1.1,6,-1,.13,5,.13);
  box('bronze',1.8,7.4,-1,1.3,1.4,.12);
  box('bronze',-.9,5.6,-1,1.2,.23,.3);
  box('bronze',-1.4,5.6,-1,.35,.7,.4);
 }else throw new TypeError(`Unknown Sendling landmark: ${kind}`);
 return parts;
}

const solids=SENDLING_LANDMARKS.map(spec=>({spec,parts:planSendlingLandmark(spec.kind).filter(p=>p.position[1]-p.size[1]/2<1.8&&p.position[1]+p.size[1]/2>1.8)}));
export function isSendlingLandmarkSolid(lon,lat){
 if(!Number.isFinite(lon)||!Number.isFinite(lat))return false;
 return solids.some(({spec,parts})=>{
  const x=(lon-spec.lon)*111320*Math.cos(spec.lat*Math.PI/180),z=(spec.lat-lat)*111320;
  if(Math.abs(x)>spec.halfWidth+1||Math.abs(z)>spec.halfDepth+1)return false;
  return parts.some(p=>Math.abs(x-p.position[0])<p.size[0]/2+.4&&Math.abs(z-p.position[2])<p.size[2]/2+.4);
 });
}

export function createSendlingLandmarks(THREE){
 const group=new THREE.Group();group.name='sendling-landmarks';
 const materials=new Map(),geometries=new Map(),models=[];
 let disposed=false,detachMap=()=>{};
 function geometry(shape){
  if(geometries.has(shape))return geometries.get(shape);
  let geo;
  if(shape==='roof'){
   // Unit triangular prism, ridge along east/west. Correct outward winding.
   const p=[-.5,-.5,-.5, -.5,-.5,.5, -.5,.5,0, .5,-.5,-.5, .5,-.5,.5, .5,.5,0];
   geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
   geo.setIndex([0,2,1,3,4,5,0,1,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,4]);geo.computeVertexNormals();
  }else if(shape==='onion'){
   geo=new THREE.LatheGeometry([new THREE.Vector2(0,-.5),new THREE.Vector2(.24,-.5),new THREE.Vector2(.45,-.28),new THREE.Vector2(.5,-.08),new THREE.Vector2(.4,.1),new THREE.Vector2(.19,.29),new THREE.Vector2(.06,.48),new THREE.Vector2(0,.5)],12);
  }else if(shape==='sphere')geo=new THREE.SphereGeometry(.5,10,8);
  else geo=new THREE.BoxGeometry(1,1,1);
  geometries.set(shape,geo);return geo;
 }
 const dummy=new THREE.Object3D();
 for(const spec of SENDLING_LANDMARKS){
  const root=new THREE.Group();root.name=spec.id;root.userData={...spec,accuracy:'approximate stylized exterior; dimensions not surveyed'};
  const batches=new Map();
  for(const part of planSendlingLandmark(spec.kind)){
   const key=part.shape+':'+part.color;
   if(!batches.has(key))batches.set(key,[]);batches.get(key).push(part);
  }
  for(const parts of batches.values()){
   const {shape,color}=parts[0];
   if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color:colors[color]}));
   const mesh=new THREE.InstancedMesh(geometry(shape),materials.get(color),parts.length);
   parts.forEach((p,i)=>{dummy.position.set(...p.position);dummy.scale.set(...p.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
  }
  root.visible=false;group.add(root);models.push({spec,root,mercator:null});
 }
 return {group,models,contains:isSendlingLandmarkSolid,
  attachMap(map){
   detachMap();
   let ownFilter=null,baseFilter=null;
   const hiddenIds=new Set();
   const refresh=()=>{
    if(!map.getLayer('building-3d')||!map.getSource('openmaptiles'))return;
    let changed=false;
    for(const id of replacedSendlingBuildingIds(map.querySourceFeatures('openmaptiles',{sourceLayer:'building'}))){if(!hiddenIds.has(id)){hiddenIds.add(id);changed=true;}}
    if(!changed)return;
    const current=map.getFilter('building-3d');
    if(!ownFilter||JSON.stringify(current)!==JSON.stringify(ownFilter))baseFilter=current;
    const exclusion=['!', ['in',['id'],['literal',[...hiddenIds]]]];
    ownFilter=baseFilter?['all',baseFilter,exclusion]:exclusion;
    map.setFilter('building-3d',ownFilter);
   };
   map.on('idle',refresh);
   detachMap=()=>{map.off('idle',refresh);if(ownFilter&&map.getLayer('building-3d')&&JSON.stringify(map.getFilter('building-3d'))===JSON.stringify(ownFilter))map.setFilter('building-3d',baseFilter??null);};
   refresh();
  },
  update(player,view,mercator){
   if(disposed)return;
   const origin=mercator.fromLngLat([player.lon,player.lat],0),units=origin.meterInMercatorCoordinateUnits();
   const center=mercator.fromLngLat([view.lng,view.lat],0);
   for(const model of models){
    model.mercator??=mercator.fromLngLat([model.spec.lon,model.spec.lat],0);
    const p=model.mercator;
    // Mercator differences match the cast projection, including latitude scale.
    model.root.position.set((p.x-origin.x)/units,0,(p.y-origin.y)/units);
    model.root.visible=Math.hypot(p.x-center.x,p.y-center.y)/units<1600;
   }
  },
  dispose(){if(disposed)return;disposed=true;detachMap();group.removeFromParent();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const geo of geometries.values())geo.dispose();for(const mat of materials.values())mat.dispose();},
 };
}
