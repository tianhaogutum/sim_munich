// Static west-Maxvorstadt block. three.js r160, no build step or runtime data fetch.
// © OpenStreetMap contributors, ODbL — see assets/osm/maxvorstadt_west.sources.json.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointInPolygon } from './date_geo.mjs';
import { BUILDINGS, STREETS, TREES, BICYCLE_PARKING, SECTOR, LANDMARKS, clipRing, insideSector, insideBuilding, nearestStreet } from './lmu_block_maxvorstadt_west_data.mjs';
export { LANDMARKS };

const PALETTE = [0xb99679,0xc2aa80,0x9daa92,0xc7a08b,0xafada0,0xbbaa82,0x9faeb3,0xbaa695];
const AWNING = [0x547a6c,0xa95750,0xc09b58,0x586e87];
const LABELS = ['BUCH & BLATT','KLEINES CAFÉ','ATELIER','KAFFEEZEIT','BÜCHER','KIOSK','Amalienstraße','Schellingstraße','Türkenstraße','Adalbertstraße','Blütenstraße'];
const TAU = Math.PI * 2;

export function createBlock(engine) {
  const { THREE } = engine;
  const group = new THREE.Group(); group.name = 'maxvorstadt_west';
  const materials = [], geometries = [], textures = [], batches = new Map();
  const boxes = [], arches = [], furniture = [], bikeSpots = [], cafeSpots = [], shopEdges = [];
  const stats = { buildings: BUILDINGS.length, trees: TREES.length, windows: 0, shops: 0, balconies: 0, cafeTables: 0, bikes: 0, kiosks: 0, streetSegments: 0 };
  const color = new THREE.Color(), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scale = new THREE.Vector3();
  const up = new THREE.Vector3(0,1,0);
  function material(opts={}) { const m=engine.toon(0xffffff,4,{vertexColors:true,...opts}); materials.push(m); return m; }
  const solidMat=material(), roofMat=material(), groundMat=material(), detailMat=material(), natureMat=material();
  function prepared(g,c) {
    let n=g.index?g.toNonIndexed():g; if(n!==g)g.dispose();
    n.deleteAttribute('uv'); color.setHex(c); const arr=new Float32Array(n.attributes.position.count*3);
    for(let i=0;i<arr.length;i+=3){arr[i]=color.r;arr[i+1]=color.g;arr[i+2]=color.b;}
    n.setAttribute('color',new THREE.BufferAttribute(arr,3)); return n;
  }
  function put(name,g,c) { if(!batches.has(name))batches.set(name,[]); batches.get(name).push(prepared(g,c)); }
  function rawMesh(vertices,indices) {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));if(indices)g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function planar(ring,y,name,c) {
    if(ring.length<3)return;
    const tri=THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(p.x,-p.z)),[]);
    put(name,rawMesh(ring.flatMap(p=>[p.x,y,p.z]),tri.flat()),c);
  }
  function rectangle(name,a,b,width,y,c) {
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.01)return;
    const nx=-dz/len*width/2,nz=dx/len*width/2;
    const ring=clipRing([{x:a.x+nx,z:a.z+nz},{x:b.x+nx,z:b.z+nz},{x:b.x-nx,z:b.z-nz},{x:a.x-nx,z:a.z-nz}]);
    planar(ring,y,name,c);
  }
  function box(x,y,z,w,h,d,c,yaw=0,target=boxes) {
    const sx=Math.abs(Math.cos(yaw))*w/2+Math.abs(Math.sin(yaw))*d/2;
    const sz=Math.abs(Math.sin(yaw))*w/2+Math.abs(Math.cos(yaw))*d/2;
    if(!insideSector(x-sx,z-sz)||!insideSector(x+sx,z+sz))return false;
    target.push({x,y,z,w,h,d,c,yaw});return true;
  }
  function arch(x,y,z,w,h,c,yaw=0) {
    if(!insideSector(x,z,Math.max(w*.5,.2)))return;
    arches.push({x,y,z,w,h,d:1,c,yaw});
  }
  function at(edge,u,y,offset=0) { return {x:edge.a.x+edge.dx*u+edge.nx*offset,y,z:edge.a.z+edge.dz*u+edge.nz*offset}; }
  function edgeBox(edge,u,y,offset,w,h,d,c) {const p=at(edge,u,y,offset);return box(p.x,y,p.z,w,h,d,c,edge.yaw);}
  const obstruction = (x,z,r=.4) => !insideSector(x,z,r)||insideBuilding(x,z)||TREES.some(t=>Math.hypot(x-t.x,z-t.z)<r+.65)||LANDMARKS.some(p=>Math.hypot(x-p.x,z-p.z)<r+1.6);

  // The ground and every road ribbon are geometrically clipped, including curb widths.
  planar([{x:-150,z:-300},{x:150,z:-300},{x:150,z:-30},{x:-150,z:-30}],.012,'ground',0xa7a08b);
  for(const street of STREETS)for(const [a,b] of street.segments){
    stats.streetSegments++;
    if(street.main){
      rectangle('ground',a,b,street.width+7,.035,0xb4ad97);
      rectangle('roads',a,b,street.width,.055,0x555b60);
      const length=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
      // Setts along both kerbs, retaining a continuous walking strip outside them.
      for(let u=.6;u<length;u+=1.2)for(const side of [-1,1]){
        const offset=street.width/2+.18,x=a.x+dx*u-dz*offset*side,z=a.z+dz*u+dx*offset*side;
        box(x,.092,z,.9,.085,.3,0x969686,Math.atan2(dx,dz)+Math.PI/2);
      }
    } else rectangle('paths',a,b,street.width,.069,street.tags.surface==='asphalt'?0x727775:0xa39f90);
  }

  function makeRoof(building,roofColor) {
    const {ring,height:h,roofHeight:rh,roofShape}=building;
    if(roofShape==='flat'){planar(ring,h+.02,'roofs',roofColor);return;}
    // A continuous piecewise-planar roof field, clipped against each footprint triangle.
    // This preserves concave courtyards while giving gables actual ridges and mansards
    // a steep lower pitch, a gentle upper pitch, and a capped crest (no triangle peaks).
    let longest=0,ux=1,uz=0;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b.x-a.x,b.z-a.z);
      if(len>longest){longest=len;ux=(b.x-a.x)/len;uz=(b.z-a.z)/len;}
    }
    const local=ring.map(p=>({...p,u:p.x*ux+p.z*uz,v:-p.x*uz+p.z*ux}));
    const minU=Math.min(...local.map(p=>p.u)),maxU=Math.max(...local.map(p=>p.u));
    const minV=Math.min(...local.map(p=>p.v)),maxV=Math.max(...local.map(p=>p.v));
    const gabled=['gabled','double_saltbox','skillion'].includes(roofShape);
    const mansard=['mansard','gambrel'].includes(roofShape);
    const planes=[];
    const addEdges=(slope,intercept,onlyNarrow)=>{
      if(!onlyNarrow||maxU-minU<maxV-minV){planes.push([slope,0,intercept-slope*minU],[-slope,0,intercept+slope*maxU]);}
      if(!onlyNarrow||maxV-minV<=maxU-minU){planes.push([0,slope,intercept-slope*minV],[0,-slope,intercept+slope*maxV]);}
    };
    if(mansard){addEdges(1.5,0,false);addEdges(.32,1.652,false);}
    else addEdges(gabled?rh/(Math.min(maxU-minU,maxV-minV)/2):.65,0,gabled);
    planes.push([0,0,rh]);
    const value=(p,plane)=>plane[0]*p.u+plane[1]*p.v+plane[2];
    const roofY=p=>h+Math.max(0,Math.min(...planes.map(plane=>value(p,plane))));
    const vertices=[];
    const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});
    const tri=THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(p.x,-p.z)),[]);
    for(const indices of tri)for(let active=0;active<planes.length;active++){
      let polygon=indices.map(i=>local[i]);
      for(let other=0;other<planes.length&&polygon.length;other++){
        if(other===active)continue;
        const out=[];
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length];
          const da=value(a,planes[active])-value(a,planes[other]),db=value(b,planes[active])-value(b,planes[other]);
          if(da<=1e-7)out.push(a);
          if((da<0&&db>0)||(da>0&&db<0))out.push(mix(a,b,da/(da-db)));
        }
        polygon=out;
      }
      for(let i=1;i+1<polygon.length;i++){
        const pts=[polygon[0],polygon[i],polygon[i+1]];
        if(Math.abs((pts[1].x-pts[0].x)*(pts[2].z-pts[0].z)-(pts[2].x-pts[0].x)*(pts[1].z-pts[0].z))<1e-7)continue;
        // Top faces must have upward normals, independent of earcut winding.
        if((pts[1].z-pts[0].z)*(pts[2].x-pts[0].x)-(pts[1].x-pts[0].x)*(pts[2].z-pts[0].z)<0)pts.reverse();
        for(const p of pts)vertices.push(p.x,roofY(p),p.z);
      }
    }
    // Gable ends and courtyard-facing roof cheeks close the roof down to the eaves.
    for(let i=0;i<local.length;i++){
      const a=local[i],b=local[(i+1)%local.length],cuts=[0,1];
      for(let j=0;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
        const da=value(a,planes[j])-value(a,planes[k]),db=value(b,planes[j])-value(b,planes[k]);
        if(da*db<0)cuts.push(da/(da-db));
      }
      cuts.sort((a,b)=>a-b);
      for(let j=1;j<cuts.length;j++){
        if(cuts[j]-cuts[j-1]<1e-6)continue;
        const p=mix(a,b,cuts[j-1]),q=mix(a,b,cuts[j]),ph=roofY(p),qh=roofY(q);
        if(ph-h<1e-5&&qh-h<1e-5)continue;
        vertices.push(p.x,h,p.z,q.x,qh,q.z,q.x,h,q.z,p.x,h,p.z,p.x,ph,p.z,q.x,qh,q.z);
      }
    }
    put('roofs',rawMesh(vertices),roofColor);
  }

  for(const b of BUILDINGS){
    const {ring,height:h,levels,id,tags}=b;
    let c=PALETTE[id%PALETTE.length];
    if(tags['building:material']==='brick')c=0xac7c62;
    if(tags['building:material']==='concrete')c=0xa4a7a1;
    if(tags.building==='university')c=[0xb3a17e,0xb5a58a,0xaa9c83][id%3];
    const verts=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],v=ring[(i+1)%ring.length];
      verts.push(a.x,0,a.z,v.x,h,v.z,v.x,0,v.z,a.x,0,a.z,a.x,h,a.z,v.x,h,v.z);
    }
    put('buildings',rawMesh(verts),c);
    const roofColor=tags['roof:colour']==='#E96B39'?0x926957:tags['roof:colour']==='#6EBE9F'?0x63897c:id%4===0?0x795d55:0x5c6065;
    makeRoof(b,roofColor);
    if(b.area<70)continue;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],v=ring[(i+1)%ring.length],len=Math.hypot(v.x-a.x,v.z-a.z);
      if(len<4)continue;
      // Clipping cuts are deliberately undecorated party walls.
      if((Math.abs(a.x-v.x)<1e-6&&(Math.abs(a.x)===150))||(Math.abs(a.z-v.z)<1e-6&&(a.z===-300||a.z===-30)))continue;
      const edge={a,dx:(v.x-a.x)/len,dz:(v.z-a.z)/len,nx:(v.z-a.z)/len,nz:-(v.x-a.x)/len,len};edge.yaw=Math.atan2(edge.nx,edge.nz);
      const center=at(edge,len/2,0),near=nearestStreet(center.x,center.z),streetward=near.distance<24&&((near.x-center.x)*edge.nx+(near.z-center.z)*edge.nz)>1;
      // Skip internal shared party walls where another OSM building adjoins.
      if(insideBuilding(center.x+edge.nx*.5,center.z+edge.nz*.5))continue;
      const bays=Math.max(1,Math.floor((len-1)/3.15)),step=(len-1)/bays;
      const floors=Math.max(1,Math.min(7,Math.round(levels))),floorH=(h-.65)/floors;
      edgeBox(edge,len/2,.38,.06,len,.55,.18,0x8f8877);
      edgeBox(edge,len/2,h-.23,.1,len,.44,.27,0xc5bb9f);
      edgeBox(edge,len/2,Math.min(4.15,floorH+.2),.08,len,.21,.20,0xc5bb9f);
      for(let floor=1;floor<floors;floor++){
        const wy=floor*floorH+floorH*.46,wh=Math.min(2.15,floorH*.66);
        if(floor===1||streetward)edgeBox(edge,len/2,floor*floorH-.04,.09,len,.1,.16,0xb8ac93);
        for(let col=0;col<bays;col++){
          const u=.5+step*(col+.5),ww=Math.min(1.38,step*.47),p=at(edge,u,wy,.115);
          stats.windows++;
          const oldArch=streetward&&floor===1&&id%3===0;
          if(oldArch){
            arch(p.x,wy-wh/2,p.z,ww+.25,wh+.2,0xcec3a7,edge.yaw);const g=at(edge,u,wy,.135);arch(g.x,wy-wh/2+.1,g.z,ww,wh,0x4a6066,edge.yaw);
          }else{
            edgeBox(edge,u,wy,.10,ww+.26,wh+.23,.16,0xcfc3a6);
            edgeBox(edge,u,wy,.20,ww,wh,.10,0x4b6166);
          }
          edgeBox(edge,u,wy,.265,.065,wh,.055,0xbeb69e);
          edgeBox(edge,u,wy+.22,.265,ww,.065,.055,0xbeb69e);
          edgeBox(edge,u,wy-wh/2-.15,.18,ww+.45,.14,.35,0xbeb199);
          if(streetward&&floor===2&&col%3===1&&len>11){
            stats.balconies++;
            edgeBox(edge,u,wy-wh/2-.22,.57,2.05,.18,1.15,0xc1b298);
            edgeBox(edge,u,wy-wh/2+.61,1.12,2.05,.09,.07,0x414c4e);
            for(let k=-3;k<=3;k++)edgeBox(edge,u+k*.29,wy-wh/2+.20,1.12,.05,.82,.05,0x414c4e);
            for(const side of [-1,1])edgeBox(edge,u+side*.99,wy-wh/2+.61,.6,.07,.09,1.1,0x414c4e);
          }
          if(streetward&&floor===floors-1&&id%2===0&&b.roofShape!=='flat'){
            edgeBox(edge,u,h+.8,-.8,ww+0.28,1.8,.9,roofColor);
            edgeBox(edge,u,h+.8,-.30,ww,1.35,.09,0x45575c);
          }
        }
      }
      // Recessed ground-floor portals remain on the true OSM wall plane.
      for(let col=0;col<bays;col++){
        const u=.5+step*(col+.5),ww=Math.min(2.10,step*.7),p=at(edge,u,1.6,.09);
        if(streetward){
          box(p.x,1.58,p.z,ww+.28,2.7,.16,0xc1b296,edge.yaw);
          edgeBox(edge,u,1.55,.20,ww,2.48,.1,0x334c52);
          edgeBox(edge,u,1.55,.28,.07,2.45,.05,0xb4ae9d);
          if(col%2===0){
            const label=(id+col)%6,aw=AWNING[(id+col)%4];
            edgeBox(edge,u,3.5,.27,Math.min(step*1.8,len-1),.68,.25,0x384b49);
            shopEdges.push({edge,u,y:3.5,offset:.42,label,width:Math.min(step*1.65,len-1)});
            for(let stripe=0;stripe<10;stripe++){
              const w=Math.min(step*1.85,len-1),off=(stripe-4.5)*w/10;
              edgeBox(edge,u+off,3.09,.88,w/10,.14,1.6,stripe%2?0xc9bda0:aw);
              edgeBox(edge,u+off,2.88,1.65,w/10,.38,.1,stripe%2?0xc9bda0:aw);
            }
            stats.shops++;
            // Terrace candidates are filtered against the real road, every building and POIs.
            for(const cu of [u-.85,u+.85]){
              const p=at(edge,cu,0,2.7),r=nearestStreet(p.x,p.z);
              if((label===1||label===3)&&!obstruction(p.x,p.z,1.1)&&r.distance>r.street.width/2+.65&&r.distance<r.street.width/2+5)cafeSpots.push({...p,yaw:edge.yaw,street:r.street.name});
            }
          }
        }else if(col%2===0){
          edgeBox(edge,u,1.9,.11,1.45,2.25,.16,0xb6ad98);
          edgeBox(edge,u,1.9,.21,1.19,1.98,.08,0x4b6267);
        }
      }
    }
  }

  // Café terraces; each cluster is decorative, but its table is a small collision circle.
  const tables=[];
  cafeSpots.sort((a,b)=>Math.sin(a.x*12.9898+a.z*78.233)-Math.sin(b.x*12.9898+b.z*78.233));
  for(const p of cafeSpots){
    if(tables.length>=38||tables.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<2.3))continue;
    tables.push(p);furniture.push({x:p.x,z:p.z,r:.58});stats.cafeTables++;
    box(p.x,.74,p.z,1.05,.12,.9,0x9d7956,p.yaw);
    box(p.x,.37,p.z,.13,.68,.13,0x465354);
    const dx=Math.cos(p.yaw),dz=-Math.sin(p.yaw);
    for(const s of [-1,1]){
      const x=p.x+s*dx*.83,z=p.z+s*dz*.83;
      box(x,.44,z,.50,.10,.54,0x6b7e71,p.yaw);
      box(x,.78,z,.50,.64,.08,0x6b7e71,p.yaw);
      box(x,.21,z,.34,.42,.34,0x455351,p.yaw);
    }
    if(stats.cafeTables%4===0){
      const mx=p.x+dx*1.35,mz=p.z+dz*1.35;
      if(!obstruction(mx,mz,.5)){
        box(mx,.63,mz,.55,1.12,.14,0x314c45,p.yaw);
        box(mx,.08,mz,.65,.12,.5,0x8b7558,p.yaw);
        for(let row=0;row<4;row++)box(mx,.4+row*.14,mz,.34,.025,.18,0xc8bea1,p.yaw);
      }
    }
    if(stats.cafeTables%3===0){
      const cone=new THREE.ConeGeometry(1.45,.48,8);cone.translate(p.x,2.65,p.z);put('props',cone,0xc4ac83);
      box(p.x,1.36,p.z,.07,2.7,.07,0x686a5b);
    }
  }

  // Map-derived bicycle parking and procedural fallback racks along the same mapped kerbs.
  const parking=parkingPositions();
  function parkingPositions(){
    const result=BICYCLE_PARKING.filter(p=>!obstruction(p.x,p.z,1.1)).map(p=>({...p,yaw:Math.atan2(-nearestStreet(p.x,p.z).dz,nearestStreet(p.x,p.z).dx)}));
    for(const street of STREETS)if(street.main)for(const [a,b] of street.segments){
      const len=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;
      for(let u=7;u<len-3;u+=18)for(const s of [-1,1]){
        const offset=street.width/2+1.1,x=a.x+u*dx-s*dz*offset,z=a.z+u*dz+s*dx*offset;
        if(!obstruction(x,z,1.1)&&!tables.some(p=>Math.hypot(p.x-x,p.z-z)<2.6))result.push({x,z,yaw:Math.atan2(-dz,dx)});
      }
    }
    return result;
  }
  for(const p of parking){
    for(let i=0;i<3;i++){
      const dx=Math.cos(p.yaw),dz=-Math.sin(p.yaw),x=p.x+dx*(i-1)*1.12,z=p.z+dz*(i-1)*1.12;
      if(!obstruction(x,z,1.05))bikeSpots.push({x,z,yaw:p.yaw+.3});
    }
    if(bikeSpots.length>=138)break;
  }

  // Compact fictional newspaper kiosks, placed on open paved edges, never over OSM buildings.
  for(const p of [{x:-107,z:-162,yaw:1.98},{x:119,z:-56,yaw:1.98},{x:102,z:-251,yaw:1.98}]){
    if(obstruction(p.x,p.z,2.2)||tables.some(t=>Math.hypot(p.x-t.x,p.z-t.z)<3))continue;
    box(p.x,1.32,p.z,2.3,2.6,1.65,0x56736d,p.yaw);
    box(p.x,2.74,p.z,2.6,.27,1.94,0x435552,p.yaw);
    const nx=Math.sin(p.yaw),nz=Math.cos(p.yaw);
    box(p.x+nx*.84,1.57,p.z+nz*.84,1.92,1.15,.06,0x34484e,p.yaw);
    box(p.x+nx*1.03,.92,p.z+nz*1.03,2.14,.16,.50,0xa59d82,p.yaw);
    const edge={a:{x:p.x,z:p.z},dx:Math.cos(p.yaw),dz:-Math.sin(p.yaw),nx,nz,yaw:p.yaw};
    shopEdges.push({edge,u:0,y:2.28,offset:.86,label:5,width:1.9});
    furniture.push({x:p.x,z:p.z,r:1.45});stats.kiosks++;
  }

  // One atlas, one draw for all signs, menu boards and street plaques.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<LABELS.length;i++){
    const y=i*80;ctx.fillStyle=i<6?'#eee0b8':'#dadbd0';ctx.fillRect(0,y,1024,76);
    ctx.strokeStyle=i<6?'#455c54':'#304d71';ctx.lineWidth=7;ctx.strokeRect(6,y+5,1012,66);
    ctx.fillStyle=i<6?'#304a42':'#284364';ctx.font=`${i<6?'bold ':''}48px Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(LABELS[i],512,y+38,970);
  }
  const atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=Math.min(8,engine.renderer.capabilities.getMaxAnisotropy());textures.push(atlas);
  const signMat=new THREE.MeshBasicMaterial({map:atlas,side:THREE.DoubleSide});materials.push(signMat);
  const signParts=[];
  function sign(x,y,z,w,h,yaw,label){
    const hw=Math.abs(Math.cos(yaw))*w/2,hd=Math.abs(Math.sin(yaw))*w/2;
    if(!insideSector(x-hw,z-hd)||!insideSector(x+hw,z+hd))return;
    const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setY(i,1-(label*80+4+(1-uv.getY(i))*68)/1024);
    g.rotateY(yaw);g.translate(x,y,z);signParts.push(g);
  }
  for(const s of shopEdges){const p=at(s.edge,s.u,s.y,s.offset);sign(p.x,p.y,p.z,s.width,.5,s.edge.yaw,s.label);}
  for(const [name,label] of [['Amalienstraße',6],['Schellingstraße',7],['Türkenstraße',8],['Adalbertstraße',9],['Blütenstraße',10]]){
    const st=STREETS.find(s=>s.name===name);if(!st)continue;
    const [a,b]=st.segments[0],len=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;
    const p={x:a.x+dx*Math.min(15,len/2)-dz*(st.width/2+2.3),z:a.z+dz*Math.min(15,len/2)+dx*(st.width/2+2.3)};
    if(obstruction(p.x,p.z,1.5))continue;
    box(p.x,1.85,p.z,.08,3.7,.08,0x526366);
    sign(p.x,3.5,p.z,2.9,.42,Math.atan2(-dz,dx),label);
  }
  if(signParts.length){const g=mergeGeometries(signParts);signParts.forEach(g=>g.dispose());geometries.push(g);const mesh=new THREE.Mesh(g,signMat);mesh.name='shop-and-street-signs';group.add(mesh);}

  // Merged large masses receive the house's inverted-hull outline once per material batch.
  for(const [name,parts] of batches){
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometries.push(geometry);
    const mat=name==='buildings'?solidMat:name==='roofs'?roofMat:['ground','roads','paths'].includes(name)?groundMat:detailMat;
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.receiveShadow=false;mesh.castShadow=false;
    if(name==='buildings')engine.outline(mesh,.045);
    group.add(mesh);
  }
  function instances(name,g,items,mat){
    if(!items.length){g.dispose();return;}
    geometries.push(g);const mesh=new THREE.InstancedMesh(g,mat,items.length);mesh.name=name;
    for(let i=0;i<items.length;i++){
      const p=items[i];pos.set(p.x,p.y||0,p.z);q.setFromAxisAngle(up,p.yaw||0);scale.set(p.w||1,p.h||1,p.d||1);matrix.compose(pos,q,scale);mesh.setMatrixAt(i,matrix);if(p.c!==undefined){color.setHex(p.c);mesh.setColorAt(i,color);}
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
  }
  // Box instancing mixes frame/stone/awning colours; glass remains opaque to avoid sorting costs.
  instances('facade-details-and-furniture',new THREE.BoxGeometry(1,1,1),boxes,material({vertexColors:false}));
  const arched=new THREE.Shape();arched.moveTo(-.5,0);arched.lineTo(.5,0);arched.lineTo(.5,.65);arched.quadraticCurveTo(.5,1,0,1);arched.quadraticCurveTo(-.5,1,-.5,.65);arched.closePath();
  instances('arched-windows',new THREE.ShapeGeometry(arched,8),arches,material({vertexColors:false,side:THREE.DoubleSide}));

  function bikeGeometry(){
    const parts=[];
    function add(g,c){parts.push(prepared(g,c));}
    function beam(a,b,r,c){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r,r,va.distanceTo(vb),5);const rot=new THREE.Quaternion().setFromUnitVectors(up,vb.clone().sub(va).normalize());g.applyQuaternion(rot);g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);add(g,c);}
    for(const x of [-.57,.57]){const g=new THREE.TorusGeometry(.34,.038,5,14);g.translate(x,.36,0);add(g,0x354449);for(let a=0;a<Math.PI;a+=Math.PI/3)beam([x-Math.cos(a)*.3,.36-Math.sin(a)*.3,0],[x+Math.cos(a)*.3,.36+Math.sin(a)*.3,0],.01,0x8d9795);}
    for(const [a,b] of [[[-.57,.36,0],[-.15,.43,0]],[[-.57,.36,0],[-.32,.96,0]],[[-.15,.43,0],[-.32,.96,0]],[[-.32,.96,0],[.35,.96,0]],[[-.15,.43,0],[.35,.96,0]],[[.35,.96,0],[.57,.36,0]]])beam(a,b,.035,0xaa6958);
    beam([-.15,.43,-.13],[-.15,.43,.13],.025,0x3e4c4c);beam([.32,1.12,-.22],[.32,1.12,.22],.025,0x3e4c4c);beam([.35,.96,0],[.32,1.12,0],.025,0x3e4c4c);
    const saddle=new THREE.BoxGeometry(.27,.065,.18);saddle.translate(-.33,1.01,0);add(saddle,0x3b484b);
    const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
  }
  instances('parked-bicycles',bikeGeometry(),bikeSpots,natureMat);stats.bikes=bikeSpots.length;

  function treeGeometry(){
    const parts=[];let g=new THREE.CylinderGeometry(.14,.22,4.6,6);g.translate(0,2.3,0);parts.push(prepared(g,0x786c50));
    for(const [x,y,z,r,c] of [[0,5.3,0,2.45,0x6b8f69],[-1.1,4.8,.4,1.8,0x809b6c],[.9,5.9,.3,1.65,0x8c9f72],[0,6.7,0,1.6,0x749665]]){g=new THREE.IcosahedronGeometry(r,1);g.scale(1,1.18,1);g.translate(x,y,z);parts.push(prepared(g,c));}
    const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
  }
  instances('osm-street-trees',treeGeometry(),TREES.map(t=>({x:t.x,z:t.z,w:.85,h:Math.min(1.45,t.height/8.6),d:.85})),natureMat);
  for(const t of TREES)furniture.push({x:t.x,z:t.z,r:.35});
  const unregister=engine.addBlocker((x,z)=>insideBuilding(x,z)||furniture.some(p=>(p.x-x)**2+(p.z-z)**2<p.r*p.r));
  engine.scene.add(group);
  stats.drawCalls=0;group.traverse(o=>{if(o.isMesh)stats.drawCalls++;});
  group.userData={sector:SECTOR,stats,cafeLocations:tables.map(p=>({x:p.x,z:p.z,street:p.street})),source:'© OpenStreetMap contributors, ODbL',buildingIds:BUILDINGS.map(b=>b.id)};
  let disposed=false;
  return {group,dispose(){
    if(disposed)return;disposed=true;unregister();group.removeFromParent();
    const gs=new Set(geometries),ms=new Set(materials);group.traverse(o=>{if(o.isMesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});
    for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of textures)t.dispose();
  }};
}
