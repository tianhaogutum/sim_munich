// Deliberately simple, replaceable stand-ins; both follow the shared engine API.
export function createInteriorCast(engine) {
  const { THREE, toon, outline } = engine;
  function person(coat, hair) {
    const root = new THREE.Group();
    const skin = toon(0xf0ceb8), dark = toon(0x323448), fabric = toon(coat), hairMat = toon(hair);
    function part(g, m, x, y, z, ink = true) {
      const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.castShadow = true;
      if (ink) outline(mesh, .018); root.add(mesh); return mesh;
    }
    const legs = [-.14, .14].map(x => part(new THREE.CapsuleGeometry(.09, .45, 4, 8), dark, x, .38, 0));
    part(new THREE.CylinderGeometry(.21, .29, .65, 9), fabric, 0, .99, 0);
    const arms = [-.29, .29].map(x => part(new THREE.CapsuleGeometry(.075, .42, 4, 8), fabric, x, 1.01, 0));
    part(new THREE.SphereGeometry(.235, 12, 10), skin, 0, 1.55, -.015);
    // The cap has an open edge: an inverted hull would show its back faces
    // through the hair. The closed head already supplies the ink silhouette.
    const top = part(new THREE.SphereGeometry(.25, 12, 10, 0, Math.PI * 2, 0, Math.PI * .57), hairMat, 0, 1.6, .01, false);
    top.rotation.x = -.15;
    for (const x of [-.085, .085]) part(new THREE.SphereGeometry(.024, 6, 4), dark, x, 1.56, -.226, false);
    part(new THREE.BoxGeometry(.11, .48, .06), toon(0xd9aa77), -.04, 1.18, -.23, false);
    engine.scene.add(root);
    return { root, legs, arms };
  }
  const avatar = person(0x718391, 0x303844), companion = person(0xc7978d, 0x5a403d);
  avatar.root.position.copy(engine.player.pos);
  function placeNearby() {
    const p = engine.player.pos;
    for (const [x, z] of [[1, 1], [-1, 1], [0, 1.5], [1, 0], [-1, 0], [0, -1.5]]) {
      const y = engine.heightAt(p.x + x, p.z + z, p.y);
      if (y !== null) { companion.root.position.set(p.x + x, y, p.z + z); return; }
    }
    companion.root.position.copy(p);
  }
  placeNearby();
  let previous = engine.player.pos.clone(), trail = [], head = new THREE.Vector3();
  function animate(person, distance, et) {
    const swing = Math.sin(et * 10) * Math.min(distance * 3, .45);
    person.legs[0].rotation.x = swing; person.legs[1].rotation.x = -swing;
    person.arms[0].rotation.x = -swing * .6; person.arms[1].rotation.x = swing * .6;
  }
  return {
    companion: { root: companion.root, getPosition: () => companion.root.position,
      getHeadPosition: () => head.copy(companion.root.position).add(new THREE.Vector3(0, 1.9, 0)) },
    update(dt, et) {
      const p = engine.player.pos, distance = p.distanceTo(previous);
      avatar.root.position.copy(p);
      if (distance > .001) avatar.root.rotation.y = Math.atan2(previous.x - p.x, previous.z - p.z);
      if (distance > 2) { trail.length = 0; placeNearby(); }
      else if (distance > .018) trail.push(p.clone());
      let length = 0, keep = trail.length - 1;
      for (; keep > 0; keep--) { length += trail[keep].distanceTo(trail[keep - 1]); if (length > 1.65) break; }
      if (length > 1.65 && trail[keep]) {
        const target = trail[keep], old = companion.root.position.clone();
        // Walk the recorded legal route; never cut diagonally across a stair rail.
        companion.root.position.copy(target);
        companion.root.rotation.y = Math.atan2(old.x - target.x, old.z - target.z);
        trail.splice(0, keep);
      }
      animate(avatar, dt > 0 ? distance / dt : 0, et);
      animate(companion, distance > .018 ? 1 : 0, et - .2);
      previous.copy(p);
    },
    updateVisibility() {
      for (const person of [avatar, companion]) {
        const head = person.root.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        person.root.visible = head.distanceTo(engine.camera.position) > 1.1;
      }
    },
    dispose() {
      for (const person of [avatar, companion]) {
        person.root.removeFromParent();
        const geometries = new Set(), materials = new Set();
        person.root.traverse(m => { if (m.geometry) geometries.add(m.geometry); if (m.material) materials.add(m.material); });
        geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      }
    },
  };
}
