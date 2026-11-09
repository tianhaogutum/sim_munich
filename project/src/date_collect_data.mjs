import { t } from './date_i18n.mjs';
// Side memories are deliberately independent of the chapter's quest collectibles.
import { POIS, FOUNTAINS, BOUNDS } from './date_route.mjs';

export const COLLECT_VERSION = 1;
export const COLLECT_STORAGE_KEY = 'lmu-date-collect-v1';
export const VISIT_IDS = Object.freeze(['entrance', 'white_rose', 'fountain', 'our_plaza']);
export const MEMORY_ITEMS = Object.freeze([
  { id: 'crane', shape: 'crane', get title() { return t('collect.memories.crane.title'); }, icon: '◇', color: 0xf4d6dc, x: -22, z: 28, get where() { return t('collect.memories.crane.where'); },
    get note() { return Object.freeze([t('collect.memories.crane.note0'), t('collect.memories.crane.note1'), t('collect.memories.crane.note2')]); } },
  { id: 'coffee', shape: 'coffee', get title() { return t('collect.memories.coffee.title'); }, icon: '☕', color: 0xe4c8a2, x: 23, z: 27, get where() { return t('collect.memories.coffee.where'); },
    get note() { return Object.freeze([t('collect.memories.coffee.note0'), t('collect.memories.coffee.note1'), t('collect.memories.coffee.note2')]); } },
  { id: 'pretzel', shape: 'pretzel', get title() { return t('collect.memories.pretzel.title'); }, icon: '∞', color: 0xd99444, x: -57, z: 44, get where() { return t('collect.memories.pretzel.where'); },
    get note() { return Object.freeze([t('collect.memories.pretzel.note0'), t('collect.memories.pretzel.note1'), t('collect.memories.pretzel.note2')]); } },
  { id: 'ticket', shape: 'ticket', get title() { return t('collect.memories.ticket.title'); }, icon: '▱', color: 0xb6d9d9, x: 57, z: 60, get where() { return t('collect.memories.ticket.where'); },
    get note() { return Object.freeze([t('collect.memories.ticket.note0'), t('collect.memories.ticket.note1'), t('collect.memories.ticket.note2')]); } },
  { id: 'petal', shape: 'petal', get title() { return t('collect.memories.petal.title'); }, icon: '❀', color: 0xf2a6c6, x: -20, z: 67, get where() { return t('collect.memories.petal.where'); },
    get note() { return Object.freeze([t('collect.memories.petal.note0'), t('collect.memories.petal.note1'), t('collect.memories.petal.note2')]); } },
  { id: 'bell', shape: 'bell', get title() { return t('collect.memories.bell.title'); }, icon: '♧', color: 0xe9ce77, x: 23, z: 76, get where() { return t('collect.memories.bell.where'); },
    get note() { return Object.freeze([t('collect.memories.bell.note0'), t('collect.memories.bell.note1'), t('collect.memories.bell.note2')]); } },
  { id: 'leaf', shape: 'leaf', get title() { return t('collect.memories.leaf.title'); }, icon: '✧', color: 0xd88855, x: -59, z: 77, get where() { return t('collect.memories.leaf.where'); },
    get note() { return Object.freeze([t('collect.memories.leaf.note0'), t('collect.memories.leaf.note1'), t('collect.memories.leaf.note2')]); } },
  { id: 'letter', shape: 'letter', get title() { return t('collect.memories.letter.title'); }, icon: '♡', color: 0xf2ddbb, x: 55, z: 28, get where() { return t('collect.memories.letter.where'); },
    get note() { return Object.freeze([t('collect.memories.letter.note0'), t('collect.memories.letter.note1'), t('collect.memories.letter.note2')]); } },
].map(item => Object.freeze(item)));

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
  { id: 'first_memory', icon: '◇', get title() { return t('collect.achievementNames.first_memory'); }, get detail() { return t('collect.achievementDetails.first_memory'); }, test: s => s.fragmentsFound >= 1 },
  { id: 'all_memories', icon: '❀', get title() { return t('collect.achievementNames.all_memories'); }, get detail() { return t('collect.achievementDetails.all_memories'); }, test: s => s.fragmentsFound >= MEMORY_ITEMS.length },
  { id: 'walk', icon: '♧', get title() { return t('collect.achievementNames.walk'); }, get detail() { return t('collect.achievementDetails.walk'); }, test: s => s.distanceWalked >= 500 },
  { id: 'fountain', icon: '≈', get title() { return t('collect.achievementNames.fountain'); }, get detail() { return t('collect.achievementDetails.fountain'); }, test: s => s.fountainSeconds >= 30 },
  { id: 'explorer', icon: '✧', get title() { return t('collect.achievementNames.explorer'); }, get detail() { return t('collect.achievementDetails.explorer'); }, test: s => VISIT_IDS.every(id => s.visited?.[id]) },
  { id: 'conversation', icon: '♡', get title() { return t('collect.achievementNames.conversation'); }, get detail() { return t('collect.achievementDetails.conversation'); }, test: s => s.dialogueChoices >= 1 },
  { id: 'album', icon: '▣', get title() { return t('collect.achievementNames.album'); }, get detail() { return t('collect.achievementDetails.album'); }, test: s => s.photosCredited >= 3 },
  { id: 'date', icon: '✦', get title() { return t('collect.achievementNames.date'); }, get detail() { return t('collect.achievementDetails.date'); }, test: s => finite(s.completedInSeconds) && s.completedInSeconds >= 0 && s.completedInSeconds <= 900 },
  { id: 'golden', icon: '☀', get title() { return t('collect.achievementNames.golden'); }, get detail() { return t('collect.achievementDetails.golden'); }, test: s => s.goldenHourPhoto === true },
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
