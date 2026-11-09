// Chapter 3 navigation. The original pure floor rules remain the stair authority.
import { floorHeight, UPPER_FLOOR, MID_FLOOR } from './interior_rules.mjs';
export { UPPER_FLOOR, MID_FLOOR };
export const PLAYER_RADIUS = .24;
export const SPAWN = Object.freeze({ x: 0, y: 0, z: 14, yaw: 0 });
export const BOUNDS = Object.freeze({ minX: -11.25, maxX: 11.25, minZ: -17, maxZ: 17 });
export const SIGHTS = Object.freeze([
  { id: 'lichthof', x: 0, y: 0, z: 10.5, icon: '☀', label: '光落下的中庭', subtitle: 'LICHTHOF', text: '抬头看，玻璃屋顶把慕尼黑的天空框成了一幅画。\n拱廊、石柱与脚步声，围住这一小片安静的光。', note: 'LMU 主楼中庭 · 建筑意象的动漫改编' },
  { id: 'staircase', x: 1.5, y: MID_FLOOR, z: -.5, icon: '⌁', label: '一起走过的台阶', subtitle: 'THE GRAND STAIR', text: '宽阔的台阶在中层停顿，再向左右分开。\n不用急着选哪一边。慢慢走，另一端依然是同一片光。', note: '中央楼梯 · 左右支梯通往二层回廊' },
  { id: 'memorial', x: -9.7, y: 0, z: 8, icon: '✧', label: '白玫瑰纪念角', subtitle: 'WEISSE ROSE · IN MEMORIAM', text: '白玫瑰，是反抗纳粹暴政的抵抗团体。\n这片白玫瑰与传单浮雕，向他们的勇气、良知与牺牲致敬。\n请在这里放轻脚步，留一刻安静。', note: '致敬 Weiße Rose · 此处为艺术化纪念场景，并非纪念设施的精确复原' },
  { id: 'gallery', x: 9.9, y: UPPER_FLOOR, z: -1, icon: '◇', label: '从回廊望下去', subtitle: 'A DIFFERENT PERSPECTIVE', text: '刚才走过的地面，变成了脚下的棋盘。\n从这里看下去，连普通的一段散步，也像电影里的长镜头。', note: '二层回廊 · 沿栏杆行走，左右支梯均可返回' },
  { id: 'bench', x: 9.8, y: 0, z: 12, icon: '♡', label: '第一次聊天的长椅', subtitle: 'OUR LITTLE CORNER', text: '还记得我们第一次坐下来聊天吗？\n话题早已记不清，只记得那一天，好像怎么也不想说再见。', note: '属于我们的虚构记忆 ♡' },
]);
const solids = [];
function aabb(id, minX, maxX, minZ, maxZ, minY, maxY) {
  solids.push(Object.freeze({ id, minX, maxX, minZ, maxZ, minY, maxY }));
}
// Rail AABBs match the scene; vertical bounds allow walking underneath galleries.
for (const side of [-1, 1]) {
  for (const z of [-14, -8, -2, 4, 10, 16]) aabb('column', side * 8 - .53, side * 8 + .53, z - .53, z + .53, 0, 16);
  for (let i = 0; i < 16; i++) {
    const z = 8 - (i + .5) * 7 / 16, y = (i + .5) * MID_FLOOR / 16;
    aabb('main-stair-rail', side * 7.13 - .12, side * 7.13 + .12, z - 7 / 32 - .025, z + 7 / 32 + .025, y - .3, y + 1.25);
  }
  aabb('landing-side-rail', side * 7.13 - .12, side * 7.13 + .12, -3.1, 1.1, MID_FLOOR - .25, MID_FLOOR + 1.3);
  for (let i = 0; i < 24; i++) {
    const z = -3 - (i + .5) / 3, y = MID_FLOOR + (i + .5) * .15;
    for (const edge of [3.87, 7.13]) aabb('split-stair-rail', side * edge - .12, side * edge + .12, z - 1 / 6 - .015, z + 1 / 6 + .015, y - .3, y + 1.25);
  }
  aabb('gallery-rail', side * 8.45 - .13, side * 8.45 + .13, -10.9, 17, UPPER_FLOOR - .2, UPPER_FLOOR + 1.3);
  aabb('gallery-front-rail', Math.min(side * 7.1, side * 8.45), Math.max(side * 7.1, side * 8.45), -11.1, -10.86, UPPER_FLOOR - .2, UPPER_FLOOR + 1.3);
}
aabb('landing-back-rail', -3.88, 3.88, -3.1, -2.86, MID_FLOOR - .2, MID_FLOOR + 1.3);
aabb('gallery-back-rail', -3.87, 3.87, -11.1, -10.86, UPPER_FLOOR - .2, UPPER_FLOOR + 1.3);
aabb('memorial-stone', -11.1, -10.1, 6.4, 9.5, 0, .6);
aabb('bench', 10.45, 11.2, 10.5, 13.6, 0, 1.2);
export const COLLIDERS = Object.freeze(solids);

export function collides(x, z, y) {
  const r = PLAYER_RADIUS;
  return COLLIDERS.some(s => y + 1.55 > s.minY && y < s.maxY &&
    x > s.minX - r && x < s.maxX + r && z > s.minZ - r && z < s.maxZ + r);
}
export function heightAt(x, z, currentHeight = 0) {
  if (![x, z, currentHeight].every(Number.isFinite) || x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return null;
  const raw = floorHeight(x, z, currentHeight);
  if (raw === null) return null;
  // The legacy function returns .15 m steps. Interpolate the same stair runs for
  // smooth feet/camera motion, while preserving its layer-transition checks.
  let y = raw;
  if (Math.abs(x) <= 7 && z <= 8 && z >= 1) y = (8 - z) / 7 * MID_FLOOR;
  else if (Math.abs(x) >= 4 && Math.abs(x) <= 7 && z < -3 && z >= -11) y = MID_FLOOR + (-3 - z) / 8 * (UPPER_FLOOR - MID_FLOOR);
  return collides(x, z, y) ? null : y;
}
export const blocked = (x, z, currentHeight = 0) => heightAt(x, z, currentHeight) === null;

// Substeps also serve the BFS tests: a .5 m graph edge crosses multiple risers.
export function moveTo(from, x, z) {
  if (![from?.x, from?.y, from?.z, x, z].every(Number.isFinite)) return null;
  const n = Math.max(1, Math.ceil(Math.hypot(x - from.x, z - from.z) / .07));
  let p = { ...from };
  for (let i = 1; i <= n; i++) {
    const nx = from.x + (x - from.x) * i / n, nz = from.z + (z - from.z) * i / n;
    const y = heightAt(nx, nz, p.y);
    if (y === null) return null;
    p = { x: nx, y, z: nz };
  }
  return p;
}

export function spawnFromSearch(search = '') {
  const [x, z] = (new URLSearchParams(search).get('pos') ?? '').split(',').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { ...SPAWN };
  // Explicit debug placement chooses an existing surface, never an open void.
  for (const y of [0, MID_FLOOR, UPPER_FLOOR, (8 - z) / 7 * MID_FLOOR, MID_FLOOR + (-3 - z) / 8 * 3.6]) {
    const h = heightAt(x, z, y);
    if (h !== null) return { x, y: h, z, yaw: 0 };
  }
  return { ...SPAWN };
}
export const floorLabel = y => y > 5.7 ? '2F · 二层回廊' : y > .25 ? '中层 · 大楼梯' : '1F · 中庭';
