// Side memories are deliberately independent of the chapter's quest collectibles.
import { POIS, FOUNTAINS, BOUNDS } from './date_route.mjs';

export const COLLECT_VERSION = 1;
export const COLLECT_STORAGE_KEY = 'lmu-date-collect-v1';
export const VISIT_IDS = Object.freeze(['entrance', 'white_rose', 'fountain', 'our_plaza']);
export const MEMORY_ITEMS = Object.freeze([
  { id: 'crane', shape: 'crane', title: '把明天折成翅膀', icon: '◇', color: 0xf4d6dc, x: -22, z: 28, where: '主楼西侧的石径',
    note: ['考试周，你把写废的演算纸折成一只纸鹤。', '它的翅膀上还留着没算完的积分。', '你说，明天再难，也要留一点位置给飞翔。'] },
  { id: 'coffee', shape: 'coffee', title: '你的那一口奶泡', icon: '☕', color: 0xe4c8a2, x: 23, z: 27, where: '主楼东侧的树影下',
    note: ['八点的课，七点五十才买到的两杯咖啡。', '你总把奶泡更厚的那杯推给我，自己喝苦的。', '后来我记住的不是课程表，是杯盖上你画的小太阳。'] },
  { id: 'pretzel', shape: 'pretzel', title: '一半椒盐卷饼', icon: '∞', color: 0xd99444, x: -57, z: 44, where: '西喷泉外的长椅旁',
    note: ['食堂关门了，我们分着最后一个椒盐卷饼。', '你认真挑走我那一半上太大的盐粒。', '慕尼黑的冬天很冷，可那天的晚饭一直是暖的。'] },
  { id: 'ticket', shape: 'ticket', title: '坐过一站也没关系', icon: '▱', color: 0xb6d9d9, x: 57, z: 60, where: '东侧通往电车站的小径',
    note: ['那次聊得太投入，电车载着我们坐过了站。', '你把车票夹进书里，说多走一站就多看一会儿晚霞。', '从那以后，我不再那么急着抵达。'] },
  { id: 'petal', shape: 'petal', title: '借春天一小会儿', icon: '❀', color: 0xf2a6c6, x: -20, z: 67, where: '广场西侧的樱树下',
    note: ['图书馆出来时，一片樱花落在你的笔记本上。', '我们用空果酱瓶装好它，摆在赶论文的窗边。', '春天不能延期，但那朵花陪我们熬过了最后一夜。'] },
  { id: 'bell', shape: 'bell', title: '两声铃，就是我', icon: '♧', color: 0xe9ce77, x: 23, z: 76, where: '广场东南的自行车旁',
    note: ['下课的人潮里，你总把车铃轻轻按两下。', '第一声是“我来了”，第二声是“慢慢走”。', '不用抬头，我也知道有人在等我一起回家。'] },
  { id: 'leaf', shape: 'leaf', title: '夹在第十七页的秋天', icon: '✧', color: 0xd88855, x: -59, z: 77, where: '西南角的秋叶小径',
    note: ['风把一片枫叶送到我们摊开的课本上。', '你说它像一只举起的手，替我们回答今天的最后一个问题。', '那页知识早忘了，这个一起偷笑的秋天还在。'] },
  { id: 'letter', shape: 'letter', title: '没有寄出的地址', icon: '♡', color: 0xf2ddbb, x: 55, z: 28, where: '东侧安静的石墙边',
    note: ['练德语书信的作业里，我悄悄写了你的名字。', '地址栏空着，因为明天就在主楼门口见。', '想说的话很长，最后只留下：路上小心，我等你。'] },
].map(item => Object.freeze({ ...item, note: Object.freeze(item.note) })));

const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value, max = 1e9) => finite(value) ? Math.min(max, Math.max(0, value)) : 0;

export function isPlacementValid(point, { pois = POIS, fountains = FOUNTAINS, bounds = BOUNDS, blocked } = {}) {
  if (!point || !finite(point.x) || !finite(point.z)) return false;
  if (bounds && (point.x < bounds.minX || point.x > bounds.maxX || point.z < bounds.minZ || point.z > bounds.maxZ)) return false;
  if (Object.values(pois ?? {}).some(p => Math.hypot(point.x - p.x, point.z - p.z) < 8)) return false;
  if ((fountains ?? []).some(p => Math.hypot(point.x - p.x, point.z - p.z) < Math.max(6, p.r ?? 0))) return false;
  try { return !blocked?.(point.x, point.z); } catch { return false; }
}

// Deterministic search: callers inject collision, keeping this module DOM/THREE-free.
// null means there is no safe place, so the renderer must skip the object.
export function findPlacement(point, options = {}) {
  if (isPlacementValid(point, options)) return { x: point.x, z: point.z };
  for (let radius = 2; radius <= 32; radius += 2) {
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12;
      const candidate = { x: point.x + Math.cos(angle) * radius, z: point.z + Math.sin(angle) * radius };
      if (isPlacementValid(candidate, options)) return candidate;
    }
  }
  return null;
}

export function initialCollectState() {
  return { version: COLLECT_VERSION, found: {}, distanceWalked: 0, elapsedSeconds: 0,
    fountainSeconds: 0, visited: {}, achievements: [], goldenHourPhoto: false, completedInSeconds: null };
}

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_memory', icon: '◇', title: '拾起一小段温柔', detail: '找到第一段回忆', test: s => s.fragmentsFound >= 1 },
  { id: 'all_memories', icon: '❀', title: '把今天好好收藏', detail: '收集全部 8 段回忆', test: s => s.fragmentsFound >= MEMORY_ITEMS.length },
  { id: 'walk', icon: '♧', title: '和你多走一会儿', detail: '累计步行 500 米', test: s => s.distanceWalked >= 500 },
  { id: 'fountain', icon: '≈', title: '听完一首水声', detail: '在喷泉旁停留 30 秒', test: s => s.fountainSeconds >= 30 },
  { id: 'explorer', icon: '✧', title: '我们的校园地图', detail: '走访主入口、白玫瑰、喷泉与我们的广场', test: s => VISIT_IDS.every(id => s.visited?.[id]) },
  { id: 'conversation', icon: '♡', title: '认真听你说', detail: '做出一次对话选择', test: s => s.dialogueChoices >= 1 },
  { id: 'album', icon: '▣', title: '三张照片，一个我们', detail: '完成三张约会照片', test: s => s.photosCredited >= 3 },
  { id: 'date', icon: '✦', title: '刚刚好的约会', detail: '在 15 分钟内完成约会', test: s => finite(s.completedInSeconds) && s.completedInSeconds >= 0 && s.completedInSeconds <= 900 },
  { id: 'golden', icon: '☀', title: '把金色时刻留下', detail: '在明信片或结局阶段拍一张照片', test: s => s.goldenHourPhoto === true },
]);

export function achievementIds(stats = {}) {
  return ACHIEVEMENTS.filter(a => a.test(stats)).map(a => a.id);
}

export function distanceStep(previous, current) {
  if (![previous?.x, previous?.z, current?.x, current?.z].every(finite)) return 0;
  const step = Math.hypot(current.x - previous.x, current.z - previous.z);
  return step <= 5 ? step : 0;
}

export function snapshotStats(saved, story = {}) {
  const fragmentsFound = MEMORY_ITEMS.filter(item => saved.found?.[item.id]).length;
  const photosCredited = ['facade', 'fountain', 'couple'].filter(id => story.photos?.[id] === true).length;
  return { distanceWalked: saved.distanceWalked, elapsedSeconds: saved.elapsedSeconds, runSeconds: saved.elapsedSeconds,
    fountainSeconds: saved.fountainSeconds, fragmentsFound, totalFragments: MEMORY_ITEMS.length,
    photosCredited, dialogueChoices: Object.values(story.choices ?? {}).filter(v => typeof v === 'string' && v.length > 0).length,
    visited: { ...saved.visited }, achievements: [...saved.achievements],
    goldenHourPhoto: saved.goldenHourPhoto, completedInSeconds: saved.completedInSeconds };
}

// Treat localStorage as untrusted. Discard unknown IDs, invalid records and future schemas.
export function validateCollectState(input) {
  const clean = initialCollectState();
  if (!input || input.version !== COLLECT_VERSION) return clean;
  for (const key of ['distanceWalked', 'elapsedSeconds', 'fountainSeconds']) clean[key] = nonnegative(input[key]);
  for (const item of MEMORY_ITEMS) {
    const found = input.found?.[item.id];
    if (found && finite(found.foundAt) && found.foundAt > 0 && finite(found.elapsedSeconds) && found.elapsedSeconds >= 0) {
      clean.found[item.id] = { foundAt: found.foundAt, elapsedSeconds: nonnegative(found.elapsedSeconds) };
    }
  }
  for (const id of VISIT_IDS) if (input.visited?.[id] === true) clean.visited[id] = true;
  clean.achievements = ACHIEVEMENTS.filter(a => Array.isArray(input.achievements) && input.achievements.includes(a.id)).map(a => a.id);
  clean.goldenHourPhoto = input.goldenHourPhoto === true;
  clean.completedInSeconds = finite(input.completedInSeconds) && input.completedInSeconds >= 0 ? nonnegative(input.completedInSeconds) : null;
  return clean;
}
