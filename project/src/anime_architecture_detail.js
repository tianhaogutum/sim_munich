/**
 * Decorative layer for anime_main.js (Three.js r160).
 * Call once after the base architecture is built. No input, collision or DOM changes.
 * Coordinates intentionally match the existing scene: entrance +Z, fountains (±35, .925, 48).
 */
export function addAnimeArchitectureDetail({ THREE, scene, windows = [], contextBuildings = [], materials = {} }) {
  const root = new THREE.Group();
  root.name = 'anime-architecture-detail';
  scene.add(root);

  const gradient = new THREE.DataTexture(
    new Uint8Array([100, 100, 100, 255, 175, 175, 175, 255, 225, 225, 225, 255, 255, 255, 255, 255]),
    4, 1, THREE.RGBAFormat,
  );
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const toon = color => new THREE.MeshToonMaterial({ color, gradientMap: gradient });
  const stone = toon(0xeee0bd);
  const shadowStone = toon(0xc4b591);
  const inlay = toon(0xd4c6a7);
  const bronze = toon(0x816b48);
  const fountainStone = toon(0xa2a2ba);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();

  // World-space courses retain the parent's palette and actual scene lighting.
  // Broad per-block variation gives stone/slate scale without noisy image maps;
  // derivatives fade the mortar before it can shimmer at a distance.
  function surfacePattern(material, kind) {
    if (!material) return;
    const previousCompile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      previousCompile.call(this, shader, renderer);
      shader.vertexShader = 'varying vec3 architectureWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        #include <project_vertex>
        vec4 architecturePoint = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          architecturePoint = instanceMatrix * architecturePoint;
        #endif
        architectureWorld = (modelMatrix * architecturePoint).xyz;
      `);
      shader.fragmentShader = `varying vec3 architectureWorld;
        float architectureHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
      ` + shader.fragmentShader;
      const coordinates = kind === 'stone'
        ? 'vec2(architectureWorld.x + architectureWorld.z * .73, architectureWorld.y) / vec2(3.6, 1.1)'
        : kind === 'paving'
          ? 'architectureWorld.xz / vec2(6.0, 4.0)'
          : 'architectureWorld.xz / vec2(.9, .65)';
      const contrast = kind === 'paving' ? '.075' : kind === 'slate' ? '.10' : '.042';
      const mortar = kind === 'slate' ? '.085' : '.045';
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec2 architectureCell = ${coordinates};
        architectureCell.x += mod(floor(architectureCell.y), 2.0) * .5;
        vec2 architecturePixel = max(fwidth(architectureCell), vec2(.00001));
        vec2 architectureDistance = abs(fract(architectureCell - .5) - .5);
        vec2 architectureLine = (1.0 - smoothstep(vec2(0.0), architecturePixel,
          architectureDistance)) * min(vec2(.012) / architecturePixel, vec2(1.0));
        float architectureVariation = architectureHash(floor(architectureCell)) - .5;
        diffuseColor.rgb *= 1.0 + architectureVariation * ${contrast}
          - max(architectureLine.x, architectureLine.y) * ${mortar};
      `);
    };
    material.customProgramCacheKey = () => `lmu-architecture-${kind}-v3`;
    material.extensions = { ...material.extensions, derivatives:true };
    material.needsUpdate = true;
  }
  for (const name of ['facade', 'facade2', 'column', 'parapet', 'adjacent', 'steps']) {
    surfacePattern(materials[name], 'stone');
  }
  surfacePattern(materials.plaza, 'paving');
  surfacePattern(materials.roof, 'slate');

  // Each list is one draw call, regardless of the number of repeated accents.
  function instances(name, geometry, material, placements, receiveShadow = true) {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    mesh.name = name;
    placements.forEach(({ p, s = [1, 1, 1], r = [0, 0, 0] }, index) => {
      dummy.position.set(...p);
      dummy.rotation.set(...r);
      dummy.scale.set(...s);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = false;
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  }
  const pale = [], shaded = [], metal = [], borders = [];
  const block = (list, x, y, z, w, h, d) => list.push({ p: [x, y, z], s: [w, h, d] });

  // Screen-space antialiasing keeps distant joints from becoming dotted geometry
  // or self-shadowing at grazing angles. The plaza beneath supplies its lighting.
  const paving = new THREE.Mesh(new THREE.PlaneGeometry(156,68),
    new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, extensions:{ derivatives:true },
      vertexShader:`varying vec2 pavingPosition;
        void main() {
          vec4 world = modelMatrix * vec4(position,1.0);
          pavingPosition = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader:`varying vec2 pavingPosition;
        void main() {
          float row = floor(pavingPosition.y/4.0);
          vec2 cell = vec2((pavingPosition.x+mod(row,2.0)*3.0)/6.0,pavingPosition.y/4.0);
          vec2 pixel = max(fwidth(cell),vec2(0.00001));
          vec2 distanceToJoint = abs(fract(cell-0.5)-0.5)/pixel;
          vec2 width = min(vec2(0.045/6.0,0.045/4.0)/pixel,vec2(1.0));
          vec2 line = (1.0-smoothstep(vec2(0.0),vec2(0.8),distanceToJoint))*width;
          gl_FragColor = vec4(0.31,0.29,0.23,max(line.x,line.y)*0.30);
        }`,
    }));
  paving.rotation.x = -Math.PI/2;
  paving.position.set(0,.047,44);
  paving.name = 'plaza-antialiased-slab-joints';
  root.add(paving);

  for (const area of [
    { left: -78, right: 78, near: 10, far: 78, y: .047 },
  ]) {
    for (const x of [-14.5, 14.5]) {
      block(borders, x, area.y + .012, (area.near + area.far) / 2,
        .32, .018, area.far - area.near);
    }
  }

  // Consume actual facade positions, including the projecting end pavilions.
  // Backing frame z, opaque glass z+.08, mullions z+.13, jambs z+.19.
  for (const { x, zSill:sill, facadeZ:z, width, height } of windows) {
    block(pale, x, sill-.10, z+.15, width+.42, .18, .42);
    block(shaded, x, sill-.23, z+.045, width+.12, .09, .18);
    for (const sign of [-1, 1]) {
      block(pale, x+sign*(width*.5-.035), sill+height*.34, z+.19,
        .13, height*.68, .26);
    }
    // Eight shallow voussoirs continue the jambs around each arched opening.
    const radius = width*.5;
    for (let segment = 0; segment < 8; segment++) {
      const angle = (segment+.5)*Math.PI/8;
      pale.push({ p:[x+Math.cos(angle)*radius, sill+height-radius+Math.sin(angle)*radius, z+.19],
        s:[.13, radius*Math.PI/8+.025, .26], r:[0,0,angle] });
    }
    block(metal, x, sill+height*.45, z+.13, width*.81, .055, .045);
    block(metal, x, sill+height*.44, z+.13, .055, height*.75, .045);
    // One soft sky glint within each opaque pane, kept behind the mullions.
    block(borders, x-width*.24, sill+height*.47, z+.10, .055, height*.45, .012);
  }

  // Quiet corner quoins and a thin cornice shadow give the flat masses depth.
  for (const [x, z] of [[-79.5, 1.2], [-68.5, 1.2], [68.5, 1.2], [79.5, 1.2], [-17.5, 2.8], [17.5, 2.8]]) {
    for (let y = 1.1; y < 22; y += 1.65) {
      block(pale, x, y, z + .1, .72, .62, .2);
    }
  }
  for (const sign of [-1, 1]) {
    block(shaded, sign * 43, 22.75, .14, 50, .16, .28);
    block(pale, sign * 74, 22.75, 1.34, 12, .16, .28);
    // A visible cornice shadow and slender ledge tie the long window rows together.
    for (const y of [11.35,17.35]) {
      block(shaded,sign*43,y,.08,50,.10,.12);
      block(pale,sign*43,y+.10,.18,50,.12,.35);
    }
  }
  // Entablature dentils, deliberately sparse enough to read at gameplay distance.
  for (let x = -13; x <= 13; x += 1.3) {
    block(pale, x, 9.96, 3.94, .38, .26, .22);
  }
  block(metal, 0, 11.22, 3.88, 28.4, .07, .08);
  // Sloped stone raking cornices follow the triangular tympanum.
  for (const sign of [-1, 1]) {
    pale.push({ p:[sign*9.5, 30.76, 3.43], s:[Math.hypot(19,6)+.3,.35,.46],
      r:[0,0,-sign*Math.atan2(6,19)] });
  }
  block(pale, 0, 27.82, 3.43, 38.6, .32, .46);
  // A modest round relief stays inside the triangle rather than floating above it.
  instances('pediment-round-relief', new THREE.CylinderGeometry(1,1,.12,32), stone,
    [{ p:[0,29.7,3.42], r:[Math.PI/2,0,0] }]);
  // Portal joinery and stone surround face the same direction as the windows.
  for (const x of [-3.65,3.65]) block(pale,x,4.9,3.12,.28,6.6,.38);
  block(metal,0,5.1,3.04,.09,6.9,.08);
  for (const x of [-2.35,-1.15,1.15,2.35]) {
    block(shaded,x,3.6,3.03,.07,3.0,.055);
  }
  for (const x of [-.3,.3]) block(metal,x,3.4,3.12,.09,.55,.1);

  const doorPanels = [], doorRaised = [];
  for (const sign of [-1,1]) {
    for (const y of [2.65,4.45,6.25]) {
      block(doorPanels,sign*1.65,y,3.065,2.85,1.46,.08);
      block(doorRaised,sign*1.65,y,3.12,2.42,1.10,.055);
    }
  }
  // Radial fanlight bars sit inside the portal's existing semicircular head.
  for (let i = 1; i < 6; i++) {
    const angle = i*Math.PI/6;
    metal.push({ p:[Math.cos(angle)*1.58,8.1+Math.sin(angle)*1.58,3.12],
      s:[3.16,.06,.07], r:[0,0,angle] });
  }
  block(metal,0,8.1,3.12,6.5,.07,.07);
  instances('portal-recessed-panels',cube,toon(0x544439),doorPanels);
  instances('portal-raised-panels',cube,toon(0x6c5948),doorRaised);

  const columnRings = [];
  for (let column=0; column<8; column++) {
    const x=-13.32+column*(26.64/7);
    for (const y of [.62,8.98]) {
      columnRings.push({ p:[x,y,3.35], r:[Math.PI/2,0,0] });
    }
  }
  instances('column-neck-and-base-rings',new THREE.TorusGeometry(.49,.075,6,20),stone,columnRings);

  // Quiet streetscape behind the square: repeated windows and slate rooflines
  // give the neighboring masses scale without competing with the main entrance.
  const neighborPanes = [];
  const roofMaterial = toon(0x6b6c67);
  surfacePattern(roofMaterial, 'slate');
  const roofRidges = [];
  for (const { x, z, width, height, depth } of contextBuildings) {
    const front = z + depth/2;
    const bays = Math.floor((width-5)/4.6);
    for (let bay = 0; bay < bays; bay++) {
      const wx = x + (bay-(bays-1)/2)*4.6;
      for (let sill = 2; sill+2.7 < height-1; sill += 5.2) {
        block(shaded,wx,sill+1.4,front+.19,1.8,2.8,.12);
        block(neighborPanes,wx,sill+1.4,front+.27,1.45,2.5,.04);
        block(pale,wx,sill-.10,front+.31,2.15,.18,.38);
        block(metal,wx,sill+1.4,front+.32,.065,2.5,.06);
      }
    }
    for (const y of [.8, 5.4, height-.1]) {
      block(pale,x,y,front+.28,width+.35,.28,.58);
    }
    // Extrude a roof cross-section along X; eaves stop at the body footprint.
    const section = new THREE.Shape();
    section.moveTo(-depth/2-.6,0);
    section.lineTo(depth/2+.6,0);
    section.lineTo(0,3.4);
    section.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(section,
      { depth:width+.6, bevelEnabled:false }), roofMaterial);
    roof.rotation.y = Math.PI/2;
    roof.position.set(x-width/2-.3,height,z);
    roof.castShadow = roof.receiveShadow = true;
    root.add(roof);
    block(roofRidges,x,height+3.43,z,width+.7,.14,.30);
  }
  if (neighborPanes.length) {
    instances('neighbor-window-panes',cube,toon(0x657c80),neighborPanes);
  }
  if (roofRidges.length) instances('slate-ridge-caps',cube,roofMaterial,roofRidges);

  instances('plaza-axis-inlays', cube, inlay, borders);
  instances('limestone-ledges-and-quoins', cube, stone, pale);
  instances('facade-recess-shadows', cube, shadowStone, shaded);
  instances('window-mullions-and-bronze-accents', cube, bronze, metal);

  // Annular geometry leaves the existing water surface exposed. Torus geometry
  // starts in XY; rotate into XZ. No replacement water disks or new lights.
  const rims = [], aprons = [], ripples = [];
  for (const x of [-35, 35]) {
    rims.push({ p: [x, .94, 48], r: [Math.PI / 2, 0, 0] });
    aprons.push({ p: [x, .07, 48], r: [-Math.PI / 2, 0, 0] });
    for (const radius of [1.15, 2.45, 3.75]) {
      ripples.push({ p: [x, .94, 48], s: [radius, radius, 1], r: [-Math.PI / 2, 0, 0] });
    }
  }
  instances('fountain-rounded-coping', new THREE.TorusGeometry(4.82, .18, 6, 48), fountainStone, rims);
  instances('fountain-stone-aprons', new THREE.RingGeometry(5.08, 6.15, 48), inlay, aprons);
  const shimmer = new THREE.MeshBasicMaterial({
    color: 0xc4eff5, transparent: true, opacity: .28, depthWrite: false,
    side: THREE.DoubleSide,
  });
  instances('fountain-fine-ripples', new THREE.RingGeometry(.987, 1, 48), shimmer, ripples, false);

  // Animation only touches a shared material uniform.
  // Absolute seconds make this frame-rate independent; dt is accepted by API.
  return {
    update(time, dt) {
      shimmer.opacity = .25 + Math.sin(time * 1.35) * .07;
    },
  };
}
