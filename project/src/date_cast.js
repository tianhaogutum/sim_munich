// Visible heroine, dog and date partner. The engine remains the sole owner of player movement.
import { createAnimeCompanion } from './anime_companion.js';
import { createMaleLead } from './male_lead.js';
import { hasClearance, safeCastPosition, planCastPath, moveCastAlongPath } from './date_cast_follow.mjs';

export function createCast(engine, story) {
  const { THREE: T, scene } = engine;
  const before = new Set(scene.children);
  const heroine = createAnimeCompanion(T, scene);
  const partner = createMaleLead(T, scene);
  partner.root.name = 'date-companion';
  const roots = scene.children.filter(object => !before.has(object));
  const materials = new Map(), oldMaterials = new Set(), geometries = new Set();
  const lowSphere = new T.SphereGeometry(1, 18, 12);
  const lowCube = new T.BoxGeometry(1, 1, 1);
  const meshes = [];
  for (const root of roots) root.traverse(object => { if (object.isMesh) meshes.push(object); });
  for (const mesh of meshes) {
    geometries.add(mesh.geometry);
    // Hundreds of tiny rounded details share two economical geometries.
    if (mesh.geometry.type === 'SphereGeometry') mesh.geometry = lowSphere;
    else if (mesh.geometry.type === 'BoxGeometry') mesh.geometry = lowCube;
    const original = mesh.material;
    oldMaterials.add(original);
    let hex = original.color?.getHexString() ?? 'ffffff';
    // A rose coat makes the heroine readable beside her dark-clothed companion.
    if (belongsTo(mesh, heroine.root)) hex = ({'252932':'ae7589','424650':'77566a','393d46':'956379','171b22':'f3e4cd'})[hex] ?? hex;
    const key = `${hex}:${original.transparent}:${original.opacity}`;
    if (!materials.has(key)) materials.set(key, engine.toon(`#${hex}`, 4, {
      transparent: original.transparent, opacity: original.opacity,
    }));
    mesh.material = materials.get(key);
    mesh.castShadow = true; mesh.receiveShadow = true;
    // Outline only large body silhouettes, never eyelashes, buttons, or facial features.
    const scale = mesh.scale;
    if (!mesh.isInstancedMesh && ['CylinderGeometry','SphereGeometry'].includes(mesh.geometry.type) &&
        scale.x * scale.y * scale.z > .018 && scale.y > .16) {
      engine.outline?.(mesh, .018);
    }
    mesh.userData.photoIgnore = true; // Cast must not self-occlude the portrait validator.
  }
  // Model factories allocate private standard materials; dispose after replacing every reference.
  for (const material of oldMaterials) material.dispose?.();
  heroine.root.userData.photoIgnore = true;
  partner.root.userData.photoIgnore = true;
  heroine.root.scale.setScalar(.92);
  partner.root.scale.setScalar(.94);
  const p = engine.player.pos;
  heroine.root.position.copy(p);
  const initialWait = engine.route.COMPANION.waitAt;
  const initial = safeCastPosition(initialWait, engine.blocked, 6, p) ?? initialWait;
  partner.root.position.set(initial.x, engine.heightAt?.(initial.x, initial.z) ?? 0, initial.z);
  partner.root.rotation.y = initialWait.yaw ?? Math.PI;
  const ground = new T.Vector3(), head = new T.Vector3();
  const playerGround = new T.Vector3(), playerHead = new T.Vector3();
  const lastPlayer = p.clone(), lastPartner = partner.root.position.clone();
  const modelY = heroine.body.position.y;
  const path = [];
  let routeAt = 0, clock = 0, playerPhase = 0, partnerPhase = 0, movingPlayer = false;
  let headingX = 0, headingZ = -1, disposed = false, lastStage = story.getState().stage;
  let greetUntil = 2.6, photoWasActive = false, lastGoal = { x: NaN, z: NaN };
  let stuckFor = 0, catchups = 0;

  function belongsTo(object, ancestor) {
    for (let at = object; at; at = at.parent) if (at === ancestor) return true;
    return false;
  }
  function turn(root, dx, dz, dt) {
    if (Math.hypot(dx, dz) < .01) return;
    const angle = Math.atan2(-dx, -dz);
    root.rotation.y += Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y)) * (1 - Math.exp(-dt * 9));
  }
  function pose(actor, phase, amount, dt, wave = false, photo = false) {
    const blend = 1 - Math.exp(-dt * 12);
    actor.legs.forEach((leg, i) => { leg.rotation.x += (Math.sin(phase + i * Math.PI) * .42 * amount - leg.rotation.x) * blend; });
    actor.arms.forEach((arm, i) => {
      const targetX = photo ? -.08 : wave && i === 0 ? -1.1 : -Math.sin(phase + i * Math.PI) * .27 * amount;
      const targetZ = wave && i === 0 ? .95 + Math.sin(clock * 11) * .14 : photo && i === 0 ? .18 : 0;
      arm.rotation.x += (targetX - arm.rotation.x) * blend;
      arm.rotation.z += (targetZ - arm.rotation.z) * blend;
    });
  }
  function reset(next, previous, event) {
    if (event?.type !== 'RESTART' && !(next.stage === 'meet' && previous?.stage !== 'meet')) return;
    const wait = engine.route.COMPANION.waitAt;
    const spot = safeCastPosition(wait, engine.blocked, 8, engine.player.pos);
    if (spot) partner.root.position.set(spot.x, engine.heightAt?.(spot.x, spot.z) ?? 0, spot.z);
    path.length = 0; routeAt = 0; greetUntil = clock + 2.5; stuckFor = 0;
  }
  const unsubscribe = story.subscribe?.(reset);

  function update(dt = 0, et) {
    if (disposed) return;
    dt = Math.min(.08, Math.max(0, Number.isFinite(dt) ? dt : 0)); clock += dt;
    const position = engine.player.pos, stage = story.getState().stage;
    const dx = position.x - lastPlayer.x, dz = position.z - lastPlayer.z, distance = Math.hypot(dx, dz);
    const locked = !!engine.isLocked?.(), photo = !!engine.isPhotoMode?.();
    heroine.root.position.copy(position);
    movingPlayer = distance > .0005 && distance < 4 && !locked;
    if (movingPlayer) {
      headingX = dx / distance; headingZ = dz / distance;
      turn(heroine.root, dx, dz, dt); playerPhase += distance * 5;
    } else if (photo) {
      turn(heroine.root, Math.sin(engine.player.yaw), Math.cos(engine.player.yaw), dt);
    }
    pose(heroine, playerPhase, movingPlayer ? Math.min(1, distance / Math.max(dt, .001) / 4) : 0, dt, false, photo);
    heroine.body.position.y = modelY + (movingPlayer ? Math.abs(Math.sin(playerPhase)) * .025 : Math.sin(clock * 1.9) * .008);
    // Dog factory animates its own paws and leash; our player pose never overwrites its arm afterward.
    heroine.update(locked ? 0 : dt, clock, engine.blocked, engine.heightAt);
    lastPlayer.copy(position);
    if (stage !== lastStage) { routeAt = 0; if (lastStage === 'meet') greetUntil = clock + 1.6; lastStage = stage; }
    const partnerPosition = partner.root.position;
    const separation = Math.hypot(position.x - partnerPosition.x, position.z - partnerPosition.z);
    let moved = 0;
    if (stage !== 'meet' && !locked) {
      const sideX = photo ? Math.cos(engine.player.yaw) : headingZ;
      const sideZ = photo ? -Math.sin(engine.player.yaw) : -headingX;
      const gap = photo ? 1.05 : Math.max(1.65, engine.route.COMPANION.followDistance ?? 2.2);
      const desired = photo ? { x: position.x + sideX * gap, z: position.z + sideZ * gap }
        : { x: position.x - headingX * gap + sideX * .75, z: position.z - headingZ * gap + sideZ * .75 };
      const goal = safeCastPosition(desired, engine.blocked, 3, position);
      const catchUpDistance = engine.route.COMPANION.catchUpDistance ?? 28;
      if ((separation > catchUpDistance || !hasClearance(partnerPosition.x, partnerPosition.z, engine.blocked)) && goal) {
        partnerPosition.x = goal.x; partnerPosition.z = goal.z;
        path.length = 0; routeAt = clock + .35; stuckFor = 0; catchups++;
      } else if (goal) {
        const goalChanged = Math.hypot(goal.x - lastGoal.x, goal.z - lastGoal.z) > 1.4;
        if (clock >= routeAt && (goalChanged || !path.length || photo !== photoWasActive)) {
          const next = planCastPath(partnerPosition, goal, engine.blocked);
          path.splice(0, path.length, ...next); lastGoal = goal; routeAt = clock + .65;
        }
        moved = moveCastAlongPath(partnerPosition, path, Math.min(7, 2.5 + separation * .23), dt, engine.blocked);
        if (moved > .001) {
          turn(partner.root, partnerPosition.x - lastPartner.x, partnerPosition.z - lastPartner.z, dt);
          partnerPhase += moved * 5; stuckFor = 0;
        } else if (separation > 5) {
          stuckFor += dt;
          // Catch up only after genuinely getting separated, at a collision-tested nearby position.
          if (stuckFor > 5 && goal) { partnerPosition.x = goal.x; partnerPosition.z = goal.z; path.length = 0; stuckFor = 0; catchups++; }
        }
      }
    }
    partnerPosition.y = engine.heightAt?.(partnerPosition.x, partnerPosition.z) ?? 0;
    if (!moved) {
      if (photo) turn(partner.root, Math.sin(engine.player.yaw), Math.cos(engine.player.yaw), dt);
      else turn(partner.root, position.x - partnerPosition.x, position.z - partnerPosition.z, dt);
    }
    const greeting = !photo && clock < greetUntil && separation < 12;
    pose(partner, partnerPhase, moved > .001 ? Math.min(1, moved / Math.max(dt, .001) / 4) : 0, dt, greeting, photo);
    lastPartner.copy(partnerPosition); photoWasActive = photo;
  }

  return {
    update,
    companion: { root: partner.root,
      getPosition: () => ground.set(partner.root.position.x, partner.root.position.y, partner.root.position.z),
      getHeadPosition: () => head.set(partner.root.position.x, partner.root.position.y + 2.08, partner.root.position.z) },
    player: { root: heroine.root, dog: heroine.dog,
      getPosition: () => playerGround.copy(heroine.root.position),
      getHeadPosition: () => playerHead.set(heroine.root.position.x, heroine.root.position.y + 1.88, heroine.root.position.z) },
    getStats: () => ({ catchups, pathPoints: path.length, meshes: meshes.length, materials: materials.size }),
    dispose() {
      if (disposed) return; disposed = true; unsubscribe?.();
      for (const root of roots) {
        root.traverse(object => {
          if (object.geometry) geometries.add(object.geometry);
          if (object.material && ![...materials.values()].includes(object.material)) {
            if (Array.isArray(object.material)) object.material.forEach(m => m.dispose?.()); else object.material.dispose?.();
          }
        });
        root.removeFromParent();
      }
      for (const geometry of geometries) geometry.dispose?.();
      lowSphere.dispose(); lowCube.dispose();
      for (const material of materials.values()) material.dispose();
    },
  };
}
