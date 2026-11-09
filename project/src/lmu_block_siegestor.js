// The north district, sourced from OSM. No global scene mutations, animation, textures or fetches.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointInPolygon, polygonBounds } from './date_geo.mjs';
import { BUILDINGS, ROADS, TREES, SECTOR, GATE, GATE_PIERS, gateToWorld, LANDMARKS, academyToWorld, ACADEMY_PLINTHS } from './lmu_block_siegestor_data.mjs';
export { LANDMARKS } from './lmu_block_siegestor_data.mjs';

export function createBlock(engine) {
  const { THREE } = engine;
  const group = new THREE.Group();
  group.name = 'OSM · Siegestor / Akademie / Leopoldstraße';
  const buckets = new Map();
  const unregister = [];
  const ownedMaterials = new Set();
  const palette = {
    stone:0xbbae90, trim:0xd0c2a5, recess:0x867b67, bronze:0x3b5b50,
    plaster:0xb5a78f, ochre:0xbca16f, rose:0xb49a87, cool:0xa9aaa0,
    roof:0x626773, tile:0x735b4f, glass:0x334b58, frame:0x93876f,
    asphalt:0x50545a, sidewalk:0xa7a191, marking:0xc3bfae,
    grass:0x6f8651, foliage:0x527444, foliageLight:0x6e8e50, bark:0x685342,
  };
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1,1,1);
  const quat = new THREE.Quaternion();

  function add(key, geo, x=0, y=0, z=0, ry=0, sx=1, sy=1, sz=1) {
    position.set(x,y,z); euler.set(0,ry,0); quat.setFromEuler(euler); scale.set(sx,sy,sz);
    matrix.compose(position,quat,scale); geo.applyMatrix4(matrix);
    // End projecting cornices/window sills at ownership seams, including their ink hull margin.
    const vertices=geo.getAttribute('position');
    for(let i=0;i<vertices.count;i++){
      vertices.setX(i,Math.max(150.06,Math.min(479.94,vertices.getX(i))));
      vertices.setZ(i,Math.max(-149.94,Math.min(249.94,vertices.getZ(i))));
    }
    if (geo.index) { const g=geo.toNonIndexed(); geo.dispose(); geo=g; }
    // All standard geometries have these attributes; no geometry groups/material array draw calls.
    geo.clearGroups();
    if (!buckets.has(key)) buckets.set(key,[]);
    buckets.get(key).push(geo);
  }
  function box(key,x,y,z,w,h,d,ry=0) { add(key,new THREE.BoxGeometry(w,h,d),x,y,z,ry); }
  function sphere(key,x,y,z,rx,ry,rz) { add(key,new THREE.SphereGeometry(1,10,7),x,y,z,0,rx,ry,rz); }
  function cylinder(key,x,y,z,r,h,top=r) { add(key,new THREE.CylinderGeometry(top,r,h,10),x,y,z); }
  function shapeOf(ring) {
    const shape=new THREE.Shape();
    ring.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));
    shape.closePath(); return shape;
  }
  function solid(key,ring,h,y=0) {
    const geo=new THREE.ExtrudeGeometry(shapeOf(ring),{depth:h,bevelEnabled:false,steps:1,curveSegments:1});
    geo.rotateX(-Math.PI/2); add(key,geo,0,y);
  }
  function patch(key,ring,y) {
    if(ring.length<3)return;
    const geo=new THREE.ShapeGeometry(shapeOf(ring));geo.rotateX(-Math.PI/2);add(key,geo,0,y);
  }
  function clip(ring) {
    for (const [axis,lim,sign] of [['x',150.03,1],['x',479.97,-1],['z',-149.97,1],['z',249.97,-1]]) {
      const next=[];
      ring.forEach((b,i)=>{
        const a=ring[(i+ring.length-1)%ring.length],ai=(a[axis]-lim)*sign>=0,bi=(b[axis]-lim)*sign>=0;
        if(ai!==bi){const t=(lim-a[axis])/(b[axis]-a[axis]);next.push({x:a.x+t*(b.x-a.x),z:a.z+t*(b.z-a.z)});}
        if(bi)next.push(b);
      });
      ring=next;if(!ring.length)break;
    }
    return ring;
  }
  function strip(key,a,b,width,y) {
    const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.05)return;
    const nx=-dz/l*width/2,nz=dx/l*width/2;
    patch(key,clip([{x:a.x+nx,z:a.z+nz},{x:b.x+nx,z:b.z+nz},{x:b.x-nx,z:b.z-nz},{x:a.x-nx,z:a.z-nz}]),y);
  }
  function register(ring) {
    const b=polygonBounds(ring);
    unregister.push(engine.addBlocker((x,z)=>Math.abs(x-b.cx)<=b.hw+.01&&Math.abs(z-b.cz)<=b.hd+.01&&pointInPolygon(x,z,ring)));
  }
  function archShape(w,h) {
    const s=new THREE.Shape(),r=w/2;
    s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.closePath();return s;
  }
  function archedWindow(x,y,z,w,h,angle,depth=.05) {
    add('trim',new THREE.ShapeGeometry(archShape(w+.36,h+.22),10),x,y-.1,z,angle);
    add('glass',new THREE.ShapeGeometry(archShape(w,h),10),x+Math.sin(angle)*depth,y,z+Math.cos(angle)*depth,angle);
    box('frame',x+Math.sin(angle)*.08,y+h*.46,z+Math.cos(angle)*.08,.10,h-.18,.09,angle);
    box('frame',x+Math.sin(angle)*.08,y+h*.56,z+Math.cos(angle)*.08,w,.09,.08,angle);
  }

  // Sector-confined ground and true OSM street centrelines. Two carriageways skirt the gate island.
  patch('grass',[{x:150.01,z:-149.99},{x:479.99,z:-149.99},{x:479.99,z:249.99},{x:150.01,z:249.99}],.008);
  for(const road of ROADS) {
    const motor=['secondary','tertiary','residential','service','unclassified'].includes(road.kind);
    const w=road.kind==='secondary'?7.4:road.kind==='service'?3.8:road.kind==='residential'?6.2:2;
    for(let i=1;i<road.ring.length;i++) {
      const a=road.ring[i-1],b=road.ring[i];
      if(motor)strip('sidewalk',a,b,w+5,.022);
      strip(motor?'asphalt':road.kind==='cycleway'?'recess':'sidewalk',a,b,w,motor?.038:.045);
      if(road.kind==='secondary') {
        const l=Math.hypot(b.x-a.x,b.z-a.z);
        for(let d=4;d+3<l;d+=10) {
          const p={x:a.x+(b.x-a.x)*d/l,z:a.z+(b.z-a.z)*d/l};
          strip('marking',p,{x:p.x+(b.x-a.x)*3/l,z:p.z+(b.z-a.z)*3/l},.12,.044);
        }
      }
    }
  }
  const gatePatch=[gateToWorld(-14,-8.5),gateToWorld(14,-8.5),gateToWorld(14,8.5),gateToWorld(-14,8.5)];
  patch('sidewalk',gatePatch,.052);

  // Ordinary blocks use actual (occasionally clipped) concave footprints, not bounding-box solids.
  function roof(ring,h,kind) {
    if(!kind||kind==='flat'){solid('roof',ring,.42,h);return;}
    const b=polygonBounds(ring),xLong=b.hw>b.hd;
    const pitch=kind==='mansard'||kind==='gambrel'?3.6:2.8;
    const top=ring.map(p=>({x:b.cx+(p.x-b.cx)*(xLong?.87:.06),z:b.cz+(p.z-b.cz)*(xLong?.06:.87)}));
    const coords=[];
    for(let i=0;i<ring.length;i++) {
      const j=(i+1)%ring.length,a=ring[i],bb=ring[j],c=top[j],d=top[i];
      coords.push(a.x,h,-a.z,bb.x,h,-bb.z,c.x,h+pitch,-c.z,a.x,h,-a.z,c.x,h+pitch,-c.z,d.x,h+pitch,-d.z);
    }
    // World-space roof triangles; negate the temporary z coordinate back below.
    for(let i=2;i<coords.length;i+=3)coords[i]*=-1;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));g.computeVertexNormals();
    g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(coords.length/3*2),2));add(kind==='gabled'?'tile':'roof',g);
    solid(kind==='gabled'?'tile':'roof',top,.15,h+pitch);
  }
  function decorate(ring,h,floors,isAcademy=false,upperOnly=false) {
    const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a.x*b.z-b.x*a.z;},0);
    for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
      if(len<3.6)continue;
      // Skip cut faces at sector boundaries so no detail spills across ownership lines.
      if((Math.abs(a.x-b.x)<.02&&(a.x<150.2||a.x>479.8))||(Math.abs(a.z-b.z)<.02&&(a.z< -149.8||a.z>249.8)))continue;
      const tx=dx/len,tz=dz/len,nx=(area>0?dz:-dz)/len,nz=(area>0?-dx:dx)/len;
      const angle=Math.atan2(nx,nz),bay=isAcademy?4.2:3.3,n=Math.max(1,Math.floor(len/bay)),step=len/n;
      const px=(a.x+b.x)/2+nx*.12,pz=(a.z+b.z)/2+nz*.12;
      box('trim',px,h-.28,pz,len,.46,.34,angle);
      for(let f=0;f<floors;f++) {
        const base=isAcademy?(upperOnly?17.2:[.85,7.1,14.5][f]):.95+f*(h/floors);
        if(base===undefined)continue;
        const wh=isAcademy?(upperOnly?5.1:f===0?4.1:5.6):Math.min(2.6,h/floors-1.2),ww=isAcademy?2.25:1.35;
        if(f>0)box('trim',px,base-.45,pz,len,isAcademy?.3:.19,.3,angle);
        for(let k=0;k<n;k++) {
          const t=(k+.5)*step,x=a.x+tx*t+nx*.11,z=a.z+tz*t+nz*.11;
          if(x<150.4||x>479.6||z< -149.6||z>249.6)continue;
          if(isAcademy || (f===0&&i%2===0))archedWindow(x,base,z,ww,wh,angle);
          else {
            box('trim',x,base+wh/2,z,ww+.25,wh+.24,.12,angle);
            box('glass',x+nx*.09,base+wh/2,z+nz*.09,ww,wh,.08,angle);
            box('frame',x+nx*.14,base+wh/2,z+nz*.14,.07,wh,.06,angle);
            box('trim',x,base-.12,z,ww+.48,.18,.3,angle);
          }
          if(isAcademy&&(f>0||upperOnly)) {
            // Pilaster and portrait medallion rhythm seen in the reference photograph.
            box('trim',x+tx*step*.46,base+wh*.47,z+tz*step*.46,.28,wh+.65,.26,angle);
            const medal=new THREE.CylinderGeometry(.3,.3,.12,12);medal.rotateX(Math.PI/2);
            add('recess',medal,x+tx*step*.38+nx*.13,base+wh-.05,z+tz*step*.38+nz*.13,angle);
          }
        }
      }
      if(isAcademy&&!upperOnly) {
        // Rusticated base: shallow horizontal joints plus alternating vertical joints.
        for(let y=.6;y<6.5;y+=.65) {
          box('recess',px,y,pz,len,.035,.04,angle);
          for(let d=(Math.round(y/.65)%2)*.8+.8;d<len;d+=1.65)
            box('recess',a.x+tx*d+nx*.135,y+.3,a.z+tz*d+nz*.135,.028,.58,.04,angle);
        }
        for(let k=0;k<Math.floor(len/1.1);k++)box('trim',a.x+tx*(k+.5)*1.1+nx*.26,h-.65,a.z+tz*(k+.5)*1.1+nz*.26,.28,.4,.48,angle);
      }
    }
  }
  for(const b of BUILDINGS) {
    register(b.ring);
    const academy=b.id===173135247,levels=Number(b.tags['building:levels'])||4;
    const h=academy?16.4:Math.min(26,Number.parseFloat(b.tags.height)||levels*3.4+.7);
    const key=academy?'stone':['plaster','ochre','rose','cool'][b.id%4];
    solid(key,b.ring,h,.06);
    if(!academy)roof(b.ring,h,b.tags['roof:shape']);
    decorate(b.ring,h,academy?2:Math.min(6,levels),academy);
    if(academy) {
      // Three raised pavilions over the two-storey wings; clip each to the original OSM U-shape.
      for(const [lo,hi] of [[-100,-70.1],[-9.7,23],[78.6,100]]) {
        let points=b.ring.map(p=>({u:(p.x-266.447)*.305-(p.z-2.581)*.952,x:p.x,z:p.z}));
        for(const [cut,sign]of[[lo,1],[hi,-1]]) {
          const out=[];
          points.forEach((q,i)=>{const p=points[(i+points.length-1)%points.length],pi=(p.u-cut)*sign>=0,qi=(q.u-cut)*sign>=0;
            if(pi!==qi){const t=(cut-p.u)/(q.u-p.u);out.push({u:cut,x:p.x+t*(q.x-p.x),z:p.z+t*(q.z-p.z)});}
            if(qi)out.push(q);
          });points=out;
        }
        const ring=points.map(({x,z})=>({x,z}));
        solid('stone',ring,6.5,16.4);roof(ring,22.9,'flat');decorate(ring,22.9,1,true,true);
      }
    }
  }

  // Academy's south-facing central risalit, portico and courtyard, in the actual building frame.
  const academyFrame=academyToWorld;
  function abox(key,u,y,v,w,h,d){const p=academyFrame(u,v);box(key,p.x,y,p.z,w,h,d,GATE.angle);}
  patch('grass',[-69,77].flatMap((u,i)=>i?[academyFrame(u,-33),academyFrame(u,-3.5)]:[academyFrame(u,-3.5),academyFrame(u,-33)]),.056);
  patch('sidewalk',[academyFrame(-10,-39),academyFrame(23,-39),academyFrame(23,-14.3),academyFrame(-10,-14.3)],.071);
  // Slightly raised pavilion roof and projecting entrance canopy, no fictitious restored dome.
  abox('trim',6.6,6.2,-17.1,20,.75,6.2);
  for(const u of [-2,3.8,9.4,15.2]) {
    const p=academyFrame(u,-19.4);cylinder('trim',p.x,3,p.z,.31,5.8);cylinder('stone',p.x,.3,p.z,.53,.6);cylinder('trim',p.x,5.8,p.z,.49,.28);
  }
  for(let i=0;i<5;i++)abox('trim',6.6,.1+i*.15,-21.5+i*.6,19,.2+i*.3,1.1);
  // A pair of small equestrian silhouettes flanks the entrance terrace (Dioscuri).
  for(const u of [-6.5,19.5]) {
    abox('stone',u,.72,-23.3,2.2,1.4,2.5);
    abox('trim',u,1.49,-23.3,2.4,.2,2.7);
    const p=academyFrame(u,-23.3);
    add('bronze',new THREE.SphereGeometry(1,10,7),p.x,2.55,p.z,GATE.angle,1.08,.48,.46);
    for(const du of [-.72,.72])for(const dv of [-.27,.27]) {
      const q=academyFrame(u+du,-23.3+dv);cylinder('bronze',q.x,2.02,q.z,.11,1.1);
    }
    const neck=academyFrame(u-.9,-23.3);sphere('bronze',neck.x,3.02,neck.z,.32,.62,.31);
    const head=academyFrame(u-1.1,-23.3);sphere('bronze',head.x,3.48,head.z,.40,.26,.22);
    const rider=academyFrame(u+.2,-23.3);cylinder('bronze',rider.x,3.4,rider.z,.24,1.15,.20);sphere('bronze',rider.x,4.1,rider.z,.23,.26,.23);

  }

  ACADEMY_PLINTHS.forEach(register);

  // Triumphal arch: a single extruded wall with open-bottom arch cuts, not dark painted openings.
  const s=new THREE.Shape();s.moveTo(-11.75,0);
  for(const [u,w,h] of [[-7.3,3.6,7.1],[0,6.9,11.7],[7.3,3.6,7.1]]) {
    const r=w/2; s.lineTo(u-r,0);s.lineTo(u-r,h-r);
    s.absarc(u,h-r,r,Math.PI,0,true);s.lineTo(u+r,0);
  }
  s.lineTo(11.75,0);s.lineTo(11.75,20.5);s.lineTo(-11.75,20.5);s.closePath();
  const gateGeo=new THREE.ExtrudeGeometry(s,{depth:GATE.depth,bevelEnabled:false,steps:1,curveSegments:16});
  add('stone',gateGeo,GATE.x-Math.sin(GATE.angle)*GATE.depth/2,0,GATE.z-Math.cos(GATE.angle)*GATE.depth/2,GATE.angle);
  for(const p of GATE_PIERS)register(p);
  const gp=(u,y,v)=>{const p=gateToWorld(u,v);return {x:p.x,y,z:p.z};};
  function gbox(key,u,y,v,w,h,d){const p=gp(u,y,v);box(key,p.x,y,p.z,w,h,d,GATE.angle);}
  function garch(u,w,h,v) {
    const r=w/2,coords=[];
    for(let i=0;i<20;i++) {
      const a=Math.PI*i/20,b=Math.PI*(i+1)/20;
      for(const [rr,t] of [[r,a],[r,b],[r+.30,b],[r,a],[r+.30,b],[r+.30,a]])coords.push(u+rr*Math.cos(t),h-r+rr*Math.sin(t),v);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(coords.length/3*2),2));
    add('trim',g,GATE.x,0,GATE.z,GATE.angle);
  }
  for(const side of [-1,1]) {
    const v=side*5.12;
    gbox('trim',0,14.1,v,24.1,.4,.55);
    gbox('trim',0,20.4,v,24.2,.4,.6);
    for(const [u,w,h]of[[-7.3,3.6,7.1],[0,6.9,11.7],[7.3,3.6,7.1]])garch(u,w,h,v+side*.03);
    for(const u of [-10.4,-4.55,4.55,10.4]) {
      const p=gp(u,6.4,v+side*.4);
      cylinder('trim',p.x,6.4,p.z,.48,9.1,.44);
      gbox('recess',u,.42,v,2.0,.8,1.2);gbox('trim',u,1.15,v,1.8,.35,1.3);
      gbox('trim',u,11.15,v,1.5,.38,1.35);gbox('trim',u,11.6,v,1.7,.45,1.5);
      for(const d of [-.4,0,.4]) {const q=gp(u+d,11.7,v+side*.7);sphere('stone',q.x,q.y,q.z,.18,.24,.18);}
      if(side===1) { // Decorated original north attic; simplified south attic remains intentionally bare.
        gbox('trim',u,14.55,v,1.8,.6,1.25);
        const q=gp(u,16.45,v+side*.35);cylinder('stone',q.x,q.y,q.z,.35,2.9,.21);sphere('stone',q.x,18.2,q.z,.34,.4,.33);
      }
    }
    for(const u of [-7.3,7.3]) {
      gbox('recess',u,9.35,v+side*.025,3.85,1.8,.10);
      // Low-relief figures, non-emissive and merged into the limestone palette.
      for(let k=0;k<5;k++) {
        const q=gp(u-1.4+k*.68,9.3,v+side*.13);
        sphere('stone',q.x,9.3,q.z,.21,.58,.12);sphere('trim',q.x,9.99,q.z,.19,.2,.10);
      }
      if(side===1) {
        const g=new THREE.CylinderGeometry(1.05,1.05,.14,24);g.rotateX(Math.PI/2);
        const q=gp(u,17,v+side*.12);add('recess',g,q.x,q.y,q.z,GATE.angle);
      }
    }
  }
  // Abstract low-relief inscription band on the SOUTH side; no fonts, emissive material or texture.
  gbox('trim',0,14.5,-5.11,18.3,.65,.12);
  for(let i=0;i<65;i++)gbox('recess',-8.8+i*.275,14.48,-5.20,.07,.22+(i%3)*.04,.025);
  gbox('stone',0,20.9,0,8.7,.5,5.4);gbox('trim',0,21.25,0,8.3,.22,5.1);
  // Bavaria and four lions, facing north as in the photos. The architectural wall is 21 m high.
  gbox('bronze',0,21.7,.1,2.4,.8,2.5);
  for(const u of [-.95,.95]) {
    const p=gp(u,21.9,-.25);const g=new THREE.TorusGeometry(.68,.11,6,12);g.rotateY(Math.PI/2);add('bronze',g,p.x,p.y,p.z,GATE.angle);
  }
  for(const u of [-2.8,-1,1,2.8]) {
    const p=gp(u,22.0,1.5);sphere('bronze',p.x,22,p.z,.48,.62,1.15);
    const head=gp(u,22.6,2.38);sphere('bronze',head.x,22.6,head.z,.47,.53,.51);
    const muzzle=gp(u,22.45,2.75);sphere('bronze',muzzle.x,22.45,muzzle.z,.27,.24,.36);
    for(const foot of [-.65,.65])for(const leg of [-.28,.28]) {
      const q=gp(u+leg,21.5,1.5+foot);cylinder('bronze',q.x,q.y,q.z,.14,.7);
    }
    for(const ear of [-.3,.3]){const q=gp(u+ear,23,2.37);sphere('bronze',q.x,q.y,q.z,.14,.19,.14);}
  }
  const bav=gp(0,23.9,-.55);cylinder('bronze',bav.x,23.8,bav.z,.72,3.45,.37);
  sphere('bronze',bav.x,25.85,bav.z,.43,.53,.4);
  const staff=gp(-.9,24.6,-.3);cylinder('bronze',staff.x,24.6,staff.z,.055,4.9);
  gbox('bronze',-.4,24.9,-.5,1.2,.22,.25);

  // Mapped trees: columnar crowns along Leopoldstraße; rounded crowns in the courtyards.
  let poplars=0;
  for(const [i,t]of TREES.entries()) {
    const centreline=132.5+(t.x-177)*.318;
    const poplar=t.x>185&&Math.abs(t.z-centreline)<31;
    const h=poplar?13.3+i%4:8.5+i%3;
    cylinder('bark',t.x,h*.27,t.z,.20,h*.54,.14);
    if(poplar) {
      poplars++;sphere(i%2?'foliage':'foliageLight',t.x,h*.66,t.z,1.65,h*.42,1.65);
      sphere('foliage',t.x,h*.9,t.z,1.08,2.9,1.08);
    }else sphere(i%2?'foliage':'foliageLight',t.x,h*.73,t.z,3.1,3.8,3.1);
  }
  // Small boulevard lamps, without point lights or emissive bloom.
  for(let x=203;x<471;x+=29)for(const side of [-1,1]) {
    const z=132.5+(x-177)*.318+side*23;
    cylinder('bronze',x,3.35,z,.085,6.7);
    box('bronze',x,6.8,z,.65,.16,.65);box('trim',x,6.55,z,.36,.48,.36);
  }

  // A material bucket is one draw call. Only large stone/plaster masses get the engine's ink hull.
  for(const [key,geometries]of buckets) {
    const geometry=mergeGeometries(geometries,false);
    geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error(`Siegestor: incompatible ${key} geometry`);
    const material=engine.toon(palette[key],key.startsWith('foliage')?3:4,{side:THREE.DoubleSide});
    ownedMaterials.add(material);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`siegestor:${key}`;
    mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);
    if(['stone','plaster','ochre','rose','cool'].includes(key)) {
      engine.outline(mesh,.045);mesh.children.forEach(c=>{if(c.material)ownedMaterials.add(c.material);});
    }
  }
  buckets.clear();
  group.userData = {
    source:'© OpenStreetMap contributors, ODbL',buildings:BUILDINGS.length+1,
    mappedTrees:TREES.length,poplars,roadWays:ROADS.length,
    renderCalls:group.children.reduce((n,m)=>n+1+m.children.length,0),
    landmarks:LANDMARKS,sector:SECTOR,
  };
  engine.scene.add(group);
  let disposed=false;
  return {group,dispose(){
    if(disposed)return;disposed=true;
    unregister.forEach(fn=>fn?.());group.removeFromParent();
    const geometries=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
    geometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());
  }};
}
