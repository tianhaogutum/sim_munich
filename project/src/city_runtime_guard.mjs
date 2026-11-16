/** MapLibre runtime health and host-owned hot-path scheduling. No network prefetch. */
const RETRY_LIMIT = 3;
const RETRY_COOLDOWN_MS = 5000;
const LOAD_WARNING_MS = 15000;
const PERSIST_MS = 1500;
const listen = (target, type, fn, cleanups, map = false) => {
  if (map ? typeof target?.on !== 'function' : typeof target?.addEventListener !== 'function') return;
  if (map) target.on(type, fn); else target.addEventListener(type, fn);
  cleanups.push(() => { if (map) target.off?.(type, fn); else target.removeEventListener?.(type, fn); });
};
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const positive = value => Number.isFinite(value) && value >= 0;

export function createFeature(engine) {
  const { map, document: doc, window: win } = engine;
  const cleanups = [], failed = new Map(), pending = new Set();
  let disposed = false, unregister, badge, label, detail, retryButton, fallbackLink;
  let lastRender = '', retryAttempts = 0, lastRetry = -Infinity, lastCollision = -Infinity, lastPersist = -Infinity;
  let collisionDirty = true, frameMs = null, collisionMs = null, generalError = '', retryNote = '';
  let loadingSince = null, lastSample = -Infinity, lastUI = -Infinity;
  const now = () => safe(() => engine.now(), globalThis.performance?.now?.() ?? Date.now());
  const state = () => safe(() => engine.getState?.() ?? {}, {});
  const offline = () => win?.navigator?.onLine === false;
  const styleLoaded = () => safe(() => map?.isStyleLoaded?.(), undefined);
  const tilesLoaded = () => safe(() => map?.areTilesLoaded?.(), undefined);
  const sourceLoaded = id => safe(() => map?.isSourceLoaded?.(id), undefined);
  const sourceId = event => event?.sourceId ?? event?.source?.id ?? event?.error?.sourceId;
  const message = event => String(event?.error?.message ?? event?.message ?? '地图数据请求失败').slice(0, 280);

  // Consume telemetry only in update, never in should* calls, so a caller's polling
  // frequency cannot change its own scheduling decision. EWMA avoids single-frame flapping.
  function sampleMetrics(t) {
    if (t - lastSample < 100) return;
    lastSample = t;
    for (const key of ['frameMs', 'collisionMs']) {
      const value = engine.metrics?.[key];
      if (!positive(value)) continue;
      if (key === 'frameMs') frameMs = frameMs === null ? value : frameMs * .8 + value * .2;
      else collisionMs = collisionMs === null ? value : collisionMs * .8 + value * .2;
    }
  }
  function throttle() {
    const pressure = frameMs >= 40 || collisionMs >= 12 ? 'high' : frameMs >= 24 || collisionMs >= 5 ? 'moderate' : 'normal';
    return { pressure, collisionIntervalMs: pressure === 'high' ? 600 : pressure === 'moderate' ? 300 : 150,
      persistIntervalMs: pressure === 'high' ? 3000 : PERSIST_MS, frameMs, collisionMs };
  }
  function inspect(t) {
    // isSourceLoaded includes the current viewport. Never infer readiness from
    // an online event, elapsed retry time, or a single tile completing.
    for (const id of [...pending]) if (sourceLoaded(id) === true) pending.delete(id);
    const style = styleLoaded(), tiles = tilesLoaded(), host = state();
    const loaded = style !== false && tiles !== false && !pending.size &&
      (tiles === true || (style === true && host.ready !== false) || host.ready === true);
    if (loaded && !failed.size && !generalError) retryNote = '';
    const loading = !loaded && !failed.size && !generalError;
    if (loading && loadingSince === null) loadingSince = t;
    if (!loading) loadingSince = null;
    const mode = offline() ? 'offline' : failed.size || generalError ? 'error' :
      loading ? (t - loadingSince >= LOAD_WARNING_MS ? 'slow' : 'loading') : 'ready';
    const cooldownMs = Math.max(0, RETRY_COOLDOWN_MS - (t - lastRetry));
    const targets = retryTargets();
    return { mode, sourceReady: host.sourceReady === true, pendingSources: [...pending],
      failedSources: [...failed].map(([id, error]) => ({ id, error })), error: generalError,
      attempts: retryAttempts, retriesRemaining: RETRY_LIMIT - retryAttempts, cooldownMs,
      retrySupported: targets.length > 0,
      canRetry: !disposed && !offline() && retryAttempts < RETRY_LIMIT && cooldownMs === 0 && targets.length > 0,
      retryNote, ...throttle() };
  }
  function retryTargets() {
    if (!failed.size) return [];
    const specs = safe(() => map?.getStyle?.()?.sources, {}) ?? {};
    const targets = [];
    // Only explicitly failed sources are eligible. No reloading every source,
    // fetching tile URLs ourselves, private source caches, or style replacement.
    for (const id of failed.keys()) {
      const source = safe(() => map?.getSource?.(id), null), spec = specs[id];
      if (!source || !spec) continue;
      if (typeof spec.url === 'string' && typeof source.setUrl === 'function') targets.push({ id, run: () => source.setUrl(spec.url) });
      else if (Array.isArray(spec.tiles) && spec.tiles.length && typeof source.setTiles === 'function') targets.push({ id, run: () => source.setTiles([...spec.tiles]) });
      else if (spec.type === 'geojson' && spec.data !== undefined && typeof source.setData === 'function') targets.push({ id, run: () => source.setData(spec.data) });
    }
    return targets;
  }
  function render(t = now()) {
    lastUI = t;
    const s = inspect(t);
    if (!badge) return s;
    const messages = { ready: '地图已加载', loading: '街道数据加载中…', slow: '地图加载较慢', error: '部分地图数据加载失败', offline: '当前离线 · 已加载的街道仍可浏览' };
    const errors = s.failedSources.map(({ id, error }) => `${id}: ${error}`);
    if (s.error) errors.push(s.error);
    if (s.retryNote) errors.push(s.retryNote);
    if (s.pendingSources.length) errors.push(`加载来源：${s.pendingSources.slice(0, 4).join('、')}`);
    if ((s.mode === 'error' || s.mode === 'slow') && !s.retrySupported) errors.push('此请求不能安全地单独重试；可重新载入页面或返回 LMU 场景。');
    const details = errors.join(' · ');
    const buttonText = s.cooldownMs > 0 ? `请等 ${Math.ceil(s.cooldownMs / 1000)} 秒` : `重试失败来源（剩余 ${s.retriesRemaining} 次）`;
    const signature = JSON.stringify([s.mode, details, s.canRetry, buttonText]);
    if (signature !== lastRender) {
      lastRender = signature;
      badge.dataset.state = s.mode;
      label.textContent = messages[s.mode];
      detail.textContent = details;
      detail.hidden = !details;
      retryButton.textContent = buttonText;
      retryButton.disabled = !s.canRetry;
      retryButton.hidden = s.mode === 'ready' || s.mode === 'loading' || s.mode === 'offline';
      fallbackLink.hidden = s.mode === 'ready' || s.mode === 'loading';
    }
    return s;
  }
  function retry() {
    const t = now(), s = inspect(t);
    if (!s.canRetry) { render(t); return false; }
    const targets = retryTargets();
    retryAttempts++; lastRetry = t;
    retryNote = '已请求重试；等待地图来源确认。';
    for (const { id, run } of targets) {
      pending.add(id);
      try { run(); } catch (error) { pending.delete(id); failed.set(id, String(error?.message ?? error).slice(0, 280)); }
    }
    render(t);
    return true;
  }
  function onError(event) {
    if (disposed) return;
    const id = sourceId(event), error = message(event);
    if (typeof id === 'string' && id) { failed.set(id, error); pending.delete(id); }
    else generalError = error;
    render();
  }
  function onSourceLoading(event) {
    const id = sourceId(event);
    if (typeof id === 'string' && id) pending.add(id);
    render();
  }
  function onSourceData(event) {
    const id = sourceId(event);
    const confirmed = event?.isSourceLoaded === true || event?.sourceDataType === 'content';
    if (typeof id === 'string' && id && confirmed && sourceLoaded(id) === true) {
      pending.delete(id); failed.delete(id);
      if (!failed.size && tilesLoaded() === true && styleLoaded() === true) generalError = '';
    }
    if (event?.sourceDataType === 'content' || event?.isSourceLoaded === true) collisionDirty = true;
    render();
  }
  function update() {
    if (disposed) return;
    const t = now(); sampleMetrics(t);
    // UI polling must not itself serialize map style on every animation frame.
    if (t - lastUI >= 200) render(t);
  }
  function shouldRefreshCollision(t = now()) {
    if (disposed || !Number.isFinite(t)) return false;
    // A fixed backstop catches viewport/state changes even with sparse map events.
    if (t - lastCollision < throttle().collisionIntervalMs || (!collisionDirty && t - lastCollision < 2000)) return false;
    lastCollision = t; collisionDirty = false;
    return true;
  }
  function shouldPersist(t = now()) {
    if (disposed || !Number.isFinite(t) || doc?.hidden || t - lastPersist < throttle().persistIntervalMs) return false;
    lastPersist = t;
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.splice(0)) safe(cleanup);
    safe(() => unregister?.());
    badge?.remove(); failed.clear(); pending.clear();
  }

  if (doc?.createElement && engine.ui?.append) {
    badge = doc.createElement('section'); badge.className = 'city-runtime-guard';
    badge.setAttribute('aria-label', '地图连接状态');
    label = doc.createElement('span'); label.className = 'city-runtime-guard__label';
    label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
    detail = doc.createElement('small'); detail.className = 'city-runtime-guard__detail';
    retryButton = doc.createElement('button'); retryButton.type = 'button';
    fallbackLink = doc.createElement('a'); fallbackLink.href = './index.html'; fallbackLink.textContent = '返回 LMU 场景';
    badge.append(label, detail, retryButton, fallbackLink); engine.ui.append(badge);
    listen(retryButton, 'click', retry, cleanups);
  }
  listen(map, 'error', onError, cleanups, true);
  listen(map, 'sourcedataloading', onSourceLoading, cleanups, true);
  listen(map, 'sourcedata', onSourceData, cleanups, true);
  for (const event of ['load', 'styledata', 'idle']) listen(map, event, () => {
    collisionDirty = true;
    if (event !== 'idle' && styleLoaded() === true && tilesLoaded() === true) generalError = '';
    render();
  }, cleanups, true);
  listen(map, 'moveend', () => { collisionDirty = true; }, cleanups, true);
  for (const event of ['online', 'offline']) listen(win, event, () => render(), cleanups);
  listen(doc, 'visibilitychange', () => { collisionDirty = true; render(); }, cleanups);
  // A final flush is separate from the timed gate; no intervals/timers outlive the feature.
  listen(win, 'pagehide', () => { safe(() => engine.persist?.()); }, cleanups);
  unregister = engine.onDispose?.(dispose);
  update();
  return { update, dispose, retry, getStatus: () => inspect(now()), shouldRefreshCollision, shouldPersist };
}
