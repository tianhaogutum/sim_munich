import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_ITEMS, ACHIEVEMENTS, VISIT_IDS, COLLECT_STORAGE_KEY,
  isPlacementValid, findPlacement, initialCollectState, validateCollectState,
  snapshotStats, achievementIds, distanceStep,
} from '../src/date_collect_data.mjs';
import { POIS, FOUNTAINS } from '../src/date_route.mjs';

test('eight distinct memories have three-line notes and safe default positions', () => {
  assert.equal(MEMORY_ITEMS.length, 8);
  assert.equal(new Set(MEMORY_ITEMS.map(i => i.id)).size, 8);
  assert.equal(new Set(MEMORY_ITEMS.map(i => i.shape)).size, 8);
  for (const item of MEMORY_ITEMS) {
    assert.equal(item.note.length, 3);
    assert.ok(item.note.every(line => typeof line === 'string' && line.length > 10));
    assert.ok(item.where && item.title);
    assert.equal(isPlacementValid(item), true, item.id);
    for (const poi of Object.values(POIS)) assert.ok(Math.hypot(item.x - poi.x, item.z - poi.z) >= 8);
    for (const fountain of FOUNTAINS) assert.ok(Math.hypot(item.x - fountain.x, item.z - fountain.z) >= 6);
  }
});

test('placement rejects hazards, invalid coordinates, and failed collision probes', () => {
  assert.equal(isPlacementValid(POIS.entrance), false);
  assert.equal(isPlacementValid(FOUNTAINS[0]), false);
  assert.equal(isPlacementValid({ x: 999, z: 50 }), false);
  assert.equal(isPlacementValid({ x: NaN, z: 50 }), false);
  assert.equal(isPlacementValid(null), false);
  assert.equal(isPlacementValid(MEMORY_ITEMS[0], { blocked: () => true }), false);
  assert.equal(isPlacementValid(MEMORY_ITEMS[0], { blocked: () => { throw Error('unavailable'); } }), false);
});

test('placement nudges deterministically without entering quest or fountain zones', () => {
  const origin = { x: -22, z: 28 };
  const options = { blocked: (x, z) => Math.hypot(x - origin.x, z - origin.z) < 3 };
  const result = findPlacement(origin, options);
  assert.ok(result);
  assert.notDeepEqual(result, origin);
  assert.equal(isPlacementValid(result, options), true);
  assert.deepEqual(findPlacement(origin, options), result);
  assert.deepEqual(origin, { x: -22, z: 28 });
  assert.equal(findPlacement(origin, { blocked: () => true }), null);
});

test('walk distance ignores teleports and invalid samples but includes a five-metre step', () => {
  assert.equal(distanceStep({ x: 0, z: 0 }, { x: 3, z: 4 }), 5);
  assert.equal(distanceStep({ x: 0, z: 0 }, { x: 3, z: 4.1 }), 0);
  assert.equal(distanceStep(null, { x: 3, z: 4 }), 0);
  assert.equal(distanceStep({ x: Infinity, z: 0 }, { x: 3, z: 4 }), 0);
  assert.equal(distanceStep({ x: 0, z: 0 }, { x: 0, z: 0 }), 0);
});

test('validated persistence preserves only known IDs and valid versioned records', () => {
  const record = { foundAt: 1750000000000, elapsedSeconds: 80 };
  const dirty = { version: 1, found: { crane: record, coffee: true, letter: { foundAt: -1, elapsedSeconds: 1 }, unknown: record },
    distanceWalked: -1, elapsedSeconds: Infinity, fountainSeconds: 30,
    visited: { entrance: true, fountain: 1, fake: true }, achievements: ['walk', 'walk', 'fake'],
    goldenHourPhoto: true, completedInSeconds: 899 };
  const clean = validateCollectState(dirty);
  assert.deepEqual(clean.found, { crane: record });
  assert.deepEqual(clean.visited, { entrance: true });
  assert.deepEqual(clean.achievements, ['walk']);
  assert.equal(clean.distanceWalked, 0);
  assert.equal(clean.elapsedSeconds, 0);
  assert.equal(clean.fountainSeconds, 30);
  assert.equal(clean.completedInSeconds, 899);
  assert.equal(clean.goldenHourPhoto, true);
  assert.deepEqual(validateCollectState({ ...dirty, version: 2 }), initialCollectState());
  assert.deepEqual(validateCollectState(null), initialCollectState());
  assert.equal(COLLECT_STORAGE_KEY, 'lmu-date-collect-v1');
  clean.found.crane.elapsedSeconds = 900;
  assert.equal(record.elapsedSeconds, 80);
});

test('stats credit only true known photo goals and actual dialogue choices', () => {
  const saved = initialCollectState();
  saved.found.crane = { foundAt: 1750000000000, elapsedSeconds: 3 };
  saved.found.unknown = true;
  saved.elapsedSeconds = 91;
  saved.visited.entrance = true;
  const stats = snapshotStats(saved, { photos: { facade: true, fountain: false, couple: 'true', fake: true }, choices: { fountain: 'stay', invalid: null } });
  assert.equal(stats.fragmentsFound, 1);
  assert.equal(stats.photosCredited, 1);
  assert.equal(stats.dialogueChoices, 1);
  assert.equal(stats.runSeconds, 91);
  stats.visited.fountain = true;
  stats.achievements.push('walk');
  assert.deepEqual(saved.visited, { entrance: true });
  assert.deepEqual(saved.achievements, []);
});

test('achievement thresholds are inclusive, monotonic and side-effect free', () => {
  const stats = { fragmentsFound: 8, distanceWalked: 500, fountainSeconds: 30,
    visited: Object.fromEntries(VISIT_IDS.map(id => [id, true])), dialogueChoices: 1,
    photosCredited: 3, completedInSeconds: 900, goldenHourPhoto: true };
  const before = structuredClone(stats);
  assert.deepEqual(achievementIds(stats), ACHIEVEMENTS.map(a => a.id));
  assert.deepEqual(stats, before);
  assert.deepEqual(achievementIds(), []);
  assert.deepEqual(achievementIds({ ...stats, completedInSeconds: 900.01 }).filter(id => id === 'date'), []);
  assert.ok(!achievementIds({ ...stats, completedInSeconds: null }).includes('date'));
  assert.ok(!achievementIds({ ...stats, fountainSeconds: 29.99 }).includes('fountain'));
  assert.ok(!achievementIds({ ...stats, distanceWalked: 499.99 }).includes('walk'));
  assert.ok(!achievementIds({ ...stats, visited: { entrance: true, fountain: true, our_plaza: true } }).includes('explorer'));
});

test('fresh/restart state contains no carried-over collections or achievements', () => {
  const old = initialCollectState();
  old.found.crane = { foundAt: 1, elapsedSeconds: 0 };
  old.achievements.push('first_memory');
  const fresh = initialCollectState();
  assert.deepEqual(achievementIds(snapshotStats(fresh)), []);
  assert.deepEqual(fresh.found, {});
  assert.equal(fresh.completedInSeconds, null);
});
