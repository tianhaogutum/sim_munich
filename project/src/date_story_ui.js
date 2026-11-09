// date_story_ui.js — quest DOM: objective tracker, dialogue with choices, ending / restart. Owner: story agent.
//
// CONTRACT (called by anime_main.js):
//   createStoryUI(engine, story) -> {
//     update(dt, et): void,
//     handleKey(k, event): boolean,   // first refusal on every keydown; true = consumed (e.g. 1/2/3, Enter, Esc in a dialogue)
//     interact(poiId): boolean,       // E near a POI; true = consumed (entry then skips its info panel)
//     promptFor(poiId): string|null,  // custom proximity prompt text for quest POIs; null = default prompt
//     isModalOpen(): boolean,
//   }
//   While a dialogue blocks movement: engine.lock('story-dialogue') / engine.unlock('story-dialogue').
//   DOM lives under #date-story-root; CSS classes are prefixed `ds-`; styles go in date_story.css (inject a <link>).
//
// SKELETON NOTE: objective box + toast only. The story agent replaces this with the real UI.
import { objectiveFor } from './date_story.mjs';

export function createStoryUI(engine, story) {
  const root = document.createElement('div');
  root.id = 'date-story-root';
  root.style.cssText = 'position:fixed;top:140px;left:20px;max-width:300px;padding:9px 14px;background:rgba(8,6,20,.72);' +
    'border:1px solid rgba(220,185,90,.25);border-radius:12px;color:#F0E8C8;font:13px/1.6 Nunito,sans-serif;pointer-events:none';
  (document.getElementById('hud') ?? document.body).appendChild(root);
  const render = state => { root.textContent = `✦ ${objectiveFor(state).text}`; };
  render(story.getState());
  story.subscribe(state => render(state));

  return {
    update() {},
    handleKey() { return false; },
    interact(poiId) {
      const before = story.getState().stage;
      story.dispatch(poiId === 'memento' ? { type: 'COLLECT', id: poiId } : { type: 'VISIT', id: poiId });
      const after = story.getState();
      if (after.stage === before) return false;
      engine.toast(`✦ ${objectiveFor(after).text}`);
      return true;
    },
    promptFor(poiId) {
      return objectiveFor(story.getState()).poi === poiId ? '♡ 任务地点' : null;
    },
    isModalOpen: () => false,
  };
}
