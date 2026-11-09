import test from 'node:test';
import assert from 'node:assert/strict';
import { SPAWN } from '../src/date_route.mjs';
import {
  catmullRom, sampleSpline, buildArcLengthTable, arcParameter, distance3,
  compilePath, samplePath, ease, easeInOut, defaultCameraPose, createSequence, SEQUENCES,
} from '../src/date_cinematic_paths.mjs';

const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≈ ${b}`);
const close3 = (a, b, tolerance) => a.forEach((v, i) => close(v, b[i], tolerance));

test('Catmull-Rom interpolates endpoints and is continuous through every knot', () => {
  const points = [[0, 0, 0], [4, 1, 6], [8, 3, 2], [11, 2, 9], [20, 5, 12]];
  close3(catmullRom(...points.slice(0, 4), 0), points[1]);
  close3(catmullRom(...points.slice(0, 4), 1), points[2]);
  for (let i = 1; i < points.length - 1; i++) {
    close3(sampleSpline(points, i - 1, 1), sampleSpline(points, i, 0));
    const epsilon = 1e-5;
    const before = sampleSpline(points, i - 1, 1 - epsilon);
    const after = sampleSpline(points, i, epsilon);
    const left = points[i].map((v, j) => (v - before[j]) / epsilon);
    const right = points[i].map((v, j) => (after[j] - v) / epsilon);
    close3(left, right, 0.0005);
  }
});

test('arc-length reparametrization holds speed along an uneven curved segment', () => {
  const points = [[-70, 10, 0], [0, 0, 0], [10, 5, 15], [11, 6, 80]];
  const table = buildArcLengthTable(points, 1, 1024);
  const distances = [];
  const rawDistances = [];
  for (let i = 0; i < 40; i++) {
    distances.push(distance3(sampleSpline(points, 1, arcParameter(table, i / 40)),
      sampleSpline(points, 1, arcParameter(table, (i + 1) / 40))));
    rawDistances.push(distance3(sampleSpline(points, 1, i / 40), sampleSpline(points, 1, (i + 1) / 40)));
  }
  assert.ok(Math.max(...distances) / Math.min(...distances) < 1.03);
  assert.ok(Math.max(...rawDistances) / Math.min(...rawDistances) > 2);
  close(arcParameter(table, 0), 0);
  close(arcParameter(table, 1), 1);
});

test('stationary paths and clamped samples remain finite', () => {
  const positions = [[2, 3, 4], [2, 3, 4], [2, 3, 4]];
  const table = buildArcLengthTable(positions, 0);
  close(table.total, 0);
  close(arcParameter(table, 0.5), 0.5);
  const path = compilePath([
    { time: 0, position: positions[0], target: [0, 1, 0], fov: 45 },
    { time: 2, position: positions[1], target: [0, 2, 0], fov: 60 },
  ]);
  close3(samplePath(path, -5).position, positions[0]);
  close3(samplePath(path, 20).position, positions[1]);
  close(samplePath(path, 1).fov, 52.5);
});

test('easing clamps endpoints, is monotonic, and eases in and out at rest', () => {
  for (const kind of ['linear', 'in', 'out', 'smooth']) {
    close(ease(-1, kind), 0);
    close(ease(2, kind), 1);
    for (let i = 1; i <= 100; i++) assert.ok(ease(i / 100, kind) >= ease((i - 1) / 100, kind));
  }
  close(easeInOut(0.5), 0.5);
  assert.ok(easeInOut(0.001) / 0.001 < 0.0001);
  assert.ok((1 - easeInOut(0.999)) / 0.001 < 0.0001);
});

test('all sequence durations include their lead-in and seamless return', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SEQUENCES).map(([name, spec]) => [name, spec.duration])),
    { intro: 14, ending: 12, fountain: 5 });
  for (const name of Object.keys(SEQUENCES)) {
    const sequence = createSequence(name);
    close(sequence.path.duration + sequence.leadIn + sequence.handoff, sequence.duration);
    for (let time = 0; time <= sequence.path.duration; time += 0.01) {
      const pose = samplePath(sequence.path, time);
      assert.ok([...pose.position, ...pose.target, pose.fov].every(Number.isFinite));
      assert.ok(pose.position[1] > 0, `${name} stays above the ground`);
      if (name === 'intro') assert.ok(pose.position[2] > 8, 'intro stays outside the facade/columns');
    }
  }
});

test('intro terminates at the live player default camera, including yaw and height', () => {
  const player = [8, 2, 63], yaw = 1.2;
  const sequence = createSequence('intro', { player, yaw, fov: 61 });
  const pose = samplePath(sequence.path, sequence.path.duration);
  const home = defaultCameraPose(player, yaw);
  close3(pose.position, home.position);
  close3(pose.target, [8, 3.6, 63]);
  close(pose.fov, 61);
  const spawn = defaultCameraPose();
  close(spawn.position[0], SPAWN.x + Math.sin(SPAWN.yaw) * Math.cos(.28) * 14);
  close(spawn.position[1], Math.sin(0.28) * 14 + 1.2);
  close(spawn.position[2], SPAWN.z + Math.cos(SPAWN.yaw) * Math.cos(.28) * 14);
});

test('ending starts around the couple midpoint and rises to a wide view', () => {
  const sequence = createSequence('ending', { player: [2, 0, 75], companion: [6, 0, 75] });
  const frames = sequence.path.frames;
  close3(frames[0].target, [4, 1.35, 75]);
  close(Math.hypot(frames[0].position[0] - 4, frames[0].position[2] - 75), 6);
  close(Math.hypot(frames[2].position[0] - 4, frames[2].position[2] - 75), 10);
  assert.ok(frames.at(-1).position[1] > frames[0].position[1] + 15);
});

test('fountain push-in keeps the camera outside the basin from every approach', () => {
  for (const player of [[35, 0, 40], [44, 0, 48], [35, 0, 57], [26, 0, 48]]) {
    const { path } = createSequence('fountain', { player });
    for (let t = 0; t <= path.duration; t += 0.05) {
      const { position } = samplePath(path, t);
      assert.ok(Math.hypot(position[0] - 35, position[2] - 48) >= 7.99);
    }
  }
});

test('invalid sequences and malformed keyframes fail explicitly', () => {
  assert.throws(() => createSequence('missing'), RangeError);
  assert.throws(() => compilePath([]), RangeError);
  assert.throws(() => compilePath([
    { time: 1, position: [0, 0, 0], target: [0, 0, 1] },
    { time: 1, position: [0, 0, 0], target: [0, 0, 1] },
  ]), RangeError);
});
