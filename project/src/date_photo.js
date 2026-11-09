// date_photo.js — photo mode, shutter, framing validation, album, postcard export. Owner: photo agent.
//
// CONTRACT (called by anime_main.js):
//   createPhoto(engine, story) -> {
//     update(dt, et): void,
//     handleKey(k, event): boolean,   // owns 'p' (toggle photo mode), ' ' (shutter), 'escape' (leave photo mode)
//     isActive(): boolean,
//   }
//   Capture with engine.capture({ maxWidth?, type?, quality? }) -> dataURL (renders the composer, so bloom is kept;
//   HTML HUD is not in the image). Credit goals with story.dispatch({ type: 'PHOTO', id }) for VALID shots only,
//   id ∈ engine.route.PHOTO_TARGETS. Companion position: engine.companion.getPosition() / getHeadPosition().
//   Existing DOM you own: #photo-overlay, #photo-btn; hide #hud while in photo mode.
//   New DOM under #date-photo-root; CSS classes prefixed `dp-`; styles in date_photo.css (inject a <link>).
//   Postcard copy: postcardText(state) from date_story.mjs.
//
// SKELETON NOTE: reproduces the old photo mode (download a PNG) and, for end-to-end testing only, credits the
// next missing photo goal on every shutter press. The photo agent replaces this with real framing checks.
export function createPhoto(engine, story) {
  const overlay = document.getElementById('photo-overlay');
  const button = document.getElementById('photo-btn');
  const hud = document.getElementById('hud');
  let active = false;

  function setActive(on) {
    active = on;
    overlay.classList.toggle('active', on);
    button.classList.toggle('visible', on);
    hud.classList.toggle('hidden', on);
  }

  function shutter() {
    const link = document.createElement('a');
    link.download = `our-lmu-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = engine.capture();
    link.click();
    const state = story.getState();
    if (state.stage !== 'photos') return;
    const next = Object.keys(state.photos).find(id => !state.photos[id]);
    if (next) story.dispatch({ type: 'PHOTO', id: next });
  }

  button.onclick = shutter;

  return {
    update() {},
    handleKey(k) {
      if (k === 'p') { setActive(!active); return true; }
      if (k === ' ' && active) { shutter(); return true; }
      if (k === 'escape' && active) { setActive(false); return true; }
      return false;
    },
    isActive: () => active,
  };
}
