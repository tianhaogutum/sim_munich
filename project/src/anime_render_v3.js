// ═══════════════════════════════════════════════════════════════════════════
//  我们的 LMU — 动漫风格 3D 场景
//  Toon shading · Cel outlines · Sakura · Spring camera · Bloom
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader }      from 'three/addons/shaders/FXAAShader.js';
import { addAnimeArchitectureDetail } from './anime_architecture_detail.js';
import { addAnimeEnvironmentDetail } from './anime_environment_detail.js';

// Static capture contract: ?render=facade|plaza|garden. No RAF or gameplay.
const requestedRender = new URLSearchParams(location.search).get('render');
const renderMode = ['facade', 'plaza', 'garden'].includes(requestedRender) ? requestedRender : null;
const STILL_TIME = 12;
let randomSeed = 0x4c4d55;
const random = () => {
  if (!renderMode) return Math.random();
  randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
  return randomSeed / 4294967296;
};
if (renderMode) {
  for (const id of ['hud', 'panel', 'days-popup', 'photo-overlay', 'photo-btn']) {
    document.getElementById(id).style.display = 'none';
  }
}

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
  fnH:8.20, fnR:5.0, fnX:35, fnZ:48,// fountain [C=confirmed]
  plW:200, plD:80,                    // plaza [E from OSM]
  roadX:112, roadW:33,               // Ludwigstraße [C]
};

// ── RENDERER ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
// Postprocessing uses its own antialiasing. Bound render-target memory on
// Retina/4K screens while retaining detail on ordinary laptop displays.
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false });
function renderPixelRatio() {
  if (renderMode) {
    return Math.min(2, Math.sqrt(4_000_000 / Math.max(1, innerWidth * innerHeight)));
  }
  return Math.min(window.devicePixelRatio || 1, 1.75,
    Math.sqrt(3_000_000 / Math.max(1, innerWidth * innerHeight)));
}
renderer.setPixelRatio(renderPixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputColorSpace   = THREE.SRGBColorSpace;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const scene  = new THREE.Scene();
// Distant streets dissolve into the same pale blue used at the sky horizon.
scene.fog = new THREE.Fog(0xc6d9df, 190, 500);
const sunDirection = new THREE.Vector3(-105, 105, 85).normalize();
const camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.5, 900);

// ── POST-PROCESSING ──────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.45, 1.15
);
composer.addPass(bloom);
// Grade in linear space; OutputPass alone handles tone mapping and sRGB.
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float shade = 1.0 - smoothstep(0.08, 0.8, luma);
      color *= mix(vec3(1.025, 1.0, 0.975), vec3(0.96, 0.985, 1.04), shade);
      color = mix(vec3(luma), color, 1.045);
      vec2 edge = vUv * (1.0 - vUv);
      float vignette = 1.0 - 0.075 * (1.0 - pow(16.0 * edge.x * edge.y, 0.35));
      gl_FragColor = vec4(max(color * vignette, vec3(0.0)), texel.a);
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());
// FXAA acts on the final display colors, including outlines and bloom edges.
const antialias = new ShaderPass(FXAAShader);
composer.addPass(antialias);
function updateAntialiasResolution() {
  const ratio = renderer.getPixelRatio();
  antialias.uniforms.resolution.value.set(
    1 / Math.max(1, innerWidth * ratio), 1 / Math.max(1, innerHeight * ratio));
}
updateAntialiasResolution();

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
  facade:   T(0xe7dfce),
  facade2:  T(0xd9ccb4),
  column:   T(0xf3ecdd),
  roof:     T(0x5c5b56),
  parapet:  T(0xcbbfa7),
  winGlass: new THREE.MeshStandardMaterial({ color:0x3d7187, roughness:.28, metalness:.22,
              emissive:0x172d3b, emissiveIntensity:.22 }),
  winFrame: T(0xC4AC6A),
  door:     T(0x2A1808),
  steps:    T(0xb5aa92),
  plaza:    T(0xbcb39e),
  road:     T(0x3E4246),
  roadMk:   T(0xC0BAA8),
  sidewalk: T(0xA8A494),
  fountain: T(0x8a9293),
  water:    new THREE.MeshToonMaterial({ color:0x5ca7af, gradientMap:G3,
              transparent:true, opacity:.86, emissive:0x102b31, emissiveIntensity:.25 }),
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
// A single background draw: layered painted clouds, a warm sun disc and
// atmospheric horizon. No transparent cloud sorting or large texture downloads.
const skySphere = new THREE.Mesh(
  new THREE.SphereGeometry(700, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topCol: { value: new THREE.Color(0x397dbb) },
      midCol: { value: new THREE.Color(0x87b5d3) },
      horCol: { value: new THREE.Color(0xf3dfca) },
      fogCol: { value: new THREE.Color(0xc6d9df) },
      sunDir: { value: sunDirection },
      time: { value: 0 },
    },
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 topCol, midCol, horCol, fogCol, sunDir;
      uniform float time;
      varying vec3 vDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 direction = normalize(vDirection);
        float height = direction.y;
        vec3 color = mix(horCol, midCol, smoothstep(0.0, 0.28, height));
        color = mix(color, topCol, smoothstep(0.2, 0.95, height));
        color = mix(fogCol, color, smoothstep(-0.04, 0.12, height));
        float sunFacing = max(dot(direction, sunDir), 0.0);
        color += vec3(1.0, 0.69, 0.36) * pow(sunFacing, 24.0) * 0.22;
        // Broad, gently drifting shapes with distinct cream and blue-grey bands.
        if (height > 0.025) {
          vec2 p = direction.xz / (height + 0.28) * 3.6;
          p += vec2(time * 0.006, time * 0.002);
          float cloud = noise(p) * 0.62 + noise(p * 2.1) * 0.26
                      + noise(p * 4.3) * 0.12;
          float coverage = smoothstep(0.55, 0.64, cloud)
                         * smoothstep(0.025, 0.18, height);
          vec3 cloudColor = mix(vec3(0.51, 0.63, 0.73), vec3(0.95, 0.91, 0.82),
                               smoothstep(0.58, 0.72, cloud));
          color = mix(color, cloudColor, coverage * 0.92);
        }
        float disc = smoothstep(0.99955, 0.9998, sunFacing);
        color = mix(color, vec3(3.2, 2.5, 1.6), disc);
        gl_FragColor = vec4(color, 1.0);
      }`,
  })
);
skySphere.renderOrder = -100;
skySphere.frustumCulled = false;
scene.add(skySphere);

// ── GROUND + ROADS ───────────────────────────────────────────────────────────
// Base ground
box([0,-0.15,0],[600,0.3,600], mat.plaza, true, false);

// Plaza cobblestone
box([0,0,D.plD*.5], [D.plW, 0.06, D.plD], mat.plaza, true, false);

// Sidewalk strips
box([0,0.04,D.plD+4], [D.plW+40, 0.08, 8], mat.sidewalk, false, false);

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
// X/Z ground plane, Y up. The facade faces +Z; the building extends -Z.
// Public plaza, approach and starting player are all in front, at positive Z.

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

// Cornices follow each facade plane instead of bridging empty space.
for (const sign of [-1, 1]) {
  for (const [x, width, front] of [[sign * 43, 50, 0], [sign * EX, D.eW, D.eProj]]) {
    box([x, D.gfH+.28, front+.12], [width, .56, .42], mat.parapet, false, false);
    box([x, D.bH+.38, front+.12], [width+.4, .76, .65], mat.parapet, false, false);
  }
}
box([0, D.bH+1.2, -D.bDepth*.6], [D.bW+1, 1.6, D.bDepth*.55], mat.parapet, false, false);
box([0, D.cH+.38, D.cProj+.18], [D.cW+2, .76, 1.1], mat.parapet, false, false);
// True triangular tympanum, with shallow extruded stone depth.
const pedimentShape = new THREE.Shape();
pedimentShape.moveTo(-19, 0); pedimentShape.lineTo(19, 0);
pedimentShape.lineTo(0, 6); pedimentShape.closePath();
const pediment = new THREE.Mesh(new THREE.ExtrudeGeometry(pedimentShape,
  { depth:.85, bevelEnabled:false }), mat.facade2);
pediment.position.set(0, D.cH+.76, D.cProj-.3);
pediment.castShadow = pediment.receiveShadow = true;
scene.add(pediment);

// Roofs meet the parapets; the central roof follows the triangular pediment.
box([0, D.bH+2.14, -(D.bDepth*.65)], [D.bW, 0.28, D.bDepth*.4], mat.roof, false, false);
box([0, D.cH+.38, -(D.bDepth-D.cProj)*.5],
  [D.cW,.76,D.bDepth+D.cProj],mat.facade2,true,false);
const centralRoof = new THREE.Mesh(new THREE.ExtrudeGeometry(pedimentShape,
  { depth:D.bDepth+D.cProj-.3, bevelEnabled:false }),mat.roof);
centralRoof.position.set(0,D.cH+.76,-D.bDepth);
centralRoof.castShadow = centralRoof.receiveShadow = true;
scene.add(centralRoof);
box([0,D.cH+6.83,-(D.bDepth-D.cProj)*.5],
  [.22,.14,D.bDepth+D.cProj],mat.roof,false,false);

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
// ShapeGeometry already faces +Z and its arch rises along +Y.
entMesh.position.set(0, 1.6, entZ + 0.1);
scene.add(entMesh); ol(entMesh, 0.04);

// Entrance steps (4 steps)
for (let s = 0; s < 5; s++) {
  const sw = 16 + s*3;
  const height = (5-s)*.32;
  box([0, height*.5, entZ + s*1.1 + 0.6], [sw, height, 1.1], mat.steps);
}

// ── WINDOWS (InstancedMesh) ──────────────────────────────────────────────────
const wGeo = archGeo(D.winW, D.winH, 8);
const wGeoGF = archGeo(D.winW*1.35, D.winHgf, 8);
const dummy = new THREE.Object3D();

// Shared facade records also drive the ledges and mullions in the detail module.
const winPositions = [], gfPositions = [];
for (const sign of [-1, 1]) {
  for (let bay = 0; bay < 11; bay++) {
    const x = sign * (21.5 + bay * D.winBay);
    for (let row = 0; row < 3; row++) winPositions.push({ x, zSill:5.9+row*6, facadeZ:.08 });
    gfPositions.push({ x, zSill:.9, facadeZ:.08 });
  }
  for (const offset of [-3.6, 0, 3.6]) {
    const x = sign * EX + offset;
    for (let row = 0; row < 3; row++) winPositions.push({ x, zSill:5.9+row*6, facadeZ:D.eProj+.08 });
    gfPositions.push({ x, zSill:.9, facadeZ:D.eProj+.08 });
  }
  for (let bay = 0; bay < 3; bay++) {
    const x = sign * (5.8 + bay * 4.2);
    for (let row = 0; row < 3; row++) {
      if (row === 0 && bay === 0) continue; // Keep the tall portal clear.
      winPositions.push({ x, zSill:6+row*6, facadeZ:D.cProj+.08 });
    }
  }
}

// Build upper window InstancedMesh
const winCount = winPositions.length;
const winMeshFrame = new THREE.InstancedMesh(wGeo, mat.winFrame, winCount);
const winMeshGlass = new THREE.InstancedMesh(wGeo, mat.winGlass, winCount);
winMeshFrame.castShadow = false;
winMeshGlass.castShadow = false;

winPositions.forEach(({ x, zSill, facadeZ }, i) => {
  dummy.position.set(x, zSill, facadeZ);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 0.14);
  dummy.updateMatrix();
  winMeshFrame.setMatrixAt(i, dummy.matrix);

  dummy.position.set(x, zSill+.13, facadeZ + 0.08);
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
  gfPositions.forEach(({ x, zSill, facadeZ }, i) => {
    dummy.position.set(x, zSill, facadeZ);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 0.18);
    dummy.updateMatrix();
    gfFrame.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, zSill+.15, facadeZ+.08);
    dummy.scale.set(0.86, 0.86, 0.1);
    dummy.updateMatrix();
    gfGlass.setMatrixAt(i, dummy.matrix);
  });
  gfFrame.instanceMatrix.needsUpdate = true;
  gfGlass.instanceMatrix.needsUpdate = true;
  scene.add(gfFrame, gfGlass);
}

// ── ADJACENT BUILDINGS ────────────────────────────────────────────────────────
const contextBuildings = [-1, 1].flatMap(side => [
  { x:side*112, z:-15, width:48, height:24, depth:40 },
  { x:side*164, z:-17, width:36, height:21, depth:44 },
]);
for (const building of contextBuildings) {
  const { x, z, width, height, depth } = building;
  buildingBox([x, height/2, z], [width, height, depth], mat.adjacent);
}

// ── FOUNTAINS ────────────────────────────────────────────────────────────────
const bowlProfile = [[.38,0],[.5,.25],[.85,.55],[1.35,.85],[1.8,1.1],
  [1.8,1.15],[1.68,1.15],[1.26,.94],[.74,.65],[.38,.45]];
const bowlGeometry = new THREE.LatheGeometry(bowlProfile.map(p => new THREE.Vector2(...p)),48);
for (const sx of [-1, 1]) {
  const fx = sx * D.fnX, fz = D.fnZ;
  cyl([fx, .45, fz], D.fnR,   .9,  28, mat.fountain);   // basin
  cyl([fx, .9,  fz], D.fnR-.4, .05, 48, mat.water, false, false);      // water surface
  cyl([fx, 4.15, fz], .32, 6.5, 24, mat.fountain, true, false);
  cyl([fx, 1.16, fz], .64, .48, 24, mat.fountain, true, false);
  cyl([fx, 1.5, fz], .46, .25, 24, mat.fountain, true, false);
  cyl([fx, 7.35, fz], .5, .24, 24, mat.fountain, true, false);
  const bowl = new THREE.Mesh(bowlGeometry,mat.fountain);
  bowl.position.set(fx,7.5,fz);
  bowl.castShadow = bowl.receiveShadow = true;
  scene.add(bowl);
  cyl([fx, 8.57, fz], 1.65, .025, 48, mat.water, false, false);
  cyl([fx, D.fnH+.95, fz], .2,  .5,  12, mat.fountain);  // finial
}

// ── TREES ────────────────────────────────────────────────────────────────────
const treePts = [-1, 1].flatMap(sign => [
  ...[16, 38, 62].map(z => [sign*84, z]), [sign*68, 82],
]);

// InstancedMesh for trunks and crowns
const trunkGeo  = new THREE.CylinderGeometry(.38,.48,5.5,8);
const crownGeoA = new THREE.SphereGeometry(4.2,10,7);
const crownGeoB = new THREE.SphereGeometry(3.0,10,7);

const trunkInst  = new THREE.InstancedMesh(trunkGeo,  mat.trunk,   treePts.length);
const crownInstA = new THREE.InstancedMesh(crownGeoA, mat.foliageA, treePts.length);
const crownInstB = new THREE.InstancedMesh(crownGeoB, mat.foliageB, treePts.length);
trunkInst.name = 'base-tree-trunks';
crownInstA.name = 'base-tree-crown-a';
crownInstB.name = 'base-tree-crown-b';
[trunkInst,crownInstA,crownInstB].forEach(m => { m.castShadow=true; scene.add(m); });

const crownOffsets = treePts.map((_,i) => ({
  ox:(random()-.5)*1.2, oz:(random()-.5)*1.2,
  h:4.5+(i%4)*.5, r:4.0+(i%3)*.4,
}));

treePts.forEach(([tx,tz], i) => {
  const { ox, oz, h } = crownOffsets[i];
  dummy.position.set(tx, 2.75, tz);
  dummy.rotation.set(0, random()*Math.PI*2, 0);
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
const benchXs = [-64,-40,-22,22,40,64];
const benchWood = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat.bench,benchXs.length*6);
const benchIron = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat.lamp,benchXs.length*4);
benchXs.forEach((x,index) => {
  for (let slat=0; slat<3; slat++) {
    dummy.position.set(x,.5,21.78+slat*.23);
    dummy.rotation.set(0,0,0); dummy.scale.set(2.4,.09,.18); dummy.updateMatrix();
    benchWood.setMatrixAt(index*6+slat,dummy.matrix);
    dummy.position.set(x,.76+slat*.18,21.66);
    dummy.scale.set(2.4,.12,.08); dummy.updateMatrix();
    benchWood.setMatrixAt(index*6+3+slat,dummy.matrix);
  }
  for (let side=0; side<2; side++) {
    dummy.position.set(x+(side-.5)*1.8,.26,22);
    dummy.scale.set(.10,.48,.62); dummy.updateMatrix();
    benchIron.setMatrixAt(index*4+side*2,dummy.matrix);
    dummy.position.set(x+(side-.5)*1.8,.72,21.65);
    dummy.scale.set(.08,.8,.08); dummy.updateMatrix();
    benchIron.setMatrixAt(index*4+side*2+1,dummy.matrix);
  }
});
for (const mesh of [benchWood,benchIron]) {
  mesh.instanceMatrix.needsUpdate=true; mesh.castShadow=mesh.receiveShadow=true;
  mesh.computeBoundingSphere(); scene.add(mesh);
}
// Lamps
const lampXs = [-70,-50,-30,30,50,70];
for (const lx of lampXs) {
  cyl([lx, 3.5, 20], .09, 7, 8, mat.lamp);
  cyl([lx, 7.2, 20], .28, .45, 8, mat.lampGlow);
  // Emissive lanterns catch bloom; daylight needs no six extra per-pixel lights.
}

// ── SAKURA PARTICLE SYSTEM ───────────────────────────────────────────────────
const PETAL_COUNT = 420;
const DARK_PETAL_COUNT = Math.floor(PETAL_COUNT * .3);
const petalShape = new THREE.Shape();
petalShape.ellipse(0, 0, .28, .16, 0, Math.PI*2, false, 0);
const petalGeoBase = new THREE.ShapeGeometry(petalShape, 6);
const sakuraInst = new THREE.InstancedMesh(petalGeoBase, mat.sakura, PETAL_COUNT - DARK_PETAL_COUNT);
const sakuraDInst = new THREE.InstancedMesh(petalGeoBase, mat.sakuraD, DARK_PETAL_COUNT);
sakuraInst.castShadow = false;
sakuraDInst.castShadow = false;
scene.add(sakuraInst, sakuraDInst);
// Animated matrices leave the initial bounds; these small batches stay visible.
for (const mesh of [sakuraInst, sakuraDInst]) {
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
}

const petals = Array.from({ length: PETAL_COUNT }, (_, i) => ({
  x: (random()-.5)*220,
  y: random()*28 + 3,
  z: random()*90 + 5,
  vx: (random()-.5)*.08,
  vy: -(random()*.22+.10),
  vz: (random()-.5)*.06,
  rx: random()*Math.PI*2,
  ry: random()*Math.PI*2,
  rz: random()*Math.PI*2,
  vrx: random()*.025, vry: random()*.018, vrz: random()*.012,
  phase: random()*Math.PI*2,
  dark: i < DARK_PETAL_COUNT,
}));

// ── SIGHTSEEING POINTS ────────────────────────────────────────────────────────
const sights = [
  { pos: new THREE.Vector3(0, 1, 10),
    icon:'🏛', name:'LMU 主入口 · Haupteingang',
    text:'这座入口建于 1835–1840 年，由建筑师 Friedrich von Gärtner 设计，融合了罗马式圆拱风格（Rundbogenstil）。\n中央入口前的 8 根廊柱高约 9.2 米，是整个立面最具辨识度的标志。',
    src:'来源：LMU 官方导览 · lmu.de' },
  { pos: new THREE.Vector3(0, 1, 55),
    icon:'✉', name:'白玫瑰纪念地 · Weiße Rose',
    text:'1943 年，大学生索菲·朔尔和汉斯·朔尔在此散发反纳粹传单。\n主楼前的广场以他们的名字命名：Geschwister-Scholl-Platz。',
    src:'来源：de.wikipedia.org/wiki/Weiße_Rose' },
  { pos: new THREE.Vector3(35, 1, 55),
    icon:'⛲', name:'喷泉 · Brunnen',
    text:'广场上两座喷泉设计于 1842–1844 年，同样出自 Friedrich von Gärtner 之手。\n每根喷泉柱高 8.20 米，水盆直径约 10 米。',
    src:'来源：de.wikipedia.org/wiki/Geschwister-Scholl-Platz_(München)' },
  { pos: new THREE.Vector3(0, 1, 75),
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
plaqueMesh.position.set(17, .8, 8.8);
scene.add(plaqueMesh);

// ── LIGHTING ─────────────────────────────────────────────────────────────────
// Warm key and cool sky fill preserve readable cel bands without chalky whites.
const sun = new THREE.DirectionalLight(0xffe7c3, 2.65);
sun.target.position.set(0, 0, -5);
sun.position.copy(sunDirection).multiplyScalar(175).add(sun.target.position);
sun.castShadow = true;
const shadowResolution = renderMode ? 4096 : 2048;
sun.shadow.mapSize.set(shadowResolution, shadowResolution);
// Cover both the entrance foreground and the planted plaza in front of it.
sun.shadow.camera.left = -145;
sun.shadow.camera.right = 145;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 360;
// Offset enough for this broad orthographic map to avoid facade self-shadow bands.
sun.shadow.bias = -0.00055;
sun.shadow.normalBias = 0.20;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xaacbdf, 0xb4a58b, .8));
scene.add(new THREE.AmbientLight(0xffeee1, 0.12));

// Detail modules own their meshes/materials; both run after the base scene exists.
// Their update hook is optional and always receives seconds (elapsed, delta).
const sceneDetails = [
  addAnimeArchitectureDetail({ THREE, scene, materials:mat, contextBuildings, windows: [
    ...winPositions.map(p => ({ ...p, width:D.winW, height:D.winH })),
    ...gfPositions.map(p => ({ ...p, width:D.winW*1.35, height:D.winHgf })),
  ] }),
  addAnimeEnvironmentDetail({ THREE, scene }),
].filter(Boolean);

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
addEventListener('keydown', e => { if (!renderMode) keys[e.key.toLowerCase()] = true; });
addEventListener('keyup',   e => { if (!renderMode) keys[e.key.toLowerCase()] = false; });

// ── CAMERA (spring-arm third-person) ─────────────────────────────────────────
let pitch = .28, camDist = 14;
let camPos  = new THREE.Vector3(0, 14, 80);
let camTgt  = new THREE.Vector3(0,  2, 65);
let drag = false, lastMX = 0, lastMY = 0;

canvas.addEventListener('mousedown', e => { if (renderMode) return; drag=true; lastMX=e.clientX; lastMY=e.clientY; });
addEventListener('mouseup',   () => drag = false);
addEventListener('mousemove', e => {
  if (renderMode || !drag) return;
  player.yaw -= (e.clientX - lastMX) * .004;
  pitch = Math.max(.08, Math.min(1.15, pitch + (e.clientY - lastMY) * .004));
  lastMX = e.clientX; lastMY = e.clientY;
});
addEventListener('wheel', e => { if (!renderMode) camDist = Math.max(5, Math.min(22, camDist + e.deltaY*.012)); });

// Touch support
let touches = {};
canvas.addEventListener('touchstart', e => {
  if (renderMode) return;
  [...e.changedTouches].forEach(t => { touches[t.identifier] = { x:t.clientX, y:t.clientY }; });
});
canvas.addEventListener('touchmove', e => {
  if (renderMode) return;
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
  composer.render(0);
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
  if (renderMode) return;
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
    composer.render(0);
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
  renderer.setPixelRatio(renderPixelRatio());
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  updateAntialiasResolution();
  if (renderMode) renderStill();
});

// ── ANIMATION LOOP ────────────────────────────────────────────────────────────
const clock = new THREE.Clock(false);
let rafId = null, pageActive = true;
let elapsed = 0;
const compassNeedle = document.getElementById('compass-needle');

function updateAtmosphere(et, dt) {

  for (const detail of sceneDetails) detail.update?.(et, dt);
  skySphere.material.uniforms.time.value = et;

  // ── Sakura animation ──
  const petalStep = dt * 60;
  dummy.scale.setScalar(1);
  petals.forEach((p, i) => {
    p.x += (p.vx + Math.sin(et*.4 + p.phase) * .018) * petalStep;
    p.y += p.vy * petalStep;
    p.z += (p.vz + Math.cos(et*.3 + p.phase) * .012) * petalStep;
    p.rx += p.vrx * petalStep; p.ry += p.vry * petalStep; p.rz += p.vrz * petalStep;
    if (p.y < -.5) {
      p.y = 22 + random()*12;
      p.x = (random()-.5)*220;
      p.z = random()*90 + 5;
    }
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx, p.ry, p.rz);
    dummy.updateMatrix();
    if (p.dark) sakuraDInst.setMatrixAt(i, dummy.matrix);
    else        sakuraInst.setMatrixAt(i - DARK_PETAL_COUNT, dummy.matrix);
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

}

function loop() {
  rafId = null;
  if (renderMode || document.hidden || !pageActive) return;
  const dt = Math.min(clock.getDelta(), .05);
  elapsed += dt;
  updateAtmosphere(elapsed, dt);

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
  composer.render(dt);
  rafId = requestAnimationFrame(loop);
}

// One establishing view and two closer studies of the square and its planting.
function renderStill() {
  const presets = {
    facade: { eye:[0, 21, 128], target:[0, 12, 4], fov:48 },
    plaza: { eye:[53, 11, 89], target:[6, 12, 12], fov:49 },
    garden: { eye:[-62, 3.8, 69], target:[-24, 9, 14], fov:52 },
  };
  const preset = presets[renderMode];
  camera.fov = preset.fov;
  camera.updateProjectionMatrix();
  const target = new THREE.Vector3(...preset.target);
  const offset = new THREE.Vector3(...preset.eye).sub(target);
  // Narrower windows dolly back instead of clipping the end pavilions.
  offset.multiplyScalar(Math.max(1, 1.78 / camera.aspect));
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
  updateAtmosphere(STILL_TIME, 0);
  skySphere.position.copy(camera.position);
  composer.render(0);
}
function clearInput() {
  for (const key of Object.keys(keys)) delete keys[key];
  drag = false;
  touches = {};
}
function stopLoop() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  clock.stop();
  clearInput();
}
function startLoop() {
  if (renderMode || document.hidden || !pageActive || rafId !== null) return;
  clock.start();
  rafId = requestAnimationFrame(loop);
}
addEventListener('blur', clearInput);
addEventListener('pagehide', () => { pageActive = false; stopLoop(); });
addEventListener('pageshow', () => { pageActive = true; startLoop(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop();
  else startLoop();
});
if (renderMode) {
  markers.forEach(marker => { marker.visible = false; });
  renderStill();
} else startLoop();
