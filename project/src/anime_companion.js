// Procedural adult character with chestnut hair and softly lit, tailored clothing.
// Retains root/body/legs/arms so walking, sitting and photo interactions still work.
export function createAnimeCompanion(THREE,scene) {
  const root=new THREE.Group(),body=new THREE.Group();root.name='anime-protagonist';root.add(body);scene.add(root);
  const mats=new Map();
  function material(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.72}));return mats.get(color);}
  function shape(geometry,color,parent,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  const sphere=new THREE.SphereGeometry(1,32,24),cube=new THREE.BoxGeometry(1,1,1);
  const oval=(p,c,x,y,z,sx,sy,sz)=>shape(sphere,c,p,x,y,z,sx,sy,sz);
  const box=(p,c,x,y,z,w,h,d)=>shape(cube,c,p,x,y,z,w,h,d);
  const skin='#efd5ca',hair='#39271f',coat='#252932',edge='#424650',shoe='#171a21';
  // Tailored double-breasted coat with angled lapels.
  shape(new THREE.CylinderGeometry(.24,.34,.85,32),coat,body,0,1.07,0,1,1,.64);
  oval(body,coat,0,1.56,0,.29,.23,.17);
  box(body,'#171b22',0,1.56,-.185,.18,.39,.08);
  for(const side of [-1,1]){
    const lapel=box(body,edge,side*.16,1.57,-.21,.14,.4,.055);lapel.rotation.z=side*.36;
    for(const y of [.88,1.1,1.32])oval(body,'#72757a',side*.16,y,-.265,.022,.022,.012);
    const pocket=box(body,'#393d46',side*.28,1,-.18,.15,.025,.035);pocket.rotation.z=side*.18;
  }
  box(body,'#171a22',0,.62,0,.53,.15,.3);
  oval(body,skin,0,1.78,-.005,.078,.16,.075);
  // Soft rounded face, bright eyes and a gentle smile.
  const portrait=new THREE.Group();portrait.position.y=1.79;portrait.scale.set(.76,.78,.8);body.add(portrait);
  const face=(color,x,y,z,sx,sy,sz)=>oval(portrait,color,x,y-1.79,z,sx,sy,sz);
  face(hair,0,1.97,.11,.26,.44,.18);
  face(skin,0,2.12,-.035,.235,.27,.205);
  face(skin,0,2.005,-.055,.185,.15,.165);
  face(hair,0,2.31,.035,.255,.175,.21);
  // Flowing continuous locks, with most hair swept over one shoulder.
  for(const side of [-1,1])for(let i=0;i<7;i++){
    const front=side===1;
    const points=[
      new THREE.Vector3(side*(.16+i*.014),.5,.015+i*.013),
      new THREE.Vector3(side*(.245+i*.011),.23,front?-.045:.1),
      new THREE.Vector3(side*(.27+i*.017),-.06,front?-.04:.15),
      new THREE.Vector3(side*(.30+i*.015),-.34,front?-.13:.17),
      new THREE.Vector3(side*(.265+i*.014),-.64,front?-.1:.14),
      new THREE.Vector3(side*(.3+i*.009),-.85+i*.016,front?-.06:.12),
    ];
    const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.027+(i%3)*.005,8,false);
    shape(geometry,i%3===0?'#574033':hair,portrait,0,0,0);
  }
  for(const side of [-1,1]){
    const fringe=face(side===1?'#493329':hair,side*.12+(side===1?-.025:0),2.33,-.14,side===1?.135:.085,.145,.045);fringe.rotation.z=-side*.48;
    face('#fff6ee',side*.096,2.113,-.225,.064,.052,.018);
    face('#80543c',side*.096,2.111,-.241,.037,.045,.01);
    face('#34231f',side*.096,2.113,-.25,.023,.032,.007);
    face('#ffffff',side*.086,2.134,-.257,.012,.014,.004);
    face('#edd5aa',side*.11,2.096,-.257,.006,.007,.003);
    const lash=face('#513a30',side*.096,2.158,-.231,.056,.006,.008);lash.rotation.z=0;
    const brow=face('#765747',side*.096,2.211,-.211,.049,.008,.009);brow.rotation.z=side*.035;
    face('#eab1ad',side*.146,2.035,-.205,.044,.022,.006);
    face(skin,side*.224,2.09,.005,.035,.068,.027);
  }
  face(skin,0,2.055,-.242,.018,.023,.015);
  // Small upturned smile instead of protruding separate lips.
  const smile=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.032,2.005-1.79,-.226),
    new THREE.Vector3(0,1.994-1.79,-.232),
    new THREE.Vector3(.032,2.005-1.79,-.226),
  ]);
  shape(new THREE.TubeGeometry(smile,12,.005,6,false),'#ba7d7b',portrait,0,0,0);
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.16,.79,0);body.add(leg);legs.push(leg);
    oval(leg,skin,0,-.22,0,.092,.26,.095);
    oval(leg,'#22232b',0,-.49,0,.095,side===1?.25:.18,.1);
    if(side===1)for(let i=0;i<3;i++)box(leg,'#4c4650',0,-.29-i*.045,-.095,.16,.018,.016);
    oval(leg,shoe,0,-.67,-.055,.105,.115,.17);
    box(leg,'#10141a',0,-.755,-.055,.21,.055,.34);
    for(let i=0;i<4;i++)box(leg,'#5a5b63',0,-.6-i*.02,-.16-i*.008,.13,.012,.025);
    const arm=new THREE.Group();arm.position.set(side*.30,1.59,0);body.add(arm);arms.push(arm);
    oval(arm,coat,side*.035,-.24,0,.10,.31,.11);
    box(arm,edge,side*.04,-.47,0,.19,.07,.20);
    oval(arm,skin,side*.04,-.56,-.015,.065,.10,.065);
  }
  // Original olive shoulder bag and pale charm.
  const strap=box(body,'#525345',-.32,1.47,.08,.085,.67,.1);strap.rotation.z=-.12;
  oval(body,'#5b5c4b',-.48,1.12,.15,.22,.29,.18);
  box(body,'#757561',-.49,1.2,-.025,.31,.16,.07);
  box(body,'#aaa58a',-.49,1.18,-.065,.08,.06,.02);
  oval(body,'#eeeadb',-.65,1.05,-.015,.065,.09,.045);
  for(const x of [-.68,-.62])oval(body,'#eeeadb',x,1.15,-.015,.025,.055,.025);
  const hand=new THREE.Object3D();hand.position.set(.04,-.58,-.025);arms[1].add(hand);

  const dog=new THREE.Group();dog.name='labrador-companion';scene.add(dog);
  const fur='#d6ad70',light='#edcf95';
  oval(dog,fur,0,.55,0,.25,.28,.48);
  oval(dog,light,0,.66,-.32,.23,.3,.24);
  const head=new THREE.Group();head.position.set(0,.86,-.43);dog.add(head);
  oval(head,light,0,0,0,.23,.22,.24);
  oval(head,fur,0,-.085,-.22,.16,.12,.18);
  oval(head,'#39302b',0,-.04,-.365,.09,.06,.047);
  for(const side of [-1,1]){
    const ear=oval(head,'#b98d59',side*.205,-.06,.015,.09,.2,.13);ear.rotation.z=side*.14;
    oval(head,'#282922',side*.125,.038,-.199,.027,.033,.018);
    oval(head,'#ffffff',side*.119,.047,-.215,.009,.01,.005);
  }
  shape(new THREE.TorusGeometry(.205,.035,6,24),'#8a4841',dog,0,.7,-.35).rotation.x=.25;
  const collar=new THREE.Object3D();collar.position.set(0,.79,-.35);dog.add(collar);
  const paws=[];
  for(const x of [-.16,.16])for(const z of [-.28,.29]){
    const leg=new THREE.Group();leg.position.set(x,.46,z);dog.add(leg);paws.push(leg);
    oval(leg,fur,0,-.17,0,.075,.22,.075);oval(leg,light,0,-.37,-.035,.09,.06,.13);
  }
  const tail=new THREE.Group();tail.position.set(0,.66,.4);dog.add(tail);
  const tailMesh=oval(tail,fur,0,.09,.22,.066,.07,.29);tailMesh.rotation.x=-.35;
  const leashGeometry=new THREE.BufferGeometry();leashGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(25*3),3));
  const leash=new THREE.InstancedMesh(new THREE.CylinderGeometry(.014,.014,1,6),material('#95584a'),24);
  leash.frustumCulled=false;leash.castShadow=true;scene.add(leash);
  const segment=new THREE.Object3D(),start=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const previous=new THREE.Vector3(),target=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3();let initialized=false;
  function update(dt,time,blocked,heightAt=()=>0){
    const pos=root.position,angle=root.rotation.y;
    target.set(pos.x+Math.cos(angle)*.95+Math.sin(angle)*.5,0,pos.z-Math.sin(angle)*.95+Math.cos(angle)*.5);
    if(!initialized||pos.distanceTo(previous)>8){
      if(blocked(target.x,target.z))target.copy(pos);
      dog.position.copy(target);dog.rotation.y=angle;initialized=true;
    }
    if(blocked(target.x,target.z))target.copy(previous);
    const oldX=dog.position.x,oldZ=dog.position.z;
    const amount=1-Math.exp(-dt*5),nx=oldX+(target.x-oldX)*amount,nz=oldZ+(target.z-oldZ)*amount;
    if(!blocked(nx,oldZ))dog.position.x=nx;
    if(!blocked(dog.position.x,nz))dog.position.z=nz;
    const dx=dog.position.x-oldX,dz=dog.position.z-oldZ,moving=Math.hypot(dx,dz)>.001;
    if(moving){const facing=Math.atan2(-dx,-dz);dog.rotation.y+=Math.atan2(Math.sin(facing-dog.rotation.y),Math.cos(facing-dog.rotation.y))*Math.min(1,dt*10);}
    dog.position.y=.12+heightAt(dog.position.x,dog.position.z);
    paws.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(time*12+(i===0||i===3?0:Math.PI))*.45:0);
    tail.rotation.y=Math.sin(time*5)*.35;head.rotation.z=Math.sin(time*1.6)*.035;
    arms[1].rotation.x=-.2;arms[1].rotation.z=-.12;
    root.updateMatrixWorld(true);dog.updateMatrixWorld(true);hand.getWorldPosition(a);collar.getWorldPosition(b);
    const vertices=leashGeometry.attributes.position;
    for(let i=0;i<25;i++){const t=i/24;vertices.setXYZ(i,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*.22,a.z+(b.z-a.z)*t);}
    for(let i=0;i<24;i++){
      start.fromBufferAttribute(vertices,i);end.fromBufferAttribute(vertices,i+1);
      direction.subVectors(end,start);segment.position.copy(start).add(end).multiplyScalar(.5);
      segment.scale.set(1,direction.length(),1);segment.quaternion.setFromUnitVectors(up,direction.normalize());
      segment.updateMatrix();leash.setMatrixAt(i,segment.matrix);
    }
    leash.instanceMatrix.needsUpdate=true;previous.copy(pos);
  }
  function setRiding(active){root.visible=!active;dog.visible=!active;leash.visible=!active;if(!active)initialized=false;}
  return {root,body,legs,arms,update,dog,setRiding};
}
