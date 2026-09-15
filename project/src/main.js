import { createLuxurySedan } from './luxury_sedan.js';
import { createCoupleActions } from './couple_actions.mjs';
import { createMaleLead } from './male_lead.js';
import { createCharacterActions } from './character_actions.mjs';
import { addSurfaceDetail } from './surface_detail.js';
import { addMeadowDetail } from './meadow_detail.js';
import { addParkViews } from './park_views.js';
import { parkHeight } from './park_terrain.mjs';
import * as THREE from 'three';
import { createRiverDrift } from './river_drift.js';
import { addSunsetCoast, coastBlocked } from './sunset_coast.js';
import { createAnimeCompanion } from './anime_companion.js';
import { createSportsCar } from './amg_drive.js';
import { createOurWorld } from './our_world.js';
import { addSceneDetail } from './scene_detail.js';
import { addGardenDetail } from './garden_detail.js';
import { addLmuNeighborhood, outsideNeighborhood } from './lmu_neighborhood.js';
let world = null;
let vehicle = null;
let drift = null;

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
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: .5, far: 150 });
sun.shadow.normalBias = .025; sun.shadow.bias = -.00008; sun.shadow.radius = 2; scene.add(sun);
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
function blocked(x, z, ignoreVehicle = false) {
  if (x > 250) return coastBlocked(x,z);
  return (!ignoreVehicle && vehicle?.blocks(x, z)) || outsideNeighborhood(x, z) || obstacles.some(o => Math.abs(x - o.x) < o.w && Math.abs(z - o.z) < o.d);
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
const stone = '#e8ddc4', trim = '#f3e8d0', dark = '#3b4d4c';
box(0, 7.1, -12.5, 46, 14.2, 6, stone); obstacle(0, -12.5, 46, 6);
box(0, 7.3, -8.95, 17, 14.6, 1.1, '#eae0c9');
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
    if (row > 0) {
      // Paired round-headed lights and stone mullions in the local facade photograph.
      arch(x, y, z + .29, 1.55, 3.04, trim);
      for (const dx of [-.38, .38]) arch(x + dx, y + .08, z + .44, .62, 2.3, dark);
      cylinder(x, y + 1.05, z + .59, .075, .09, 2.1, trim);
      const oculus = mesh(new THREE.TorusGeometry(.17, .045, 6, 16), trim);
      oculus.position.set(x, y + 2.6, z + .61);
      if (row === 1) for (let petal = 0; petal < 4; petal++) {
        const angle = petal * Math.PI / 2;
        const ring = mesh(new THREE.TorusGeometry(.095, .025, 5, 12), trim);
        ring.position.set(x + Math.cos(angle) * .12, y + 2.6 + Math.sin(angle) * .12, z + .65);
      }
    } else {
      box(x, y + 1.3, z + .32, .065, 2.6, .05, '#ab9977');
    }
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
// Terracotta roof, ridge, skylights and stone cornice.
const roof = box(0, 15.15, -10.7, 47, .22, 4.4, '#b6532c'); roof.rotation.x = .46;
const roofBack = box(0, 15.15, -14.6, 47, .22, 4.4, '#a34928'); roofBack.rotation.x = -.46;
box(0, 16.13, -12.65, 47.1, .22, .25, '#cd7648');
for (let x = -23; x <= 23; x += .8) {
  const seam = box(x, 15.19, -10.7, .035, .025, 4.4, '#ce7647'); seam.rotation.x = .46;
}
for (let x = -21; x <= 21; x += 3) {
  const skylight = box(x, 14.55, -9.2, 1.65, .12, .65, '#8bafb5'); skylight.rotation.x = .46;
  box(x, 13.85, -8.94, .38, .46, .42, trim);
}
for (const x of [-17, -9, 10, 19]) {
  box(x, 16, -13.5, .7, 1.7, .8, '#d6c8ab'); box(x, 16.86, -13.5, .95, .16, 1.05, trim);
}
// The entrance reference shows an uninterrupted horizontal cornice, not a pediment.
for (const y of [14.12, 14.38, 14.6]) box(0, y, -8.18, 17.7, .16, .62, trim);
for (let x = -22; x <= 22; x += .55) {
  const frieze = mesh(new THREE.TorusGeometry(.19, .035, 5, 12, Math.PI), trim);
  frieze.position.set(x, 13.47, Math.abs(x) < 8 ? -8.08 : -9.12);
}
// Signage is drawn to a canvas texture so it remains legible on the facade.
function sign(text, x, y, z, width, height, fontSize = 44) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e9ddc3'; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#545c50'; ctx.font = `${fontSize}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 66);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .8 }));
  plaque.position.set(x, y, z); scene.add(plaque); return plaque;
}
sign('LUDWIG-MAXIMILIANS-UNIVERSITÄT', 0, 13.33, -8.29, 14.6, .85, 40);
sign('LMU  ·  MÜNCHEN', 0, 4.95, -7.49, 5.4, .48, 56);
for (const x of [-3, 0, 3]) {
  for (const dx of [-.52, .52]) {
    box(x + dx, 1.7, -7.83, .78, 2.05, .07, '#5c5545');
    box(x + dx, 2.2, -7.77, .57, .73, .05, '#374d4b');
    box(x + dx, 1.17, -7.77, .57, .65, .05, '#74674f');
    cylinder(x + dx * .3, 1.65, -7.67, .035, .035, .26, '#c6a763', scene, 8);
  }
}
// An L-shaped long wing with repeated arched windows, as in the supplied photo.
for (const side of [-1, 1]) {
  const length = side === 1 ? 30 : 17, centerZ = side === 1 ? -1.5 : -8;
  box(side * 27, 6.7, centerZ, 7, 13.4, length, stone); obstacle(side * 27, centerZ, 7, length);
  const wing = new THREE.Group(); wing.position.set(side * 23.45, 0, centerZ); wing.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2; scene.add(wing);
  for (const y of [.4, 4.7, 9, 13.3]) box(0, y, .06, length, .2, .35, trim, wing);
  for (let xx = -length / 2 + 1.5; xx < length / 2; xx += 3) {
    for (const y of [1.1, 5.4, 9.8]) {
      wing.add(arch(xx, y - .12, .12, 1.78, 2.95, trim));
      wing.add(arch(xx, y, .27, 1.39, 2.67, dark));
      box(xx, y + 1.17, .44, .065, 2.3, .045, '#ad9c7b', wing);
      for (const yy of [.7, 1.4, 2]) box(xx, y + yy, .44, 1.35, .055, .045, '#ad9c7b', wing);
      box(xx, y - .14, .3, 1.95, .16, .35, trim, wing);
    }
  }
  const a = box(side * 25.1, 14.3, centerZ, 4.2, .22, length + .6, '#b6532c'); a.rotation.z = side * .45;
  const b = box(side * 28.9, 14.3, centerZ, 4.2, .22, length + .6, '#a34928'); b.rotation.z = -side * .45;
  box(side * 27, 15.2, centerZ, .22, .22, length + .7, '#cd7648');
}
// Distant twin spires echo the skyline visible in the reference photograph.
for (const x of [-37, -32]) {
  box(x, 12, -26, 3.5, 24, 4, '#e6d9b9');
  for (const y of [6, 13, 19, 23]) box(x, y, -23.9, 3.8, .2, .28, trim);
  for (const dx of [-.65, .65]) arch(x + dx, 18.5, -23.85, .7, 2.8, '#526065');
  cylinder(x, 27.2, -26, 0, 2.6, 7, '#7b8178', scene, 4);
  cylinder(x, 31, -26, .035, .035, 1.2, '#b39856', scene, 6);
}
// Lawn strips define the open square without blocking the central walkway.
for (const side of [-1, 1]) {
  box(side * 15, .13, 3.5, 10, .14, 11, '#aeb596');
  box(side * 15, .22, 3.5, 9.7, .1, 10.7, '#7e9956');
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
// One entrance fountain: octagonal basin, tiered stone bowls and falling water.
const fountain = { x: 0, z: 4, radius: 4.29 };
const fountainScale=1.3;
const waterPositions = [], waterSeeds = [];
{
  const { x, z } = fountain;
  const firstPart=scene.children.length;
  cylinder(x, .18, z, 3.65, 3.8, .36, '#c9c0a6', scene, 8);
  cylinder(x, .48, z, 3.45, 3.45, .36, '#e0d3b5', scene, 8);
  cylinder(x, .675, z, 3.12, 3.12, .04, '#508d86', scene, 8);
  const rim = mesh(new THREE.TorusGeometry(3.3, .16, 6, 8), '#ecdfc2'); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 8; rim.position.set(x, .73, z);
  cylinder(x, 1.38, z, .36, .75, 1.45, '#387f70');
  cylinder(x, 2.15, z, 1.55, .48, .4, '#459b88');
  cylinder(x, 2.38, z, 1.52, 1.52, .08, '#7daca0');
  cylinder(x, 3.05, z, .2, .38, 1.4, '#387f70');
  cylinder(x, 3.82, z, .77, .23, .25, '#459b88');
  cylinder(x, 3.97, z, .73, .73, .06, '#7daca0');
  ball(x, 4.2, z, .18, .25, .18, '#5ba18b');
  const fountainGroup=new THREE.Group();fountainGroup.name='copper-fountain';fountainGroup.position.set(x,0,z);
  for(const part of scene.children.slice(firstPart)){part.position.x-=x;part.position.z-=z;fountainGroup.add(part);}
  fountainGroup.scale.setScalar(fountainScale);scene.add(fountainGroup);
  obstacle(x,z,7.6*fountainScale,7.6*fountainScale);
  for (let j = 0; j < 900; j++) {
    waterSeeds.push({ x, z, a: random() * Math.PI * 2, phase: random(), upper: j < 300 }); waterPositions.push(0, 0, 0);
  }
}
const ripples = Array.from({ length: 5 }, (_, i) => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(.95, 1, 64), new THREE.MeshBasicMaterial({ color: '#c5e1ca', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(fountain.x, .703*fountainScale, fountain.z); scene.add(ring); return ring;
});
const waterGeometry = new THREE.BufferGeometry(); waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
const water = new THREE.Points(waterGeometry, new THREE.PointsMaterial({ color: '#d7fbfa', size: .065, transparent: true, opacity: .8 })); scene.add(water);
function bench(x, z, angle) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; scene.add(g);
  for (const xx of [-1.3, 1.3]) { box(xx, .45, 0, .12, .9, .7, '#3b463c', g); box(xx, 1.13, -.3, .12, 1, .12, '#3b463c', g); }
  for (let i = 0; i < 3; i++) { box(0, .85, -.25 + i * .23, 3.2, .11, .19, '#8e6748', g); box(0, 1.13 + i * .23, -.38, 3.2, .17, .1, '#8e6748', g); }
  obstacle(x, z, 3.4, 1.2);
}
for (const side of [-1, 1]) {
  bench(side * 18, 17, side * -.2); bench(side * 8.4, 7, 0);
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
const player = createAnimeCompanion(THREE, scene); player.root.position.set(0, .12, new URLSearchParams(location.search).get('from') === 'interior' ? -4.5 : 19);
const characterActions=createCharacterActions(player);
const maleLead=createMaleLead(THREE,scene);
createLuxurySedan(THREE,scene,maleLead,obstacle);
const coupleActions=createCoupleActions(player,maleLead,blocked);
const npcs = Array.from({ length: 5 }, (_, i) => { const p = person(['#82958b', '#c5b493', '#a5836a'][i % 3], .8); p.phase = i * 1.4; return p; });
function animatePerson(p, phase, moving) {
  p.legs.forEach((leg, i) => leg.rotation.x = moving ? Math.sin(phase + i * Math.PI) * .55 : 0);
  p.arms.forEach((arm, i) => arm.rotation.x = moving ? -Math.sin(phase + i * Math.PI) * .4 : Math.sin(phase * .3) * .025);
  p.body.position.y = moving ? Math.abs(Math.sin(phase)) * .045 : Math.sin(phase * .4) * .01;
}
const points = [
  { x: 0, z: -4.5, title: '主入口', text: '走近入口拱廊，抬头看看成对拱窗、石柱和连续的水平檐口。这里也是本次漫游的拍照目的地。' },
  { x: -5.8, z: 4, title: '入口喷泉', text: '八角形水池围绕着分层石碗，水流从上层落入池中。绕过喷泉，沿中轴步道就能走到主入口。' },
  { x: 7, z: 15, title: '林荫步道', text: '沿着花坛散步，拖动视角，从树荫间寻找你喜欢的构图。' }
];
const markers = points.map(p => {
  const g = new THREE.Group(); g.position.set(p.x, 1.4, p.z); scene.add(g);
  const diamond = mesh(new THREE.OctahedronGeometry(.24), '#ffe2a0', g, { emissive: '#e5b457', emissiveIntensity: .45 });
  const ring = mesh(new THREE.TorusGeometry(.45, .025, 6, 32), '#ffe2a0', g); ring.rotation.x = Math.PI / 2; ring.position.y = -1.15;
  return { g, diamond };
});
const keys = new Set(), visited = new Set();
// Keep sightseeing progress while moving between the two HTML scenes.
try {
  const saved = JSON.parse(sessionStorage.getItem('lmu-campus-visit') || '{}');
  if (Array.isArray(saved.visited)) saved.visited.filter(i => Number.isInteger(i) && i >= 0 && i < points.length).forEach(i => visited.add(i));
  if (saved.photo) $('photo-status').textContent = '✓ 已在主入口拍照';
} catch { /* Storage is optional, including in private browsing. */ }
function updateVisits() {
  $('status').textContent = `发现 ${visited.size} / 3 处风景`;
  $('progress').style.width = `${visited.size / 3 * 100}%`;
}
updateVisits();
addEventListener('pagehide', () => {
  try { sessionStorage.setItem('lmu-campus-visit', JSON.stringify({ visited: [...visited], photo: $('photo-status').textContent.startsWith('✓') })); } catch {}
});
let yaw = 0, pitch = .22, distance = 8.5, touring = false, near = -1, walkPhase = 0;
const panel = $('panel');
function clearInput() { keys.clear(); dragging = false; }
function atEntrance() { return Math.hypot(player.root.position.x, player.root.position.z + 4.5) < 2.8; }
function openPoint() {
  if (drift?.isActive()) return;
  if (vehicle?.isDriving()) return;
  if (atEntrance() && !panel.open && !world?.isModal()) { visited.add(0); updateVisits(); location.href = './lmu-interior.html'; return; }
  if (world?.interact()) { keys.clear(); return; }
  if (near < 0) return;
  const p = points[near]; visited.add(near);
  $('title').textContent = p.title; $('text').textContent = p.text;
  $('source').textContent = '场景参考：你提供的 LMU 校园照片与概念图 · 艺术化重建';
  $('status').textContent = `发现 ${visited.size} / 3 处风景`; $('progress').style.width = `${visited.size / 3 * 100}%`;
  if (!panel.open) panel.showModal(); keys.clear();
}
$('close').onclick = () => panel.close(); $('hint').onclick = openPoint;
function togglePhoto() { const active = document.body.classList.toggle('photo'); keys.clear(); world?.photoChanged(active); }
$('photo').onclick = togglePhoto;
function stopTour() { touring = false; $('tour').textContent = '自动漫游'; }
$('tour').onclick = () => { touring = !touring; $('tour').textContent = touring ? '停止漫游' : '自动漫游'; };
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').style.display = 'none', 2600); }
function takePhoto() {
  renderer.render(scene, camera);
  const snapshot = document.createElement('canvas'); snapshot.width = renderer.domElement.width; snapshot.height = renderer.domElement.height;
  const ctx = snapshot.getContext('2d'); ctx.drawImage(renderer.domElement, 0, 0); world?.drawFrame(ctx, snapshot.width, snapshot.height);
  snapshot.toBlob(blob => {
    if (!blob) return toast('照片保存失败，请重试。');
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'lmu-afternoon.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (Math.hypot(player.root.position.x, player.root.position.z + 4.5) < 5) $('photo-status').textContent = '✓ 已在主入口拍照';
    toast('照片已保存');
  }, 'image/png');
}
$('shot').onclick = takePhoto;
addEventListener('keydown', e => {
  if (panel.open || world?.isModal() || e.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if (world?.onKey(e)) { e.preventDefault(); return; }
  if (e.target.closest('button') && ['Space', 'Enter'].includes(e.code)) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (panel.open) return;
  keys.add(e.code);
  if (!e.repeat && ['Digit1','Digit2','Digit3'].includes(e.code) && !world?.isSitting() && !world?.isPhoto() && !vehicle?.isDriving()) characterActions.start({Digit1:'wave',Digit2:'jump',Digit3:'spin'}[e.code]);
  if (!e.repeat && e.code === 'KeyF' && !drift?.isActive()) vehicle?.interact();
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
  vehicle?.update(dt, keys);
  drift?.update(dt,elapsed,keys);
  if(!maleLead.seated&&!coupleActions.isActive())maleLead.update(dt,blocked,player.root.position);
  let dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  let dz = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  if (panel.open || world?.isModal() || world?.isPhoto() || vehicle?.isDriving() || coupleActions.isActive() || drift?.isActive()) dx = dz = 0;
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
  walkPhase += dt * (moving ? speed * 3.2 : 2); if (!world?.isSitting() && !drift?.isActive()) animatePerson(player, walkPhase, moving);
  if (touring && !panel.open && !world?.isModal()) yaw += dt * .16;
  const pos = player.root.position;
  if (!drift?.isActive()) pos.y=.12+parkHeight(pos.x,pos.z);
  // Prevent the orbit camera from passing through the main facade or the ground.
  const cameraDistance = Math.cos(yaw) < 0 ? Math.min(distance, Math.max(1.5, (pos.z + 8) / -Math.cos(yaw))) : distance;
  desiredCamera.set(pos.x + Math.sin(yaw) * cameraDistance * Math.cos(pitch), pos.y + 1.7 + Math.sin(pitch) * cameraDistance, pos.z + Math.cos(yaw) * cameraDistance * Math.cos(pitch));
  camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 12)); lookAt.set(pos.x, pos.y + 1.5, pos.z); camera.lookAt(lookAt);
  ripples.forEach((ring, i) => { const t = (elapsed * .22 + i / 5) % 1; ring.scale.setScalar((1.6 + t * 1.45)*fountainScale); ring.material.opacity = (1 - t) * .24; });
  trees.forEach((tree, i) => { tree.rotation.z = Math.sin(elapsed * .75 + i) * .016; tree.rotation.x = Math.cos(elapsed * .6 + i) * .01; });
  const array = waterGeometry.attributes.position.array;
  waterSeeds.forEach((p, i) => {
    const t = (elapsed * .65 + p.phase) % 1, r = p.upper ? .73+t*.35 : 1.52+t*.6;
    array[i * 3] = p.x + Math.cos(p.a) * r*fountainScale; array[i * 3 + 2] = p.z + Math.sin(p.a) * r*fountainScale;
    array[i * 3 + 1] = (p.upper ? 4.04 - t*t*1.6 : 2.43 - 1.72*t*t)*fountainScale;
  }); waterGeometry.attributes.position.needsUpdate = true;
  npcs.forEach(p => { const t = elapsed * .13 + p.phase; p.root.position.set(Math.sin(t) * 4.7, .12, -2.7 + Math.cos(t) * 1.1); p.root.rotation.y = Math.atan2(-Math.cos(t), Math.sin(t)); animatePerson(p, elapsed * 4 + p.phase, true); });
  near = -1; let closest = 2.8;
  points.forEach((p, i) => { const d = Math.hypot(pos.x - p.x, pos.z - p.z); if (d < closest) { near = i; closest = d; } markers[i].diamond.rotation.y = elapsed; markers[i].diamond.position.y = Math.sin(elapsed * 2 + i) * .12; });
  $('hint').style.display = near >= 0 && !panel.open ? 'block' : 'none'; if (near >= 0) $('hint').textContent = `E · 探索${points[near].title}`;
  world?.update(dt, elapsed);
  characterActions.update(dt,drift?.isActive()||coupleActions.isActive()||moving||panel.open||world?.isModal()||world?.isSitting()||world?.isPhoto()||vehicle?.isDriving());
  if (!vehicle?.isDriving()) player.update(dt, elapsed, blocked, parkHeight);
  coupleActions.update(dt,panel.open||world?.isModal()||world?.isSitting()||world?.isPhoto()||vehicle?.isDriving());
  coupleBar.hidden=!coupleActions.available()&&!coupleActions.isActive();
  const storyTarget = world?.nearest();
  if (storyTarget && !panel.open && !world.isModal()) { $('hint').style.display = 'block'; $('hint').textContent = `E · ${storyTarget.label}`; }
  if (atEntrance() && !panel.open && !world?.isModal()) { $('hint').style.display = 'block'; $('hint').textContent = 'E · 进入 LMU 教学楼 →'; }
  if (world?.isModal()) $('hint').style.display = 'none';
  const direction = ['西', '西南', '南', '东南', '东', '东北', '北', '西北'];
  const district = pos.z > 57 ? '英国公园' : pos.x > 82 ? 'Siegestor' : pos.x < -44 ? 'Ludwigstraße 南段' : pos.z > 23 ? '大学街区' : '校园广场';
  $('compass').textContent = `${direction[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8]} · ${district}`;
}
world = await createOurWorld({ THREE, scene, sun, trees, player, camera, renderer, box, cylinder, ball, bench, person, animatePerson, obstacle, obstacles, toast, takePhoto, togglePhoto });
addLmuNeighborhood({ THREE, scene, obstacle, player, stopTour, faceDestination: angle => { yaw = angle; pitch = .28; distance = 12; } });
vehicle = createSportsCar({ THREE, scene, renderer, player, blocked: (x,z) => blocked(x,z,true), toast, stopTour, isPaused: () => drift?.isActive() || panel.open || world?.isModal() || world?.isPhoto() || world?.isSitting(), setView: angle => { yaw = angle; pitch = .28; distance = 10; } });
addParkViews({THREE,scene,box,cylinder,ball,person});
addSceneDetail(THREE, scene, trees, renderer);
const updateGarden=await addGardenDetail(THREE,scene,sun);
const updateMeadow=await addMeadowDetail(THREE,scene);
addSurfaceDetail(THREE,scene,renderer);
const parkButton=document.createElement('button');parkButton.textContent='去溪边';document.querySelector('.tools').append(parkButton);
parkButton.onclick=()=>{player.root.position.set(-2.5,.12,84);yaw=.8;pitch=.55;distance=12;};
const meadowButton=document.createElement('button');meadowButton.textContent='看圆亭草坪';meadowButton.style.cssText='position:fixed;right:24px;bottom:190px;z-index:6';document.querySelector('.tools').append(meadowButton);
meadowButton.onclick=()=>{player.root.position.set(12,.12,78);yaw=Math.PI+.14;pitch=.12;distance=10;};
const viewSelect=document.createElement('select');viewSelect.setAttribute('aria-label','照片参考视角');viewSelect.style.cssText='position:fixed;right:24px;bottom:240px;z-index:6;padding:10px;background:#33463e;color:#fff;border-radius:8px';
for(const [value,label]of [['','照片参考视角…'],['temple','① 圆亭与草坡'],['city','② 草坪与城市远景'],['bank','③ 溪边休憩']]){const option=document.createElement('option');option.value=value;option.textContent=label;viewSelect.append(option);}document.querySelector('.tools').append(viewSelect);
viewSelect.onchange=()=>{const views={temple:[12,87,Math.PI+.13,.18,11],city:[17,104,0,.22,10],bank:[-1,90,1.2,.18,9]};const v=views[viewSelect.value];if(!v)return;stopTour();player.root.position.set(v[0],.12+parkHeight(v[0],v[1]),v[1]);yaw=v[2];pitch=v[3];distance=v[4];};
const actionBar=document.createElement('div');actionBar.className='interface';actionBar.style.cssText='position:fixed;left:50%;bottom:95px;transform:translateX(-50%);display:flex;gap:6px;z-index:3';
for(const [name,label]of [['wave','1 · 挥手'],['jump','2 · 开心跳'],['spin','3 · 转圈']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{if(panel.open||world?.isModal()||world?.isSitting()||world?.isPhoto()||vehicle?.isDriving()||drift?.isActive())return;characterActions.start(name);};actionBar.append(button);}document.body.append(actionBar);
drift = createRiverDrift({THREE,scene,player,toast,canStart:()=>!coupleActions.isActive()&&!vehicle?.isDriving()&&!world?.isModal()&&!world?.isPhoto()&&!world?.isSitting()&&!panel.open,setView:()=>{stopTour();yaw=Math.PI;pitch=.4;distance=10;}});
const coast = addSunsetCoast({THREE,scene,player,sun,stopTour,toast,canTravel:()=>!drift?.isActive()&&!vehicle?.isDriving()&&!world?.isModal()&&!world?.isSitting()&&!world?.isPhoto()&&!panel.open,setView:angle=>{yaw=angle;pitch=.14;distance=9;}});
const coupleBar=document.createElement('div');coupleBar.className='interface';coupleBar.style.cssText='position:fixed;left:50%;bottom:145px;transform:translateX(-50%);z-index:4';coupleBar.hidden=true;
for(const [name,label]of [['hug','拥抱男主'],['kiss','亲吻男主']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{if(panel.open||world?.isModal()||world?.isSitting()||world?.isPhoto()||vehicle?.isDriving()||drift?.isActive())return;characterActions.update(0,true);if(!coupleActions.start(name))toast('请靠近男主，留出一点空地。');};coupleBar.append(b);}const endCouple=document.createElement('button');endCouple.textContent='结束动作';endCouple.onclick=()=>coupleActions.cancel();coupleBar.append(endCouple);document.body.append(coupleBar);
camera.position.set(0, 3.6, 27);
if (new URLSearchParams(location.search).has('landmark')) {
  const p=player.root.position;
  camera.position.set(p.x+Math.sin(yaw)*distance*Math.cos(pitch),p.y+1.7+Math.sin(pitch)*distance,p.z+Math.cos(yaw)*distance*Math.cos(pitch));
  camera.lookAt(p.x,p.y+1.5,p.z);
}
renderer.setAnimationLoop(() => { update(Math.min(clock.getDelta(), .05)); updateGarden(elapsed); updateMeadow(elapsed); coast.update(elapsed); renderer.render(scene, camera); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
$('loading').remove();
