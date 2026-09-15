import * as THREE from 'three';

const scene = new THREE.Scene(); scene.background = new THREE.Color(0x607a88); scene.fog = new THREE.Fog(0x607a88, 42, 120);
const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, .1, 500); camera.position.set(0,11,22);
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1; document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdcecff,0x39454d,1.4)); const sun=new THREE.DirectionalLight(0xffd39b,3.6); sun.position.set(-20,30,15); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-45; sun.shadow.camera.right=45; sun.shadow.camera.top=45; sun.shadow.camera.bottom=-45; scene.add(sun); scene.add(new THREE.DirectionalLight(0x9bb8d2,.7));
const solids=[]; const mat=(c,roughness=.8)=>new THREE.MeshStandardMaterial({color:c,roughness});
function box(name,pos,size,color,solid=true){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat(color));m.name=name;m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;scene.add(m);if(solid)solids.push({x:m.position.x,z:m.position.z,w:size[0]/2+0.5,d:size[2]/2+0.5});return m;}
function blob(name,pos,scale,color){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),mat(color));m.name=name;m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
box('Geschwister-Scholl-Platz',[0,-.15,0],[42,.3,34],0xc7bba6,false); for(let x=-20;x<=20;x+=4) for(let z=-2;z<=14;z+=4) box('Paving tile',[x,.02,z],[3.8,.05,3.8],(x+z)%8===0?0xb9ad98:0xc7bba6,false); box('Ludwigstraße',[0,-.1,-25],[60,.2,10],0x555b62,false);
box('LMU Main Building',[0,6,-10],[34,12,7],0xd8c6a6); box('Central facade',[0,9.5,-6.2],[14,5,0.6],0xe3d5ba); box('Roof',[0,12.5,-10],[35,1.2,8],0x8b7765); box('Pediment',[0,13.8,-6.8],[10,2.2,1],0xd8c6a6); box('Entrance',[0,2.5,-6],[5,5,1],0x554b43); for(const x of [-3,-2,-1,0,1,2,3]) box('Entrance step',[x*1.1,.25,-5.5],[1,.35,2],0xb5a99a,false);
for(const y of [4.2,8.2]) for(const x of [-12,-8,-4,4,8,12]){box('Window',[x,y,-6.1],[2.3,2.4,.5],0x496b82,false);box('Window trim',[x,y,-6.35],[2.7,2.8,.15],0xe8d9bd,false)} for(const x of [-14,-10,-6,-2,2,6,10,14]) box('Column',[x,5,-5.8],[.45,8,.45],0xf0e0c0,false)
for(const x of [-24,24]) box('Adjacent building',[x,5,-8],[8,10,12],0xb5a994);
for(const x of [-16,-8,8,16]){box('Bench',[x,.35,5],[3,.5,.7],0x684735,false);box('Lamp',[x,2,7],[.18,4,.18],0x30343a,false);}
for(const x of [-18,18]){const t=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.5,5,10),mat(0x6b8453));t.position.set(x,2,5);t.castShadow=true;scene.add(t)}
// Layered vegetation and small props give the square a designed game-world density.
for(const [x,z] of [[-18,10],[-12,14],[-5,11],[5,13],[13,10],[18,14],[-20,2],[20,1]]){
  blob('Tree canopy',[x,4.8,z],[2.6,2.1,2.6],0x527d52);
  blob('Tree highlight',[x-.7,5.7,z-.5],[1.5,1.2,1.5],0x719963);
}
for(const [x,z] of [[-15,2],[-11,10],[-4,15],[4,15],[12,2],[17,9],[-20,12],[20,12]]){
  blob('Low shrub',[x,.65,z],[1.7,.65,1.0],0x789454);
  blob('Shrub highlight',[x-.4,1.0,z-.2],[.9,.4,.6],0x9ab36b);
}
for(const [x,z] of [[-17,16],[-9,12],[-2,16],[2,12],[10,16],[17,3],[-20,7],[20,7]]){
  blob('Flower cluster',[x,.35,z],[.35,.16,.35],0xd69a86);
  blob('Flower center',[x,.5,z],[.12,.12,.12],0xf3d38b);
}
for(let x=-20;x<=20;x+=5) box('Warm plaza tile',[x,.06,18],[3.8,.04,.04],0xd8c8a9,false);
for(const [x,z] of [[-18,13],[-6,13],[6,13],[18,13]]){const lamp=new THREE.PointLight(0xffb56f,1.2,12,2);lamp.position.set(x,4.5,z);scene.add(lamp)}
for(let i=0;i<28;i++){const x=-21+Math.random()*42,z=-1+Math.random()*20;blob('Small ground plant',[x,.3,z],[.16,.35,.16],[0xd3a66c,0xe2b38a,0x9bbd7a][i%3])}
const player=box('Player',[0,1,8],[.8,1.7,.8],0xd77b62,false); const playerHead=blob('Player head',[0,2.1,8],[.42,.42,.42],0xf0b78c); let yaw=0,pitch=.42,dist=16; const keys={}; addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
let dragging=false,lastX=0,lastY=0; renderer.domElement.addEventListener('mousedown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY}); addEventListener('mouseup',()=>dragging=false); addEventListener('mousemove',e=>{if(!dragging)return;yaw-=(e.clientX-lastX)*.005;pitch=Math.max(.05,Math.min(1.2,pitch+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY}); addEventListener('wheel',e=>dist=Math.max(5,Math.min(25,dist+e.deltaY*.01)));
function blocked(x,z){return solids.some(s=>Math.abs(x-s.x)<s.w&&Math.abs(z-s.z)<s.d)}

const points=[{name:'LMU 主入口',pos:new THREE.Vector3(0,1,-4),text:'主入口面向 Geschwister-Scholl-Platz，是这座大学主楼最醒目的城市界面。',source:'来源：LMU 官方导览｜lmu.de/de/newsroom/newsuebersicht/news/tour-durch-das-hauptgebaeude-der-lmu-f2b0e28c.html'},{name:'中央广场',pos:new THREE.Vector3(0,1,4),text:'Geschwister-Scholl-Platz 是校园与 Ludwigstraße 之间的公共开放空间。',source:'来源：OpenStreetMap｜openstreetmap.org（ODbL 1.0）'},{name:'建筑细节',pos:new THREE.Vector3(12,1,-5),text:'立柱、窗框与中央山墙组成了主楼的古典立面节奏。',source:'参考：Wikimedia Commons｜commons.wikimedia.org/wiki/Category:Hauptgebäude_der_Ludwig-Maximilians-Universität_München'}];
const markers=[]; points.forEach((p,i)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),mat([0xe58f65,0x65a3d9,0x74b886][i]));m.position.copy(p.pos);scene.add(m);markers.push(m)});
let visited=new Set(), photo=false; const panel=document.getElementById('panel');
function showPoint(i){const p=points[i];document.getElementById('title').textContent=p.name;document.getElementById('text').textContent=p.text;document.getElementById('source').textContent=p.source;panel.style.display='block';visited.add(i);updateStatus()}
function updateStatus(){document.getElementById('status').textContent=`目标：参观 ${visited.size}/3 个观光点${photo?' · 拍照模式':''}`}
document.getElementById('close').onclick=()=>panel.style.display='none'; addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p'){photo=!photo;document.getElementById('hud').style.opacity=photo?.25:1;updateStatus()} if(e.key.toLowerCase()==='e'){let best=-1,bd=3;points.forEach((p,i)=>{const d=player.position.distanceTo(p.pos);if(d<bd){bd=d;best=i}});if(best>=0)showPoint(best)}}); updateStatus();

const clock=new THREE.Clock(); document.getElementById('shot').onclick=()=>{const a=document.createElement('a');a.download='lmu-sightseeing.png';a.href=renderer.domElement.toDataURL('image/png');a.click()};
function loop(){const dt=Math.min(clock.getDelta(),.05);let speed=keys.shift?8:4;let dx=0,dz=0;if(keys.w)dz-=1;if(keys.s)dz+=1;if(keys.a)dx-=1;if(keys.d)dx+=1;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const c=Math.cos(yaw),s=Math.sin(yaw);const nx=player.position.x+(dx*c-dz*s)*speed*dt,nz=player.position.z+(dx*s+dz*c)*speed*dt;if(!blocked(nx,player.position.z))player.position.x=nx;if(!blocked(player.position.x,nz))player.position.z=nz;playerHead.position.set(player.position.x,2.1,player.position.z);camera.position.set(player.position.x+Math.sin(yaw)*dist*Math.cos(pitch),player.position.y+Math.sin(pitch)*dist,player.position.z+Math.cos(yaw)*dist*Math.cos(pitch));camera.lookAt(player.position.x,1.5,player.position.z);const dirs=['北','东北','东','东南','南','西南','西','西北'];document.getElementById('compass').textContent='指南针：'+dirs[Math.round(((yaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8];renderer.render(scene,camera);requestAnimationFrame(loop)} loop(); addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
