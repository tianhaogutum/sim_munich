// Ludwigstraße / Leopoldstraße: OSM-aligned public street, no core-plaza geometry.
// Procedural materials only. Retained source and licenses: assets/osm/ludwigstrasse.sources.json.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDING_BOUNDARIES } from './lmu_block_ludwigstrasse_data.mjs';
import {
  SECTORS, ROADS, CYCLE_PATHS, WALK_PATHS, CROSS_STREETS, TREES, LAMPS, RACKS, STOPS, ENTRANCES,
  FOOTPRINTS, VISTA_FOOTPRINTS, LANDMARKS, LANES, clipToSectors, ribbon, offsetPath, samplePath,
  rectangle, centroid, axisZ, surfacePath, subtractConvex, blockContains,
} from './lmu_block_ludwigstrasse_plan.mjs';
export { LANDMARKS, LANES };

export function createBlock(engine) {
  const T = engine.THREE;
  const group = new T.Group(); group.name = 'lmu-block-ludwigstrasse';
  const street = new T.Group(); street.name = 'Ludwigstraße — surveyed street'; group.add(street);
  const vista = new T.Group(); vista.name = 'Odeonsplatz — distant silhouettes'; group.add(vista);
  const materials = new Set(), textures = new Set(), geometries = new Set();
  const batches = new Map();
  const mat = (color, opts = {}) => {
    const m = engine.toon(color, 4, { ...opts }); materials.add(m); return m;
  };
  const m = {
    asphalt: mat(0x454a51), cycle: mat(0x64696a), paving: mat(0xb1aa98),
    kerb: mat(0xc3bba8), joint: mat(0x817e76), paint: mat(0xd5d0b9),
    metal: mat(0x303b3e), bronze: mat(0x69766a), wood: mat(0x826b4a),
    soil: mat(0x625748), bark: mat(0x6c5944), foliage: mat(0x718653),
    ochre: mat(0xc9a75a), churchTrim: mat(0xe0c584), copper: mat(0x607b75),
    stone: mat(0xb8ac93), dark: mat(0x4c4944), glass: mat(0x829fa5, { transparent: true, opacity: .62 }),
    glow: mat(0xf8e4af, { emissive: 0xffd48a, emissiveIntensity: 1.4 }),
  };
  function addGeometry(geo, material, parent = street, outline = false) {
    if (geo.index) { const g = geo.toNonIndexed(); geo.dispose(); geo = g; }
    // Position/normal-only batches let boxes, tubes, shapes and lathed details share one draw.
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const key = `${material.uuid}/${parent.uuid}/${outline}`;
    if (!batches.has(key)) batches.set(key, { material, parent, outline, list: [] });
    batches.get(key).list.push(geo);
  }
  function transform(geo, x, y, z, yaw = 0) {
    geo.rotateY(yaw); geo.translate(x, y, z); return geo;
  }
  function box(x, y, z, w, h, d, material, yaw = 0, parent = street, outline = false) {
    addGeometry(transform(new T.BoxGeometry(w, h, d), x, y, z, yaw), material, parent, outline);
  }
  function cylinder(x, y, z, top, bottom, h, material, parent = street, segments = 8) {
    addGeometry(transform(new T.CylinderGeometry(top, bottom, h, segments), x, y, z), material, parent);
  }
  const neighbouringBuildings = BUILDING_BOUNDARIES.map(building => {
    const points = building.points;
    return { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
      minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)),
      triangles: T.ShapeUtils.triangulateShape(points.map(p => new T.Vector2(p.x, p.z)), []).map(t => t.map(i => points[i])) };
  });
  function polygon(ring, y, material, parent = street, clip = true) {
    const pieces = clip ? clipToSectors(ring) : [ring];
    for (const points of pieces) {
      const flat = points.map(p => new T.Vector2(p.x, p.z));
      const indices = T.ShapeUtils.triangulateShape(flat, []), vertices = [];
      const bounds = { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
        minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) };
      const cutters = parent === street ? neighbouringBuildings.filter(b => b.minX < bounds.maxX && b.maxX > bounds.minX &&
        b.minZ < bounds.maxZ && b.maxZ > bounds.minZ).flatMap(b => b.triangles) : [];
      for (const triangle of indices) {
        let pieces = [triangle.map(i => points[i])];
        for (const cutter of cutters) pieces = pieces.flatMap(piece => subtractConvex(piece, cutter));
        for (const piece of pieces) for (let i = 1; i < piece.length - 1; i++) {
          const [a, b, c] = [piece[0], piece[i], piece[i + 1]];
          const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
          if (Math.abs(cross) < 1e-9) continue;
          for (const p of cross < 0 ? [a, b, c] : [a, c, b]) vertices.push(p.x, y, p.z);
        }
      }
      if (!vertices.length) continue;
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      geo.computeVertexNormals(); addGeometry(geo, material, parent);
    }
  }
  function strip(points, width, material, y, offset = 0) { polygon(ribbon(surfacePath(points), width, offset), y, material); }
  function stroke(a, b, width, material = m.paint, y = .058) { strip([a, b], width, material, y); }
  function intersection(p, padding = 0) {
    return CROSS_STREETS.some(w => w.points.slice(1).some((b, i) => {
      const a = w.points[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (l2 || 1)));
      return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz) < w.width / 2 + padding;
    }));
  }
  function slabJoints(points, width, offset) {
    const path = offsetPath(points, offset);
    strip(points, .035, m.joint, .148, offset - width / 2 + .18);
    strip(points, .035, m.joint, .148, offset + width / 2 - .18);
    strip(points, .025, m.joint, .148, offset);
    for (const p of samplePath(path, 2.4, 1.2)) {
      if (intersection(p, 1)) continue;
      stroke({ x: p.x - p.dz * width / 2, z: p.z + p.dx * width / 2 },
        { x: p.x + p.dz * width / 2, z: p.z - p.dx * width / 2 }, .022, m.joint, .148);
    }
  }
  // Ground first: every triangle is clipped at the exact two sector seams and the corridor edges.
  for (const road of ROADS) {
    strip(road.points, road.width + road.parkingLeft + road.parkingRight + 1, m.paving, .012);
    strip(road.points, road.width, m.asphalt, .04);
    for (const [side, width] of [[-1, road.parkingLeft], [1, road.parkingRight]]) {
      if (!width) continue;
      strip(road.points, width, m.cycle, .041, side * (road.width / 2 + width / 2));
      for (const p of samplePath(offsetPath(road.points, side * (road.width / 2 + width / 2)), 6, 2)) {
        if (!intersection(p, 5)) stroke({ x: p.x - p.dz, z: p.z + p.dx }, { x: p.x + p.dz, z: p.z - p.dx }, .08);
      }
    }
    for (let lane = 1; lane < road.count; lane++) {
      const offset = road.width / 2 - lane * 3.1;
      for (const p of samplePath(offsetPath(road.points, offset), 8, 1)) {
        if (!intersection(p, 3)) stroke({ x: p.x - p.dx * 1.45, z: p.z - p.dz * 1.45 },
          { x: p.x + p.dx * 1.45, z: p.z + p.dz * 1.45 }, lane === Math.floor(road.count / 2) && !road.oneWay ? .14 : .11);
      }
    }
  }
  for (const road of CROSS_STREETS) strip(road.points, road.width, m.asphalt, .043);
  for (const path of CYCLE_PATHS) {
    const middle = centroid(path.points), direction = path.points.at(-1).x > path.points[0].x ? 1 : -1;
    const side = Math.sign(middle.z - axisZ(middle.x)) || 1, outward = side * direction;
    const width = 4.4, offset = outward * (path.width / 2 + width / 2 + .18);
    strip(path.points, path.width + 1, m.paving, .10);
    strip(path.points, path.width, m.cycle, .115);
    strip(path.points, width, m.paving, .14, offset);
    slabJoints(path.points, width, offset);
    // A bevel-sized kerb strip with a darker road-side vertical face, not a motorway barrier.
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      if (intersection(mid, 2)) continue;
      strip([a, b], .24, m.kerb, .165, -outward * (path.width / 2 + .26));
      strip([a, b], .075, m.joint, .166, outward * (path.width / 2 + .09));
    }
    for (const p of samplePath(path.points, 56, 18)) {
      if (intersection(p, 6)) continue;
      const local = (a, b) => ({ x: p.x + a * p.dx - b * p.dz, z: p.z + a * p.dz + b * p.dx });
      // Procedural bicycle stencil: two wheels, diamond, handlebar and seat.
      for (const u of [-.68, .68]) for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, b = (i + 1) / 12 * Math.PI * 2;
        stroke(local(u + .32 * Math.cos(a), .32 * Math.sin(a)), local(u + .32 * Math.cos(b), .32 * Math.sin(b)), .045, m.paint, .124);
      }
      for (const [a, b] of [[[-.68, 0], [-.15, .43]], [[-.15, .43], [.15, 0]], [[.15, 0], [-.68, 0]], [[-.15, .43], [.43, .43]], [[.43, .43], [.68, 0]], [[.15, 0], [.43, .43]], [[.4, .43], [.35, .65]], [[-.15, .43], [-.3, .61]], [[-.42, .61], [-.16, .61]]]) stroke(local(...a), local(...b), .05, m.paint, .124);
      stroke(local(1.5, 0), local(2.65, 0), .1, m.paint, .124);
      stroke(local(2.65, 0), local(2.25, .28), .1, m.paint, .124);
      stroke(local(2.65, 0), local(2.25, -.28), .1, m.paint, .124);
    }
  }
  for (const path of WALK_PATHS) { strip(path.points, path.width, m.paving, .142); slabJoints(path.points, path.width, 0); }

  // One merged template, two instanced draws: ornamented double-arm candelabra and warm glass.
  const lampParts = [], lampGlass = [];
  const lampCylinder = (y, top, bottom, h, segments = 10) => {
    const g = new T.CylinderGeometry(top, bottom, h, segments); g.translate(0, y, 0); lampParts.push(g);
  };
  lampCylinder(.23, .30, .34, .46, 8); lampCylinder(.65, .22, .28, .42, 8);
  lampCylinder(1.0, .16, .22, .28); lampCylinder(4.77, .08, .15, 7.35);
  for (const y of [1.17, 1.4, 7.82, 8.22]) lampCylinder(y, .19, .19, .1);
  lampCylinder(8.55, .10, .14, .6); lampCylinder(8.98, 0, .15, .32);
  for (const side of [-1, 1]) {
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(0, 8.2, 0), new T.Vector3(side * .45, 8.9, 0), new T.Vector3(side * 1.2, 9.12, 0),
      new T.Vector3(side * 1.9, 8.92, 0), new T.Vector3(side * 2.13, 8.35, 0),
    ]);
    lampParts.push(new T.TubeGeometry(curve, 16, .055, 6, false));
    const hood = new T.CylinderGeometry(.13, .37, .18, 10); hood.translate(side * 2.13, 8.24, 0); lampParts.push(hood);
    const collar = new T.CylinderGeometry(.15, .23, .08, 8); collar.translate(side * 2.13, 7.72, 0); lampParts.push(collar);
    const glass = new T.SphereGeometry(.27, 8, 6); glass.scale(.86, 1, .86); glass.translate(side * 2.13, 7.98, 0); lampGlass.push(glass);
  }
  function instanced(parts, material, positions, name) {
    if (!positions.length) { parts.forEach(g => g.dispose()); return; }
    const geo = mergeGeometries(parts, false); parts.forEach(g => g.dispose()); geometries.add(geo);
    const mesh = new T.InstancedMesh(geo, material, positions.length); mesh.name = name;
    const matrix = new T.Matrix4();
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]; matrix.makeRotationY(p.yaw ?? -.305); matrix.setPosition(p.x, p.y ?? 0, p.z);
      if (p.scale) matrix.scale(new T.Vector3(p.scale, p.scale, p.scale));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); street.add(mesh);
  }
  instanced(lampParts, m.metal, LAMPS, '25 candelabra — instanced ironwork');
  instanced(lampGlass, m.glow, LAMPS, '50 warm lantern heads — instanced');

  // Only mapped trees; no randomly planted boulevard avenue.
  const trunks = new T.CylinderGeometry(.16, .24, 4.8, 7); trunks.translate(0, 2.55, 0);
  instanced([trunks], m.bark, TREES, 'OSM tree trunks');
  const crowns = [new T.IcosahedronGeometry(2.6, 1), new T.IcosahedronGeometry(2, 0), new T.IcosahedronGeometry(1.8, 0)];
  crowns[0].scale(1, 1.1, .85); crowns[0].translate(0, 5.7, 0);
  crowns[1].translate(1.5, 5.1, .3); crowns[2].translate(-1.3, 4.9, -.3);
  instanced(crowns, m.foliage, TREES.map((p, i) => ({ ...p, yaw: i * 1.7, scale: .85 + (i % 5) * .055 })), 'OSM broadleaf crowns');
  for (const p of TREES) polygon(rectangle(p.x, p.z, 1.7, 1.7, -.305), .151, m.soil);

  // U-shaped Sheffield stands at OSM parking sites; crowded 80-place sites are abbreviated to 16 stands.
  const rackParts = [];
  const rackCurve = new T.CatmullRomCurve3([new T.Vector3(0, .16, -.4), new T.Vector3(0, .85, -.4),
    new T.Vector3(0, .98, -.25), new T.Vector3(0, .98, .25), new T.Vector3(0, .85, .4), new T.Vector3(0, .16, .4)]);
  rackParts.push(new T.TubeGeometry(rackCurve, 12, .038, 6, false));
  const rackPositions = FOOTPRINTS.filter(f => f.type === 'rack').map(f => ({ ...centroid(f.points), yaw: -.305 }));
  instanced(rackParts, m.metal, rackPositions, 'OSM bicycle parking stands');

  function signTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 1024, 512);
    c.fillStyle = '#126540'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#f6d860';
    c.beginPath(); c.arc(110, 128, 94, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#126540'; c.font = 'bold 128px sans-serif'; c.textAlign = 'center'; c.fillText('H', 110, 174);
    c.fillStyle = '#fff8d9'; c.font = 'bold 39px sans-serif'; c.fillText('Universität', 352, 119);
    c.font = '26px sans-serif'; c.fillText('150 · N40 · N41', 352, 162);
    c.fillStyle = '#126540'; c.fillRect(512, 0, 512, 256); c.fillStyle = '#f6d860';
    c.beginPath(); c.arc(620, 128, 94, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#126540'; c.font = 'bold 128px sans-serif'; c.fillText('H', 620, 174);
    c.fillStyle = '#fff8d9'; c.font = 'bold 34px sans-serif'; c.fillText('Georgenstraße', 864, 118);
    c.font = '27px sans-serif'; c.fillText('154 · Nachtbus', 864, 164);
    c.fillStyle = '#154c94'; c.fillRect(0, 256, 512, 256); c.fillStyle = '#fff'; c.font = 'bold 180px sans-serif'; c.fillText('U', 256, 453);
    c.fillStyle = '#123c72'; c.fillRect(512, 256, 512, 256); c.fillStyle = '#fff'; c.font = 'bold 50px sans-serif'; c.fillText('Universität', 768, 376);
    c.font = '34px sans-serif'; c.fillText('U3  ·  U6', 768, 438);
    const tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace; tex.minFilter = T.LinearFilter;
    textures.add(tex); const material = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }); materials.add(material); return material;
  }
  const signage = signTexture();
  function sign(x, y, z, width, height, tile, yaw) {
    const geo = new T.PlaneGeometry(width, height), uv = geo.attributes.uv;
    // UV atlas: H/Universität, H/Georgenstraße, U, Universität/U3/U6.
    const col = tile % 2, row = Math.floor(tile / 2);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + col) / 2, (uv.getY(i) + 1 - row) / 2);
    geo.rotateY(yaw); geo.translate(x, y, z);
    const mesh = new T.Mesh(geo, signage); mesh.name = 'Transit sign'; geometries.add(geo); street.add(mesh);
  }
  for (const stop of STOPS) {
    polygon(stop.points, .17, m.kerb);
    const north = stop.x > 0, yaw = -.305;
    cylinder(stop.x, 1.75, stop.z, .047, .047, 3.2, m.metal);
    sign(stop.x, 3.05, stop.z, 1.55, .78, north ? 1 : 0, yaw);
    if (stop.tags.shelter === 'yes') {
      // Glass shelter dimensions estimated; the OSM platform polygon fixes its real location.
      const x = stop.x - 2.6, z = stop.z - 1.2;
      box(x, 2.65, z, 4.8, .18, 1.7, m.metal, yaw);
      box(x, 1.45, z - .6, 4.6, 2.25, .045, m.glass, yaw);
      for (const dx of [-2.2, 2.2]) box(x + dx, 1.4, z, .08, 2.5, .08, m.metal);
      box(x, .7, z, 3, .1, .42, m.wood, yaw);
    }
  }
  for (const p of ENTRANCES) {
    polygon(rectangle(p.x, p.z, p.width + .5, p.depth + .5, p.yaw), .176, m.kerb);
    polygon(rectangle(p.x, p.z, p.width, p.depth, p.yaw), .179, m.dark);
    for (let i = 0; i < 8; i++) {
      const z = -p.depth / 2 + i * p.depth / 8;
      const at = { x: p.x + z * Math.sin(p.yaw), z: p.z + z * Math.cos(p.yaw) };
      box(at.x, .185, at.z, p.width - .25, .035, .08, m.kerb, p.yaw);
    }
    for (const dx of [-p.width / 2, p.width / 2]) {
      const x = p.x + dx * Math.cos(p.yaw), z = p.z - dx * Math.sin(p.yaw);
      box(x, .74, z, .08, .08, p.depth + .2, m.bronze, p.yaw);
      for (const dz of [-p.depth / 2, p.depth / 2]) {
        box(x + dz * Math.sin(p.yaw), .45, z + dz * Math.cos(p.yaw), .07, .8, .07, m.bronze);
      }
    }
    const x = p.x - 2.8, z = p.z + .65;
    cylinder(x, 1.75, z, .065, .065, 3.2, m.metal);
    sign(x, 3.28, z, 1.05, 1.05, 2, p.yaw);
    sign(x, 2.45, z, 1.65, .825, 3, p.yaw);
  }

  // Deliberate backdrop exceptions outside the playable sector, at the real OSM positions.
  // No ground outside ±480, and no proxy gate: the north block owns Siegestor.
  function extrudeFootprint(footprint, height, material) {
    const shape = new T.Shape(footprint.map(p => new T.Vector2(p.x, -p.z)));
    const geo = new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2); addGeometry(geo, material, vista, true);
  }
  const church = VISTA_FOOTPRINTS.find(f => f.id === 25514390);
  extrudeFootprint(church.points, 22, m.ochre);
  // Twin towers sit at the north/south ends of the east-facing facade, not in the middle of the road.
  for (const p of [{ x: -944.9, z: -245.4 }, { x: -985.0, z: -253.9 }]) {
    box(p.x, 25.5, p.z, 8.1, 51, 8.1, m.ochre, -.255, vista, true);
    for (const y of [22, 38, 49, 53]) box(p.x, y, p.z, 9, .8, 9, m.churchTrim, -.255, vista);
    cylinder(p.x, 53, p.z, 4.5, 4.6, 5, m.ochre, vista, 8);
    // Clock / belfry accents repeat on all four sides, batched with the recess palette.
    for (const side of [-1, 1]) {
      box(p.x + side * 4.07, 42.5, p.z, .1, 5.2, 2.3, m.dark, 0, vista);
      box(p.x, 42.5, p.z + side * 4.07, 2.3, 5.2, .1, m.dark, 0, vista);
    }
    cylinder(p.x, 57.2, p.z, 2.7, 4.7, 3.5, m.copper, vista, 10);
    cylinder(p.x, 60.2, p.z, 1.5, 2.7, 2.5, m.copper, vista, 10);
    cylinder(p.x, 62.7, p.z, 0, 1.5, 2.5, m.copper, vista, 10);
    box(p.x, 64.7, p.z, .18, 2, .18, m.bronze, 0, vista);
    box(p.x, 65.1, p.z, 1.3, .18, .18, m.bronze, 0, vista);
  }
  const domeX = -956.6, domeZ = -291.2;
  cylinder(domeX, 39.5, domeZ, 9.2, 10.2, 10, m.ochre, vista, 14);
  cylinder(domeX, 45.2, domeZ, 10, 10, 1.1, m.churchTrim, vista, 14);
  const dome = new T.SphereGeometry(10, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 1.6, 1); dome.translate(domeX, 45.6, domeZ); addGeometry(dome, m.copper, vista);
  cylinder(domeX, 64, domeZ, 2.1, 2.5, 4.8, m.ochre, vista, 8);
  cylinder(domeX, 67.5, domeZ, 0, 3, 3, m.copper, vista, 8);
  box(domeX, 70.3, domeZ, .2, 2.2, .2, m.bronze, 0, vista);
  box(domeX, 70.7, domeZ, 1.6, .18, .18, m.bronze, 0, vista);
  // Field Marshals' Hall: open three-bay loggia with a dark rear, four piers and curved spandrels.
  const hall = VISTA_FOOTPRINTS.find(f => f.id === 25505402), center = centroid(hall.points), hallYaw = Math.PI / 2 - .305;
  function hallBox(x, y, z, w, h, d, material, outline = false) {
    const wx = center.x + x * Math.cos(hallYaw) + z * Math.sin(hallYaw);
    const wz = center.z - x * Math.sin(hallYaw) + z * Math.cos(hallYaw);
    box(wx, y, wz, w, h, d, material, hallYaw, vista, outline);
  }
  hallBox(0, 1.4, 0, 34, 2.8, 12, m.stone, true);
  hallBox(0, 10, -4.7, 34, 14.5, 1.2, m.dark);
  for (const x of [-16, -5.4, 5.4, 16]) hallBox(x, 8.7, 4.6, 1.9, 12, 2.7, m.stone, true);
  for (const x of [-10.7, 0, 10.7]) {
    const s = new T.Shape(); s.moveTo(-5.4, 10.4); s.lineTo(-4.35, 10.4);
    s.absarc(0, 10.4, 4.35, Math.PI, 0, true); s.lineTo(5.4, 10.4);
    s.lineTo(5.4, 18.1); s.lineTo(-5.4, 18.1); s.closePath();
    const geo = new T.ExtrudeGeometry(s, { depth: 2.7, bevelEnabled: false, curveSegments: 12 });
    geo.translate(x, 0, 3.25); geo.rotateY(hallYaw); geo.translate(center.x, 0, center.z); addGeometry(geo, m.stone, vista);
    hallBox(x, 4.1, -2, 1.5, 2.6, 1.5, m.stone);
    hallBox(x, 6.9, -2, .65, 3, .7, m.bronze);
  }
  hallBox(0, 18.3, 0, 35, .65, 12.8, m.churchTrim);
  hallBox(0, 19.4, 0, 34, 1.4, 11.9, m.stone);
  for (let step = 0; step < 5; step++) hallBox(0, .18 + step * .23, 7.6 - step * .35, 31, .3, .7, m.stone);

  for (const { material, parent, outline, list } of batches.values()) {
    const geo = mergeGeometries(list, false); list.forEach(g => g.dispose()); geometries.add(geo);
    const mesh = new T.Mesh(geo, material); mesh.name = `Ludwigstraße batch ${material.color.getHexString()}`;
    mesh.receiveShadow = parent === street; parent.add(mesh);
    if (outline) engine.outline(mesh, .065);
  }
  batches.clear();
  // One unregisterable polygon collision function, including all exact OSM backdrop building rings.
  const unregister = engine.addBlocker(blockContains);
  group.userData = { sectors: SECTORS, coreUntouched: true, source: '© OpenStreetMap contributors, ODbL',
    counts: { roadWays: ROADS.length, cyclePaths: CYCLE_PATHS.length, lamps: LAMPS.length, lanternHeads: LAMPS.length * 2,
      trees: TREES.length, bicycleStands: rackPositions.length, busStops: STOPS.length, subwayEntrances: ENTRANCES.length,
      distantBuildings: VISTA_FOOTPRINTS.length },
    lanes: LANES, collisionFootprints: FOOTPRINTS, vistaFootprints: VISTA_FOOTPRINTS,
  };
  engine.scene.add(group);
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return; disposed = true;
      unregister?.(); group.removeFromParent();
      group.traverse(o => {
        if (o.isInstancedMesh) o.dispose();
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) for (const material of Array.isArray(o.material) ? o.material : [o.material]) materials.add(material);
      });
      geometries.forEach(g => g.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
    },
  };
}
