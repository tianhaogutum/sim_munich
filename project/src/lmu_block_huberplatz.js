// Professor-Huber-Platz / east LMU block. Static OSM geometry, no runtime network or animation.
// © OpenStreetMap contributors, ODbL. See assets/osm/huberplatz.sources.json.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointInPolygon, polygonBounds } from './date_geo.mjs';
import { SECTOR, BUILDINGS, HIGHWAYS, GRASS_PATCHES, TREES, BIKE_PARKING } from './lmu_block_huberplatz_data.mjs';
export { LANDMARKS, DEFERRED_FEATURES } from './lmu_block_huberplatz_data.mjs';

/** Synchronous factory: all geometry/material ownership stays with the returned block. */
export function createBlock(engine) {
  const { THREE, scene } = engine;
  const group = new THREE.Group();
  group.name = 'lmu-block-huberplatz';
  const batches = new Map();
  const mats = new Map();
  const resources = new Set();
  const unregister = [];
  let disposed = false;
  const palette = {
    gold: 0xb5a17b, sand: 0xad9b84, rose: 0xac9183, sage: 0x929a89, brick: 0xa47c62,
    roof: 0x665044, trim: 0xc0b292, glass: 0x304e5a, frame: 0x746b56,
    door: 0x46362e, paving: 0xa49d8b, asphalt: 0x676b6c, seam: 0x8d897e,
    grass: 0x6d8d54, trunk: 0x70543e, leafA: 0x60824b, leafB: 0x82995b,
    iron: 0x424c51, wood: 0x99744f, stone: 0x8a918c, water: 0x4e9e9e,
    blue: 0x235c95, white: 0xd8d4b9,
  };
  const stats = { buildings: BUILDINGS.length, roadWays: HIGHWAYS.length, grassIslands: GRASS_PATCHES.length, courtyardFountains: 1, trees: 0, rackStands: 0, bicycles: 0, benches: 0, lamps: 0, windows: 0, meshes: 0, drawCalls: 0 };
  const minX = SECTOR.minX + .075, maxX = SECTOR.maxX - .075;
  const minZ = SECTOR.minZ + .075, maxZ = SECTOR.maxZ - .075;

  function material(key) {
    if (!mats.has(key)) mats.set(key, engine.toon(palette[key], ['grass', 'leafA', 'leafB', 'trunk'].includes(key) ? 3 : 4));
    return mats.get(key);
  }
  // Clip triangles, not just object origins: leaves, roofs, cornices and road ribbons stay in-sector.
  function clipGeometry(geo) {
    const raw = geo.index ? geo.toNonIndexed() : geo;
    const p = raw.getAttribute('position'), n = raw.getAttribute('normal');
    const positions = [], normals = [];
    for (let i = 0; i < p.count; i += 3) {
      let poly = [0, 1, 2].map(k => ({ x: p.getX(i + k), y: p.getY(i + k), z: p.getZ(i + k),
        nx: n?.getX(i + k) ?? 0, ny: n?.getY(i + k) ?? 1, nz: n?.getZ(i + k) ?? 0 }));
      for (const [key, edge, greater] of [['x', minX, true], ['x', maxX, false], ['z', minZ, true], ['z', maxZ, false]]) {
        const clipped = [];
        for (let a = 0; a < poly.length; a++) {
          const v = poly[a], w = poly[(a + 1) % poly.length];
          const iv = greater ? v[key] >= edge : v[key] <= edge;
          const iw = greater ? w[key] >= edge : w[key] <= edge;
          if (iv) clipped.push(v);
          if (iv !== iw) {
            const t = (edge - v[key]) / (w[key] - v[key]);
            const q = {};
            for (const field of ['x', 'y', 'z', 'nx', 'ny', 'nz']) q[field] = v[field] + t * (w[field] - v[field]);
            clipped.push(q);
          }
        }
        poly = clipped;
        if (!poly.length) break;
      }
      for (let a = 1; a < poly.length - 1; a++) for (const v of [poly[0], poly[a], poly[a + 1]]) {
        positions.push(v.x, v.y, v.z); normals.push(v.nx, v.ny, v.nz);
      }
    }
    if (raw !== geo) raw.dispose();
    geo.dispose();
    if (!positions.length) return null;
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return out;
  }
  function put(key, geo) {
    const out = clipGeometry(geo);
    if (!out) return;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(out);
  }
  function box(key, x, y, z, w, h, d, yaw = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(yaw); g.translate(x, y, z); put(key, g);
  }
  function cylinder(key, x, y, z, rt, rb, h, segments = 12) {
    const g = new THREE.CylinderGeometry(rt, rb, h, segments);
    g.translate(x, y, z); put(key, g);
  }
  function pipe(key, a, b, r = .045, segments = 6) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), dir = bv.clone().sub(av);
    const geo = new THREE.CylinderGeometry(r, r, dir.length(), segments);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    geo.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); put(key, geo);
  }
  function shape(points) {
    const s = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, -p.z)));
    s.closePath(); return s;
  }
  function slab(key, points, y, h = .07) {
    if (points.length < 3) return;
    const g = new THREE.ExtrudeGeometry(shape(points), { depth: h, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, y, 0); put(key, g);
  }
  function strip(key, a, b, width, y, height = .035) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < .01) return;
    box(key, (a.x + b.x) / 2, y, (a.z + b.z) / 2, length, height, width, -Math.atan2(dz, dx));
  }
  function solidAt(x, z, except = null) {
    return BUILDINGS.some(b => b !== except && pointInPolygon(x, z, b.ring));
  }
  function boundaryEdge(a, b) {
    return (Math.abs(a.x - b.x) < .005 && (Math.abs(a.x + 59.88) < .02 || Math.abs(a.x - 149.88) < .02)) ||
      (Math.abs(a.z - b.z) < .005 && (Math.abs(a.z - 118.12) < .02 || Math.abs(a.z - 299.88) < .02));
  }

  // Ground follows the mapped street axes. The low plain paving also joins the legacy plaza cleanly.
  box('paving', 45, .018, 209, 210, .035, 182);
  for (let x = -56; x < 150; x += 5) strip('seam', { x, z: 118 }, { x, z: 300 }, .038, .043, .008);
  for (let z = 121; z < 300; z += 5) strip('seam', { x: -60, z }, { x: 150, z }, .038, .043, .008);
  for (const road of HIGHWAYS) {
    const major = road.kind === 'residential';
    const driving = major || road.kind === 'service';
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      if (major) strip('trim', a, b, road.width + 3.8, .067, .1);
      strip(driving ? 'asphalt' : 'paving', a, b, road.width, major ? .125 : .087, .065);
      // White dashed marks only along the larger Kaulbachstraße; bicycle streets remain unmarked.
      if (road.name === 'Kaulbachstraße') {
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        for (let d = 3; d < len - 2; d += 9) strip('white', { x: a.x + dx * d / len, z: a.z + dz * d / len },
          { x: a.x + dx * (d + 2.8) / len, z: a.z + dz * (d + 2.8) / len }, .1, .164, .01);
      }
    }
  }
  for (const grass of GRASS_PATCHES) slab('grass', grass.ring, .13, .06);

  function roof(building) {
    const ring = building.ring, h = building.height;
    if (building.roof === 'flat') { slab('roof', ring, h, .32); return; }
    // An OSM-conforming height field: hip roofs fall toward every original edge, gables toward two eaves.
    // Subdivision retains concave footprints and avoids bounding-box roofs spanning courtyards.
    const original = building.originalRing;
    let axis = { x: 1, z: 0 }, longest = 0;
    for (let i = 0; i < original.length; i++) {
      const a = original[i], b = original[(i + 1) % original.length], dx = b.x - a.x, dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length > longest) { longest = length; axis = { x: dx / length, z: dz / length }; }
    }
    const vs = original.map(p => -p.x * axis.z + p.z * axis.x);
    const lo = Math.min(...vs), hi = Math.max(...vs), mid = (lo + hi) / 2;
    function height(p) {
      if (building.roof.includes('gabled')) {
        const v = -p.x * axis.z + p.z * axis.x;
        return h + Math.max(0, 1 - Math.abs(v - mid) / ((hi - lo) / 2)) * building.roofHeight;
      }
      let dist = Infinity;
      for (let i = 0; i < original.length; i++) {
        const a = original[i], b = original[(i + 1) % original.length], dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
        dist = Math.min(dist, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
      }
      return h + Math.min(building.roofHeight, dist * .42);
    }
    const coords = [], triangles = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p.x, p.z)), []);
    function triangle(a, b, c, depth = 0) {
      if (depth < 6 && Math.max(Math.hypot(a.x - b.x, a.z - b.z), Math.hypot(a.x - c.x, a.z - c.z), Math.hypot(b.x - c.x, b.z - c.z)) > 3.2) {
        const ab = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        const bc = { x: (b.x + c.x) / 2, z: (b.z + c.z) / 2 };
        const ca = { x: (c.x + a.x) / 2, z: (c.z + a.z) / 2 };
        triangle(a, ab, ca, depth + 1); triangle(ab, b, bc, depth + 1);
        triangle(ca, bc, c, depth + 1); triangle(ab, bc, ca, depth + 1); return;
      }
      const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
      for (const p of cross < 0 ? [a, b, c] : [a, c, b]) coords.push(p.x, height(p), p.z);
    }
    for (const t of triangles) triangle(...t.map(i => ring[i]));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3)); geo.computeVertexNormals(); put('roof', geo);
    // Vertical triangles close gable ends instead of leaving sky holes under the pitched surface.
    const ends = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
      for (let j = 0; j < n; j++) {
        const p = { x: a.x + (b.x - a.x) * j / n, z: a.z + (b.z - a.z) * j / n };
        const q = { x: a.x + (b.x - a.x) * (j + 1) / n, z: a.z + (b.z - a.z) * (j + 1) / n };
        ends.push(p.x, h, p.z, p.x, height(p), p.z, q.x, height(q), q.z,
          p.x, h, p.z, q.x, height(q), q.z, q.x, h, q.z);
        ends.push(p.x, h, p.z, q.x, height(q), q.z, p.x, height(p), p.z,
          p.x, h, p.z, q.x, h, q.z, q.x, height(q), q.z);
      }
    }
    const endGeo = new THREE.BufferGeometry();
    endGeo.setAttribute('position', new THREE.Float32BufferAttribute(ends, 3)); endGeo.computeVertexNormals(); put(building.palette, endGeo);
  }

  function arch(width, height) {
    const s = new THREE.Shape(), r = width / 2;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, height - r);
    s.absarc(0, height - r, r, 0, Math.PI, false); s.closePath();
    return new THREE.ShapeGeometry(s, 7);
  }
  function windowAt(x, z, y, yaw, w, h, round) {
    // Planar panes sit just outside masonry; four timber bars describe the cross without textures.
    let pane = round ? arch(w, h) : new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
    pane.rotateY(yaw); pane.translate(x, y, z); put('glass', pane);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), tx = Math.cos(yaw), tz = -Math.sin(yaw);
    box('frame', x + fx * .03, y + h * .48, z + fz * .03, .075, h * .93, .07, yaw);
    box('frame', x + fx * .03, y + h * .52, z + fz * .03, w, .075, .07, yaw);
    box('trim', x + fx * .05, y - .08, z + fz * .05, w + .3, .15, .25, yaw);
    if (!round) {
      for (const side of [-1, 1]) box('trim', x + tx * side * (w / 2 + .055), y + h / 2, z + tz * side * (w / 2 + .055), .11, h + .22, .13, yaw);
      box('trim', x, y + h + .05, z, w + .22, .12, .14, yaw);
    }
    stats.windows++;
  }

  for (const b of BUILDINGS) {
    slab(b.palette, b.ring, .14, b.height - .14); roof(b);
    const bounds = polygonBounds(b.ring);
    unregister.push(engine.addBlocker((x, z) => Math.abs(x - bounds.cx) <= bounds.hw + .1 &&
      Math.abs(z - bounds.cz) <= bounds.hd + .1 && pointInPolygon(x, z, b.ring)));
    if (b.height < 5) continue;
    const historic = b.id === 17970872 || b.id === 1432551061;
    for (let i = 0; i < b.ring.length; i++) {
      const a = b.ring[i], c = b.ring[(i + 1) % b.ring.length];
      if (boundaryEdge(a, c)) continue;
      const dx = c.x - a.x, dz = c.z - a.z, length = Math.hypot(dx, dz);
      if (length < 3.3) continue;
      let nx = dz / length, nz = -dx / length;
      const cx = (a.x + c.x) / 2, cz = (a.z + c.z) / 2;
      if (pointInPolygon(cx + nx * .3, cz + nz * .3, b.ring)) { nx *= -1; nz *= -1; }
      if (solidAt(cx + nx * .7, cz + nz * .7, b)) continue;
      const yaw = Math.atan2(nx, nz);
      for (const y of [.8, b.height - .3, ...(historic ? [6.1, 12.3] : [])])
        box('trim', cx + nx * .12, y, cz + nz * .12, length, y === .8 ? .55 : .24, .23, yaw);
      const bays = Math.max(1, Math.floor(length / (historic ? 4.3 : 3.6)));
      for (let bay = 0; bay < bays; bay++) {
        const t = (bay + .5) / bays, x = a.x + dx * t + nx * .09, z = a.z + dz * t + nz * .09;
        if (solidAt(x + nx * .4, z + nz * .4, b)) continue;
        for (let floor = 0; floor < b.levels; floor++) {
          const y = 1.6 + floor * (b.height - 3) / b.levels;
          const h = Math.min(3.4, (b.height - 3) / b.levels * .62);
          windowAt(x, z, y, yaw, historic ? 1.65 : 1.5, h, historic);
        }
      }
      if (historic && length > 20) {
        // Repeating corbels create Gärtner's fine dentil line below the eaves.
        for (let d = .8; d < length; d += 1.05) box('frame', a.x + dx * d / length + nx * .1, b.height - .65,
          a.z + dz * d / length + nz * .1, .24, .45, .28, yaw);
      }
      if (length > 14 && (historic || i % 3 === 0)) {
        const g = arch(2.0, 3.6); g.rotateY(yaw); g.translate(cx + nx * .1, .16, cz + nz * .1); put('door', g);
        for (let s = 0; s < 3; s++) box('stone', cx + nx * (.36 + s * .22), .13 + (2 - s) * .055,
          cz + nz * (.36 + s * .22), 2.65, .12, .36, yaw);
      }
    }
  }

  // OSM tree positions. Crowns near sector edges are clipped exactly, never shifted into the core.
  for (const t of TREES) {
    if (solidAt(t.x, t.z)) continue;
    const seed = t.id % 17, height = 6.7 + seed * .13;
    cylinder('trunk', t.x, height * .32, t.z, .22, .34, height * .64, 7);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.IcosahedronGeometry(2.9 + (seed % 3) * .25, 1);
      g.scale(1, 1.15, .92); g.rotateY(seed + i * 1.2);
      g.translate(t.x + Math.cos(i * 2.1) * 1.15, height + (i === 0 ? .8 : -.5), t.z + Math.sin(i * 2.1) * 1.15);
      put(i === 1 ? 'leafB' : 'leafA', g);
    }
    stats.trees++;
  }
  for (const parking of BIKE_PARKING) {
    const count = Math.min(10, Math.max(3, Math.ceil(parking.capacity / 2)));
    const yaw = -.3, c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < count; i++) {
      const x = parking.x + (i - (count - 1) / 2) * 1.1 * c, z = parking.z - (i - (count - 1) / 2) * 1.1 * s;
      if (solidAt(x, z)) continue;
      const a = [x + s * .4, .18, z + c * .4], b = [x + s * .4, 1.02, z + c * .4];
      const d = [x - s * .4, 1.02, z - c * .4], e = [x - s * .4, .18, z - c * .4];
      pipe('iron', a, b); pipe('iron', b, d); pipe('iron', d, e); stats.rackStands++;
      if (i % 3 === 0) {
        stats.bicycles++;
        // A few parked city bikes: hoops, diamond frame, saddle and bars, all merged.
        const bx = x + .16 * c, bz = z - .16 * s;
        for (const w of [-.58, .58]) {
          const wheel = new THREE.TorusGeometry(.33, .035, 5, 12);
          wheel.rotateY(yaw); wheel.translate(bx + c * w, .51, bz - s * w); put('iron', wheel);
        }
        const a = [bx - .58 * c, .51, bz + .58 * s], b = [bx, .51, bz], d = [bx - .2 * c, 1.08, bz + .2 * s],
          e = [bx + .4 * c, 1.1, bz - .4 * s], f = [bx + .58 * c, .51, bz - .58 * s];
        for (const [v, w] of [[a,b],[a,d],[b,d],[d,e],[b,e],[e,f]]) pipe('blue', v, w, .028);
        box('door', d[0], 1.14, d[2], .33, .09, .22, yaw); pipe('iron', e, [e[0], 1.25, e[2]], .028);
      }
    }
  }

  function bench(x, z, yaw) {
    if (solidAt(x, z)) return;
    for (let i = 0; i < 4; i++) box('wood', x, .66, z + (i - 1.5) * .16, 2.4, .12, .13, yaw);
    for (let i = 0; i < 3; i++) box('wood', x, 1.05 + i * .16, z + .34, 2.4, .13, .1, yaw);
    for (const side of [-1, 1]) box('iron', x + side * .92, .4, z, .1, .55, .65, yaw);
    stats.benches++;
  }
  // Small inferred furnishings beside mapped trees; no claims of surveyed bench positions.
  bench(39.5, 153.2, -.29); bench(113.2, 177.6, -.29); bench(-12.4, 181.5, -.29);
  for (const [x,z] of [[34.2,128.7],[-43,172],[101.5,178.5],[-45,226]]) {
    if (solidAt(x,z)) continue;
    stats.lamps++;
    cylinder('iron', x, 2.7, z, .065, .11, 5.2, 8);
    pipe('iron', [x,5.25,z], [x,5.35,z+1], .07);
    cylinder('white', x, 5.03, z+1, .17, .27, .32, 8);
    cylinder('iron', x, 5.24, z+1, .35, .17, .17, 8);
  }
  // Small courtyard fountain is a separate OSM feature, NOT the Gärtner fountain west of this sector.
  const fx = -8.6137146, fz = 191.2444779;
  cylinder('stone', fx, .37, fz, 1.45, 1.65, .5, 20);
  cylinder('water', fx, .64, fz, 1.28, 1.28, .035, 20);
  cylinder('stone', fx, 1.02, fz, .18, .28, 1.1, 10);
  cylinder('water', fx, 1.62, fz, .065, .1, .28, 8);
  unregister.push(engine.addBlocker((x, z) => (x-fx)**2 + (z-fz)**2 < 1.65**2));

  // One draw per palette, plus inverted-hull outlines only for large architectural masses.
  for (const [key, geos] of batches) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    merged.computeBoundingSphere(); resources.add(merged);
    const mesh = new THREE.Mesh(merged, material(key)); mesh.name = `huberplatz-${key}`;
    mesh.receiveShadow = true; mesh.castShadow = false;
    if (['gold','sand','rose','sage','brick'].includes(key)) {
      engine.outline(mesh, .045);
      for (const c of mesh.children) { resources.add(c.geometry); resources.add(c.material); }
    }
    group.add(mesh);
  }
  group.traverse(obj => { if (obj.isMesh) stats.meshes++; });
  stats.drawCalls = stats.meshes;
  group.userData.stats = stats;
  group.userData.attribution = '© OpenStreetMap contributors, ODbL';
  group.userData.deferredFeatures = 'Real Gärtner fountain and U-Bahn entrance B fall west of z=118; see docs/blocks/huberplatz.md.';
  scene.add(group);
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const off of unregister) if (typeof off === 'function') off();
      group.removeFromParent();
      for (const resource of resources) resource.dispose();
      for (const mat of mats.values()) mat.dispose();
      // Shared toon gradient textures belong to the engine, not this block.
    },
  };
}
