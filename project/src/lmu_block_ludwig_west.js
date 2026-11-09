// Ludwigstraße west / Maxvorstadt. Geometry: © OpenStreetMap contributors, ODbL.
// Synchronous, self-contained block: no network request, animation, or shared-scene mutation.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DATA } from './lmu_block_ludwig_west_data.mjs';

import { BUILD_LIMITS, footprintBlocked } from './lmu_block_ludwig_west_geometry.mjs';
export { SECTOR, BUILD_LIMITS, FOOTPRINTS, footprintBlocked, LANDMARKS } from './lmu_block_ludwig_west_geometry.mjs';

// Sutherland–Hodgman clipping against a linear inequality a*x + b*z + c >= 0.
function halfPlane(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c;
    if (dp >= -1e-8) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
function clipToSector(poly) {
  const l = BUILD_LIMITS;
  for (const [a, b, c] of [[1, 0, -l.minX], [-1, 0, l.maxX], [0, 1, -l.minZ], [0, -1, l.maxZ]]) {
    poly = halfPlane(poly, a, b, c);
    if (poly.length < 3) return [];
  }
  return poly;
}
function signedArea(ring) {
  return ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
}

export function createBlock(engine) {
  const { THREE } = engine;
  const group = new THREE.Group();
  group.name = 'ludwig_west';
  const buckets = new Map(), resources = new Set();
  const geometryCounts = { buildings: DATA.buildings.length, windows: 0, shops: 0, trees: 0, lamps: 0, benches: 0 };
  const material = (name, color, opts = {}) => {
    const m = engine.toon(color, 4, opts); resources.add(m);
    buckets.set(name, { pieces: [], material: m }); return name;
  };
  material('masonry', 0xffffff, { vertexColors: true });
  material('roofs', 0xffffff, { vertexColors: true, side: THREE.DoubleSide });
  material('stonework', 0xb9ac92);
  material('frames', 0x514338);
  material('glass', 0x496775, { emissive: 0x152734, emissiveIntensity: 0.12 });
  material('shopglass', 0x324a51, { emissive: 0x243b35, emissiveIntensity: 0.18 });
  material('paving', 0xa29d90);
  material('sidewalks', 0xb5aea0);
  material('side_roads', 0x4c5156);
  material('ludwig_road', 0x4c5156);
  material('markings', 0xcac1a5);
  material('metal', 0x3b4347);
  material('timber', 0x805b3c);
  material('leaves', 0x6f8d4e);
  material('leaves_light', 0x89975a);
  material('awnings', 0xffffff, { vertexColors: true });
  material('lamp_glass', 0xe4cb8b, { emissive: 0x826134, emissiveIntensity: 0.25 });
  // A single locally drawn atlas: no downloaded textures or font dependency.
  const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 512;
  const ctx = atlas.getContext('2d');
  const signText = ['PHILOLOGICUM', 'LUDWIGSTRASSE 27', 'VERWALTUNGSGERICHTSHOF', 'FREMDSPRACHENINSTITUT', 'KAFFEE', 'BUCHHANDLUNG', 'THERESIENSTRASSE', 'SCHELLINGSTRASSE'];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  signText.forEach((text, i) => {
    ctx.fillStyle = i < 4 || i > 5 ? '#334657' : '#576c5d'; ctx.fillRect(0, i * 64, 1024, 64);
    ctx.strokeStyle = '#c9bea0'; ctx.lineWidth = 2; ctx.strokeRect(5, i * 64 + 5, 1014, 54);
    ctx.fillStyle = '#eee1bc'; ctx.font = '500 34px Georgia, serif'; ctx.fillText(text, 512, i * 64 + 33, 950);
  });
  const atlasTexture = new THREE.CanvasTexture(atlas); atlasTexture.colorSpace = THREE.SRGBColorSpace; resources.add(atlasTexture);
  material('signs', 0xffffff, { map: atlasTexture });
  function sign(row, x, y, z, nx, nz, width, height = 0.65) {
    if (!inDetailBounds(x, z, width / 2 + 0.3)) return;
    const geo = new THREE.PlaneGeometry(width, height), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (7 - row + uv.getY(i)) / 8);
    geo.rotateY(Math.atan2(nx, nz)); geo.translate(x, y, z); add('signs', geo);
  }
  function add(name, geo, color) {
    if (geo.index) { const nonindexed = geo.toNonIndexed(); geo.dispose(); geo = nonindexed; }
    if (name !== 'signs') geo.deleteAttribute('uv');
    geo.deleteAttribute('uv1');
    if (color !== undefined) {
      const c = new THREE.Color(color), n = geo.getAttribute('position').count;
      const rgb = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { rgb[i * 3] = c.r; rgb[i * 3 + 1] = c.g; rgb[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    }
    buckets.get(name).pieces.push(geo);
  }
  function box(name, x, y, z, w, h, d, yaw = 0, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.rotateY(yaw); geo.translate(x, y, z); add(name, geo, color);
  }
  function shapeOf(ring, holes = [], flipZ = false) {
    const map = r => r.map(([x, z]) => new THREE.Vector2(x, flipZ ? -z : z));
    const shape = new THREE.Shape(map(ring));
    shape.holes = holes.map(h => new THREE.Path(map(h)));
    return shape;
  }
  function flat(name, polygon, y, color) {
    const p = clipToSector(polygon);
    if (p.length < 3 || Math.abs(signedArea(p)) < 0.01) return;
    const geo = new THREE.ShapeGeometry(shapeOf(p, [], true));
    geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); add(name, geo, color);
  }
  function stroke(name, p, q, width, y) {
    const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    if (len < 0.03) return;
    const nx = -dz / len * width / 2, nz = dx / len * width / 2;
    flat(name, [[p[0] + nx, p[1] + nz], [q[0] + nx, q[1] + nz], [q[0] - nx, q[1] - nz], [p[0] - nx, p[1] - nz]], y);
  }
  function inDetailBounds(x, z, radius = 0.5) {
    const l = BUILD_LIMITS;
    return x > l.minX + radius && x < l.maxX - radius && z > l.minZ + radius && z < l.maxZ - radius;
  }
  function streetDistance(x, z, kinds) {
    let best = Infinity;
    for (const r of DATA.roads) {
      if (kinds && !kinds.includes(r.kind)) continue;
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
      }
    }
    return best;
  }

  flat('paving', [[-480, -250], [-150.2, -250], [-150.2, 54.8], [-480, 54.8]], 0.015);
  // Real street centerlines. Main-road batch is named separately for the street integrator.
  for (const road of DATA.roads) {
    const car = ['secondary', 'residential'].includes(road.kind);
    const width = car ? Math.max(6, road.width) : road.width;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      if (car) stroke('sidewalks', a, b, width + 5.4, 0.045);
      stroke(road.kind === 'secondary' ? 'ludwig_road' : car || road.kind === 'service' ? 'side_roads' : 'sidewalks', a, b, width, car ? 0.065 : 0.055);
      if (road.kind === 'secondary') {
        const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        for (let s = 4; s < len - 3; s += 12) {
          const t = s / len, u = Math.min(s + 4, len) / len;
          stroke('markings', [a[0] + dx * t, a[1] + dz * t], [a[0] + dx * u, a[1] + dz * u], 0.18, 0.076);
        }
      }
    }
  }

  // Roof planes use the longest footprint edge as their axis. Intersecting each
  // triangulated footprint face with the roof planes preserves concavities/courtyards.
  function roof(building, color) {
    const { ring, holes, height, roof: type } = building;
    let dx = 1, dz = 0, longest = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (n > longest) { longest = n; dx = (b[0] - a[0]) / n; dz = (b[1] - a[1]) / n; }
    }
    const u = ring.map(p => p[0] * dx + p[1] * dz), v = ring.map(p => -p[0] * dz + p[1] * dx);
    const u0 = Math.min(...u), u1 = Math.max(...u), v0 = Math.min(...v), v1 = Math.max(...v);
    const rise = type === 'flat' ? 0.2 : Math.min(5.6, (v1 - v0) * 0.24);
    const slope = 2 * rise / Math.max(v1 - v0, 1);
    const planes = type === 'flat' ? [[0, 0, rise]] : [
      [-dz * slope, dx * slope, -v0 * slope], [dz * slope, -dx * slope, v1 * slope],
    ];
    if (type === 'hipped') planes.push([dx * slope, dz * slope, -u0 * slope], [-dx * slope, -dz * slope, u1 * slope]);
    const vectors = r => r.map(p => new THREE.Vector2(...p));
    const indices = THREE.ShapeUtils.triangulateShape(vectors(ring), holes.map(vectors));
    const all = [...ring, ...holes.flat()], pos = [];
    const hAt = p => height + Math.max(0, Math.min(...planes.map(f => f[0] * p[0] + f[1] * p[1] + f[2])));
    for (const ids of indices) for (const plane of planes) {
      let polygon = ids.map(i => all[i]);
      for (const other of planes) {
        if (plane === other) continue;
        polygon = halfPlane(polygon, other[0] - plane[0], other[1] - plane[1], other[2] - plane[2]);
        if (polygon.length < 3) break;
      }
      for (let i = 1; i < polygon.length - 1; i++) {
        const tri = [polygon[0], polygon[i], polygon[i + 1]];
        if (signedArea(tri) > 0) tri.reverse(); // upward-facing in X/Z
        for (const p of tri) pos.push(p[0], hAt(p), p[1]);
      }
    }
    // Close gable ends and clipped roof edges down to the wall cornice.
    for (const r of [ring, ...holes]) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      const ah = hAt(a), bh = hAt(b);
      pos.push(a[0], height, a[1], b[0], bh, b[1], a[0], ah, a[1], a[0], height, a[1], b[0], height, b[1], b[0], bh, b[1]);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); add('roofs', geo, color);
  }

  const palette = [0xb8a28a, 0xb6b2a0, 0xbdad90, 0xab9c91, 0xc2b39c, 0xafa99c, 0xbc9e87, 0xa7aca3];
  function facadeEdge(building, a, b, outward) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    if (len < 3) return;
    const tx = dx / len, tz = dz / len, nx = outward * tz, nz = -outward * tx;
    const yaw = Math.atan2(-tz, tx), midX = (a[0] + b[0]) / 2, midZ = (a[1] + b[1]) / 2;
    if (!inDetailBounds(midX, midZ, 0.6)) return;
    if (footprintBlocked(midX + nx * 0.9, midZ + nz * 0.9)) return;
    const historic = ['philologicum', 'court', 'lmu27'].includes(building.style);
    const institutional = historic || ['school', 'insurance', 'schelling'].includes(building.style);
    const floorN = Math.max(1, Math.min(8, Math.round(building.levels))), floorH = building.height / floorN;
    const bays = Math.max(1, Math.floor(len / (historic ? 4.4 : 3.7))), pitch = len / bays;
    // Long moulded stringcourses, scaled without any silhouette outside the sector.
    if (Math.min(a[0], b[0]) > BUILD_LIMITS.minX + 0.6 && Math.max(a[0], b[0]) < BUILD_LIMITS.maxX - 0.6 && Math.min(a[1], b[1]) > BUILD_LIMITS.minZ + 0.6 && Math.max(a[1], b[1]) < BUILD_LIMITS.maxZ - 0.6) {
      for (const y of [0.65, floorH, building.height - 0.25]) box('stonework', midX, y, midZ, len, y < 1 ? 0.38 : 0.22, 0.28, yaw);
    }
    for (let bay = 0; bay < bays; bay++) {
      const d = (bay + 0.5) * pitch, x = a[0] + tx * d, z = a[1] + tz * d;
      if (!inDetailBounds(x, z, 1.4) || footprintBlocked(x + nx * 0.8, z + nz * 0.8)) continue;
      const w = Math.min(historic ? 1.7 : 1.5, pitch * 0.52);
      const streetSide = streetDistance(x + nx, z + nz, ['residential']) < 15;
      for (let floor = 0; floor < floorN; floor++) {
        const shop = floor === 0 && !institutional && building.height > 10 && streetSide && bay % 3 !== 2;
        const h = shop ? Math.min(2.8, floorH * 0.77) : Math.min(historic ? 2.75 : 2.15, floorH * 0.64);
        const y = floor * floorH + (shop ? 0.4 : 0.95);
        const width = shop ? Math.min(2.7, pitch * 0.77) : w;
        const arched = historic && floor < 2;
        // All window frames/glazing are merged by material, not a draw call per window.
        if (arched) {
          const arch = (ww, hh) => {
            const s = new THREE.Shape(), r = ww / 2;
            s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, hh - r); s.absarc(0, hh - r, r, 0, Math.PI, false); s.closePath();
            return new THREE.ShapeGeometry(s, 8);
          };
          for (const [name, ww, hh, off] of [['stonework', width + 0.34, h + 0.18, 0.065], ['frames', width, h, 0.08], ['glass', width - 0.22, h - 0.19, 0.095]]) {
            const geo = arch(ww, hh); geo.rotateY(yaw + (outward > 0 ? Math.PI : 0));
            // The box yaw aligns local X to tangent; local +Z is outward only for CCW rings.
            geo.translate(x + nx * off, y, z + nz * off); add(name, geo);
          }
        } else {
          box('stonework', x, y + h / 2, z, width + 0.30, h + 0.26, 0.13, yaw);
          box('frames', x + nx * 0.075, y + h / 2, z + nz * 0.075, width, h, 0.10, yaw);
          box(shop ? 'shopglass' : 'glass', x + nx * 0.14, y + h / 2, z + nz * 0.14, width - 0.18, h - 0.19, 0.06, yaw);
        }
        box('frames', x + nx * 0.19, y + h * 0.5, z + nz * 0.19, 0.075, h - 0.14, 0.07, yaw);
        box('frames', x + nx * 0.19, y + h * 0.50, z + nz * 0.19, width - 0.12, 0.08, 0.07, yaw);
        box('stonework', x + nx * 0.13, y - 0.08, z + nz * 0.13, width + 0.37, 0.15, 0.45, yaw);
        geometryCounts.windows++;
        if (shop) {
          const color = [0x708873, 0xad715f, 0xc0a36e][bay % 3];
          box('awnings', x + nx * 0.72, y + h + 0.15, z + nz * 0.72, width + 0.35, 0.13, 1.35, yaw, color);
          box('awnings', x + nx * 1.35, y + h - 0.02, z + nz * 1.35, width + 0.35, 0.32, 0.12, yaw, color);
          if (geometryCounts.shops % 7 === 0) sign(geometryCounts.shops % 2 ? 4 : 5, x + nx * 0.23, y + h + 0.65, z + nz * 0.23, nx, nz, width + 0.25, 0.42);
          geometryCounts.shops++;
        }
      }
    }
  }
  for (let i = 0; i < DATA.buildings.length; i++) {
    const b = DATA.buildings[i];
    const facadeColor = b.style === 'school' ? 0xa17c66 : ['philologicum', 'court', 'lmu27'].includes(b.style) ? 0xc4b89d : b.style === 'insurance' ? 0xb5b0a0 : palette[i % palette.length];
    const geo = new THREE.ExtrudeGeometry(shapeOf(b.ring, b.holes, true), { depth: b.height, bevelEnabled: false, steps: 1, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, 0.08, 0); add('masonry', geo, facadeColor);
    roof(b, b.roof === 'flat' ? 0x777975 : b.style === 'philologicum' ? 0x985b43 : 0x796057);
    const outward = signedArea(b.ring) > 0 ? 1 : -1;
    let front = null;
    for (let edge = 0; edge < b.ring.length; edge++) {
      const a = b.ring[edge], q = b.ring[(edge + 1) % b.ring.length];
      facadeEdge(b, a, q, outward);
      const dx = q[0] - a[0], dz = q[1] - a[1], len = Math.hypot(dx, dz);
      if (len > 12) {
        const nx = outward * dz / len, nz = -outward * dx / len;
        if (nz > 0.7 && (!front || len > front.len)) front = { x: (a[0] + q[0]) / 2, z: (a[1] + q[1]) / 2, nx, nz, len };
      }
    }
    for (const hole of b.holes) {
      const intoCourtyard = signedArea(hole) > 0 ? -1 : 1;
      for (let edge = 0; edge < hole.length; edge++) facadeEdge(b, hole[edge], hole[(edge + 1) % hole.length], intoCourtyard);
    }
    const label = { philologicum: 0, lmu27: 1, court: 2, school: 3 }[b.style];
    if (label !== undefined && front) {
      sign(label, front.x + front.nx * 0.25, 4.15, front.z + front.nz * 0.25, front.nx, front.nz, Math.min(front.len * 0.52, label === 2 ? 12 : 8.5));
    }
  }

  // OSM trees, with modest crown size: never grow across another agent's boundary.
  for (const [i, tree] of DATA.trees.entries()) {
    const [x, z] = tree.point;
    if (footprintBlocked(x, z) || !inDetailBounds(x, z, 3.4)) continue;
    const trunk = new THREE.CylinderGeometry(0.19, 0.26, 4.3, 7); trunk.translate(x, 2.15, z); add('timber', trunk);
    const crown = new THREE.IcosahedronGeometry(2.8, 1); crown.scale(1, 1.18, 1); crown.translate(x, 5.4, z); add('leaves', crown);
    const crown2 = new THREE.IcosahedronGeometry(2.0, 1); crown2.translate(x + (i % 2 ? 0.6 : -0.6), 6.5, z); add('leaves_light', crown2);
    geometryCounts.trees++;
  }
  for (const f of DATA.furniture) {
    const [x, z] = f.point;
    if (!inDetailBounds(x, z, 1.6) || footprintBlocked(x, z)) continue;
    if (f.kind === 'bench') {
      box('timber', x, 0.55, z, 1.7, 0.13, 0.5); box('timber', x, 0.96, z + 0.2, 1.7, 0.60, 0.11);
      for (const dx of [-0.58, 0.58]) box('metal', x + dx, 0.28, z, 0.08, 0.5, 0.40);
      geometryCounts.benches++;
    } else {
      for (const dz of [-0.75, 0, 0.75]) {
        for (const dx of [-0.3, 0.3]) box('metal', x + dx, 0.42, z + dz, 0.055, 0.84, 0.055);
        box('metal', x, 0.82, z + dz, 0.65, 0.055, 0.055);
      }
    }
  }
  // Street lighting follows the real western kerb, kept away from entrances.
  for (let x = -180; x >= -455; x -= 36) {
    const z = 0.314 * x + 59;
    if (footprintBlocked(x, z) || !inDetailBounds(x, z, 1)) continue;
    box('metal', x, 3.2, z, 0.12, 6.4, 0.12);
    box('metal', x, 0.3, z, 0.35, 0.6, 0.35);
    box('metal', x, 6.45, z, 0.75, 0.16, 0.75);
    box('lamp_glass', x, 6.12, z, 0.42, 0.48, 0.42);
    geometryCounts.lamps++;
  }
  // Assemble once: all repeated windows, cornices and trees are merged by material.
  for (const [name, bucket] of buckets) {
    if (!bucket.pieces.length) continue;
    const geo = mergeGeometries(bucket.pieces, false);
    for (const piece of bucket.pieces) piece.dispose();
    bucket.pieces.length = 0;
    resources.add(geo);
    const mesh = new THREE.Mesh(geo, bucket.material);
    mesh.name = `ludwig_west_${name}`; mesh.receiveShadow = true;
    if (name === 'masonry') {
      engine.outline(mesh, 0.055);
      for (const child of mesh.children) if (child.material) resources.add(child.material);
    }
    group.add(mesh);
  }
  const unregister = engine.addBlocker(footprintBlocked);
  group.userData = { ...geometryCounts, source: '© OpenStreetMap contributors, ODbL', drawCalls: group.children.length + 1 };
  engine.scene.add(group);
  let disposed = false;
  return { group, dispose() {
    if (disposed) return; disposed = true;
    unregister(); group.removeFromParent();
    for (const r of resources) r.dispose();
  } };
}
