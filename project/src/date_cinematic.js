import { t, onLocaleChange } from './date_i18n.mjs';
// Integration: construct after cast/photo/storyUI; call update(dt, et) once per
// frame BEFORE the camera section. Route handleKey before storyUI/photo/defaults.
// The override only draws the current pose; it never advances the clock twice.
import { createSequence, SEQUENCES, samplePath, defaultCameraPose, easeInOut, clamp01, lerp } from './date_cinematic_paths.mjs';

const instances = new WeakMap();
const FLIGHT_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const SKIP_KEYS = new Set(['escape', 'enter', ' ', 'space', 'spacebar']);
const triple = v => [v.x, v.y, v.z];

export function createCinematic(engine, story) {
  if (instances.has(engine)) return instances.get(engine);
  const { THREE, camera } = engine;
  const listeners = [];
  let disposed = false, active = null, queued = null, free = null;
  let ownedLock = null, originalFov = camera.fov, savedYaw = engine.player.yaw;
  let dragging = null, endingDelay = null, fountainPlayed = false, endingPlayed = false;
  let stage = story?.getState?.().stage;
  const held = new Set();
  const poseCamera = camera.clone();
  const move = new THREE.Vector3();
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ');

  let stylesheet = document.querySelector('link[data-dcin-styles]');
  const ownsStylesheet = !stylesheet;
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./date_cinematic.css', import.meta.url).href;
    stylesheet.dataset.dcinStyles = '';
    document.head.appendChild(stylesheet);
  }
  const root = document.createElement('div');
  root.id = 'date-cinematic-root';
  root.className = 'dcin-root';
  root.innerHTML = `<div class="dcin-bar dcin-bar-top"></div>
    <div class="dcin-bar dcin-bar-bottom"></div>
    <div class="dcin-caption" role="status" aria-live="polite">
      <div class="dcin-caption-title"></div><div class="dcin-caption-subtitle"></div>
    </div><div class="dcin-skip">${t('cinematic.skip')}</div>
    <div class="dcin-free-hint"><div class="dcin-free-title">${t('cinematic.freeTitle')}</div>
      ${t('cinematic.freeHint')}</div>`;
  document.body.appendChild(root);
  const caption = root.querySelector('.dcin-caption');
  const title = root.querySelector('.dcin-caption-title');
  const subtitle = root.querySelector('.dcin-caption-subtitle');
  const unsubscribeLocale = onLocaleChange(() => {
    root.querySelector('.dcin-skip').textContent = t('cinematic.skip');
    root.querySelector('.dcin-free-hint').innerHTML = `<div class="dcin-free-title">${t('cinematic.freeTitle')}</div>${t('cinematic.freeHint')}`;
    const card = active?.kind === 'sequence' && active.spec.captions.find(c => active.elapsed >= c.start && active.elapsed <= c.end);
    if (card) { title.textContent = card.title; subtitle.textContent = card.subtitle; }
  });

  function on(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  }
  function setFov(value) {
    if (Math.abs(camera.fov - value) < 1e-7) return;
    camera.fov = value;
    camera.updateProjectionMatrix();
  }
  function poseFrom(position, target, fov) {
    poseCamera.position.fromArray(position);
    poseCamera.lookAt(new THREE.Vector3().fromArray(target));
    return { position: poseCamera.position.clone(), quaternion: poseCamera.quaternion.clone(), fov };
  }
  function currentPose() {
    return { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
  }
  function draw(pose) {
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
    setFov(pose.fov);
  }
  function mixPose(a, b, t) {
    return { position: a.position.clone().lerp(b.position, t),
      quaternion: a.quaternion.clone().slerp(b.quaternion, t), fov: lerp(a.fov, b.fov, t) };
  }
  function homePose() {
    const target = engine.getCameraTarget?.();
    const pose = defaultCameraPose(triple(engine.player.pos), savedYaw, target ? triple(target) : undefined);
    return poseFrom(pose.position, pose.target, originalFov);
  }
  function acquire(id) {
    originalFov = camera.fov;
    savedYaw = engine.player.yaw;
    ownedLock = id;
    engine.lock(id);
    engine.cameraOverride = renderCamera;
    held.clear();
  }
  function available() {
    return !active && !free && !engine.isLocked() && !engine.isPhotoMode?.() && !engine.cameraOverride;
  }
  function clearCaption() {
    caption.style.opacity = '0';
    if (title.textContent) title.textContent = '';
    if (subtitle.textContent) subtitle.textContent = '';
  }
  function finish() {
    const request = active?.request;
    active = null;
    free = null;
    dragging = null;
    held.clear();
    // Never clobber another module's override if it has taken ownership.
    if (engine.cameraOverride === renderCamera) engine.cameraOverride = null;
    setFov(originalFov);
    engine.player.yaw = savedYaw;
    if (ownedLock) engine.unlock(ownedLock);
    ownedLock = null;
    root.classList.remove('dcin-playing', 'dcin-free', 'dcin-photo');
    clearCaption();
    request?.resolve();
  }
  function beginReturn(duration = 1) {
    if (active?.kind === 'return') return;
    const request = active?.request;
    const wasFree = !!free;
    active = { kind: 'return', elapsed: 0, duration, from: currentPose(), request };
    free = null;
    dragging = null;
    held.clear();
    root.classList.remove('dcin-free', 'dcin-photo');
    // A free-camera exit uses no letterbox, but still consumes world keys until home.
    if (!wasFree) root.classList.add('dcin-playing');
    clearCaption();
  }
  function sequencePose(sequence, elapsed) {
    const t = Math.max(0, elapsed - sequence.spec.leadIn);
    const sampled = samplePath(sequence.spec.path, t, originalFov);
    const pose = poseFrom(sampled.position, sampled.target, sampled.fov);
    return sequence.spec.leadIn && elapsed < sequence.spec.leadIn
      ? mixPose(sequence.from, pose, easeInOut(elapsed / sequence.spec.leadIn)) : pose;
  }
  function renderCamera() {
    if (disposed) return;
    if (active?.kind === 'sequence') draw(sequencePose(active, active.elapsed));
    else if (active?.kind === 'return') {
      draw(mixPose(active.from, homePose(), easeInOut(active.elapsed / active.duration)));
      if (active.elapsed >= active.duration) finish();
    } else if (free) {
      camera.position.copy(free.position);
      camera.quaternion.setFromEuler(rotation.set(free.pitch, free.yaw, 0, 'YXZ'));
    }
  }
  function startQueued() {
    if (!queued || !available()) return;
    const request = queued;
    queued = null;
    acquire('cinematic');
    const route = engine.route;
    active = { kind: 'sequence', elapsed: 0, request, from: currentPose(),
      spec: createSequence(request.name, { player: triple(engine.player.pos), yaw: savedYaw,
        companion: triple(engine.companion?.getPosition?.() ?? engine.player.pos), fov: originalFov,
        basin: route?.FOUNTAINS?.[1] }) };
    root.classList.add('dcin-playing');
    renderCamera();
  }
  function play(name) {
    if (!Object.hasOwn(SEQUENCES, name)) return Promise.reject(new RangeError(`Unknown cinematic: ${name}`));
    if (disposed) return Promise.resolve();
    if (active?.request?.name === name) return active.request.promise;
    if (queued?.name === name) return queued.promise;
    if (queued) queued.resolve();
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    queued = { name, promise, resolve };
    if (active || free) beginReturn(free ? 0.8 : 1);
    startQueued();
    return promise;
  }
  function stop() {
    if (queued) { queued.resolve(); queued = null; }
    if (active || free) beginReturn(free ? 0.8 : 1);
  }
  function enterFree() {
    if (!available() || queued) return false;
    acquire('freecam');
    rotation.setFromQuaternion(camera.quaternion, 'YXZ');
    free = { position: camera.position.clone(), pitch: rotation.x, yaw: rotation.y, speed: 12 };
    root.classList.add('dcin-free');
    return true;
  }
  function handleKey(key, event) {
    const k = String(key).toLowerCase();
    if (disposed) return false;
    if (active) {
      if (SKIP_KEYS.has(k) && !event?.repeat) beginReturn(1);
      return true;
    }
    if (free) {
      if (k === 'c' && !engine.isPhotoMode?.()) {
        if (!event?.repeat) beginReturn(0.8);
        return true;
      }
      if (k === 'escape' && !engine.isPhotoMode?.()) { beginReturn(0.8); return true; }
      if (FLIGHT_KEYS.has(k)) { held.add(k); return true; }
      // P, Space and Escape reach the photo module, including while it holds a lock.
      return false;
    }
    return k === 'c' && !event?.repeat ? enterFree() : false;
  }

  on(window, 'keyup', event => held.delete(event.key.toLowerCase()));
  on(window, 'blur', () => { held.clear(); dragging = null; });
  on(document, 'visibilitychange', () => { held.clear(); dragging = null; });
  on(window, 'mousedown', event => {
    if ((!free && !active) || event.target !== engine.canvas || event.button !== 0) return;
    if (free) dragging = { x: event.clientX, y: event.clientY };
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  on(window, 'mousemove', event => {
    if (!free || !dragging) return;
    free.yaw -= (event.clientX - dragging.x) * 0.004;
    free.pitch = Math.max(-1.52, Math.min(1.52, free.pitch - (event.clientY - dragging.y) * 0.004));
    dragging = { x: event.clientX, y: event.clientY };
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  on(window, 'mouseup', () => { dragging = null; });
  on(window, 'wheel', event => {
    if (!free && !active) return;
    if (free) free.speed = Math.max(2, Math.min(120, free.speed * Math.exp(-event.deltaY * 0.0015)));
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });
  on(window, 'lmu:intro', () => { void play('intro'); });
  const unsubscribe = story?.subscribe?.((state, previous, event) => {
    stage = state.stage;
    if (event?.type === 'RESTART' || (stage === 'meet' && previous?.stage !== 'meet')) {
      stop();
      endingDelay = null;
      fountainPlayed = endingPlayed = false;
    }
    if (stage === 'done' && previous?.stage !== 'done' && !endingPlayed) endingDelay = 3.5;
    if (stage !== 'done') endingDelay = null;
  });

  const api = {
    update(dt = 0, et = 0) {
      if (disposed) return;
      void et;
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
      if (active) {
        // If another module replaces our override, release our own lock and promise.
        if (engine.cameraOverride !== renderCamera) finish();
        else {
          active.elapsed += step;
          if (active.kind === 'sequence') {
            const { spec, elapsed } = active;
            if (elapsed >= spec.duration - spec.handoff) {
              draw(sequencePose(active, spec.duration - spec.handoff));
              const overflow = elapsed - (spec.duration - spec.handoff);
              beginReturn(spec.handoff);
              active.elapsed = overflow;
            } else {
              const card = spec.captions.find(c => elapsed >= c.start && elapsed <= c.end);
              if (card) {
                if (title.textContent !== card.title) title.textContent = card.title;
                if (subtitle.textContent !== card.subtitle) subtitle.textContent = card.subtitle;
                const opacity = Math.min(clamp01((elapsed - card.start) / 0.75), clamp01((card.end - elapsed) / 0.75));
                caption.style.opacity = String(opacity);
                caption.style.transform = `translateY(${(1 - opacity) * 8}px)`;
              } else clearCaption();
            }
          }
        }
      }
      if (free) {
        if (engine.cameraOverride !== renderCamera) finish();
        else {
          root.classList.toggle('dcin-photo', !!engine.isPhotoMode?.());
          rotation.set(free.pitch, free.yaw, 0, 'YXZ');
          move.set(Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft')), 0,
            Number(held.has('s') || held.has('arrowdown')) - Number(held.has('w') || held.has('arrowup')));
          move.applyEuler(rotation);
          move.y += Number(held.has('e')) - Number(held.has('q'));
          if (move.lengthSq() > 0) move.normalize();
          free.position.addScaledVector(move, step * free.speed * (held.has('shift') ? 3 : 1));
        }
      }
      if (endingDelay !== null) {
        endingDelay = Math.max(0, endingDelay - step);
        if (endingDelay === 0 && available() && !queued) {
          endingDelay = null;
          endingPlayed = true;
          void play('ending');
        }
      }
      if (stage === 'fountain_talk' && !fountainPlayed && available() && !queued) {
        const point = engine.route?.POIS?.fountain;
        if (point && Math.hypot(engine.player.pos.x - point.x, engine.player.pos.z - point.z) <= 12) {
          fountainPlayed = true;
          void play('fountain');
        }
      }
      startQueued();
    },
    handleKey, play, stop,
    isPlaying: () => !!active,
    isFreeCam: () => !!free,
    dispose() {
      if (disposed) return;
      if (queued) { queued.resolve(); queued = null; }
      if (active || free) finish();
      disposed = true;
      unsubscribeLocale();
      unsubscribe?.();
      listeners.forEach(remove => remove());
      root.remove();
      if (ownsStylesheet) stylesheet.remove();
      instances.delete(engine);
    },
  };
  instances.set(engine, api);
  return api;
}
