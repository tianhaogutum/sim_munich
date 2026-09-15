export function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(y, m - 1, d); date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.getTime() / 86400000 : null;
}
export function daysTogether(start, now = new Date()) {
  const first = calendarDay(start);
  const today = calendarDay(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  return first === null || first > today ? null : today - first + 1;
}
export function seasonAt(now) { return ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][now.getMonth()]; }
export function lightingAt(hour) {
  if (hour < 6 || hour >= 21) return { sky: '#14253e', sun: '#91b9ee', power: .18, ambient: .65, height: 8, label: '夜晚' };
  if (hour < 9) return { sky: '#e9c7a1', sun: '#ffd096', power: 2.2, ambient: 1.3, height: 8, label: '清晨' };
  if (hour >= 17 && hour < 19) return { sky: '#d69981', sun: '#ff9b53', power: 2.6, ambient: 1.2, height: 7, label: '黄昏' };
  if (hour >= 19) return { sky: '#696f98', sun: '#f4b195', power: .7, ambient: .9, height: 5, label: '暮色' };
  return { sky: '#b8d5e8', sun: '#fff5df', power: hour >= 11 && hour < 14 ? 3.4 : 2.7, ambient: 1.8, height: 35, label: '白天' };
}
export function anniversariesToday(items, now) {
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return items.filter(item => item.date === md || item.date === `${now.getFullYear()}-${md}`);
}
export function normalizeState(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  return {
    found: Array.isArray(raw.found) ? [...new Set(raw.found.filter(x => typeof x === 'string'))] : [],
    dayFound: raw.dayFound === true,
    wishes: Array.isArray(raw.wishes) ? raw.wishes.filter(x => x && ['me', 'you'].includes(x.author) && typeof x.text === 'string' && x.text.length <= 500) : [],
    notes: Array.isArray(raw.notes) ? ['me', 'you'].flatMap(author => { const note = raw.notes.findLast(x => x && x.author === author && typeof x.text === 'string' && x.text.length <= 500); return note ? [note] : []; }) : [],
  };
}
export function visibleWishes(state, author, threshold) {
  const ownCoins = state.wishes.filter(w => w.author === author).length;
  return state.wishes.filter(w => w.author === author || ownCoins >= threshold);
}
export function allLettersFound(letters, found) { return letters.length > 0 && letters.every(letter => found.includes(letter.id)); }
export function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('world.json 必须是一个对象');
  if (config.startDate !== null && calendarDay(config.startDate) === null) throw new Error('开始日期需要 YYYY-MM-DD 格式的有效日期');
  if (!Number.isInteger(config.wishRevealCoins) || config.wishRevealCoins < 0) throw new Error('许愿解锁数量必须是非负整数');
  for (const key of ['initials','doorPassword','letterReward']) if (typeof config[key] !== 'string') throw new Error(`${key} 需要是文本`);
  if (!config.bench || typeof config.bench.name !== 'string' || typeof config.bench.text !== 'string') throw new Error('长椅配置无效');
  if (!Array.isArray(config.anniversaries) || config.anniversaries.some(x => !x || typeof x.date !== 'string' || typeof x.message !== 'string' || !/^#[0-9a-f]{6}$/i.test(x.skyColor || ''))) throw new Error('纪念日需要日期、消息和 #RRGGBB 天空颜色');
  if (!['sunny','rain','snow','sunset'].includes(config.favoriteWeather)) throw new Error('favoriteWeather 只能是 sunny、rain、snow 或 sunset');
  if (!config.firstDate || !['unconfigured','park','cafe','street'].includes(config.firstDate.type) || typeof config.firstDate.name !== 'string' || typeof config.firstDate.description !== 'string') throw new Error('约会地点配置无效');
  if (!Array.isArray(config.homeCards) || config.homeCards.some(x => typeof x !== 'string')) throw new Error('homeCards 需要是文本列表');
  return config;
}
export function validateLetters(items) {
  if (!Array.isArray(items)) throw new Error('letters.json 需要是列表');
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id) || typeof item.title !== 'string' || typeof item.text !== 'string') throw new Error('每封信需要独立的 id、title 和 text');
    if (item.position && (!Array.isArray(item.position) || item.position.length !== 2 || !item.position.every(Number.isFinite))) throw new Error('信件位置需要 [x,z]');
    ids.add(item.id);
  }
  return items;
}
