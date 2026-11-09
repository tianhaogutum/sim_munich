// Pure survey/geometry contract, usable by tests and the traffic integrator without THREE.
// +X north / +Z east; source points retain OSM way direction (important for lanes:forward).
import {
  ROAD_WAYS, CYCLE_WAYS, SIDEWALK_WAYS, CROSS_WAYS, TREE_NODES,
  MAPPED_LAMPS, RACK_NODES, BUS_PLATFORMS, SUBWAY_ENTRANCES, CONTEXT_BUILDINGS,
} from './lmu_block_ludwigstrasse_data.mjs';
import { pointInPolygon } from './date_geo.mjs';

export const SECTORS = [
  { minX: -480, maxX: -150, minOffset: -29, maxOffset: 29 },
  { minX: 150, maxX: 480, minOffset: -38, maxOffset: 38 },
];
export const LANE_WIDTH = 3.1; // No motor-road width tag: estimated from 3.1 m urban lanes.
export const axisZ = x => 77 + .315 * x;
export function inSector(x, z, margin = 0) {
  return SECTORS.some(s => x >= s.minX + margin && x <= s.maxX - margin &&
    z - axisZ(x) >= s.minOffset + margin && z - axisZ(x) <= s.maxOffset - margin);
}
export function clipHalfPlane(ring, distance) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const da = distance(a), db = distance(b), ia = da >= -1e-8, ib = db >= -1e-8;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
}
// Difference of a convex subject and convex cutter. Used on triangulated neighbouring
// building rings so paving never paints over another block's exact OSM footprint.
export function subtractConvex(subject, cutter) {
  let area = 0;
  for (let i = 0; i < cutter.length; i++) {
    const a = cutter[i], b = cutter[(i + 1) % cutter.length]; area += a.x * b.z - b.x * a.z;
  }
  const sign = Math.sign(area) || 1, outside = [];
  let inside = subject;
  for (let i = 0; i < cutter.length && inside.length >= 3; i++) {
    const a = cutter[i], b = cutter[(i + 1) % cutter.length];
    const distance = p => sign * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
    const piece = clipHalfPlane(inside, p => -distance(p));
    if (piece.length >= 3) outside.push(piece);
    inside = clipHalfPlane(inside, distance);
  }
  return outside;
}
export function clipToSectors(ring) {
  return SECTORS.map(s => [
    p => p.x - s.minX, p => s.maxX - p.x,
    p => p.z - axisZ(p.x) - s.minOffset, p => s.maxOffset - (p.z - axisZ(p.x)),
  ].reduce((r, plane) => clipHalfPlane(r, plane), ring)).filter(r => r.length >= 3);
}
export function offsetPath(points, offset) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    return { x: p.x - dz / len * offset, z: p.z + dx / len * offset };
  });
}
export function ribbon(points, width, offset = 0) {
  return [...offsetPath(points, offset + width / 2), ...offsetPath(points, offset - width / 2).reverse()];
}
// Extend only endpoints created by sector clipping, so the final polygon meets x=±150/480
// across its full width instead of leaving a diagonal end-cap notch. Never extend traffic paths.
export function surfacePath(points) {
  const out = points.map(p => ({ ...p }));
  for (const [i, j] of [[0, 1], [out.length - 1, out.length - 2]]) {
    const p = points[i], q = points[j];
    if (![150, 480].some(x => Math.abs(Math.abs(p.x) - x) < 1e-5)) continue;
    const dx = p.x - q.x, dz = p.z - q.z, length = Math.hypot(dx, dz) || 1;
    out[i] = { x: p.x + dx / length * 25, z: p.z + dz / length * 25 };
  }
  return out;
}
export function clipPath(points) {
  const paths = [];
  for (const s of SECTORS) {
    let current = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      let lo = 0, hi = 1;
      for (const d of [p => p.x - s.minX, p => s.maxX - p.x,
        p => p.z - axisZ(p.x) - s.minOffset, p => s.maxOffset - (p.z - axisZ(p.x))]) {
        const da = d(a), db = d(b);
        if (da < 0 && db < 0) { hi = -1; break; }
        if (da < 0) lo = Math.max(lo, da / (da - db));
        if (db < 0) hi = Math.min(hi, da / (da - db));
      }
      if (lo > hi) { if (current.length > 1) paths.push(current); current = []; continue; }
      const p = t => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      const first = p(lo), last = p(hi);
      if (current.length && Math.hypot(current.at(-1).x - first.x, current.at(-1).z - first.z) > .001) {
        if (current.length > 1) paths.push(current); current = [];
      }
      if (!current.length) current.push(first);
      current.push(last);
    }
    if (current.length > 1) paths.push(current);
  }
  return paths;
}
export function samplePath(points, spacing, phase = 0) {
  const result = []; let walked = 0, next = phase;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (!len) continue;
    while (next < walked + len) {
      const t = (next - walked) / len;
      if (t >= 0) result.push({ x: a.x + dx * t, z: a.z + dz * t, dx: dx / len, dz: dz / len });
      next += spacing;
    }
    walked += len;
  }
  return result;
}
export function centroid(points) {
  const ring = points.length > 1 && Math.hypot(points[0].x - points.at(-1).x, points[0].z - points.at(-1).z) < .001 ? points.slice(0, -1) : points;
  return { x: ring.reduce((v, p) => v + p.x, 0) / ring.length, z: ring.reduce((v, p) => v + p.z, 0) / ring.length };
}
export function rectangle(x, z, width, depth, yaw = 0) {
  return [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]].map(([a, b]) =>
    ({ x: x + a * Math.cos(yaw) + b * Math.sin(yaw), z: z - a * Math.sin(yaw) + b * Math.cos(yaw) }));
}

export const ROADS = ROAD_WAYS.flatMap(w => clipPath(w.points).map((points, i) => {
  const count = Number(w.tags.lanes || 2);
  return { ...w, id: `${w.id}-${i}`, osmWayId: w.id, points, count, width: count * LANE_WIDTH,
    oneWay: w.tags.oneway === 'yes',
    parkingRight: w.tags['parking:right'] === 'yes' ? 2.1 : 0,
    parkingLeft: w.tags['parking:left:orientation'] === 'parallel' ? 2.1 : 0 };
}));
export const CYCLE_PATHS = CYCLE_WAYS.flatMap(w => clipPath(w.points).map((points, i) => ({ ...w,
  id: `${w.id}-${i}`, points, width: Number(w.tags['cycleway:width'] || w.tags.width || 2) })));
export const WALK_PATHS = SIDEWALK_WAYS.flatMap(w => clipPath(w.points).map(points => ({ ...w, points, width: 4.2 })));
export const CROSS_STREETS = CROSS_WAYS.flatMap(w => clipPath(w.points).map(points => ({ ...w, points, width: Number(w.tags.lanes || 2) * 3 })));

export const LANES = [
  ...ROADS.flatMap(w => Array.from({ length: w.count }, (_, lane) => {
    const forwardCount = w.oneWay ? w.count : Number(w.tags['lanes:forward'] || Math.ceil(w.count / 2));
    const forward = lane >= w.count - forwardCount;
    // In this north/east XZ frame, the positive offset is the source direction's RIGHT.
    // The forward lanes belong on that side; reverse lanes use the opposite half.
    let points = offsetPath(w.points, (lane + .5 - w.count / 2) * LANE_WIDTH);
    if (!forward) points.reverse();
    return clipPath(points).map((part, i) => ({ id: `motor-${w.id}-${lane}-${i}`, osmWayId: w.osmWayId,
      mode: 'motor', vehicleTypes: ['car', 'bus'], direction: part.at(-1).x > part[0].x ? 'northbound' : 'southbound',
      width: LANE_WIDTH, speedLimitKmh: Number(w.tags.maxspeed || 50), points: part }));
  }).flat()),
  ...CYCLE_PATHS.flatMap(w => {
    const make = (points, suffix = '') => ({ id: `cycle-${w.id}${suffix}`, osmWayId: Number(w.id.split('-')[0]), mode: 'cycle',
      vehicleTypes: ['bicycle'], direction: points.at(-1).x > points[0].x ? 'northbound' : 'southbound', width: w.width,
      speedLimitKmh: 20, points });
    return w.tags.oneway === 'no' ? [make(offsetPath(w.points, -.4)), make(offsetPath(w.points, .4).reverse(), '-reverse')] : [make(w.points)];
  }),
];
// These segments intentionally stop at ±150. Never connect the core gap automatically.
for (const lane of LANES) {
  const end = lane.points.at(-1);
  lane.next = LANES.filter(other => other !== lane && other.mode === lane.mode && other.direction === lane.direction &&
    Math.hypot(end.x - other.points[0].x, end.z - other.points[0].z) < 2.2).map(other => other.id);
}

export const TREES = TREE_NODES.filter(p => inSector(p.x, p.z, 3));
export const LAMPS = MAPPED_LAMPS.filter(p => inSector(p.x, p.z, 2)).map(p => ({ ...p, source: 'osm' }));
// Lamp mapping is incomplete north of the gate. The added rhythm is explicitly estimated, never used for trees.
for (const x of [278, 316, 354, 398, 438, 473]) {
  for (const side of [-1, 1]) {
    const z = axisZ(x) + side * 13.8;
    if (LAMPS.every(p => Math.hypot(p.x - x, p.z - z) > 16)) LAMPS.push({ id: `estimated-${x}-${side}`, x, z, source: 'estimated' });
  }
}
export const RACKS = RACK_NODES.filter(p => inSector(p.x, p.z, 5)).map(p => ({ ...p,
  stands: Math.min(16, Math.ceil(Number(p.tags.capacity || 12) / 2)), yaw: -.305 }));
export const STOPS = BUS_PLATFORMS.map(w => ({ ...w, ...centroid(w.points) })).filter(p => inSector(p.x, p.z, 2));
export const ENTRANCES = SUBWAY_ENTRANCES.filter(p => inSector(p.x, p.z, 5)).map(p => ({ ...p, yaw: -.305, width: 4.2, depth: 2.3 }));
export const DEFERRED_ENTRANCES = SUBWAY_ENTRANCES.filter(p => !ENTRANCES.includes(p) && !inSector(p.x, p.z, 5));
export const VISTA_FOOTPRINTS = CONTEXT_BUILDINGS.filter(w => w.tags.name !== 'Siegestor').map(w => ({
  id: w.id, name: w.tags.name, points: w.points, source: `https://www.openstreetmap.org/way/${w.id}`, distantScenery: true,
}));
export const FOOTPRINTS = [
  ...LAMPS.map(p => ({ id: `lamp-${p.id}`, type: 'lamp', points: rectangle(p.x, p.z, .55, .55) })),
  ...TREES.map(p => ({ id: `tree-${p.id}`, type: 'tree', points: rectangle(p.x, p.z, .65, .65) })),
  ...RACKS.flatMap(p => Array.from({ length: p.stands }, (_, i) => {
    const along = (i - (p.stands - 1) / 2) * .75;
    return { id: `rack-${p.id}-${i}`, type: 'rack', points: rectangle(p.x + along * Math.cos(p.yaw), p.z - along * Math.sin(p.yaw), .12, .9, p.yaw) };
  })).filter(f => f.points.every(p => inSector(p.x, p.z, .1))),
  ...ENTRANCES.map(p => ({ id: `entrance-${p.id}`, type: 'subway-opening', points: rectangle(p.x, p.z, p.width, p.depth, p.yaw) })),
];
export function blockContains(x, z) {
  return FOOTPRINTS.some(f => pointInPolygon(x, z, f.points)) || VISTA_FOOTPRINTS.some(f => pointInPolygon(x, z, f.points));
}
export const LANDMARKS = [
  { id: 'ludwigstrasse-schelling', name: '路德维希大街 · 大学站', x: -172, z: 3,
    text: '石板步道通向大学站南入口，远处是胜利门。\n来源：OpenStreetMap；街灯细节参考慕尼黑实景。' },
  { id: 'ludwigstrasse-vista', name: '向南望 · 铁阿提纳教堂', x: -300, z: -30,
    text: '沿大街望向南端，可见铁阿提纳教堂双塔与统帅堂。\n来源：OpenStreetMap、慕尼黑市旅游局；远景为简化轮廓。' },
  { id: 'ludwigstrasse-leopold', name: '胜利门以北 · 利奥波德大街', x: 296, z: 187,
    text: '路德维希大街在胜利门北侧接上利奥波德大街。\n来源：OpenStreetMap；自行车道与人行道沿街并行。' },
];
