// date_cast.js — characters: the visible player avatar and the date companion. Owner: characters agent.
//
// CONTRACT (called by anime_main.js):
//   createCast(engine, story) -> {
//     update(dt, et): void,   // every frame, after player movement and before the camera/render
//     companion: { getPosition(): THREE.Vector3, getHeadPosition(): THREE.Vector3, root: THREE.Object3D },
//     player:    { root: THREE.Object3D },
//   }
//   Reads engine.player.pos / engine.player.yaw. NEVER moves engine.player.
//   engine.player.yaw is the camera orbit yaw, not the walking direction; derive facing from motion.
//   Collision: engine.blocked(x, z). Style: engine.toon(color, steps) + engine.outline(mesh, thickness).
//   React to story stages via story.getState() / story.subscribe() (route data: engine.route.COMPANION).
//
// SKELETON NOTE: placeholder capsules with a naive follow so the chapter is playable end-to-end.
export function createCast(engine, story) {
  const { THREE, scene, route } = engine;
  const capsule = color => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 12), engine.toon(color));
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const playerMesh = capsule(0xF2B8C6);
  const companionMesh = capsule(0x2A2E3A);
  const wait = route.COMPANION.waitAt;
  companionMesh.position.set(wait.x, 0.9, wait.z);
  const groundPos = new THREE.Vector3();
  const headPos = new THREE.Vector3();

  function update(dt) {
    const p = engine.player.pos;
    playerMesh.position.set(p.x, 0.9, p.z);
    if (story.getState().stage === 'meet') return;
    const c = companionMesh.position;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d > route.COMPANION.catchUpDistance) { c.set(p.x + 1.5, 0.9, p.z + 1.5); return; }
    const gap = route.COMPANION.followDistance;
    if (d > gap) {
      const s = Math.min(d - gap, 6 * dt) / d;
      const nx = c.x + dx * s, nz = c.z + dz * s;
      if (!engine.blocked(nx, c.z)) c.x = nx;
      if (!engine.blocked(c.x, nz)) c.z = nz;
    }
  }

  return {
    update,
    companion: {
      getPosition: () => groundPos.set(companionMesh.position.x, 0, companionMesh.position.z),
      getHeadPosition: () => headPos.set(companionMesh.position.x, 1.6, companionMesh.position.z),
      root: companionMesh,
    },
    player: { root: playerMesh },
  };
}
