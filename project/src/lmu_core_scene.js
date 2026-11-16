// LMU forecourt reconstructed from retained OSM footprints and photographed facade rhythm.
// Decorative dimensions are approximations, not a measured-building survey.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CORE_BUILDINGS, CORE_TREES, CORE_BENCHES, CORE_LAWNS, CORE_PAVING } from './lmu_core_data.mjs';
import { ROAD_WAYS, CYCLE_WAYS, SIDEWALK_WAYS } from './lmu_block_ludwigstrasse_data.mjs';
import { FOUNTAINS, POIS } from './date_route.mjs';

export function createCoreScene({THREE:T,scene,toon}) {
  const group=new T.Group();group.name='LMU mapped core';scene.add(group);
  const batches=new Map(), mats=new Map(), resources=[];
  const palette={wall:0xcbbca0,wall2:0xbfb099,trim:0xddd0b1,roof:0x87584a,recess:0x263c43,
    frame:0xb5a78b,glass:0x41616a,door:0x39332e,paving:0xb3aa94,grass:0x798968,stone:0x8d928b,
    asphalt:0x52575a,cycle:0x78746b,sidewalk:0xaaa795,line:0xd2cdb5,trunk:0x6a5541,leaf:0x738e5f,wood:0x8a7050,iron:0x42494a};
  const matrix=new T.Matrix4(),q=new T.Quaternion();
  function put(g,key,position=[0,0,0],rotation=[0,0,0]) {
    matrix.compose(new T.Vector3(...position),q.setFromEuler(new T.Euler(...rotation)),new T.Vector3(1,1,1));g.applyMatrix4(matrix);
    const raw=g.index?g.toNonIndexed():g;if(raw!==g)g.dispose();raw.deleteAttribute('uv');
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(raw);
  }
  function box(p,s,key,angle=0){put(new T.BoxGeometry(...s),key,p,[0,angle,0]);}
  function cylinder(p,top,bottom,h,key,n=12){put(new T.CylinderGeometry(top,bottom,h,n),key,p);}
  function shape(ring){return new T.Shape(ring.map(p=>new T.Vector2(p.x,-p.z)));}
  function flat(ring,y,key){if(ring.length<3)return;const g=new T.ShapeGeometry(shape(ring));g.rotateX(-Math.PI/2);put(g,key,[0,y,0]);}
  function arch(w,h){const s=new T.Shape(),r=w/2;s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.closePath();return s;}
  function faceArch(x,y,z,w,h,key,angle){put(new T.ShapeGeometry(arch(w,h),12),key,[x,y,z],[0,angle,0]);}
  function ringArch(x,y,z,w,h,thickness,angle){
    const s=arch(w+thickness*2,h+thickness),hole=arch(w,h);s.holes.push(new T.Path(hole.getPoints(24)));
    put(new T.ShapeGeometry(s,12),'trim',[x,y,z],[0,angle,0]);
  }
  // One broad ground mesh keeps every expanded district on land.
  box([0,-.18,50],[2600,.3,1600],'paving');
  for(const p of CORE_PAVING)flat(p.ring,.025,'paving');
  for(const p of CORE_LAWNS)flat(p.ring,.06,'grass');
  // Accurate mapped body outlines. The western district owns everything behind z=-30.
  for(const [index,b] of CORE_BUILDINGS.entries()) {
    const wall=new T.ExtrudeGeometry(shape(b.ring),{depth:b.height,bevelEnabled:false,curveSegments:1});
    wall.rotateX(-Math.PI/2);put(wall,index%3?'wall':'wall2');
    const roof=new T.ExtrudeGeometry(shape(b.ring),{depth:.35,bevelEnabled:true,bevelSegments:1,bevelSize:1.1,bevelThickness:1.9,curveSegments:1});
    roof.rotateX(-Math.PI/2);put(roof,'roof',[0,b.height+1.5,0]);
    const area=b.ring.reduce((s,a,i)=>{const v=b.ring[(i+1)%b.ring.length];return s+a.x*v.z-v.x*a.z;},0);
    for(let i=0;i<b.ring.length;i++) {
      const a=b.ring[i],c=b.ring[(i+1)%b.ring.length],dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz);
      if(len<2.2)continue;
      const nx=(area>0?dz:-dz)/len,nz=(area>0?-dx:dx)/len,angle=Math.atan2(nx,nz);
      const center=[(a.x+c.x)/2,(a.z+c.z)/2];
      for(const y of [8.2,16.4,b.height-.3])box([center[0]+nx*.12,y,center[1]+nz*.12],[len,.22,.3],'trim',-Math.atan2(dz,dx));
      // Three principal storeys; paired round arches form the photographed upper rhythm.
      const bays=Math.max(1,Math.floor(len/4.6));
      for(let n=0;n<bays;n++) {
        const u=(n+.5)/bays,x=a.x+dx*u,z=a.z+dz*u;
        // Principal nine ground arcade openings are drawn separately below.
        const isArcade=b.name==='A' && z>4 && z<22 && x>-24 && x<24;
        for(const y of [1.15,9.7,18]) {
          if(isArcade&&y<3)continue;
          if(y+3>b.height)continue;
          for(const side of [-1,1]) {
            const wx=x+dx/len*side*.73,wz=z+dz/len*side*.73;
            faceArch(wx+nx*.07,y,wz+nz*.07,1.22,3.15,'frame',angle);
            faceArch(wx+nx*.10,y+.14,wz+nz*.10,.98,2.87,'glass',angle);
            box([wx+nx*.14,y+1.44,wz+nz*.14],[.055,2.5,.055],'trim',angle);
          }
        }
      }
    }
  }
  // Nine masonry arcade bays, centred on the mapped recessed eastern entrance.
  const ux=.9528,uz=.3036,nx=-uz,nz=ux,cx=1.725,cz=13.227;
  for(let i=0;i<9;i++) {
    const along=(i-4)*4.55,x=cx+ux*along,z=cz+uz*along,angle=Math.atan2(nx,nz);
    faceArch(x+nx*.11,.3,z+nz*.11,3.35,7.1,'recess',angle);
    ringArch(x+nx*.15,.3,z+nz*.15,3.35,7.1,.36,angle);
    // A recessed door and vertical subdivisions give the openings depth without an invented portico.
    faceArch(x+nx*.17,.38,z+nz*.17,2.3,5.6,'door',angle);
    box([x+nx*.2,3,z+nz*.2],[.09,5.2,.09],'frame',angle);
    box([x+nx*.2,4.8,z+nz*.2],[2.3,.1,.09],'frame',angle);
  }
  // Mapped road alignment through the protected core gap, joining neighbouring street sectors.
  function clippedSegment(a,b){
    let lo=0,hi=1;const dx=b.x-a.x;
    if(Math.abs(dx)<1e-8)return a.x>=-150&&a.x<=150?[a,b]:null;
    const t0=(-150-a.x)/dx,t1=(150-a.x)/dx;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
    if(lo>=hi)return null;return [{x:a.x+dx*lo,z:a.z+(b.z-a.z)*lo},{x:a.x+dx*hi,z:a.z+(b.z-a.z)*hi}];
  }
  function road(ways,key,y,widthFor){for(const w of ways)for(let i=1;i<w.points.length;i++){
    const seg=clippedSegment(w.points[i-1],w.points[i]);if(!seg)continue;const [a,b]=seg,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.05)continue;
    box([(a.x+b.x)/2,y,(a.z+b.z)/2],[len+.03,.04,widthFor(w)],key,-Math.atan2(dz,dx));
    if(key==='asphalt'){
      const count=Math.max(1,Math.round(len/9));for(let j=0;j<count;j++){const t=(j+.5)/count;
        box([a.x+dx*t,y+.025,a.z+dz*t],[Math.min(3,len/count*.45),.012,.12],'line',-Math.atan2(dz,dx));}
    }
  }}
  road(SIDEWALK_WAYS,'sidewalk',.08,()=>4.4);
  road(ROAD_WAYS,'asphalt',.105,w=>Math.max(3.1,Number(w.tags?.lanes||2)*3.1));
  road(CYCLE_WAYS,'cycle',.13,()=>2.1);
  // Octagonal basins and two stacked bowls: a restrained abstraction of the Roman fountains.
  for(const f of FOUNTAINS) {
    cylinder([f.x,.4,f.z],5.5,5.7,.8,'stone',8);
    cylinder([f.x,.83,f.z],5.05,5.05,.035,'glass',8);
    cylinder([f.x,2.4,f.z],.32,.55,4.0,'stone',12);
    cylinder([f.x,3.2,f.z],2.65,1.45,.6,'stone',20);
    cylinder([f.x,3.54,f.z],2.5,2.5,.025,'glass',20);
    cylinder([f.x,5.7,f.z],.24,.32,4.7,'stone',12);
    cylinder([f.x,7.15,f.z],1.45,.72,.65,'stone',20);
    cylinder([f.x,7.5,f.z],1.34,1.34,.025,'glass',20);
    cylinder([f.x,7.9,f.z],.16,.23,.7,'stone',12);
  }
  for(const p of CORE_TREES) {
    if(Object.values(POIS).some(q=>Math.hypot(q.x-p.x,q.z-p.z)<2))continue;
    cylinder([p.x,2.5,p.z],.24,.4,5,'trunk',8);
    const crown=new T.IcosahedronGeometry(3.15+(p.id%3)*.3,1);crown.scale(1,1.2,1);put(crown,'leaf',[p.x,5.5,p.z]);
  }
  for(const p of CORE_BENCHES) {
    if(Object.values(POIS).some(q=>Math.hypot(q.x-p.x,q.z-p.z)<2))continue;
    box([p.x,.48,p.z],[2.0,.16,.55],'wood');box([p.x,.9,p.z+.25],[2,.55,.10],'wood');
    for(const dx of [-.75,.75])box([p.x+dx,.24,p.z],[.1,.5,.5],'iron');
  }
  for(const [key,geos] of batches) {
    const geometry=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!geometry)continue;
    const material=toon(palette[key],key==='leaf'||key==='grass'?3:4);mats.set(key,material);
    const mesh=new T.Mesh(geometry,material);mesh.name='core / '+key;mesh.castShadow=!['paving','grass','sidewalk','asphalt','cycle','line'].includes(key);mesh.receiveShadow=true;
    mesh.userData.core=true;group.add(mesh);resources.push(geometry);
  }
  // Fountain spray: one transparent points draw, deterministic and cheap to animate.
  const n=240,positions=new Float32Array(n*3),spray=new T.BufferGeometry();spray.setAttribute('position',new T.BufferAttribute(positions,3));
  const sprayMaterial=new T.PointsMaterial({color:0xc7edf0,size:.075,transparent:true,opacity:.65,depthWrite:false});
  const drops=new T.Points(spray,sprayMaterial);drops.name='fountain particles';drops.userData.photoIgnore=true;group.add(drops);resources.push(spray,sprayMaterial);
  function update(dt,et){
    for(let i=0;i<n;i++){
      const f=FOUNTAINS[Math.floor(i/(n/2))],angle=i*2.39996,t=(et*.4+i*.013)%1,r=1.5+t*1.1;
      positions[i*3]=f.x+Math.cos(angle)*r;positions[i*3+1]=7.25-5.9*t*t;positions[i*3+2]=f.z+Math.sin(angle)*r;
    }
    spray.attributes.position.needsUpdate=true;
  }
  update(0,0);spray.computeBoundingSphere();
  return {group,update,dispose(){group.removeFromParent();for(const r of resources)r.dispose();for(const m of mats.values())m.dispose();},stats:{buildings:CORE_BUILDINGS.length,trees:CORE_TREES.length,arcades:9,storeys:3}};
}
