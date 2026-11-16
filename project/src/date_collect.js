import { t, getLocale, onLocaleChange } from './date_i18n.mjs';
// Optional plaza memories. No entry-point side effects: construct after storyUI,
// route handleKey after storyUI/photo, and call update after player movement.
import {
  MEMORY_ITEMS, ACHIEVEMENTS, VISIT_IDS, COLLECT_STORAGE_KEY,
  initialCollectState, validateCollectState, findPlacement, snapshotStats,
  achievementIds, distanceStep,
} from './date_collect_data.mjs';
import { POIS, FOUNTAINS } from './date_route.mjs';

let currentCollect = null;
const attempt = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const clockText = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const dateText = value => attempt(() => new Intl.DateTimeFormat(getLocale() === 'zh' ? 'zh-CN' : getLocale(), { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value), t('collect.today'));

export function createCollect(engine = {}, story = {}) {
  currentCollect?.dispose();
  engine ??= {};
  story ??= {};
  const hasDOM = typeof document !== 'undefined';
  const storage = attempt(() => globalThis.localStorage);
  let saved = attempt(() => validateCollectState(JSON.parse(storage?.getItem(COLLECT_STORAGE_KEY))), initialCollectState());
  let disposed = false, opened = false, page = 0, tab = 'memories', lastPos = null;
  let saveIn = 0, renderIn = 0, achievementIn = 0, previousFocus = null, toastIn = 0, badgeIn = 0;
  const objects = [];
  const listeners = [];
  let root, panel, content, launcher, toast, badge;
  let lastPickup = null, lastAchievement = null;
  const state = () => attempt(() => story.getState?.(), {}) ?? {};
  const photoMode = () => !!attempt(() => engine.isPhotoMode?.(), false);
  const locked = () => !!attempt(() => engine.isLocked?.(), false);
  const getStats = () => snapshotStats(saved, state());
  const getFoundTitles = () => MEMORY_ITEMS.filter(item => saved.found[item.id]).map(item => item.title);
  const persist = () => attempt(() => storage?.setItem(COLLECT_STORAGE_KEY, JSON.stringify(saved)));
  const listen = (target, event, fn, options) => {
    target?.addEventListener?.(event, fn, options);
    listeners.push(() => target?.removeEventListener?.(event, fn, options));
  };
  const notify = (message, ms) => attempt(() => engine.toast?.(message, ms));

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, className, onClick, label) {
    const node = element('button', className, text);
    node.type = 'button';
    if (label) node.setAttribute('aria-label', label);
    node.addEventListener('click', onClick);
    return node;
  }

  function setOpen(on) {
    if (disposed || !hasDOM || (on && (photoMode() || (!opened && locked())))) return;
    if (on === opened) return;
    opened = on;
    panel.hidden = !on;
    root.classList.toggle('dc-is-open', on);
    if (on) {
      previousFocus = document.activeElement;
      attempt(() => engine.lock?.('collect-journal'));
      render();
      panel.querySelector('.dc-close')?.focus({ preventScroll: true });
    } else {
      attempt(() => engine.unlock?.('collect-journal'));
      if (previousFocus?.isConnected) attempt(() => previousFocus.focus({ preventScroll: true }));
    }
  }

  function selectPage(index) {
    page = (index + MEMORY_ITEMS.length) % MEMORY_ITEMS.length;
    tab = 'memories';
    render();
  }

  function render() {
    if (!hasDOM || disposed) return;
    const stats = getStats();
    launcher.textContent = t('collect.launcher', { count: stats.fragmentsFound });
    if (!opened) return;
    root.querySelectorAll('.dc-tab').forEach(node => {
      const selected = node.dataset.tab === tab;
      node.classList.toggle('dc-selected', selected);
      node.setAttribute('aria-selected', String(selected));
    });
    content.replaceChildren();
    if (tab === 'achievements') {
      const summary = element('div', 'dc-stats');
      for (const [value, label] of [[`${Math.round(stats.distanceWalked)} m`, t('collect.walked')], [clockText(stats.runSeconds), t('collect.duration')], [`${stats.photosCredited}/3`, t('collect.photos')], [stats.dialogueChoices, t('collect.choices')]]) {
        const cell = element('div', 'dc-stat');
        cell.append(element('strong', '', value), element('span', '', label));
        summary.append(cell);
      }
      const heading = element('div', 'dc-section-label', t('collect.achievements', { count: saved.achievements.length, total: ACHIEVEMENTS.length }));
      const list = element('div', 'dc-achievements');
      for (const achievement of ACHIEVEMENTS) {
        const earned = saved.achievements.includes(achievement.id);
        const row = element('div', `dc-achievement${earned ? ' dc-earned' : ''}`);
        const copy = element('div', 'dc-achievement-copy');
        copy.append(element('strong', '', achievement.title), element('span', '', achievement.detail));
        row.append(element('span', 'dc-badge-icon', earned ? achievement.icon : '◇'), copy, element('span', 'dc-check', earned ? t('collect.earned') : t('collect.unearned')));
        list.append(row);
      }
      content.append(summary, heading, list);
      return;
    }
    const spread = element('div', 'dc-spread');
    const list = element('nav', 'dc-index');
    list.setAttribute('aria-label', t('collect.indexAria'));
    list.append(element('div', 'dc-section-label', t('collect.index', { count: stats.fragmentsFound })));
    MEMORY_ITEMS.forEach((item, i) => {
      const found = saved.found[item.id];
      const node = button('', `dc-memory${i === page ? ' dc-selected' : ''}${found ? ' dc-found' : ''}`, () => selectPage(i));
      node.setAttribute('aria-current', i === page ? 'page' : 'false');
      node.setAttribute('aria-label', `${i + 1}. ${found ? item.title : t('collect.unknownMemory')}`);
      node.append(element('span', 'dc-memory-icon', item.icon), element('span', 'dc-memory-title', found ? item.title : t('collect.unknownMemory')), element('small', '', String(i + 1).padStart(2, '0')));
      list.append(node);
    });
    const item = MEMORY_ITEMS[page], found = saved.found[item.id];
    const leaf = element('article', 'dc-page');
    leaf.append(element('div', 'dc-page-eyebrow', t('collect.pageEyebrow')), element('div', `dc-page-symbol${found ? '' : ' dc-locked'}`, item.icon), element('h3', '', found ? item.title : t('collect.unknownTitle')));
    const note = element('div', 'dc-note');
    (found ? item.note : [t('collect.unknownNote0'), t('collect.unknownNote1'), t('collect.unknownNote2')]).forEach(line => note.append(element('p', '', line)));
    leaf.append(note);
    leaf.append(element('div', 'dc-found-at', found ? t('collect.foundAt', { where: item.where, date: dateText(found.foundAt), time: clockText(found.elapsedSeconds) }) : t('collect.notFound')));
    const paging = element('div', 'dc-paging');
    paging.append(button(t('collect.previous'), 'dc-page-button', () => selectPage(page - 1)), element('span', '', `${String(page + 1).padStart(2, '0')} / 08`), button(t('collect.next'), 'dc-page-button', () => selectPage(page + 1)));
    leaf.append(paging);
    spread.append(list, leaf);
    content.append(spread);
  }

  if (hasDOM) {
    if (!document.querySelector('link[data-date-collect-style]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('./date_collect.css', import.meta.url).href;
      link.dataset.dateCollectStyle = '';
      document.head?.appendChild(link);
    }
    root = element('div', 'dc-root');
    root.id = 'date-collect-root';
    launcher = button(t('collect.launcher', { count: 0 }), 'dc-launcher', () => setOpen(!opened), t('collect.openAria'));
    launcher.title = t('collect.launcherTitle');
    panel = element('section', 'dc-overlay');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'dc-journal-title');
    const notebook = element('div', 'dc-notebook');
    const header = element('header', 'dc-header');
    const titles = element('div', '');
    const title = element('h2', '', t('collect.journalTitle'));
    title.id = 'dc-journal-title';
    titles.append(element('div', 'dc-eyebrow', t('collect.eyebrow')), title);
    header.append(titles, button('×', 'dc-close', () => setOpen(false), t('collect.close')));
    const tabs = element('div', 'dc-tabs');
    tabs.setAttribute('role', 'tablist');
    [['memories', t('collect.memoriesTab')], ['achievements', t('collect.achievementsTab')]].forEach(([id, text]) => {
      const node = button(text, 'dc-tab', () => { tab = id; render(); });
      node.dataset.tab = id;
      node.setAttribute('role', 'tab');
      tabs.append(node);
    });
    content = element('div', 'dc-content');
    const footer = element('footer', 'dc-footer', t('collect.footer'));
    notebook.append(header, tabs, content, footer);
    panel.append(notebook);
    listen(panel, 'click', event => { if (event.target === panel) setOpen(false); });
    toast = element('aside', 'dc-toast');
    toast.hidden = true;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    badge = element('aside', 'dc-badge-toast');
    badge.hidden = true;
    badge.setAttribute('role', 'status');
    root.append(launcher, panel, toast, badge);
    document.body?.appendChild(root);
    // Photo module can emit this only after a successful shutter/capture. This also
    // covers optional shots after all story PHOTO goals have already been credited.
    listen(document, 'lmu:photo-captured', () => {
      if (['postcard', 'done'].includes(state().stage)) {
        saved.goldenHourPhoto = true;
        checkAchievements();
        persist();
      }
    });
  }

  function localize() {
    if (!root || disposed) return;
    launcher.setAttribute('aria-label', t('collect.openAria'));
    launcher.title = t('collect.launcherTitle');
    root.querySelector('#dc-journal-title').textContent = t('collect.journalTitle');
    root.querySelector('.dc-eyebrow').textContent = t('collect.eyebrow');
    root.querySelector('.dc-close').setAttribute('aria-label', t('collect.close'));
    for (const node of root.querySelectorAll('.dc-tab')) {
      node.textContent = t(node.dataset.tab === 'memories' ? 'collect.memoriesTab' : 'collect.achievementsTab');
    }
    root.querySelector('.dc-footer').textContent = t('collect.footer');
    if (lastPickup && toast && !toast.hidden) {
      toast.replaceChildren(element('div', 'dc-toast-eyebrow', t('collect.pickupHeading', { count: getStats().fragmentsFound })), element('h3', '', `${lastPickup.icon} ${lastPickup.title}`));
      lastPickup.note.forEach(line => toast.append(element('p', '', line)));
      toast.append(element('small', '', t('collect.savedHint')));
    }
    if (lastAchievement && badge && !badge.hidden) {
      const { achievement, extraCount } = lastAchievement;
      const extra = extraCount > 0 ? t('collect.achievementExtra', { count: extraCount }) : '';
      badge.textContent = t('collect.achievementToast', { icon: achievement.icon, title: achievement.title, extra });
    }
    render();
  }
  const unsubscribeLocale = onLocaleChange(localize);

  function createObject(item, placement) {
    const T = engine.THREE;
    if (!T?.Group || !T?.Mesh || !engine.scene?.add) return null;
    const group = new T.Group();
    group.name = `date-memory-${item.id}`;
    group.position.set(placement.x, 1.05, placement.z);
    const body = new T.Group();
    group.add(body);
    const materials = new Map();
    const material = (color, opts = {}) => {
      const key = `${color}:${JSON.stringify(opts)}`;
      if (!materials.has(key)) materials.set(key, engine.toon?.(color, 4, opts) ?? new T.MeshToonMaterial({ color, ...opts }));
      return materials.get(key);
    };
    function mesh(geometry, color = item.color, position = [0, 0, 0], rotation = [0, 0, 0], scale) {
      const node = new T.Mesh(geometry, material(color));
      node.position.set(...position);
      node.rotation.set(...rotation);
      if (scale) node.scale.set(...scale);
      node.castShadow = true;
      body.add(node);
      attempt(() => engine.outline?.(node, 0.018));
      return node;
    }
    const box = (size, color, pos, rot) => mesh(new T.BoxGeometry(...size), color, pos, rot);
    const ball = (radius, color, pos, scale) => mesh(new T.SphereGeometry(radius, 12, 8), color, pos, undefined, scale);
    const torus = (radius, tube, color, pos, rot, arc = Math.PI * 2) => mesh(new T.TorusGeometry(radius, tube, 6, 24, arc), color, pos, rot);
    if (item.shape === 'crane') {
      mesh(new T.OctahedronGeometry(.32), item.color, [0, 0, 0], [0, 0, Math.PI / 2], [1.8, .5, .65]);
      mesh(new T.ConeGeometry(.37, .7, 3), 0xffe9e6, [-.4, .18, 0], [0, 0, -.85], [1, 1, .18]);
      mesh(new T.ConeGeometry(.37, .7, 3), 0xffe9e6, [.4, .18, 0], [0, 0, .85], [1, 1, .18]);
      box([.09, .55, .1], item.color, [.24, .25, 0], [0, 0, -.3]);
      mesh(new T.ConeGeometry(.09, .26, 3), 0xe9a6ac, [.31, .48, 0], [0, 0, -1.2]);
    } else if (item.shape === 'coffee') {
      mesh(new T.CylinderGeometry(.29, .22, .57, 16), 0xf8e9d5);
      mesh(new T.CylinderGeometry(.25, .25, .025, 16), 0x65412e, [0, .29, 0]);
      torus(.20, .055, item.color, [.32, .02, 0]);
      torus(.31, .033, 0xd1a075, [0, .29, 0], [Math.PI / 2, 0, 0]);
      box([.46, .19, .025], 0xce9b7c, [0, -.02, .23]);
      ball(.06, 0xf8dfab, [0, 0, .26]);
    } else if (item.shape === 'pretzel') {
      torus(.25, .095, item.color, [-.18, .05, 0], [0, .2, -.5]);
      torus(.25, .095, item.color, [.18, .05, 0], [0, -.2, .5]);
      torus(.36, .09, item.color, [0, -.08, .035], [0, 0, Math.PI], Math.PI);
      for (let i = 0; i < 9; i++) box([.035, .045, .03], 0xffefcb, [Math.sin(i * 2.1) * .36, Math.cos(i * 1.7) * .22, .09], [0, 0, i]);
    } else if (item.shape === 'ticket') {
      box([.78, .43, .05], item.color, [0, 0, 0], [0, 0, -.15]);
      box([.6, .045, .018], 0x3b7182, [-.01, .12, .038], [0, 0, -.15]);
      box([.30, .025, .018], 0x497b86, [-.12, -.05, .038]);
      for (let i = 0; i < 5; i++) box([.015, .10, .02], 0x497b86, [.14 + i * .03, -.11, .04]);
    } else if (item.shape === 'petal') {
      const glass = new T.Mesh(new T.CylinderGeometry(.27, .27, .65, 16, 1, true), material(0xd9eff1, { transparent: true, opacity: .25, depthWrite: false, side: T.DoubleSide }));
      body.add(glass);
      torus(.27, .025, 0xc7e1e7, [0, .33, 0], [Math.PI / 2, 0, 0]);
      mesh(new T.CylinderGeometry(.27, .27, .025, 16), 0xc7e1e7, [0, -.32, 0]);
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * .4;
        ball(.12, item.color, [Math.sin(angle) * .115, Math.cos(angle) * .115, .02], [.7, 1.15, .4]);
      }
      ball(.045, 0xf5d878, [0, 0, .08]);
    } else if (item.shape === 'bell') {
      mesh(new T.SphereGeometry(.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), item.color, [0, -.1, 0]);
      mesh(new T.CylinderGeometry(.32, .34, .06, 16), 0x91734b, [0, -.12, 0]);
      ball(.055, 0xffe5a4, [0, .24, 0]);
      box([.28, .08, .11], 0x655e69, [.28, -.12, 0], [0, 0, -.3]);
      torus(.11, .038, 0x655e69, [0, -.28, 0], [0, Math.PI / 2, 0]);
    } else if (item.shape === 'leaf') {
      for (let i = -2; i <= 2; i++) {
        mesh(new T.ConeGeometry(.16, .48, 3), item.color, [i * .105, .02 - Math.abs(i) * .05, 0], [0, 0, -i * .5], [1, 1, .14]);
      }
      box([.035, .55, .025], 0x855937, [0, -.17, .018], [0, 0, -.1]);
    } else {
      box([.72, .48, .07], item.color);
      mesh(new T.ConeGeometry(.39, .27, 3), 0xe4c5a4, [0, .07, .06], [0, 0, Math.PI], [1, 1, .1]);
      ball(.075, 0xc77881, [-.045, -.04, .09], [1, 1, .5]);
      ball(.075, 0xc77881, [.045, -.04, .09], [1, 1, .5]);
      mesh(new T.ConeGeometry(.095, .12, 3), 0xc77881, [0, -.11, .09], [0, 0, Math.PI], [1, 1, .3]);
    }
    body.scale.setScalar(1.4);
    const glowMaterial = new T.MeshBasicMaterial({ color: 0xffdc94, transparent: true, opacity: .4, depthWrite: false, side: T.DoubleSide });
    const ring = new T.Mesh(new T.RingGeometry(.66, .72, 48), glowMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -.93;
    group.add(ring);
    const sparkles = [];
    for (let i = 0; i < 4; i++) {
      const sparkle = new T.Mesh(new T.OctahedronGeometry(.065), glowMaterial);
      sparkle.position.set(Math.cos(i * Math.PI / 2) * .85, Math.sin(i * 2) * .22, Math.sin(i * Math.PI / 2) * .85);
      group.add(sparkle);
      sparkles.push(sparkle);
    }
    group.visible = !saved.found[item.id];
    engine.scene.add(group);
    return { item, placement, group, body, ring, sparkles, phase: objects.length * 1.7, pop: -1 };
  }

  const placementOptions = { pois: engine.route?.POIS ?? POIS, fountains: engine.route?.FOUNTAINS ?? FOUNTAINS, bounds: engine.route?.BOUNDS, blocked: engine.blocked?.bind(engine) };
  for (const item of MEMORY_ITEMS) {
    const placement = findPlacement(item, placementOptions);
    if (placement) {
      const object = attempt(() => createObject(item, placement));
      // Collection still works in a non-rendering test/partial engine.
      objects.push(object ?? { item, placement, pop: -1 });
    }
  }

  function pickup(object) {
    if (saved.found[object.item.id]) return;
    saved.found[object.item.id] = { foundAt: Date.now(), elapsedSeconds: saved.elapsedSeconds };
    object.pop = 0;
    checkAchievements();
    lastPickup = object.item;
    notify(t('collect.pickup', { title: object.item.title, count: getStats().fragmentsFound }), 3400);
    attempt(() => engine.audio?.cue?.('collect'));
    if (toast) {
      toast.replaceChildren(element('div', 'dc-toast-eyebrow', t('collect.pickupHeading', { count: getStats().fragmentsFound })), element('h3', '', `${object.item.icon} ${object.item.title}`));
      object.item.note.forEach(line => toast.append(element('p', '', line)));
      toast.append(element('small', '', t('collect.savedHint')));
      toast.hidden = false;
      toastIn = 10;
    }
    render();
    persist();
  }

  function checkAchievements() {
    const fresh = achievementIds(getStats()).filter(id => !saved.achievements.includes(id));
    if (!fresh.length) return;
    saved.achievements.push(...fresh);
    const achievement = ACHIEVEMENTS.find(a => a.id === fresh[0]);
    lastAchievement = { achievement, extraCount: fresh.length - 1 };
    if (badge) {
      badge.textContent = t('collect.achievementToast', { icon: achievement.icon, title: achievement.title, extra: fresh.length > 1 ? t('collect.achievementExtra', { count: fresh.length - 1 }) : '' });
      badge.hidden = false;
      badgeIn = 5;
    } else notify(t('collect.achievementToast', { icon: achievement.icon, title: achievement.title, extra: '' }), 3000);
    render();
    persist();
  }

  function reset() {
    saved = initialCollectState();
    lastPos = null;
    page = 0;
    toastIn = badgeIn = 0;
    if (toast) toast.hidden = true;
    if (badge) badge.hidden = true;
    for (const object of objects) {
      object.pop = -1;
      if (object.group) { object.group.visible = true; object.group.scale.setScalar(1); }
    }
    persist();
    render();
  }
  const unsubscribe = attempt(() => story.subscribe?.((next, prev, event) => {
    if (next?.stage === 'meet' && (prev?.stage !== 'meet' || event?.type === 'RESTART')) {
      setOpen(false);
      reset();
      return;
    }
    if (event?.type === 'PHOTO' && ['postcard', 'done'].includes(prev?.stage)) saved.goldenHourPhoto = true;
    if (next?.stage === 'done' && prev?.stage !== 'done' && saved.completedInSeconds === null) saved.completedInSeconds = saved.elapsedSeconds;
    checkAchievements();
    persist();
    render();
  }));

  function update(dt = 0, et = 0) {
    if (disposed) return;
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(.25, dt)) : 0;
    const time = Number.isFinite(et) ? et : saved.elapsedSeconds;
    const hiding = photoMode();
    if (hiding && opened) setOpen(false);
    if (root) root.hidden = hiding;
    const visible = !hasDOM || !document.hidden;
    const s = state();
    if (visible && s.stage !== 'done') saved.elapsedSeconds += step;
    const p = engine.player?.pos;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) {
      const movement = lastPos ? Math.hypot(p.x - lastPos.x, p.z - lastPos.z) : Infinity;
      if (visible && !locked() && !hiding) saved.distanceWalked += distanceStep(lastPos, p);
      if (!lastPos) lastPos = { x: p.x, z: p.z };
      else { lastPos.x = p.x; lastPos.z = p.z; }
      const pois = engine.route?.POIS ?? POIS;
      for (const id of VISIT_IDS) {
        const point = pois[id];
        if (point && Math.hypot(p.x - point.x, p.z - point.z) <= 6.5) saved.visited[id] = true;
        if (s.visited?.[id]) saved.visited[id] = true;
      }
      const fountains = engine.route?.FOUNTAINS ?? FOUNTAINS;
      if (visible && movement < .08 && !locked() && !hiding && fountains.some(f => Math.hypot(p.x - f.x, p.z - f.z) <= 11)) saved.fountainSeconds += step;
    } else lastPos = null;
    for (const object of objects) {
      const { group, item, placement } = object;
      if (!saved.found[item.id] && p && visible && !locked() && !hiding && Math.hypot(p.x - placement.x, p.z - placement.z) <= 1.6) pickup(object);
      if (!group) continue;
      if (object.pop >= 0) {
        object.pop += step;
        const t = Math.min(1, object.pop / .55);
        group.position.y = 1.05 + t * 1.15;
        group.scale.setScalar(1 + Math.sin(t * Math.PI) * .3 - t);
        if (t === 1) { group.visible = false; object.pop = -1; }
      } else if (!saved.found[item.id]) {
        group.position.y = 1.05 + Math.sin(time * 1.8 + object.phase) * .14;
        object.body.rotation.y = time * .5 + object.phase;
        object.ring.position.y = .10 - group.position.y;
        object.ring.material.opacity = .3 + Math.sin(time * 2 + object.phase) * .1;
        for (let i = 0; i < object.sparkles.length; i++) {
          const sparkle = object.sparkles[i];
          sparkle.rotation.y = time + i; sparkle.scale.setScalar(.75 + Math.sin(time * 2 + i) * .3);
        }
      }
    }
    achievementIn += step;
    if (achievementIn >= .5) { checkAchievements(); achievementIn = 0; }
    if (toastIn > 0 && !opened && !hiding) { toastIn -= step; if (toastIn <= 0 && toast) toast.hidden = true; }
    if (badgeIn > 0 && !opened && !hiding) { badgeIn -= step; if (badgeIn <= 0 && badge) badge.hidden = true; }
    saveIn += step;
    if (saveIn >= 5) { persist(); saveIn = 0; }
    renderIn += step;
    if (opened && tab === 'achievements' && renderIn >= 1) { render(); renderIn = 0; }
  }

  function handleKey(key, event) {
    if (disposed) return false;
    const k = String(key ?? '').toLowerCase();
    if (k === 'j') {
      if (!event?.repeat) setOpen(!opened);
      return true;
    }
    if (!opened || photoMode()) return false;
    if (k === 'escape') { setOpen(false); return true; }
    if (k === 'arrowleft' || k === 'arrowright') {
      if (tab === 'memories') selectPage(page + (k === 'arrowright' ? 1 : -1));
      else { tab = 'memories'; render(); }
      return true;
    }
    if (k === 'arrowup' || k === 'arrowdown') { tab = tab === 'memories' ? 'achievements' : 'memories'; render(); return true; }
    if (k === 'enter') {
      // Preserve native Enter activation of focused journal buttons without leaking
      // the key to the story; programmatic routing works when focus is elsewhere.
      if (root?.contains(document.activeElement) && document.activeElement?.tagName === 'BUTTON') document.activeElement.click();
      else if (tab === 'memories') selectPage(page + 1);
      return true;
    }
    return true; // An open journal owns the remaining keys, including Space/P/N.
  }

  const hook = { getStats, getFoundTitles };
  if (typeof window !== 'undefined') window.__lmuCollect = hook;
  const api = {
    update, handleKey, getStats,
    dispose() {
      if (disposed) return;
      setOpen(false);
      persist();
      disposed = true;
      unsubscribeLocale();
      attempt(() => unsubscribe?.());
      listeners.forEach(fn => fn());
      root?.remove();
      const geometries = new Set(), materials = new Set();
      for (const object of objects) {
        object.group?.removeFromParent();
        object.group?.traverse(node => {
          if (node.geometry) geometries.add(node.geometry);
          if (node.material) for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
        });
      }
      geometries.forEach(geometry => geometry.dispose?.());
      materials.forEach(material => material.dispose?.());
      if (typeof window !== 'undefined' && window.__lmuCollect === hook) delete window.__lmuCollect;
      if (currentCollect === api) currentCollect = null;
    },
  };
  listen(typeof window !== 'undefined' ? window : null, 'pagehide', persist);
  render();
  currentCollect = api;
  return api;
}
