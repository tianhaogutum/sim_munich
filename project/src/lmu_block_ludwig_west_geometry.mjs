// Pure geometry and POIs for the OSM-derived Ludwigstraße west block.
import { polygonBounds, pointInPolygon } from './date_geo.mjs';
import { DATA } from './lmu_block_ludwig_west_data.mjs';

export const SECTOR = Object.freeze({ minX: -480, maxX: -150, minZ: -250, maxZ: 60 });
// A small inset keeps cornices, window planes and paving off neighbouring ownership boundaries.
export const BUILD_LIMITS = Object.freeze({ minX: -479.9, maxX: -150.2, minZ: -249.9, maxZ: 54.8 });
export const FOOTPRINTS = DATA.buildings.map(b => ({
  id: b.id, ring: b.ring.map(([x, z]) => ({ x, z })),
  holes: b.holes.map(r => r.map(([x, z]) => ({ x, z }))),
}));
const solids = FOOTPRINTS.map(p => ({ ...p, bounds: polygonBounds(p.ring) }));
export function footprintBlocked(x, z) {
  for (const p of solids) {
    if (Math.abs(x - p.bounds.cx) > p.bounds.hw || Math.abs(z - p.bounds.cz) > p.bounds.hd) continue;
    if (!pointInPolygon(x, z, p.ring)) continue;
    let inCourtyard = false;
    for (let i = 0; i < p.holes.length; i++) {
      if (pointInPolygon(x, z, p.holes[i])) { inCourtyard = true; break; }
    }
    if (!inCourtyard) return true;
  }
  return false;
}

export const LANDMARKS = [
  { id: 'lw_philologicum', name: '语文学图书馆 · Philologicum', x: -224, z: -6,
    text: '路德维希大街25号：旧盲人教育机构的历史立面，如今属于 LMU 语文学图书馆。\n来源：LMU 图书馆官网；OpenStreetMap。' },
  { id: 'lw_court', name: '巴伐利亚行政法院 · Ludwigstraße 23', x: -319, z: -34,
    text: '连续的圆拱窗与浅色墙面，构成路德维希大街西侧的历史街景。\n来源：巴伐利亚行政法院官网照片；OpenStreetMap。' },
  { id: 'lw_theresien', name: '特蕾莎大街 · Theresienstraße', x: -387, z: -178,
    text: '从路德维希大街走向 Maxvorstadt，转角连接公寓、店铺与大学街区。\n来源：OpenStreetMap；Wikimedia Commons 街景参考。' },
];
