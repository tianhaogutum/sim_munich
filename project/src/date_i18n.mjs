// Shared localization, with no DOM dependency. Safe in the browser and Node.
import zh from './date_i18n_zh.mjs';
import en from './date_i18n_en.mjs';
import de from './date_i18n_de.mjs';

export const locales = Object.freeze(['zh', 'en', 'de']);
export const dictionaries = { zh, en, de };
const STORAGE_KEY = 'lmu-date-locale';
const listeners = new Set();
const warned = new Set();
let debug = false;
const normalize = code => typeof code === 'string'
  ? locales.find(locale => locale === code.trim().toLowerCase().split(/[-_]/)[0]) ?? null : null;
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };

/** URL > saved preference > Chinese. The browser language is deliberately NOT used: the story and photo
 *  copy exist only in Chinese so far, and a half-translated UI reads worse than a consistent one. Players
 *  switch languages in the settings panel (persisted) or with ?lang=. Inputs can be injected in tests. */
export function detectLocale(options = {}) {
  const search = options.search ?? globalThis.location?.search ?? '';
  const store = Object.hasOwn(options, 'storage') ? options.storage : storage();
  let saved;
  try { saved = store?.getItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
  return normalize(new URLSearchParams(search).get('lang')) || normalize(saved) || 'zh';
}
// Server-side imports retain the authored Chinese baseline; browsers auto-detect.
let locale = globalThis.location ? detectLocale() : 'zh';

export const getLocale = () => locale;
/** Persist explicitly chosen preferences, even if the locale was already selected by URL. */
export function setLocale(code) {
  const next = normalize(code);
  if (!next) return locale;
  try { storage()?.setItem(STORAGE_KEY, next); } catch { /* Private browsing / full storage. */ }
  if (next === locale) return locale;
  const previous = locale;
  locale = next;
  for (const fn of [...listeners]) fn(locale, previous);
  return locale;
}
export function onLocaleChange(fn) {
  if (typeof fn !== 'function') throw new TypeError('Locale listener must be a function');
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setI18nDebug(enabled) { debug = Boolean(enabled); }
const read = (dictionary, key) => String(key).split('.').reduce((value, part) =>
  value && Object.hasOwn(value, part) ? value[part] : undefined, dictionary);

/** Missing placeholders stay visible; replacement strings are never interpreted as HTML. */
export function t(key, params = {}) {
  let value = read(dictionaries[locale], key);
  if (typeof value !== 'string') {
    if (debug && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] Missing key "${key}" in ${locale}; falling back to zh`);
    }
    value = read(zh, key);
  }
  if (typeof value !== 'string') return String(key);
  return value.replace(/\{(\w+)\}/g, (token, name) =>
    params != null && Object.hasOwn(params, name) ? String(params[name]) : token);
}

/** Store variants at key.one / key.other (or other Intl plural categories). */
export function plural(key, count, params = {}) {
  const category = new Intl.PluralRules(locale).select(Number(count));
  const variant = typeof read(dictionaries[locale], `${key}.${category}`) === 'string'
    ? category : 'other';
  return t(`${key}.${variant}`, { ...params, count });
}
