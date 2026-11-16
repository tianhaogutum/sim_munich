// Olympiaturm exterior study. No textures, renderer, map filters or world transforms.
// All radii, intermediate heights and fittings below are approximate visual studies,
// not surveyed dimensions. Only overall height and deck-height range are sourced.
export const OLYMPIC_TOWER = Object.freeze({
  id: 'olympiaturm', name: 'Olympiaturm · 奥林匹克塔',
  // Rounded Commons landmark coordinates, NOT the reference photograph's camera.
  lon: 11.5542, lat: 48.1745,
  height: 291.28, deckHeightRange: Object.freeze([171, 192]),
  accuracy: 'Approximate geographic anchor and stylized exterior; all proportions except total height and observation-height range are estimates. No surveyed footprint or interior.',
});

export const OLYMPIC_SOURCES = Object.freeze([
  Object.freeze({title: 'City of Munich · Olympiaturm', url: 'https://olympiapark.muenchen.de/en/olympiapark/olympiaturm.html', credit: 'Municipal context: concrete television tower completed in 1968, approximately 291 m including antenna.'}),
  Object.freeze({title: 'Munich city portal · Olympic Tower facts', url: 'https://www.muenchen.de/en/sights/viewpoints/olympic-tower', credit: 'Overall height 291.28 m; observation decks between 171 and 192 m. Other model dimensions are approximate.'}),
  Object.freeze({title: 'Olympiapark · Olympiaturm', url: 'https://www.olympiapark.de/de/der-olympiapark/parkuebersicht/olympiaturm', credit: 'Institutional description: observation platforms around 190 m. Exterior study does not imply visitor access.'}),
  Object.freeze({title: 'Commons · Olympiaturm location', url: 'https://commons.wikimedia.org/wiki/Olympiaturm', credit: 'Landmark coordinates rounded from 48°10′28.07″N, 11°33′15.27″E; approximate placement, not a surveyed building anchor.'}),
  Object.freeze({title: 'Commons · exterior reference photograph', url: 'https://commons.wikimedia.org/wiki/File:Remote_views_of_Olympiaturm_IAA_2021_1X7A0042.jpg', credit: 'Alexander Migl, 8 September 2021, CC BY-SA 4.0. Reference for taper, stacked baskets, glazing bands and antenna silhouette; photograph is linked, not embedded or used as a texture.', license: 'https://creativecommons.org/licenses/by-sa/4.0/'}),
]);

const COLORS = {concrete: 0xbcbab0, rim: 0xd5d5ce, glass: 0x48636b, metal: 0x9ba7aa, dark: 0x454e51, red: 0xa9473f, pale: 0xe8e5dc};

// Pure bounded mesh plan, also useful for tests without THREE/WebGL.
export function planOlympicTower() {
  const parts = [];
  const cylinder = (name, material, bottom, top, radiusBottom, radiusTop = radiusBottom, detail = false, open = false) => {
    parts.push({name, shape: 'cylinder', material, bottom, top, radiusBottom, radiusTop, detail, open});
  };
  cylinder('foot', 'concrete', 0, 3, 9, 8.1);
  cylinder('tapered-shaft', 'concrete', 3, 143, 8.1, 4.8);
  cylinder('shaft-neck', 'concrete', 143, 149, 4.8, 5.3);
  // Lower technical basket and the higher public basket are separate silhouettes.
  cylinder('lower-basket-bowl', 'concrete', 147, 153, 5.2, 14.2);
  for (const [bottom, top] of [[153, 160], [163, 170]]) {
    cylinder(`technical-core-${bottom}`, 'concrete', bottom, top, 10.5);
    cylinder(`technical-rim-${bottom}`, 'dark', bottom, bottom + .7, 14.4);
    cylinder(`technical-rim-${top}`, 'metal', top - .7, top, 14.4);
  }
  cylinder('basket-connection', 'concrete', 160, 163, 6.2);
  cylinder('public-basket-support', 'concrete', 170, 176, 5.5);
  cylinder('public-basket-bowl', 'concrete', 174, 181, 5.5, 14.6);
  cylinder('restaurant-glazing', 'glass', 181, 185, 14.2);
  cylinder('public-upper-glazing', 'glass', 185.6, 189, 13.7);
  for (const y of [181, 185, 185.6, 189]) cylinder(`public-band-${y}`, 'rim', y, y + .6, 14.7);
  // Viewing ledges expressed as thin slabs, never a second full tower body.
  for (const y of [185, 189, 192]) {
    cylinder(`observation-platform-${y}`, 'rim', y, y + .7, 14.8);
    cylinder(`observation-core-${y}`, 'dark', y + .7, y + 2, 8.5);
  }
  cylinder('upper-neck', 'concrete', 192.7, 204, 3.6, 3.1);
  cylinder('antenna-dish', 'metal', 203, 204.5, 9.5, 6);
  cylinder('antenna-base', 'pale', 204.5, 235, 2.6, 2.2);
  cylinder('antenna-mid', 'pale', 235, 260, 2.1, 1.5);
  for (const y of [234, 240, 260, 277]) cylinder(`antenna-collar-${y}`, 'metal', y, y + .8, y < 250 ? 3 : 1.7);
  const start = 260.8, segment = (OLYMPIC_TOWER.height - start) / 7;
  for (let i = 0; i < 7; i++) cylinder(`antenna-tip-${i}`, i % 2 ? 'pale' : 'red', start + segment * i, start + segment * (i + 1), 1.2 - i * .14, 1.06 - i * .14);
  // Fine details are instanced, shared and removable at distance/low quality.
  for (const y of [153, 163, 181, 185.6]) {
    const height = y < 174 ? 7 : y === 181 ? 4 : 3.4;
    const radius = y < 174 ? 10.65 : y === 181 ? 14.3 : 13.8;
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12;
      parts.push({name: 'basket-mullion', shape: 'post', material: 'metal', bottom: y, top: y + height, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, radius: .14, detail: true});
    }
  }
  for (const y of [185, 189, 192]) {
    cylinder(`viewing-rail-${y}`, 'metal', y + 1.7, y + 1.9, 14.7, 14.7, true, true);
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12;
      parts.push({name: 'viewing-rail-post', shape: 'post', material: 'metal', bottom: y + .7, top: y + 1.8, x: Math.cos(angle) * 14.6, z: Math.sin(angle) * 14.6, radius: .1, detail: true});
    }
  }
  return parts;
}

function makeSourcesPanel(engine) {
  if (!engine.document || !engine.createPanel) return null;
  const panel = engine.createPanel('city-landmark-olympic-sources', {title: OLYMPIC_TOWER.name, modal: true});
  const append = (tag, text, parent = panel.body) => {
    const element = engine.document.createElement(tag);
    element.textContent = text;
    parent.appendChild(element);
    return element;
  };
  append('p', 'Tapered concrete shaft, stacked circular baskets, observation ledges and striped antenna. Approximate exterior study; no interior or visitor access is simulated.');
  append('p', OLYMPIC_TOWER.accuracy);
  append('h3', 'Sources & credits · 资料与署名');
  const list = append('ul', '');
  for (const source of OLYMPIC_SOURCES) {
    const item = append('li', '', list);
    const link = append('a', source.title, item);
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    append('p', source.credit, item);
    if (source.license) {
      const license = append('a', 'CC BY-SA 4.0', item);
      license.href = source.license; license.target = '_blank'; license.rel = 'noopener noreferrer';
    }
  }
  return panel;
}

export function createFeature(engine) {
  const THREE = engine.THREE;
  if (!THREE || typeof engine.addGeoObject !== 'function') throw new TypeError('Olympiaturm requires engine.THREE and engine.addGeoObject');
  const group = new THREE.Group(); group.name = 'city-landmark-olympic';
  group.userData = {landmark: OLYMPIC_TOWER, sources: OLYMPIC_SOURCES};
  const detail = new THREE.Group(); detail.name = 'olympiaturm-near-detail'; group.add(detail);
  const geometries = new Map(), materials = new Map();
  let detached, panel, unsubscribe, unregister, disposed = false;
  let detailed = false;
  let quality = engine.getSettings?.().quality ?? 'medium';
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    detached?.(); unsubscribe?.(); unregister?.(); panel?.dispose();
    group.removeFromParent();
    group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    for (const geometry of geometries.values()) geometry.dispose();
    for (const material of materials.values()) material.dispose();
  };
  try {
    const postBatches = new Map();
    for (const part of planOlympicTower()) {
      if (!materials.has(part.material)) materials.set(part.material, new THREE.MeshLambertMaterial({color: COLORS[part.material]}));
      if (part.shape === 'post') {
        const key = `${part.radius}:${part.top - part.bottom}:${part.material}`;
        if (!postBatches.has(key)) postBatches.set(key, []);
        postBatches.get(key).push(part);
        continue;
      }
      const height = part.top - part.bottom;
      const key = `${part.radiusTop}:${part.radiusBottom}:${height}:${part.open}`;
      if (!geometries.has(key)) geometries.set(key, new THREE.CylinderGeometry(part.radiusTop, part.radiusBottom, height, 32, 1, part.open));
      const mesh = new THREE.Mesh(geometries.get(key), materials.get(part.material));
      mesh.name = part.name; mesh.position.y = part.bottom + height / 2;
      (part.detail ? detail : group).add(mesh);
    }
    // One draw call per repeated post size, rather than one per window/railing.
    const dummy = new THREE.Object3D();
    for (const [key, parts] of postBatches) {
      const part = parts[0], height = part.top - part.bottom;
      const geometry = new THREE.CylinderGeometry(part.radius, part.radius, height, 4);
      geometries.set(`posts:${key}`, geometry);
      const mesh = new THREE.InstancedMesh(geometry, materials.get(part.material), parts.length);
      mesh.name = part.name;
      parts.forEach((post, index) => {
        dummy.position.set(post.x, post.bottom + height / 2, post.z);
        dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); detail.add(mesh);
    }
    detail.visible = false;
    detached = engine.addGeoObject({group, lon: OLYMPIC_TOWER.lon, lat: OLYMPIC_TOWER.lat, minZoom: 11, maxDistance: 9000, replaceBuildings: false});
    // Anchor is approximate, so deliberately do not request a tile replacement.
    panel = makeSourcesPanel(engine);
    unsubscribe = engine.onSettings?.(settings => {quality = settings.quality; update();});
    unregister = engine.onDispose?.(dispose);
    update();
  } catch (error) { dispose(); throw error; }

  function update() {
    if (disposed) return;
    const center = engine.map?.getCenter?.();
    const origin = center ? {lon: center.lng, lat: center.lat} : engine.player;
    const distance = origin && engine.distance ? engine.distance(origin, OLYMPIC_TOWER) : Infinity;
    const threshold = quality === 'high' ? 1500 : 900;
    // Hysteresis avoids flashing detail while standing on the threshold.
    detailed = quality !== 'low' && Number.isFinite(distance) && distance < threshold + (detailed ? 100 : 0);
    detail.visible = detailed;
  }
  return {
    group, landmark: OLYMPIC_TOWER, sources: OLYMPIC_SOURCES,
    update, dispose,
    openSources() { if (!disposed) panel?.open(); },
    isOpen() { return !disposed && Boolean(panel?.isOpen()); },
    getDetailLevel() { return disposed ? 'disposed' : detailed ? 'near' : 'far'; },
  };
}
