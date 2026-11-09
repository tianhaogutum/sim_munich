import { t, setLocale, getLocale, onLocaleChange, locales } from './date_i18n.mjs';
// Title, pause, and preferences. Owner: title/menu agent.
// Integrate after story/photo/storyUI; route handleKey FIRST and call update each frame.

const SETTINGS_KEY = 'lmu-date-settings';
const DEFAULTS = { quality: 'high', volume: 75, muted: false, sensitivity: 1, subtitleSpeed: 1 };
const CHAPTERS = [
  ['meet', 'title.chapters.meet'], ['fountain_talk', 'title.chapters.fountain_talk'], ['find_memento', 'title.chapters.find_memento'],
  ['photos', 'title.chapters.photos'], ['postcard', 'title.chapters.postcard'],
];
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value))
  ? Math.max(min, Math.min(max, Number(value))) : fallback;

function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!value || typeof value !== 'object') return { ...DEFAULTS };
    return {
      quality: ['low', 'medium', 'high'].includes(value.quality) ? value.quality : DEFAULTS.quality,
      volume: clamp(value.volume ?? DEFAULTS.volume, 0, 100, DEFAULTS.volume),
      muted: value.muted === true,
      sensitivity: clamp(value.sensitivity ?? DEFAULTS.sensitivity, 0.5, 2, DEFAULTS.sensitivity),
      subtitleSpeed: clamp(value.subtitleSpeed ?? DEFAULTS.subtitleSpeed, 0.5, 2, DEFAULTS.subtitleSpeed),
    };
  } catch { return { ...DEFAULTS }; }
}

export function createTitle(engine, story) {
  const existing = document.getElementById('date-title-root');
  if (existing?.dateTitle) return existing.dateTitle;
  if (!document.querySelector('link[data-date-title]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./date_title.css', import.meta.url).href;
    link.dataset.dateTitle = '';
    document.head.appendChild(link);
  }

  const root = document.createElement('div');
  root.id = 'date-title-root';
  root.className = 'dt-root';
  root.hidden = true;
  root.innerHTML = '<div class="dt-vignette"></div><div class="dt-petals" aria-hidden="true"></div>' +
    '<div class="dt-surface"></div><div class="dt-iris" aria-hidden="true"></div>';
  document.body.appendChild(root);
  const surface = root.querySelector('.dt-surface');
  const petals = root.querySelector('.dt-petals');
  for (let i = 0; i < 18; i++) {
    const petal = document.createElement('i');
    petal.className = 'dt-petal';
    petal.style.cssText = `--dt-x:${(i * 37 + 8) % 100}%;--dt-delay:-${i * 1.7}s;` +
      `--dt-duration:${15 + i % 7 * 2}s;--dt-size:${6 + i % 4 * 2}px;--dt-drift:${40 + i % 5 * 24}px`;
    petals.appendChild(petal);
  }
  // Keep menu scrolling and touch gestures away from the world's orbit/zoom handlers.
  root.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  root.addEventListener('pointerdown', event => event.stopPropagation());
  root.addEventListener('touchmove', event => event.stopPropagation(), { passive: true });

  let screen = null;
  let origin = 'title';
  let busy = false;
  let previousFocus = null;
  let appliedAudio = null;
  let lastState = null;
  const settings = readSettings();
  engine.preferences = settings; // Live shared camera/dialogue preferences.
  // M and the audio button persist through the audio module, not this menu.
  settings.muted = engine.audio?.isMuted?.() ?? settings.muted;
  const bloomStrengths = new WeakMap();

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Private browsing is OK. */ }
  }

  function applyAudio() {
    const audio = engine.audio;
    if (!audio) return;
    audio.setVolume?.(settings.volume / 100);
    audio.setMuted?.(settings.muted || settings.volume === 0);
    appliedAudio = audio;
  }

  function applyQuality() {
    const ratio = settings.quality === 'low' ? 0.75 : settings.quality === 'medium'
      ? 1 : Math.min(globalThis.devicePixelRatio || 1, 2);
    engine.renderer?.setPixelRatio(ratio);
    if (engine.renderer?.shadowMap) { engine.renderer.shadowMap.enabled = settings.quality !== 'low'; engine.renderer.shadowMap.needsUpdate = true; }
    // EffectComposer caches its own pixel ratio; keep its render targets in sync too.
    engine.composer?.setPixelRatio?.(ratio);
    engine.composer?.setSize(innerWidth, innerHeight);
    const bloom = engine.composer?.passes?.find(pass => 'strength' in pass);
    if (bloom) {
      if (!bloomStrengths.has(bloom)) bloomStrengths.set(bloom, bloom.strength);
      bloom.strength = settings.quality === 'low' ? 0 : bloomStrengths.get(bloom);
    }
  }

  function changeSetting(key, value) {
    settings[key] = value;
    saveSettings();
    if (key === 'quality') applyQuality();
    if (key === 'volume' || key === 'muted') applyAudio();
    // Camera and dialogue owners can read the same settings, including live edits.
    root.dispatchEvent(new CustomEvent('lmu-date-settings-change', {
      bubbles: true, detail: { ...settings },
    }));
  }

  function hasProgress() {
    const state = story.getState();
    return state.stage !== 'meet' || Object.values(state.visited ?? {}).some(Boolean) ||
      Object.values(state.photos ?? {}).some(Boolean) || Object.values(state.collected ?? {}).some(Boolean);
  }

  const button = (action, label, extra = '') =>
    `<button type="button" class="dt-button ${extra}" data-dt-action="${action}">${label}</button>`;
  const back = () => button('back', `<span aria-hidden="true">←</span> ${t('title.back')}`, 'dt-back');
  const heading = (eyebrow, title, description = '') =>
    `<p class="dt-eyebrow">${eyebrow}</p><h2 class="dt-heading" id="dt-heading">${title}</h2>` +
    (description ? `<p class="dt-description">${description}</p>` : '');
  const card = content => `<section class="dt-card" role="dialog" aria-modal="true" aria-labelledby="dt-heading">${content}</section>`;

  function render() {
    lastState = story.getState();
    root.dataset.screen = screen;
    if (screen === 'title') {
      surface.innerHTML = `<section class="dt-title" role="dialog" aria-modal="true" aria-labelledby="dt-heading">
        <p class="dt-eyebrow"><span class="dt-star" aria-hidden="true">✦</span> ${t('title.eyebrow')}</p>
        <p class="dt-chapter">${t('title.chapter')} <span></span> ${t('title.together')}</p>
        <h1 class="dt-logo" id="dt-heading"><span>${t('title.our')}</span> <em>LMU</em></h1>
        <p class="dt-subtitle">${t('title.subtitle')} <span aria-hidden="true">·</span> ${t('title.dateChapter')}</p>
        <p class="dt-intro">${t('title.intro')}</p>
        <nav class="dt-menu" aria-label="${t('title.mainMenu')}">
          ${button('start', `${t('title.start')} <span aria-hidden="true">↗</span>`, 'dt-primary dt-start')}
          ${hasProgress() ? button('continue', `${t('title.continue')} <span class="dt-button-note">${t('title.continueNote')}</span>`, 'dt-continue') : ''}
          <div class="dt-menu-pair">${button('chapter2', `${t('title.chapter2')} <span aria-hidden="true">→</span>`, 'dt-chapter2')}${button('chapter3', `${t('title.chapter3')} <span aria-hidden="true">→</span>`, 'dt-chapter3')}</div>
          ${button('city', `${t('title.city')} <span aria-hidden="true">↗</span>`, 'dt-city')}
          <div class="dt-menu-pair">${button('help', t('title.help'))}${button('credits', t('title.credits'))}</div>${button('settings', t('title.settings'))}
        </nav>
        <p class="dt-keyhint"><kbd>↑</kbd> <kbd>↓</kbd> ${t('title.choose')} <span>·</span> <kbd>Enter</kbd> ${t('title.go')}</p>
      </section>
      <div class="dt-scene-note" aria-hidden="true"><span>48°09′ N &nbsp; 11°35′ E</span><i></i><strong>${t('title.sceneSignature')}</strong><small>${t('title.sceneNote')}</small></div>
      <footer class="dt-footer"><span>${t('title.name')}</span><span>${t('title.footer')} &nbsp; ♡</span></footer>`;
    } else if (screen === 'pause') {
      surface.innerHTML = card(heading(t('title.pauseEyebrow'), t('title.pauseTitle'), t('title.pauseDescription')) +
        `<div class="dt-progress"><p class="dt-section-label">${t('title.currentPromise')}</p><p class="dt-objective"></p><ol class="dt-dots" aria-label="${t('title.progress')}"></ol></div>` +
        `<nav class="dt-menu" aria-label="${t('title.pauseMenu')}">${button('continue', `${t('title.resume')} <span aria-hidden="true">↗</span>`, 'dt-primary dt-continue')}` +
        `<div class="dt-menu-pair">${button('help', t('title.help'))}${button('settings', t('title.settings'))}</div>` +
        `${button('restart', t('title.restart'), 'dt-restart')}${button('title', t('title.toTitle'), 'dt-subtle')}</nav>` +
        `<p class="dt-keyhint"><kbd>Esc</kbd> ${t('title.escapeHint')}</p>`);
      renderProgress();
    } else if (screen === 'settings') {
      settings.muted = engine.audio?.isMuted?.() ?? settings.muted;
      const segments = (key, choices) => `<div class="dt-segments" role="group" aria-label="${key === 'quality' ? t('title.quality') : t('title.subtitleSpeed')}">` +
        choices.map(([value, label]) => `<button type="button" class="dt-segment" data-dt-setting="${key}" data-dt-value="${value}" aria-pressed="${settings[key] === value}">${label}</button>`).join('') + '</div>';
      surface.innerHTML = card(heading(t('title.settingsEyebrow'), t('title.settingsTitle'), t('title.settingsDescription')) +
        `<div class="dt-settings">
          <div class="dt-setting"><div><h3>${t('title.language')}</h3><p>${t('title.languageDescription')}</p></div><div class="dt-segments" role="group" aria-label="${t('title.language')}">${locales.map(code => `<button type="button" class="dt-segment" data-dt-locale="${code}" aria-pressed="${getLocale() === code}">${{ zh: t('title.locales.zh'), en: t('title.locales.en'), de: t('title.locales.de') }[code]}</button>`).join('')}</div></div>
          <div class="dt-setting"><div><h3>${t('title.quality')}</h3><p>${t('title.qualityDescription')}</p></div>${segments('quality', [['low', t('title.low')], ['medium', t('title.medium')], ['high', t('title.high')]])}</div>
          <div class="dt-setting dt-setting-volume"><div><label for="dt-volume">${t('title.volume')}</label><p>${t('title.volumeDescription')}</p></div><div class="dt-range-wrap"><input class="dt-range" id="dt-volume" data-dt-range="volume" type="range" min="0" max="100" step="5" value="${settings.volume}"/><output for="dt-volume">${settings.volume}%</output></div></div>
          <div class="dt-setting"><div><h3>${t('title.mute')}</h3><p>${t('title.muteDescription')}</p></div><button type="button" class="dt-toggle" data-dt-setting="muted" aria-pressed="${settings.muted}"><span aria-hidden="true"></span><b>${settings.muted ? t('title.muted') : t('title.soundOn')}</b></button></div>
          <div class="dt-setting"><div><label for="dt-sensitivity">${t('title.sensitivity')}</label><p>${t('title.sensitivityDescription')}</p></div><div class="dt-range-wrap"><input class="dt-range" id="dt-sensitivity" data-dt-range="sensitivity" type="range" min="0.5" max="2" step="0.1" value="${settings.sensitivity}"/><output for="dt-sensitivity">${settings.sensitivity.toFixed(1)}×</output></div></div>
          <div class="dt-setting"><div><h3>${t('title.subtitleSpeed')}</h3><p>${t('title.subtitleDescription')}</p></div>${segments('subtitleSpeed', [[0.5, t('title.slow')], [1, t('title.normal')], [2, t('title.fast')]])}</div>
        </div>${back()}`);
    } else if (screen === 'help') {
      const controls = [
        ['W A S D', t('title.walk')], ['Shift', t('title.run')], [t('title.mouseDrag'), t('title.look')], [t('title.wheel'), t('title.zoom')],
        ['E', t('title.talk')], ['P', t('title.photo')], ['Space', t('title.shutter')], ['Esc', t('title.pause')],
        ['N', t('title.map')], ['M', t('title.audio')],
      ];
      surface.innerHTML = card(heading(t('title.helpEyebrow'), t('title.helpTitle'), t('title.helpDescription')) +
        `<dl class="dt-controls">${controls.map(([key, text]) => `<div><dt><kbd>${key}</kbd></dt><dd>${text}</dd></div>`).join('')}</dl>` +
        `<p class="dt-touch-note"><span aria-hidden="true">◇</span> ${t('title.touchNote')}</p>` + back());
    } else if (screen === 'credits') {
      surface.innerHTML = card(heading(t('title.creditsEyebrow'), t('title.creditsTitle'), t('title.creditsDescription')) +
        `<div class="dt-credits" tabindex="0" aria-label="${t('title.creditsAria')}">
          <p class="dt-credit-heart" aria-hidden="true">♡</p><p class="dt-credit-name">${t('title.us')}</p><p>${t('title.roles')}</p>
          <div class="dt-credit-rule"></div><h3>${t('title.worldTitle')}</h3><p>three.js r160</p><p>${t('title.worldTech')}</p>
          <h3>${t('title.textTitle')}</h3><p>Cormorant Garamond · Klee One · Nunito</p><p>${t('title.fonts')}</p>
          <h3>${t('title.inspirationTitle')}</h3><p>${t('title.inspirationPlace')}</p><p>${t('title.inspiration')}</p>
          <div class="dt-credit-rule"></div><p class="dt-credit-ending">${t('title.thanks')}</p><p class="dt-credit-signature">${t('title.sceneSignature')}</p>
        </div>${back()}`);
    } else if (screen === 'confirm') {
      surface.innerHTML = card(heading(t('title.restartEyebrow'), t('title.restartTitle'), t('title.restartDescription')) +
        `<p class="dt-confirm-copy">${t('title.restartCopy')}</p>` +
        `<nav class="dt-menu" aria-label="${t('title.confirmRestart')}">${button('cancel', t('title.stay'), 'dt-primary')}` +
        `${button('confirm-restart', t('title.confirmRestart'), 'dt-confirm-restart')}</nav>`);
    }
  }

  function renderProgress() {
    if (screen !== 'pause') return;
    const state = story.getState();
    const objective = surface.querySelector('.dt-objective');
    if (objective) objective.textContent = state.stage === 'photos'
      ? t('story.objectives.photosProgress', { count: Object.values(state.photos ?? {}).filter(Boolean).length, total: Object.keys(state.photos ?? {}).length })
      : t(`story.objectives.${state.stage}`);
    const current = state.stage === 'done' ? CHAPTERS.length : CHAPTERS.findIndex(([id]) => id === state.stage);
    const dots = surface.querySelector('.dt-dots');
    if (dots) dots.innerHTML = CHAPTERS.map(([, label], i) =>
      `<li class="${i < current ? 'dt-complete' : i === current ? 'dt-current' : ''}"${i === current ? ' aria-current="step"' : ''}><span aria-hidden="true">${i < current ? '✓' : i + 1}</span><small>${t(label)}</small></li>`).join('');
  }

  function focusables() {
    return [...surface.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')];
  }

  function focusFirst() {
    if (!screen) return;
    (surface.querySelector(screen === 'title' && hasProgress() ? '.dt-continue' : '.dt-primary') ?? focusables()[0])?.focus({ preventScroll: true });
  }

  function show(next, immediate = false) {
    if (busy) return;
    if (!screen) {
      previousFocus = document.activeElement;
      engine.lock('title');
      document.body.classList.add('dt-hud-hidden');
      root.hidden = false;
      screen = next;
      render();
      requestAnimationFrame(() => { root.classList.add('dt-visible'); focusFirst(); });
      return;
    }
    const swap = () => { screen = next; render(); surface.classList.remove('dt-swapping'); busy = false; focusFirst(); };
    if (immediate) { swap(); return; }
    busy = true;
    surface.classList.add('dt-swapping');
    setTimeout(swap, 200);
  }

  function close() {
    if (!screen || busy) return;
    busy = true;
    root.classList.remove('dt-visible');
    setTimeout(() => {
      root.hidden = true;
      screen = null;
      busy = false;
      document.body.classList.remove('dt-hud-hidden');
      engine.unlock('title');
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }, 400);
  }

  function start(fresh) {
    if (busy) return;
    busy = true;
    root.classList.add('dt-departing');
    // Keep the world locked until the cover is opaque and the new state is ready.
    setTimeout(() => {
      if (fresh) story.dispatch({ type: 'RESTART' });
      surface.classList.add('dt-swapping');
      root.classList.remove('dt-visible');
      setTimeout(() => {
        root.hidden = true;
        root.classList.remove('dt-departing');
        surface.classList.remove('dt-swapping');
        screen = null;
        busy = false;
        document.body.classList.remove('dt-hud-hidden');
        engine.unlock('title');
        window.dispatchEvent(new CustomEvent('lmu:intro', { detail: { fresh } }));   // cinematic module hook
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      }, 420);
    }, 380);
  }

  function act(action) {
    if (busy) return;
    switch (action) {
      case 'start': start(true); break;
      case 'continue': screen === 'title' ? start(false) : close(); break;
      case 'help': case 'credits': case 'settings': origin = screen; show(action); break;
      case 'back': show(origin); break;
      case 'restart': show('confirm'); break;
      case 'cancel': show('pause'); break;
      case 'confirm-restart': start(true); break;
      case 'title': show('title'); break;
      case 'chapter2': location.href = './park.html'; break;
      case 'chapter3': location.href = './interior.html'; break;
      case 'city': location.href = './city.html'; break;
    }
  }

  surface.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || busy) return;
    if (target.dataset.dtLocale) {
      const code = target.dataset.dtLocale;
      setLocale(code);
      surface.querySelector(`[data-dt-locale="${code}"]`)?.focus({ preventScroll: true });
    } else if (target.dataset.dtAction) act(target.dataset.dtAction);
    else if (target.dataset.dtSetting) {
      const key = target.dataset.dtSetting;
      const value = key === 'muted' ? !settings.muted : key === 'quality' ? target.dataset.dtValue : Number(target.dataset.dtValue);
      changeSetting(key, value);
      if (key === 'muted') {
        target.setAttribute('aria-pressed', String(value));
        target.querySelector('b').textContent = value ? t('title.muted') : t('title.soundOn');
      } else {
        for (const option of surface.querySelectorAll(`[data-dt-setting="${key}"]`)) {
          option.setAttribute('aria-pressed', String(option === target));
        }
      }
    }
  });

  surface.addEventListener('input', event => {
    const input = event.target;
    const key = input.dataset.dtRange;
    if (!key || busy) return;
    changeSetting(key, Number(input.value));
    input.parentElement.querySelector('output').textContent = key === 'volume' ? `${settings[key]}%` : `${settings[key].toFixed(1)}×`;
  });

  function handleKey(key, event) {
    const k = String(key).toLowerCase();
    if (!screen) {
      if (k !== 'escape' || engine.isLocked() || engine.isPhotoMode() ||
        document.querySelector('#panel.open, #days-popup.visible')) return false;
      show('pause');
      event?.preventDefault();
      return true;
    }
    if (busy) { event?.preventDefault(); return true; }
    const active = document.activeElement;
    const elements = focusables();
    const index = elements.indexOf(active);
    if (k === 'escape') {
      if (screen === 'pause') close();
      else if (screen === 'confirm') show('pause');
      else if (screen !== 'title') show(origin);
    } else if (k === 'tab' || k === 'arrowup' || k === 'arrowdown') {
      // Credits keep native-style keyboard scrolling even though the world consumes keys.
      if (active?.classList.contains('dt-credits') && k !== 'tab') {
        active.scrollTop += k === 'arrowdown' ? 48 : -48;
      } else {
        const step = k === 'arrowup' || (k === 'tab' && event?.shiftKey) ? -1 : 1;
        elements[(index + step + elements.length) % elements.length]?.focus({ preventScroll: false });
      }
    } else if (k === 'arrowleft' || k === 'arrowright' || k === 'home' || k === 'end') {
      if (active?.matches('input[type="range"]')) {
        const min = Number(active.min), max = Number(active.max), step = Number(active.step);
        active.value = k === 'home' ? min : k === 'end' ? max :
          clamp(Number(active.value) + (k === 'arrowleft' ? -step : step), min, max, min);
        active.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (k === 'arrowleft' || k === 'arrowright') {
        elements[(index + (k === 'arrowleft' ? -1 : 1) + elements.length) % elements.length]?.focus();
      }
    } else if (k === 'enter' || k === ' ') {
      if (active?.matches('button') && surface.contains(active)) active.click();
      else if (screen === 'title') start(!hasProgress());
    } else if ((k === 'pagedown' || k === 'pageup') && active?.classList.contains('dt-credits')) {
      active.scrollTop += (k === 'pagedown' ? 1 : -1) * active.clientHeight * 0.8;
    }
    event?.preventDefault();
    return true;
  }

  function localize() {
    document.documentElement.lang = getLocale() === 'zh' ? 'zh-CN' : getLocale();
    if (screen) render();
  }
  // This controller shares the page lifetime; there is no public dispose contract.
  onLocaleChange(localize);
  localize();
  applyQuality();
  applyAudio();
  const params = new URLSearchParams(location.search);
  if (!params.has('stage') && params.get('notitle') !== '1') show('title');

  const controller = {
    update() {
      if (engine.audio && engine.audio !== appliedAudio) applyAudio();
      if (story.getState() !== lastState) {
        if (screen === 'pause') renderProgress();
        // A restore that completes after construction should reveal Continue too.
        if (screen === 'title' && !busy) { render(); focusFirst(); }
        lastState = story.getState();
      }
    },
    handleKey,
    isOpen: () => screen !== null,
  };
  root.dateTitle = controller;
  return controller;
}
