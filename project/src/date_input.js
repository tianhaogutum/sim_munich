// Touch + standard-mapping gamepad adapter for the existing keyboard-driven entry.
// Wiring: const input = createInput(engine, story); then input.update(dt) each frame.
// No scene, story, shared HUD, or entry-point mutations are made here.
let currentInput = null;

const MOVE_KEYS = ['w', 'a', 's', 'd', 'Shift'];
const KEY_CODES = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', Shift: 'ShiftLeft',
  e: 'KeyE', p: 'KeyP', ' ': 'Space', Escape: 'Escape', Enter: 'Enter' };

export function createInput(engine, story) {
  // Hot reload / repeated construction must not leave a second set of controls.
  currentInput?.dispose();
  const listeners = [];
  let disposed = false;
  let suspended = document.hidden;
  let touchSeen = false;
  const forced = new URLSearchParams(location.search).get('touch') === '1';
  const coarse = window.matchMedia?.('(pointer: coarse)');
  const isTouch = () => forced || touchSeen || !!coarse?.matches;
  const locked = () => !!engine?.isLocked?.();
  const photoMode = () => !!engine?.isPhotoMode?.();

  let stylesheet = document.querySelector('link[data-date-input-style]');
  const ownsStylesheet = !stylesheet;
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./date_input.css', import.meta.url).href;
    stylesheet.dataset.dateInputStyle = '';
    document.head.appendChild(stylesheet);
  }

  const root = document.createElement('div');
  root.id = 'date-input-root';
  root.className = 'di-root';
  root.hidden = !isTouch();
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '触屏游戏控制');
  root.innerHTML = `
    <div class="di-look" aria-hidden="true">
      <span class="di-look-hint di-hint">拖动转身 · 双指缩放</span>
    </div>
    <button class="di-hud-toggle" type="button" aria-pressed="false"
      title="隐藏或显示触屏控制的 HUD 提示">隐藏 HUD 提示</button>
    <div class="di-movement">
      <div class="di-joystick" role="group" aria-label="移动摇杆：推至边缘奔跑">
        <span class="di-stick-ring"></span>
        <span class="di-stick-mark di-stick-up">▲</span>
        <span class="di-stick-mark di-stick-right">›</span>
        <span class="di-stick-mark di-stick-down">▼</span>
        <span class="di-stick-mark di-stick-left">‹</span>
        <span class="di-stick-knob"></span>
      </div>
      <span class="di-move-hint di-hint">移动 · 推远奔跑</span>
    </div>
    <div class="di-actions">
      <div class="di-context di-hint" aria-live="polite"></div>
      <button class="di-button di-interact" data-di-action="interact" type="button">互动</button>
      <button class="di-button di-photo" data-di-action="photo" type="button">拍照</button>
      <button class="di-button di-shutter" data-di-action="shutter" type="button" hidden>快门</button>
      <button class="di-button di-back" data-di-action="back" type="button">返回</button>
    </div>`;
  document.body.appendChild(root);

  const joystick = root.querySelector('.di-joystick');
  const knob = root.querySelector('.di-stick-knob');
  const look = root.querySelector('.di-look');
  const interact = root.querySelector('.di-interact');
  const photo = root.querySelector('.di-photo');
  const shutter = root.querySelector('.di-shutter');
  const context = root.querySelector('.di-context');
  const hudToggle = root.querySelector('.di-hud-toggle');
  const touchKeys = new Set();
  const padKeys = new Set();
  const heldKeys = new Set();
  const physicalKeys = new Set();
  const lookPointers = new Map();
  const padButtons = new Map();
  let stickPointer = null;
  let pinchDistance = 0;
  let padNeedsBaseline = true;
  let uiElapsed = 0;
  let lastLocked = null;
  let lastPhoto = null;

  function on(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    listeners.push(() => target.removeEventListener(type, listener, options));
  }

  function key(type, name) {
    window.dispatchEvent(new KeyboardEvent(type, {
      key: name, code: KEY_CODES[name] ?? '', bubbles: true, cancelable: true,
      shiftKey: name === 'Shift' || heldKeys.has('Shift'),
    }));
  }

  function tap(name) {
    if (disposed || suspended) return;
    key('keydown', name);
    key('keyup', name);
  }

  function syncMovement() {
    const allow = !disposed && !suspended && !locked();
    for (const name of MOVE_KEYS) {
      const wanted = allow && (touchKeys.has(name) || padKeys.has(name));
      if (wanted === heldKeys.has(name)) continue;
      if (wanted) {
        heldKeys.add(name);
        key('keydown', name);
      } else {
        heldKeys.delete(name);
        // Releasing the stick should not cancel a real keyboard key being held.
        if (!physicalKeys.has(name)) key('keyup', name);
      }
    }
  }

  // Map to eight sectors, rather than favouring diagonals close to a cardinal axis.
  function mapStick(set, x, y, deadzone) {
    set.clear();
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude < deadzone) return;
    const angle = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * Math.PI / 4;
    const dx = Math.round(Math.cos(angle));
    const dy = Math.round(Math.sin(angle));
    if (dx < 0) set.add('a');
    if (dx > 0) set.add('d');
    if (dy < 0) set.add('w');
    if (dy > 0) set.add('s');
    if (magnitude >= 0.8) set.add('Shift');
  }

  function moveStick(event) {
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, rect.width * 0.31);
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
    joystick.classList.toggle('di-running', length >= 0.8);
    mapStick(touchKeys, x, y, 0.2);
    syncMovement();
  }

  function capture(target, event) {
    // Synthetic pointer tests have no active hardware pointer to capture.
    try { target.setPointerCapture(event.pointerId); } catch { /* window fallback below */ }
  }

  function releaseCapture(target, id) {
    try { if (target.hasPointerCapture(id)) target.releasePointerCapture(id); } catch { /* removed pointer */ }
  }

  function releaseStick() {
    const id = stickPointer;
    stickPointer = null;
    if (id !== null) releaseCapture(joystick, id);
    touchKeys.clear();
    knob.style.transform = '';
    joystick.classList.remove('di-running', 'di-engaged');
    syncMovement();
  }

  function reset() {
    releaseStick();
    const ids = [...lookPointers.keys()];
    lookPointers.clear();
    ids.forEach(id => releaseCapture(look, id));
    pinchDistance = 0;
    padKeys.clear();
    padButtons.clear();
    padNeedsBaseline = true;
    syncMovement();
  }

  function action(name) {
    if (name === 'interact') {
      // Check before dispatch: opening a dialogue must not immediately skip its first line.
      tap(locked() ? 'Enter' : 'e');
    } else if (name === 'photo') tap('p');
    else if (name === 'shutter' && photoMode()) tap(' ');
    else if (name === 'back') tap('Escape');
    updateUI();
    syncMovement();
  }

  function updateUI() {
    if (disposed) return;
    const active = isTouch();
    const isLocked = locked();
    const isPhoto = photoMode();
    lastLocked = isLocked;
    lastPhoto = isPhoto;
    root.hidden = !active;
    root.classList.toggle('di-locked', isLocked);
    root.classList.toggle('di-photo-mode', isPhoto);
    // Leave camera gestures available in photo mode even if it locks movement.
    look.hidden = isLocked && !isPhoto;
    photo.hidden = isLocked && !isPhoto;
    shutter.hidden = !isPhoto;
    interact.textContent = isLocked ? '确认' : '互动';
    interact.setAttribute('aria-label', isLocked ? '确认对话' : '互动');
    photo.textContent = isPhoto ? '收起相机' : '拍照';
    if (!active) return;
    const prompt = document.getElementById('prompt');
    const visible = prompt && !prompt.hidden && getComputedStyle(prompt).display !== 'none';
    const text = isLocked ? '轻触确认继续' : visible
      ? prompt.textContent.replace(/^\s*E\s*/i, '').trim() : '';
    if (context.textContent !== text) context.textContent = text;
  }

  on(window, 'touchstart', () => { touchSeen = true; updateUI(); }, { passive: true, capture: true });
  on(window, 'pointerdown', event => {
    if (event.pointerType === 'touch') { touchSeen = true; updateUI(); }
  }, { passive: true, capture: true });
  if (coarse?.addEventListener) on(coarse, 'change', () => { reset(); updateUI(); });

  on(joystick, 'pointerdown', event => {
    if (suspended || locked() || stickPointer !== null || event.button > 0) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    joystick.classList.add('di-engaged');
    capture(joystick, event);
    moveStick(event);
  });

  function distance() {
    const [a, b] = [...lookPointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  on(look, 'pointerdown', event => {
    if (suspended || (locked() && !photoMode()) || event.button > 0 || lookPointers.size >= 2) return;
    event.preventDefault();
    lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capture(look, event);
    pinchDistance = distance();
  });

  on(window, 'pointermove', event => {
    if (event.pointerId === stickPointer) {
      event.preventDefault();
      if (locked()) releaseStick();
      else moveStick(event);
    }
    const previous = lookPointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    if (suspended || (locked() && !photoMode())) return;
    lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (lookPointers.size === 1) {
      if (Number.isFinite(engine?.player?.yaw)) engine.player.yaw -= (event.clientX - previous.x) * 0.004;
    } else {
      const next = distance();
      if (pinchDistance > 0 && next > 0) {
        // Spreading fingers zooms in (negative wheel delta); closing zooms out.
        window.dispatchEvent(new WheelEvent('wheel', {
          deltaY: (pinchDistance - next) * 2, deltaMode: 0, bubbles: true, cancelable: true,
        }));
      }
      pinchDistance = next;
    }
  }, { passive: false });

  function endPointer(event) {
    if (event.pointerId === stickPointer) releaseStick();
    if (lookPointers.delete(event.pointerId)) {
      releaseCapture(look, event.pointerId);
      pinchDistance = distance();
    }
  }
  on(window, 'pointerup', endPointer);
  on(window, 'pointercancel', () => reset());
  on(joystick, 'lostpointercapture', endPointer);
  on(look, 'lostpointercapture', endPointer);
  on(window, 'resize', reset);

  // These touches belong to the overlay, never the entry's canvas touch orbit.
  const preventGesture = event => {
    // Do not cancel a button's touchstart: browsers need it to synthesize click.
    if (event.target.closest('.di-joystick, .di-look')) event.preventDefault();
  };
  on(root, 'touchstart', preventGesture, { passive: false });
  on(root, 'touchmove', preventGesture, { passive: false });
  on(root, 'click', event => {
    const button = event.target.closest('[data-di-action]');
    if (button && root.contains(button)) { event.preventDefault(); action(button.dataset.diAction); }
  });
  on(hudToggle, 'click', () => {
    const hidden = root.classList.toggle('di-hints-hidden');
    hudToggle.textContent = hidden ? '显示 HUD 提示' : '隐藏 HUD 提示';
    hudToggle.setAttribute('aria-pressed', String(hidden));
  });

  on(window, 'keydown', event => {
    if (!event.isTrusted) return;
    const name = event.key.toLowerCase() === 'shift' ? 'Shift' : event.key.toLowerCase();
    if (MOVE_KEYS.includes(name)) physicalKeys.add(name);
  });
  on(window, 'keyup', event => {
    if (!event.isTrusted) return;
    const name = event.key.toLowerCase() === 'shift' ? 'Shift' : event.key.toLowerCase();
    physicalKeys.delete(name);
    // The entry has just handled the real keyup; keep a still-held virtual key down.
    if (heldKeys.has(name)) key('keydown', name);
  });
  on(window, 'blur', () => { suspended = true; physicalKeys.clear(); reset(); });
  on(window, 'focus', () => { suspended = document.hidden; padNeedsBaseline = true; });
  on(document, 'visibilitychange', () => {
    suspended = document.hidden;
    physicalKeys.clear();
    reset();
  });
  on(window, 'gamepaddisconnected', () => { padKeys.clear(); padButtons.clear(); syncMovement(); });

  function pollGamepads(dt) {
    padKeys.clear();
    let pads;
    // Some embedding contexts disallow access to the gamepad API.
    try { pads = navigator.getGamepads?.() ?? []; } catch { pads = []; }
    const present = new Set();
    const editing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
    for (const pad of pads) {
      if (!pad || pad.connected === false || pad.mapping !== 'standard') continue;
      present.add(pad.index);
      const pressed = pad.buttons.map(button => button.pressed || button.value > 0.5);
      const before = padButtons.get(pad.index);
      padButtons.set(pad.index, pressed);
      if (suspended || editing) continue;
      const movement = new Set();
      mapStick(movement, pad.axes[0] || 0, pad.axes[1] || 0, 0.2);
      movement.forEach(name => padKeys.add(name));
      const rx = pad.axes[2] || 0;
      if (Math.abs(rx) > 0.2 && (!locked() || photoMode()) && Number.isFinite(engine?.player?.yaw)) {
        engine.player.yaw -= Math.sign(rx) * (Math.abs(rx) - 0.2) / 0.8 * 2.4 * dt;
      }
      if (padNeedsBaseline || !before) continue;
      const down = index => pressed[index] && !before[index];
      if (down(0)) action('interact');
      if (down(2)) action('photo');
      if (down(1) || down(7)) action('shutter');
      if (down(9)) action('back');
    }
    for (const index of padButtons.keys()) if (!present.has(index)) padButtons.delete(index);
    padNeedsBaseline = false;
  }

  const api = {
    update(dt = 0) {
      if (disposed) return;
      if (locked() && stickPointer !== null) releaseStick();
      pollGamepads(Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0);
      syncMovement();
      uiElapsed += Number.isFinite(dt) ? Math.max(0, dt) : 0;
      if (uiElapsed >= 0.1 || lastLocked !== locked() || lastPhoto !== photoMode()) {
        updateUI();
        uiElapsed = 0;
      }
    },
    dispose() {
      if (disposed) return;
      suspended = true;
      reset();
      disposed = true;
      listeners.forEach(remove => remove());
      root.remove();
      if (ownsStylesheet) stylesheet.remove();
      if (currentInput === api) currentInput = null;
    },
    isTouch,
  };
  currentInput = api;
  updateUI();
  return api;
}
