import { MID_FLOOR, UPPER_FLOOR, SIGHTS } from './interior_navigation.mjs';
import { STAIR_STEPS } from './interior_rules.mjs';

// A new toon scene: no legacy renderer, realistic materials or photo resources.
export function buildInterior(engine) {
  const { THREE, scene, toon, outline } = engine;
  const root = new THREE.Group();
  root.name = 'Chapter 3 · Lichthof';
  scene.add(root);
  const cameraObstacles = [], owned = new Set();
  const palette = {
    plaster: toon(0xe4cbb2), cream: toon(0xf5e6cd), stone: toon(0xc5cec8),
    stair: toon(0xaabebd), dark: toon(0x293c48), gold: toon(0xad8150),
    blue: toon(0x789da7), wood: toon(0x875842), rose: toon(0xf6f2e8), leaf: toon(0x627f66),
    light: toon(0xffe9b0, 4, { emissive: 0xffc576, emissiveIntensity: 1.5 }),
    glass: toon(0xa9cfda, 4, { transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }),
  };
  function mesh(geometry, material, x, y, z, ink = false, cameraSolid = false) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (ink) outline(m, .024);
    root.add(m); owned.add(geometry);
    if (cameraSolid) cameraObstacles.push(m);
    return m;
  }
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  function box(x, y, z, w, h, d, mat = palette.stone, ink = false, solid = false) {
    const m = mesh(boxGeometry, mat, x, y, z, false, solid);
    m.scale.set(w, h, d);
    // Inverted hull thickness must be in local coordinates. Use unscaled geometry for focal pieces.
    if (ink) { root.remove(m); const q = mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, true, solid); return q; }
    return m;
  }
  function batch(geometry, material, transforms, castShadow = true) {
    const m = new THREE.InstancedMesh(geometry, material, transforms.length);
    const dummy = new THREE.Object3D();
    transforms.forEach((t, i) => {
      dummy.position.set(...t.p); dummy.scale.set(...(t.s ?? [1, 1, 1]));
      dummy.rotation.set(...(t.r ?? [0, 0, 0])); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.castShadow = castShadow; m.receiveShadow = true; root.add(m); owned.add(geometry);
    return m;
  }
  function rod(a, b, radius, material = palette.cream) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const m = mesh(new THREE.CylinderGeometry(radius, radius, va.distanceTo(vb), 8), material, ...va.clone().add(vb).multiplyScalar(.5).toArray());
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
    return m;
  }
  const balusters = [], goldBars = [];
  function railing(a, b) {
    rod([a[0], a[1] + 1.12, a[2]], [b[0], b[1] + 1.12, b[2]], .085, palette.dark);
    rod([a[0], a[1] + .15, a[2]], [b[0], b[1] + .15, b[2]], .07, palette.cream);
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .52);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      balusters.push({ p: [x, y + .61, z], s: [.09, .93, .09] });
      goldBars.push({ p: [x, y + .65, z], s: [.14, .12, .14] });
    }
  }
  function arch(x, y, z, radius, rotation = 0, thickness = .21) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius + thickness, 0, Math.PI, false);
    shape.absarc(0, 0, radius, Math.PI, 0, true); shape.closePath();
    const m = mesh(new THREE.ExtrudeGeometry(shape, { depth: .34, bevelEnabled: false, curveSegments: 18 }), palette.cream, x, y, z);
    m.rotation.y = rotation;
    return m;
  }
  // Terrazzo / marble: low-contrast procedural veins, never an external photo.
  const marbleCanvas = document.createElement('canvas'); marbleCanvas.width = marbleCanvas.height = 128;
  const ctx = marbleCanvas.getContext('2d'); ctx.fillStyle = '#fffaf1'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.strokeStyle = i % 2 ? '#d2dedb' : '#e5e4d7'; ctx.lineWidth = .65;
    for (let y = -10; y < 140; y += 3) { const x = i * 23 - 20 + y * .3 + Math.sin(y * .065 + i) * 9; y < -7 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const marble = new THREE.CanvasTexture(marbleCanvas); marble.colorSpace = THREE.SRGBColorSpace;
  const floorMat = toon(0xffffff, 4, { map: marble });
  const tiles = [];
  for (let x = -11.5; x < 12; x++) for (let z = -17.5; z < 18; z++) tiles.push({ p: [x, -.04, z], s: [.985, .07, .985] });
  const tiledFloor = batch(boxGeometry, floorMat, tiles, false);
  tiles.forEach((t, i) => {
    const [x, , z] = t.p;
    tiledFloor.setColorAt(i, new THREE.Color((Math.floor(x + .5) + Math.floor(z + .5)) % 2 === 0 ? 0xe7e6da : 0x90a6a5));
  });
  box(0, -.22, 0, 24, .35, 36, palette.stone, false, true);
  for (const x of [-7.5, 7.5]) box(x, .005, 0, .16, .035, 35, palette.gold);
  for (const z of [-16.5, 16.5]) box(0, .005, z, 22.5, .035, .14, palette.gold);
  for (const z of [10, 13, 16]) {
    const diamond = box(0, .007, z, .8, .035, .8, palette.cream); diamond.rotation.y = Math.PI / 4;
  }
  // Enclosing warm walls. Broad horizontal cornices reinforce the two arcade tiers.
  for (const x of [-12, 12]) box(x, 8, 0, .45, 16, 36, palette.plaster, false, true);
  for (const z of [-18, 18]) box(0, 8, z, 24, 16, .45, palette.plaster, false, true);
  for (const side of [-1, 1]) for (const y of [.3, 5.7, 6, 11.25, 11.6, 15.65]) box(side * 11.72, y, 0, .55, .18, 36, palette.cream);
  for (const z of [-17.73, 17.73]) for (const y of [.3, 5.7, 11.4, 15.65]) box(0, y, z, 24, .2, .55, palette.cream);

  // The rise/run is identical to interior_rules.mjs: 16 broad + 24 split steps.
  for (let i = 1; i <= 16; i++) {
    const h = i * MID_FLOOR / 16, z = 8 - (i - .5) * 7 / 16;
    box(0, h / 2, z, 14, h, 7 / 16, palette.stair, false, true);
    box(0, h + .012, z + 7 / 32 - .035, 14, .025, .055, palette.cream);
  }
  box(0, MID_FLOOR / 2, -1, 14, MID_FLOOR, 4, palette.stair, false, true);
  for (const side of [-1, 1]) {
    for (let i = 1; i <= STAIR_STEPS; i++) {
      const h = MID_FLOOR + i * (UPPER_FLOOR - MID_FLOOR) / STAIR_STEPS, z = -3 - (i - .5) * 8 / STAIR_STEPS;
      box(side * 5.5, h / 2, z, 3, h, 8 / STAIR_STEPS, palette.stair, false, true);
      box(side * 5.5, h + .012, z + .135, 3, .025, .04, palette.cream);
    }
    railing([side * 7.13, 0, 8], [side * 7.13, MID_FLOOR, 1]);
    railing([side * 7.13, MID_FLOOR, 1], [side * 7.13, MID_FLOOR, -3]);
    for (const x of [side * 3.87, side * 7.13]) railing([x, MID_FLOOR, -3], [x, UPPER_FLOOR, -11]);
    box(side * 10.25, 5.82, 0, 3.5, .36, 36, palette.cream, false, true);
    railing([side * 8.45, 6, -11], [side * 8.45, 6, 17.5]);
    railing([side * 7.13, 6, -11], [side * 8.45, 6, -11]);
    // A second, ornamental upper gallery at 11.6 m; no access stairs in this chapter.
    box(side * 10.25, 11.4, 0, 3.5, .32, 36, palette.cream, false, true);
    railing([side * 8.45, 11.6, -17.5], [side * 8.45, 11.6, 17.5]);
  }
  box(0, 5.82, -14.5, 24, .36, 7, palette.cream, false, true);
  box(0, 11.4, -16.5, 24, .32, 3, palette.cream, false, true);
  railing([-3.87, 2.4, -3], [3.87, 2.4, -3]);
  railing([-3.87, 6, -11], [3.87, 6, -11]);
  railing([-8.4, 11.6, -15], [8.4, 11.6, -15]);

  // Column families: grounded columns, fluted upper shafts, stylized Ionic capitals.
  const shaft = new THREE.CylinderGeometry(.31, .39, 4.8, 12);
  const capitals = [], bases = [], shafts = [], volutes = [];
  for (const side of [-1, 1]) for (const z of [-14, -8, -2, 4, 10, 16]) for (const base of [0, 6, 11.6]) {
    // Each arch crown fits below the next gallery slab (or the glass eaves).
    const h = base === 11.6 ? 1.45 : base === 6 ? 2.4 : 2.8;
    shafts.push({ p: [side * 8, base + h / 2 + .15, z], s: [1, h / 4.8, 1] });
    bases.push({ p: [side * 8, base + .13, z], s: [1.02, .24, 1.02] });
    capitals.push({ p: [side * 8, base + h + .2, z], s: [1.14, .28, 1.14] });
    for (const dx of [-.39, .39]) volutes.push({ p: [side * 8 + dx, base + h + .02, z], s: [1, 1, 1] });
  }
  batch(shaft, palette.cream, shafts);
  batch(boxGeometry, palette.stone, bases);
  batch(boxGeometry, palette.cream, capitals);
  batch(new THREE.SphereGeometry(.17, 8, 6), palette.cream, volutes);
  // Camera rays see simplified solid columns, while navigation uses matching AABBs.
  for (const side of [-1, 1]) for (const z of [-14, -8, -2, 4, 10, 16]) {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(1.04, 16, 1.04), palette.stone);
    proxy.position.set(side * 8, 8, z); proxy.updateMatrixWorld(); cameraObstacles.push(proxy); owned.add(proxy.geometry);
    if (z < 16) for (const y of [3, 8.6, 13.25]) arch(side * 8, y, z + 3, 2.62, Math.PI / 2, .25);
  }
  batch(boxGeometry, palette.cream, balusters);
  batch(boxGeometry, palette.gold, goldBars);
  // The pure legacy rules reserve this landing plinth. Give that collider a
  // visible counterpart instead of leaving an unexplained invisible obstacle.
  box(-5.4, 2.94, -.8, 1.9, 1.08, 1.65, palette.blue, true);
  box(-5.4, 3.52, -.8, 2.05, .12, 1.8, palette.cream);
  const bust = mesh(new THREE.SphereGeometry(1, 12, 9), palette.cream, -5.4, 4.08, -.8, true);
  bust.scale.set(.48, .58, .35);
  mesh(new THREE.SphereGeometry(.26, 12, 9), palette.cream, -5.4, 4.82, -.8, true);
  // Rear arcades, deep blue closed corridors and softly lit doorways.
  for (const x of [-6, 0, 6]) {
    for (const y of [6, 11.6]) {
      box(x, y + 1.55, -17.5, 3.6, 3.1, .16, palette.blue);
      arch(x, y + 2.8, -17.3, 1.8, 0, .28);
      for (const dx of [-2, 2]) box(x + dx, y + 1.5, -17.25, .36, 3, .5, palette.cream);
    }
  }
  for (const side of [-1, 1]) for (const z of [-12, 0, 12]) {
    box(side * 11.72, 1.8, z, .12, 3.6, 2.5, palette.dark);
    arch(side * 11.6, 3.5, z, 1.25, Math.PI / 2);
    box(side * 11.55, 1.9, z, .035, 3.2, .055, palette.light);
    box(side * 11.6, .06, z, .5, .06, 2.6, palette.gold);
  }
  // Main entrance, inside face. Open scene loading never requests reference images.
  box(0, 2.15, 17.74, 4, 4.3, .12, palette.dark);
  arch(0, 3.9, 17.52, 2, 0, .34);
  box(0, 2.1, 17.58, .08, 4.2, .08, palette.gold);

  // Glass roof: warm sky above a fine green iron lattice, gabled clear panels.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x9abed7) }, bottom: { value: new THREE.Color(0xffe7be) } },
    vertexShader: 'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 v;void main(){gl_FragColor=vec4(mix(bottom,top,smoothstep(-.12,.8,normalize(v).y)),1.);}',
  })); scene.add(sky); owned.add(sky.geometry);
  for (const side of [-1, 1]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 18.8, -18, side * 12, 16, -18, 0, 18.8, 18, side * 12, 16, -18, side * 12, 16, 18, 0, 18.8, 18], 3));
    geo.computeVertexNormals();
    const pane = mesh(geo, palette.glass, 0, 0, 0);
    pane.castShadow = false; // Light passes through glass; the iron lattice casts the pattern.
    for (let z = -18; z <= 18; z += 3) rod([0, 18.8, z], [side * 12, 16, z], .065, palette.dark);
    for (let x = 0; x <= 12; x += 3) rod([side * x, 18.8 - x * 2.8 / 12, -18], [side * x, 18.8 - x * 2.8 / 12, 18], .055, palette.dark);
  }
  rod([0, 18.8, -18], [0, 18.8, 18], .13, palette.cream);

  // Historic-style lanterns with restrained emissive bloom.
  function lantern(x, y, z) {
    rod([x, y - 1, z], [x, y, z], .05, palette.dark);
    box(x, y + .3, z, .38, .62, .38, palette.light);
    for (const dx of [-.23, .23]) for (const dz of [-.23, .23]) box(x + dx, y + .3, z + dz, .045, .72, .045, palette.dark);
    mesh(new THREE.ConeGeometry(.4, .3, 4), palette.dark, x, y + .79, z);
    box(x, y - .06, z, .57, .1, .57, palette.dark);
  }
  for (const side of [-1, 1]) {
    lantern(side * 7.13, 1.4, 8); lantern(side * 3.87, 3.8, -3); lantern(side * 3.87, 7.4, -11);
    const glow = new THREE.PointLight(0xffcc8c, 12, 8, 2); glow.position.set(side * 9, 3.2, 5); root.add(glow);
  }
  // Inlaid memorial leaflets and white roses: quiet, unanimated, no collectible.
  box(-10.6, .16, 8, .95, .3, 3.2, palette.dark, true);
  const paper = toon(0xf4e5c9), print = toon(0x71817e);
  for (let i = 0; i < 9; i++) {
    const page = new THREE.Group(); page.position.set(-10.6 + (i % 3 - 1) * .26, .322 + i * .001, 7 + Math.floor(i / 3) * .6); page.rotation.y = (i % 3 - 1) * .22;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(.32, .009, .44), paper); page.add(slab);
    for (let j = 0; j < 5; j++) { const line = new THREE.Mesh(new THREE.BoxGeometry(.22, .002, .008), print); line.position.set(0, .006, -.12 + j * .035); page.add(line); }
    root.add(page);
  }
  const roses = [], leaves = [];
  for (let i = 0; i < 7; i++) {
    const x = -10.62 + Math.sin(i * 2.4) * .26, z = 7.15 + i * .29;
    rod([x, .34, z], [x + .12, .37, z + .55], .016, palette.leaf);
    leaves.push({ p: [x + .08, .38, z + .3], s: [.15, .025, .065], r: [0, i, 0] });
    for (let j = 0; j < 5; j++) roses.push({ p: [x + Math.sin(j * 1.26) * .055, .38 + j * .006, z + Math.cos(j * 1.26) * .055], s: [.095, .05, .085], r: [0, j, 0] });
  }
  batch(new THREE.SphereGeometry(1, 7, 5), palette.rose, roses);
  batch(new THREE.SphereGeometry(1, 6, 4), palette.leaf, leaves);
  // A readable plaque is a local canvas texture, not a remote image.
  function plaque(text, sub, x, y, z, rotation) {
    const c = document.createElement('canvas'); c.width = 768; c.height = 256;
    const cx = c.getContext('2d'); cx.fillStyle = '#263d45'; cx.fillRect(0, 0, c.width, c.height);
    cx.strokeStyle = '#caaa74'; cx.lineWidth = 5; cx.strokeRect(12, 12, 744, 232);
    cx.textAlign = 'center'; cx.fillStyle = '#f2e4bd'; cx.font = '42px serif'; cx.fillText(text, 384, 113);
    cx.font = '22px sans-serif'; cx.fillText(sub, 384, 166);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const m = mesh(new THREE.PlaneGeometry(2.7, .9), new THREE.MeshBasicMaterial({ map: texture }), x, y, z);
    m.rotation.y = rotation; return m;
  }
  plaque('WEISSE ROSE', 'IN ERINNERUNG · IN MEMORIAM', -11.73, 1.7, 8, Math.PI / 2);
  plaque('LICHTHOF', 'LUDWIG-MAXIMILIANS-UNIVERSITÄT', 0, 8.7, -17.72, 0);
  // The bench is tucked along the east wall, away from the navigation approach.
  for (let i = 0; i < 5; i++) box(10.76 + (i - 2) * .13, .58, 12, .105, .12, 3, palette.wood);
  for (const z of [10.8, 13.2]) {
    box(10.82, .3, z, .65, .6, .09, palette.dark);
    box(11.05, .94, z, .09, 1.1, .09, palette.dark);
  }
  for (const y of [.94, 1.14]) box(11.03, y, 12, .1, .15, 3, palette.wood);
  // Diegetic bronze labels and a small floating marker per sightseeing point.
  const markers = SIGHTS.map((s, i) => {
    const m = mesh(new THREE.OctahedronGeometry(.11), toon([0xe7bd68, 0xe7bd68, 0xdfe4d6, 0x9dc6ca, 0xe8a6af][i], 4, { emissive: 0xe8b65b, emissiveIntensity: .16 }), s.x, s.y + .52, s.z);
    return m;
  });
  const sun = new THREE.DirectionalLight(0xffe1ac, 2.3); sun.position.set(-8, 23, 8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 22, bottom: -22, near: .5, far: 60 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.00015; scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xc8e4f1, 0xbca180, 1.65));
  scene.add(new THREE.AmbientLight(0xffefd4, .25));
  // Floating dust is one draw call. Deterministic seeds avoid a chaotic glitter effect.
  const dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(.023, .023), new THREE.MeshBasicMaterial({ color: 0xffedbd, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }), 120);
  root.add(dust); const dummy = new THREE.Object3D();
  scene.updateMatrixWorld(true);
  return {
    root, cameraObstacles, markers,
    update(dt, et) {
      sky.position.copy(engine.camera.position);
      for (let i = 0; i < 120; i++) {
        dummy.position.set(Math.sin(i * 17.13) * 6 + Math.sin(et * .11 + i) * .12, .6 + ((i * .791 + et * .09) % 15), Math.cos(i * 13.75) * 14);
        dummy.quaternion.copy(engine.camera.quaternion); dummy.scale.setScalar(.7 + (i % 3) * .3); dummy.updateMatrix(); dust.setMatrixAt(i, dummy.matrix);
      }
      dust.instanceMatrix.needsUpdate = true;
      markers.forEach((m, i) => { m.rotation.y = et * .5; m.position.y = SIGHTS[i].y + .5 + Math.sin(et * 1.5 + i) * .06; });
    },
  };
}
