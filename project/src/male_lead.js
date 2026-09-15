// Original black-clad male lead wandering near the campus fountain.
export function createMaleLead(THREE, scene) {
  const root = new THREE.Group(); root.name = 'fountain-male-lead';
  root.position.set(3, .12, 12); scene.add(root);
  const materials = new Map();
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  function part(geometry, color, x, y, z, sx=1, sy=1, sz=1) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness: .64}));
    const mesh = new THREE.Mesh(geometry, materials.get(color));
    mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  const oval = (c,x,y,z,sx,sy,sz) => part(sphere,c,x,y,z,sx,sy,sz);
  const box = (c,x,y,z,sx,sy,sz) => part(new THREE.BoxGeometry(1,1,1),c,x,y,z,sx,sy,sz);
  const skin='#e2c2ad', coat='#17191e', trim='#30333b', hair='#202026';
  // Broad shoulders, fitted waist and a long split coat over black trousers.
  oval(coat,0,1.68,0,.37,.30,.19);
  part(new THREE.CylinderGeometry(.27,.39,.94,32,1,true),coat,0,1.13,.025,1,1,.58);
  box('#0c0e13',0,1.55,-.16,.29,.58,.08);
  oval(skin,0,1.96,0,.087,.16,.08);
  part(new THREE.CylinderGeometry(.11,.12,.17,24),'#101116',0,1.88,0,1,1,.85);
  const legs=[], arms=[];
  for (const side of [-1,1]) {
    const lapel=box(trim,side*.17,1.68,-.19,.13,.46,.035);lapel.rotation.z=side*.36;
    const hem=box(coat,side*.17,1.05,-.13,.28,.8,.10);hem.rotation.z=side*.045;
    for(const y of [1.1,1.34])oval('#55565e',side*.16,y,-.225,.019,.019,.012);
    const legStart=root.children.length;
    oval('#101218',side*.16,.56,0,.105,.5,.115);
    oval('#090b10',side*.16,.10,-.075,.125,.105,.23);
    const leg=new THREE.Group();leg.position.set(side*.16,.98,0);
    for(const child of root.children.slice(legStart)){child.position.sub(leg.position);leg.add(child);}root.add(leg);legs.push(leg);
    const armStart=root.children.length;
    const sleeve=oval(coat,side*.385,1.42,.025,.115,.36,.13);sleeve.rotation.z=side*.10;
    oval(skin,side*.35,1.075,-.015,.064,.095,.065);
    box(trim,side*.35,1.17,-.025,.18,.075,.20);
    const arm=new THREE.Group();arm.position.set(side*.385,1.72,0);
    for(const child of root.children.slice(armStart)){child.position.sub(arm.position);arm.add(child);}root.add(arm);arms.push(arm);
  }
  // Compact face with a defined jaw, straight brows and calm eyes.
  oval(skin,0,2.19,-.018,.19,.25,.167);
  oval(skin,0,2.075,-.034,.15,.13,.13);
  oval(hair,0,2.36,.025,.205,.12,.174);
  oval(hair,0,2.23,.09,.195,.21,.115);
  for(const side of [-1,1]) {
    oval(skin,side*.186,2.19,.006,.027,.055,.025);
    oval('#f3ebe2',side*.074,2.207,-.165,.045,.023,.012);
    oval('#57493f',side*.074,2.207,-.176,.021,.021,.007);
    oval('#1b1a20',side*.074,2.208,-.182,.012,.017,.004);
    oval('#ffffff',side*.068,2.215,-.186,.005,.006,.002);
    const brow=oval(hair,side*.077,2.257,-.158,.05,.009,.009);brow.rotation.z=-side*.06;
    const lock=oval(hair,side*.12,2.36,-.085,.065,.13,.065);lock.rotation.z=-side*.48;
  }
  for(let i=0;i<4;i++) {
    const lock=oval(i%2?hair:'#292a31',-.095+i*.055,2.405-i*.012,-.04,.07,.08,.14);
    lock.rotation.z=-.4;
  }
  oval(skin,0,2.155,-.176,.018,.042,.024);
  oval('#a67970',0,2.076,-.153,.036,.008,.006);
  let target=null, pause=0, phase=0;
  function update(dt,blocked,playerPosition){
    if(pause>0){pause-=dt;return;}
    if(!target){
      for(let i=0;i<12;i++){
        const candidate={x:-4+Math.random()*8,z:11+Math.random()*5};
        if(!blocked(candidate.x,candidate.z)){target=candidate;break;}
      }
      if(!target)return;
    }
    const dx=target.x-root.position.x,dz=target.z-root.position.z,d=Math.hypot(dx,dz);
    const step=Math.min(d,dt*.85),nx=root.position.x+dx/Math.max(d,.001)*step,nz=root.position.z+dz/Math.max(d,.001)*step;
    const stopped=d<.12||blocked(nx,nz)||Math.hypot(nx-playerPosition.x,nz-playerPosition.z)<.85;
    if(stopped){target=null;pause=1+Math.random()*2;legs.forEach(p=>p.rotation.x=0);arms.forEach(p=>p.rotation.x=0);return;}
    root.position.set(nx,.12,nz);
    const angle=Math.atan2(-dx,-dz);
    root.rotation.y+=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y))*Math.min(1,dt*5);
    phase+=dt*4;
    legs.forEach((p,i)=>p.rotation.x=Math.sin(phase+i*Math.PI)*.25);
    arms.forEach((p,i)=>p.rotation.x=-Math.sin(phase+i*Math.PI)*.16);
  }
  return {root,arms,legs,update};
}
