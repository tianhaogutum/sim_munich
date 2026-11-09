import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOUNDS, CORE_BOUNDS, FOUNTAINS, POIS, SPAWN, COMPANION, PHOTO_TARGETS, STAGES } from '../src/date_route.mjs';
import { createStory, objectiveFor } from '../src/date_story.mjs';

const source = readFileSync(new URL('../src/anime_main.js', import.meta.url), 'utf8');
const storySource = readFileSync(new URL('../src/date_story.mjs', import.meta.url), 'utf8');
const compact = text => text.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');

// Independent copy, not an eval of production code: changes MUST be reviewed and re-synced.
const solids = [
  { cx: 0, cz: -11, hw: 81, hd: 13 },
  { cx: -112, cz: -26, hw: 52, hd: 52 },
  { cx: 112, cz: -26, hw: 52, hd: 52 },
];
const extraBlockers = [];   // world blocks register precise footprints at runtime; none in this static copy
function blocked(x, z) {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
  if (FOUNTAINS.some(f => Math.hypot(x - f.x, z - f.z) < f.r)) return true;
  if (solids.some(s => Math.abs(x - s.cx) < s.hw && Math.abs(z - s.cz) < s.hd)) return true;
  for (let i = 0; i < extraBlockers.length; i++) if (extraBlockers[i](x, z)) return true;
  return false;
}
// The flood fill below stays inside the original plaza so the 1 m grid remains small.
const inCore = (x, z) => x >= CORE_BOUNDS.minX && x <= CORE_BOUNDS.maxX && z >= CORE_BOUNDS.minZ && z <= CORE_BOUNDS.maxZ;
const syncMessage = 'Engine collision rule changed: review anime_main.js and RE-SYNC the independent copy in tests/route.test.mjs; do not just suppress this guard.';

test('collision copy is in sync with engine dimensions, solids and blocked()', () => {
  assert.match(source, /\bbW\s*:\s*160\s*[,}]/, syncMessage);
  assert.match(source, /\bbDepth\s*:\s*22\s*[,}]/, syncMessage);
  const expectedSolids = `const solids = [
    { cx:0, cz:-(D.bDepth*.5), hw:D.bW*.5+1, hd:D.bDepth*.5+2 },
    { cx:-(D.bW*.5+32), cz:-(D.bDepth+4), hw:52, hd:52 },
    { cx: (D.bW*.5+32), cz:-(D.bDepth+4), hw:52, hd:52 },
  ];`;
  const actualSolids = source.match(/const solids\s*=\s*\[[\s\S]*?\];/)?.[0];
  assert.equal(compact(actualSolids ?? ''), compact(expectedSolids), syncMessage);
  const actualBlocked = source.match(/function blocked\(x,\s*z\)\s*\{[\s\S]*?\n\}/)?.[0];
  assert.equal(compact(actualBlocked ?? ''), compact(blocked.toString()), syncMessage);
});

test('spawn, every POI, companion waiting spot and fountain seat are walkable and bounded', () => {
  const positions = { spawn: SPAWN, ...POIS, waitAt: COMPANION.waitAt, fountainSeat: COMPANION.fountainSeat };
  for (const [name, { x, z }] of Object.entries(positions)) {
    assert.ok(Number.isFinite(x) && Number.isFinite(z), `${name}: finite position`);
    assert.ok(x >= BOUNDS.minX && x <= BOUNDS.maxX && z >= BOUNDS.minZ && z <= BOUNDS.maxZ, `${name}: inside BOUNDS`);
    assert.equal(blocked(x, z), false, `${name} (${x}, ${z}) is blocked`);
  }
});

// Four-connected 1 m flood fill; test edges too, so a segment cannot cross a thin obstacle.
const key = (x, z) => `${x},${z}`;
function clearSegment(ax, az, bx, bz) {
  for (let i = 0; i <= 10; i++) {
    if (blocked(ax + (bx - ax) * i / 10, az + (bz - az) * i / 10)) return false;
  }
  return true;
}
function flood() {
  const sx = Math.round(SPAWN.x), sz = Math.round(SPAWN.z);
  assert.ok(clearSegment(SPAWN.x, SPAWN.z, sx, sz), 'spawn must connect to the 1 m grid');
  const seen = new Set([key(sx, sz)]), queue = [[sx, sz]];
  for (let index = 0; index < queue.length; index++) {
    const [x, z] = queue[index];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (seen.has(k) || !inCore(nx, nz) || !clearSegment(x, z, nx, nz)) continue;
      seen.add(k); queue.push([nx, nz]);
    }
  }
  return { seen, queue };
}
const reachable = flood();
test('every POI is reachable from spawn over a 1 m grid', () => {
  for (const [name, p] of Object.entries(POIS)) {
    const connected = reachable.queue.some(([x, z]) => Math.hypot(x - p.x, z - p.z) <= Math.SQRT2 && clearSegment(x, z, p.x, p.z));
    assert.ok(connected, `No walkable path from spawn to ${name} (${p.x}, ${p.z})`);
  }
});

test('photo goals have ordered distance limits and a reachable, roughly front-facing shot', () => {
  for (const target of PHOTO_TARGETS) {
    assert.ok(Number.isFinite(target.minDist) && target.minDist > 0 && target.minDist < target.maxDist, `${target.id}: invalid distance range`);
    // Companion is dynamic: use its legal waiting spot, with its public 1.6 m head height.
    const point = target.target === 'companion' ? { ...COMPANION.waitAt, y: 1.6 } : target.target;
    assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z), `${target.id}: invalid target`);
    const sample = reachable.queue.find(([x, z]) => {
      const horizontal = Math.hypot(point.x - x, point.z - z);
      const distance = Math.hypot(horizontal, point.y - 1.6);
      // Aim a camera at yaw atan2(-dx,-dz); require elevation within half of the 52° FOV.
      return distance >= target.minDist && distance <= target.maxDist && horizontal > 0 &&
        Math.abs(Math.atan2(point.y - 1.6, horizontal)) < 26 * Math.PI / 180;
    });
    assert.ok(sample, `${target.id}: no reachable valid-distance front-facing sample`);
  }
});

test('STAGES covers objective mappings and state comparisons; objective POIs exist', () => {
  assert.equal(new Set(STAGES).size, STAGES.length, 'duplicate stages');
  // Check both the skeleton OBJECTIVES table and implementations branching on state.stage.
  const table = storySource.match(/const OBJECTIVES\s*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '';
  const referenced = new Set([
    ...Array.from(table.matchAll(/^\s*['"]?([a-z_]+)['"]?\s*:/gm), m => m[1]),
    ...Array.from(storySource.matchAll(/\bstage\s*(?:===|!==|:)\s*['"]([a-z_]+)['"]/g), m => m[1]),
    ...Array.from(storySource.matchAll(/case\s+['"]([a-z_]+)['"]\s*:/g), m => m[1]),
  ]);
  assert.ok(referenced.size, 'Cannot discover objective stages; update this source guard for the new story structure');
  for (const stage of referenced) assert.ok(STAGES.includes(stage), `STAGES is missing objective stage ${stage}`);
  for (const stage of STAGES) {
    const objective = objectiveFor({ ...createStory({ storage: null, search: '' }).getState(), stage });
    assert.equal(typeof objective.text, 'string', `${stage}: objective text`);
    assert.ok(objective.text.length, `${stage}: empty objective`);
    assert.ok(objective.poi === null || Object.hasOwn(POIS, objective.poi), `${stage}: unknown objective POI ${objective.poi}`);
  }
});
