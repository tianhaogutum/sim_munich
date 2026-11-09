import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { t, plural, setLocale, getLocale, detectLocale, onLocaleChange, locales,
  dictionaries, setI18nDebug } from '../src/date_i18n.mjs';
import { BANTER_POOLS } from '../src/date_banter_lines.mjs';
import { MEMORY_ITEMS, ACHIEVEMENTS } from '../src/date_collect_data.mjs';
import { SEQUENCES, createSequence } from '../src/date_cinematic_paths.mjs';

function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, text]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof text === 'string' ? [[path, text]] : Object.entries(flatten(text, path));
  }));
}
const placeholderNames = text => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
const saved = value => ({ getItem: key => key === 'lmu-date-locale' ? value : null });

test('all locales have exactly the Chinese keys, nonempty strings and matching placeholders', () => {
  assert.deepEqual(locales, ['zh', 'en', 'de']);
  const source = flatten(dictionaries.zh);
  for (const code of locales) {
    const copy = flatten(dictionaries[code]);
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(source).sort(), code);
    for (const [key, text] of Object.entries(copy)) {
      assert.ok(text.trim(), `${code}: ${key}`);
      assert.deepEqual(placeholderNames(text), placeholderNames(source[key]), `${code}: ${key}`);
    }
  }
});

test('interpolation handles named, repeated, numeric and literal replacement values', () => {
  setLocale('en');
  assert.equal(t('hud.days', { days: 0 }), '✦ 0 days together ✦');
  assert.equal(t('banter.speakerLine', { speaker: '$&', text: 'A {speaker} B' }), '$&: A {speaker} B');
  assert.equal(t('hud.days'), '✦ {days} days together ✦');
  assert.equal(t('title.name', { unused: true }), 'Our LMU');
  setLocale('zh');
});

test('missing keys fall back to Chinese and warn once per key only in debug mode', () => {
  setLocale('en');
  const original = dictionaries.en.title.name;
  const warn = console.warn;
  const warnings = [];
  console.warn = message => warnings.push(message);
  try {
    delete dictionaries.en.title.name;
    assert.equal(t('title.name'), dictionaries.zh.title.name);
    assert.equal(warnings.length, 0);
    setI18nDebug(true);
    assert.equal(t('title.name'), dictionaries.zh.title.name);
    t('title.name');
    assert.equal(warnings.length, 1);
    assert.equal(t('missing.test.key'), 'missing.test.key');
    t('missing.test.key');
    assert.equal(warnings.length, 2);
  } finally {
    dictionaries.en.title.name = original;
    console.warn = warn;
    setI18nDebug(false);
    setLocale('zh');
  }
});

test('detectLocale honors URL, then storage, then navigator, then Chinese fallback', () => {
  assert.equal(detectLocale({ search: '?lang=DE-de', storage: saved('en'), language: 'zh-CN' }), 'de');
  assert.equal(detectLocale({ search: '', storage: saved('en-US'), language: 'de-DE' }), 'en');
  assert.equal(detectLocale({ search: '?lang=fr', storage: saved('de'), language: 'en' }), 'de');
  assert.equal(detectLocale({ search: '', storage: saved('invalid'), language: 'de-AT' }), 'de');
  assert.equal(detectLocale({ search: '', storage: null, language: 'fr-FR' }), 'zh');
  assert.equal(detectLocale({ search: '?lang=zh', storage: null, language: 'en' }), 'zh');
  assert.equal(detectLocale({ search: '', storage: { getItem() { throw new Error('denied'); } }, language: 'en-GB' }), 'en');
});

test('locale changes persist, notify once, unsubscribe, and reject unsupported locales', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const writes = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    setItem: (...args) => writes.push(args), getItem: () => null,
  } });
  setLocale('zh');
  const changes = [];
  const off = onLocaleChange((...args) => changes.push(args));
  try {
    assert.equal(setLocale('de-DE'), 'de');
    assert.equal(getLocale(), 'de');
    setLocale('de');
    setLocale('xx');
    assert.deepEqual(changes, [['de', 'zh']]);
    assert.deepEqual(writes.at(-1), ['lmu-date-locale', 'de']);
    off();
    setLocale('en');
    assert.equal(changes.length, 1);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    assert.doesNotThrow(() => setLocale('zh'));
  } finally {
    off();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
    setLocale('zh');
  }
});

test('plural helper selects Chinese other and English/German one or other with interpolation', () => {
  setLocale('en');
  assert.equal(plural('hud.memoryCount', 1), '1 memory');
  assert.equal(plural('hud.memoryCount', 0), '0 memories');
  assert.equal(plural('hud.memoryCount', 2), '2 memories');
  setLocale('de');
  assert.equal(plural('hud.memoryCount', 1), '1 Erinnerung');
  assert.equal(plural('hud.memoryCount', 2), '2 Erinnerungen');
  setLocale('zh');
  assert.equal(plural('hud.memoryCount', 1), '1 段回忆');
  assert.equal(plural('hud.memoryCount', 2), '2 段回忆');
});

test('authored data stays live across locales without changing identities or game conditions', () => {
  const line = BANTER_POOLS.idle[0];
  const note = MEMORY_ITEMS[0];
  const shot = createSequence('intro');
  assert.equal(Object.values(BANTER_POOLS).flat().length, 80);
  assert.equal(MEMORY_ITEMS.length, 8);
  assert.equal(ACHIEVEMENTS.length, 9);
  const original = [line.text, note.title, note.note[0], shot.captions[0].title];
  for (const code of ['en', 'de']) {
    setLocale(code);
    assert.equal(line.text, t('banter.idle.0'));
    assert.equal(note.title, t('collect.memories.crane.title'));
    assert.equal(shot.captions[0].title, t('cinematic.introStreet'));
    assert.equal(SEQUENCES.intro.captions[0].title, shot.captions[0].title);
    assert.equal(ACHIEVEMENTS[0].test({ fragmentsFound: 1 }), true);
    assert.notDeepEqual([line.text, note.title, note.note[0], shot.captions[0].title], original);
    assert.equal(line, BANTER_POOLS.idle[0]);
    assert.equal(note, MEMORY_ITEMS[0]);
  }
  setLocale('zh');
  assert.deepEqual([line.text, note.title, note.note[0], shot.captions[0].title], original);
});

test('owned modules have no missing literal translation references', () => {
  const keys = flatten(dictionaries.zh);
  for (const file of ['date_audio.js', 'date_input.js', 'date_title.js', 'date_map.js',
    'date_banter.js', 'date_banter_lines.mjs', 'date_collect.js', 'date_collect_data.mjs',
    'date_cinematic.js', 'date_cinematic_paths.mjs']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\bt\('([^']+)'/g)) assert.ok(Object.hasOwn(keys, match[1]), `${file}: ${match[1]}`);
  }
});
