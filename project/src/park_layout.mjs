// Chapter 2's single geometry source. Metres; +X east, +Z south, +Y up.
// The old park used +X north / +Z east. Never copy a legacy position unconverted.
import { parkHeight } from './park_terrain.mjs';

export const legacyToDate = (x, z) => ({ x: z, z: -x });
export const dateToLegacy = (x, z) => ({ x: -z, z: x });
export const BOUNDS = Object.freeze({ minX: 48, maxX: 145, minZ: -48, maxZ: 50 });
export const SPAWN = Object.freeze({ x: 65, z: -1.5, yaw: -Math.PI / 2 });
export const TEMPLE = Object.freeze(legacyToDate(17, 113));
export const TOWER = Object.freeze(legacyToDate(-25, 115));
export const STREAM = Object.freeze({ from: 44, to: 150, waterY: .12 });
export const streamCenter = x => 8 - 2.1 * Math.sin((x - 75) * Math.PI / 26);
export const streamWidth = x => 4.4 + .5 * Math.sin(x * .19);
export const BRIDGES = Object.freeze([75, 101].map(x => Object.freeze({
  x, z: streamCenter(x), halfWidth: 2.25, halfLength: 4.8, deckY: .48,
})));
export const isWater = (x, z) => x >= STREAM.from && x <= STREAM.to &&
  Math.abs(z - streamCenter(x)) < streamWidth(x) / 2 + .22;
export const onBridge = (x, z) => BRIDGES.some(b =>
  Math.abs(x - b.x) <= b.halfWidth && Math.abs(z - b.z) <= b.halfLength);

export const SIGHTS = Object.freeze([
  { id: 'monopteros', x: 103, z: -17, icon: '🏛', short: '圆亭', name: 'Monopteros · 风里的圆亭',
    subtitle: '01 / ABOVE THE MEADOW',
    text: '沿草坡慢慢向上走，奶油色的柱廊就从树冠间露出来。回头望，溪流和慕尼黑的天际线都在脚下。\n\n「下次也一起看这里的夕阳吧。」',
    note: '灵感：英国公园 Monopteros。地标位置与距离经过游戏化压缩。' },
  { id: 'wave', x: 61, z: 13.5, icon: '≈', short: '溪流浪点', name: 'Eisbach · 一道不会远去的浪',
    subtitle: '02 / A LITTLE RESTLESS',
    text: '桥影外，水面叠成浅蓝色的折线。我们站在岸边，听一朵小浪重复讲同一个故事。\n\n「你看，连水都舍不得离开这里。」',
    note: 'Eisbach 风格的虚构浪点；不是现实冲浪点的导航或通行信息。' },
  { id: 'tower', x: 109, z: 25, icon: '🏮', short: '中国塔', name: 'Chinesischer Turm · 林间的灯火',
    subtitle: '03 / UNDER THE LANTERNS',
    text: '五层木塔旁，长桌等着下一场欢聚。灯笼随风摇晃，杯中的气泡也慢了下来。\n\n「今天没有课要赶，就在这里坐一会。」',
    note: '灵感：中国塔啤酒花园。场景为风格化重绘。' },
  { id: 'bend', x: 89, z: 1, icon: '❧', short: '溪流转弯', name: '溪流转弯的地方',
    subtitle: '04 / FOLLOW THE WATER',
    text: '鸭子从芦苇旁游过，水纹把云的颜色轻轻推开。沿着溪边走，话题也不需要目的地。\n\n「如果迷路了，就跟着这条小溪。」',
    note: '我们的英国公园 · 一段没有时刻表的散步。' },
  { id: 'bench', x: 98, z: -1, icon: '♡', short: '我们的长椅', name: '留给我们的长椅',
    subtitle: '05 / JUST US, HERE',
    text: '草地上还有空位，身边也一直有你的位置。把今天折成一张小小的明信片，留在这阵晚风里。\n\n「下次见面，也从这里开始。」',
    note: '我们的故事 · 按 P 打开相机，把这一刻留下。' },
].map(Object.freeze));

export function terrainHeight(x, z) {
  const old = dateToLegacy(x, z);
  const hill = parkHeight(old.x, old.z);
  // Smooth, shallow meadow undulations die away at the level stream banks.
  const bank = Math.max(0, Math.min(1, (Math.abs(z - streamCenter(x)) - 4) / 9));
  const hillFade = Math.max(0, 1 - hill / .3);
  return hill + bank * hillFade * (.24 + .19 * Math.sin(x * .09) * Math.cos(z * .13));
}
export function heightAt(x, z) {
  const bridge = BRIDGES.find(b => Math.abs(x - b.x) <= b.halfWidth && Math.abs(z - b.z) <= b.halfLength + 1.5);
  if (bridge) {
    const t = Math.max(0, Math.min(1, (bridge.halfLength + 1.5 - Math.abs(z - bridge.z)) / 1.5));
    return terrainHeight(x, z) * (1 - t) + bridge.deckY * t;
  }
  return terrainHeight(x, z);
}

export const COLUMNS = Object.freeze(Array.from({ length: 10 }, (_, i) => ({
  x: TEMPLE.x + Math.cos(i / 10 * Math.PI * 2) * 3.6,
  z: TEMPLE.z + Math.sin(i / 10 * Math.PI * 2) * 3.6,
  r: .65,
})));

// Seeded trees keep screenshots and collisions identical across reloads.
function makeTrees() {
  let seed = 419;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const points = [];
  for (let i = 0; i < 145; i++) {
    const x = 51 + random() * 90, z = -44 + random() * 88;
    const edge = z < -30 || z > 34 || x > 133 || x < 56;
    if (!edge && random() > .30) continue;
    if (Math.abs(z - streamCenter(x)) < 6 || BRIDGES.some(b => Math.abs(x-b.x)<4)) continue;
    if (x < 72 && z > -10 && z < 6) continue;
    if (Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 12 || Math.hypot(x - TOWER.x, z - TOWER.z) < 13) continue;
    if (SIGHTS.some(p => Math.hypot(x-p.x, z-p.z)<5) || Math.hypot(x-SPAWN.x,z-SPAWN.z)<6) continue;
    // Preserve the broad meadow and the arrival's view of the hill.
    if (x > 60 && x < 105 && z > -23 && z < 0) continue;
    points.push(Object.freeze({ x, z, r: .7, h: 5 + random()*3.5, size: 2.4 + random()*1.2, pink: i % 5 === 0 }));
  }
  return Object.freeze(points);
}
export const TREES = makeTrees();

const OBSTACLES = [...COLUMNS, ...TREES];

export function blocked(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
  if (isWater(x, z) && !onBridge(x, z)) return true;
  // Railings have a small clearance envelope; open bridge ends meet the ramps.
  if (BRIDGES.some(b => Math.abs(z-b.z)<b.halfLength && Math.abs(Math.abs(x-b.x)-b.halfWidth)<.28)) return true;
  if (Math.hypot(x - TOWER.x, z - TOWER.z) < 3.7) return true;
  return OBSTACLES.some(o => Math.hypot(x-o.x, z-o.z) < o.r);
}
