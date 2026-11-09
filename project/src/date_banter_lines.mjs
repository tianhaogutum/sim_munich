import { t } from './date_i18n.mjs';
// Ambient dialogue only: never advances the story or replaces its main dialogue.
// All times (context.now and history values) are in seconds on the same clock.
// pickLine is pure; callers record accepted lines in history by BOTH id and text.
// A Map or a plain object can be used as history. Missing entries mean never said.
export const REPEAT_WINDOW = 10 * 60;

const line = (id, text, options = {}) => Object.freeze({
  id, get text() { return t(text); }, who: 'companion', weight: 1, priority: 1,
  cooldown: REPEAT_WINDOW, ...options,
});
const pool = (prefix, texts, options) => Object.freeze(texts.map((text, i) =>
  line(`${prefix}.${i}`, text, options)));

// 80 short lines, including eight optional player replies.
export const BANTER_POOLS = Object.freeze({
  idle: Object.freeze([
    line('idle.0', 'banter.idle.0', { weight: 2, reply: 'idle_reply' }),
    line('idle.1', 'banter.idle.1'),
    line('idle.2', 'banter.idle.2', { reply: 'idle_reply' }),
    line('idle.3', 'banter.idle.3', { reply: 'idle_reply' }),
    line('idle.4', 'banter.idle.4'),
    line('idle.5', 'banter.idle.5', { period: 'afternoon' }),
    line('idle.6', 'banter.idle.6', { reply: 'idle_reply' }),
    line('idle.7', 'banter.idle.7'),
  ]),
  morning: pool('morning', ['banter.morning.0', 'banter.morning.1']),
  afternoon: pool('afternoon', ['banter.afternoon.0', 'banter.afternoon.1']),
  evening: pool('evening', ['banter.evening.0', 'banter.evening.1']),
  running: pool('running', ['banter.running.0', 'banter.running.1', 'banter.running.2', 'banter.running.3']),
  fountain: pool('fountain', ['banter.fountain.0', 'banter.fountain.1', 'banter.fountain.2', 'banter.fountain.3'], { reply: 'fountain_reply' }),
  white_rose: pool('white_rose', ['banter.white_rose.0', 'banter.white_rose.1', 'banter.white_rose.2', 'banter.white_rose.3']),
  road: pool('road', ['banter.road.0', 'banter.road.1', 'banter.road.2']),
  benches: pool('benches', ['banter.benches.0', 'banter.benches.1', 'banter.benches.2'], { reply: 'benches_reply' }),
  facade: pool('facade', ['banter.facade.0', 'banter.facade.1', 'banter.facade.2', 'banter.facade.3']),
  separated: pool('separated', ['banter.separated.0', 'banter.separated.1', 'banter.separated.2']),
  stage_meet: pool('stage_meet', ['banter.stage_meet.0', 'banter.stage_meet.1'], { priority: 3 }),
  stage_fountain_talk: pool('stage_fountain_talk', ['banter.stage_fountain_talk.0', 'banter.stage_fountain_talk.1'], { priority: 3 }),
  stage_find_memento: pool('stage_find_memento', ['banter.stage_find_memento.0', 'banter.stage_find_memento.1'], { priority: 3 }),
  stage_photos: pool('stage_photos', ['banter.stage_photos.0', 'banter.stage_photos.1'], { priority: 3 }),
  stage_postcard: pool('stage_postcard', ['banter.stage_postcard.0', 'banter.stage_postcard.1'], { priority: 3 }),
  stage_done: pool('stage_done', ['banter.stage_done.0', 'banter.stage_done.1'], { priority: 3 }),
  photo_facade: pool('photo_facade', ['banter.photo_facade.0', 'banter.photo_facade.1', 'banter.photo_facade.2'], { priority: 4 }),
  photo_fountain: pool('photo_fountain', ['banter.photo_fountain.0', 'banter.photo_fountain.1', 'banter.photo_fountain.2'], { priority: 4 }),
  photo_couple: pool('photo_couple', ['banter.photo_couple.0', 'banter.photo_couple.1', 'banter.photo_couple.2'], { priority: 4 }),
  collected: pool('collected', ['banter.collected.0', 'banter.collected.1', 'banter.collected.2'], { priority: 4 }),
  choice_0: pool('choice_0', ['banter.choice_0.0', 'banter.choice_0.1', 'banter.choice_0.2'], { priority: 3 }),
  choice_1: pool('choice_1', ['banter.choice_1.0', 'banter.choice_1.1', 'banter.choice_1.2'], { priority: 3 }),
  choice_2: pool('choice_2', ['banter.choice_2.0', 'banter.choice_2.1', 'banter.choice_2.2'], { priority: 3 }),
  idle_reply: pool('idle_reply', ['banter.idle_reply.0', 'banter.idle_reply.1', 'banter.idle_reply.2', 'banter.idle_reply.3'], { who: 'player' }),
  fountain_reply: pool('fountain_reply', ['banter.fountain_reply.0', 'banter.fountain_reply.1'], { who: 'player' }),
  benches_reply: pool('benches_reply', ['banter.benches_reply.0', 'banter.benches_reply.1'], { who: 'player' }),
});

function lastSaid(history, key) {
  if (!history || key == null) return -Infinity;
  const value = history instanceof Map ? history.get(key) : history[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : -Infinity;
}

function eligible(entry, context, history, now) {
  if (!entry || typeof entry.text !== 'string' || !entry.text.trim()) return false;
  if (!(Number.isFinite(entry.weight ?? 1) && (entry.weight ?? 1) > 0)) return false;
  if (entry.period && entry.period !== context.period) return false;
  if (entry.stage && entry.stage !== context.stage) return false;
  const cooldown = Math.max(REPEAT_WINDOW, Number.isFinite(entry.cooldown) ? entry.cooldown : 0);
  return now - Math.max(lastSaid(history, entry.id), lastSaid(history, entry.text)) >= cooldown;
}

/** Highest eligible priority first, then a weighted draw. Never mutates arguments.
 * context = { now: seconds, period?: 'morning'|'afternoon'|'evening', stage?: string }.
 * Returns the original line object, or null when every line is cooling down.
 * A cooldown never bypasses the ten-minute text/id deduplication floor.
 */
export function pickLine(lines, context = {}, history = new Map(), rng = Math.random) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const now = Number.isFinite(context.now) ? context.now : 0;
  let best = -Infinity, weight = 0;
  for (const entry of lines) {
    if (!eligible(entry, context, history, now)) continue;
    const priority = Number.isFinite(entry.priority) ? entry.priority : 0;
    if (priority > best) { best = priority; weight = 0; }
    if (priority === best) weight += entry.weight ?? 1;
  }
  if (!(weight > 0)) return null;
  const draw = rng();
  let remaining = Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(draw) ? draw : 0)) * weight;
  let last = null;
  for (const entry of lines) {
    const priority = Number.isFinite(entry?.priority) ? entry.priority : 0;
    if (priority !== best || !eligible(entry, context, history, now)) continue;
    last = entry;
    remaining -= entry.weight ?? 1;
    if (remaining < 0) return entry;
  }
  return last;
}
