import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStory, initialState, reduce, SAVE_KEY, FOUNTAIN_OPTIONS, SPEAKERS,
  dialogueFor, postcardText, objectiveFor,
} from '../src/date_story.mjs';
import { STAGES } from '../src/date_route.mjs';

const visit = id => ({ type: 'VISIT', id });
const choose = option => ({ type: 'CHOOSE', id: 'fountain', option });
const collect = { type: 'COLLECT', id: 'memento' };
const photo = id => ({ type: 'PHOTO', id });
const path = option => [visit('entrance'), visit('fountain'), choose(option), collect,
  photo('facade'), photo('fountain'), photo('couple'), visit('our_plaza')];
const advance = (events, state = initialState()) => events.reduce(reduce, state);
function memoryStorage(initial = null) {
  let value = initial;
  return { writes: [], getItem(key) { assert.equal(key, SAVE_KEY); return value; },
    setItem(key, next) { assert.equal(key, SAVE_KEY); value = next; this.writes.push(next); } };
}

test('chapter transitions require a fountain visit and one valid choice', () => {
  let state = initialState();
  assert.equal(state.stage, 'meet');
  state = reduce(state, visit('entrance'));
  assert.equal(state.stage, 'fountain_talk');
  assert.equal(reduce(state, choose('together')), state);
  state = reduce(state, visit('fountain'));
  assert.equal(state.stage, 'fountain_talk');
  assert.equal(reduce(state, choose('invalid')), state);
  state = reduce(state, choose('together'));
  assert.equal(state.stage, 'find_memento');
  assert.equal(state.choices.fountain, 'together');
  state = reduce(state, collect);
  assert.equal(state.stage, 'photos');
  assert.equal(state.collected.memento, true);
  for (const id of ['facade', 'fountain', 'couple']) state = reduce(state, photo(id));
  assert.equal(state.stage, 'postcard');
  const before = Date.now();
  state = reduce(state, visit('our_plaza'));
  assert.equal(state.stage, 'done');
  assert.ok(state.completedAt >= before && state.completedAt <= Date.now());
  assert.deepEqual(reduce(state, { type: 'RESTART' }), initialState());
});

test('invalid, unknown, duplicate and out-of-order events are no-ops', () => {
  const fresh = initialState();
  for (const event of [null, {}, { type: 'BOGUS' }, visit('fountain'), visit('our_plaza'), visit('__proto__'),
    visit(undefined), collect, photo('facade'), choose('scenery')]) {
    assert.equal(reduce(fresh, event), fresh);
  }
  const fountain = advance([visit('entrance'), visit('fountain')]);
  for (const event of [visit('entrance'), visit('fountain'), collect, photo('couple'),
    { type: 'CHOOSE', id: 'elsewhere', option: 'scenery' }]) assert.equal(reduce(fountain, event), fountain);
  const photos = advance(path('again').slice(0, 5));
  for (const event of [photo('facade'), photo('__proto__'), photo('unknown'), collect, choose('together')]) {
    assert.equal(reduce(photos, event), photos);
  }
  const done = advance(path('scenery'));
  for (const event of path('together')) assert.equal(reduce(done, event), done);
});

test('reducer does not mutate previous states; optional memorial is idempotent', () => {
  const state = initialState();
  Object.freeze(state.photos); Object.freeze(state.choices); Object.freeze(state.visited); Object.freeze(state);
  const visited = reduce(state, visit('white_rose'));
  assert.equal(visited.stage, 'meet');
  assert.equal(visited.visited.white_rose, true);
  assert.equal(reduce(visited, visit('white_rose')), visited);
  assert.equal(state.visited.white_rose, undefined);
});

test('all three choices change ending dialogue and postcard text', () => {
  const postcards = [];
  const endings = [];
  for (const option of FOUNTAIN_OPTIONS) {
    const state = advance(path(option.id));
    postcards.push(JSON.stringify(postcardText(state)));
    endings.push(JSON.stringify(dialogueFor('ending', state)));
    assert.match(postcardText(state).body, /\n/);
    assert.equal(state.choices.fountain, option.id);
  }
  assert.equal(new Set(postcards).size, 3);
  assert.equal(new Set(endings).size, 3);
  assert.deepEqual(postcardText(initialState()), postcardText(advance(path('together'))));
  for (const id of ['meet', 'fountain_talk', 'find_memento', 'memento_found', 'photos', 'ending']) {
    const data = dialogueFor(id, initialState());
    assert.ok(data.lines.length >= 2 && data.lines.length <= 5);
    for (const line of data.lines) assert.ok(Object.values(SPEAKERS).includes(line.speaker));
  }
});

test('photo objective counts only completed goals', () => {
  const state = advance(path('together').slice(0, 5));
  assert.match(objectiveFor(state).text, /1\/3/);
  assert.equal(objectiveFor(state).poi, null);
  assert.equal(objectiveFor(initialState()).poi, 'entrance');
});

test('storage round trip after every transition, including completed run and restart', () => {
  const storage = memoryStorage();
  const story = createStory({ storage, search: '' });
  let changes = 0;
  const unsubscribe = story.subscribe((next, prev, event) => {
    changes++;
    assert.notEqual(next, prev);
    assert.ok(event.type);
    // Persist before notifications, so a reload inside a listener sees this event.
    assert.deepEqual(createStory({ storage, search: '' }).getState(), next);
  });
  for (const event of path('again')) story.dispatch(event);
  assert.equal(changes, 8);
  assert.equal(storage.writes.length, 8);
  story.dispatch(photo('invalid'));
  assert.equal(changes, 8);
  assert.equal(storage.writes.length, 8);
  unsubscribe();
  story.dispatch({ type: 'RESTART' });
  assert.equal(changes, 8);
  assert.equal(storage.writes.length, 9);
  assert.deepEqual(createStory({ storage, search: '' }).getState(), initialState());
});

test('corrupt, wrong-version, malformed or impossible saves fall back safely', () => {
  const valid = advance(path('scenery'));
  const saves = ['not json', '', 'null', '[]', '3', '{}',
    JSON.stringify({ ...valid, version: 2 }), JSON.stringify({ ...valid, stage: 'nope' }),
    JSON.stringify({ ...valid, choices: [] }), JSON.stringify({ ...valid, choices: { fountain: 'invalid' } }),
    JSON.stringify({ ...valid, photos: { facade: 'true', fountain: true, couple: true } }),
    JSON.stringify({ ...valid, collected: { memento: false } }),
    JSON.stringify({ ...valid, visited: { unknown: true } }),
    JSON.stringify({ ...valid, completedAt: 'yesterday' }),
    JSON.stringify({ ...initialState(), stage: 'postcard' }),
    JSON.stringify({ ...initialState(), photos: { facade: true, fountain: false, couple: false } }),
  ];
  for (const saved of saves) {
    const storage = memoryStorage(saved);
    assert.deepEqual(createStory({ storage, search: '' }).getState(), initialState(), saved);
    assert.equal(storage.writes.length, 0);
  }
});

test('null, inaccessible, and full storage never prevent play', () => {
  for (const storage of [null, {}, {
    getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); },
  }]) {
    const story = createStory({ storage, search: '' });
    assert.doesNotThrow(() => path('together').forEach(event => story.dispatch(event)));
    assert.equal(story.getState().stage, 'done');
  }
});

test('every debug stage is fresh and playable, never reads or writes storage', () => {
  const storage = { getItem() { throw new Error('must not read'); }, setItem() { throw new Error('must not save'); } };
  for (const stage of STAGES) {
    const story = createStory({ storage, search: `?stage=${stage}` });
    assert.equal(story.getState().stage, stage);
    // Replaying the route safely passes earlier stages until the current point.
    for (const event of path('again')) story.dispatch(event);
    assert.equal(story.getState().stage, 'done');
    story.dispatch({ type: 'RESTART' });
    assert.deepEqual(story.getState(), initialState());
  }
  for (const search of ['?stage=', '?stage=unknown']) {
    assert.deepEqual(createStory({ storage, search }).getState(), initialState());
  }
  const existing = memoryStorage(JSON.stringify(advance(path('scenery'))));
  const debug = createStory({ storage: existing, search: '?stage=photos' });
  debug.dispatch(photo('facade')); debug.dispatch({ type: 'RESTART' });
  assert.equal(existing.writes.length, 0);
  assert.equal(createStory({ storage: existing, search: '' }).getState().stage, 'done');
});
