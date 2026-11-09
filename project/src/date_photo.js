// date_photo.js — photo mode, framing validation, album and postcard. Owner: photo agent.
// createPhoto(engine, story) -> { update(dt, et), handleKey(key, event), isActive() }
// Uses only the shared engine / story contract; all added UI lives under #date-photo-root.
import { postcardText } from './date_story.mjs';

const STORAGE_KEY = 'lmu-date-photos-v1';
const FRAME_LIMIT = 0.7; // NDC: the central 70% of the captured image.
const LABELS = { facade: '主楼与拱廊', fountain: '喷泉', couple: '我们的合影' };
const REASONS = {
  far: '太远了', near: '太近了', frame: '不在画面中央', blocked: '被挡住了', missing: 'TA 不在画面里',
};

export function createPhoto(engine, story) {
  const { THREE, scene, camera } = engine;
  const targets = engine.route.PHOTO_TARGETS;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./date_photo.css', import.meta.url).href;
  document.head.appendChild(style);

  const overlay = document.getElementById('photo-overlay');
  const button = document.getElementById('photo-btn');
  const hud = document.getElementById('hud');
  const hint = document.getElementById('photo-hint');
  overlay?.classList.add('dp-overlay');
  button?.classList.add('dp-shutter-button');
  if (button) { button.textContent = '◎ 拍下这一刻'; button.type = 'button'; }
  if (hint) hint.textContent = '拖动转动视角 · 滚轮拉近 / 拉远 · Space 拍照 · P / Esc 返回';

  const root = document.createElement('div');
  root.id = 'date-photo-root';
  root.className = 'dp-root';
  root.innerHTML = `
    <div class="dp-mode" hidden>
      <div class="dp-heading"><span>OUR MUNICH</span><b>把今天，留在相片里。</b></div>
      <div class="dp-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="dp-frame" aria-hidden="true"><span>将主角放在框内</span></div>
      <section class="dp-checklist" aria-label="约会摄影任务">
        <div class="dp-eyebrow">今日的三张纪念 <span class="dp-progress">0 / 3</span></div>
        <div class="dp-goals"></div>
        <p class="dp-tip">合影时用滚轮拉近，让两个人都进入框内。</p>
      </section>
      <section class="dp-album" aria-label="照片相册">
        <div class="dp-eyebrow">口袋相册 <span class="dp-count">0 / 12</span></div>
        <div class="dp-thumbnails"><p class="dp-empty">拍下的照片会留在这里，不会自动下载。</p></div>
      </section>
      <button type="button" class="dp-exit" aria-label="退出拍照模式">返回散步 <kbd>Esc</kbd></button>
    </div>
    <div class="dp-flash" aria-hidden="true"></div>
    <div class="dp-toast" role="status" aria-live="polite"></div>
    <div class="dp-modal" hidden>
      <section class="dp-postcard-dialog" role="dialog" aria-modal="true" aria-labelledby="dp-postcard-title" tabindex="-1">
        <header><div><span class="dp-eyebrow">A DAY TO KEEP</span><h2 id="dp-postcard-title">我们的慕尼黑明信片</h2></div><button type="button" class="dp-close" aria-label="关闭明信片">×</button></header>
        <div class="dp-postcard-preview" aria-live="polite">正在整理今天的回忆…</div>
        <footer><p>把今天收藏起来，下次再一起散步。</p><button type="button" class="dp-save-postcard" disabled>保存明信片</button></footer>
      </section>
    </div>`;
  document.body.appendChild(root);
  const mode = root.querySelector('.dp-mode');
  const checklist = root.querySelector('.dp-checklist');
  const goalList = root.querySelector('.dp-goals');
  const albumStrip = root.querySelector('.dp-thumbnails');
  const toastEl = root.querySelector('.dp-toast');
  const modal = root.querySelector('.dp-modal');
  const dialog = root.querySelector('.dp-postcard-dialog');
  const preview = root.querySelector('.dp-postcard-preview');
  const savePostcard = root.querySelector('.dp-save-postcard');
  const rows = new Map();
  for (const target of targets) {
    const row = document.createElement('div');
    row.className = 'dp-goal';
    row.dataset.goal = target.id;
    const icon = document.createElement('span'); icon.className = 'dp-goal-icon'; icon.textContent = '○';
    const label = document.createElement('span'); label.textContent = target.label || LABELS[target.id] || target.id;
    const status = document.createElement('small'); status.textContent = '寻找角度';
    row.append(icon, label, status); goalList.appendChild(row);
    rows.set(target.id, { row, icon, status });
  }

  let active = false, busy = false, modalOpen = false, hudWasHidden = false;
  let refreshIn = 0, toastTimer, doneTimer, postcardVersion = 0, postcardCanvas = null, previousFocus;
  const album = [];
  const goalPhotos = Object.create(null);
  const raycaster = new THREE.Raycaster();
  const cameraPosition = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const direction = new THREE.Vector3();
  let blockers = [];
  const blockerBounds = new WeakMap();
  const boxHit = new THREE.Vector3();

  function notify(text) {
    toastEl.textContent = text;
    toastEl.classList.add('dp-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('dp-show'), 3000);
  }

  function setActive(on) {
    if (modalOpen && on) return;
    if (active === on) return;
    active = on;
    overlay?.classList.toggle('active', on);
    button?.classList.toggle('visible', on);
    mode.hidden = !on;
    if (on) {
      hudWasHidden = !!hud?.classList.contains('hidden');
      hud?.classList.add('hidden');
      refreshFeedback();
    } else if (!hudWasHidden) hud?.classList.remove('hidden');
  }

  function ignored(object) {
    for (let node = object; node; node = node.parent) {
      if (!node.visible || node.userData?.photoIgnore || node === engine.companion?.root ||
          /^(anime-protagonist|labrador-companion)$/.test(node.name) || /sky|petal|particle/i.test(node.name)) return true;
    }
    // The original sky and petal instances are unnamed. Do not ignore other instances (e.g. windows).
    if (object.geometry?.type === 'SphereGeometry' && object.geometry.parameters.radius >= 500) return true;
    if (object.isInstancedMesh && object.geometry?.type === 'ShapeGeometry') {
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      if (object.geometry.boundingSphere?.radius < 1) return true;
    }
    return false;
  }

  function prepareView() {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    camera.getWorldPosition(cameraPosition);
    blockers = [];
    scene.traverse(object => {
      if (!object.isMesh || ignored(object)) return;
      // Static district batches are large: bounding-box rejection prevents a distant
      // neighbourhood from raycasting every window triangle for a nearby photograph.
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (object.isInstancedMesh && !object.boundingBox) object.computeBoundingBox?.();
      const localBounds = object.isInstancedMesh ? object.boundingBox : object.geometry.boundingBox;
      if (localBounds) {
        let worldBounds = blockerBounds.get(object);
        if (!worldBounds) { worldBounds = new THREE.Box3(); blockerBounds.set(object, worldBounds); }
        worldBounds.copy(localBounds).applyMatrix4(object.matrixWorld);
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(m => m && m.visible !== false && !m.transparent && m.opacity !== 0)) blockers.push(object);
    });
  }

  function inFrame(point) {
    projected.copy(point).project(camera);
    return Number.isFinite(projected.x) && projected.z >= -1 && projected.z <= 1 &&
      Math.abs(projected.x) <= FRAME_LIMIT && Math.abs(projected.y) <= FRAME_LIMIT;
  }

  function occluded(point) {
    direction.subVectors(point, cameraPosition);
    const distance = direction.length();
    if (distance <= 1) return false;
    raycaster.set(cameraPosition, direction.divideScalar(distance));
    raycaster.near = 0.05;
    raycaster.far = distance - 1;
    // Filtering per intersection also supports mixed opaque / transparent material arrays.
    const candidates = blockers.filter(object => {
      const box = blockerBounds.get(object);
      if (!box || box.containsPoint(cameraPosition)) return true;
      if (!raycaster.ray.intersectBox(box, boxHit)) return false;
      return cameraPosition.distanceToSquared(boxHit) <= raycaster.far * raycaster.far;
    });
    return raycaster.intersectObjects(candidates, false).some(hit => {
      const materials = hit.object.material;
      const material = Array.isArray(materials) ? materials[hit.face?.materialIndex ?? 0] : materials;
      return material && material.visible !== false && !material.transparent && material.opacity !== 0;
    });
  }

  function evaluate(target) {
    let points;
    if (target.id === 'couple' || target.target === 'companion') {
      const companion = engine.companion?.getHeadPosition?.();
      if (!companion) return { target, valid: false, reason: 'missing', score: Infinity };
      points = [new THREE.Vector3().copy(companion), engine.playerAvatar?.getHeadPosition?.().clone() ?? new THREE.Vector3().copy(engine.player.pos).add(new THREE.Vector3(0, 1.6, 0))];
      if (!inFrame(points[0])) return { target, valid: false, reason: 'missing', score: Infinity };
    } else {
      if (!target.target || typeof target.target !== 'object') return { target, valid: false, reason: 'frame', score: Infinity };
      points = [new THREE.Vector3(target.target.x, target.target.y, target.target.z)];
    }
    const distances = points.map(point => cameraPosition.distanceTo(point));
    const score = points.reduce((sum, point) => {
      projected.copy(point).project(camera);
      return sum + projected.x ** 2 + projected.y ** 2;
    }, 0) / points.length;
    const result = reason => ({ target, valid: !reason, reason, score, distance: Math.max(...distances) });
    if (distances.some(d => d < target.minDist)) return result('near');
    if (distances.some(d => d > target.maxDist)) return result('far');
    if (!points.every(inFrame)) return result('frame');
    if (target.id === 'facade') {
      // Follow the surveyed facade tangent rather than sampling an unrotated wall.
      const center = points[0], tangent = target.tangent ?? { x: 1, z: 0 };
      const span = Math.hypot(tangent.x, tangent.z) || 1;
      const visible = [-10, -5, 0, 5, 10].filter(x => !occluded(center.clone().add(new THREE.Vector3(x * tangent.x / span, 0, x * tangent.z / span)))).length;
      if (visible < 3) return result('blocked');
    } else if (points.some(occluded)) return result('blocked');
    return result(null);
  }

  function evaluateView() {
    prepareView();
    return targets.map(evaluate);
  }

  function refreshFeedback(results) {
    const state = story.getState();
    checklist.hidden = state.stage !== 'photos';
    root.querySelector('.dp-progress').textContent = `${targets.filter(t => state.photos?.[t.id]).length} / ${targets.length}`;
    if (state.stage !== 'photos') return;
    for (const result of results || evaluateView()) {
      const { row, icon, status } = rows.get(result.target.id);
      const done = !!state.photos?.[result.target.id];
      row.classList.toggle('dp-ready', !done && result.valid);
      row.classList.toggle('dp-complete', done);
      icon.textContent = done ? '✓' : result.valid ? '●' : '○';
      status.textContent = done ? '已收藏' : result.valid ? '可以拍摄' : `${REASONS[result.reason]}${Number.isFinite(result.distance) ? ` · ${Math.round(result.distance)} m` : ''}`;
    }
    const next = (results || []).find(result => !state.photos?.[result.target.id]);
    const tip = root.querySelector('.dp-tip');
    if (next?.target.id === 'couple') tip.textContent = '合影时用滚轮拉近，让两个人都进入框内。';
    else if (next) tip.textContent = `${next.target.label}：在 ${next.target.minDist}–${next.target.maxDist} 米内，让主体居中，并避开树木和建筑。`;
  }

  function download(data, filename) {
    const link = document.createElement('a');
    link.href = data; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
  }

  function renderAlbum() {
    albumStrip.replaceChildren();
    root.querySelector('.dp-count').textContent = `${album.length} / 12`;
    if (!album.length) {
      const empty = document.createElement('p'); empty.className = 'dp-empty';
      empty.textContent = '拍下的照片会留在这里，不会自动下载。'; albumStrip.appendChild(empty); return;
    }
    for (const photo of album) {
      const item = document.createElement('figure'); item.className = 'dp-thumb';
      const image = new Image(); image.src = photo.src; image.alt = photo.label;
      const save = document.createElement('button'); save.type = 'button';
      save.textContent = '↓ 保存'; save.setAttribute('aria-label', `保存照片：${photo.label}`);
      save.addEventListener('click', () => download(photo.src, `our-lmu-${photo.time}.jpg`));
      const caption = document.createElement('figcaption'); caption.textContent = photo.label;
      item.append(image, caption, save); albumStrip.appendChild(item);
    }
  }

  async function persistGoal(id, photo) {
    try {
      const image = await loadImage(photo.src);
      // A restart or newer shot must not resurrect stale photos after this asynchronous work.
      if (goalPhotos[id] !== photo) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(400, image.naturalWidth);
      canvas.height = Math.round(canvas.width * image.naturalHeight / image.naturalWidth);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      photo.thumbnail = canvas.toDataURL('image/jpeg', 0.78);
      const data = {};
      for (const target of targets) if (goalPhotos[target.id]?.thumbnail) data[target.id] = goalPhotos[target.id].thumbnail;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* Storage and image decoding are optional; the current album still works. */ }
  }

  function shutter() {
    if (!active || modalOpen || busy) return;
    busy = true;
    try {
      const state = story.getState();
      const results = state.stage === 'photos' ? evaluateView() : [];
      const missing = results.filter(result => !state.photos?.[result.target.id]);
      const best = missing.filter(result => result.valid).sort((a, b) => a.score - b.score)[0];
      const src = engine.capture({ maxWidth: 960, type: 'image/jpeg', quality: 0.85 });
      const photo = { src, time: Date.now(), label: best ? best.target.label : '慕尼黑的这一刻' };
      album.unshift(photo); if (album.length > 12) album.pop();
      if (best) {
        goalPhotos[best.target.id] = photo;
        story.dispatch({ type: 'PHOTO', id: best.target.id });
        void persistGoal(best.target.id, photo);
        notify(`已收藏 · ${photo.label} ✓`);
      } else if (missing.length) {
        const closest = missing.sort((a, b) => a.score - b.score)[0];
        notify(`照片已留在相册 · ${closest.target.label}：${REASONS[closest.reason]}`);
      } else notify('照片已留在口袋相册');
      renderAlbum(); refreshFeedback(results);
      root.querySelector('.dp-flash').animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 330 });
      button?.animate([{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 250 });
    } catch {
      notify('这一张没有拍好，请再试一次。');
    } finally { setTimeout(() => { busy = false; }, 350); }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
    });
  }

  function drawWrapped(ctx, text, x, y, width, lineHeight) {
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && ctx.measureText(line + character).width > width) {
          ctx.fillText(line, x, y); y += lineHeight; line = '';
        }
        line += character;
      }
      ctx.fillText(line, x, y); y += lineHeight;
    }
    return y;
  }

  function sakura(ctx, x, y, scale, rotation = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(Math.PI * 2 / 5);
      ctx.fillStyle = i % 2 ? '#eeb5bf' : '#f7cad1';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-22, -13, -27, -44, -7, -52);
      ctx.lineTo(0, -45); ctx.lineTo(7, -52);
      ctx.bezierCurveTo(27, -44, 22, -13, 0, 0); ctx.fill();
    }
    ctx.fillStyle = '#c99755'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  async function composePostcard(state) {
    await document.fonts?.ready;
    const pictures = await Promise.all(targets.slice(0, 3).map(async target => {
      try { return goalPhotos[target.id] ? await loadImage(goalPhotos[target.id].src) : null; } catch { return null; }
    }));
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '慕尼黑约会纪念明信片，包含今天的照片与祝福');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#faf4e8'; ctx.fillRect(0, 0, 1600, 1000);
    ctx.strokeStyle = '#decfba'; ctx.lineWidth = 2; ctx.strokeRect(28, 28, 1544, 944);
    ctx.fillStyle = '#9d7255'; ctx.font = '20px Nunito, sans-serif';
    ctx.fillText('OUR MUNICH  /  LMU', 82, 91);
    ctx.textAlign = 'right';
    const date = new Date(state.completedAt || Date.now()).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    ctx.fillText(date, 1518, 91); ctx.textAlign = 'left';
    const copy = postcardText(state);
    ctx.fillStyle = '#533b36'; ctx.font = '600 52px "Noto Serif SC", "Songti SC", serif';
    drawWrapped(ctx, copy.title, 82, 172, 1400, 62);
    const rotations = [-0.035, 0.025, -0.02];
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(310 + i * 490, 431); ctx.rotate(rotations[i]);
      ctx.shadowColor = '#62433b30'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 9;
      ctx.fillStyle = '#fffcf5'; ctx.fillRect(-217, -192, 434, 402); ctx.shadowColor = 'transparent';
      const image = pictures[i];
      if (image) {
        const ratio = Math.max(398 / image.naturalWidth, 298 / image.naturalHeight);
        const sw = 398 / ratio, sh = 298 / ratio;
        ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, -199, -174, 398, 298);
      } else {
        // Debug-started / restored chapters can lack images. Never invent a photograph.
        ctx.fillStyle = ['#e1e7e1', '#dce9ed', '#f1dde0'][i]; ctx.fillRect(-199, -174, 398, 298);
        sakura(ctx, 0, -25, 1.1, i);
        ctx.textAlign = 'center'; ctx.fillStyle = '#856d66'; ctx.font = '20px Nunito, sans-serif';
        ctx.fillText('这一刻，留在心里', 0, 80);
      }
      ctx.textAlign = 'center'; ctx.fillStyle = '#654a42'; ctx.font = '26px "Noto Serif SC", "Songti SC", serif';
      ctx.fillText(targets[i]?.label || ['主楼与拱廊', '喷泉', '我们的合影'][i], 0, 174); ctx.restore();
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#6e5349'; ctx.font = '28px "Noto Serif SC", "Songti SC", serif';
    drawWrapped(ctx, copy.body, 96, 724, 1290, 46);
    ctx.fillStyle = '#a66c72'; ctx.font = '26px Nunito, sans-serif';
    ctx.fillText(`在一起第 ${engine.days} 天`, 96, 926);
    ctx.textAlign = 'right'; ctx.font = 'italic 24px Georgia, serif'; ctx.fillText('With you, in Munich.', 1495, 926);
    sakura(ctx, 1460, 750, 0.8, 0.3); sakura(ctx, 1510, 830, 0.45, -0.3); sakura(ctx, 1390, 847, 0.32, 0.8);
    return canvas;
  }

  async function showPostcard() {
    clearTimeout(doneTimer);
    if (modalOpen) return;
    previousFocus = document.activeElement;
    setActive(false);
    modalOpen = true; modal.hidden = false;
    engine.lock('photo-postcard');
    postcardCanvas = null; savePostcard.disabled = true;
    preview.textContent = '正在整理今天的回忆…';
    dialog.focus();
    const version = ++postcardVersion;
    try {
      const canvas = await composePostcard(story.getState());
      if (!modalOpen || version !== postcardVersion) return;
      postcardCanvas = canvas; preview.replaceChildren(canvas); savePostcard.disabled = false;
    } catch {
      if (modalOpen && version === postcardVersion) preview.textContent = '明信片暂时没能展开，请关闭后重试。';
    }
  }

  function closePostcard() {
    if (!modalOpen) return;
    modalOpen = false; modal.hidden = true; postcardVersion++;
    engine.unlock('photo-postcard');
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const target of targets) {
      const src = stored?.[target.id];
      if (story.getState().photos?.[target.id] && typeof src === 'string' && src.startsWith('data:image/jpeg;base64,') && src.length < 350000) {
        const photo = { src, thumbnail: src, label: target.label, time: target.id, restored: true };
        goalPhotos[target.id] = photo;
        album.push(photo);
      }
    }
  } catch { /* Private browsing, corrupt storage, or quotas must not block play. */ }
  renderAlbum();

  function clearPhotos() {
    for (const id of Object.keys(goalPhotos)) delete goalPhotos[id];
    album.length = 0; renderAlbum();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* optional */ }
  }
  if (story.getState().stage === 'meet') clearPhotos();
  story.subscribe((state, prev, event) => {
    if (state.stage === 'meet' && (prev?.stage !== 'meet' || event?.type === 'RESTART')) {
      clearTimeout(doneTimer); closePostcard(); clearPhotos();
    }
    if (active) refreshFeedback();
    if (state.stage === 'done' && prev?.stage !== 'done') doneTimer = setTimeout(() => { void showPostcard(); }, 1500);
  });
  if (story.getState().stage === 'done') doneTimer = setTimeout(() => { void showPostcard(); }, 1500);
  window.addEventListener('lmu:show-postcard', () => { void showPostcard(); });
  button?.addEventListener('click', shutter);
  root.querySelector('.dp-exit').addEventListener('click', () => setActive(false));
  root.querySelector('.dp-close').addEventListener('click', closePostcard);
  modal.addEventListener('click', event => { if (event.target === modal) closePostcard(); });
  savePostcard.addEventListener('click', () => {
    if (postcardCanvas) download(postcardCanvas.toDataURL('image/png'), `our-munich-${new Date().toISOString().slice(0, 10)}.png`);
  });
  // Keep keyboard focus within the postcard without claiming game keys outside our UI.
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
  });

  return {
    update(dt) {
      if (!active || modalOpen) return;
      refreshIn -= dt;
      if (refreshIn <= 0) { refreshFeedback(); refreshIn = 0.16; }
    },
    handleKey(key, event) {
      if (modalOpen) {
        if (key === 'escape') closePostcard();
        // Focus trapping is handled by the dialog; leave native button activation intact.
        if (key === 'tab') return false;
        if ((key === 'enter' || key === ' ') && dialog.contains(document.activeElement)) {
          if (!event?.repeat && document.activeElement.matches('button:not(:disabled)')) document.activeElement.click();
          return true;
        }
        return true; // Postcard owns game shortcuts; P/N/G cannot leak through.
      }
      if (engine.isLocked() && !active) return false;
      if (key === 'p') { if (!event?.repeat && !modalOpen) setActive(!active); return true; }
      if (key === ' ' && active) { if (!event?.repeat) shutter(); return true; }
      if (key === 'escape' && (active || modalOpen)) {
        if (modalOpen) closePostcard(); else setActive(false);
        return true;
      }
      return false;
    },
    isActive: () => active,
    isModalOpen: () => modalOpen,
    // Read-only diagnostics used by integration QA; neither method grants photo credit.
    inspectView: () => evaluateView().map(({target, valid, reason, score, distance}) => ({id:target.id, valid, reason, score, distance})),
    getAlbumStats: () => ({count:album.length, restored:album.filter(p => p.restored).length, goals:Object.keys(goalPhotos)}),
  };
}
