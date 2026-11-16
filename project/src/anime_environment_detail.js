/**
 * Small, deterministic spring gardens for the standalone anime scene (Three r160).
 * Call once after scene creation; call update(elapsedSeconds, deltaSeconds) per frame.
 * No DOM, lights, collision, fog, or shared-material changes. Seven garden batches
 * plus six bounded tree/contact/water batches; static instance matrices stay on the GPU.
 */
export function addAnimeEnvironmentDetail({ THREE, scene }) {
  const garden = new THREE.Group();
  garden.name = 'anime-environment-detail';
  scene.add(garden);

  // X/Z ground plane, Y up. Keep the central approach and all four sights open.
  // Positive-Z islands frame the approach, separated from the eight tree roots.
  const beds = [
    [-48, 30, 4.8, 2.5], [48, 30, 4.8, 2.5],
    [-58, 54, 5.8, 2.8], [58, 54, 5.8, 2.8],
    [-68, 76, 4.2, 2.4], [68, 76, 4.2, 2.4],
    [-74, 12, 5.0, 2.6], [74, 12, 5.0, 2.6],
  ];
  let seed = 0x4c4d55;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const timeUniform = { value: 0 };
  const gradient = new THREE.DataTexture(
    new Uint8Array([95, 95, 95, 255, 174, 174, 174, 255, 255, 255, 255, 255]),
    3, 1, THREE.RGBAFormat,
  );
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;

  function material(color, breeze = false) {
    const mat = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    if (breeze) {
      mat.side = THREE.DoubleSide;
      mat.onBeforeCompile = shader => {
        shader.uniforms.gardenTime = timeUniform;
        shader.vertexShader = 'uniform float gardenTime;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          vec3 gardenAnchor = instanceMatrix[3].xyz;
          float gardenPhase = gardenAnchor.x * .31 + gardenAnchor.z * .23;
          float gardenBend = max(position.y, 0.0);
          gardenBend *= gardenBend;
          transformed.x += sin(gardenTime * 1.35 + gardenPhase) * .085 * gardenBend;
          transformed.z += sin(gardenTime * .87 + gardenPhase) * .045 * gardenBend;
        `);
      };
      mat.customProgramCacheKey = () => 'anime-garden-breeze-v1';
    }
    return mat;
  }
  function instances(name, geometry, mat, count) {
    const mesh = new THREE.InstancedMesh(geometry, mat, count);
    mesh.name = name;
    // Tiny plants don't justify extra shadow draws; fixed bounds get a wind margin.
    mesh.receiveShadow = true;
    garden.add(mesh);
    return mesh;
  }
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  function put(mesh, index, x, y, z, sx, sy, sz, yaw = 0, color) {
    transform.position.set(x, y, z);
    transform.rotation.set(0, yaw, 0);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    if (color !== undefined) mesh.setColorAt(index, tint.setHex(color));
  }

  // One small, softly irregular leaf cluster is reused for shrubs and every
  // part of a crown. Vertex tints suggest painted foliage without tiny leaf cards.
  const leafGeo = new THREE.SphereGeometry(1, 10, 7);
  const leafPositions = leafGeo.attributes.position;
  const leafColors = new Float32Array(leafPositions.count * 3);
  for (let i = 0; i < leafPositions.count; i++) {
    const x = leafPositions.getX(i), y = leafPositions.getY(i), z = leafPositions.getZ(i);
    const relief = 1 + .105 * Math.sin(x * 8 + y * 5) * Math.sin(z * 7 - y * 3)
      + .045 * Math.cos(x * 13 + z * 8);
    leafPositions.setXYZ(i, x * relief + .035 * y * y,
      y * relief, z * relief);
    const light = .73 + (y + 1) * .12 + .025 * Math.sin(x * 9 + z * 5);
    leafColors.set([light, light, light * .94], i * 3);
  }
  leafGeo.setAttribute('color', new THREE.BufferAttribute(leafColors, 3));
  leafGeo.computeVertexNormals();
  const leafMaterial = new THREE.MeshStandardMaterial({
    color:0xffffff, vertexColors:true, roughness:.96, metalness:0,
  });

  const rim = instances('garden-stone-edging', new THREE.CylinderGeometry(1, 1, 1, 32), material(0xc8b99d), beds.length);
  const soil = instances('garden-moss-ground', new THREE.CylinderGeometry(1, 1, 1, 32), material(0x708858), beds.length);
  const shrubs = instances('garden-rounded-shrubs', leafGeo, leafMaterial, beds.length * 7);

  // Three tapered, crossed blades per tuft; geometry starts at ground level.
  const bladeVertices = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI / 3;
    const dx = Math.cos(angle) * .09, dz = Math.sin(angle) * .09;
    bladeVertices.push(-dx, 0, -dz, dx, 0, dz, dx * 1.9, .74 + blade * .1, dz * 1.9);
  }
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(bladeVertices, 3));
  grassGeo.computeVertexNormals();
  const grass = instances('garden-breeze-grass', grassGeo, material(0xffffff, true), beds.length * 100);

  const stemGeo = new THREE.CylinderGeometry(.018, .025, .8, 4);
  stemGeo.translate(0, .4, 0);
  const stems = instances('garden-flower-stems', stemGeo, material(0x53764b, true), beds.length * 32);
  // Five softly scalloped petals as a single low-poly, slightly cupped flower.
  const petalVertices = [];
  for (let petal = 0; petal < 5; petal++) {
    const angle = petal * Math.PI * 2 / 5;
    const cx = Math.cos(angle) * .125, cz = Math.sin(angle) * .125;
    for (let edge = 0; edge < 6; edge++) {
      const a = edge * Math.PI / 3, b = (edge + 1) * Math.PI / 3;
      petalVertices.push(cx, .81, cz,
        cx + Math.cos(a) * .125, .85, cz + Math.sin(a) * .125,
        cx + Math.cos(b) * .125, .85, cz + Math.sin(b) * .125);
    }
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.Float32BufferAttribute(petalVertices, 3));
  petalGeo.computeVertexNormals();
  const flowers = instances('garden-pastel-flowers', petalGeo, material(0xffffff, true), beds.length * 32);
  const centerGeo = new THREE.SphereGeometry(.065, 6, 4);
  centerGeo.translate(0, .86, 0);
  const centers = instances('garden-flower-centers', centerGeo, material(0xf2c96b, true), beds.length * 32);
  const grassColors = [0x799657, 0x8ca866, 0xa5b777, 0x627e4f];
  const flowerColors = [0xffe9cf, 0xe6b4ba, 0xd5c5ec, 0xf6d495, 0xf5eee1];
  const shrubColors = [0x6e9564, 0x86a778, 0x587e59];

  for (let bed = 0; bed < beds.length; bed++) {
    const [x, z, rx, rz] = beds[bed];
    put(rim, bed, x, .12, z, rx, .20, rz);
    put(soil, bed, x, .225, z, rx - .18, .06, rz - .18);
    for (let i = 0; i < 7; i++) {
      const angle = i / 7 * Math.PI * 2;
      const size = .55 + random() * .26;
      put(shrubs, bed * 7 + i, x + Math.cos(angle) * rx * .42, .48,
        z + Math.sin(angle) * rz * .3, size * 1.15, size * .82, size,
        random() * Math.PI, shrubColors[i % 3]);
    }
    for (let i = 0; i < 100; i++) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * .88;
      const height = .35 + random() * .65;
      put(grass, bed * 100 + i, x + Math.cos(angle) * rx * radius, .26,
        z + Math.sin(angle) * rz * radius, .8, height, .8,
        random() * Math.PI * 2, grassColors[i % 4]);
    }
    for (let i = 0; i < 32; i++) {
      // Flowers form a loose outer ribbon around the low shrub centers.
      const angle = i / 32 * Math.PI * 2 + random() * .13;
      const radius = .60 + random() * .24;
      const px = x + Math.cos(angle) * rx * radius;
      const pz = z + Math.sin(angle) * rz * radius;
      const size = .65 + random() * .5, yaw = random() * Math.PI * 2;
      const index = bed * 32 + i;
      put(stems, index, px, .26, pz, size, size, size, yaw);
      put(flowers, index, px, .26, pz, size, size, size, yaw, flowerColors[(i + bed) % 5]);
      put(centers, index, px, .26, pz, size, size, size, yaw);
    }
  }
  // Replace only explicitly named base trees, never unrelated scene geometry.
  for (const name of ['base-tree-trunks', 'base-tree-crown-a', 'base-tree-crown-b']) {
    const original = scene.getObjectByName(name);
    if (original) original.visible = false;
  }
  const treePoints = [-1, 1].flatMap(side => [
    [side * 84, 16], [side * 84, 38], [side * 84, 62], [side * 68, 82],
  ]);
  const wood = instances('garden-tree-branches',
    new THREE.CylinderGeometry(.55, 1, 1, 8),
    new THREE.MeshStandardMaterial({ color:0x796b55, roughness:1 }), 8 * 9);
  wood.castShadow = true;
  // A bough moves rigidly: its normal stays valid under non-uniform instance scale.
  // The maximum local offset is .035, below .17 world units for these boughs.
  function boughWind(mat) {
    mat.onBeforeCompile = shader => {
      shader.uniforms.gardenTime = timeUniform;
      shader.vertexShader = 'uniform float gardenTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float phase = instanceMatrix[3].x * .17 + instanceMatrix[3].z * .29;
        transformed.x += sin(gardenTime * .7 + phase) * .035;
        transformed.z += cos(gardenTime * .53 + phase) * .022;
      `);
    };
    mat.customProgramCacheKey = () => 'anime-tree-bough-breeze-v2';
    return mat;
  }
  boughWind(leafMaterial);
  const clustersPerTree = 29;
  const canopy = instances('garden-layered-tree-boughs',
    leafGeo, leafMaterial, 8 * clustersPerTree);
  canopy.castShadow = true;
  canopy.customDepthMaterial = boughWind(new THREE.MeshDepthMaterial({
    depthPacking:THREE.RGBADepthPacking,
  }));
  const leaves = [0x637f4d, 0x769357, 0x8ba365, 0xa4b978];
  const up = new THREE.Vector3(0, 1, 0);
  const start = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3();
  function branch(index, ax, ay, az, bx, by, bz, radius) {
    start.set(ax, ay, az); end.set(bx, by, bz);
    direction.subVectors(end, start);
    transform.position.copy(start).add(end).multiplyScalar(.5);
    const length = direction.length();
    transform.quaternion.setFromUnitVectors(up, direction.normalize());
    transform.scale.set(radius, length, radius);
    transform.updateMatrix();
    wood.setMatrixAt(index, transform.matrix);
  }
  treePoints.forEach(([x, z], tree) => {
    const height = 8.8 + random() * 1.7;
    const lean = (random() - .5) * .8;
    branch(tree * 9, x, .04, z, x + lean, height * .7, z + .25, .46);
    branch(tree * 9 + 1, x + lean, height * .62, z + .25,
      x + lean * 1.5, height + 1, z - .3, .25);
    for (let b = 0; b < 7; b++) {
      const a = b * 2.39996 + tree * .8;
      const reach = 2.4 + random() * 1.5;
      const bx = x + Math.cos(a) * reach, bz = z + Math.sin(a) * reach;
      const by = height * .66 + (b % 3) * .8;
      branch(tree * 9 + b + 2, x + lean * .7, 3.2 + b * .42, z,
        bx, by, bz, .16 + (b % 2) * .05);
      put(canopy, tree * clustersPerTree + b, bx, by + .55, bz,
        1.8 + random() * .55, 1.8 + random() * .65, 1.65 + random() * .7,
        a, leaves[b % 2]);
      // A few generous edge tufts break the repeated ellipsoid outline. They
      // share the same mesh batch and remain larger than a pixel at medium range.
      for (let tip = 0; tip < 2; tip++) {
        const edgeAngle = a + (tip ? .42 : -.42);
        const edgeReach = reach + 1.5 + random() * .35;
        put(canopy, tree * clustersPerTree + 13 + b * 2 + tip,
          x + Math.cos(edgeAngle) * edgeReach, by + .4 + random() * .95,
          z + Math.sin(edgeAngle) * edgeReach,
          .72 + random() * .3, .78 + random() * .5, .65 + random() * .35,
          edgeAngle, leaves[(b + tip) % 4]);
      }
    }
    // Offset upper lobes make an irregular, open-edged crown instead of a sphere.
    for (let b = 0; b < 6; b++) {
      const a = b * 2.39996 + tree;
      const radius = b === 5 ? .4 : 1.8 + random() * .7;
      put(canopy, tree * clustersPerTree + 7 + b, x + Math.cos(a) * radius + lean,
        height + .15 + (b === 5 ? 1.15 : random() * .85), z + Math.sin(a) * radius,
        1.75 + random() * .5, 1.9 + random() * .55, 1.65 + random() * .55,
        a, leaves[2 + b % 2]);
    }
    for (let tip = 0; tip < 2; tip++) {
      const a = tree + tip * Math.PI;
      put(canopy, tree * clustersPerTree + 27 + tip,
        x + Math.cos(a) * 1.6 + lean, height + 2.35, z + Math.sin(a) * 1.6,
        .78, .95, .72, a, leaves[3]);
    }
  });

  // Soft radial grounding without a DOM canvas, lights, or hard transparent discs.
  const shadowSize = 32, shadowPixels = new Uint8Array(shadowSize * shadowSize * 4);
  for (let y = 0; y < shadowSize; y++) for (let x = 0; x < shadowSize; x++) {
    const radius = Math.hypot((x + .5) / shadowSize * 2 - 1, (y + .5) / shadowSize * 2 - 1);
    const offset = (y * shadowSize + x) * 4;
    shadowPixels.set([49, 60, 42, Math.round(Math.max(0, 1 - radius) ** 2 * 85)], offset);
  }
  const shadowMap = new THREE.DataTexture(shadowPixels, shadowSize, shadowSize, THREE.RGBAFormat);
  shadowMap.minFilter = shadowMap.magFilter = THREE.LinearFilter;
  shadowMap.needsUpdate = true;
  const contactGeo = new THREE.PlaneGeometry(2, 2);
  contactGeo.rotateX(-Math.PI / 2);
  const contacts = instances('garden-soft-contact', contactGeo,
    new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 8 + beds.length * 7);
  treePoints.forEach(([x, z], i) => put(contacts, i, x, .048, z, 4.4, 1, 3.8));
  beds.forEach(([x, z, rx, rz], bed) => {
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      put(contacts, 8 + bed * 7 + i, x + Math.cos(a) * rx * .42, .262,
        z + Math.sin(a) * rz * .3, 1.1, 1, .85);
    }
  });

  // Thin gravity-curved overflow starts just outside the upper bowl rim (y=8.65).
  // Both fountains share one geometry; the opaque basin water remains exposed.
  const streamPositions = [], streamNormals = [], streamIndices = [];
  const impacts = [];
  for (let jet = 0; jet < 8; jet++) {
    const a = jet * Math.PI / 4 + .18;
    const points = [];
    for (let step = 0; step <= 20; step++) {
      const t = step / 20, radius = 1.79 + 1.55 * t;
      points.push(new THREE.Vector3(Math.cos(a) * radius,
        8.65 + .65 * t - 8.35 * t * t, Math.sin(a) * radius));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .026, 4, false);
    const base = streamPositions.length / 3;
    streamPositions.push(...tube.attributes.position.array);
    streamNormals.push(...tube.attributes.normal.array);
    for (const index of tube.index.array) streamIndices.push(base + index);
    tube.dispose();
    impacts.push([Math.cos(a) * 3.34, Math.sin(a) * 3.34]);
  }
  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute('position', new THREE.Float32BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute('normal', new THREE.Float32BufferAttribute(streamNormals, 3));
  streamGeo.setIndex(streamIndices);
  const waterMat = new THREE.MeshBasicMaterial({ color: 0xc8e4de, transparent: true,
    opacity: .48, depthWrite: false });
  const streams = instances('garden-fountain-overflow', streamGeo, waterMat, 2);
  [-35, 35].forEach((x, i) => put(streams, i, x, 0, 48, 1, 1, 1));

  const rippleGeo = new THREE.RingGeometry(.92, 1, 32);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xd8eee2, transparent: true,
    opacity: .32, depthWrite: false, side: THREE.DoubleSide });
  rippleMat.onBeforeCompile = shader => {
    shader.uniforms.gardenTime = timeUniform;
    shader.vertexShader = 'uniform float gardenTime; varying float rippleFade;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float phase = fract(gardenTime * .43 + instanceMatrix[3].x * .371 + instanceMatrix[3].z * .173);
      transformed.xz *= .25 + phase * .75;
      rippleFade = sin(phase * 3.14159265);
    `);
    shader.fragmentShader = 'varying float rippleFade;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.a *= rippleFade;');
  };
  rippleMat.customProgramCacheKey = () => 'anime-fountain-ripples-v1';
  const ripples = instances('garden-fountain-ripples', rippleGeo, rippleMat, 16);
  const drops = instances('garden-fountain-splash', new THREE.IcosahedronGeometry(1, 0), waterMat, 48);
  [-35, 35].forEach((x, fountain) => impacts.forEach(([dx, dz], i) => {
    put(ripples, fountain * 8 + i, x + dx, .947, 48 + dz, .58, 1, .58);
    for (let d = 0; d < 3; d++) {
      const a = i + d * 2.4;
      put(drops, fountain * 24 + i * 3 + d, x + dx + Math.cos(a) * .16,
        1.01 + d * .12, 48 + dz + Math.sin(a) * .16, .035, .065, .035);
    }
  }));

  for (const mesh of garden.children) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += .3;
  }

  return {
    // Seconds, matching THREE.Clock.elapsedTime. No allocations or buffer uploads.
    update(time, _dt) {
      timeUniform.value = time;
    },
  };
}
