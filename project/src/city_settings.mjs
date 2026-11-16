/** Settings UI/persistence only; the host applies these values to gameplay. */
export const SETTINGS_STORAGE_KEY = 'munich-city-settings-v1';
export const DEFAULT_SETTINGS = Object.freeze({
  quality: 'medium', sound: true, hints: true,
  moveSensitivity: 1, cameraSensitivity: 1, reducedMotion: false,
});
export const SENSITIVITY_LIMITS = Object.freeze({min: 0.25, max: 2, step: 0.05});
const keys = Object.keys(DEFAULT_SETTINGS);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Whitelist keys, require real booleans/numbers, and never pass saved extras to the host.
export function normalizeSettings(value) {
  const result = {...DEFAULT_SETTINGS};
  if (!isRecord(value)) return result;
  if (['low', 'medium', 'high'].includes(value.quality)) result.quality = value.quality;
  for (const key of ['sound', 'hints', 'reducedMotion']) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  for (const key of ['moveSensitivity', 'cameraSensitivity']) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
      result[key] = Math.max(SENSITIVITY_LIMITS.min, Math.min(SENSITIVITY_LIMITS.max, value[key]));
    }
  }
  return result;
}

function readSettings(storage, fallback = DEFAULT_SETTINGS) {
  try {
    if (!storage?.getItem) return {settings: normalizeSettings(fallback), status: 'unavailable'};
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (raw === null) return {settings: normalizeSettings(fallback), status: 'new'};
    const saved = JSON.parse(raw);
    if (!isRecord(saved) || saved.version !== 1 || !isRecord(saved.settings)) {
      return {settings: {...DEFAULT_SETTINGS}, status: 'corrupt'};
    }
    return {settings: normalizeSettings(saved.settings), status: 'loaded'};
  } catch {
    // Malformed JSON and denied storage both leave a complete safe settings object.
    return {settings: {...DEFAULT_SETTINGS}, status: 'unavailable'};
  }
}

export function loadSettings(storage) {
  return readSettings(storage).settings;
}

export function saveSettings(settings, storage) {
  try {
    if (!storage?.setItem) return false;
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({version: 1, settings: normalizeSettings(settings)}));
    return true;
  } catch {
    return false;
  }
}

export function createFeature(engine) {
  const doc = engine.document;
  // Accessing a storage getter can itself throw in privacy-restricted contexts.
  let storage;
  try { storage = engine.storage; } catch { /* use in-memory settings */ }
  const initial = readSettings(storage, engine.getSettings());
  let settings = initial.settings;
  let disposed = false;
  let applying = false;
  let unsubscribe;
  let unregister;
  const listeners = [];
  const controls = new Map();
  const panel = engine.createPanel('city-settings', {title: '设置', key: 'o', modal: true});
  const root = doc.createElement('div');
  root.className = 'city-settings';
  panel.body.append(root);

  function element(tag, text, parent = root) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  }
  function listen(node, type, fn) {
    node.addEventListener(type, fn);
    listeners.push(() => node.removeEventListener(type, fn));
  }
  const intro = element('p', '设置会立即生效，并保存在此浏览器。按 O 打开或关闭。');
  intro.className = 'city-settings-intro';
  const group = element('fieldset');
  element('legend', '画面、声音与操作', group);

  function row(key, label, description, type) {
    const wrapper = element('div', undefined, group);
    wrapper.className = 'city-settings-row';
    const caption = element('label', label, wrapper);
    const id = `city-settings-${key}`;
    caption.htmlFor = id;
    const control = element(type === 'select' ? 'select' : 'input', undefined, wrapper);
    control.id = id;
    control.name = key;
    if (type !== 'select') control.type = type;
    const help = element('small', description, wrapper);
    help.id = `${id}-help`;
    control.setAttribute('aria-describedby', help.id);
    controls.set(key, {control});
    return control;
  }

  const quality = row('quality', '画面质量', '低：节省性能；中：均衡；高：更多画面细节。', 'select');
  for (const [value, label] of [['low', '低'], ['medium', '中'], ['high', '高']]) {
    const option = element('option', label, quality);
    option.value = value;
  }
  listen(quality, 'change', () => apply({quality: quality.value}));
  for (const [key, label, help] of [
    ['sound', '声音', '允许游戏声音；浏览器可能需要先点击页面才能播放。'],
    ['hints', '操作提示', '显示探索与操作提示。'],
    ['reducedMotion', '减少动态效果', '减少装饰动画与天气动态效果。'],
  ]) {
    const checkbox = row(key, label, help, 'checkbox');
    listen(checkbox, 'change', () => apply({[key]: checkbox.checked}));
  }
  for (const [key, label, help] of [
    ['moveSensitivity', '移动灵敏度', '移动速度倍率，0.25× 至 2.00×；默认 1.00×。'],
    ['cameraSensitivity', '镜头灵敏度', '镜头操作倍率，0.25× 至 2.00×；默认 1.00×。'],
  ]) {
    const slider = row(key, label, help, 'range');
    slider.min = String(SENSITIVITY_LIMITS.min);
    slider.max = String(SENSITIVITY_LIMITS.max);
    slider.step = String(SENSITIVITY_LIMITS.step);
    const output = element('output', undefined, slider.parentNode);
    output.htmlFor = slider.id;
    controls.get(key).output = output;
    listen(slider, 'input', () => apply({[key]: Number(slider.value)}));
  }
  const status = element('p');
  status.className = 'city-settings-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const reset = element('button', '恢复默认设置…');
  reset.type = 'button';
  reset.setAttribute('aria-expanded', 'false');
  reset.setAttribute('aria-controls', 'city-settings-reset-confirm');
  const confirmation = element('div');
  confirmation.id = 'city-settings-reset-confirm';
  confirmation.className = 'city-settings-confirm';
  confirmation.hidden = true;
  confirmation.setAttribute('role', 'group');
  confirmation.setAttribute('aria-labelledby', 'city-settings-reset-label');
  const question = element('p', '恢复所有设置为默认值？探索记录和游戏进度会保留。', confirmation);
  question.id = 'city-settings-reset-label';
  const cancel = element('button', '取消', confirmation);
  const confirm = element('button', '确认恢复默认设置', confirmation);
  cancel.type = confirm.type = 'button';

  function cancelReset(focus = false) {
    confirmation.hidden = true;
    reset.setAttribute('aria-expanded', 'false');
    if (focus) reset.focus();
  }
  function requestReset() {
    if (disposed) return false;
    confirmation.hidden = false;
    reset.setAttribute('aria-expanded', 'true');
    cancel.focus();
    return true;
  }
  listen(reset, 'click', requestReset);
  listen(cancel, 'click', () => cancelReset(true));
  listen(confirm, 'click', () => {
    apply({...DEFAULT_SETTINGS}, true);
    cancelReset(true);
  });

  function render() {
    for (const [key, {control, output}] of controls) {
      if (typeof settings[key] === 'boolean') control.checked = settings[key];
      else control.value = String(settings[key]);
      if (output) {
        const value = `${settings[key].toFixed(2)}×`;
        output.textContent = value;
        control.setAttribute('aria-valuetext', value);
      }
    }
  }
  function persist(resetDone = false) {
    const saved = saveSettings(settings, storage);
    status.textContent = saved
      ? (resetDone ? '已恢复默认设置；探索记录和游戏进度已保留。' : '设置已保存到此浏览器。')
      : (resetDone ? '已恢复默认设置；当前无法保存，重新载入后可能丢失。游戏进度未更改。' : '设置已生效，但当前无法保存到浏览器；重新载入后可能丢失。');
    return saved;
  }
  function apply(patch, resetDone = false) {
    if (disposed) return false;
    settings = normalizeSettings({...settings, ...patch});
    applying = true;
    try { engine.setSettings({...settings}); } finally { applying = false; }
    // Host may sanitize settings further. Its values are authoritative.
    settings = normalizeSettings(engine.getSettings());
    render();
    return persist(resetDone);
  }

  engine.setSettings({...settings});
  settings = normalizeSettings(engine.getSettings());
  render();
  if (initial.status === 'loaded' || initial.status === 'new') {
    status.textContent = initial.status === 'loaded' ? '已载入保存的设置。' : '更改设置后将自动保存。';
  } else {
    status.textContent = '未能读取保存的设置，已使用安全默认值；更改后将尝试重新保存。';
  }
  if (typeof engine.onSettings === 'function') {
    unsubscribe = engine.onSettings(value => {
      if (disposed || applying) return;
      const next = normalizeSettings(value ?? engine.getSettings());
      if (keys.every(key => next[key] === settings[key])) return;
      settings = next;
      render();
      persist();
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    unregister?.();
    for (const remove of listeners) remove();
    root.remove();
    panel.dispose();
  }
  if (typeof engine.onDispose === 'function') unregister = engine.onDispose(dispose);
  return {
    open() { if (!disposed) { cancelReset(); panel.open(); } },
    close() { if (!disposed) { cancelReset(); panel.close(); } },
    isOpen: () => !disposed && panel.isOpen(),
    getSettings: () => ({...settings}),
    requestReset,
    handleKey(key, event) {
      if (disposed) return false;
      if (key === 'o') {
        if (!event?.repeat) { cancelReset(); panel.toggle(); }
        return true;
      }
      if (key === 'escape' && panel.isOpen() && !confirmation.hidden) {
        cancelReset(true);
        return true;
      }
      return false;
    },
    update() { if (!disposed && !panel.isOpen() && !confirmation.hidden) cancelReset(); },
    dispose,
  };
}
