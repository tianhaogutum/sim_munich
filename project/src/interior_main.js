import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createAudio } from './date_audio.js';
import { createInput } from './date_input.js';
import { createBanter } from './date_banter.js';
import { createCinematic } from './date_cinematic.js';
import { ROUTE } from './date_route.mjs';
import { SIGHTS, heightAt, blocked as isBlocked, moveTo, spawnFromSearch, floorLabel, BOUNDS } from './interior_navigation.mjs';
import { buildInterior } from './interior_scene.js';
import { createInteriorCast } from './interior_cast.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, .08, 240);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .3, .55, .9);
composer.addPass(bloom); composer.addPass(new OutputPass());
function gradient(n) {
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = Math.round(i / (n - 1) * 255); data.set([v, v, v, 255], i * 4); }
  const texture = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true; return texture;
}
const G3 = gradient(3), G4 = gradient(4);
const outlineMaterial = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { thickness: { value: .025 } },
  vertexShader: 'uniform float thickness;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*thickness,1.);}',
  fragmentShader: 'void main(){gl_FragColor=vec4(.065,.075,.11,1.);}',
});
const spawn = spawnFromSearch(location.search), player = { pos: new THREE.Vector3(spawn.x, spawn.y, spawn.z), yaw: spawn.yaw };
const locks = new Set(), keys = new Set(), listeners = [];
const hud = document.getElementById('hud'), panel = document.getElementById('panel'), promptEl = document.getElementById('prompt');
const photoOverlay = document.getElementById('photo-overlay'), photoButton = document.getElementById('photo-btn');
const days = Math.max(0, Math.floor((Date.now() - new Date('2024-03-15')) / 86400000));
document.getElementById('days-num').textContent = days;
let photoActive = false, toastTimer, disposed = false;
let pitch = .24, distance = 7.5, drag = null;
const cameraTarget = player.pos.clone().add(new THREE.Vector3(0, 1.45, 0));
const spring = cameraTarget.clone().add(new THREE.Vector3(0, 2, 7));
const direction = new THREE.Vector3(), desired = new THREE.Vector3(), ray = new THREE.Raycaster();
const routePois = Object.fromEntries(SIGHTS.map(s => [s.id, { ...s }]));
// Empty fountains suppress spatial water audio; offsite fountain prevents plaza banter.
const route = { ...ROUTE, BOUNDS, SPAWN: spawn, POIS: { ...routePois,
  white_rose: routePois.memorial, entrance: routePois.lichthof, fountain: { x: 10000, z: 10000 } }, FOUNTAINS: [], PHOTO_TARGETS: [] };
const engine = {
  THREE, scene, camera, renderer, composer, canvas, player, route, days,
  blocked: (x, z, y = player.pos.y) => isBlocked(x, z, y),
  heightAt: (x, z, y = player.pos.y) => heightAt(x, z, y),
  toon: (color, steps = 4, opts = {}) => new THREE.MeshToonMaterial({ color, gradientMap: steps === 3 ? G3 : G4, ...opts }),
  outline(mesh, thickness = .03) {
    const material = outlineMaterial.clone(); material.uniforms.thickness.value = thickness;
    const hull = new THREE.Mesh(mesh.geometry, material); hull.renderOrder = -1; mesh.add(hull); return mesh;
  },
  lock: id => locks.add(id), unlock: id => locks.delete(id), isLocked: () => locks.size > 0,
  isPhotoMode: () => photoActive, cameraOverride: null, getCameraTarget: () => cameraTarget,
  audio: null, companion: null,
  capture({ maxWidth = 0, type = 'image/png', quality = .92 } = {}) {
    composer.render();
    if (!maxWidth || canvas.width <= maxWidth) return canvas.toDataURL(type, quality);
    const out = document.createElement('canvas'); out.width = maxWidth; out.height = Math.round(canvas.height * maxWidth / canvas.width);
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height); return out.toDataURL(type, quality);
  },
  toast(text, ms = 3000) {
    const el = document.getElementById('toast'); el.textContent = text; el.style.opacity = '1';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = '0'; }, ms);
  },
};
const world = buildInterior(engine);
const story = { getState: () => ({ stage: 'interior' }), subscribe: () => () => {}, dispatch() {} };
const audio = createAudio(engine, story); engine.audio = audio;
const cast = createInteriorCast(engine); engine.companion = cast.companion;
const input = createInput(engine, story), banter = createBanter(engine, story), cinematic = createCinematic(engine, story);

const visited = new Set(), rows = new Map();
for (const s of SIGHTS) {
  const li = document.createElement('li'); li.textContent = s.label; rows.set(s.id, li); document.getElementById('sight-list').appendChild(li);
}
let nearest = null, activeSight = null, previousFocus = null;
function closePanel() {
  if (panel.hidden) return;
  panel.hidden = true; engine.unlock('interior-info'); activeSight = null;
  previousFocus?.focus?.({ preventScroll: true }); previousFocus = null;
}
function interact() {
  if (!nearest || engine.isLocked() || photoActive) return false;
  activeSight = nearest; previousFocus = document.activeElement;
  for (const [id, text] of Object.entries({ 'panel-title': nearest.label, 'panel-icon': nearest.icon, 'panel-text': nearest.text, 'panel-source': nearest.note, 'panel-kicker': nearest.subtitle })) document.getElementById(id).textContent = text;
  panel.hidden = false; engine.lock('interior-info'); document.getElementById('panel-close').focus({ preventScroll: true });
  audio.cue('tick');
  if (!visited.has(nearest.id)) {
    visited.add(nearest.id); rows.get(nearest.id).classList.add('visited'); world.markers[SIGHTS.indexOf(nearest)].visible = false;
    document.getElementById('visit-count').textContent = `${visited.size} / ${SIGHTS.length}`;
    if (visited.size === SIGHTS.length) {
      engine.toast('五段记忆，都留在了光里。一起回到广场吧。', 6000);
      document.getElementById('objective-note').textContent = '五段记忆已珍藏 · 一起回到广场吧';
      document.getElementById('return-link').classList.add('complete'); audio.cue('ending');
    }
  }
  return true;
}
function togglePhoto(force) {
  const next = force ?? !photoActive;
  if (next && (!panel.hidden || (engine.isLocked() && !cinematic.isFreeCam()))) return;
  photoActive = next; photoOverlay.hidden = photoButton.hidden = !next;
  hud.classList.toggle('hidden', next);
  next ? engine.lock('interior-photo') : engine.unlock('interior-photo');
  if (!next) canvas.focus({ preventScroll: true });
}
function shutter() {
  if (!photoActive) return;
  const a = document.createElement('a'); a.download = `lmu-interior-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  a.href = engine.capture({ maxWidth: 2400 }); a.click(); audio.cue('shutter'); engine.toast('这一刻，留给我们。PNG 已下载');
}
function on(target, type, handler, options) { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); }
function editing(e) { return e.isComposing || e.keyCode === 229 || e.target?.matches?.('input,textarea,select,[contenteditable="true"]'); }
on(window, 'keydown', e => {
  if (editing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(); keys.add(k);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (cinematic.handleKey(k, e) || audio.handleKey(k, e)) { e.preventDefault(); return; }
  if (!panel.hidden) {
    if (['escape', 'enter', 'e'].includes(k)) { closePanel(); e.preventDefault(); }
    if (k === 'tab') { const close = document.getElementById('panel-close'), done = document.getElementById('panel-done'); (document.activeElement === close ? done : close).focus(); e.preventDefault(); }
    return;
  }
  if (k === 'p') { togglePhoto(); e.preventDefault(); }
  else if (photoActive && k === ' ') { shutter(); e.preventDefault(); }
  else if (photoActive && k === 'escape') { togglePhoto(false); e.preventDefault(); }
  else if (k === 'e') { interact(); e.preventDefault(); }
});
on(window, 'keyup', e => keys.delete(e.key.toLowerCase()));
function clearKeys() { keys.clear(); drag = null; }
on(window, 'blur', clearKeys); on(document, 'visibilitychange', clearKeys);
on(document.getElementById('panel-close'), 'click', closePanel);
on(document.getElementById('panel-done'), 'click', closePanel);
on(promptEl, 'click', interact); on(photoButton, 'click', shutter);
on(canvas, 'pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || engine.cameraOverride || (!panel.hidden)) return;
  drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
});
on(canvas, 'pointermove', e => {
  if (!drag || engine.cameraOverride) return;
  player.yaw -= (e.clientX - drag.x) * .004;
  pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag.y) * .004, -1.25, 1.2);
  drag = { x: e.clientX, y: e.clientY };
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) on(canvas, name, () => { drag = null; });
on(window, 'wheel', e => {
  if (engine.cameraOverride || !panel.hidden) return;
  distance = THREE.MathUtils.clamp(distance + e.deltaY * .009, 2.5, 9); e.preventDefault();
}, { passive: false });
on(window, 'resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
function updateCamera(dt, et) {
  cameraTarget.lerp(player.pos.clone().add(new THREE.Vector3(0, 1.45, 0)), 1 - Math.exp(-16 * dt));
  if (engine.cameraOverride) { engine.cameraOverride(dt, et); spring.copy(camera.position); return; }
  desired.set(Math.sin(player.yaw) * distance * Math.cos(pitch), Math.sin(pitch) * distance, Math.cos(player.yaw) * distance).add(cameraTarget);
  spring.lerp(desired, 1 - Math.exp(-8 * dt));
  // Constrain the smoothed arm, not just its endpoint, so corners cannot swing through walls.
  direction.subVectors(spring, cameraTarget);
  const length = direction.length(); direction.normalize(); ray.set(cameraTarget, direction); ray.far = length + .22;
  const hit = ray.intersectObjects(world.cameraObstacles, false)[0];
  if (hit && hit.distance < length + .22) spring.copy(cameraTarget).addScaledVector(direction, Math.max(.35, hit.distance - .22));
  spring.y = Math.max(.15, spring.y); camera.position.copy(spring); camera.lookAt(cameraTarget);
}
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (disposed) return;
  const dt = Math.min(clock.getDelta(), .05), et = clock.elapsedTime;
  input.update(dt);
  if (!engine.isLocked()) {
    let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    let z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    const scale = (keys.has('shift') ? 6.2 : 3.2) * dt / (Math.hypot(x, z) || 1), cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
    const dx = (x * cy + z * sy) * scale, dz = (z * cy - x * sy) * scale;
    const from = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    const stepX = moveTo(from, from.x + dx, from.z) ?? from;
    const stepZ = moveTo(stepX, stepX.x, stepX.z + dz) ?? stepX;
    player.pos.set(stepZ.x, stepZ.y, stepZ.z);
  }
  cast.update(dt, et); audio.update(dt, et); cinematic.update(dt, et);
  hud.classList.toggle('cine-hidden', cinematic.isPlaying());
  updateCamera(dt, et); cast.updateVisibility(); banter.update(dt, et); world.update(dt, et);
  nearest = null; let best = 2.3;
  for (const s of SIGHTS) {
    const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z);
    if (d < best && Math.abs(player.pos.y - s.y) < .8) { nearest = s; best = d; }
  }
  promptEl.hidden = !nearest || engine.isLocked() || photoActive;
  if (!promptEl.hidden) promptEl.innerHTML = `<kbd>E</kbd> ${nearest.icon} ${nearest.label}`;
  document.getElementById('floor-indicator').textContent = floorLabel(player.pos.y);
  composer.render();
});
window.__interior = { engine, story, audio, input, banter, cinematic, cast, world, visited, sights: SIGHTS, interact, closePanel,
  photo: { isActive: () => photoActive, toggle: togglePhoto, shutter },
  cameraRig: { set(options = {}) { if (Number.isFinite(options.pitch)) pitch = options.pitch; if (Number.isFinite(options.yaw)) player.yaw = options.yaw; if (Number.isFinite(options.distance)) distance = THREE.MathUtils.clamp(options.distance, 2.5, 9); } },
};
on(window, 'pagehide', e => {
  if (e.persisted) return; disposed = true; renderer.setAnimationLoop(null); clearTimeout(toastTimer);
  input.dispose(); banter.dispose(); cinematic.dispose(); audio.dispose(); cast.dispose();
  listeners.forEach(off => off()); composer.dispose(); renderer.dispose();
});
document.getElementById('loading').remove();
