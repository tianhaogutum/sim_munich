// Pure camera geometry and shot data. No THREE, DOM, clock, or mutable global state.
import { SPAWN, FOUNTAINS } from './date_route.mjs';

export const clamp01 = value => Math.max(0, Math.min(1, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const distance3 = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

export function easeInOut(t) {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function ease(t, kind = 'smooth') {
  t = clamp01(t);
  if (kind === 'linear') return t;
  if (kind === 'in') return t * t;
  if (kind === 'out') return 1 - (1 - t) ** 2;
  return easeInOut(t);
}

export function catmullRom(p0, p1, p2, p3, t, out = [0, 0, 0]) {
  t = clamp01(t);
  for (let i = 0; i < 3; i++) {
    const v = p1[i];
    out[i] = 0.5 * ((2 * v) + (-p0[i] + p2[i]) * t
      + (2 * p0[i] - 5 * v + 4 * p2[i] - p3[i]) * t * t
      + (-p0[i] + 3 * v - 3 * p2[i] + p3[i]) * t * t * t);
  }
  return out;
}

export function sampleSpline(points, segment, t, out) {
  const last = points.length - 1;
  return catmullRom(points[Math.max(0, Math.min(last, segment - 1))],
    points[Math.max(0, Math.min(last, segment))],
    points[Math.max(0, Math.min(last, segment + 1))],
    points[Math.max(0, Math.min(last, segment + 2))], t, out);
}

export function buildArcLengthTable(points, segment, samples = 160) {
  samples = Math.max(8, Math.floor(samples));
  const lengths = [0];
  let previous = sampleSpline(points, segment, 0);
  for (let i = 1; i <= samples; i++) {
    const next = sampleSpline(points, segment, i / samples);
    lengths.push(lengths[i - 1] + distance3(previous, next));
    previous = next;
  }
  return { lengths, total: lengths[samples], samples };
}

// Convert normalized distance into the original spline parameter by binary search.
export function arcParameter(table, fraction) {
  fraction = clamp01(fraction);
  if (table.total < 1e-9) return fraction;
  const target = fraction * table.total;
  let lo = 0, hi = table.samples;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table.lengths[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = table.lengths[hi] - table.lengths[lo];
  return (lo + (span > 0 ? (target - table.lengths[lo]) / span : 0)) / table.samples;
}

export function compilePath(frames) {
  if (!Array.isArray(frames) || frames.length < 2) throw new RangeError('A camera path needs two keyframes');
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (!Number.isFinite(f.time) || (i > 0 && f.time <= frames[i - 1].time)
      || ![f.position, f.target].every(p => p?.length === 3 && p.every(Number.isFinite))) {
      throw new RangeError('Camera keyframes need increasing times and finite position/target triples');
    }
  }
  const positions = frames.map(f => [...f.position]);
  const targets = frames.map(f => [...f.target]);
  return {
    frames: frames.map(f => ({ ...f, position: [...f.position], target: [...f.target] })),
    positions, targets,
    arcs: frames.slice(1).map((_, i) => buildArcLengthTable(positions, i)),
    duration: frames.at(-1).time,
  };
}

export function samplePath(path, time, fallbackFov = 52, out = { position: [0, 0, 0], target: [0, 0, 0], fov: fallbackFov }) {
  const { frames } = path;
  time = Math.max(frames[0].time, Math.min(path.duration, time));
  let i = 0;
  while (i < frames.length - 2 && time > frames[i + 1].time) i++;
  const a = frames[i], b = frames[i + 1];
  const progress = ease((time - a.time) / (b.time - a.time), a.ease ?? 'linear');
  const u = arcParameter(path.arcs[i], progress);
  sampleSpline(path.positions, i, u, out.position);
  sampleSpline(path.targets, i, u, out.target);
  out.fov = lerp(a.fov ?? fallbackFov, b.fov ?? fallbackFov, progress);
  return out;
}

export function defaultCameraPose(position = [SPAWN.x, 0, SPAWN.z], yaw = SPAWN.yaw, target) {
  return {
    position: [position[0] + Math.sin(yaw) * 14 * Math.cos(0.28),
      position[1] + Math.sin(0.28) * 14 + 1.2,
      position[2] + Math.cos(yaw) * 14 * Math.cos(0.28)],
    target: target ? [...target] : [position[0], position[1] + 1.6, position[2]],
  };
}

export const SEQUENCES = {
  intro: {
    duration: 14, leadIn: 0, handoff: 1,
    captions: [
      { start: 0.65, end: 4.3, title: '慕尼黑 · 路德维希大街', subtitle: 'MÜNCHEN · LUDWIGSTRASSE' },
      { start: 4.8, end: 8.1, title: 'LMU 主楼', subtitle: 'LUDWIG-MAXIMILIANS-UNIVERSITÄT' },
      { start: 10.2, end: 12.95, title: '我们的 LMU', subtitle: 'A LITTLE CHAPTER OF US' },
    ],
  },
  ending: {
    duration: 12, leadIn: 0.8, handoff: 1,
    captions: [{ start: 5.2, end: 10.5, title: '把今天，留在我们之间', subtitle: 'UNTIL OUR NEXT CHAPTER' }],
  },
  fountain: { duration: 5, leadIn: 0.65, handoff: 1, captions: [] },
};

// Resolve dynamic endpoints once at shot start; all inputs/outputs are plain data.
export function createSequence(name, { player = [SPAWN.x, 0, SPAWN.z], yaw = SPAWN.yaw,
  companion = player, fov = 52, basin = FOUNTAINS[1] } = {}) {
  const spec = SEQUENCES[name];
  if (!spec) throw new RangeError(`Unknown cinematic: ${name}`);
  const end = defaultCameraPose(player, yaw);
  const length = spec.duration - spec.leadIn - spec.handoff;
  let frames;
  if (name === 'intro') {
    frames = [
      { time: 0, position: [132, 54, 84], target: [0, 11, 3.4], fov: 49, ease: 'in' },
      { time: 4, position: [50, 25, 42], target: [0, 12, 3.4], fov: 51 },
      { time: 6.8, position: [-10, 8.5, 20], target: [2, 6.8, 3.4], fov: 56 },
      { time: 9.8, position: [basin.x + 14, 8, basin.z + 19], target: [basin.x, 4, basin.z], fov: 51 },
      { time: 11.6, position: [20, 7, 90], target: [5, 2.5, 82], fov: 53, ease: 'out' },
      { time: length, ...end, fov },
    ];
  } else if (name === 'ending') {
    const center = mix3(player, companion, 0.5);
    const at = (time, angle, radius, height, lookHeight, shotFov) => ({ time,
      position: [center[0] + Math.sin(angle) * radius, center[1] + height, center[2] + Math.cos(angle) * radius],
      target: [center[0], center[1] + lookHeight, center[2]], fov: shotFov });
    frames = [
      at(0, yaw - 0.8, 6, 2.1, 1.35, 52),
      at(3.2, yaw + 0.1, 8, 3, 1.4, 52),
      at(6.2, yaw + 0.85, 10, 4, 1.5, 55),
      // Rise behind the couple, revealing the facade beyond them.
      at(length, yaw + 0.95, 35, 22, 5, 59),
    ];
  } else {
    const dx = player[0] - basin.x, dz = player[2] - basin.z;
    const angle = Math.hypot(dx, dz) < 0.01 ? yaw : Math.atan2(dx, dz);
    const center = [basin.x, 3.3, basin.z];
    frames = [
      { time: 0, position: [basin.x + Math.sin(angle) * 12, 6, basin.z + Math.cos(angle) * 12], target: center, fov: 54, ease: 'smooth' },
      { time: length, position: [basin.x + Math.sin(angle) * 8, 4.5, basin.z + Math.cos(angle) * 8], target: center, fov: 49 },
    ];
  }
  return { ...spec, name, path: compilePath(frames) };
}
