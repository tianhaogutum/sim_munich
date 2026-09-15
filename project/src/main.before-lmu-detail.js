import * as THREE from 'three';

// A small procedural world, inspired by assets/lmu-game-concept-v1.png.
const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfd3da');
scene.fog = new THREE.Fog('#d7dbc8', 48, 115);
const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, .1, 160);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe3f2ff, 0x8b835b, 2));
const sun = new THREE.DirectionalLight(0xffd39b, 3.2);
sun.position.set(-24, 32, 20); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 35, bottom: -35, far: 100 });
sun.shadow.normalBias = .035; scene.add(sun);
const palette = {};
function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  return palette[key] ||= new THREE.MeshStandardMaterial({ color, roughness: .85, ...options });
}
function mesh(geometry, color, parent = scene, options = {}) {
  const m = new THREE.Mesh(geometry, material(color, options));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function box(x, y, z, w, h, d, color, parent = scene) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), color, parent); m.position.set(x, y, z); return m;
}
function cylinder(x, y, z, top, bottom, h, color, parent = scene, segments = 16) {
  const m = mesh(new THREE.CylinderGeometry(top, bottom, h, segments), color, parent); m.position.set(x, y, z); return m;
}
function ball(x, y, z, sx, sy, sz, color, parent = scene) {
  const m = mesh(new THREE.IcosahedronGeometry(1, 1), color, parent); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}
let seed = 42;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const obstacles = [];
function obstacle(x, z, w, d) { obstacles.push({ x, z, w: w / 2 + .45, d: d / 2 + .45 }); }
function blocked(x, z) {
  return Math.abs(x) > 28 || z > 27 || z < -7.5 || obstacles.some(o => Math.abs(x - o.x) < o.w && Math.abs(z - o.z) < o.d);
}
// Limestone facade with recessed arched windows, cornices, pilasters and a pitched roof.
box(0, -.22, 2, 130, .4, 130, '#a5ad81');
box(0, -.04, 6, 62, .2, 48, '#c5baa0');
const tileGeo = new THREE.BoxGeometry(1.95, .025, 1.46);
const tiles = new THREE.InstancedMesh(tileGeo, material('#cabca2'), 36 * 26);
let ti = 0; const transform = new THREE.Object3D(); const tileColor = new THREE.Color();
for (let x = 0; x < 36; x++) for (let z = 0; z < 26; z++) {
  transform.position.set((x - 18) * 2 + (z % 2) * 1, .075, z * 1.5 - 9); transform.updateMatrix();
  tiles.setMatrixAt(ti, transform.matrix); tiles.setColorAt(ti++, tileColor.setHSL(.105, .16, .62 + random() * .13));
}
tiles.receiveShadow = true; scene.add(tiles);
const stone = '#e0c49a', trim = '#eed7af', dark = '#3b4d4c';
box(0, 7.1, -12.5, 46, 14.2, 6, stone); obstacle(0, -12.5, 46, 6);
box(0, 7.3, -8.95, 17, 14.6, 1.1, '#e8cba0');
for (const y of [.5, 4.8, 9.4, 13.8, 14.4]) box(0, y, -9.2, 46.5, .22, .75, trim);
for (let x = -22; x <= 22; x += 2) for (let y = 1; y < 14; y += .65) box(x, y, -9.48, 1.96, .022, .035, '#b6a17f');
function arch(x, y, z, w, h, color) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - w / 2);
  shape.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); shape.lineTo(-w / 2, 0);
  const m = mesh(new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: false, curveSegments: 12 }), color);
  m.position.set(x, y, z); return m;
}
for (let x = -21; x <= 21; x += 3) {
  const center = Math.abs(x) < 8;
  for (let row = 0; row < 3; row++) {
    const y = row * 4.45 + 1.1, z = center ? -8.32 : -9.36;
    arch(x, y - .14, z, 1.95, 3.35, trim); arch(x, y, z + .14, 1.55, 3.04, dark);
    box(x, y + 1.3, z + .32, .065, 2.6, .05, '#ab9977');
    for (const dy of [.7, 1.4, 2.1]) box(x, y + dy, z + .32, 1.5, .06, .05, '#ab9977');
    box(x, y - .15, z + .2, 2.1, .17, .42, trim);
  }
}
for (const x of [-8.4, -5, -1.7, 1.7, 5, 8.4]) {
  box(x, 9.4, -8.18, .4, 9.4, .44, trim);
  cylinder(x, 2.65, -7.75, .27, .33, 4.4, trim);
  box(x, .55, -7.75, .8, .35, .8, trim); box(x, 4.85, -7.75, .75, .32, .75, trim);
}
for (let i = 0; i < 5; i++) box(0, .1 + i * .09, -6.4 - i * .3, 17.5 - i * .2, .18, 2 - i * .2, '#c7b595');
for (const x of [-3, 0, 3]) { arch(x, .55, -8.02, 2.15, 3.85, '#403d32'); box(x, 1.9, -7.84, .07, 2.65, .08, '#c1a475'); }
function triangle(width, height, depth, color, x, y, z) {
  const s = new THREE.Shape(); s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(0, height); s.closePath();
  const m = mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }), color); m.position.set(x, y, z); return m;
}
const roof = box(0, 14.8, -11, 47, .25, 4.1, '#9c7153'); roof.rotation.x = .35;
const roofBack = box(0, 14.8, -14.7, 47, .25, 4.1, '#9c7153'); roofBack.rotation.x = -.35;
triangle(19, 4, .8, trim, 0, 14.1, -9);
triangle(16.4, 3.1, .12, '#b99b73', 0, 14.45, -8.1);
triangle(14.5, 2.5, .14, '#dec198', 0, 14.65, -7.94);
for (let x = -5; x <= 5; x += 1) { ball(x, 15.05 + (1 - Math.abs(x) / 6) * .3, -7.66, .18, .28, .12, trim); }
for (const side of [-1, 1]) {
  box(side * 27, 6, -8, 7, 12, 17, '#d4bf9c'); obstacle(side * 27, -8, 7, 17);
  box(side * 27, 12.2, -8, 7.5, .5, 17.5, '#93765d');
}
// Garden beds and wind-animated foliage.
const trees = [];
for (const side of [-1, 1]) {
  for (const z of [3, 13, 23]) {
    const x = side * (19 + random() * 2);
    cylinder(x, .15, z, 3.7, 3.7, .28, '#b7b092');
    cylinder(x, 3.4, z, .28, .52, 6.8, '#706347'); obstacle(x, z, 1, 1);
    const crown = new THREE.Group(); crown.position.set(x, 5.8, z); scene.add(crown);
    for (let j = 0; j < 14; j++) {
      const angle = random() * Math.PI * 2, r = random() * 2.6;
      ball(Math.cos(angle) * r, random() * 2.8, Math.sin(angle) * r, 1.7, 1.5, 1.6, ['#65784a', '#829253', '#9da35a', '#546f43'][j % 4], crown);
    }
    trees.push(crown);
  }
  for (const z of [10, 21]) {
    box(side * 12, .2, z, 7, .4, 4.8, '#b6ac8c'); box(side * 12, .43, z, 6.6, .15, 4.4, '#727447'); obstacle(side * 12, z, 7, 4.8);
    for (let j = 0; j < 20; j++) ball(side * 12 + (random() - .5) * 6, .8, z + (random() - .5) * 3.9, .65, .55, .65, ['#73834a', '#8b9855', '#596d40'][j % 3]);
    for (let j = 0; j < 35; j++) {
      const x = side * 12 + (random() - .5) * 6, zz = z + (random() - .5) * 4;
      ball(x, 1 + random() * .4, zz, .12, .13, .12, ['#e8b549', '#eacda3', '#b09bb9'][j % 3]);
    }
  }
}
// Two fountains: rings and moving ballistic water droplets.
const waterPositions = [], waterSeeds = [];
for (const x of [-12, 12]) {
  const z = 1;
  cylinder(x, .2, z, 3.7, 3.8, .4, '#bbad8c');
  const rim = mesh(new THREE.TorusGeometry(3.25, .28, 8, 48), '#d1bf99'); rim.rotation.x = Math.PI / 2; rim.position.set(x, .65, z);
  cylinder(x, .43, z, 3.1, 3.1, .08, '#7cbbb7');
  cylinder(x, 1.4, z, .35, .85, 2.2, '#c9b18a');
  cylinder(x, 2.3, z, 1.55, .5, .35, '#d1bf99');
  cylinder(x, 3.15, z, .18, .35, 1.4, '#c9b18a');
  cylinder(x, 3.9, z, .75, .25, .22, '#d1bf99'); obstacle(x, z, 7.3, 7.3);
  for (let j = 0; j < 250; j++) { waterSeeds.push({ x, z, a: random() * Math.PI * 2, phase: random(), upper: j < 70 }); waterPositions.push(0, 0, 0); }
}
const waterGeometry = new THREE.BufferGeometry(); waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
const water = new THREE.Points(waterGeometry, new THREE.PointsMaterial({ color: '#d7fbfa', size: .065, transparent: true, opacity: .8 })); scene.add(water);
function bench(x, z, angle) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; scene.add(g);
  for (const xx of [-1.3, 1.3]) { box(xx, .45, 0, .12, .9, .7, '#3b463c', g); box(xx, 1.13, -.3, .12, 1, .12, '#3b463c', g); }
  for (let i = 0; i < 3; i++) { box(0, .85, -.25 + i * .23, 3.2, .11, .19, '#8e6748', g); box(0, 1.13 + i * .23, -.38, 3.2, .17, .1, '#8e6748', g); }
  obstacle(x, z, 3.4, 1.2);
}
for (const side of [-1, 1]) {
  bench(side * 18, 17, side * -.2); bench(side * 6.7, 7, 0);
  for (const z of [6, 18]) {
    const x = side * 16;
    cylinder(x, 2.5, z, .07, .14, 5, '#3f4c3d'); cylinder(x, .23, z, .27, .38, .46, '#3f4c3d');
    box(x, 5.1, z, .48, .8, .48, '#ffe3a0'); cylinder(x, 5.57, z, 0, .5, .35, '#3f4c3d', scene, 4);
    for (const dx of [-.26, .26]) for (const dz of [-.26, .26]) box(x + dx, 5.1, z + dz, .05, .9, .05, '#3f4c3d');
  }
}
// Articulated explorer: limb pivots allow a readable walking cycle.
function person(jacket = '#e5decb', scale = 1) {
  const root = new THREE.Group(); scene.add(root); root.scale.setScalar(scale);
  const body = new THREE.Group(); root.add(body);
  box(0, 1.28, 0, .61, .72, .35, jacket, body);
  ball(0, 1.89, 0, .27, .31, .25, '#d3aa83', body);
  ball(0, 2.02, .015, .29, .23, .27, '#3f342b', body);
  box(0, 1.3, .25, .47, .57, .2, '#786f50', body); box(0, 1.14, .37, .34, .25, .08, '#938265', body);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .17, .94, 0); body.add(leg);
    box(0, -.37, 0, .23, .73, .25, '#40494a', leg); box(0, -.77, -.07, .25, .17, .43, '#e7deca', leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(side * .39, 1.57, 0); body.add(arm);
    box(0, -.26, 0, .2, .61, .24, jacket, arm); ball(0, -.6, 0, .105, .12, .1, '#d3aa83', arm); arms.push(arm);
  }
  return { root, body, legs, arms };
}
const player = person(); player.root.position.set(0, .12, 19);
const npcs = Array.from({ length: 5 }, (_, i) => { const p = person(['#82958b', '#c5b493', '#a5836a'][i % 3], .8); p.phase = i * 1.4; return p; });
function animatePerson(p, phase, moving) {
  p.legs.forEach((leg, i) => leg.rotation.x = moving ? Math.sin(phase + i * Math.PI) * .55 : 0);
  p.arms.forEach((arm, i) => arm.rotation.x = moving ? -Math.sin(phase + i * Math.PI) * .4 : Math.sin(phase * .3) * .025);
  p.body.position.y = moving ? Math.abs(Math.sin(phase)) * .045 : Math.sin(phase * .4) * .01;
}
const points = [
  { x: 0, z: -4.5, title: '主入口', text: '走近拱门，抬头看看立柱与三角山墙。这里也是本次漫游的拍照目的地。' },
  { x: -7, z: 1, title: '喷泉花园', text: '停下来，看水珠在阳光里落下。双喷泉与花园的布局参考了提供的场景概念图。' },
  { x: 7, z: 15, title: '林荫步道', text: '沿着花坛散步，拖动视角，从树荫间寻找你喜欢的构图。' }
];
const markers = points.map(p => {
  const g = new THREE.Group(); g.position.set(p.x, 1.4, p.z); scene.add(g);
  const diamond = mesh(new THREE.OctahedronGeometry(.24), '#ffe2a0', g, { emissive: '#e5b457', emissiveIntensity: .45 });
  const ring = mesh(new THREE.TorusGeometry(.45, .025, 6, 32), '#ffe2a0', g); ring.rotation.x = Math.PI / 2; ring.position.y = -1.15;
  return { g, diamond };
});
const keys = new Set(), visited = new Set();
let yaw = 0, pitch = .22, distance = 8.5, touring = false, near = -1, walkPhase = 0;
const panel = $('panel');
function clearInput() { keys.clear(); dragging = false; }
function openPoint() {
  if (near < 0) return;
  const p = points[near]; visited.add(near);
  $('title').textContent = p.title; $('text').textContent = p.text;
  $('source').textContent = '场景参考：assets/lmu-game-concept-v1.png · 艺术化重建';
  $('status').textContent = `发现 ${visited.size} / 3 处风景`; $('progress').style.width = `${visited.size / 3 * 100}%`;
  if (!panel.open) panel.showModal(); keys.clear();
}
$('close').onclick = () => panel.close(); $('hint').onclick = openPoint;
function togglePhoto() { document.body.classList.toggle('photo'); }
$('photo').onclick = togglePhoto;
function stopTour() { touring = false; $('tour').textContent = '自动漫游'; }
$('tour').onclick = () => { touring = !touring; $('tour').textContent = touring ? '停止漫游' : '自动漫游'; };
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').style.display = 'none', 2600); }
function takePhoto() {
  renderer.render(scene, camera);
  renderer.domElement.toBlob(blob => {
    if (!blob) return toast('照片保存失败，请重试。');
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'lmu-afternoon.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (Math.hypot(player.root.position.x, player.root.position.z + 4.5) < 5) $('photo-status').textContent = '✓ 已在主入口拍照';
    toast('照片已保存');
  }, 'image/png');
}
$('shot').onclick = takePhoto;
addEventListener('keydown', e => {
  if (e.target.closest('button') && ['Space', 'Enter'].includes(e.code)) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (panel.open) return;
  keys.add(e.code);
  if (!e.repeat && e.code === 'KeyE') openPoint();
  if (!e.repeat && e.code === 'KeyP') togglePhoto();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.code)) stopTour();
});
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); stopTour(); });
renderer.domElement.addEventListener('pointermove', e => { if (!dragging) return; yaw -= (e.clientX - lastX) * .005; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lastY) * .004, .1, 1.05); lastX = e.clientX; lastY = e.clientY; });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) renderer.domElement.addEventListener(event, () => dragging = false);
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); distance = THREE.MathUtils.clamp(distance + e.deltaY * .01, 3.5, 19); }, { passive: false });
document.querySelectorAll('[data-key]').forEach(button => {
  const key = `Key${button.dataset.key.toUpperCase()}`;
  button.onpointerdown = e => { e.preventDefault(); keys.add(key); button.setPointerCapture(e.pointerId); stopTour(); };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(key));
});
const clock = new THREE.Clock(); let elapsed = 0;
const desiredCamera = new THREE.Vector3(), lookAt = new THREE.Vector3();
function update(dt) {
  elapsed += dt;
  let dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  let dz = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  if (panel.open) dx = dz = 0;
  const moving = !!(dx || dz), speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6 : 3;
  if (moving) {
    const length = Math.hypot(dx, dz); dx /= length; dz /= length;
    const vx = dx * Math.cos(yaw) + dz * Math.sin(yaw), vz = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const position = player.root.position;
    const nx = position.x + vx * speed * dt, nz = position.z + vz * speed * dt;
    if (!blocked(nx, position.z)) position.x = nx;
    if (!blocked(position.x, nz)) position.z = nz;
    const target = Math.atan2(-vx, -vz), delta = Math.atan2(Math.sin(target - player.root.rotation.y), Math.cos(target - player.root.rotation.y));
    player.root.rotation.y += delta * Math.min(1, dt * 12);
  }
  walkPhase += dt * (moving ? speed * 3.2 : 2); animatePerson(player, walkPhase, moving);
  if (touring && !panel.open) yaw += dt * .16;
  const pos = player.root.position;
  // Prevent the orbit camera from passing through the main facade or the ground.
  const cameraDistance = Math.cos(yaw) < 0 ? Math.min(distance, Math.max(1.5, (pos.z + 8) / -Math.cos(yaw))) : distance;
  desiredCamera.set(pos.x + Math.sin(yaw) * cameraDistance * Math.cos(pitch), 1.7 + Math.sin(pitch) * cameraDistance, pos.z + Math.cos(yaw) * cameraDistance * Math.cos(pitch));
  camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 12)); lookAt.set(pos.x, 1.5, pos.z); camera.lookAt(lookAt);
  trees.forEach((tree, i) => { tree.rotation.z = Math.sin(elapsed * .75 + i) * .016; tree.rotation.x = Math.cos(elapsed * .6 + i) * .01; });
  const array = waterGeometry.attributes.position.array;
  waterSeeds.forEach((p, i) => {
    const t = (elapsed * .65 + p.phase) % 1, r = p.upper ? t * .85 : 1.4 + t * 1.3;
    array[i * 3] = p.x + Math.cos(p.a) * r; array[i * 3 + 2] = p.z + Math.sin(p.a) * r;
    array[i * 3 + 1] = p.upper ? 3.95 + Math.sin(t * Math.PI) * .8 - t * 1.6 : 2.45 + .5 * t - 2.5 * t * t;
  }); waterGeometry.attributes.position.needsUpdate = true;
  npcs.forEach(p => { const t = elapsed * .13 + p.phase; p.root.position.set(Math.sin(t) * 4.7, .12, 4 + Math.cos(t) * 6); p.root.rotation.y = Math.atan2(-Math.cos(t), Math.sin(t)); animatePerson(p, elapsed * 4 + p.phase, true); });
  near = -1; let closest = 2.8;
  points.forEach((p, i) => { const d = Math.hypot(pos.x - p.x, pos.z - p.z); if (d < closest) { near = i; closest = d; } markers[i].diamond.rotation.y = elapsed; markers[i].diamond.position.y = Math.sin(elapsed * 2 + i) * .12; });
  $('hint').style.display = near >= 0 && !panel.open ? 'block' : 'none'; if (near >= 0) $('hint').textContent = `E · 探索${points[near].title}`;
  const direction = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  $('compass').textContent = `${direction[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8]} · 校园广场`;
}
camera.position.set(0, 3.6, 27);
renderer.setAnimationLoop(() => { update(Math.min(clock.getDelta(), .05)); renderer.render(scene, camera); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
$('loading').remove();
