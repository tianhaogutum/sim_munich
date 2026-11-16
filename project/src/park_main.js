// Standalone Chapter 2. Shared engine surface: project/DATE_CONTRACT.md.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createAudio } from './date_audio.js';
import { createInput } from './date_input.js';
import { createBanter } from './date_banter.js';
import { createCinematic } from './date_cinematic.js';
import { createParkScene } from './park_scene.js';
import { BOUNDS, SPAWN, SIGHTS, BRIDGES, TEMPLE, blocked, heightAt, terrainHeight, streamCenter, streamWidth, legacyToDate } from './park_layout.mjs';

const $ = id => document.getElementById(id);
const canvas=$('c'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xc8d3ce,95,235);
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.15,700);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.35,.6,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
function gradient(n){const d=new Uint8Array(n*4);for(let i=0;i<n;i++){const v=Math.round(i/(n-1)*255);d.set([v,v,v,255],i*4);}const t=new THREE.DataTexture(d,n,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;}
const G3=gradient(3),G4=gradient(4);
const toon=(color,steps=4,opts={})=>new THREE.MeshToonMaterial({color,gradientMap:steps===3?G3:G4,...opts});
const outlineMaterials=new Map();
function outline(mesh,thickness=.03){
  let material=outlineMaterials.get(thickness);
  if(!material){material=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{t:{value:thickness}},vertexShader:'uniform float t;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*t,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(.075,.065,.12,1.);}'});outlineMaterials.set(thickness,material);}
  const hull=new THREE.Mesh(mesh.geometry,material);hull.renderOrder=-1;mesh.add(hull);return mesh;
}
const sky=new THREE.Mesh(new THREE.SphereGeometry(550,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
  uniforms:{topCol:{value:new THREE.Color(0x3c71b8)},midCol:{value:new THREE.Color(0x92c9df)},horCol:{value:new THREE.Color(0xffdfb5)}},
  vertexShader:'varying float vY;void main(){vY=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 topCol,midCol,horCol;varying float vY;void main(){vec3 c=mix(horCol,midCol,smoothstep(-.07,.25,vY));c=mix(c,topCol,smoothstep(.15,.85,vY));gl_FragColor=vec4(c,1.);}'}));scene.add(sky);
const sun=new THREE.DirectionalLight(0xffe4bd,2.5);sun.position.set(50,65,-45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:.5,far:230});sun.shadow.bias=-.0004;sun.shadow.normalBias=.045;
sun.target.position.set(98,0,0);scene.add(sun,sun.target);
const hemi=new THREE.HemisphereLight(0xc7e8ff,0x899064,1.45);scene.add(hemi,new THREE.AmbientLight(0xffeed9,.35));
// Soft cloud banks are unlit toon silhouettes, kept away from the playable horizon.
const clouds=new THREE.Group();scene.add(clouds);const cloudMat=new THREE.MeshBasicMaterial({color:0xfff0da});
for(let i=0;i<22;i++){const a=i*2.399,r=200+(i%3)*30;for(let j=0;j<4;j++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),cloudMat);m.position.set(96+Math.cos(a)*r+j*5,47+(i%5)*10+(j%2)*2,Math.sin(a)*r);m.scale.set(10+(j%3)*4,3+(j%2)*2,5);clouds.add(m);}}

const search=new URLSearchParams(location.search),raw=search.get('pos')?.split(',').map(Number);
const start=raw?.length===2&&raw.every(Number.isFinite)&&!blocked(...raw)?{x:raw[0],z:raw[1]}:SPAWN;
const player={pos:new THREE.Vector3(start.x,heightAt(start.x,start.z),start.z),yaw:SPAWN.yaw};
const keys={},locks=new Set();let pitch=.26,camDist=13,drag=null,photoActive=false,toastTimer;
const camPos=player.pos.clone().add(new THREE.Vector3(-12,6,0)),camTarget=player.pos.clone().add(new THREE.Vector3(0,1.6,0));
const engine={THREE,scene,camera,renderer,composer,canvas,player,blocked,heightAt,toon,outline,
  lock:id=>locks.add(id),unlock:id=>locks.delete(id),isLocked:()=>locks.size>0,isPhotoMode:()=>photoActive,
  days:Math.max(0,Math.floor((Date.now()-new Date('2024-03-15'))/86400000)),audio:null,companion:null,cameraOverride:null,getCameraTarget:()=>camTarget,
  capture({maxWidth=0,type='image/png',quality=.92}={}){composer.render();if(!maxWidth||canvas.width<=maxWidth)return canvas.toDataURL(type,quality);const out=document.createElement('canvas');out.width=maxWidth;out.height=Math.round(canvas.height*maxWidth/canvas.width);out.getContext('2d').drawImage(canvas,0,0,out.width,out.height);return out.toDataURL(type,quality);},
  toast(text,ms=3000){$('park-toast').textContent=text;$('park-toast').style.opacity='1';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('park-toast').style.opacity='0',ms);},
  route:{POIS:{white_rose:{x:-10000,z:-10000},fountain:SIGHTS.find(s=>s.id==='wave')},FOUNTAINS:Array.from({length:11},(_,i)=>({x:48+i*9,z:streamCenter(48+i*9)})),PHOTO_TARGETS:[]},
};
// No Chapter 1 story state or persistence is read/written by this page.
const story={getState:()=>({stage:'park'}),subscribe:()=>()=>{},dispatch(){}};
const park=createParkScene(engine);const audio=createAudio(engine,story);engine.audio=audio;
const input=createInput(engine,story),banter=createBanter(engine,story),cinematic=createCinematic(engine,story);
const visited=new Set();let nearest=null,lastFocus=null;
$('days-num').textContent=engine.days;
$('park-objectives').replaceChildren(...SIGHTS.map((s,i)=>{const li=document.createElement('li');li.dataset.sight=s.id;li.innerHTML=`<span class="pk-dot">${i+1}</span><span>${s.short}</span><span class="pk-distance"></span>`;return li;}));
const rows=[...$('park-objectives').children];
function closePanel(){if($('panel').hidden)return;$('panel').hidden=true;engine.unlock('park-panel');lastFocus?.focus?.();}
function openSight(id){
  const s=SIGHTS.find(s=>s.id===id);if(!s)return false;
  lastFocus=document.activeElement;
  $('panel-kicker').textContent=s.subtitle;$('panel-icon').textContent=s.icon;$('panel-title').textContent=s.name;$('panel-text').textContent=s.text;$('panel-source').textContent=s.note;
  $('panel').hidden=false;engine.lock('park-panel');$('panel-close').focus();
  if(!visited.has(id)){
    visited.add(id);audio.cue('collect');const row=rows[SIGHTS.indexOf(s)];row.classList.add('visited');row.querySelector('.pk-dot').textContent='✓';
    $('park-count').textContent=`${visited.size} / ${SIGHTS.length}`;
    if(visited.size===SIGHTS.length){$('park-finish').hidden=false;engine.toast('五处风景，都有你。今天的散步完成啦 ♡',5500);audio.cue('ending');}
  }
  return true;
}
$('panel-close').onclick=closePanel;$('panel-continue').onclick=closePanel;
function setPhoto(value){
  if(value&&!$('panel').hidden)return;
  photoActive=value;$('park-photo').hidden=!value;document.body.classList.toggle('pk-photo-active',value);
  if(value)engine.lock('park-photo');else engine.unlock('park-photo');
}
function shutter(){
  try{const a=document.createElement('a');a.href=engine.capture({maxWidth:2400});a.download=`our-lmu-park-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;a.click();audio.cue('shutter');engine.toast('这阵风，收进照片里了 ♡');}catch(error){engine.toast('照片暂时没有保存成功，请再试一次。');console.error(error);}
}
$('park-shutter').onclick=shutter;$('park-photo-close').onclick=()=>setPhoto(false);
let dusk=search.get('dusk')==='1',duskAmount=dusk?1:0;
$('park-time').onclick=()=>{dusk=!dusk;$('park-time').textContent=dusk?'☾ 回到午后':'☀ 傍晚一点';};
if(dusk)$('park-time').textContent='☾ 回到午后';

function editing(e){return e.isComposing||e.keyCode===229||e.target?.closest?.('input,textarea,select,[contenteditable=true]');}
addEventListener('keydown',e=>{
  if(editing(e)||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();keys[k]=true;
  if(e.repeat){if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();return;}
  if(!$('panel').hidden){
    if(k==='escape'||k==='enter'||k==='e')closePanel();
    if(k==='tab'){const buttons=[$('panel-close'),$('panel-continue')];const at=buttons.indexOf(document.activeElement);buttons[(at+(e.shiftKey?-1:1)+2)%2].focus();}
    e.preventDefault();return;
  }
  if(photoActive&&(k==='p'||k==='escape')){setPhoto(false);e.preventDefault();return;}
  if(cinematic.handleKey(k,e)){e.preventDefault();return;}
  if(audio.handleKey(k,e)){e.preventDefault();return;}
  if(k==='p'){setPhoto(!photoActive);e.preventDefault();return;}
  if(k===' '&&photoActive){shutter();e.preventDefault();return;}
  if(k==='e'&&!engine.isLocked()&&nearest){openSight(nearest.id);e.preventDefault();return;}
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;drag=null;});
canvas.addEventListener('mousedown',e=>{if(e.button===0&&!engine.cameraOverride&&!locks.has('park-panel'))drag={x:e.clientX,y:e.clientY};});
addEventListener('mouseup',()=>drag=null);
addEventListener('mousemove',e=>{if(!drag||engine.cameraOverride)return;player.yaw-=(e.clientX-drag.x)*.004;pitch=Math.max(.08,Math.min(1.15,pitch+(e.clientY-drag.y)*.004));drag={x:e.clientX,y:e.clientY};});
addEventListener('wheel',e=>{if(!engine.cameraOverride&&!locks.has('park-panel'))camDist=Math.max(5,Math.min(28,camDist+e.deltaY*.012));},{passive:true});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});

const clock=new THREE.Clock(),ideal=new THREE.Vector3(),look=new THREE.Vector3(),sunDay=new THREE.Color(0xffe4bd),sunDusk=new THREE.Color(0xffb777);
const topDay=new THREE.Color(0x3c71b8),topDusk=new THREE.Color(0x4d4577),midDay=new THREE.Color(0x92c9df),midDusk=new THREE.Color(0xbc8baf),horDay=new THREE.Color(0xffdfb5),horDusk=new THREE.Color(0xfac094);
const cameraRay=new THREE.Raycaster(),cameraDirection=new THREE.Vector3();
// Keep one delayed park line in the shared bubble queue. This suppresses its
// campus-specific ambient triggers without modifying the Chapter 1 module.
const parkLines=['沿着小溪慢慢走吧。','那边的圆亭，像藏在树上的云。','你看，鸭子也在散步呢。','下次还想和你来这里。','桥的另一边，灯笼已经亮起来了。','不赶时间，再陪我坐一会吧。'];
banter.say('companion',parkLines[0],{delay:3,duration:4.5});
banter.say('companion',parkLines[1],{delay:30,duration:4.5});
let hudTime=0,parkSpeechTime=0,parkLineAt=24,lineIndex=2;
// Public debugging controls keep QA reproducible without a second input/controller.
window.__park={engine,story,park,audio,input,banter,cinematic,visited,SIGHTS,BRIDGES,TEMPLE,BOUNDS,blocked,heightAt,terrainHeight,streamCenter,streamWidth,legacyToDate,
  openSight,closePanel,setPhoto,shutter,setDusk(value){dusk=!!value;},
  teleport(x,z,yaw=player.yaw){if(blocked(x,z))return false;player.pos.set(x,heightAt(x,z),z);player.yaw=yaw;return true;},
  setView({x,z,yaw=player.yaw,pitch:p=.26,distance=13}){if(!this.teleport(x,z,yaw))return false;pitch=p;camDist=distance;return true;},
};
function loop(){
  requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05),et=clock.elapsedTime;
  input.update(dt);
  let mx=Number(!!(keys.d||keys.arrowright))-Number(!!(keys.a||keys.arrowleft)),mz=Number(!!(keys.s||keys.arrowdown))-Number(!!(keys.w||keys.arrowup));
  if(engine.isLocked())mx=mz=0;
  const len=Math.hypot(mx,mz)||1,speed=keys.shift?8.5:4.2,cy=Math.cos(player.yaw),sy=Math.sin(player.yaw);
  const nx=player.pos.x+(mx*cy+mz*sy)/len*speed*dt,nz=player.pos.z+(mz*cy-mx*sy)/len*speed*dt;
  if(!blocked(nx,player.pos.z))player.pos.x=nx;if(!blocked(player.pos.x,nz))player.pos.z=nz;player.pos.y=heightAt(player.pos.x,player.pos.z);
  park.update(dt,et);audio.update(dt,et);cinematic.update(dt,et);document.body.classList.toggle('pk-free',cinematic.isFreeCam());
  ideal.set(player.pos.x+Math.sin(player.yaw)*camDist*Math.cos(pitch),player.pos.y+1.6+Math.sin(pitch)*camDist,player.pos.z+Math.cos(player.yaw)*camDist*Math.cos(pitch));
  // Keep the spring arm above terrain even while looking uphill.
  ideal.y=Math.max(ideal.y,terrainHeight(ideal.x,ideal.z)+1.1);camPos.lerp(ideal,1-Math.exp(-7*dt));look.copy(player.pos).y+=1.6;camTarget.lerp(look,1-Math.exp(-12*dt));
  if(engine.cameraOverride){engine.cameraOverride(dt,et);camPos.copy(camera.position);}else{
    camera.position.copy(camPos);
    // A spring arm must not put the viewer inside a tree crown or temple roof.
    cameraDirection.copy(camPos).sub(camTarget);const distance=cameraDirection.length();
    cameraRay.set(camTarget,cameraDirection.normalize());cameraRay.far=distance;
    scene.updateMatrixWorld();const hit=cameraRay.intersectObjects(park.cameraBlockers,false)[0];
    if(hit)camera.position.copy(camTarget).addScaledVector(cameraDirection,Math.max(.7,hit.distance-.35));
    camera.lookAt(camTarget);
  }
  park.avatar.visible=camera.position.distanceTo(player.pos)>2.3;
  park.companion.root.visible=camera.position.distanceTo(park.companion.root.position)>1.5;
  sky.position.copy(camera.position);
  nearest=null;let best=5.2;
  for(const s of SIGHTS){const dist=Math.hypot(s.x-player.pos.x,s.z-player.pos.z);if(dist<best){nearest=s;best=dist;}}
  const canInteract=nearest&&!engine.isLocked()&&!photoActive;
  $('prompt').style.display=canInteract?'block':'none';if(canInteract)$('prompt').innerHTML=`<kbd>E</kbd> ${nearest.icon} ${nearest.short}${visited.has(nearest.id)?' · 再看一眼':''}`;
  hudTime+=dt;
  if(hudTime>.2){hudTime=0;rows.forEach((row,i)=>{row.querySelector('.pk-distance').textContent=visited.has(SIGHTS[i].id)?'已到访':`${Math.round(Math.hypot(SIGHTS[i].x-player.pos.x,SIGHTS[i].z-player.pos.z))} m`;});
    const next=SIGHTS.find(s=>!visited.has(s.id));$('park-waypoint').textContent=next?`下一站 · ${next.short}`:'五处风景，一起收藏';$('park-compass').textContent=`N ${['↑','↗','→','↘','↓','↙','←','↖'][((Math.round(player.yaw/(Math.PI/4))%8)+8)%8]}`;}
  duskAmount+=(Number(dusk)-duskAmount)*(1-Math.exp(-dt*1.5));park.setDusk(duskAmount);
  sun.color.copy(sunDay).lerp(sunDusk,duskAmount);sun.intensity=2.5-duskAmount*.75;hemi.intensity=1.45-duskAmount*.45;
  sky.material.uniforms.topCol.value.copy(topDay).lerp(topDusk,duskAmount);sky.material.uniforms.midCol.value.copy(midDay).lerp(midDusk,duskAmount);sky.material.uniforms.horCol.value.copy(horDay).lerp(horDusk,duskAmount);
  if(!engine.isLocked()&&!photoActive){parkSpeechTime+=dt;if(parkSpeechTime>parkLineAt){banter.say('companion',parkLines[lineIndex++%parkLines.length],{delay:34,duration:4.5});parkLineAt+=28;}}
  banter.update(dt,et);composer.render();
}
loop();$('park-loading').hidden=true;
