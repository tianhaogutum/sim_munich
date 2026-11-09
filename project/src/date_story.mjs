// date_story.mjs — pure quest state machine (no DOM, no THREE). Owner: story agent.
//
// CONTRACT (extend freely, but do not change these names or shapes; other modules depend on them):
//   createStory({ storage?, search? }) -> {
//     getState(): State,
//     dispatch(event): State,          // returns the new state; listeners fire only when the state changed
//     subscribe(fn(state, prev, event)): unsubscribe,
//   }
//   State = { version: 1, stage, choices: {[dialogId]: optionId}, photos: {facade, fountain, couple: boolean},
//             collected: {[id]: true}, visited: {[id]: true}, completedAt: number|null }
//   stage ∈ STAGES (date_route.mjs): meet → fountain_talk → find_memento → photos → postcard → done
//   Events: {type:'VISIT',id} {type:'CHOOSE',id,option} {type:'COLLECT',id} {type:'PHOTO',id} {type:'RESTART'}
//   objectiveFor(state) -> { text: string, poi: string|null }   // HUD objective + beacon target (POIS key)
//   postcardText(state) -> { title: string, body: string }      // used by the photo module for the postcard
//   Debug: `?stage=<stage>` in the URL starts a fresh, unsaved run at that stage.
//
// SKELETON NOTE: this version advances on VISIT alone and does not persist. The story agent replaces the
// transition rules (e.g. require the fountain dialogue CHOOSE), adds dialogue data and save/restore.
import { STAGES, PHOTO_TARGETS } from './date_route.mjs';

const PHOTO_IDS = PHOTO_TARGETS.map(t => t.id);

export function initialState() {
  return {
    version: 1,
    stage: 'meet',
    choices: {},
    photos: Object.fromEntries(PHOTO_IDS.map(id => [id, false])),
    collected: {},
    visited: {},
    completedAt: null,
  };
}

export function reduce(state, event) {
  if (!event || typeof event.type !== 'string') return state;
  if (event.type === 'RESTART') return initialState();
  const s = structuredClone(state);
  switch (event.type) {
    case 'VISIT':
      s.visited[event.id] = true;
      if (s.stage === 'meet' && event.id === 'entrance') s.stage = 'fountain_talk';
      else if (s.stage === 'fountain_talk' && event.id === 'fountain') s.stage = 'find_memento';
      else if (s.stage === 'postcard' && event.id === 'our_plaza') { s.stage = 'done'; s.completedAt = Date.now(); }
      return s;
    case 'CHOOSE':
      s.choices[event.id] = event.option;
      return s;
    case 'COLLECT':
      s.collected[event.id] = true;
      if (s.stage === 'find_memento' && event.id === 'memento') s.stage = 'photos';
      return s;
    case 'PHOTO':
      if (s.stage !== 'photos' || !(event.id in s.photos) || s.photos[event.id]) return state;
      s.photos[event.id] = true;
      if (PHOTO_IDS.every(id => s.photos[id])) s.stage = 'postcard';
      return s;
    default:
      return state;
  }
}

const OBJECTIVES = {
  meet:          { text: '去主楼入口和 TA 见面',          poi: 'entrance' },
  fountain_talk: { text: '和 TA 一起去喷泉边聊聊天',       poi: 'fountain' },
  find_memento:  { text: '帮 TA 找回掉落的纪念物',         poi: 'memento' },
  photos:        { text: '拍三张照片：主楼 · 喷泉 · 合影',  poi: null },
  postcard:      { text: '回到「我们的广场」领取明信片',    poi: 'our_plaza' },
  done:          { text: '今天的约会完成了 ♡',            poi: null },
};

export function objectiveFor(state) {
  const base = OBJECTIVES[state.stage] ?? OBJECTIVES.meet;
  if (state.stage !== 'photos') return { ...base };
  const done = PHOTO_IDS.filter(id => state.photos[id]).length;
  return { ...base, text: `${base.text}（${done}/${PHOTO_IDS.length}）` };
}

export function postcardText(state) {
  return {
    title: '慕尼黑 · 我们的一天',
    body: '在 LMU 的台阶下见面，在喷泉边聊到忘了时间。\n愿以后的每一天，都像今天一样。',
  };
}

function safeLocalStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function createStory({ storage = safeLocalStorage(), search = globalThis.location?.search ?? '' } = {}) {
  void storage; // skeleton: persistence is added by the story agent
  let state = initialState();
  const forced = new URLSearchParams(search).get('stage');
  if (forced && STAGES.includes(forced)) state = { ...initialState(), stage: forced };
  const listeners = new Set();
  return {
    getState: () => state,
    dispatch(event) {
      const prev = state;
      const next = reduce(state, event);
      if (next !== prev) {
        state = next;
        for (const fn of listeners) fn(state, prev, event);
      }
      return state;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
