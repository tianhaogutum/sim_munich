// ═══════════════════════════════════════════════════════════════════════════
//  我们的 LMU — 动漫风格 3D 场景
//  Toon shading · Cel outlines · Sakura · Spring camera · Bloom
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
// ── "Munich date" chapter modules (contract: project/DATE_CONTRACT.md) ──
import { ROUTE, POIS, FOUNTAINS, SPAWN, BOUNDS, INTERACT_RADIUS } from './date_route.mjs';
import { createStory }   from './date_story.mjs';
import { createStoryUI } from './date_story_ui.js';
import { createCast }    from './date_cast.js';
import { createPhoto }   from './date_photo.js';
import { createAudio }   from './date_audio.js';
import { createInput }   from './date_input.js';
import { createMap }     from './date_map.js';
import { createTitle }   from './date_title.js';
import { createBanter }  from './date_banter.js';
import { createCollect } from './date_collect.js';
import { createCinematic } from './date_cinematic.js';
import { createLife }    from './lmu_life.js';
import { createCoreScene } from './lmu_core_scene.js';
import { coreBlocked } from './lmu_core_data.mjs';
import { createWorld } from './lmu_world.js';
import { cameraBoomFraction } from './date_camera.mjs';

// ── PERSONAL CONFIG ─────────────────────────────────────────────────────────
const START_DATE    = new Date('2024-03-15');   // ← 改成你们在一起的日期
const DAYS_TOGETHER = Math.max(0, Math.floor((Date.now() - START_DATE) / 86_400_000));
document.getElementById('days-num').textContent = DAYS_TOGETHER;
document.getElementById('popup-num').textContent = DAYS_TOGETHER;
document.getElementById('popup-days').textContent = DAYS_TOGETHER;

// Core dimensions now come from retained OSM footprints in lmu_core_data.mjs.

// ── RENDERER ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputColorSpace   = THREE.SRGBColorSpace;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .92;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.35, 2200);

// ── POST-PROCESSING ──────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.7, 0.80
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ═════════ REGION: SCENE (owner: scene/rendering agent) — runs until "END REGION: SCENE" ═════════
// ── TOON GRADIENT MAPS ───────────────────────────────────────────────────────
function toonGrad(n) {                    // n evenly-spaced greyscale steps
  const d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.round((i / (n-1)) * 255);
    d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v; d[i*4+3]=255;
  }
  const t = new THREE.DataTexture(d, n, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
const G4 = toonGrad(4);   // 4-step: deep shadow / shadow / base / highlight
const G3 = toonGrad(3);   // 3-step: for nature objects

// ── MATERIALS ────────────────────────────────────────────────────────────────
const T  = (c, g=G4) => new THREE.MeshToonMaterial({ color:c, gradientMap:g });
const TB = (c, g=G4) => new THREE.MeshToonMaterial({ color:c, gradientMap:g, side:THREE.DoubleSide });

const mat = {
  facade:   T(0xF2E6C0),
  facade2:  T(0xE6D4A4),
  column:   T(0xFCF4E4),
  roof:     T(0x352816),
  parapet:  T(0xDACCA0),
  winGlass: new THREE.MeshToonMaterial({ color:0x7ABEE0, gradientMap:G4,
              transparent:true, opacity:.78, emissive:0x1A3850, emissiveIntensity:.35 }),
  winFrame: T(0xC4AC6A),
  door:     T(0x2A1808),
  steps:    T(0xBAAE8C),
  plaza:    T(0xC6BA9A),
  road:     T(0x3E4246),
  roadMk:   T(0xC0BAA8),
  sidewalk: T(0xA8A494),
  fountain: T(0x8888A8),
  water:    new THREE.MeshToonMaterial({ color:0x48B8E4, gradientMap:G3,
              transparent:true, opacity:.70, emissive:0x082838, emissiveIntensity:.5 }),
  trunk:    T(0x7A5420, G3),
  foliageA: T(0x48C438, G3),
  foliageB: T(0x38A828, G3),
  sakura:   TB(0xFFB0C2, G3),
  sakuraD:  TB(0xFF88AA, G3),
  lamp:     new THREE.MeshToonMaterial({ color:0x22202C, gradientMap:G4,
              emissive:0xFFD070, emissiveIntensity:.0 }),
  lampGlow: new THREE.MeshToonMaterial({ color:0xFFE8A0, emissive:0xFFC040,
              emissiveIntensity:3.0, gradientMap:G4 }),
  bench:    T(0x8A6020, G3),
  adjacent: T(0xCCC0A2),
};

// ── OUTLINE (backface expansion) ─────────────────────────────────────────────
const _outlineVert = `uniform float t;
void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*t,1.);}`;
const _outlineFrag = `void main(){gl_FragColor=vec4(.06,.04,.12,1.);}`;

function ol(mesh, thick=0.055) {
  const m = new THREE.ShaderMaterial({ side:THREE.BackSide,
    uniforms:{ t:{value:thick} },
    vertexShader:_outlineVert, fragmentShader:_outlineFrag });
  const o = new THREE.Mesh(mesh.geometry, m);
  o.renderOrder = -1;
  mesh.add(o);
  return mesh;
}

// ── GEOMETRY HELPERS ─────────────────────────────────────────────────────────
function box(pos, sz, m, shadow=true, outline=true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...sz), m);
  mesh.position.set(...pos);
  if (shadow) { mesh.castShadow=true; mesh.receiveShadow=true; }
  scene.add(mesh);
  if (outline) ol(mesh, Math.min(sz[0], sz[2]) * 0.0025 + 0.038);
  return mesh;
}

function cyl(pos, r, h, verts=14, m, shadow=true, outline=true) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,verts), m);
  mesh.position.set(...pos);
  if (shadow) { mesh.castShadow=true; mesh.receiveShadow=true; }
  scene.add(mesh);
  if (outline) ol(mesh, 0.048);
  return mesh;
}

// Arch-shaped window/door geometry (ShapeGeometry in XY plane)
function archGeo(w, h, segs=10) {
  const s = new THREE.Shape();
  const hw=w*.5, r=hw, rh=h-r;
  s.moveTo(-hw,0); s.lineTo(hw,0); s.lineTo(hw,rh);
  s.absarc(0,rh,r,0,Math.PI,false); s.closePath();
  return new THREE.ShapeGeometry(s, segs);
}

// ── SKY DOME ─────────────────────────────────────────────────────────────────
// Custom anime gradient sky: deep azure at zenith → warm peach at horizon
const skySphere = new THREE.Mesh(
  new THREE.SphereGeometry(1800, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topCol:  { value: new THREE.Color(0x1A3280) },
      midCol:  { value: new THREE.Color(0x4A90E8) },
      horCol:  { value: new THREE.Color(0xFFD8A8) },
      fogCol:  { value: new THREE.Color(0xC0D8F0) },
    },
    vertexShader: `varying float vY; varying vec3 vPos;
      void main(){ vY=normalize(position).y; vPos=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform vec3 topCol,midCol,horCol,fogCol;
      varying float vY;
      void main(){
        float t  = smoothstep(0.0,  0.7, vY);
        float h  = smoothstep(-0.1, 0.25, vY);
        float f  = smoothstep(0.0,  0.12, vY);
        vec3 col = mix(horCol, midCol, h);
        col      = mix(col, topCol, t*t);
        col      = mix(fogCol, col, f);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(skySphere);

// Real mapped core: angled U-shaped frontage, nine masonry arcade bays, mapped trees and roads.
const coreScene = createCoreScene({ THREE, scene, toon: (color,steps=4) => T(color,steps===3?G3:G4) });
const dummy = new THREE.Object3D();

// ── SAKURA PARTICLE SYSTEM ───────────────────────────────────────────────────
const PETAL_COUNT = 680;
const petalShape = new THREE.Shape();
petalShape.ellipse(0, 0, .28, .16, 0, Math.PI*2, false, 0);
const petalGeoBase = new THREE.ShapeGeometry(petalShape, 6);
const sakuraInst = new THREE.InstancedMesh(petalGeoBase, mat.sakura, PETAL_COUNT);
const sakuraDInst = new THREE.InstancedMesh(petalGeoBase, mat.sakuraD, Math.floor(PETAL_COUNT*.3));
sakuraInst.castShadow = false;
sakuraDInst.castShadow = false;
scene.add(sakuraInst, sakuraDInst);

const petals = Array.from({ length: PETAL_COUNT }, (_, i) => ({
  x: (Math.random()-.5)*220,
  y: Math.random()*28 + 3,
  z: (Math.random()-.5)*120 + 40,
  vx: (Math.random()-.5)*.08,
  vy: -(Math.random()*.22+.10),
  vz: (Math.random()-.5)*.06,
  rx: Math.random()*Math.PI*2,
  ry: Math.random()*Math.PI*2,
  rz: Math.random()*Math.PI*2,
  vrx: Math.random()*.025, vry: Math.random()*.018, vrz: Math.random()*.012,
  phase: Math.random()*Math.PI*2,
  dark: i < PETAL_COUNT*.3,
}));

// ── SIGHTSEEING POINTS ────────────────────────────────────────────────────────
// Positions come from date_route.mjs (POIS); `when` hides quest-only points outside their stage.
const poiPos = id => new THREE.Vector3(POIS[id].x, 1, POIS[id].z);
const sights = [
  { id:'entrance', pos: poiPos('entrance'),
    icon:'🏛', name:'LMU 主入口 · Haupteingang',
    text:'这座入口建于 1835–1840 年，由建筑师 Friedrich von Gärtner 设计，融合了罗马式圆拱风格（Rundbogenstil）。\n主立面的九个砖石拱廊、成对圆拱窗和两侧回翼，构成这里最熟悉的轮廓。场景依照地图轮廓与照片重建，细部为近似表达。',
    src:'来源：LMU 官方导览 · lmu.de' },
  { id:'white_rose', pos: poiPos('white_rose'),
    icon:'✉', name:'白玫瑰纪念地 · Weiße Rose',
    text:'1943 年，大学生索菲·朔尔和汉斯·朔尔在此散发反纳粹传单。\n主楼前的广场以他们的名字命名：Geschwister-Scholl-Platz。',
    src:'来源：de.wikipedia.org/wiki/Weiße_Rose' },
  { id:'fountain', pos: poiPos('fountain'),
    icon:'⛲', name:'喷泉 · Brunnen',
    text:'广场上两座喷泉设计于 1842–1844 年，同样出自 Friedrich von Gärtner 之手。\n每根喷泉柱高 8.20 米，水盆直径约 10 米。',
    src:'来源：de.wikipedia.org/wiki/Geschwister-Scholl-Platz_(München)' },
  { id:'our_plaza', pos: poiPos('our_plaza'),
    icon:'💌', name:'我们的广场',
    text:'这里是我们的小世界。\n每一次散步，每一个清晨，每一次牵手，\n都留在了这条 Ludwigstraße 和这座主楼之间。',
    src:'来源：我们 ♡' },
  { id:'memento', pos: poiPos('memento'),
    icon:'🎀', name:'树下闪着光的东西',
    text:'是 TA 的樱花发夹。',
    src:'来源：我们 ♡',
    when: () => story.getState().stage === 'find_memento' },
];

// Sightseeing markers
const markerGeo  = new THREE.SphereGeometry(.42, 14, 10);
const markerMats = [0xE87050,0x80C8E8,0xE8C840,0xFF88AA,0xFFD6F0].map(c=>
  new THREE.MeshToonMaterial({ color:c, gradientMap:G4, emissive:c, emissiveIntensity:.6 })
);
const markers = sights.map((s, i) => {
  const m = new THREE.Mesh(markerGeo, markerMats[i]);
  m.position.copy(s.pos);
  scene.add(m);
  return m;
});

// Days counter plaque (special marker near entrance steps)
const plaqueMesh = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 1.2, .15),
  new THREE.MeshToonMaterial({ color:0xE8D0A0, gradientMap:G4, emissive:0xF0C060, emissiveIntensity:.25 })
);
plaqueMesh.position.set(POIS.entrance.x+6, .8, POIS.entrance.z+3);
scene.add(plaqueMesh);

// ── LIGHTING ─────────────────────────────────────────────────────────────────
// Anime-style: warm directional + cool sky fill + ambient
const sun = new THREE.DirectionalLight(0xFFF4E0, 2.1);
sun.position.set(-60, 80, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left   = -130;
sun.shadow.camera.right  =  130;
sun.shadow.camera.top    =  100;
sun.shadow.camera.bottom = -20;
sun.shadow.camera.far    =  350;
sun.shadow.bias          = -0.0005;
scene.add(sun);

const skyLight = new THREE.HemisphereLight(0x8AB8F0, 0xC8B890, 1.0);
scene.add(skyLight);

const ambLight = new THREE.AmbientLight(0xF0E8D8, 0.35);
scene.add(ambLight);

// ═════════ END REGION: SCENE ═════════

// ── PLAYER ───────────────────────────────────────────────────────────────────
const player = { pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), yaw: SPAWN.yaw };
const keys   = {};
const solids = []; // district modules may register small additional axis-aligned obstacles
const extraBlockers = [coreBlocked]; // exact same mapped polygons as the rendered core
function blocked(x, z) {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
  for (let i = 0; i < FOUNTAINS.length; i++) {
    const f = FOUNTAINS[i], dx = x - f.x, dz = z - f.z;
    if (dx * dx + dz * dz < f.r * f.r) return true;
  }
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (Math.abs(x - s.cx) < s.hw && Math.abs(z - s.cz) < s.hd) return true;
  }
  for (let i = 0; i < extraBlockers.length; i++) if (extraBlockers[i](x, z)) return true;
  return false;
}
// Keys typed into a text field or during IME composition never reach the game (QA finding 3).
function editingKey(e) {
  const el = e.target;
  return e.isComposing || e.keyCode === 229 ||
    (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}
addEventListener('keydown', e => { if (!editingKey(e)) keys[e.key.toLowerCase()] = true; });
addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur',    () => { for (const k in keys) keys[k] = false; drag = false; touches = {}; });   // no stuck keys/drags after focus loss

// ── CAMERA (spring-arm third-person) ─────────────────────────────────────────
let pitch = .28, camDist = 14;
let camPos  = new THREE.Vector3(SPAWN.x, 14, SPAWN.z + 15);
let camTgt  = new THREE.Vector3(SPAWN.x,  2, SPAWN.z);
let drag = false, lastMX = 0, lastMY = 0;

canvas.addEventListener('mousedown', e => { drag=true; lastMX=e.clientX; lastMY=e.clientY; });
addEventListener('mouseup',   () => drag = false);
addEventListener('mouseleave', () => drag = false);
addEventListener('mousemove', e => {
  if (!drag) return;
  player.yaw -= (e.clientX - lastMX) * .004 * (engine.preferences?.sensitivity ?? 1);
  pitch = Math.max(.08, Math.min(1.15, pitch + (e.clientY - lastMY) * .004 * (engine.preferences?.sensitivity ?? 1)));
  lastMX = e.clientX; lastMY = e.clientY;
});
addEventListener('wheel', e => camDist = Math.max(5, Math.min(22, camDist + e.deltaY*.012)));

// Touch support
let touches = {};
canvas.addEventListener('touchstart', e => {
  [...e.changedTouches].forEach(t => { touches[t.identifier] = { x:t.clientX, y:t.clientY }; });
});
const dropTouches = e => { [...e.changedTouches].forEach(t => delete touches[t.identifier]); };
canvas.addEventListener('touchend', dropTouches);
canvas.addEventListener('touchcancel', dropTouches);
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const prev = touches[t.identifier];
    if (prev) {
      player.yaw -= (t.clientX - prev.x) * .004 * (engine.preferences?.sensitivity ?? 1);
      pitch = Math.max(.08, Math.min(1.15, pitch + (t.clientY - prev.y) * .004 * (engine.preferences?.sensitivity ?? 1)));
    }
    touches[t.identifier] = { x:t.clientX, y:t.clientY };
  }
}, { passive:false });

// ── UI INTERACTIONS ───────────────────────────────────────────────────────────
const panel    = document.getElementById('panel');
const promptEl = document.getElementById('prompt');
const daysPopup = document.getElementById('days-popup');
const hud      = document.getElementById('hud');

let nearestSight = -1;

// Info panels: inert while closed, lock the world while open, return keyboard focus on close (a11y audit #2).
let panelReturnFocus = null;
function openPanel(el, className, closeId) {
  panelReturnFocus = document.activeElement;
  engine.lock('info-panel');
  el.inert = false;
  el.classList.add(className);
  document.getElementById(closeId).focus({ preventScroll: true });
}
function closePanels() {
  panel.classList.remove('open'); panel.inert = true;
  daysPopup.classList.remove('visible'); daysPopup.inert = true;
  engine.unlock('info-panel');
  panelReturnFocus?.focus?.({ preventScroll: true });
  panelReturnFocus = null;
}
document.getElementById('panel-close').onclick = closePanels;
document.getElementById('days-popup-close').onclick = closePanels;
let previousPromptHTML = '';
function setPromptHTML(html) {                        // avoid re-parsing identical prompt HTML every frame
  if (html === previousPromptHTML) return;
  previousPromptHTML = html;
  promptEl.innerHTML = html;
}

// ── ENGINE API (the only surface the chapter modules may use; see project/DATE_CONTRACT.md) ──
const movementLocks = new Set();
let toastEl = null, toastTimer = 0;
let photoModule = null;                               // set after createPhoto (see engine.isPhotoMode)
const engine = {
  THREE, scene, camera, renderer, composer, canvas, player, route: ROUTE,
  blocked,                                            // (x, z) => true if the ground point is not walkable
  addObstacle: ({ cx, cz, hw, hd }) => { solids.push({ cx, cz, hw, hd }); },   // axis-aligned box footprint
  addBlocker: fn => { extraBlockers.push(fn); return () => { const i = extraBlockers.indexOf(fn); if (i >= 0) extraBlockers.splice(i, 1); }; },
  heightAt: (x, z) => 0,                              // ground height; blocks with terrain may wrap this
  toon: (color, steps = 4, opts = {}) =>              // house toon material (cel steps 3 or 4)
    new THREE.MeshToonMaterial({ color, gradientMap: steps === 3 ? G3 : G4, ...opts }),
  outline: (mesh, thickness = 0.03) => ol(mesh, thickness),
  lock:   id => movementLocks.add(id),                // freeze player movement while any lock is held
  unlock: id => movementLocks.delete(id),
  isLocked: () => movementLocks.size > 0,
  isPhotoMode: () => !!photoModule?.isActive(),       // true while the photo overlay is open
  days: DAYS_TOGETHER,                                // the "在一起第 N 天" counter
  capture({ maxWidth = 0, type = 'image/png', quality = 0.92 } = {}) {
    composer.render();                                // includes bloom; HTML HUD is not part of the canvas
    const src = renderer.domElement;
    if (!maxWidth || src.width <= maxWidth) return src.toDataURL(type, quality);
    const out = document.createElement('canvas');
    out.width = maxWidth; out.height = Math.round(src.height * maxWidth / src.width);
    out.getContext('2d').drawImage(src, 0, 0, out.width, out.height);
    return out.toDataURL(type, quality);
  },
  toast(text, ms = 2600) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); toastEl.setAttribute('aria-atomic', 'true');
      toastEl.style.cssText = 'position:fixed;top:68px;left:50%;transform:translateX(-50%);padding:8px 20px;' +
        'background:rgba(8,6,20,.85);border:1px solid rgba(220,185,90,.35);border-radius:18px;color:#F5D878;' +
        'font:14px Nunito,sans-serif;z-index:30;pointer-events:none;transition:opacity .4s;opacity:0';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl.style.opacity = '1';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, ms);
  },
  companion: null,                                    // set below: { getPosition(), getHeadPosition(), root }
  audio: null,                                        // set below: { cue(name), setMuted(), isMuted() }
  cameraOverride: null,                               // optional (dt, et) => void; while set, the module owns the camera
  getDefaultCameraPose: () => ({
    position: [player.pos.x + Math.sin(player.yaw) * camDist * Math.cos(pitch),
      player.pos.y + Math.sin(pitch) * camDist + 1.2,
      player.pos.z + Math.cos(player.yaw) * camDist * Math.cos(pitch)],
    target: [camTgt.x, camTgt.y, camTgt.z],
  }),
  snapCamera() {
    camTgt.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
    const end = {x: player.pos.x + Math.sin(player.yaw)*camDist*Math.cos(pitch), z: player.pos.z + Math.cos(player.yaw)*camDist*Math.cos(pitch)};
    const f = cameraBoomFraction(player.pos, end, blocked);
    camPos.set(player.pos.x + (end.x-player.pos.x)*f, player.pos.y + 1.2 + Math.sin(pitch)*camDist*f, player.pos.z + (end.z-player.pos.z)*f);
    camera.position.copy(camPos); camera.lookAt(camTgt);
  },
  getCameraTarget: () => camTgt,                      // the point the default camera looks at (player head)
};

const story   = createStory();
const world   = createWorld(engine, story);
engine.world = world;
const audio   = createAudio(engine, story);
engine.audio = audio;
const cast    = createCast(engine, story);
engine.companion = cast.companion;
engine.playerAvatar = cast.player;
const life    = createLife(engine, story);
const photo   = createPhoto(engine, story);
photoModule = photo;
const storyUI = createStoryUI(engine, story);
const input   = createInput(engine, story);
const map     = createMap(engine, story);
const title   = createTitle(engine, story);
const banter  = createBanter(engine, story);
const collect = createCollect(engine, story);
const cinematic = createCinematic(engine, story);
window.__lmu = { engine, world, story, cast, photo, storyUI, audio, input, map, title, banter, collect, cinematic, life };   // debug handle for the console / headless checks

// ═════════ REGION: SCENE HOOKS (owner: scene/rendering agent) — per-frame visuals that may read story state ═════════
const sceneHooks = {
  update(dt, et) { coreScene.update(dt, et); },
};
// ═════════ END REGION: SCENE HOOKS ═════════

function openSight(i) {
  const s = sights[i];
  document.getElementById('panel-icon').textContent  = s.icon;
  document.getElementById('panel-title').textContent = s.name;
  document.getElementById('panel-text').textContent  = s.text;
  document.getElementById('panel-source').textContent = s.src;
  openPanel(panel, 'open', 'panel-close');
}

// Key routing: title/cinematic, journal, story/photo, then shared and world actions.
// Movement keys are tracked separately above and are frozen by engine.lock().
addEventListener('keydown', e => {
  if (editingKey(e)) return;                                        // text fields / IME never reach the game
  const k = e.key.toLowerCase();
  if (world.isOpen()) { if (world.handleKey(k, e)) e.preventDefault(); return; }
  if (photo.isModalOpen?.()) { if (photo.handleKey(k, e)) e.preventDefault(); return; }
  if (title.handleKey(k, e)) { e.preventDefault(); return; }       // title / pause menu owns everything while open
  if (e.repeat && !['q','r','pageup','pagedown','+','=','-'].includes(k)) {   // ignore auto-repeat (camera keys excepted)
    if ([' ', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    return;
  }
  if (cinematic.handleKey(k, e) || collect.handleKey(k, e) || storyUI.handleKey(k, e) || photo.handleKey(k, e) || audio.handleKey(k, e) || map.handleKey(k, e) || world.handleKey(k, e)) { e.preventDefault(); return; }
  if (k === 'e' && !engine.isLocked() && !engine.isPhotoMode() && !storyUI.isModalOpen()) {
    if (nearestSight >= 0) {
      if (storyUI.interact(sights[nearestSight].id)) return;
      openSight(nearestSight); return;
    }
    // Check plaque
    if (player.pos.distanceTo(plaqueMesh.position) < 5) {
      openPanel(daysPopup, 'visible', 'days-popup-close'); return;
    }
  }
  if (k === 'escape') closePanels();
  // Keyboard camera (a11y): Q/R orbit, PageUp/PageDown pitch, +/- zoom. Avoids WASD and module keys.
  if (!engine.isLocked() && ['q','r','pageup','pagedown','+','=','-'].includes(k)) {
    if (k === 'q') player.yaw += .12;
    if (k === 'r') player.yaw -= .12;
    if (k === 'pageup') pitch = Math.min(1.15, pitch + .08);
    if (k === 'pagedown') pitch = Math.max(.08, pitch - .08);
    if (k === '+' || k === '=') camDist = Math.max(5, camDist - 1);
    if (k === '-') camDist = Math.min(22, camDist + 1);
    e.preventDefault();
  }
});

// ── RESIZE ────────────────────────────────────────────────────────────────────
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ── ANIMATION LOOP ────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
const compassNeedle = document.getElementById('compass-needle');

function loop() {
  requestAnimationFrame(loop);
  const dt  = Math.min(clock.getDelta(), .05);
  const et  = clock.elapsedTime;

  // ── Sakura animation ──
  petals.forEach((p, i) => {
    p.x += p.vx + Math.sin(et*.4 + p.phase) * .018;
    p.y += p.vy;
    p.z += p.vz + Math.cos(et*.3 + p.phase) * .012;
    p.rx += p.vrx; p.ry += p.vry; p.rz += p.vrz;
    if (p.y < -.5) {
      p.y = 22 + Math.random()*12;
      p.x = (Math.random()-.5)*220;
      p.z = (Math.random()-.5)*120 + 40;
    }
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx, p.ry, p.rz);
    dummy.updateMatrix();
    if (p.dark) sakuraDInst.setMatrixAt(i % Math.floor(PETAL_COUNT*.3), dummy.matrix);
    else        sakuraInst.setMatrixAt(i, dummy.matrix);
  });
  sakuraInst.instanceMatrix.needsUpdate  = true;
  sakuraDInst.instanceMatrix.needsUpdate = true;

  // ── Marker pulse ──
  markers.forEach((m, i) => {
    m.visible = !sights[i].when || sights[i].when();
    m.scale.setScalar(1 + Math.sin(et*2 + i) * .08);
    m.position.y = sights[i].pos.y + Math.sin(et*1.5 + i) * .15;
  });

  // ── Plaque glow ──
  plaqueMesh.material.emissiveIntensity = .2 + Math.sin(et*1.8)*.15;

  // ── Player movement ──
  input.update(dt);                                   // touch / gamepad → synthetic keys
  let speed = keys.shift ? 8.5 : 4.2;
  let mx=0, mz=0;
  if (keys.w||keys.arrowup)    mz -= 1;
  if (keys.s||keys.arrowdown)  mz += 1;
  if (keys.a||keys.arrowleft)  mx -= 1;
  if (keys.d||keys.arrowright) mx += 1;
  if (engine.isLocked()) { mx = 0; mz = 0; }
  const l = Math.hypot(mx,mz)||1; mx/=l; mz/=l;
  // Camera sits at +(sin yaw, cos yaw) from the player, so forward is −(sin, cos) and right is (cos, −sin).
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const nx = player.pos.x + (mx*cy + mz*sy)*speed*dt;
  const nz = player.pos.z + (mz*cy - mx*sy)*speed*dt;
  if (!blocked(nx, player.pos.z)) player.pos.x = nx;
  if (!blocked(player.pos.x, nz)) player.pos.z = nz;

  // ── Characters (avatar + companion) ──
  cast.update(dt, et);
  life.update(dt, et);
  audio.update(dt, et);
  collect.update(dt, et);

  // ── Cinematics / free cam (may take over engine.cameraOverride) ──
  cinematic.update(dt, et);
  hud.classList.toggle('cine-hidden', cinematic.isPlaying());

  // ── Spring-arm camera ──
  const boomEnd = {x: player.pos.x + Math.sin(player.yaw)*camDist*Math.cos(pitch), z: player.pos.z + Math.cos(player.yaw)*camDist*Math.cos(pitch)};
  const boom = cameraBoomFraction(player.pos, boomEnd, blocked);
  const idealX = player.pos.x + (boomEnd.x-player.pos.x)*boom;
  const idealY = player.pos.y + Math.sin(pitch)*camDist*boom + 1.2;
  const idealZ = player.pos.z + (boomEnd.z-player.pos.z)*boom;
  const k = 1 - Math.exp(-7 * dt);
  camPos.x += (idealX - camPos.x)*k;
  camPos.y += (idealY - camPos.y)*k;
  camPos.z += (idealZ - camPos.z)*k;
  // Contract immediately when orbiting into a wall; ease only the outward movement.
  if (!engine.cameraOverride) {
    const f = cameraBoomFraction(player.pos, camPos, blocked);
    if (f < 1) { camPos.x = player.pos.x + (camPos.x-player.pos.x)*f; camPos.z = player.pos.z + (camPos.z-player.pos.z)*f; }
  }
  camTgt.x += (player.pos.x - camTgt.x) * .85;
  camTgt.y += (player.pos.y + 1.6 - camTgt.y) * .85;
  camTgt.z += (player.pos.z - camTgt.z) * .85;
  if (engine.cameraOverride) {
    engine.cameraOverride(dt, et);                    // a module drives camera.position / quaternion itself
    camPos.copy(camera.position);                     // so the spring resumes smoothly when it lets go
  } else {
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
  }

  // ── Sky rotation follows camera (static sky) ──
  skySphere.position.copy(camera.position);

  // ── Compass ──
  const yawDeg = (player.yaw * 180 / Math.PI) % 360;
  compassNeedle.style.transform = `rotate(${yawDeg}deg)`;

  // ── Proximity: check nearest sightseeing point ──
  nearestSight = -1;
  let bestDist = INTERACT_RADIUS;
  sights.forEach((s, i) => {
    if (s.when && !s.when()) return;
    const d = Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z);
    if (d < bestDist) { bestDist=d; nearestSight=i; }
  });
  const plaqueDist = player.pos.distanceTo(plaqueMesh.position);

  if (engine.isLocked() || storyUI.isModalOpen() || photo.isActive()) {
    promptEl.style.display = 'none';
  } else if (nearestSight >= 0) {
    const s = sights[nearestSight];
    setPromptHTML(`<kbd>E</kbd> ${storyUI.promptFor(s.id) ?? `${s.icon} ${s.name}`}`);
    promptEl.style.display = 'block';
  } else if (plaqueDist < 5) {
    setPromptHTML(`<kbd>E</kbd> ✦ 查看纪念铭牌`);
    promptEl.style.display = 'block';
  } else {
    promptEl.style.display = 'none';
  }

  // ── Chapter modules + scene hooks ──
  photo.update(dt, et);
  storyUI.update(dt, et);
  map.update(dt, et);
  title.update(dt, et);
  banter.update(dt, et);                              // after the camera: projects heads to screen
  sceneHooks.update(dt, et);
  world.update(dt, et);

  // ── Render ──
  composer.render();
}

loop();
