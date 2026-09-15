import { addNeighborhoodMap } from './lmu_map.js';
// Compressed geographic reconstruction: +X north, +Z east (toward the garden).
// Sources: https://cms-cdn.lmu.de/media/lmu/downloads/kommunikation/lmu-location-map.pdf
// Existing campus/park coordinates are retained; blocks are illustrative, not surveyed.
export function outsideNeighborhood(x, z) {
  return z < -7.5 || z > 134 || Math.abs(x) > (z < 57 ? 112 : 46);
}

export function addLmuNeighborhood({ THREE, scene, obstacle, player, stopTour, faceDestination }) {
  const group = new THREE.Group(); group.name = 'lmu-neighborhood'; scene.add(group);
  const batches = new Map();
  const footprints = [];
  function block(x,y,z,w,h,d,color,rx=0,ry=0,rz=0) {
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color).push([x,y,z,w,h,d,rx,ry,rz]);
  }
  const materials=new Map();
  function detail(geometry,color,x,y,z,rx=0,ry=0,rz=0) {
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));
    const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.position.set(x,y,z);
    mesh.rotation.set(rx,ry,rz);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function roundArch(x,y,z,r,color,rotation=0) {
    detail(new THREE.TorusGeometry(r,.15,6,16,Math.PI),color,x,y,z,0,rotation);
  }
  function solid(x,z,w,h,d,color) { footprints.push({x,z,w,d}); block(x,h/2,z,w,h,d,color); obstacle(x,z,w,d); }
  function label(text,x,y,z,w=9,rotation=0) {
    const canvas=document.createElement('canvas'); canvas.width=768; canvas.height=96;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#f1ebd9'; ctx.fillRect(0,0,768,96);
    ctx.strokeStyle='#566353';ctx.lineWidth=5;ctx.strokeRect(5,5,758,86);
    ctx.fillStyle='#344339';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='32px Georgia';ctx.fillText(text,384,48,730);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w/8),new THREE.MeshStandardMaterial({map,side:THREE.DoubleSide}));
    mesh.position.set(x,y,z);mesh.rotation.y=rotation;group.add(mesh);
  }
  // Continuous north–south avenue; sidewalks and cycle lanes are walkable.
  block(0,-.19,25,226,.36,64,'#a5ad81');
  block(0,.09,31,224,.14,17,'#bcb7aa');
  block(0,.18,31,224,.06,10,'#676b6a');
  for(const z of [25.3,36.7])block(0,.2,z,224,.04,1.3,'#ad8470');
  for(const z of [23,39])block(0,.22,z,224,.14,.22,'#e0d6bf');
  for(let x=-109;x<112;x+=5)block(x,.225,31,2.5,.015,.12,'#ddd8c8');
  for(const x of [-39,0,42]) {
    // East/west connections leave existing personal garden and river untouched.
    if(x!==0) {
      block(x,.10,46,8,.12,22,'#bcb7aa');block(x,.18,46,5,.06,22,'#777a75');
    }
    for(let z=27;z<=35;z+=1.3)block(x,.23,z,3.4,.02,.65,'#e5e0d2');
  }
  function building(x,z,w,d,h,color,name) {
    solid(x,z,w,h,d,color);
    for(const y of [.5,4.2,8.2,h-.2])block(x,y,z,w+.35,.22,d+.35,'#e6d9c1');
    // Two pitched roof planes, dormers and chimneys replace flat placeholder roofs.
    const slope=.3, half=(d/2+.6)/Math.cos(slope);
    for(const side of [-1,1])block(x,h+1.2,z+side*d/4,w+.8,.18,half,'#95654d',side*slope);
    block(x,h+1.2+Math.sin(slope)*half/2,z,w+1,.2,.25,'#b57751');
    for(const dx of [-w*.3,w*.3]){block(x+dx,h+2,z, .75,2,.8,'#b5a28a');block(x+dx,h+3,z,1,.16,1,'#d4c3a5');}
    for(let dx=-w/2+2;dx<w/2;dx+=3.5)for(const side of [-1,1]) {
      block(x+dx,h+.65,z+side*d*.35,1.3,.8,1.2,'#cbbb9b');
      block(x+dx,h+.72,z+side*(d*.35+.61),.85,.55,.06,'#536764');
      block(x+dx,h+1.12,z+side*d*.35,1.55,.16,1.4,'#716b60');
    }
    for(let dx=-w/2+1.5;dx<w/2;dx+=2.5)for(let y=2;y<h-1;y+=3)for(const side of [-1,1]) {
      block(x+dx,y,z+side*(d/2+.03),1.15,1.8,.09,'#405754');
      block(x+dx,y-.98,z+side*(d/2+.14),1.45,.16,.3,'#e6d9c1');
      block(x+dx,y,z+side*(d/2+.1),.06,1.8,.05,'#bbae92');
    }
    const facing=z<31?1:-1, front=z+facing*(d/2+.21);
    // Street-facing entrance, upper-window lintels and ground-floor masonry joints.
    block(x,1.6,front,2.1,3.2,.14,'#544b3c');
    for(const dx of [-1.2,1.2])block(x+dx,1.8,front,.22,3.6,.35,'#e6d9c1');
    block(x,3.65,front,2.65,.24,.4,'#e6d9c1');
    block(x,1.55,front+facing*.1,.055,3,.06,'#bea57c');
    for(let dx=-w/2+1.5;dx<w/2;dx+=2.5)for(let y=5;y<h-1;y+=3)
      block(x+dx,y+1,front,1.5,.18,.35,'#e6d9c1');
    for(let y=.85;y<4;y+=.55)block(x,y,front-facing*.1,w,.018,.025,'#ac9c83');
    // Side elevations are visible from the cross streets.
    for(const side of [-1,1])for(let dz=-d/2+2;dz<d/2;dz+=2.6)for(let y=2;y<h-1;y+=3) {
      block(x+side*(w/2+.04),y,z+dz,.08,1.8,1.1,'#405754');
      block(x+side*(w/2+.13),y-.97,z+dz,.25,.15,1.4,'#e6d9c1');
    }
    if(name)label(name,x,4.6,front+facing*.08,Math.min(w-1,12),facing<0?Math.PI:0);
  }
  // West side: the main university is already modeled around x=0,z=-12.
  building(52,12,20,15,12,'#d5c6a5','Ludwigstraße · LMU');
  building(78,12,22,15,13,'#dac7a8','Akademiestraße');
  building(-55,11,22,17,13,'#d7c3a1','Philologicum');
  building(-84,11,25,17,14,'#d6cbb5','Schellingstraße');
  // The opposite university forum remains open in the center for the park route.
  building(63,48,26,14,11,'#d6b990','Ludwigstraße 28');
  building(-21,48,20,12,11,'#dfc9a7','Herzogliches Georgianum');
  building(-96,48,25,14,14,'#cbbb9d','Bayerische Staatsbibliothek');
  label('Professor-Huber-Platz',-16,1.5,39.7,11);
  label('Geschwister-Scholl-Platz',8.5,1.15,22.2,5.5);
  for(const x of [6.4,10.6])block(x,.55,22.2,.07,1.1,.07,'#596663');
  label('Veterinärstraße → Englischer Garten',42,3.6,42,16);
  label('Ludwigstraße',-40,3.4,24,9);
  // Siegestor: rebuilt from the local photographs.  The game scale is compressed,
  // but keeps the defining three arches, classical orders, attic reliefs and quadriga.
  const gateX=96, gateZ=31, gateStone='#d8d2c1', gateTrim='#eee7d5', bronze='#3d594e';
  const gatePiers=[22.9,28.25,33.75,39.1];
  for(const z of gatePiers) {
    solid(gateX,z,3.05,11.5,1.35,gateStone);
    // Paired engaged columns and layered capitals make the supports read as stonework.
    for(const side of [-1,1]) {
      detail(new THREE.CylinderGeometry(.27,.34,6.15,14),gateTrim,gateX-1.62,3.2,z+side*.42);
      block(gateX-1.62,.27,z+side*.42,.78,.22,.78,gateTrim);
      block(gateX-1.62,6.18,z+side*.42,.85,.3,.85,gateTrim);
      for(let y=.9;y<5.8;y+=.58) block(gateX-1.88,y,z+side*.42,.025,.028,.62,'#aaa797');
    }
  }
  // Continuous attic and the deeply shadowed, strongly stepped cornices seen in the photo.
  block(gateX,8.2,gateZ,3.35,.38,18.1,gateTrim);
  block(gateX,8.75,gateZ,3.5,.26,18.7,'#b5af9f');
  block(gateX,10.8,gateZ,3.15,4.05,18.1,gateStone);
  for(const y of [11.0,13.6,14.85]) block(gateX-.04,y,gateZ,3.55,.24,18.9,gateTrim);
  for(let z=22.2;z<40;z+=.38) block(gateX-1.82,8.45,z,.25,.2,.12,'#918d80');
  // A large central arch with two smaller side arches; openings stay walkable.
  for(const [z,r] of [[25.55,1.62],[31,2.0],[36.45,1.62]]) {
    const arch=new THREE.Mesh(new THREE.TorusGeometry(r,.18,8,32,Math.PI),new THREE.MeshStandardMaterial({color:gateTrim,roughness:.76}));
    arch.rotation.y=Math.PI/2;arch.position.set(gateX-1.72,5.05,z);arch.castShadow=arch.receiveShadow=true;group.add(arch);
    const inner=new THREE.Mesh(new THREE.TorusGeometry(r-.36,.045,6,24,Math.PI),new THREE.MeshStandardMaterial({color:'#aaa594',roughness:.85}));
    inner.rotation.y=Math.PI/2;inner.position.set(gateX-1.91,5.05,z);group.add(inner);
  }
  // Framed relief fields and round medallions reflect the photographed facade without copying it as a texture.
  for(const z of [25.55,36.45]) {
    const plaque=detail(new THREE.CylinderGeometry(1.04,1.04,.09,32),'#c4bdac',gateX-1.72,12.65,z,0,Math.PI/2);
    const rim=detail(new THREE.TorusGeometry(1.08,.07,8,32),'#e6decc',gateX-1.79,12.65,z,0,Math.PI/2);
    for(let i=0;i<6;i++) detail(new THREE.SphereGeometry(.13,7,5),'#aaa494',gateX-1.86,12.65+Math.sin(i*Math.PI/3)*.45,z+Math.cos(i*Math.PI/3)*.45);
  }
  for(const z of [28.25,33.75]) {
    block(gateX-1.72,11.85,z,.12,2.1,1.45,'#b8b1a0');
    for(let y=11.15;y<12.8;y+=.28) block(gateX-1.8,y,z,.04,.09,1.2,'#9d9788');
  }
  // The attic is crowned with Bavaria, a chariot and four bronze lions. Shapes are simple but read at walking distance.
  block(gateX,15.25,gateZ,3.8,.45,6.2,'#c1b9a6');
  block(gateX-.35,15.7,gateZ,2.0,.48,2.15,bronze);
  detail(new THREE.CylinderGeometry(.22,.3,1.3,10),bronze,gateX-.35,16.55,gateZ);
  detail(new THREE.SphereGeometry(.3,10,8),bronze,gateX-.35,17.35,gateZ);
  detail(new THREE.ConeGeometry(.24,.85,7),bronze,gateX-.35,17.82,gateZ);
  block(gateX-.12,17.12,gateZ+.65,.06,1.8,.06,bronze);
  for(const z of [29.1,30.35,31.65,32.9]) {
    const body=detail(new THREE.SphereGeometry(.48,12,8),bronze,gateX-.15,16.25,z);body.scale.set(1.7,.8,.65);
    detail(new THREE.SphereGeometry(.24,10,7),bronze,gateX-.75,16.42,z);
    for(const dz of [-.23,.23]) for(const x of [-.35,.35]) block(gateX+x,15.75,z+dz,.11,.85,.1,bronze);
  }
  // Curved boulevard lamps from the Siegestor street image replace the previous boxy poles.
  for(const z of [20.6,41.4]) {
    detail(new THREE.CylinderGeometry(.09,.13,6.8,10),'#263833',gateX-8,3.4,z);
    const hook=detail(new THREE.TorusGeometry(1.0,.07,8,20,Math.PI),'#263833',gateX-7.05,6.25,z,Math.PI/2,0,Math.PI/2);
    const lamp=detail(new THREE.SphereGeometry(.22,10,8),'#d9d2ad',gateX-6.1,5.75,z);
    lamp.material=new THREE.MeshStandardMaterial({color:'#f9e8ba',emissive:'#f3c978',emissiveIntensity:.8});
  }
  label('SIEGESTOR',gateX-2.0,9.45,gateZ,7.5,Math.PI/2);
  // Ludwigskirche: twin campaniles with pale masonry and pyramidal roofs.
  // Own church massing: the photograph has a tall nave, not apartment windows/dormers.
  solid(-62,48,22,12,14,'#dedbd0');
  for(const x of [-70,-54]) {
    solid(x,40,3.8,23,4,'#dedbd0');
    for(const y of [9,15,22.5,23])block(x,y,40,4.1,.3,4.3,'#eee9db');
    for(const dx of [-.8,.8])block(x+dx,20.5,37.96,.65,2.5,.1,'#52645c');
    for(const dx of [-.8,.8])roundArch(x+dx,21.75,37.85,.35,'#eee9db');
    // Clock dial and hands sit above the belfry as in the front photograph.
    detail(new THREE.CylinderGeometry(.48,.48,.08,24),'#344443',x,22.1,37.83,Math.PI/2);
    detail(new THREE.TorusGeometry(.5,.045,6,24),'#eee9db',x,22.1,37.76);
    block(x,22.25,37.69,.035,.34,.035,'#eee9db');
    block(x+.12,22.1,37.69,.27,.035,.035,'#eee9db');
    for(let dx=-1.8;dx<=1.8;dx+=.3)block(x+dx,22.82,37.72,.13,.45,.3,'#b4b4a7');
    const roof=new THREE.Mesh(new THREE.ConeGeometry(2.85,5,4),new THREE.MeshStandardMaterial({color:'#9caaa4'}));
    roof.position.set(x,25.6,40);roof.rotation.y=Math.PI/4;group.add(roof);
    block(x,28.6,40,.12,1.4,.12,'#b3a16d');block(x,28.8,40,.7,.12,.12,'#b3a16d');
  }
  // Round-arched church portals, rose window and stepped central gable.
  for(const x of [-66,-62,-58]) {
    block(x,1.8,40.88,2.2,3.6,.1,'#4d4638');
    roundArch(x,3.6,40.75,1.25,'#efddba');
    for(const dx of [-1.25,1.25])block(x+dx,1.8,40.75,.24,3.6,.25,'#efddba');
    block(x,1.6,40.7,.07,3.1,.07,'#b59a70');
  }
  detail(new THREE.CylinderGeometry(1.5,1.5,.12,32),'#374b49',-62,10,40.85,Math.PI/2);
  detail(new THREE.TorusGeometry(1.55,.14,8,32),'#eee9db',-62,10,40.7);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    detail(new THREE.TorusGeometry(.36,.065,6,16),'#eee9db',-62+Math.cos(a)*.83,10+Math.sin(a)*.83,40.6);
  }
  detail(new THREE.TorusGeometry(.3,.07,6,16),'#eee9db',-62,10,40.59);
  const gableShape=new THREE.Shape();
  gableShape.moveTo(-11,0);gableShape.lineTo(11,0);gableShape.lineTo(0,6);gableShape.closePath();
  detail(new THREE.ExtrudeGeometry(gableShape,{depth:.35,bevelEnabled:false}),'#dedbd0',-62,12,40.97);
  for(const side of [-1,1])block(-62+side*5.5,15,40.86,12.53,.2,.32,'#eee9db',0,0,-side*Math.atan2(6,11));
  // Five shallow statue niches across the facade beneath the rose window.
  for(let x=-67;x<=-57;x+=2.5){
    block(x,6.65,40.82,.9,1.7,.1,'#8f9388');roundArch(x,7.5,40.7,.52,'#eee9db');
    detail(new THREE.ConeGeometry(.22,1.1,8),'#e7e3d7',x,6.6,40.61);
    detail(new THREE.SphereGeometry(.16,8,6),'#e7e3d7',x,7.24,40.6);
  }
  // Aerial reference: green/gold patterned pitched nave roof.
  const roofSlope=Math.atan2(6,11);
  for(const side of [-1,1]) {
    block(-62+side*5.5,15,48,Math.hypot(11,6),.14,14,'#576e53',0,0,-side*roofSlope);
    for(let z=42;z<=54;z+=2)for(let step=1;step<11;step+=2){
      const x=-62+side*step,y=18-step*Math.tan(roofSlope)+.095;
      // Nested lozenges lie on the roof plane and suggest the photographed glazed tiles.
      block(x,y,z,1.35,.025,1.35,'#d6b85e',0,0,-side*roofSlope);
      block(x,y+.022,z,.9,.025,.9,'#50664c',0,0,-side*roofSlope);
      block(x,y+.044,z,.5,.025,.5,'#8d5847',0,0,-side*roofSlope);
    }
  }
  block(-62,18.7,41,.12,1.5,.12,'#b3a16d');block(-62,18.95,41,.85,.12,.12,'#b3a16d');
  label('ST. LUDWIG',-62,5.8,40.62,7,Math.PI);
  // Paving joints and gutters give the long avenue a consistent human scale.
  for(const z of [24.1,37.9])for(let x=-111;x<112;x+=1.2)
    block(x,.246,z,.025,.014,1.6,'#9f9d91');
  for(const z of [26,36])block(0,.23,z,224,.025,.15,'#aaa99f');
  for(let x=-105;x<110;x+=18)for(const z of [26,36]) {
    block(x,.255,z,.7,.035,.45,'#4c5350');
    for(let i=-2;i<=2;i++)block(x+i*.12,.28,z,.035,.012,.38,'#8e9287');
  }
  // Small trees stay outside crossings and existing campus/park gameplay.
  for(const x of [-101,-80,-48,54,75,106])for(const z of [21.6,39.6]) {
    if(z>31 && x<0)continue;
    block(x,.17,z,2.3,.18,2.3,'#857c63');
    detail(new THREE.CylinderGeometry(.12,.23,3.7,8),'#75664d',x,1.9,z);
    obstacle(x,z,.5,.5);
    for(let i=0;i<3;i++) {
      const crown=detail(new THREE.SphereGeometry(1,8,6),['#788b52','#91a465','#647c48'][i],x+(i-1)*.6,4+i*.5,z);
      crown.scale.set(1.1,1.4,1.2);
    }
  }
  // Street furniture, underground signs, bicycle racks and planted sidewalk edges.
  for(let x=-104;x<=106;x+=14)for(const z of [23.8,38.2]) {
    if(Math.abs(x)<25||Math.abs(x-42)<6||Math.abs(x+39)<6||Math.abs(x+62)<12||x>90)continue;
    block(x,2.8,z,.1,5.6,.1,'#45544f');block(x,5.6,z,.65,.4,.65,'#e8dcb7');
    block(x+3,.5,z,1.8,.9,1,'#b5ab95');block(x+3,1.1,z,1.6,.5,.8,'#6d8057');obstacle(x+3,z,1.8,1);
  }
  for(const x of [-9,9]) {
    block(x,1.2,24,.14,2.4,.14,'#596663');label('U · Universität',x,2.6,24,5);
    for(let i=0;i<5;i++){block(x+i*.65, .5,22,.08,1,.8,'#65716b');}
  }
  const transform=new THREE.Object3D();
  for(const [color,items] of batches) {
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color,roughness:.9}),items.length);
    items.forEach(([x,y,z,w,h,d,rx,ry,rz],i)=>{transform.position.set(x,y,z);transform.scale.set(w,h,d);transform.rotation.set(rx,ry,rz);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
    mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
  }
  // A small destination chooser makes the enlarged district immediately discoverable.
  const select=document.createElement('select');select.setAttribute('aria-label','街区地图与目的地');select.className='interface';
  Object.assign(select.style,{position:'fixed',right:'18px',top:'92px',zIndex:'3',maxWidth:'46vw',padding:'10px',borderRadius:'10px',background:'#24342dee',color:'#fff8e9',border:'1px solid #fff6'});
  const destinations=[['街区地图 · 前往…',null],['LMU 主入口',[0,18]],['路边劳斯莱斯 · 男主',[20,23.6,Math.PI]],['Ludwigstraße · 大学站',[0,28]],['Siegestor · 凯旋门',[87,31,-Math.PI/2]],['Ludwigskirche · 路德维希教堂',[-39,31,2.2]],['Veterinärstraße · 公园入口',[42,52]],['英国公园 · 溪边',[-2.5,84]]];
  for(const [name] of destinations){const option=document.createElement('option');option.textContent=name;select.append(option);}
  select.onchange=()=>{const point=destinations[select.selectedIndex][1];if(point){stopTour();player.root.position.set(point[0],.12,point[1]);faceDestination?.(point[2] ?? 0);}select.selectedIndex=0;select.blur();};
  document.body.append(select);
  select.addEventListener('keydown',event=>event.stopPropagation());
  // Shareable landmark views also let visual checks use the normal destination behavior.
  const landmark=typeof location==='undefined'?null:new URLSearchParams(location.search).get('landmark');
  const views={church:[-62,28,Math.PI],siegestor:[80,31,-Math.PI/2]};
  if(views[landmark]){const [x,z,angle]=views[landmark];player.root.position.set(x,.12,z);faceDestination?.(angle);}
  const toolbar=document.querySelector('.tools');
  const placeMenu=()=>{select.style.top=`${Math.max(100,toolbar.getBoundingClientRect().bottom+12)}px`;};
  new ResizeObserver(placeMenu).observe(toolbar);placeMenu();
  addNeighborhoodMap({player,footprints});
  return group;
}
