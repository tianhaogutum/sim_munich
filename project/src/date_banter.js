// Ambient speech above the cast; owns only #date-banter-root and date_banter.css.
// createBanter(engine, story) -> { update(dt, et), say(who, text, opts?), handleKey, dispose }
// Construct after cast/storyUI, then update AFTER player, cast and camera updates.
// say accepts 'companion'/'player' (also 'TA'/'我'); opts: priority, duration (seconds), delay.
// Durations include reveal time. Modal/photo time is paused, so reactions survive dialogue.
import { BANTER_POOLS, pickLine } from './date_banter_lines.mjs';
import { ROUTE } from './date_route.mjs';

const MAX_QUEUE = 3;
const MARGIN = 16;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function createBanter(engine, story) {
  // Hot-recreation cleans up its listener and DOM instead of stacking instances.
  document.getElementById('date-banter-root')?.__dbDispose?.();
  let sheet = document.querySelector('link[data-db-styles]');
  if (!sheet) {
    sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('./date_banter.css', import.meta.url).href;
    sheet.dataset.dbStyles = '';
    document.head.appendChild(sheet);
  }
  const root = document.createElement('div');
  root.id = 'date-banter-root';
  root.className = 'db-root';
  root.setAttribute('aria-live', 'off');
  document.body.appendChild(root);

  const { Vector3 } = engine.THREE;
  const head = new Vector3(), projected = new Vector3(), forward = new Vector3();
  const toward = new Vector3();
  const history = new Map();
  const route = engine.route ?? ROUTE;
  const pois = route.POIS ?? ROUTE.POIS;
  const photoTargets = route.PHOTO_TARGETS ?? ROUTE.PHOTO_TARGETS;
  const triggerAt = Object.create(null);
  const context = { now: 0, stage: story.getState().stage, period: 'afternoon' };
  let disposed = false, clock = 0, speechClock = 0, ambientAt = 0, idleFor = 0;
  let runningFor = 0, separatedFor = 0, greeted = false;
  let width = innerWidth, height = innerHeight, needsMeasure = true;
  let previousX = engine.player.pos.x, previousZ = engine.player.pos.z;
  let state = story.getState();
  let reply = null;

  function speaker(who) {
    const el = document.createElement('div');
    el.className = `db-bubble db-${who}`;
    el.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'db-speaker';
    label.textContent = who === 'player' ? '我' : 'TA';
    const content = document.createElement('div');
    content.className = 'db-content';
    const measure = document.createElement('span');
    measure.className = 'db-measure';
    measure.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'db-text';
    content.append(measure, text);
    el.append(label, content);
    root.appendChild(el);
    return { who, el, measure, text, queue: [], active: null, age: 0, shown: -1, measurePending: false,
      w: 0, h: 0, x: 0, y: 0, scale: 1, opacity: 0, anchorX: 0 };
  }
  const companion = speaker('companion'), player = speaker('player');
  const speakers = [companion, player];

  function resize() { width = innerWidth; height = innerHeight; needsMeasure = true; }
  addEventListener('resize', resize);
  // Font metrics may settle after the first bubble has already started.
  document.fonts?.ready.then(() => { if (!disposed) needsMeasure = true; });
  const onSheetLoad = () => { needsMeasure = true; };
  sheet.addEventListener('load', onSheetLoad);

  function start(s, item) {
    s.active = item;
    s.age = 0;
    s.shown = -1;
    s.measure.textContent = item.text;
    s.text.textContent = '';
    s.el.setAttribute('aria-label', `${s.who === 'player' ? '我' : 'TA'}：${item.text}`);
    // The root can be hidden by a modal when a story reaction arrives.
    // Measure only after it is visible again, not while display:none returns zero.
    s.measurePending = true;
  }

  function say(who, text, opts = {}) {
    if (disposed || typeof text !== 'string' || !text.trim()) return false;
    const s = who === 'companion' || who === 'TA' ? companion : who === 'player' || who === '我' ? player : null;
    if (!s) return false;
    const chars = Array.from(text.trim()); // Only at enqueue, never in the render loop.
    // Precompute reveal frames once; the animation never allocates character arrays.
    const reveals = [''];
    for (const char of chars) reveals.push(reveals[reveals.length - 1] + char);
    const item = { text: chars.join(''), reveals, priority: Number.isFinite(opts.priority) ? opts.priority : 1,
      duration: clamp(Number.isFinite(opts.duration) ? opts.duration : 1.6 + .09 * chars.length, 1.6, 6),
      readyAt: speechClock + Math.max(0, Number.isFinite(opts.delay) ? opts.delay : 0) };
    if (!s.active && !s.queue.length && item.readyAt <= speechClock) { start(s, item); return true; }
    if (s.queue.length >= MAX_QUEUE) {
      let lowest = 0;
      for (let i = 1; i < s.queue.length; i++) if (s.queue[i].priority < s.queue[lowest].priority) lowest = i;
      if (item.priority < s.queue[lowest].priority) return false;
      s.queue.splice(lowest, 1); // Oldest of the lowest priority, including equal-priority overflow.
    }
    s.queue.push(item);
    return true;
  }

  function emit(name, canReply = false) {
    context.now = clock;
    context.stage = state.stage;
    const chosen = pickLine(BANTER_POOLS[name], context, history);
    if (!chosen || !say(chosen.who, chosen.text, chosen)) return false;
    history.set(chosen.id, clock);
    history.set(chosen.text, clock);
    if (canReply && chosen.reply && Math.random() < .4) {
      reply = { pool: chosen.reply, at: speechClock + 1.6 + .09 * Array.from(chosen.text).length + .35 };
    }
    return true;
  }

  function resetAmbient() {
    idleFor = runningFor = separatedFor = 0;
    ambientAt = clock + 8;
  }

  function onStory(next, prev, event) {
    if (disposed) return;
    prev ??= state;
    state = next;
    if (event?.type === 'RESTART') {
      for (const s of speakers) { s.active = null; s.queue.length = 0; s.el.style.opacity = '0'; }
      reply = null;
      resetAmbient();
      // Deliberately keep history: restarting never bypasses the repeat window.
    }
    for (const target of photoTargets) {
      if (next.photos?.[target.id] && !prev.photos?.[target.id]) emit(`photo_${target.id}`);
    }
    if (event?.type === 'COLLECT' && next.collected?.[event.id] && !prev.collected?.[event.id]) emit('collected');
    if (event?.type === 'CHOOSE' && next.choices?.[event.id] !== prev.choices?.[event.id]) {
      const option = event.optionIndex ?? event.index ?? event.option;
      if (option === 0 || option === 1 || option === 2 || /^[012]$/.test(String(option))) emit(`choice_${option}`);
    }
    if (next.stage !== prev.stage || event?.type === 'RESTART') {
      emit(`stage_${next.stage}`);
      ambientAt = clock + 10;
      reply = null;
    }
  }
  const unsubscribe = story.subscribe(onStory);

  function trigger(name, cooldown) {
    if (clock < (triggerAt[name] ?? -Infinity) + cooldown) return false;
    if (!emit(name, true)) return false;
    triggerAt[name] = clock;
    ambientAt = clock + 8;
    return true;
  }

  function ambient(dt, speed) {
    idleFor = speed < .12 ? idleFor + dt : 0;
    runningFor = speed > 7 && speed < 20 ? runningFor + dt : 0; // Ignore teleports.
    const p = engine.player.pos;
    const c = engine.companion?.getPosition?.();
    const separation = c ? Math.hypot(c.x - p.x, c.z - p.z) : 0;
    separatedFor = separation > 15 && state.stage !== 'meet' ? separatedFor + dt : 0;
    if (clock < ambientAt || companion.active || companion.queue.length || player.active || player.queue.length) return;
    if (Math.hypot(p.x - pois.white_rose.x, p.z - pois.white_rose.z) < 9) {
      // Respect the memorial: suppress jokes/idle replies throughout this area.
      trigger('white_rose', 120);
      return;
    }
    if (separatedFor >= 3 && trigger('separated', 40)) return;
    if (runningFor >= 2 && trigger('running', 45)) return;
    if (separation > 20) return;
    if (Math.hypot(p.x - pois.fountain.x, p.z - pois.fountain.z) < 12 && trigger('fountain', 120)) return;
    if (p.x > 95 && trigger('road', 120)) return;
    if (Math.abs(p.z - 22) < 4 && trigger('benches', 120)) return;
    const distance = Math.hypot(p.x, p.z);
    if (distance >= 25 && distance <= 70) {
      engine.camera.getWorldDirection(forward);
      toward.set(0, 8, 0).sub(engine.camera.position).normalize();
      if (forward.dot(toward) > .9 && trigger('facade', 120)) return;
    }
    if (idleFor >= 8) {
      const hour = new Date().getHours();
      context.period = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
      if (!greeted) { greeted = emit(context.period); }
      else emit('idle', true);
      ambientAt = clock + 20 + Math.random() * 20;
    }
  }

  function advance(s, dt) {
    if (s.active) {
      s.age += dt;
      if (s.age >= s.active.duration) { s.active = null; s.el.style.opacity = '0'; }
    }
    if (!s.active) {
      let best = -1;
      for (let i = 0; i < s.queue.length; i++) {
        if (s.queue[i].readyAt <= speechClock && (best < 0 || s.queue[i].priority > s.queue[best].priority)) best = i;
      }
      if (best >= 0) start(s, s.queue.splice(best, 1)[0]);
    }
    if (!s.active) { s.opacity = 0; return; }
    const shown = Math.min(s.active.reveals.length - 1, Math.floor(s.age / .045) + 1);
    if (shown !== s.shown) {
      s.text.textContent = s.active.reveals[shown];
      s.shown = shown;
    }
    s.opacity = Math.min(1, s.age / .18, (s.active.duration - s.age) / .35);
  }

  function project(s) {
    if (!s.active) return;
    if (s.who === 'companion') {
      const h = engine.companion?.getHeadPosition?.();
      if (!h) { s.opacity = 0; return; }
      head.copy(h);
    } else head.copy(engine.player.pos).y += 1.75;
    projected.copy(head).applyMatrix4(engine.camera.matrixWorldInverse);
    if (projected.z >= -engine.camera.near) { s.opacity = 0; return; }
    s.scale = clamp(1.1 - head.distanceTo(engine.camera.position) * .007, .78, 1.05);
    projected.copy(head).project(engine.camera);
    if (projected.z < -1 || projected.z > 1) { s.opacity = 0; return; }
    const offscreen = Math.max(Math.abs(projected.x), Math.abs(projected.y));
    s.opacity *= clamp((1.12 - offscreen) / .12, 0, 1);
    s.anchorX = (projected.x * .5 + .5) * width;
    s.x = clamp(s.anchorX - s.w * s.scale / 2, MARGIN, width - MARGIN - s.w * s.scale);
    s.y = clamp((.5 - projected.y * .5) * height - (s.h + 20) * s.scale,
      MARGIN, height - MARGIN - (s.h + 7) * s.scale);
  }

  function position(s) {
    s.el.style.opacity = String(Math.max(0, s.opacity));
    if (!s.active || s.opacity <= 0) { s.el.setAttribute('aria-hidden', 'true'); return; }
    s.el.setAttribute('aria-hidden', 'false');
    s.el.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0) scale(${s.scale.toFixed(3)})`;
    s.el.style.setProperty('--db-tail-x', `${clamp((s.anchorX - s.x) / s.scale - 5, 12, s.w - 22).toFixed(1)}px`);
  }

  function update(dt, et) {
    if (disposed) return;
    void et; // One accumulated clock also works with callers whose et begins at zero.
    dt = Number.isFinite(dt) ? clamp(dt, 0, .25) : 0;
    clock += dt;
    const p = engine.player.pos;
    const speed = dt > 0 ? Math.hypot(p.x - previousX, p.z - previousZ) / dt : 0;
    previousX = p.x; previousZ = p.z;
    const hidden = Boolean(engine.isPhotoMode?.() || engine.isLocked?.());
    root.hidden = hidden;
    if (hidden) { resetAmbient(); return; }
    speechClock += dt;
    if (reply && speechClock >= reply.at && !companion.active && !companion.queue.length) {
      const pending = reply;
      reply = null;
      emit(pending.pool);
    }
    ambient(dt, speed);
    engine.camera.updateMatrixWorld(); // The caller may have just changed camera position/lookAt.
    for (let i = 0; i < speakers.length; i++) {
      const s = speakers[i];
      advance(s, dt);
      if ((needsMeasure || s.measurePending) && s.active) {
        s.w = s.el.offsetWidth; s.h = s.el.offsetHeight;
        s.measurePending = false;
      }
      project(s);
    }
    needsMeasure = false;
    if (companion.opacity > 0 && player.opacity > 0 && companion.active && player.active &&
        companion.x < player.x + player.w * player.scale + 8 && companion.x + companion.w * companion.scale + 8 > player.x &&
        companion.y < player.y + player.h * player.scale + 12 && companion.y + companion.h * companion.scale + 12 > player.y) {
      const above = player.y - (companion.h + 16) * companion.scale;
      if (above >= MARGIN) companion.y = above;
      else companion.y = clamp(player.y + player.h * player.scale + 16, MARGIN, height - MARGIN - (companion.h + 7) * companion.scale);
    }
    position(companion);
    position(player);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    removeEventListener('resize', resize);
    sheet.removeEventListener('load', onSheetLoad);
    root.remove();
    history.clear();
    reply = null;
    for (const s of speakers) { s.active = null; s.queue.length = 0; }
  }
  root.__dbDispose = dispose;
  return { update, say, handleKey: () => false, dispose };
}
