import test from 'node:test';
import assert from 'node:assert/strict';
import { floorHeight } from '../src/interior_rules.mjs';
import { heightAt, blocked, moveTo, COLLIDERS, SIGHTS, SPAWN, spawnFromSearch, floorLabel } from '../src/interior_navigation.mjs';

const key = p => `${p.x.toFixed(2)},${p.z.toFixed(2)},${p.y.toFixed(2)}`;
function explore(start) {
  const queue = [start], seen = new Set([key(start)]);
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    for (const [dx, dz] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5]]) {
      const to = moveTo(from, from.x + dx, from.z + dz);
      if (to && !seen.has(key(to))) { seen.add(key(to)); queue.push(to); }
    }
  }
  return queue;
}
// One graph carries Y per node; an X/Z can represent distinct floors. Each .5 m
// edge is swept through the same short substeps as actual player movement.
const reachable = explore(SPAWN);
const reaches = (x, y, z, tolerance = .27) => reachable.some(p => Math.hypot(p.x - x, p.z - z) <= tolerance && Math.abs(p.y - y) < .16);

test('legacy floor heights remain the layer authority; rendered stairs interpolate smoothly', () => {
  for (const [x, z, y] of [[0, 14, 0], [1, 0, 2.4], [9.5, -1, 6], [5.5, -12, 6]]) {
    assert.equal(floorHeight(x, z, y), y);
    assert.equal(heightAt(x, z, y), y);
  }
  const stair = heightAt(0, 6.9, .35);
  assert.ok(stair > .37 && stair < .38);
  assert.ok(Math.abs(stair - floorHeight(0, 6.9, .35)) <= .15);
  assert.equal(floorLabel(0), '1F · 中庭');
  assert.equal(floorLabel(2.4), '中层 · 大楼梯');
  assert.equal(floorLabel(6), '2F · 二层回廊');
});

test('a half-meter BFS reaches ground, landing, both split stairs and both galleries from spawn', () => {
  for (const [x, y, z] of [[0, 0, 8.5], [1, 2.4, 0], [-5.5, 2.4, -2.5], [5.5, 2.4, -2.5],
    [-5.5, 6, -11.5], [5.5, 6, -11.5], [-9.5, 6, 12], [9.5, 6, 12]]) {
    assert.ok(reaches(x, y, z), `Unreachable stair end / level: ${x},${y},${z}`);
  }
  assert.ok(reachable.filter(p => p.y === 0).length > 1000);
  assert.ok(reachable.filter(p => p.y === 2.4).length > 30);
  assert.ok(reachable.filter(p => p.y === 6).length > 200);
});

test('every sightseeing point is walkable on its stated floor and reachable from spawn', () => {
  assert.equal(SIGHTS.length, 5);
  for (const s of SIGHTS) {
    assert.equal(blocked(s.x, s.z, s.y), false, s.id);
    assert.ok(reachable.some(p => Math.hypot(p.x - s.x, p.z - s.z) < .6 && Math.abs(p.y - s.y) < .1), s.id);
  }
});

test('railings and columns are solid and level-aware', () => {
  assert.ok(COLLIDERS.some(c => c.id === 'gallery-rail'));
  assert.equal(blocked(8.45, 2, 6), true);
  assert.equal(blocked(8.45, 2, 0), false, 'ground walkway below the same rail');
  assert.equal(blocked(8, 4, 0), true);
  assert.equal(blocked(8, 4, 6), true);
  assert.equal(blocked(7.1, 5, 1), true);
  assert.equal(moveTo({ x: 9.5, y: 6, z: 2 }, 7.5, 2), null);
  assert.equal(moveTo({ x: 0, y: 2.4, z: -2 }, 0, -4), null);
});

test('stairs are entered at their ends; sideways entry and falling through gallery voids fail', () => {
  assert.equal(moveTo({ x: 7.6, y: 0, z: 7.7 }, 6.5, 7.7), null);
  assert.equal(moveTo({ x: 7.6, y: 0, z: 4 }, 6.5, 4), null);
  assert.equal(moveTo({ x: 3, y: 2.4, z: -5 }, 5.5, -5), null);
  assert.equal(heightAt(0, 0, 6), null);
  assert.equal(moveTo({ x: 0, y: 6, z: -12 }, 0, -10), null);
  const bottom = { x: 0, y: 0, z: 8.5 };
  assert.ok(moveTo(bottom, 0, 7.5));
});

test('swept movements cannot tunnel across rails at low frame rates', () => {
  assert.equal(moveTo({ x: 10, y: 6, z: 3 }, 0, 3), null);
  assert.equal(moveTo({ x: 10, y: 0, z: 4 }, 6, 4), null);
});

test('all reachable transitions have a supported floor and a reverse path', () => {
  for (const p of reachable) {
    assert.equal(blocked(p.x, p.z, p.y), false, key(p));
    for (const [dx, dz] of [[.5, 0], [0, .5]]) {
      const to = moveTo(p, p.x + dx, p.z + dz);
      if (to) assert.ok(moveTo(to, p.x, p.z), `One-way floor seam at ${key(p)}`);
    }
  }
});

test('debug coordinates are validated without changing ordinary spawn', () => {
  assert.deepEqual(spawnFromSearch(''), SPAWN);
  assert.deepEqual(spawnFromSearch('?pos=NaN,2'), SPAWN);
  assert.deepEqual(spawnFromSearch('?pos=400,20'), SPAWN);
  assert.equal(spawnFromSearch('?pos=1,0').y, 2.4);
  assert.equal(spawnFromSearch('?pos=0,4').y, (8 - 4) / 7 * 2.4);
  for (const x of [NaN, Infinity, 100]) assert.equal(heightAt(x, 0, 0), null);
});
