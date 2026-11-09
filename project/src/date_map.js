// North-up navigation for the Munich date chapter. Only owns #date-map-root.
// createMap(engine, story) -> { update(dt, et), handleKey(k, event), dispose() }
import { objectiveFor } from './date_story.mjs';

const TAU = Math.PI * 2;
const TREES = [
  [-54, 16], [-36, 16], [36, 16], [54, 16],
  [-54, 58], [-18, 58], [18, 58], [54, 58],
  [-44, 72], [-22, 72], [22, 72], [44, 72],
  [-90, 20], [-90, 42], [-90, 64], [90, 20], [90, 42], [90, 64],
];
const VISIT_NAMES = {
  entrance: ['LMU 主楼', 'Hauptgebäude'],
  fountain: ['喷泉', 'Brunnen'],
  white_rose: ['白玫瑰纪念地', 'Weiße Rose'],
  our_plaza: ['我们的广场', 'Geschwister-Scholl-Platz'],
};
const EMPTY_STATE = { stage: 'meet' };
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 15 7-7 7 7"/></svg>';

export function createMap(engine = {}, story = {}) {
  let stylesheet = document.querySelector('link[data-date-map-style]');
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./date_map.css', import.meta.url).href;
    stylesheet.dataset.dateMapStyle = '';
    document.head.appendChild(stylesheet);
  }

  const root = document.createElement('div');
  root.id = 'date-map-root';
  root.className = 'dm-root';
  root.innerHTML = `
    <section class="dm-panel" aria-label="约会导航地图">
      <div class="dm-heading"><span>散步地图</span><span class="dm-north">N ↑</span></div>
      <div class="dm-objective"><span class="dm-bearing">${CHEVRON}</span><span class="dm-distance"></span></div>
      <canvas class="dm-canvas" role="img" aria-label="北朝上的广场地图，金色箭头是你，粉色圆点是同伴"></canvas>
      <button class="dm-toggle" type="button" aria-keyshortcuts="N" aria-pressed="false"><span class="dm-mode">附近</span><span><kbd>N</kbd> 全景</span></button>
    </section>
    <div class="dm-edge" hidden aria-hidden="true"><span class="dm-edge-arrow">${CHEVRON}</span><span class="dm-edge-distance"></span></div>
    <div class="dm-location" role="status" aria-live="polite" aria-atomic="true"><span class="dm-location-kicker">漫步 · MÜNCHEN</span><span class="dm-location-title"></span><span class="dm-location-subtitle"></span></div>`;
  (document.body ?? document.documentElement).appendChild(root);

  const panel = root.querySelector('.dm-panel');
  const canvas = root.querySelector('.dm-canvas');
  const ctx = canvas.getContext('2d');
  const bearing = root.querySelector('.dm-bearing');
  const distanceText = root.querySelector('.dm-distance');
  const toggle = root.querySelector('.dm-toggle');
  const modeText = root.querySelector('.dm-mode');
  const edge = root.querySelector('.dm-edge');
  const edgeArrow = root.querySelector('.dm-edge-arrow');
  const edgeDistance = root.querySelector('.dm-edge-distance');
  const location = root.querySelector('.dm-location');
  const locationTitle = root.querySelector('.dm-location-title');
  const locationSubtitle = root.querySelector('.dm-location-subtitle');
  const pois = Object.entries(engine.route?.POIS ?? {}).filter(([, p]) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  const visited = new Set();
  const projected = engine.THREE?.Vector3 ? new engine.THREE.Vector3() : null;
  const viewPoint = engine.THREE?.Vector3 ? new engine.THREE.Vector3() : null;
  let state = null, objectiveId = null, objective = null;
  let overview = false, disposed = false, hidden = false;
  let clock = 0, lastPaint = -1, visitAt = -Infinity, locationActive = false;
  let width = 174, height = 150, dpr = 1, viewportW = innerWidth, viewportH = innerHeight;
  let scale = 1, centerX = 0, centerZ = 0;
  let lastDistanceText = '', lastEdgeText = '';
  let resizePending = true;

  function syncState(next = story.getState?.() ?? EMPTY_STATE, forceReset = false) {
    if (forceReset || (next.stage === 'meet' && state?.stage !== 'meet')) {
      visited.clear();
      visitAt = -Infinity;
      locationActive = false;
      location.classList.remove('dm-location-visible');
    }
    state = next;
    // objectiveFor returns a fresh object; only call it when story state changes.
    objectiveId = objectiveFor(next).poi;
    objective = engine.route?.POIS?.[objectiveId] ?? null;
    if (objective && (!Number.isFinite(objective.x) || !Number.isFinite(objective.z))) objective = null;
    lastPaint = -1;
  }
  syncState();
  const unsubscribe = story.subscribe?.((next, prev, event) => syncState(next, event?.type === 'RESTART'));

  function resize() { resizePending = true; }
  addEventListener('resize', resize);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);

  function toggleMode() {
    if (disposed || hidden || engine.isPhotoMode?.()) return;
    overview = !overview;
    modeText.textContent = overview ? '全景' : '附近';
    toggle.lastElementChild.innerHTML = `<kbd>N</kbd> ${overview ? '跟随' : '全景'}`;
    toggle.setAttribute('aria-pressed', String(overview));
    canvas.setAttribute('aria-label', `${overview ? '广场全景' : '附近'}地图，北朝上，金色箭头是你，粉色圆点是同伴`);
    lastPaint = -1;
  }
  toggle.addEventListener('click', toggleMode);
  // A map tap must not start the scene's mouse/touch camera gesture.
  const stopGesture = event => event.stopPropagation();
  toggle.addEventListener('pointerdown', stopGesture);
  toggle.addEventListener('mousedown', stopGesture);
  toggle.addEventListener('touchstart', stopGesture, { passive: true });

  function mapX(x) { return width * .5 + (x - centerX) * scale; }
  function mapY(z) { return height * .5 + (z - centerZ) * scale; }
  function rect(x, z, w, h, fill, stroke) {
    const px = mapX(x), py = mapY(z);
    ctx.fillStyle = fill;
    ctx.fillRect(px, py, w * scale, h * scale);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .8; ctx.strokeRect(px, py, w * scale, h * scale); }
  }
  function dot(x, z, radius, fill, stroke) {
    ctx.beginPath(); ctx.arc(mapX(x), mapY(z), radius, 0, TAU);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function diamond(x, z, radius, fill) {
    const px = mapX(x), py = mapY(z);
    ctx.beginPath(); ctx.moveTo(px, py - radius); ctx.lineTo(px + radius, py);
    ctx.lineTo(px, py + radius); ctx.lineTo(px - radius, py); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#191725'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  function paint(p, yaw, time) {
    if (!ctx) return;
    scale = overview ? Math.min((width - 12) / 380, (height - 14) / 166) : width / 114;
    centerX = overview ? 0 : p.x;
    centerZ = overview ? 40 : p.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#141822'; ctx.fillRect(0, 0, width, height);
    rect(-210, -52, 420, 182, '#20292c');
    rect(-100, 0, 200, 80, '#41413e', '#626053');
    // Paved entrance axis, plaza path and Ludwigstraße.
    rect(-8, 0, 16, 118, '#565346');
    rect(-100, 77, 200, 5, '#595648');
    rect(112, -180, 33, 420, '#292a33', '#626052');
    ctx.beginPath(); ctx.moveTo(mapX(128.5), mapY(-180)); ctx.lineTo(mapX(128.5), mapY(240));
    ctx.strokeStyle = '#85816a'; ctx.lineWidth = .8;
    ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    rect(-136, -35, 48, 40, '#6e6465', '#ac9381');
    rect(88, -35, 48, 40, '#6e6465', '#ac9381');
    rect(-182, -39, 36, 44, '#5d585f', '#887a76');
    rect(146, -39, 36, 44, '#5d585f', '#887a76');
    rect(-80, -22, 160, 22, '#9c8672', '#d6b994');
    rect(-18, -22, 36, 24.8, '#b09a7a', '#e0c899');
    rect(-80, -22, 12, 23.2, '#b09a7a', '#d6b994');
    rect(68, -22, 12, 23.2, '#b09a7a', '#d6b994');
    rect(-19, 3, 38, 3, '#7b705f');
    for (const tree of TREES) dot(tree[0], tree[1], Math.max(1.4, 3 * scale), '#829477', '#acb78a');
    // Basins are scenery, independent of the interactable fountain POI.
    for (const x of [-35, 35]) {
      dot(x, 48, 5 * scale, '#62999e', '#bad1be');
      dot(x, 48, Math.max(1, .8 * scale), '#d4d8c2');
    }
    ctx.font = `${overview ? 9 : 10}px Nunito, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f0dcaf';
    ctx.fillText('LMU', mapX(0), mapY(-11));
    if (overview) {
      ctx.fillStyle = '#b9b8a0'; ctx.font = '8px Nunito, sans-serif';
      ctx.fillText('广场', mapX(-55), mapY(35));
      ctx.save(); ctx.translate(mapX(137), mapY(47)); ctx.rotate(-Math.PI / 2);
      ctx.fillText('Ludwigstraße', 0, 0); ctx.restore();
    }
    if (objective) {
      // A fine dotted route is a bearing guide, not a walkability path.
      ctx.beginPath(); ctx.moveTo(mapX(p.x), mapY(p.z)); ctx.lineTo(mapX(objective.x), mapY(objective.z));
      ctx.strokeStyle = 'rgba(246,215,129,.38)'; ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const [id, poi] of pois) {
      if (id === 'memento' && state?.stage !== 'find_memento') continue;
      if (id === objectiveId) {
        const pulse = (Math.sin(time * 3) + 1) * .5;
        ctx.beginPath(); ctx.arc(mapX(poi.x), mapY(poi.z), 6 + pulse * 3, 0, TAU);
        ctx.fillStyle = `rgba(245,214,127,${.08 + .1 * (1 - pulse)})`; ctx.fill();
        ctx.strokeStyle = 'rgba(245,214,127,.6)'; ctx.lineWidth = 1; ctx.stroke();
        diamond(poi.x, poi.z, 4, '#ffe39a');
      } else diamond(poi.x, poi.z, 2.7, id === 'memento' ? '#f5b4ce' : '#cdc2a1');
    }
    const companion = engine.companion?.getPosition?.();
    if (companion && Number.isFinite(companion.x) && Number.isFinite(companion.z)) {
      dot(companion.x, companion.z, 3.5, '#f5b7c9', '#382c3b');
    }
    ctx.save(); ctx.translate(mapX(p.x), mapY(p.z));
    // A canvas arrow faces -Z at yaw 0. Positive yaw points toward -X.
    ctx.rotate(-yaw);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.8, 5); ctx.lineTo(0, 2.8); ctx.lineTo(-4.8, 5); ctx.closePath();
    ctx.fillStyle = '#ffe4a2'; ctx.fill(); ctx.strokeStyle = '#302534'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    // A scale bar makes the compressed overview readable without a legend.
    const meters = overview ? 50 : 20, bar = meters * scale;
    ctx.strokeStyle = '#c7bea3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, height - 12); ctx.lineTo(8, height - 9);
    ctx.lineTo(8 + bar, height - 9); ctx.lineTo(8 + bar, height - 12); ctx.stroke();
    ctx.fillStyle = '#ded3b4'; ctx.font = '8px Nunito, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${meters} m`, 8, height - 19);
  }

  function updateEdge(distance) {
    const camera = engine.camera;
    if (!objective || !camera?.projectionMatrix || !camera.matrixWorldInverse || !projected || !viewPoint) {
      edge.hidden = true; return;
    }
    camera.updateMatrixWorld?.();
    viewPoint.set(objective.x, 1.5, objective.z).applyMatrix4(camera.matrixWorldInverse);
    projected.copy(viewPoint).applyMatrix4(camera.projectionMatrix);
    const behind = viewPoint.z >= -(camera.near ?? .1);
    const onscreen = !behind && projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
    if (onscreen || distance <= (engine.route?.INTERACT_RADIUS ?? 6.5)) { edge.hidden = true; return; }
    let dx = projected.x, dy = -projected.y;
    if (behind) {
      dx = viewPoint.x * camera.projectionMatrix.elements[0];
      dy = -viewPoint.y * camera.projectionMatrix.elements[5];
      if (Math.abs(dx) + Math.abs(dy) < .01) dy = 1;
    }
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) { edge.hidden = true; return; }
    // Convert to viewport pixels before intersecting the safe inset rectangle.
    dx *= viewportW * .5; dy *= viewportH * .5;
    const marginX = viewportW < 700 ? 30 : 40, marginY = 64;
    const halfW = Math.max(1, viewportW * .5 - marginX), halfH = Math.max(1, viewportH * .5 - marginY);
    const factor = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, .001);
    edge.style.left = `${viewportW * .5 + dx * factor}px`;
    edge.style.top = `${viewportH * .5 + dy * factor}px`;
    edgeArrow.style.transform = `rotate(${Math.atan2(dx, -dy)}rad)`;
    const text = `${Math.round(distance)} m`;
    if (text !== lastEdgeText) { edgeDistance.textContent = text; lastEdgeText = text; }
    edge.hidden = false;
  }

  function checkVisits(p) {
    const radius = engine.route?.INTERACT_RADIUS ?? 6.5;
    for (const [id, poi] of pois) {
      if (!VISIT_NAMES[id] || visited.has(id) || Math.hypot(p.x - poi.x, p.z - poi.z) > radius) continue;
      visited.add(id);
      locationTitle.textContent = VISIT_NAMES[id][0];
      locationSubtitle.textContent = VISIT_NAMES[id][1];
      visitAt = clock;
      locationActive = true;
      location.classList.add('dm-location-visible');
      break;
    }
    if (locationActive && clock - visitAt >= 2.5) {
      locationActive = false; location.classList.remove('dm-location-visible');
    }
  }

  function update(dt, et) {
    if (disposed) return;
    // Keep a local monotonic clock: callers may omit elapsed time or reset it.
    clock += Number.isFinite(dt) ? Math.max(0, Math.min(dt, .25)) : 1 / 60;
    const next = story.getState?.() ?? EMPTY_STATE;
    if (next !== state || next.stage !== state?.stage) syncState(next);
    const photoMode = !!engine.isPhotoMode?.();
    if (photoMode !== hidden) {
      hidden = photoMode; root.hidden = hidden; lastPaint = -1;
    }
    if (hidden) return;
    const p = engine.player?.pos;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) { panel.hidden = true; edge.hidden = true; return; }
    panel.hidden = false;
    const time = Number.isFinite(et) ? et : clock;
    if (lastPaint >= 0 && clock - lastPaint < 1 / 10) return;
    lastPaint = clock;
    if (resizePending) {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width || 174); height = Math.max(1, bounds.height || 150);
      dpr = Math.min(devicePixelRatio || 1, 2); viewportW = innerWidth; viewportH = innerHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      resizePending = false;
    }
    const yaw = Number.isFinite(engine.player.yaw) ? engine.player.yaw : 0;
    let distance = 0, label = '自由漫步 · 北朝上';
    if (objective) {
      const dx = objective.x - p.x, dz = objective.z - p.z;
      distance = Math.hypot(dx, dz);
      const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
      bearing.style.transform = `rotate(${Math.atan2(right, forward)}rad)`;
      label = `${objective.label ?? VISIT_NAMES[objectiveId]?.[0] ?? '目的地'} · ${distance <= (engine.route?.INTERACT_RADIUS ?? 6.5) ? '按 E' : `${Math.round(distance)} m`}`;
    }
    bearing.hidden = !objective;
    if (label !== lastDistanceText) { distanceText.textContent = label; distanceText.title = label; lastDistanceText = label; }
    paint(p, yaw, time);
    updateEdge(distance);
    checkVisits(p);
  }

  return {
    update,
    handleKey(k, event) {
      if (disposed || typeof k !== 'string' || k.toLowerCase() !== 'n') return false;
      const target = event?.target;
      if (event?.ctrlKey || event?.metaKey || event?.altKey || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return false;
      if (hidden || engine.isPhotoMode?.()) return false;
      if (!event?.repeat) toggleMode();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (typeof unsubscribe === 'function') unsubscribe();
      observer?.disconnect();
      removeEventListener('resize', resize);
      toggle.removeEventListener('click', toggleMode);
      toggle.removeEventListener('pointerdown', stopGesture);
      toggle.removeEventListener('mousedown', stopGesture);
      toggle.removeEventListener('touchstart', stopGesture);
      root.remove();
      // Shared, cached stylesheet stays available for a later chapter restart.
    },
  };
}
