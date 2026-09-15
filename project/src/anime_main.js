// ═══════════════════════════════════════════════════════════════════════════
//  我们的 LMU — 动漫风格 3D 场景
//  Toon shading · Cel outlines · Sakura · Spring camera · Bloom
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

// ── PERSONAL CONFIG ─────────────────────────────────────────────────────────
const START_DATE    = new Date('2024-03-15');   // ← 改成你们在一起的日期
const DAYS_TOGETHER = Math.max(0, Math.floor((Date.now() - START_DATE) / 86_400_000));
document.getElementById('days-num').textContent = DAYS_TOGETHER;
document.getElementById('popup-num').textContent = DAYS_TOGETHER;
document.getElementById('popup-days').textContent = DAYS_TOGETHER;

// ── BUILDING DIMENSIONS (from lmu_dimensions_estimate.json) ─────────────────
const D = {
  bW:160, bH:23, bDepth:22,          // building overall [E=estimate]
  cW:36,  cH:27, cProj:2.8,          // central risalit
  eW:12,  eProj:1.2,                  // end pavilions
  wW:62,                              // each wing width = (160-36)/2
  colN:8, colH:9.2, colR:0.48,       // entrance columns [E]
  winW:1.55, winH:2.75, winHgf:3.8,  // upper / ground floor windows [E]
  winBay:4.1, gfH:5.0, ufH:6.0,      // bay spacing, floor heights [E]
  fnH:8.20, fnR:5.0, fnX:35, fnY:-48,// fountain [C=confirmed]
  plW:200, plD:80,                    // plaza [E from OSM]
  roadX:112, roadW:33,               // Ludwigstraße [C]
};

// ── RENDERER ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputColorSpace   = THREE.SRGBColorSpace;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.5, 900);

// ── POST-PROCESSING ──────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.7, 0.80
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

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
  new THREE.SphereGeometry(700, 32, 16),
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

// ── GROUND + ROADS ───────────────────────────────────────────────────────────
// Base ground
box([0,-0.15,0],[600,0.3,600], mat.plaza, true, false);

// Plaza cobblestone
box([0,0,-(D.plD*.5)], [D.plW, 0.06, D.plD], mat.plaza, true, false);

// Sidewalk strips
box([0,0.04,-(D.plD+4)], [D.plW+40, 0.08, 8], mat.sidewalk, false, false);

// Ludwigstraße — runs N-S east of building
const roadCx = D.roadX + D.roadW*.5;
box([roadCx, 0.05, 0], [D.roadW, 0.1, 300], mat.road, false, false);
// Lane markings
for (let z=-140; z<140; z+=10)
  box([roadCx, 0.11, z], [.18, .02, 4], mat.roadMk, false, false);
// Cycle lane stripe
box([roadCx - D.roadW*.5+2.5, .065, 0], [2.2, .03, 300], mat.sidewalk, false, false);
box([roadCx + D.roadW*.5-2.5, .065, 0], [2.2, .03, 300], mat.sidewalk, false, false);

// ── LMU MAIN BUILDING ────────────────────────────────────────────────────────
// Coordinate convention:
//   +X = East,  +Y = North (into building), +Z = Up
//   Main facade is at Y=0, facing -Y (south, toward plaza)
//   Plaza is south of building (negative Z in viewer space = -Y in world)
//   NB: Three.js default camera looks toward -Z; we orient plaza along -Y here.
//
// Actually: standard Three.js setup — let's use X/Z for ground plane, Y for up.
// Buildings face -Z (south), plaza is toward -Z, player starts at Z > 0.
// Let me restate:
//   +X = East, +Z = South (toward plaza = toward viewer), +Y = Up
//   Facade face at Z=0, building extends north (Z < 0).
//   Player starts around Z = 80 (south of building).

function buildingBox(pos, sz, m) { return box(pos, sz, m, true, true); }

// Wings
const WOFF = D.cW*.5 + D.wW*.5;   // = 18 + 31 = 49
buildingBox([-WOFF, D.bH*.5, -(D.bDepth*.5)],  [D.wW, D.bH, D.bDepth], mat.facade);   // left
buildingBox([ WOFF, D.bH*.5, -(D.bDepth*.5)],  [D.wW, D.bH, D.bDepth], mat.facade);   // right

// End pavilions (project slightly forward)
const EX = D.bW*.5 - D.eW*.5;
buildingBox([-EX, D.bH*.5, -(D.bDepth*.5 - D.eProj*.5)], [D.eW, D.bH, D.bDepth+D.eProj], mat.facade);
buildingBox([ EX, D.bH*.5, -(D.bDepth*.5 - D.eProj*.5)], [D.eW, D.bH, D.bDepth+D.eProj], mat.facade);

// Central risalit (taller, projects furthest forward)
buildingBox([0, D.cH*.5, -(D.bDepth*.5 - D.cProj*.5)], [D.cW, D.cH, D.bDepth+D.cProj], mat.facade2);

// Belt cornice (separates ground floor from upper)
const bcZ = -(D.bDepth*.5 - D.cProj*.5);
box([0, D.gfH+0.28, bcZ], [D.bW, 0.56, D.bDepth+D.cProj+0.1], mat.parapet, false, false);

// Cornice + parapet on wings
box([0, D.bH+0.38, -(D.bDepth*.5)], [D.bW+2, 0.76, D.bDepth+.4], mat.parapet, false, false);
box([0, D.bH+0.76+0.8, -(D.bDepth*.5)], [D.bW+2, 1.6, D.bDepth*.55], mat.parapet, false, false);

// Central pediment
box([0, D.cH+0.38, -(D.bDepth*.5-D.cProj*.5)], [D.cW+2, 0.76, D.bDepth*.4+D.cProj], mat.parapet, false, false);
box([0, D.cH+3.5,  .3], [D.cW*.78, 5.5, 1.0], mat.facade2, true, true);  // pediment triangle (approx)

// Roof planes
box([0, D.bH+2.7, -(D.bDepth*.65)], [D.bW, 0.28, D.bDepth*.4], mat.roof, false, false);
box([0, D.cH+2.0, -(D.bDepth*.4)],  [D.cW, 0.28, D.bDepth*.5], mat.roof, false, false);

// ── COLUMNS (entrance colonnade) ─────────────────────────────────────────────
const colSpan  = D.cW * 0.74;
const colStart = -colSpan * .5;
const colSpc   = colSpan / (D.colN - 1);
const colFaceZ = D.cProj + 0.55;       // in front of central face

for (let i = 0; i < D.colN; i++) {
  const cx = colStart + i * colSpc;
  // Shaft
  cyl([cx, D.colH*.5, colFaceZ], D.colR, D.colH, 14, mat.column);
  // Capital
  box([cx, D.colH+0.38, colFaceZ], [D.colR*3.2, 0.76, D.colR*2.8], mat.column, false, false);
  // Base
  box([cx, 0.24, colFaceZ], [D.colR*3.2, 0.48, D.colR*2.8], mat.column, false, false);
}
// Entablature
box([0, D.colH+0.76+0.65, colFaceZ], [colSpan+D.colR*4, 1.3, 1.0], mat.column, false, false);

// ── ENTRANCE ─────────────────────────────────────────────────────────────────
const entZ = D.cProj + 0.1;
// Door arch (using ShapeGeometry flat panel on facade)
const entGeo = archGeo(7.0, 10.0, 12);
const entMesh = new THREE.Mesh(entGeo, mat.door);
entMesh.rotation.x = -Math.PI*.5;   // lay in XZ plane, normal = -Z (faces south)
entMesh.rotation.z =  Math.PI;      // flip so arch opens upward
entMesh.position.set(0, 0, entZ + 0.1);
scene.add(entMesh); ol(entMesh, 0.04);

// Entrance steps (4 steps)
for (let s = 0; s < 5; s++) {
  const sw = 16 + s*3;
  box([0, s*.32+.16, entZ + s*1.1 + 0.6], [sw, .32, 1.1], mat.steps);
}

// ── WINDOWS (InstancedMesh) ──────────────────────────────────────────────────
const wGeo = archGeo(D.winW, D.winH, 8);
const wGeoGF = archGeo(D.winW*1.35, D.winHgf, 8);
const dummy = new THREE.Object3D();

// Rotation to place arch window on south-facing facade (Z plane)
// ShapeGeo is in XY plane (normal = +Z).
// We want normal = -Z (south-facing). Rotate Y by PI.
const WIN_ROT_X = 0;
const WIN_ROT_Y = Math.PI;   // flip to face -Z
const WIN_ROT_Z = 0;

// Collect all window positions
const winPositions = [];  // {x, z_sill, isCentral}
const gfPositions  = [];

// Left and right wing windows
const wingSegs = [
  { xFrom: -(D.bW*.5), xTo: -(D.cW*.5), dir: 1 },
  { xFrom:  (D.cW*.5), xTo:  (D.bW*.5), dir: 1 },
];
for (const seg of wingSegs) {
  let x = seg.xFrom + D.winBay*.5 + (seg.dir === 1 ? D.eW + 2 : 0);
  const xEnd = seg.xTo - D.eW - 2;
  while (x < xEnd - .5) {
    // Upper floors: 3 rows
    for (let row = 0; row < 3; row++) {
      const zSill = D.gfH + 0.6 + row * D.ufH;
      winPositions.push({ x, zSill });
    }
    // Ground floor: every other bay
    if (Math.round(x / D.winBay) % 2 === 0) {
      gfPositions.push({ x, zSill: 0.9 });
    }
    x += D.winBay;
  }
}
// Central section: flanking entrance (skip entrance zone)
for (const sx of [-1, 1]) {
  for (let bay = 0; bay < 2; bay++) {
    const wx = sx * (D.winBay * (bay + 1.5));
    for (let row = 0; row < 3; row++) {
      const zSill = D.gfH + 0.6 + row * D.ufH;
      winPositions.push({ x: wx, zSill, ctr: true });
    }
  }
}

// Build upper window InstancedMesh
const winCount = winPositions.length;
const winMeshFrame = new THREE.InstancedMesh(wGeo, mat.winFrame, winCount);
const winMeshGlass = new THREE.InstancedMesh(wGeo, mat.winGlass, winCount);
winMeshFrame.castShadow = false;
winMeshGlass.castShadow = false;

winPositions.forEach(({ x, zSill, ctr }, i) => {
  const facadeZ = ctr ? D.cProj + 0.06 : 0.08;
  dummy.position.set(x, zSill, facadeZ);
  dummy.rotation.set(WIN_ROT_X, WIN_ROT_Y, WIN_ROT_Z);
  dummy.scale.set(1, 1, 0.14);
  dummy.updateMatrix();
  winMeshFrame.setMatrixAt(i, dummy.matrix);

  dummy.position.set(x, zSill, facadeZ + 0.08);
  dummy.scale.set(0.88, 0.88, 0.08);
  dummy.updateMatrix();
  winMeshGlass.setMatrixAt(i, dummy.matrix);
});
winMeshFrame.instanceMatrix.needsUpdate = true;
winMeshGlass.instanceMatrix.needsUpdate = true;
scene.add(winMeshFrame, winMeshGlass);

// Ground floor arch windows
const gfCount = gfPositions.length;
if (gfCount > 0) {
  const gfFrame = new THREE.InstancedMesh(wGeoGF, mat.winFrame, gfCount);
  const gfGlass = new THREE.InstancedMesh(wGeoGF, mat.winGlass, gfCount);
  gfPositions.forEach(({ x, zSill }, i) => {
    dummy.position.set(x, zSill, 0.08);
    dummy.rotation.set(0, Math.PI, 0);
    dummy.scale.set(1, 1, 0.18);
    dummy.updateMatrix();
    gfFrame.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, zSill, 0.15);
    dummy.scale.set(0.86, 0.86, 0.1);
    dummy.updateMatrix();
    gfGlass.setMatrixAt(i, dummy.matrix);
  });
  gfFrame.instanceMatrix.needsUpdate = true;
  gfGlass.instanceMatrix.needsUpdate = true;
  scene.add(gfFrame, gfGlass);
}

// ── ADJACENT BUILDINGS ────────────────────────────────────────────────────────
for (const sx of [-1,1]) {
  const ax = sx * (D.bW*.5 + 32);
  buildingBox([ax, 16, -(D.bDepth*.5+4)], [48, 32, 40], mat.adjacent);
  buildingBox([ax+sx*52, 12, -(D.bDepth*.5+6)], [36, 24, 44], mat.adjacent);
}

// ── FOUNTAINS ────────────────────────────────────────────────────────────────
for (const sx of [-1, 1]) {
  const fx = sx * D.fnX, fz = D.fnY;
  cyl([fx, .45, fz], D.fnR,   .9,  28, mat.fountain);   // basin
  cyl([fx, .9,  fz], D.fnR-.4, .05, 28, mat.water);      // water surface
  cyl([fx, D.fnH*.5, fz], .38, D.fnH, 16, mat.fountain); // shaft [C: 8.20m]
  cyl([fx, D.fnH+.45, fz], 1.8, .9,  20, mat.fountain);  // top bowl
  cyl([fx, D.fnH+.95, fz], .2,  .5,  12, mat.fountain);  // finial
}

// ── TREES ────────────────────────────────────────────────────────────────────
const treePts = [
  // Rows flanking plaza axis
  ...[...Array(7)].map((_,i) => [-54+i*18, -16]),
  ...[...Array(7)].map((_,i) => [-54+i*18, -52]),
  ...[...Array(5)].map((_,i) => [-44+i*22, -72]),
  // Lateral edges
  ...[...Array(3)].map((_,i) => [-90, -20+i*22]),
  ...[...Array(3)].map((_,i) => [ 90, -20+i*22]),
];

// InstancedMesh for trunks and crowns
const trunkGeo  = new THREE.CylinderGeometry(.38,.48,5.5,8);
const crownGeoA = new THREE.SphereGeometry(4.2,10,7);
const crownGeoB = new THREE.SphereGeometry(3.0,10,7);

const trunkInst  = new THREE.InstancedMesh(trunkGeo,  mat.trunk,   treePts.length);
const crownInstA = new THREE.InstancedMesh(crownGeoA, mat.foliageA, treePts.length);
const crownInstB = new THREE.InstancedMesh(crownGeoB, mat.foliageB, treePts.length);
[trunkInst,crownInstA,crownInstB].forEach(m => { m.castShadow=true; scene.add(m); });

const crownOffsets = treePts.map((_,i) => ({
  ox:(Math.random()-.5)*1.2, oz:(Math.random()-.5)*1.2,
  h:4.5+(i%4)*.5, r:4.0+(i%3)*.4,
}));

treePts.forEach(([tx,tz], i) => {
  const { ox, oz, h } = crownOffsets[i];
  dummy.position.set(tx, 2.75, tz);
  dummy.rotation.set(0, Math.random()*Math.PI*2, 0);
  dummy.scale.setScalar(1);
  dummy.updateMatrix();
  trunkInst.setMatrixAt(i, dummy.matrix);

  dummy.position.set(tx+ox, h, tz+oz);
  dummy.scale.setScalar(1);
  dummy.updateMatrix();
  crownInstA.setMatrixAt(i, dummy.matrix);

  dummy.position.set(tx-ox*.6, h-1.2, tz-oz*.6);
  dummy.scale.setScalar(1);
  dummy.updateMatrix();
  crownInstB.setMatrixAt(i, dummy.matrix);
});
[trunkInst,crownInstA,crownInstB].forEach(m=>m.instanceMatrix.needsUpdate=true);

// ── STREET FURNITURE ─────────────────────────────────────────────────────────
const benchXs = [-50,-30,-10,10,30,50];
for (const bx of benchXs) {
  box([bx, .42, -22], [2.2,.45,.6], mat.bench);
  box([bx, .82, -22.2], [2.2,.45,.12], mat.bench, false, false);
}
// Lamps
const lampXs = [-70,-50,-30,30,50,70];
for (const lx of lampXs) {
  cyl([lx, 3.5, -20], .09, 7, 8, mat.lamp);
  cyl([lx, 7.2, -20], .28, .45, 8, mat.lampGlow);
  // Point light per lamp (subtle)
  const pl = new THREE.PointLight(0xFFD070, 8, 22, 2);
  pl.position.set(lx, 7.2, -20);
  scene.add(pl);
}

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
  z: (Math.random()-.5)*120 - 20,
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
const sights = [
  { pos: new THREE.Vector3(0, 1, 5),
    icon:'🏛', name:'LMU 主入口 · Haupteingang',
    text:'这座入口建于 1835–1840 年，由建筑师 Friedrich von Gärtner 设计，融合了罗马式圆拱风格（Rundbogenstil）。\n中央入口前的 8 根廊柱高约 9.2 米，是整个立面最具辨识度的标志。',
    src:'来源：LMU 官方导览 · lmu.de' },
  { pos: new THREE.Vector3(0, 1, -55),
    icon:'✉', name:'白玫瑰纪念地 · Weiße Rose',
    text:'1943 年，大学生索菲·朔尔和汉斯·朔尔在此散发反纳粹传单。\n主楼前的广场以他们的名字命名：Geschwister-Scholl-Platz。',
    src:'来源：de.wikipedia.org/wiki/Weiße_Rose' },
  { pos: new THREE.Vector3(35, 1, -46),
    icon:'⛲', name:'喷泉 · Brunnen',
    text:'广场上两座喷泉设计于 1842–1844 年，同样出自 Friedrich von Gärtner 之手。\n每根喷泉柱高 8.20 米，水盆直径约 10 米。',
    src:'来源：de.wikipedia.org/wiki/Geschwister-Scholl-Platz_(München)' },
  { pos: new THREE.Vector3(0, 1, -75),
    icon:'💌', name:'我们的广场',
    text:'这里是我们的小世界。\n每一次散步，每一个清晨，每一次牵手，\n都留在了这条 Ludwigstraße 和这座主楼之间。',
    src:'来源：我们 ♡' },
];

// Sightseeing markers
const markerGeo  = new THREE.SphereGeometry(.42, 14, 10);
const markerMats = [0xE87050,0x80C8E8,0xE8C840,0xFF88AA].map(c=>
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
plaqueMesh.position.set(10, .8, 5.5);
scene.add(plaqueMesh);

// ── LIGHTING ─────────────────────────────────────────────────────────────────
// Anime-style: warm directional + cool sky fill + ambient
const sun = new THREE.DirectionalLight(0xFFF4E0, 3.8);
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

const skyLight = new THREE.HemisphereLight(0x8AB8F0, 0xC8B890, 1.2);
scene.add(skyLight);

const ambLight = new THREE.AmbientLight(0xF0E8D8, 0.5);
scene.add(ambLight);

// ── PLAYER ───────────────────────────────────────────────────────────────────
const player = { pos: new THREE.Vector3(0, 0, 65), yaw: 0 };
const keys   = {};
const solids = [
  // Building main mass (rough AABB)
  { cx:0,   cz:-(D.bDepth*.5), hw:D.bW*.5+1, hd:D.bDepth*.5+2 },
  // Left adjacent
  { cx:-(D.bW*.5+32), cz:-(D.bDepth+4), hw:52, hd:52 },
  // Right adjacent
  { cx: (D.bW*.5+32), cz:-(D.bDepth+4), hw:52, hd:52 },
];
function blocked(x, z) {
  return solids.some(s => Math.abs(x-s.cx) < s.hw && Math.abs(z-s.cz) < s.hd);
}
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

// ── CAMERA (spring-arm third-person) ─────────────────────────────────────────
let pitch = .28, camDist = 14;
let camPos  = new THREE.Vector3(0, 14, 80);
let camTgt  = new THREE.Vector3(0,  2, 65);
let drag = false, lastMX = 0, lastMY = 0;

canvas.addEventListener('mousedown', e => { drag=true; lastMX=e.clientX; lastMY=e.clientY; });
addEventListener('mouseup',   () => drag = false);
addEventListener('mousemove', e => {
  if (!drag) return;
  player.yaw -= (e.clientX - lastMX) * .004;
  pitch = Math.max(.08, Math.min(1.15, pitch + (e.clientY - lastMY) * .004));
  lastMX = e.clientX; lastMY = e.clientY;
});
addEventListener('wheel', e => camDist = Math.max(5, Math.min(22, camDist + e.deltaY*.012)));

// Touch support
let touches = {};
canvas.addEventListener('touchstart', e => {
  [...e.changedTouches].forEach(t => { touches[t.identifier] = { x:t.clientX, y:t.clientY }; });
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const prev = touches[t.identifier];
    if (prev) {
      player.yaw -= (t.clientX - prev.x) * .004;
      pitch = Math.max(.08, Math.min(1.15, pitch + (t.clientY - prev.y) * .004));
    }
    touches[t.identifier] = { x:t.clientX, y:t.clientY };
  }
}, { passive:false });

// ── UI INTERACTIONS ───────────────────────────────────────────────────────────
const panel    = document.getElementById('panel');
const promptEl = document.getElementById('prompt');
const daysPopup = document.getElementById('days-popup');
const photoOverlay = document.getElementById('photo-overlay');
const photoBtn     = document.getElementById('photo-btn');

let photoMode = false, nearestSight = -1;

document.getElementById('panel-close').onclick = () => panel.classList.remove('open');
document.getElementById('days-popup-close').onclick = () => daysPopup.classList.remove('visible');
photoBtn.onclick = () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.download = `our-lmu-${new Date().toISOString().slice(0,10)}.png`;
  a.href = renderer.domElement.toDataURL('image/png'); a.click();
};

function openSight(i) {
  const s = sights[i];
  document.getElementById('panel-icon').textContent  = s.icon;
  document.getElementById('panel-title').textContent = s.name;
  document.getElementById('panel-text').textContent  = s.text;
  document.getElementById('panel-source').textContent = s.src;
  panel.classList.add('open');
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'e') {
    if (nearestSight >= 0) { openSight(nearestSight); return; }
    // Check plaque
    if (player.pos.distanceTo(plaqueMesh.position) < 5) {
      daysPopup.classList.add('visible'); return;
    }
  }
  if (k === 'p') {
    photoMode = !photoMode;
    photoOverlay.classList.toggle('active', photoMode);
    photoBtn.classList.toggle('visible', photoMode);
    document.getElementById('hud').classList.toggle('hidden', photoMode);
  }
  if (k === ' ' && photoMode) {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.download = `our-lmu-${new Date().toISOString().slice(0,10)}.png`;
    a.href = renderer.domElement.toDataURL('image/png'); a.click();
  }
  if (k === 'escape') {
    panel.classList.remove('open');
    daysPopup.classList.remove('visible');
    if (photoMode) { photoMode=false; photoOverlay.classList.remove('active'); photoBtn.classList.remove('visible'); document.getElementById('hud').classList.remove('hidden'); }
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
      p.z = (Math.random()-.5)*120 - 20;
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
    m.scale.setScalar(1 + Math.sin(et*2 + i) * .08);
    m.position.y = sights[i].pos.y + Math.sin(et*1.5 + i) * .15;
  });

  // ── Plaque glow ──
  plaqueMesh.material.emissiveIntensity = .2 + Math.sin(et*1.8)*.15;

  // ── Player movement ──
  let speed = keys.shift ? 8.5 : 4.2;
  let mx=0, mz=0;
  if (keys.w||keys.arrowup)    mz -= 1;
  if (keys.s||keys.arrowdown)  mz += 1;
  if (keys.a||keys.arrowleft)  mx -= 1;
  if (keys.d||keys.arrowright) mx += 1;
  const l = Math.hypot(mx,mz)||1; mx/=l; mz/=l;
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const nx = player.pos.x + (mx*cy - mz*sy)*speed*dt;
  const nz = player.pos.z + (mx*sy + mz*cy)*speed*dt;
  if (!blocked(nx, player.pos.z)) player.pos.x = nx;
  if (!blocked(player.pos.x, nz)) player.pos.z = nz;

  // ── Spring-arm camera ──
  const idealX = player.pos.x + Math.sin(player.yaw)*camDist*Math.cos(pitch);
  const idealY = player.pos.y + Math.sin(pitch)*camDist + 1.2;
  const idealZ = player.pos.z + Math.cos(player.yaw)*camDist*Math.cos(pitch);
  const k = 1 - Math.exp(-7 * dt);
  camPos.x += (idealX - camPos.x)*k;
  camPos.y += (idealY - camPos.y)*k;
  camPos.z += (idealZ - camPos.z)*k;
  camera.position.copy(camPos);
  camTgt.x += (player.pos.x - camTgt.x) * .85;
  camTgt.y += (player.pos.y + 1.6 - camTgt.y) * .85;
  camTgt.z += (player.pos.z - camTgt.z) * .85;
  camera.lookAt(camTgt);

  // ── Sky rotation follows camera (static sky) ──
  skySphere.position.copy(camera.position);

  // ── Compass ──
  const yawDeg = (player.yaw * 180 / Math.PI) % 360;
  compassNeedle.style.transform = `rotate(${yawDeg}deg)`;

  // ── Proximity: check nearest sightseeing point ──
  nearestSight = -1;
  let bestDist = 6.5;
  sights.forEach((s, i) => {
    const d = new THREE.Vector2(player.pos.x - s.pos.x, player.pos.z - s.pos.z).length();
    if (d < bestDist) { bestDist=d; nearestSight=i; }
  });
  const plaqueDist = player.pos.distanceTo(plaqueMesh.position);

  if (nearestSight >= 0) {
    promptEl.innerHTML = `<kbd>E</kbd> ${sights[nearestSight].icon} ${sights[nearestSight].name}`;
    promptEl.style.display = 'block';
  } else if (plaqueDist < 5) {
    promptEl.innerHTML = `<kbd>E</kbd> ✦ 查看纪念铭牌`;
    promptEl.style.display = 'block';
  } else {
    promptEl.style.display = 'none';
  }

  // ── Render ──
  composer.render();
}

loop();
