// Title, pause, and preferences. Owner: title/menu agent.
// Integrate after story/photo/storyUI; route handleKey FIRST and call update each frame.
import { objectiveFor } from './date_story.mjs';

const SETTINGS_KEY = 'lmu-date-settings';
const DEFAULTS = { quality: 'high', volume: 75, muted: false, sensitivity: 1, subtitleSpeed: 1 };
const CHAPTERS = [
  ['meet', '初次见面'], ['fountain_talk', '喷泉私语'], ['find_memento', '寻找发夹'],
  ['photos', '定格此刻'], ['postcard', '我们的明信片'],
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
  const back = () => button('back', '<span aria-hidden="true">←</span> 返回', 'dt-back');
  const heading = (eyebrow, title, description = '') =>
    `<p class="dt-eyebrow">${eyebrow}</p><h2 class="dt-heading" id="dt-heading">${title}</h2>` +
    (description ? `<p class="dt-description">${description}</p>` : '');
  const card = content => `<section class="dt-card" role="dialog" aria-modal="true" aria-labelledby="dt-heading">${content}</section>`;

  function render() {
    lastState = story.getState();
    root.dataset.screen = screen;
    if (screen === 'title') {
      surface.innerHTML = `<section class="dt-title" role="dialog" aria-modal="true" aria-labelledby="dt-heading">
        <p class="dt-eyebrow"><span class="dt-star" aria-hidden="true">✦</span> A LITTLE LOVE LETTER TO MUNICH</p>
        <p class="dt-chapter">CHAPTER 01 <span></span> 与你，一起</p>
        <h1 class="dt-logo" id="dt-heading"><span>我们的</span> <em>LMU</em></h1>
        <p class="dt-subtitle">慕尼黑 <span aria-hidden="true">·</span> 约会篇</p>
        <p class="dt-intro">把平凡的一天，<br>过成只属于我们的纪念。</p>
        <nav class="dt-menu" aria-label="主菜单">
          ${button('start', '开始约会 <span aria-hidden="true">↗</span>', 'dt-primary dt-start')}
          ${hasProgress() ? button('continue', '继续 <span class="dt-button-note">赴我们的约</span>', 'dt-continue') : ''}
          <div class="dt-menu-pair">${button('help', '操作说明')}${button('credits', '制作名单')}</div>
        </nav>
        <p class="dt-keyhint"><kbd>↑</kbd> <kbd>↓</kbd> 选择 <span>·</span> <kbd>Enter</kbd> 出发</p>
      </section>
      <div class="dt-scene-note" aria-hidden="true"><span>48°09′ N &nbsp; 11°35′ E</span><i></i><strong>München, mit dir.</strong><small>有你在的地方，就是风景。</small></div>
      <footer class="dt-footer"><span>我们的 LMU</span><span>A DAY TO REMEMBER &nbsp; ♡</span></footer>`;
    } else if (screen === 'pause') {
      surface.innerHTML = card(heading('A MOMENT, TOGETHER', '让时间慢一点', '风景会等我们，故事也是。') +
        '<div class="dt-progress"><p class="dt-section-label">此刻的约定</p><p class="dt-objective"></p><ol class="dt-dots" aria-label="约会进度"></ol></div>' +
        `<nav class="dt-menu" aria-label="暂停菜单">${button('continue', '继续约会 <span aria-hidden="true">↗</span>', 'dt-primary dt-continue')}` +
        `<div class="dt-menu-pair">${button('help', '操作说明')}${button('settings', '设置')}</div>` +
        `${button('restart', '重新开始', 'dt-restart')}${button('title', '返回标题', 'dt-subtle')}</nav>` +
        '<p class="dt-keyhint"><kbd>Esc</kbd> 回到你身边</p>');
      renderProgress();
    } else if (screen === 'settings') {
      settings.muted = engine.audio?.isMuted?.() ?? settings.muted;
      const segments = (key, choices) => `<div class="dt-segments" role="group" aria-label="${key === 'quality' ? '画质' : '字幕速度'}">` +
        choices.map(([value, label]) => `<button type="button" class="dt-segment" data-dt-setting="${key}" data-dt-value="${value}" aria-pressed="${settings[key] === value}">${label}</button>`).join('') + '</div>';
      surface.innerHTML = card(heading('MAKE YOURSELF AT HOME', '偏爱，随你', '调成你最舒服的样子。设置会自动保存。') +
        `<div class="dt-settings">
          <div class="dt-setting"><div><h3>画质</h3><p>光影与画面细腻程度</p></div>${segments('quality', [['low', '低'], ['medium', '中'], ['high', '高']])}</div>
          <div class="dt-setting dt-setting-volume"><div><label for="dt-volume">音量</label><p>让城市轻轻唱歌</p></div><div class="dt-range-wrap"><input class="dt-range" id="dt-volume" data-dt-range="volume" type="range" min="0" max="100" step="5" value="${settings.volume}"/><output for="dt-volume">${settings.volume}%</output></div></div>
          <div class="dt-setting"><div><h3>静音</h3><p>也可以静静地陪伴</p></div><button type="button" class="dt-toggle" data-dt-setting="muted" aria-pressed="${settings.muted}"><span aria-hidden="true"></span><b>${settings.muted ? '已静音' : '声音开启'}</b></button></div>
          <div class="dt-setting"><div><label for="dt-sensitivity">镜头灵敏度</label><p>慢慢看，或轻快转身</p></div><div class="dt-range-wrap"><input class="dt-range" id="dt-sensitivity" data-dt-range="sensitivity" type="range" min="0.5" max="2" step="0.1" value="${settings.sensitivity}"/><output for="dt-sensitivity">${settings.sensitivity.toFixed(1)}×</output></div></div>
          <div class="dt-setting"><div><h3>字幕速度</h3><p>以你的节奏读这段故事</p></div>${segments('subtitleSpeed', [[0.5, '慢'], [1, '标准'], [2, '快']])}</div>
        </div>${back()}`);
    } else if (screen === 'help') {
      const controls = [
        ['W A S D', '漫步校园'], ['Shift', '按住小跑'], ['鼠标拖动', '环顾四周'], ['滚轮', '拉近 / 拉远镜头'],
        ['E', '互动 / 与 TA 交谈'], ['P', '进入 / 退出拍照'], ['Space', '按下快门'], ['Esc', '返回 / 暂停'],
        ['N', '展开 / 收起小地图'], ['M', '静音 / 恢复声音'],
      ];
      surface.innerHTML = card(heading('A SMALL GUIDE TO OUR DAY', '一起，慢慢探索', '不必赶路，记得看看身边的 TA。') +
        `<dl class="dt-controls">${controls.map(([key, text]) => `<div><dt><kbd>${key}</kbd></dt><dd>${text}</dd></div>`).join('')}</dl>` +
        '<p class="dt-touch-note"><span aria-hidden="true">◇</span> 触屏：单指拖动环顾；移动与互动请使用可用的屏幕控件或外接键盘。</p>' + back());
    } else if (screen === 'credits') {
      surface.innerHTML = card(heading('MADE WITH A LITTLE LOVE', '把喜欢，写进风景', '献给一起走过的路，和还没说完的话。') +
        `<div class="dt-credits" tabindex="0" aria-label="制作名单，可滚动">
          <p class="dt-credit-heart" aria-hidden="true">♡</p><p class="dt-credit-name">我们 ♡</p><p>创意 · 故事 · 世界 · 陪伴</p>
          <div class="dt-credit-rule"></div><h3>让世界亮起来</h3><p>three.js r160</p><p>WebGL · 光影与每一个小小瞬间</p>
          <h3>让文字有温度</h3><p>Cormorant Garamond · Klee One · Nunito</p><p>通过 Google Fonts 提供</p>
          <h3>灵感来自</h3><p>慕尼黑 · 路德维希–马克西米利安大学</p><p>喷泉、晚风，以及想和你分享的日常</p>
          <div class="dt-credit-rule"></div><p class="dt-credit-ending">谢谢你，成为这段故事的一部分。</p><p class="dt-credit-signature">München, mit dir.</p>
        </div>${back()}`);
    } else if (screen === 'confirm') {
      surface.innerHTML = card(heading('ONE MORE FIRST HELLO', '再赴一次初见？', '重新开始会替换当前约会进度与照片记录。') +
        '<p class="dt-confirm-copy">从主楼前的那句「你好」开始，<br>再一起走过这一天。</p>' +
        `<nav class="dt-menu" aria-label="确认重新开始">${button('cancel', '留在这段故事', 'dt-primary')}` +
        `${button('confirm-restart', '确认重新开始', 'dt-confirm-restart')}</nav>`);
    }
  }

  function renderProgress() {
    if (screen !== 'pause') return;
    const state = story.getState();
    const objective = surface.querySelector('.dt-objective');
    if (objective) objective.textContent = objectiveFor(state).text;
    const current = state.stage === 'done' ? CHAPTERS.length : CHAPTERS.findIndex(([id]) => id === state.stage);
    const dots = surface.querySelector('.dt-dots');
    if (dots) dots.innerHTML = CHAPTERS.map(([, label], i) =>
      `<li class="${i < current ? 'dt-complete' : i === current ? 'dt-current' : ''}"${i === current ? ' aria-current="step"' : ''}><span aria-hidden="true">${i < current ? '✓' : i + 1}</span><small>${label}</small></li>`).join('');
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
    }
  }

  surface.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || busy) return;
    if (target.dataset.dtAction) act(target.dataset.dtAction);
    else if (target.dataset.dtSetting) {
      const key = target.dataset.dtSetting;
      const value = key === 'muted' ? !settings.muted : key === 'quality' ? target.dataset.dtValue : Number(target.dataset.dtValue);
      changeSetting(key, value);
      if (key === 'muted') {
        target.setAttribute('aria-pressed', String(value));
        target.querySelector('b').textContent = value ? '已静音' : '声音开启';
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
