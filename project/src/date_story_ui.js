// Story DOM. createStoryUI(engine, story) implements update, handleKey, interact,
// promptFor and isModalOpen. All progress is owned by date_story.mjs.
import { objectiveFor, postcardText, dialogueFor, PHOTO_REACTIONS } from './date_story.mjs';

export function createStoryUI(engine, story) {
  if (!document.querySelector('link[data-date-story]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./date_story.css', import.meta.url).href;
    css.dataset.dateStory = '';
    document.head.appendChild(css);
  }
  const root = document.createElement('div');
  root.id = 'date-story-root';
  root.innerHTML = `
    <aside class="ds-objective" aria-label="当前目标">
      <div class="ds-eyebrow">OUR MUNICH DATE <span class="ds-progress"></span></div>
      <div class="ds-objective-text" aria-live="polite"></div>
      <div class="ds-photo-list"></div>
    </aside>
    <button class="ds-menu ds-small" type="button" aria-label="重新开始今天的约会">重新开始</button>
    <section class="ds-dialogue" role="dialog" aria-modal="true" aria-label="约会对话" hidden>
      <div class="ds-dialogue-top"><span class="ds-speaker"></span><span class="ds-page"></span></div>
      <p class="ds-line"></p>
      <div class="ds-choices" role="group" aria-label="选择你的回答" hidden></div>
      <div class="ds-dialogue-footer"><span class="ds-hint"></span><button class="ds-advance" type="button">继续 <span>▸</span></button></div>
    </section>
    <section class="ds-ending" role="dialog" aria-modal="true" aria-labelledby="ds-ending-title" hidden>
      <div class="ds-eyebrow">LMU · MÜNCHEN · A DAY TO REMEMBER</div>
      <div class="ds-ending-flower" aria-hidden="true">✿</div>
      <h2 id="ds-ending-title"></h2><p class="ds-ending-body"></p>
      <div class="ds-ending-signature">致以后的我们 ♡</div>
      <div class="ds-ending-actions"><button class="ds-postcard" type="button">查看明信片</button><button class="ds-wander ds-small" type="button">再逛一会儿</button></div>
      <button class="ds-restart ds-small" type="button">重新开始</button>
    </section>
    <div class="ds-confirm-backdrop" hidden>
      <section class="ds-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ds-confirm-title" aria-describedby="ds-confirm-copy">
        <div class="ds-eyebrow">A NEW AFTERNOON</div><h2 id="ds-confirm-title">重新开始今天的约会？</h2>
        <p id="ds-confirm-copy">本次约会的对话选择和拍照进度会清除。<br>我们会在主楼入口重新见面。</p>
        <div class="ds-confirm-actions"><button class="ds-cancel" type="button">继续这次约会</button><button class="ds-confirm-restart" type="button">重新开始</button></div>
      </section>
    </div>`;
  // Outside #hud: the small restart entry remains available even in photo mode.
  document.body.appendChild(root);
  const $ = selector => root.querySelector(selector);
  const objective = $('.ds-objective');
  const dialogue = $('.ds-dialogue');
  const text = $('.ds-line');
  const choices = $('.ds-choices');
  const advanceButton = $('.ds-advance');
  const ending = $('.ds-ending');
  const confirm = $('.ds-confirm-backdrop');
  let scene = null;
  let lineIndex = 0;
  let characters = [];
  let typed = 0;
  let choosing = false;
  let onFinish = null;
  let previousFocus = null;
  let confirmFocus = null;
  let endingFocus = null;
  let photoMode = false;

  function renderObjective(state) {
    $('.ds-objective-text').textContent = `✦ ${objectiveFor(state).text}`;
    $('.ds-progress').textContent = `${['meet', 'fountain_talk', 'find_memento', 'photos', 'postcard', 'done'].indexOf(state.stage) + 1} / 6`;
    const list = $('.ds-photo-list');
    list.replaceChildren();
    list.hidden = state.stage !== 'photos';
    if (state.stage === 'photos') {
      for (const [id, label] of [['facade', '主楼'], ['fountain', '喷泉'], ['couple', '合影']]) {
        const item = document.createElement('span');
        item.textContent = `${state.photos[id] ? '✓' : '○'} ${label}`;
        item.className = state.photos[id] ? 'ds-photo-done' : '';
        list.appendChild(item);
      }
    }
  }

  function restoreFocus(element) {
    if (element?.isConnected && !element.closest('[hidden]')) element.focus({ preventScroll: true });
  }

  function renderLine() {
    const current = scene.lines[lineIndex];
    characters = Array.from(current.text);
    typed = 0;
    choosing = false;
    text.textContent = '';
    $('.ds-speaker').textContent = current.speaker;
    $('.ds-page').textContent = `${String(lineIndex + 1).padStart(2, '0')} / ${String(scene.lines.length).padStart(2, '0')}`;
    choices.hidden = true;
    choices.replaceChildren();
    advanceButton.hidden = false;
    $('.ds-hint').textContent = `Enter / Space / E / 点击继续${scene.skippable ? ' · Esc 跳过' : ''}`;
  }

  function revealChoices() {
    choosing = true;
    choices.hidden = false;
    advanceButton.hidden = true;
    $('.ds-hint').textContent = '按 1 / 2 / 3，或点击选择 · 这句话会写进今天的结尾';
    scene.choices.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ds-choice';
      const number = document.createElement('span');
      number.className = 'ds-choice-number';
      number.textContent = String(index + 1);
      button.append(number, document.createTextNode(option.text));
      button.addEventListener('click', event => { event.stopPropagation(); choose(index); });
      choices.appendChild(button);
    });
    choices.firstElementChild?.focus({ preventScroll: true });
  }

  function closeDialogue(complete = true) {
    const finish = onFinish;
    scene = null;
    onFinish = null;
    choosing = false;
    dialogue.hidden = true;
    engine.unlock('story-dialogue');
    restoreFocus(previousFocus);
    previousFocus = null;
    if (complete) finish?.();
  }

  function openScene(id, finish) {
    const data = dialogueFor(id, story.getState());
    if (!data || scene) return false;
    previousFocus = document.activeElement;
    scene = data;
    lineIndex = 0;
    onFinish = finish;
    engine.lock('story-dialogue');
    dialogue.hidden = false;
    renderLine();
    advanceButton.focus({ preventScroll: true });
    return true;
  }

  function advance() {
    if (!scene || choosing || !confirm.hidden) return;
    if (typed < characters.length) {
      typed = characters.length;
      text.textContent = characters.join('');
      return;
    }
    if (lineIndex < scene.lines.length - 1) {
      lineIndex += 1;
      renderLine();
    } else if (scene.choices) {
      revealChoices();
    } else {
      closeDialogue();
    }
  }

  function choose(index) {
    if (!choosing || !confirm.hidden || !scene?.choices[index]) return;
    const option = scene.choices[index].id;
    closeDialogue(false);
    story.dispatch({ type: 'CHOOSE', id: 'fountain', option });
  }

  function hideEnding() {
    ending.hidden = true;
    engine.unlock('story-ending');
    restoreFocus(endingFocus);
    endingFocus = null;
  }

  function showEnding() {
    const copy = postcardText(story.getState());
    $('#ds-ending-title').textContent = copy.title;
    $('.ds-ending-body').textContent = copy.body;
    endingFocus = document.activeElement;
    ending.hidden = false;
    engine.lock('story-ending');
    $('.ds-postcard').focus({ preventScroll: true });
  }

  function askRestart() {
    confirmFocus = document.activeElement;
    confirm.hidden = false;
    engine.lock('story-confirm');
    $('.ds-cancel').focus({ preventScroll: true });
  }

  function cancelRestart() {
    confirm.hidden = true;
    engine.unlock('story-confirm');
    restoreFocus(confirmFocus);
    confirmFocus = null;
  }

  function restart() {
    cancelRestart();
    closeDialogue(false);
    hideEnding();
    story.dispatch({ type: 'RESTART' });
    engine.toast('新的约会开始了。去主楼入口和 TA 见面吧。', 4200);
  }

  function cycleFocus(container, backwards) {
    const buttons = [...container.querySelectorAll('button')].filter(button => !button.closest('[hidden]'));
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement);
    buttons[(index + (backwards ? -1 : 1) + buttons.length) % buttons.length].focus();
  }

  dialogue.addEventListener('click', event => {
    if (!event.target.closest('button')) advance();
  });
  advanceButton.addEventListener('click', advance);
  $('.ds-menu').addEventListener('click', askRestart);
  $('.ds-restart').addEventListener('click', askRestart);
  $('.ds-cancel').addEventListener('click', cancelRestart);
  $('.ds-confirm-restart').addEventListener('click', restart);
  $('.ds-wander').addEventListener('click', hideEnding);
  $('.ds-postcard').addEventListener('click', () => {
    // The photo module owns its modal and its own movement lock.
    hideEnding();
    window.dispatchEvent(new CustomEvent('lmu:show-postcard'));
  });

  renderObjective(story.getState());
  story.subscribe((state, previous, event) => {
    renderObjective(state);
    if (event.type === 'RESTART') {
      closeDialogue(false);
      hideEnding();
      cancelRestart();
      return;
    }
    if (event.type === 'PHOTO' && state.photos[event.id] && !previous.photos[event.id]) {
      const next = state.stage === 'postcard' ? ' 三张都拍好了，回我们的广场吧。' : '';
      engine.toast(`${PHOTO_REACTIONS[event.id]}${next}`, 5200);
    }
    if (state.stage === previous.stage) return;
    if (state.stage === 'find_memento') openScene('find_memento');
    else if (state.stage === 'photos') openScene('photos');
    else if (state.stage === 'done') showEnding();
  });
  // Restore the next useful scene on reload, without replaying completed visits.
  if (story.getState().stage === 'find_memento') openScene('find_memento');
  if (story.getState().stage === 'photos') openScene('photos');
  if (story.getState().stage === 'done') showEnding();

  return {
    update(dt) {
      const activePhoto = Boolean(engine.isPhotoMode?.());
      if (activePhoto !== photoMode) { photoMode = activePhoto; objective.hidden = photoMode; }
      if (!scene || choosing || !confirm.hidden || typed >= characters.length) return;
      typed = Math.min(characters.length, typed + Math.max(0, dt) * 36);
      text.textContent = characters.slice(0, Math.floor(typed)).join('');
    },
    handleKey(key, event) {
      const k = key.toLowerCase();
      if (!confirm.hidden) {
        if (k === 'escape') cancelRestart();
        else if (k === 'tab') cycleFocus(confirm, event?.shiftKey);
        else if ((k === 'enter' || k === ' ') && confirm.contains(document.activeElement)) document.activeElement.click();
        return true;
      }
      if (scene) {
        if (k === 'tab') cycleFocus(dialogue, event?.shiftKey);
        else if (choosing && /^[123]$/.test(k)) choose(Number(k) - 1);
        else if (choosing && (k === 'enter' || k === ' ') && choices.contains(document.activeElement)) document.activeElement.click();
        else if (k === 'enter' || k === ' ' || k === 'e') advance();
        else if (k === 'escape' && scene.skippable) closeDialogue();
        return true; // Includes P, Space, movement, and Esc in unskippable scenes.
      }
      if (!ending.hidden) {
        if (k === 'escape') hideEnding();
        else if (k === 'tab') cycleFocus(ending, event?.shiftKey);
        else if ((k === 'enter' || k === ' ') && ending.contains(document.activeElement)) document.activeElement.click();
        return true;
      }
      // Activate a focused menu button without leaking Enter / Space into world actions.
      if ((k === 'enter' || k === ' ') && document.activeElement === $('.ds-menu')) {
        askRestart(); return true;
      }
      return false;
    },
    interact(poiId) {
      if (scene || !confirm.hidden || !ending.hidden || engine.isPhotoMode?.()) return false;
      const stage = story.getState().stage;
      if (stage === 'meet' && poiId === 'entrance') return openScene('meet', () => story.dispatch({ type: 'VISIT', id: poiId }));
      if (stage === 'fountain_talk' && poiId === 'fountain') {
        story.dispatch({ type: 'VISIT', id: poiId });
        return openScene('fountain_talk');
      }
      if (stage === 'find_memento' && poiId === 'memento') return openScene('memento_found', () => story.dispatch({ type: 'COLLECT', id: poiId }));
      if (stage === 'postcard' && poiId === 'our_plaza') return openScene('ending', () => story.dispatch({ type: 'VISIT', id: poiId }));
      if (stage === 'done' && poiId === 'our_plaza') { showEnding(); return true; }
      return false;
    },
    promptFor(poiId) {
      const state = story.getState();
      if (state.stage === 'done' && poiId === 'our_plaza') return '重读今天的明信片';
      if (objectiveFor(state).poi !== poiId) return null;
      return { meet: '和 TA 打招呼', fountain_talk: '坐下聊聊', find_memento: '捡起樱花发夹', postcard: '回到这里，结束今天' }[state.stage] ?? null;
    },
    isModalOpen: () => Boolean(scene) || !confirm.hidden || !ending.hidden,
  };
}
