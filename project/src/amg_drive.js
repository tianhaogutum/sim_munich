import {carFootprint,stepCar} from './car_physics.mjs';

export function createSportsCar({THREE,scene,renderer,player,blocked,toast,setView,stopTour,isPaused}) {
  const root=new THREE.Group();root.name='matte-black-gt';scene.add(root);
  // A local studio reflection texture gives matte paint and glazing readable highlights.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#e1e8ea');gradient.addColorStop(.48,'#87999e');gradient.addColorStop(.5,'#46514d');gradient.addColorStop(1,'#242c29');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
  ctx.fillStyle='#ffffff';ctx.fillRect(60,30,150,23);ctx.fillRect(340,65,120,17);
  const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(texture).texture;texture.dispose();pmrem.dispose();
  const paint=new THREE.MeshPhysicalMaterial({color:'#24272b',metalness:.85,roughness:.4,clearcoat:.35,clearcoatRoughness:.38,envMap:environment,envMapIntensity:1.2});
  const glass=new THREE.MeshPhysicalMaterial({color:'#43565e',metalness:.35,roughness:.12,transparent:true,opacity:.68,envMap:environment,side:THREE.DoubleSide});
  const trim=new THREE.MeshStandardMaterial({color:'#131619',metalness:.55,roughness:.33,envMap:environment});
  const chrome=new THREE.MeshStandardMaterial({color:'#a7adb0',metalness:1,roughness:.23,envMap:environment});
  const rubber=new THREE.MeshStandardMaterial({color:'#17191b',roughness:.94});
  const lamp=new THREE.MeshStandardMaterial({color:'#e4f4ff',emissive:'#b5d9ff',emissiveIntensity:1.3});
  const red=new THREE.MeshStandardMaterial({color:'#9b2226',emissive:'#d92222',emissiveIntensity:.5});
  function mesh(geo,mat,x=0,y=0,z=0,parent=root){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function box(x,y,z,w,h,d,mat=paint,parent=root){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
  function sphere(x,y,z,sx,sy,sz,mat=paint,parent=root){const m=mesh(new THREE.SphereGeometry(1,24,16),mat,x,y,z,parent);m.scale.set(sx,sy,sz);return m;}
  // Lofted continuous body: low pointed nose, long hood, wider rear haunches.
  function loft(profiles,mat){
    const vertices=[],indices=[],count=12;
    for(const [z,w,bottom,top] of profiles)for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2;vertices.push(Math.cos(a)*w,bottom+(top-bottom)*(Math.sin(a)+1)/2,z);
    }
    for(let j=0;j<profiles.length-1;j++)for(let i=0;i<count;i++){const a=j*count+i,b=j*count+(i+1)%count,c=a+count,d=b+count;indices.push(a,b,c,b,d,c);}
    for(const offset of [0,(profiles.length-1)*count])for(let i=1;i<count-1;i++)indices.push(offset,offset+i+(offset?0:1),offset+i+(offset?1:0));
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(geo,mat);
  }
  loft([[-2.32,.72,.28,.62],[-2.17,.89,.26,.8],[-1.65,.96,.3,.91],[-.95,.91,.3,.91],[.05,.88,.29,.94],[.8,.96,.3,1],[1.55,.97,.3,.98],[2.12,.83,.3,.82],[2.27,.71,.36,.7]],paint);
  // Coupe cabin starts well behind the front axle.
  loft([[-.57,.66,.8,.91],[-.12,.64,.86,1.34],[.35,.65,.86,1.43],[.86,.64,.86,1.37],[1.48,.63,.86,.99]],glass);
  loft([[-.1,.59,1.31,1.35],[.3,.61,1.38,1.43],[.8,.58,1.32,1.38]],paint);
  for(const side of [-1,1]){
    // Window pillars, door sill, handle and side intake.
    const pillar=box(side*.65,1.13,-.32,.075,.58,.08);pillar.rotation.x=-.68;
    const rearPillar=box(side*.65,1.15,1.05,.09,.57,.12);rearPillar.rotation.x=.82;
    box(side*.87,.52,.43,.085,.13,2.3,trim);
    box(side*.89,.89,.69,.055,.055,.25,chrome);
    box(side*.907,.65,-.94,.035,.18,.5,trim);
    for(const y of [.61,.68])box(side*.93,y,-.94,.025,.025,.43,chrome);
    sphere(side*1.015,1.01,-.05,.16,.075,.13);box(side*.87,.98,-.05,.18,.045,.06,trim);
    box(side*.88,.76,.35,.017,.012,1.35,trim);
    // Thin door seam follows the rear edge.
    box(side*.91,.65,1.02,.017,.38,.016,trim);
    for(const z of [-1.49,1.46]){
      // Body-colored wheel-arch lips frame the exposed tyres.
      const arch=mesh(new THREE.TorusGeometry(.43,.055,8,32,Math.PI),paint,side*.92,.42,z);arch.rotation.y=Math.PI/2;
    }
  }
  box(0,.23,-2.21,1.69,.065,.24,trim);box(0,.27,2.1,1.65,.1,.24,trim);
  box(0,.52,-2.28,1.12,.39,.085,trim);
  for(let x=-.51;x<=.52;x+=.09){const bar=box(x,.52,-2.339,.025,.35,.024,chrome);bar.rotation.z=-x*.12;}
  // Circular three-spoke emblem, with no invented registration plate.
  mesh(new THREE.TorusGeometry(.12,.012,8,32),chrome,0,.54,-2.365);
  for(let i=0;i<3;i++){const spoke=box(0,.54,-2.369,.014,.22,.012,chrome);spoke.rotation.z=i*Math.PI*2/3;}
  for(const side of [-1,1]){
    box(side*.72,.36,-2.16,.34,.18,.11,trim);
    const housing=box(side*.685,.79,-2.05,.39,.14,.12,trim);housing.rotation.y=side*.28;
    const led=box(side*.69,.79,-2.12,.34,.025,.025,lamp);led.rotation.y=side*.28;
    for(let i=0;i<3;i++)box(side*(.58+i*.075),.83,-2.115,.018,.065,.025,lamp);
    box(side*.62,.75,2.12,.47,.05,.045,red);
    const exhaust=mesh(new THREE.CylinderGeometry(.075,.075,.15,16),chrome,side*.64,.3,2.24);exhaust.rotation.x=Math.PI/2;
  }
  // Wheels have tyre sidewalls, brake discs, calipers and ten thin spokes.
  const wheels=[];
  for(const side of [-1,1])for(const z of [-1.49,1.46]){
    const steer=new THREE.Group();steer.position.set(side*.89,.41,z);root.add(steer);
    const wheel=new THREE.Group();steer.add(wheel);wheels.push({steer,wheel,front:z<0});
    const tyre=mesh(new THREE.CylinderGeometry(.405,.405,.25,40),rubber,0,0,0,wheel);tyre.rotation.z=Math.PI/2;
    const disc=mesh(new THREE.CylinderGeometry(.29,.29,.015,32),chrome,side*.14,0,0,wheel);disc.rotation.z=Math.PI/2;
    const rim=mesh(new THREE.TorusGeometry(.335,.035,8,40),trim,side*.153,0,0,wheel);rim.rotation.y=Math.PI/2;
    for(let i=0;i<10;i++){const angle=i*Math.PI/5;const spoke=box(side*.17,Math.cos(angle)*.17,Math.sin(angle)*.17,.045,.34,.025,trim,wheel);spoke.rotation.x=angle;}
    const hub=mesh(new THREE.CylinderGeometry(.065,.065,.025,16),chrome,side*.19,0,0,wheel);hub.rotation.z=Math.PI/2;
    box(side*.135,.1,.2,.08,.18,.09,red,steer);
  }
  for(const side of [-1,1]){sphere(side*.34,.81,.5,.22,.12,.28,trim);sphere(side*.34,1.01,.82,.21,.3,.12,trim);}
  const steeringWheel=mesh(new THREE.TorusGeometry(.14,.022,8,24),trim,-.34,1.03,-.08);steeringWheel.rotation.x=-.6;
  let state={x:12,z:31,heading:-Math.PI/2,speed:0,steer:0},driving=false;
  root.position.set(state.x,.05,state.z);root.rotation.y=state.heading;
  const button=document.createElement('button');button.textContent='找到黑色跑车';document.querySelector('.tools').append(button);
  const status=document.createElement('div');status.className='glass interface';status.setAttribute('role','status');status.style.cssText='position:fixed;left:50%;bottom:95px;transform:translateX(-50%);z-index:3;padding:9px 15px;font-size:13px;display:none';document.body.append(status);
  function canOccupy(x,z,angle){return carFootprint(x,z,angle).every(([px,pz])=>pz>24.8&&pz<37.2&&!blocked(px,pz));}
  function nearby(){return Math.hypot(player.root.position.x-state.x,player.root.position.z-state.z)<3.5;}
  function exit(){
    if(Math.abs(state.speed)>.15){toast('先按空格刹停，再下车');return;}
    for(const side of [-1,1]){
      const x=state.x+Math.cos(state.heading)*side*1.8,z=state.z-Math.sin(state.heading)*side*1.8;
      if(blocked(x,z))continue;
      driving=false;player.setRiding(false);player.root.position.set(x,.12,z);player.root.rotation.y=state.heading;status.style.display='none';button.textContent='上车 · F';toast('已下车，拉布拉多回到身边');return;
    }
    toast('两侧空间不足，请移到宽敞处停车');
  }
  function interact(){
    if(isPaused())return;
    if(driving){exit();return;}
    if(!nearby())return;
    driving=true;state.speed=0;stopTour();player.setRiding(true);button.textContent='停车后下车 · F';toast('W 加速 · S 刹车/倒车 · A D 转向 · 空格刹车 · F 下车');
  }
  button.onclick=()=>{if(isPaused())return;if(driving||nearby())interact();else{player.root.position.set(state.x-Math.cos(state.heading)*1.9,.12,state.z+Math.sin(state.heading)*1.9);setView(state.heading);toast('已来到停车处，再点上车或按 F');}};
  function update(dt,keys){
    if(driving){
      // Destination shortcuts also end driving safely instead of dragging the car across the map.
      if(Math.hypot(player.root.position.x-state.x,player.root.position.z-state.z)>5){driving=false;state.speed=0;player.setRiding(false);status.style.display='none';return;}
      const paused=isPaused();state=stepCar({...state,hit:false},{forward:!paused&&(keys.has('KeyW')||keys.has('ArrowUp')),reverse:!paused&&(keys.has('KeyS')||keys.has('ArrowDown')),left:!paused&&(keys.has('KeyA')||keys.has('ArrowLeft')),right:!paused&&(keys.has('KeyD')||keys.has('ArrowRight')),brake:paused||keys.has('Space')},dt,canOccupy);
      root.position.set(state.x,.05,state.z);root.rotation.y=state.heading;
      player.root.position.set(state.x,.12,state.z);player.root.rotation.y=state.heading;
      setView(state.heading);status.style.display='block';status.textContent=`${Math.round(Math.abs(state.speed)*3.6)} km/h · ${state.speed<-.05?'R 倒车':'D'} · 空格刹车 · F 下车`;
      wheels.forEach(({steer,wheel,front})=>{steer.rotation.y=front?state.steer:0;wheel.rotation.x-=state.speed*dt/.405;});
      red.emissiveIntensity=keys.has('Space')||keys.has('KeyS')?2:.5;
    }else button.textContent=nearby()?'上车 · F':'找到黑色跑车';
  }
  return {update,interact,isDriving:()=>driving,blocks:(x,z)=>{const dx=x-state.x,dz=z-state.z;return Math.abs(Math.cos(state.heading)*dx-Math.sin(state.heading)*dz)<1.12&&Math.abs(Math.sin(state.heading)*dx+Math.cos(state.heading)*dz)<2.47;}};
}
