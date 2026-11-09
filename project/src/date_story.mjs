// Pure story data, reducer and persistence. No DOM or THREE dependencies.
// Public API: createStory({storage?, search?}), initialState(), reduce(state, event),
// objectiveFor(state), postcardText(state). See DATE_CONTRACT.md for State / events.
// A valid ?stage= starts a fresh debug run; any ?stage= disables persistence.
import { STAGES, PHOTO_TARGETS, POIS } from './date_route.mjs';

export const SAVE_KEY = 'lmu-date-v1';
export const SPEAKERS = Object.freeze({ player: '我', companion: 'TA' });
const line = (speaker, text) => ({ speaker: SPEAKERS[speaker], text });
export const FOUNTAIN_OPTIONS = Object.freeze([
  { id: 'scenery', text: '记住这片风景，和风景里的你。' },
  { id: 'together', text: '记住我们这样慢慢聊天的下午。' },
  { id: 'again', text: '记住回来的路，下次还一起走。' },
]);

// Dialogue and postcard copy are kept together, independent of UI.
export const DIALOGUE = {
  meet: { lines: [
    line('companion', '你来啦。我刚刚还在想，你会不会从那排拱廊后面突然出现。'),
    line('player', '让你等很久了吗？'),
    line('companion', '没有。今天没有课表，也没有赶时间这回事。'),
    line('companion', '先陪我去喷泉边坐一会儿吧。今天的慕尼黑，留给我们。'),
  ] },
  fountain_talk: { lines: [
    line('player', '水声一响起来，好像连心里的钟都走慢了。'),
    line('companion', '那就再坐一会儿。等以后想起今天，你最想记住什么？'),
    line('player', '嗯……让我认真选一下。'),
  ], choices: FOUNTAIN_OPTIONS },
  find_memento: { lines: [
    line('companion', '咦，口袋里的小盒子怎么空了……'),
    line('companion', '我买了一枚樱花发夹，想送给你。刚才经过西边的树下时，还在的。'),
    line('player', '那我们沿着西边找找。礼物还没见到我，应该舍不得走远。'),
  ], skippable: true },
  memento_found: { lines: [
    line('player', '找到了！落在花瓣里，差点以为它也会开花。'),
    line('companion', '太好了。其实第一眼看到它，就觉得很适合你。'),
    line('player', '那就帮我别上吧。谢谢你，我很喜欢。'),
    line('companion', '好了。现在，今天的春天也在你头发上了。'),
  ] },
  photos: { lines: [
    line('companion', '趁光线还温柔，我们拍三张照片吧：主楼、喷泉，还有我们。'),
    line('player', '好。按 P 打开相机，把这个下午一张张留下来。'),
  ], skippable: true },
};

const MEMORIES = {
  scenery: {
    reply: '你说想记住风景。可我再看那片风景，里面总是先有你。',
    title: '把你写进慕尼黑的春天',
    body: '拱廊收下阳光，喷泉收下微风。\n樱花落进你的发间，你走进我的风景。\n今天的慕尼黑，因为有你，值得一再想起。',
  },
  together: {
    reply: '你说想记住我们聊天的下午。我也是，连那些安静的空白都喜欢。',
    title: '和你一起，慢一点也很好',
    body: '我们在 LMU 的台阶下见面，在喷泉边聊到忘了时间。\n一枚樱花发夹，三张照片，还有好多没说完的话。\n愿以后的日子，也能这样慢慢地一起走。',
  },
  again: {
    reply: '你说想记住回来的路。下次还是在这里见，好不好？',
    title: '下次，还在我们的广场见',
    body: '从主楼到喷泉，从樱花树下回到我们的广场。\n今天走过的路，都悄悄变成了下次的约定。\n慕尼黑的春天很长，我们还有很多个明天。',
  },
};

export const PHOTO_REACTIONS = {
  facade: `${SPEAKERS.companion}：拍到了！以后看见这排拱廊，就会想起今天在这里等你。`,
  fountain: `${SPEAKERS.player}：水花也留下来了，好像照片里还能听见声音。`,
  couple: `${SPEAKERS.companion}：这张我最喜欢。你看，我们都笑得好开心。`,
};

export function dialogueFor(id, state) {
  if (id !== 'ending') return DIALOGUE[id] ?? null;
  const memory = MEMORIES[state?.choices?.fountain] ?? MEMORIES.together;
  return { lines: [
    line('player', '绕了一圈，又回到我们的广场了。'),
    line('companion', memory.reply),
    line('player', '那就把今天做成明信片吧。收件人是，以后的我们。'),
    line('companion', '好。今天很开心。明天，也请多多关照。'),
  ] };
}

const PHOTO_IDS = PHOTO_TARGETS.map(t => t.id);
const OPTION_IDS = FOUNTAIN_OPTIONS.map(option => option.id);
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function initialState() {
  return { version: 1, stage: 'meet', choices: {},
    photos: Object.fromEntries(PHOTO_IDS.map(id => [id, false])),
    collected: {}, visited: {}, completedAt: null };
}

export function reduce(state, event) {
  if (!event || typeof event.type !== 'string') return state;
  switch (event.type) {
    case 'RESTART': return initialState();
    case 'VISIT': {
      if (!owns(POIS, event.id) || state.stage === 'done') return state;
      // Only the current quest location (or optional memorial) can be visited.
      const expected = { meet: 'entrance', fountain_talk: 'fountain', postcard: 'our_plaza' }[state.stage];
      if (event.id !== expected && event.id !== 'white_rose') return state;
      if (state.visited[event.id]) return state;
      const next = { ...state, visited: { ...state.visited, [event.id]: true } };
      if (state.stage === 'meet' && event.id === 'entrance') next.stage = 'fountain_talk';
      if (state.stage === 'postcard' && event.id === 'our_plaza') {
        next.stage = 'done'; next.completedAt = Date.now();
      }
      return next;
    }
    case 'CHOOSE':
      if (state.stage !== 'fountain_talk' || !state.visited.fountain ||
          event.id !== 'fountain' || !OPTION_IDS.includes(event.option)) return state;
      return { ...state, stage: 'find_memento', choices: { ...state.choices, fountain: event.option } };
    case 'COLLECT':
      if (state.stage !== 'find_memento' || event.id !== 'memento') return state;
      return { ...state, stage: 'photos', collected: { ...state.collected, memento: true } };
    case 'PHOTO': {
      if (state.stage !== 'photos' || !PHOTO_IDS.includes(event.id) || state.photos[event.id]) return state;
      const photos = { ...state.photos, [event.id]: true };
      return { ...state, photos, stage: PHOTO_IDS.every(id => photos[id]) ? 'postcard' : 'photos' };
    }
    default: return state;
  }
}

const OBJECTIVES = {
  meet: { text: '去主楼入口和 TA 见面', poi: 'entrance' },
  fountain_talk: { text: '和 TA 一起去喷泉边聊聊天', poi: 'fountain' },
  find_memento: { text: '去西边的樱花树下，找回樱花发夹', poi: 'memento' },
  photos: { text: '拍三张照片：主楼 · 喷泉 · 合影', poi: null },
  postcard: { text: '回到「我们的广场」，写下今天', poi: 'our_plaza' },
  done: { text: '今天的约会完成了 ♡', poi: null },
};

export function objectiveFor(state) {
  const base = OBJECTIVES[state.stage] ?? OBJECTIVES.meet;
  if (state.stage !== 'photos') return { ...base };
  const done = PHOTO_IDS.filter(id => state.photos[id]).length;
  return { ...base, text: `${base.text}（${done}/${PHOTO_IDS.length}）` };
}

export function postcardText(state) {
  const { title, body } = MEMORIES[state?.choices?.fountain] ?? MEMORIES.together;
  return { title, body };
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function validSave(state) {
  if (!record(state) || state.version !== 1 || !STAGES.includes(state.stage)) return false;
  if (!record(state.choices) || !Object.keys(state.choices).every(id => id === 'fountain' && OPTION_IDS.includes(state.choices[id]))) return false;
  if (!record(state.photos) || Object.keys(state.photos).length !== PHOTO_IDS.length ||
      !PHOTO_IDS.every(id => owns(state.photos, id) && typeof state.photos[id] === 'boolean')) return false;
  if (!record(state.collected) || !Object.keys(state.collected).every(id => id === 'memento' && state.collected[id] === true)) return false;
  if (!record(state.visited) || !Object.keys(state.visited).every(id => owns(POIS, id) && state.visited[id] === true)) return false;
  if (state.stage === 'done') {
    if (!Number.isFinite(state.completedAt) || state.completedAt <= 0 || !state.visited.our_plaza) return false;
  } else if (state.completedAt !== null) return false;
  // A syntactically valid but impossible save must not strand the player.
  const stageIndex = STAGES.indexOf(state.stage);
  if (stageIndex >= 1 && !state.visited.entrance) return false;
  if (stageIndex >= 2 && (!state.visited.fountain || !state.choices.fountain)) return false;
  if (stageIndex >= 3 && !state.collected.memento) return false;
  if (stageIndex >= 4 && !PHOTO_IDS.every(id => state.photos[id])) return false;
  if (stageIndex < 2 && (state.choices.fountain || state.collected.memento)) return false;
  if (stageIndex < 3 && PHOTO_IDS.some(id => state.photos[id])) return false;
  if (state.stage === 'photos' && PHOTO_IDS.every(id => state.photos[id])) return false;
  if (state.stage !== 'done' && state.visited.our_plaza) return false;
  return true;
}

function safeLocalStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function debugState(stage) {
  let state = initialState();
  for (const event of [
    { type: 'VISIT', id: 'entrance' }, { type: 'VISIT', id: 'fountain' },
    { type: 'CHOOSE', id: 'fountain', option: 'together' }, { type: 'COLLECT', id: 'memento' },
    ...PHOTO_IDS.map(id => ({ type: 'PHOTO', id })), { type: 'VISIT', id: 'our_plaza' },
  ]) {
    if (state.stage === stage) break;
    state = reduce(state, event);
  }
  return state;
}

export function createStory({ storage = safeLocalStorage(), search = globalThis.location?.search ?? '' } = {}) {
  const params = new URLSearchParams(search);
  const debug = params.has('stage');
  const forced = params.get('stage');
  let state = initialState();
  if (debug) {
    if (STAGES.includes(forced)) state = debugState(forced);
  } else {
    try {
      const saved = JSON.parse(storage?.getItem(SAVE_KEY) ?? 'null');
      if (validSave(saved)) state = saved;
    } catch { /* Unavailable storage and damaged saves start fresh. */ }
  }
  const listeners = new Set();
  return {
    getState: () => state,
    dispatch(event) {
      const prev = state;
      const next = reduce(state, event);
      if (next !== prev) {
        state = next;
        if (!debug) {
          try { storage?.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Continue without saving. */ }
        }
        for (const fn of listeners) fn(state, prev, event);
      }
      return state;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
