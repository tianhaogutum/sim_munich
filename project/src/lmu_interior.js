import * as THREE from 'three';
import { buildStairHall } from './stair_hall.js';
import { floorHeight } from './interior_rules.mjs';

// Stair hall reconstruction based on the user-provided photograph.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c3d4d8');
const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, .1, 90);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x756249, 1.9));
const sun = new THREE.DirectionalLight(0xffeee0, 1.1);
sun.position.set(-6, 18, 8); scene.add(sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 60 });
sun.shadow.normalBias = .035; sun.shadow.bias = -.0001;
buildStairHall(scene);

// First-person movement: solid boundaries and column collisions, with sliding.
const position = new THREE.Vector3(1, 1.7, 11);
const keys = new Set(); let yaw = 0, pitch = .23, dragging = false, lastX = 0, lastY = 0;
const photos = document.getElementById('photos');
function clearInput() { keys.clear(); dragging = false; }
addEventListener('keydown', e => {
  if (photos.open || (e.target.closest('button,a') && ['Enter','Space'].includes(e.code))) return;
  if (e.code === 'KeyE' && !e.repeat && !exploreButton.hidden) { exploreButton.click(); return; }
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { e.preventDefault(); keys.add(e.code); }
  if (e.code.startsWith('Shift')) keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
renderer.domElement.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => {
  if (!dragging) return;
  yaw -= (e.clientX - lastX) * .004; pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lastY) * .004, -1.1, 1.3);
  lastX = e.clientX; lastY = e.clientY;
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) renderer.domElement.addEventListener(event, () => dragging = false);
for (const button of document.querySelectorAll('[data-key]')) {
  button.onpointerdown = e => { e.preventDefault(); keys.add(button.dataset.key); button.setPointerCapture(e.pointerId); };
  for (const event of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(event, () => keys.delete(button.dataset.key));
}
const references = [['lmu_stair_user_reference.png','你提供的楼梯大厅参考'],['lmu_lichthof.jpg','石柱、拱廊与上层栏杆'],['lmu_glass_roof.jpg','圆形玻璃天窗'],['lmu_vestibule.jpg','入口大厅'],['lmu_stairs.jpg','楼梯空间']];
let photoIndex = 0;
function showPhoto() {
  document.getElementById('photo').src = './data/reference_photos/expansion_2026_09/' + references[photoIndex][0];
  document.getElementById('caption').textContent = references[photoIndex][1] + ' · 仓库实景参考';
}
document.getElementById('reference').onclick = () => { clearInput(); showPhoto(); photos.showModal(); };
document.getElementById('close').onclick = () => photos.close();
document.getElementById('next').onclick = () => { photoIndex = (photoIndex + 1) % references.length; showPhoto(); };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const exploreButton=document.getElementById('explore');
const discoveries=new Set();
const spots=[{x:0,z:10,h:0,label:'中央宽台阶',photo:0},{x:-3,z:-.5,h:2.4,label:'石雕与大理石基座',photo:0},{x:0,z:-13,h:6,label:'管风琴与拱廊',photo:0}];
let nearby=null;
exploreButton.onclick=()=>{
  if(nearby==='exit'){location.href='./index.html?from=interior';return;}
  if(!nearby)return;
  discoveries.add(nearby.label);photoIndex=nearby.photo;clearInput();showPhoto();photos.showModal();
  document.getElementById('discovered').textContent=`已探索 ${discoveries.size} / 3 处建筑细节`;
};
let floor=0;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05);
  let x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  let z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  if (photos.open) x = z = 0;
  const length = Math.hypot(x, z) || 1;
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5 : 2.8;
  const nx = position.x + (x * Math.cos(yaw) + z * Math.sin(yaw)) / length * speed * dt;
  const nz = position.z + (-x * Math.sin(yaw) + z * Math.cos(yaw)) / length * speed * dt;
  const xFloor=floorHeight(nx,position.z,floor);
  if(xFloor!==null){position.x=nx;floor=xFloor;}
  const zFloor=floorHeight(position.x,nz,floor);
  if(zFloor!==null){position.z=nz;floor=zFloor;}
  position.y=THREE.MathUtils.damp(position.y,floor+1.7,18,dt);
  nearby=spots.find(s=>Math.hypot(position.x-s.x,position.z-s.z)<2.7&&Math.abs(floor-s.h)<.3)||null;
  if(floor<.2&&position.z>15.5&&Math.abs(position.x)<2)nearby='exit';
  exploreButton.hidden=!nearby||photos.open;
  if(nearby)exploreButton.textContent=nearby==='exit'?'E · 返回校园广场':'E · 探索'+nearby.label;
  camera.position.copy(position); camera.rotation.set(pitch, yaw, 0, 'YXZ');
  document.getElementById('location').textContent = floor > 5.4 ? '教学楼 · 二层回廊' : floor > .2 ? '教学楼 · 楼梯' : position.z > 9 ? '教学楼 · 入口大厅' : Math.abs(position.x) > 8 ? '教学楼 · 石柱回廊' : '教学楼 · 楼梯大厅';
  renderer.render(scene, camera);
});
document.getElementById('loading').remove();
