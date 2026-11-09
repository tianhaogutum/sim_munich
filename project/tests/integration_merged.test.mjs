import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDS, FOUNTAINS, POIS } from '../src/date_route.mjs';
import { MEMORY_ITEMS, findPlacement, isPlacementValid, validateCollectState,
  initialCollectState, snapshotStats, achievementIds } from '../src/date_collect_data.mjs';
import { BANTER_POOLS, pickLine, REPEAT_WINDOW } from '../src/date_banter_lines.mjs';
import { createSequence, defaultCameraPose, samplePath, distance3 } from '../src/date_cinematic_paths.mjs';
import { createLifeSimulation, seededRandom, distance } from '../src/lmu_life_sim.mjs';

// Same building extents as the reviewed engine; route.test.mjs guards their source.
const solids = [
  { x: 0, z: -11, hw: 81, hd: 13 },
  { x: -112, z: -26, hw: 52, hd: 52 },
  { x: 112, z: -26, hw: 52, hd: 52 },
];
const blocked = (x, z) => x < BOUNDS.minX || x > BOUNDS.maxX ||
  z < BOUNDS.minZ || z > BOUNDS.maxZ ||
  FOUNTAINS.some(f => Math.hypot(x - f.x, z - f.z) < f.r) ||
  solids.some(s => Math.abs(x - s.x) < s.hw && Math.abs(z - s.z) < s.hd);

test('merged placements honor real buildings, every POI, fountain rims and route bounds', () => {
  for (const origin of [...MEMORY_ITEMS, ...Object.values(POIS), ...FOUNTAINS,
    { x: -80, z: 0 }, { x: 80, z: 0 }, { x: 0, z: -11 }]) {
    const before = structuredClone(origin);
    const at = findPlacement(origin, { blocked });
    if (at) {
      assert.equal(blocked(at.x, at.z), false);
      assert.equal(isPlacementValid(at, { blocked }), true);
      for (const poi of Object.values(POIS)) assert.ok(distance(at, poi) >= 8);
    }
    assert.deepEqual(origin, before, 'placement must not move route data');
  }
  for (const item of MEMORY_ITEMS) assert.ok(findPlacement(item, { blocked }), item.id);
});

test('banter cooldown applies across all context pools and alias texts for an hour', () => {
  const random = seededRandom(912), history = new Map();
  const pools = Object.values(BANTER_POOLS);
  let accepted = 0;
  for (let now = 0; now < 3600; now += 3) {
    const lines = pools[Math.floor(random() * pools.length)];
    const chosen = pickLine(lines, { now, stage: 'photos', period: ['morning', 'afternoon', 'evening'][Math.floor(now / 600) % 3] }, history, random);
    if (!chosen) continue;
    assert.ok(now - (history.get(chosen.id) ?? -Infinity) >= REPEAT_WINDOW);
    assert.ok(now - (history.get(chosen.text) ?? -Infinity) >= REPEAT_WINDOW);
    history.set(chosen.id, now); history.set(chosen.text, now); accepted++;
  }
  assert.ok(accepted > 200, 'exercise repeated cooldown expiry, not only initial selection');
  const one = [{ id: 'alias', text: '同一句话', weight: 1 }];
  assert.equal(pickLine(one, { now: 599 }, { '同一句话': 0 }, random), null);
  assert.equal(pickLine(one, { now: 600 }, { '同一句话': 0 }, random), one[0]);
});

test('collect restore discards corrupt schemas and cannot accidentally credit quest photos', () => {
  for (const input of [null, false, 0, 'broken', [], { version: 2 }, { version: 1, found: [], achievements: {} }]) {
    const restored = validateCollectState(input);
    assert.deepEqual(restored, initialCollectState());
    assert.deepEqual(achievementIds(snapshotStats(restored, { photos: { facade: 'true', fountain: 1 }, collected: { memento: true } })), []);
  }
  const first = validateCollectState({ version: 1, found: { crane: { foundAt: 1, elapsedSeconds: 2 } } });
  first.found.crane.elapsedSeconds = 99;
  assert.deepEqual(validateCollectState(null), initialCollectState(), 'a restarted run has no shared save objects');
});

test('camera paths remain finite for moved players and terminate at the default spring pose', () => {
  const random = seededRandom(33);
  for (let i = 0; i < 40; i++) {
    const player = [(random() - .5) * 100, random() * 2, 28 + random() * 60];
    const yaw = (random() - .5) * 20;
    for (const name of ['intro', 'fountain', 'ending']) {
      const sequence = createSequence(name, { player, yaw, companion: [player[0] + 2, player[1], player[2]], fov: 52 });
      let previous;
      for (let t = 0; t <= sequence.path.duration; t += .05) {
        const pose = samplePath(sequence.path, t);
        assert.ok([...pose.position, ...pose.target, pose.fov].every(Number.isFinite));
        if (previous) assert.ok(distance3(previous, pose.position) < 8, `${name} spline jump`);
        previous = pose.position;
      }
      if (name === 'intro') {
        const end = samplePath(sequence.path, sequence.path.duration);
        assert.ok(distance3(end.position, defaultCameraPose(player, yaw).position) < 1e-8);
      }
    }
  }
});

test('life movers stay finite and on actual engine ground across restart and ending stages', () => {
  const sim = createLifeSimulation({ blocked, random: seededRandom(91) });
  for (let i = 0; i < 3600; i++) {
    const stage = ['meet', 'photos', 'postcard', 'done', 'meet', 'photos'][Math.floor(i / 600)];
    sim.update(.05, i * .05, { x: 0, z: 75 }, { x: 2, z: 75 }, stage);
    for (const p of sim.pedestrians) {
      assert.ok([p.x, p.z, p.yaw].every(Number.isFinite));
      assert.equal(blocked(p.x, p.z), false);
    }
    for (const flock of sim.flocks) if (flock.state === 'ground') assert.equal(blocked(flock.x, flock.z), false);
  }
});

test('R07: idle pedestrians yield when the companion reaches their position', () => {
  const sim = createLifeSimulation({ blocked, random: seededRandom(1) });
  const actor = sim.pedestrians[0];
  actor.idle = 5; actor.seated = true;
  const companion = { x: actor.x, z: actor.z };
  sim.update(1 / 60, 1, { x: 0, z: 75 }, companion, 'photos');
  assert.ok(distance(actor, companion) >= 1.5,
    `idle actor ignored companion: gap ${distance(actor, companion)} m`);
});
