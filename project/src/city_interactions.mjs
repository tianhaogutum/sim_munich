// Outdoor observation gameplay. No merchant interiors, purchases or surveyed models.
// Anchors and reference descriptions come from the existing district research packs.
export const INTERACTIONS_STORAGE_KEY = 'munich-city-interactions-v1';
export const INTERACTION_RADIUS = 38; // gameplay reach, not a landmark dimension
export const INTERACTION_STOPS = Object.freeze([
  {
    id: 'kabinettsgarten-pause', placeId: 'session01-kabinettsgarten', kind: 'bench',
    name: '小庭园 · 石凳旁的片刻', lon: 11.5801, lat: 48.1407,
    action: '停下观察庭园',
    observation: '在石凳旁停下，比较浅水池与围合立面的关系。这个小庭园紧邻诸圣宫廷教堂；若入口关闭，可从外围观察。',
    source: 'https://www.residenz-muenchen.de/deutsch/hoefe/index.htm',
    credit: 'Bayerische Schlösserverwaltung；session01 室外观察研究。石凳与浅水池参考该研究包，不代表精确座椅落点。',
  },
  {
    id: 'st-anna-cafe-exterior', placeId: 'session01-st-anna-platz', kind: 'cafe-exterior',
    name: 'St.-Anna-Platz · 咖啡馆外的广场', lon: 11.5879, lat: 48.1402,
    action: '观察咖啡馆外的街景',
    observation: '留在广场外部，观察树木、座椅和咖啡馆周边如何围绕新罗马式圣安娜堂展开。记录的是公共空间的视角。',
    source: 'https://www.muenchen.de/sehenswuerdigkeiten/pfarrkirche-st-anna',
    credit: '慕尼黑城市门户；session01 广场研究。未指定商户、营业时间或室内场景。',
  },
  {
    id: 'maxmonument-study', placeId: 'session01-maxmonument', kind: 'monument',
    name: 'Maxmonument · 纪念碑轮廓', lon: 11.5881, lat: 48.1376,
    action: '观察纪念碑',
    observation: '从人行道比较高处君主立像与基座附近人物的层次。这里是 Maximilianstraße 的纪念碑观察点；留在人行道，不走向电车轨道。',
    source: 'https://www.muenchen.de/stadtteile/lehel-wissenswertes-tipps-und-infos',
    credit: '慕尼黑城市门户；session01 Maxmonument 研究。',
  },
  {
    id: 'karolinenplatz-obelisk', placeId: 'session03-karolinenplatz', kind: 'monument',
    name: 'Karolinenplatz · 方尖碑远望', lon: 11.5686, lat: 48.1439,
    action: '记录方尖碑的视线',
    observation: '从外圈观察黑色方尖碑与 Brienner Straße 的轴线。纪念碑悼念拿破仑俄国战役中的巴伐利亚阵亡者；观察时留意路口和电车。',
    source: 'https://www.muenchen.de/karolinenplatz',
    credit: '慕尼黑城市门户；session03 Maxvorstadt 研究。',
  },
  {
    id: 'bavaria-outlook', placeId: 'session08-bavaria', kind: 'monument',
    name: 'Bavaria · 户外眺望', lon: 11.546, lat: 48.1306,
    action: '眺望纪念像与广场',
    observation: '在外部平台比较 Bavaria 铜像、身后的荣誉堂和 Theresienwiese 的开阔前景。铜像依据 Ludwig Schwanthaler 的模型铸造，象征巴伐利亚。',
    source: 'https://schloesser.bayern.de/deutsch/schloss/objekte/mu_ruhm.htm',
    credit: 'Bayerische Schlösserverwaltung；session08 户外研究。活动期间的通行以现场为准。',
  },
].map(stop => Object.freeze({ ...stop, coordinateStatus: 'approximate outdoor observation anchor' })));

const stopIds = new Set(INTERACTION_STOPS.map(stop => stop.id));
export function readCollection(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(INTERACTIONS_STORAGE_KEY) ?? 'null');
    if (saved?.version !== 1 || !Array.isArray(saved.collected)) return new Set();
    return new Set(saved.collected.filter(id => stopIds.has(id)));
  } catch { return new Set(); }
}

export function nearestInteraction(player, distance, radius = INTERACTION_RADIUS) {
  if (!Number.isFinite(player?.lon) || !Number.isFinite(player?.lat)) return null;
  let nearest = null;
  let minimum = radius;
  for (const stop of INTERACTION_STOPS) {
    const metres = distance(player, stop);
    if (Number.isFinite(metres) && metres >= 0 && metres <= minimum) {
      nearest = { stop, distance: metres };
      minimum = metres;
    }
  }
  return nearest;
}

export function createFeature(engine) {
  const collected = readCollection(engine.storage);
  const doc = engine.document;
  let disposed = false;
  let feedback = '';
  let feedbackUntil = 0;
  let unsaved = false;
  let panel;
  let prompt;
  let actionButton;
  let promptLabel;
  let feedbackLabel;
  let collectionBody;
  const cleanups = [];
  const markers = [];
  const now = () => engine.now?.() ?? Date.now();
  const usable = () => {
    if (disposed || panel?.isOpen() || engine.isInputBlocked?.()) return false;
    const state = engine.getState?.();
    return state?.ready !== false && !state?.paused;
  };
  const nearest = () => usable() ? nearestInteraction(engine.player, engine.distance) : null;
  const el = (tag, text, className) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function renderCollection() {
    if (!collectionBody) return;
    collectionBody.replaceChildren();
    collectionBody.append(el('p', `户外观察收藏 ${collected.size} / ${INTERACTION_STOPS.length}${unsaved ? ' · 本次记录尚未保存' : ''}`));
    collectionBody.append(el('p', '走近标记后按 E，或点击底部按钮。收藏独立保存。标记只是游戏提示，不是实测纪念碑、商户或座椅模型；坐标为近似室外观察点。'));
    for (const stop of INTERACTION_STOPS) {
      const row = el('section', '', 'city-interactions-stop');
      row.append(el('h3', `${collected.has(stop.id) ? '✓' : '○'} ${stop.name}`));
      row.append(el('p', collected.has(stop.id) ? stop.observation : `走近后${stop.action}，收集这个户外视角。`));
      const source = el('a', '资料来源 ↗');
      source.href = stop.source;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      row.append(source, el('small', stop.credit));
      collectionBody.append(row);
    }
  }
  function save() {
    try {
      if (!engine.storage?.setItem) throw new Error('Storage unavailable');
      engine.storage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify({ version: 1, collected: [...collected] }));
      unsaved = false;
    } catch { unsaved = true; }
  }
  function interact() {
    const candidate = nearest(); // Recompute: never use a prompt cached before moving/teleporting.
    if (!candidate) return false;
    const { stop } = candidate;
    const first = !collected.has(stop.id);
    collected.add(stop.id);
    if (first || unsaved) save();
    feedback = `${first ? '已收藏' : '再次观察'} · ${stop.observation}${unsaved ? '（仅保留本次会话：浏览器存储不可用。）' : ''}`;
    feedbackUntil = now() + 10000;
    engine.notify?.(feedback);
    renderCollection();
    update();
    return true;
  }
  function update() {
    if (disposed) return;
    const candidate = nearest();
    if (prompt) {
      const showFeedback = usable() && now() < feedbackUntil;
      prompt.hidden = !candidate && !showFeedback;
      actionButton.hidden = !candidate;
      promptLabel.textContent = candidate ? `${collected.has(candidate.stop.id) ? '✓ ' : ''}${candidate.stop.name} · ${Math.round(candidate.distance)} m` : '';
      actionButton.textContent = candidate ? `E · ${candidate.stop.action}` : '';
      feedbackLabel.hidden = !showFeedback;
      feedbackLabel.textContent = showFeedback ? feedback : '';
    }
    for (const { stop, material } of markers) {
      material.color.setHex(collected.has(stop.id) ? 0x6bb892 : 0xffcd73);
    }
  }

  if (doc && engine.ui) {
    prompt = el('div', '', 'city-interactions-prompt');
    prompt.hidden = true;
    promptLabel = el('span');
    actionButton = el('button');
    actionButton.type = 'button';
    actionButton.addEventListener('click', interact);
    cleanups.push(() => actionButton.removeEventListener('click', interact));
    feedbackLabel = el('p');
    feedbackLabel.setAttribute('role', 'status');
    feedbackLabel.setAttribute('aria-live', 'polite');
    prompt.append(promptLabel, actionButton, feedbackLabel);
    engine.ui.append(prompt);
    cleanups.push(() => prompt.remove());
    if (engine.createPanel) {
      panel = engine.createPanel('city-interactions', { title: '户外观察收藏', modal: true });
      collectionBody = el('div', '', 'city-interactions-collection');
      panel.body.append(collectionBody);
      renderCollection();
      cleanups.push(() => panel.dispose());
    }
  }

  // Abstract observation tokens only. All dimensions are artistic gameplay sizes,
  // NOT inferred dimensions of real benches, monuments or cafe furniture.
  if (engine.THREE && engine.addGeoObject) {
    const THREE = engine.THREE;
    for (const stop of INTERACTION_STOPS) {
      const group = new THREE.Group();
      group.name = `city-interactions:${stop.id}`;
      const geometry = new THREE.OctahedronGeometry(0.65);
      const material = new THREE.MeshBasicMaterial({ color: collected.has(stop.id) ? 0x6bb892 : 0xffcd73 });
      const token = new THREE.Mesh(geometry, material);
      token.position.y = 2.4;
      group.add(token);
      const detach = engine.addGeoObject({ group, lon: stop.lon, lat: stop.lat, minZoom: 13, maxDistance: 1600, replaceBuildings: false });
      markers.push({ stop, material });
      cleanups.push(() => { detach(); geometry.dispose(); material.dispose(); });
    }
  }
  let unregister;
  function dispose() {
    if (disposed) return;
    disposed = true;
    unregister?.();
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  }
  unregister = engine.onDispose?.(dispose);
  update();
  return {
    update, interact, dispose,
    handleKey(key, event) {
      if (key !== 'e' || !nearest()) return false;
      if (event?.repeat) return true;
      return interact();
    },
    isOpen: () => !disposed && Boolean(panel?.isOpen()),
    getCollection: () => INTERACTION_STOPS.filter(stop => collected.has(stop.id)),
    getNearest: nearest,
    openCollection() { if (!disposed) { renderCollection(); panel?.open(); update(); } },
  };
}
