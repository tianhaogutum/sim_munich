/** Simulated weather/time controls. No live weather, clock, or geographical claims. */
export const WEATHER = Object.freeze(['clear', 'overcast', 'rain']);
export const TIMES = Object.freeze(['daylight', 'dusk', 'night']);
const SAVE_KEY = 'munich-city-atmosphere-v1';
const LABELS = { clear: '晴朗', overcast: '阴天', rain: '下雨', daylight: '白昼', dusk: '黄昏', night: '夜晚' };
const PAINT = { background: ['background-color'], fill: ['fill-color', 'fill-outline-color'], line: ['line-color'], 'fill-extrusion': ['fill-extrusion-color'], symbol: ['text-color', 'text-halo-color'] };
const TIME = {
  daylight: { gain: [1, 1, 1], bias: [0, 0, 0], sun: 1, ambient: 1, color: '#ffffff', blend: 0, mapIntensity: .5 },
  dusk: { gain: [.66, .49, .55], bias: [23, 14, 27], sun: .58, ambient: .68, color: '#ffb188', blend: .35, mapIntensity: .35 },
  night: { gain: [.16, .23, .37], bias: [5, 9, 19], sun: .16, ambient: .36, color: '#9fbfff', blend: .55, mapIntensity: .2 },
};
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export function normalizeAtmosphere(value) {
  return { weather: WEATHER.includes(value?.weather) ? value.weather : 'clear', time: TIMES.includes(value?.time) ? value.time : 'daylight' };
}
export function rainBudget(settings = {}) {
  if (settings.reducedMotion) return 0;
  return ({ low: 24, medium: 60, high: 100 })[settings.quality] ?? 60;
}

/** MapLibre color expression: preserve data/zoom expressions and their alpha. */
export function atmospherePaint(original, state, property = '') {
  const { weather, time } = normalizeAtmosphere(state);
  if (time === 'daylight' && weather === 'clear') return clone(original);
  // Legacy stop objects are left intact; wrapping those in an expression is invalid.
  if (original === undefined || original === null || (!Array.isArray(original) && typeof original === 'object')) return clone(original);
  const profile = TIME[time];
  const cloud = weather === 'clear' ? 1 : weather === 'overcast' ? .84 : .72;
  const text = property === 'text-color' && time !== 'daylight';
  const halo = property === 'text-halo-color' && time !== 'daylight';
  const gain = text ? [.2, .2, .2] : profile.gain.map(n => n * cloud);
  const bias = text ? [174, 183, 202] : halo ? [1, 2, 4] : profile.bias;
  const channel = i => ['min', 255, ['max', 0, ['+', ['*', ['at', i, ['var', 'cityAtmosphereColor']], halo ? .06 : gain[i]], bias[i]]]];
  return ['let', 'cityAtmosphereColor', ['to-rgba', clone(original)], ['rgba', channel(0), channel(1), channel(2), ['at', 3, ['var', 'cityAtmosphereColor']]]];
}

export function createFeature(engine) {
  const { map, document: doc, window: win, THREE } = engine;
  let disposed = false, state = normalizeAtmosphere(), settings = engine.getSettings?.() ?? {};
  try { state = normalizeAtmosphere(JSON.parse(engine.storage?.getItem(SAVE_KEY) ?? 'null')); } catch { /* Storage is optional. */ }
  let paintOriginals = new Map(), originalMapLight, hasMapLight = false;
  const lights = new Map(), listeners = [], controls = {};
  const panel = engine.createPanel('city-atmosphere', { title: '天气与时段', key: 't' });
  panel.body.classList.add('city-atmosphere-panel');
  const intro = doc.createElement('p');
  intro.textContent = '游戏效果 · 自由切换晴雨与时段；不是实时天气、太阳位置或真实照度。仅改变画面，不改变步速、任务或碰撞。';
  panel.body.appendChild(intro);
  for (const [name, values, title] of [['weather', WEATHER, '天气'], ['time', TIMES, '时段']]) {
    const field = doc.createElement('fieldset'), legend = doc.createElement('legend');
    legend.textContent = title; field.appendChild(legend);
    for (const value of values) {
      const button = doc.createElement('button');
      button.type = 'button'; button.textContent = LABELS[value];
      const change = () => setAtmosphere({ [name]: value });
      button.addEventListener('click', change); listeners.push(() => button.removeEventListener('click', change));
      controls[value] = button; field.appendChild(button);
    }
    panel.body.appendChild(field);
  }
  const status = doc.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); panel.body.appendChild(status);
  const reset = doc.createElement('button'); reset.type = 'button'; reset.textContent = '恢复晴朗白昼';
  const resetAction = () => setAtmosphere({ weather: 'clear', time: 'daylight' });
  reset.addEventListener('click', resetAction); listeners.push(() => reset.removeEventListener('click', resetAction)); panel.body.appendChild(reset);
  const credits = doc.createElement('p'); credits.className = 'city-atmosphere-credits';
  credits.textContent = '效果说明：地图使用原底图颜色的明暗变换；人物使用场景原有灯光；雨丝为有数量上限的程序化屏幕效果，不是三维降水模拟。低画质减少雨丝，减少动态效果时关闭雨丝。';
  panel.body.appendChild(credits);

  const canvas = doc.createElement('canvas'); canvas.className = 'city-atmosphere-rain';
  canvas.setAttribute('aria-hidden', 'true');
  // Essential overlay properties also work when optional feature CSS was not loaded.
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '2' });
  const container = map.getContainer?.() ?? engine.ui;
  container?.appendChild(canvas);
  let ctx; try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  const motionPreference = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const rainSettings = () => ({ ...settings, reducedMotion: Boolean(settings.reducedMotion || motionPreference?.matches) });
  let width = 1, height = 1, elapsed = 0, drops = [], observer;
  function resize() {
    const rect = container?.getBoundingClientRect?.();
    width = Math.max(1, rect?.width || canvas.clientWidth || 1); height = Math.max(1, rect?.height || canvas.clientHeight || 1);
    const dpr = Math.min(1.5, Math.max(1, win?.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (win?.ResizeObserver && container) { observer = new win.ResizeObserver(resize); observer.observe(container); }
  else if (win?.addEventListener) { win.addEventListener('resize', resize); listeners.push(() => win.removeEventListener('resize', resize)); }
  resize();

  function syncRain() {
    const count = state.weather === 'rain' && ctx ? rainBudget(rainSettings()) : 0;
    drops = Array.from({ length: count }, (_, i) => ({ x: ((i * .61803398875) % 1) * width, y: ((i * .41421356237) % 1) * height, speed: 250 + (i % 7) * 25 }));
    elapsed = 0; canvas.hidden = count === 0; ctx?.clearRect(0, 0, width, height);
  }
  function syncControls() {
    for (const value of WEATHER) controls[value].setAttribute('aria-pressed', String(state.weather === value));
    for (const value of TIMES) controls[value].setAttribute('aria-pressed', String(state.time === value));
    status.textContent = `游戏效果：${LABELS[state.weather]} · ${LABELS[state.time]}${state.weather === 'rain' ? rainSettings().reducedMotion ? ' · 雨丝已按减少动态效果设置关闭' : ` · 雨丝上限 ${ctx ? rainBudget(rainSettings()) : 0}` : ''}`;
  }
  function snapshotMap() {
    for (const layer of map.getStyle?.()?.layers ?? []) {
      if (!PAINT[layer.type]) continue;
      for (const property of PAINT[layer.type]) {
        const key = `${layer.id}\0${property}`;
        if (paintOriginals.has(key)) continue;
        const original = map.getPaintProperty?.(layer.id, property) ?? layer.paint?.[property];
        if (original !== undefined) paintOriginals.set(key, { id: layer.id, property, original: clone(original) });
      }
    }
    if (!hasMapLight && map.getLight) {
      try { originalMapLight = clone(map.getLight()); hasMapLight = originalMapLight != null; } catch { /* A style can be between loads. */ }
    }
  }
  function applyMap() {
    snapshotMap();
    for (const { id, property, original } of paintOriginals.values()) {
      if (!map.getLayer?.(id)) continue;
      try { map.setPaintProperty(id, property, atmospherePaint(original, state, property)); } catch { /* Unsupported paint in a different style. */ }
    }
    if (hasMapLight && map.setLight) {
      try {
        const baseline = state.time === 'daylight' && state.weather === 'clear';
        const profile = TIME[state.time], cloud = state.weather === 'clear' ? 1 : state.weather === 'overcast' ? .72 : .6;
        map.setLight(baseline ? clone(originalMapLight) : { ...clone(originalMapLight), color: profile.color, intensity: profile.mapIntensity * cloud }, { duration: 0 });
      } catch { /* Styles without a global light still receive paint changes. */ }
    }
    map.triggerRepaint?.();
  }
  function applyLights() {
    const profile = TIME[state.time], cloud = state.weather === 'clear' ? 1 : state.weather === 'overcast' ? .76 : .64;
    engine.cast?.scene?.traverse(object => {
      if (!object.isLight) return;
      if (!lights.has(object)) lights.set(object, { intensity: object.intensity, color: object.color?.clone(), groundColor: object.groundColor?.clone() });
      const original = lights.get(object);
      object.intensity = original.intensity * (object.isDirectionalLight ? profile.sun : profile.ambient) * cloud;
      for (const key of ['color', 'groundColor']) {
        if (!original[key] || !object[key]?.copy) continue;
        object[key].copy(original[key]);
        if (THREE?.Color && profile.blend > 0) object[key].lerp(new THREE.Color(profile.color), profile.blend);
      }
    });
  }
  function setAtmosphere(patch = {}) {
    if (disposed) return { ...state };
    state = normalizeAtmosphere({ ...state, ...patch });
    applyMap(); applyLights(); syncRain(); syncControls();
    try { engine.storage?.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Quota/privacy must not block play. */ }
    return { ...state };
  }
  function styleLoaded() {
    // New style means a new baseline; never tint an already tinted color again.
    paintOriginals = new Map(); hasMapLight = false; originalMapLight = undefined;
    if (!disposed) applyMap();
  }
  const motionChanged = () => { if (!disposed) { syncRain(); syncControls(); } };
  motionPreference?.addEventListener?.('change', motionChanged);
  listeners.push(() => motionPreference?.removeEventListener?.('change', motionChanged));
  map.on?.('style.load', styleLoaded);
  const unsubscribeSettings = engine.onSettings?.(next => { if (disposed) return; settings = next ?? engine.getSettings?.() ?? {}; syncRain(); syncControls(); });
  let unregisterDispose;
  function dispose() {
    if (disposed) return;
    disposed = true;
    map.off?.('style.load', styleLoaded); unsubscribeSettings?.(); observer?.disconnect();
    for (const remove of listeners) remove();
    canvas.remove(); drops = [];
    for (const { id, property, original } of paintOriginals.values()) {
      try { if (map.getLayer?.(id)) map.setPaintProperty(id, property, clone(original)); } catch { /* Map may already be removed. */ }
    }
    try { if (hasMapLight) map.setLight?.(clone(originalMapLight), { duration: 0 }); } catch { /* Map teardown. */ }
    for (const [light, original] of lights) {
      light.intensity = original.intensity;
      for (const key of ['color', 'groundColor']) if (original[key]) light[key]?.copy(original[key]);
    }
    lights.clear(); paintOriginals.clear(); panel.dispose(); unregisterDispose?.(); map.triggerRepaint?.();
  }
  applyMap(); applyLights(); syncRain(); syncControls();
  unregisterDispose = engine.onDispose?.(dispose);
  return {
    setAtmosphere,
    getState: () => ({ ...state, particleCount: drops.length }),
    open: () => { if (!disposed) panel.open(); },
    isOpen: () => !disposed && panel.isOpen(),
    handleKey(key, event) {
      if (disposed || key !== 't' || event?.repeat || event?.ctrlKey || event?.metaKey || event?.altKey) return false;
      panel.toggle(); return true;
    },
    update(dt) {
      if (disposed || !drops.length || !ctx || !Number.isFinite(dt) || dt <= 0) return;
      elapsed += Math.min(.1, dt);
      const interval = settings.quality === 'low' ? 1 / 15 : 1 / 30;
      if (elapsed < interval) return;
      const step = Math.min(.1, elapsed); elapsed = 0;
      ctx.clearRect(0, 0, width, height); ctx.strokeStyle = state.time === 'night' ? 'rgba(171,198,232,.5)' : 'rgba(119,157,191,.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const drop of drops) {
        drop.x += step * 45; drop.y += step * drop.speed;
        if (drop.y > height + 15) { drop.y = -15; drop.x %= width; }
        if (drop.x > width + 10) drop.x = -10;
        ctx.moveTo(drop.x, drop.y); ctx.lineTo(drop.x - 2, drop.y - 10);
      }
      ctx.stroke();
    },
    dispose,
  };
}
