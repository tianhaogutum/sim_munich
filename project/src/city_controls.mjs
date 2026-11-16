// Host calls update once per frame, before consuming external input.
const ZERO = Object.freeze({ right: 0, forward: 0, run: false, lookX: 0, lookY: 0 });
const DEADZONE = 0.18;
const finite = value => Number.isFinite(value) ? value : 0;

/** Radial deadzone preserves direction and rescales the remaining stick travel. */
export function applyDeadzone(x, y, deadzone = DEADZONE) {
  x = Math.max(-1, Math.min(1, finite(x)));
  y = Math.max(-1, Math.min(1, finite(y)));
  deadzone = Math.max(0, Math.min(0.95, finite(deadzone)));
  const length = Math.hypot(x, y);
  if (length <= deadzone || !length) return { x: 0, y: 0 };
  const scale = (Math.min(1, length) - deadzone) / (1 - deadzone) / length;
  return { x: x * scale, y: y * scale };
}

/** Only the standard mapping is safe to interpret without device calibration. */
export function readGamepad(pad) {
  if (!pad || pad.connected === false || pad.mapping !== 'standard') {
    return { ...ZERO, interact: false, close: false };
  }
  const move = applyDeadzone(pad.axes?.[0], pad.axes?.[1]);
  const look = applyDeadzone(pad.axes?.[2], pad.axes?.[3]);
  const pressed = index => Boolean(pad.buttons?.[index]?.pressed || pad.buttons?.[index]?.value > 0.5);
  return { right: move.x, forward: -move.y || 0, lookX: look.x, lookY: look.y,
    run: pressed(10), interact: pressed(0), close: pressed(1) };
}

export function createFeature(engine) {
  const doc = engine.document, win = engine.window;
  const listeners = [], legacy = [];
  let disposed = false, suspended = doc.hidden === true, wasBlocked = false;
  let needsNeutral = suspended, activePad = null, previousA = false, previousB = false;
  let unregister;
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const make = (tag, className, label, text) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (label) element.setAttribute('aria-label', label);
    if (text) element.textContent = text;
    if (tag === 'button') element.type = 'button';
    return element;
  };
  const root = make('div', 'city-controls', '触屏与手柄控制');
  root.setAttribute('role', 'group');
  const moveZone = make('div', 'city-controls-zone city-controls-move', '拖动移动');
  const lookZone = make('div', 'city-controls-zone city-controls-look', '拖动转动视角');
  const moveKnob = make('span', 'city-controls-knob');
  const lookKnob = make('span', 'city-controls-knob');
  moveKnob.setAttribute('aria-hidden', 'true');
  lookKnob.setAttribute('aria-hidden', 'true');
  moveZone.append(make('span', 'city-controls-label', null, '移动'), moveKnob);
  lookZone.append(make('span', 'city-controls-label', null, '视角'), lookKnob);
  const actions = make('div', 'city-controls-actions');
  const runButton = make('button', 'city-controls-run', '按住奔跑 · 手柄 L3', '跑');
  const interactButton = make('button', 'city-controls-interact', '互动 · 手柄 A', '互动');
  runButton.setAttribute('aria-pressed', 'false');
  actions.append(runButton, interactButton);
  root.append(moveZone, lookZone, actions);
  engine.ui.append(root);
  // Preserve inline declarations exactly, including !important and hidden state.
  for (const element of doc.querySelectorAll('.ci-touch')) {
    legacy.push({ element, hidden: element.hidden, display: element.style.getPropertyValue('display'),
      priority: element.style.getPropertyPriority('display') });
    element.hidden = true;
    element.style.setProperty('display', 'none', 'important');
  }

  const move = { id: null, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
  let runPointer = null;
  const blocked = () => suspended || doc.hidden === true || engine.isInputBlocked();
  function release(element, id) {
    if (id === null) return;
    try { if (element.hasPointerCapture(id)) element.releasePointerCapture(id); } catch { /* capture already gone */ }
  }
  function resetStick(element, knob, state) {
    const id = state.id;
    state.id = null; state.x = 0; state.y = 0;
    knob.style.transform = '';
    element.classList.remove('is-active');
    release(element, id);
  }
  function resetTouch() {
    resetStick(moveZone, moveKnob, move);
    resetStick(lookZone, lookKnob, look);
    const id = runPointer; runPointer = null;
    runButton.setAttribute('aria-pressed', 'false');
    release(runButton, id);
  }
  function clear() {
    resetTouch();
    needsNeutral = true;
    engine.clearInput();
    engine.setInput({ ...ZERO });
  }
  function bindStick(element, knob, state) {
    const position = event => {
      const rect = element.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
      const x = (event.clientX - state.startX) / radius;
      const y = (event.clientY - state.startY) / radius;
      const length = Math.max(1, Math.hypot(x, y));
      state.x = x / length; state.y = y / length;
      knob.style.transform = `translate(${state.x * radius}px, ${state.y * radius}px)`;
    };
    on(element, 'pointerdown', event => {
      if (blocked() || state.id !== null || (event.button != null && event.button !== 0)) return;
      event.preventDefault(); event.stopPropagation();
      state.id = event.pointerId; state.startX = event.clientX; state.startY = event.clientY;
      try { element.setPointerCapture(event.pointerId); } catch { /* window fallback below */ }
      element.classList.add('is-active');
      position(event);
    });
    on(element, 'pointermove', event => {
      if (state.id !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      if (blocked()) { resetStick(element, knob, state); return; }
      position(event);
    });
    const end = event => {
      if (state.id === event.pointerId) resetStick(element, knob, state);
    };
    on(element, 'lostpointercapture', end);
    on(win, 'pointerup', end);
    on(win, 'pointercancel', end);
  }
  bindStick(moveZone, moveKnob, move);
  bindStick(lookZone, lookKnob, look);
  on(runButton, 'pointerdown', event => {
    if (blocked() || runPointer !== null || (event.button != null && event.button !== 0)) return;
    event.preventDefault(); event.stopPropagation();
    runPointer = event.pointerId;
    runButton.setAttribute('aria-pressed', 'true');
    try { runButton.setPointerCapture(event.pointerId); } catch { /* window fallback */ }
  });
  const endRun = event => {
    if (runPointer !== event.pointerId) return;
    const id = runPointer; runPointer = null;
    runButton.setAttribute('aria-pressed', 'false');
    release(runButton, id);
  };
  on(win, 'pointerup', endRun);
  on(win, 'pointercancel', endRun);
  on(runButton, 'lostpointercapture', endRun);
  on(interactButton, 'click', event => {
    event.preventDefault(); event.stopPropagation();
    if (!blocked()) engine.interact();
  });
  on(win, 'blur', () => { suspended = true; clear(); });
  on(win, 'focus', () => { suspended = doc.hidden === true; });
  on(doc, 'visibilitychange', () => {
    suspended = doc.hidden === true;
    clear();
  });
  on(win, 'gamepaddisconnected', event => {
    if (event.gamepad?.index === activePad) {
      activePad = null; previousA = false; previousB = false; clear();
    }
  });

  function update() {
    if (disposed) return;
    let pads = [];
    try { pads = Array.from(win.navigator?.getGamepads?.() || []); } catch { /* insecure/denied context */ }
    const valid = pad => pad && pad.connected !== false && pad.mapping === 'standard';
    const pad = pads.find(pad => valid(pad) && pad.index === activePad) || pads.find(valid);
    const id = pad?.index ?? null;
    if (id !== activePad) {
      if (activePad !== null) needsNeutral = true;
      activePad = id; previousA = false; previousB = false;
    }
    const gamepad = readGamepad(pad);
    const inputBlocked = blocked();
    root.classList.toggle('is-blocked', inputBlocked);
    runButton.disabled = inputBlocked;
    interactButton.disabled = inputBlocked;
    if (inputBlocked && !wasBlocked) clear();
    wasBlocked = inputBlocked;
    // B may dismiss a modal, but never while the window is unfocused/hidden.
    const closeEdge = gamepad.close && !previousB;
    const interactEdge = gamepad.interact && !previousA;
    previousB = gamepad.close; previousA = gamepad.interact;
    if (!suspended && doc.hidden !== true && closeEdge) {
      engine.closePanels(); clear();
      engine.setInput({ ...ZERO });
      return;
    }
    if (inputBlocked) { engine.setInput({ ...ZERO }); return; }
    if (needsNeutral && !gamepad.right && !gamepad.forward && !gamepad.lookX && !gamepad.lookY && !gamepad.run && !gamepad.interact && !gamepad.close) needsNeutral = false;
    const controller = needsNeutral ? ZERO : gamepad;
    const touchMove = applyDeadzone(move.x, move.y, 0.08);
    const touchLook = applyDeadzone(look.x, look.y, 0.08);
    // Prefer an active touch zone to summing two controllers and exceeding bounds.
    const right = move.id !== null ? touchMove.x : controller.right;
    const forward = move.id !== null ? -touchMove.y || 0 : controller.forward;
    const lookX = look.id !== null ? touchLook.x : controller.lookX;
    const lookY = look.id !== null ? touchLook.y : controller.lookY;
    engine.setInput({ right, forward, lookX, lookY, run: runPointer !== null || controller.run });
    if (!needsNeutral && interactEdge) engine.interact();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const remove of listeners.splice(0)) remove();
    clear();
    root.remove();
    for (const { element, hidden, display, priority } of legacy) {
      element.hidden = hidden;
      if (display) element.style.setProperty('display', display, priority);
      else element.style.removeProperty('display');
    }
    unregister?.();
  }
  unregister = engine.onDispose?.(dispose);
  return { update, dispose };
}
