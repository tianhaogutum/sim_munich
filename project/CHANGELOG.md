# Changelog

This log records the checked-in Munich date foundation and provides a template for the incoming feature merges. Dates below are commit dates in CET. These are development checkpoints, not released versions. Base for this documentation: `2a24dad` (2026-11-09).

## Pending integration

The following tracks were assigned in parallel; listing them does **not** mean they have been merged into this snapshot:

- Scene polish in the two owned regions of `src/anime_main.js`.
- Final heroine/labrador player party and male companion in `src/date_cast.js`.
- Dialogue, saved story progress, and restart in `src/date_story.mjs` / `src/date_story_ui.js`.
- Photo validation, album, and postcard export in `src/date_photo.js`.
- Minimap (`src/date_map.js`), title/pause/settings (`src/date_title.js`), collectibles/journal (`src/date_collect.js`), banter (`src/date_banter.js`), cinematics/free camera (`src/date_cinematic.js`), ambient life (`src/lmu_life.js`).
- QA playthrough/tests and performance profiling under `tools/` and `tests/`.

Audio and touch/gamepad already have implementation and entry wiring in the foundation below. Their later integration fixes should receive their own entries.

### Template for each incoming merge

Copy this block, replace the placeholders with actual evidence, and put the newest entry first. Do not mark a feature complete solely because its module file exists.

```markdown
## YYYY-MM-DD — <feature / integration milestone>

- Commits: `<implementation SHA>`, `<entry wiring SHA or merge SHA>`.
- Player-visible change: <what now works, including controls and route effects>.
- Files: <real paths; include any engine/route contract changes>.
- Persistence: <exact keys, schema/version changes, migration, and restart scope; or none>.
- Validation: <commands and results; browser/device; full-route and reload checks as relevant>.
- Known limits: <remaining stubs, regressions, unsupported inputs, or none verified>.
- Documentation: <README controls/debug flags, architecture, content guide, review findings updated>.
```

Integration checks to record where applicable: both fountain options → memento → three valid photos → ending; reload and restart; title/story/photo key priority; keyboard/touch/gamepad; mute and unavailable storage; invalid framing; return from free camera; console errors and measured performance. Record the actual CLI options once `playthrough.mjs` and `perf_profile.mjs` land.

## 2026-11-09 — Camera ownership hook (`2a24dad`)

“Add a camera override hook to the engine API”

- Added `engine.cameraOverride` and `engine.getCameraTarget()` in `src/anime_main.js`; documented them in `DATE_CONTRACT.md`.
- The frame loop invokes an assigned override instead of setting the default camera and copies its position back into the spring state for handoff.
- This supplies a hook for later cinematics/free camera; it does not implement either feature or arbitrate multiple camera owners.
- Diff: 2 files, 12 insertions, 2 deletions.

## 2026-11-09 — Narrow-screen HUD (`b1a2015`)

“Add a narrow-screen HUD layout”

- Added the `max-width:700px` layout in `index.html` for status, day count, compass, story/audio roots and photo hint; hides decorative sakura text.
- This is a layout adjustment, not proof that future dialogue/album/title screens fit mobile.
- Diff: 1 file, 12 insertions.

## 2026-11-09 — Touch/gamepad entry wiring (`8d325f0`)

“Wire touch and gamepad input into the entry”

- Imports and creates `createInput`, exposes `input` through `window.__lmu`, and calls `input.update(dt)` before movement.
- Uses the adapter's synthetic keys and yaw changes with the existing entry controller; does not add separate player movement.
- Diff: 1 file, 4 insertions, 1 deletion.
- Related implementation: `4ef2483` (“Add touch and gamepad controls for Munich date chapter”), 2 files / 545 insertions for `src/date_input.js` and `src/date_input.css`; brought into the base via `bbbde50`.

## 2026-11-09 — Audio entry wiring (`4bdbd07`)

“Wire procedural audio into the entry”

- Creates `createAudio(engine, story)`, assigns `engine.audio`, exposes audio in the debug object, routes its keys after story/photo, and updates it after character movement.
- Diff: 1 file, 6 insertions, 1 deletion.
- Related implementation: `6d98c3a` (“Add gesture-gated procedural audio for Munich date”), 410 lines in `src/date_audio.js`: generated score/ambience/cues, mute control, gesture unlock, and lifecycle handling.

## 2026-11-09 — Photo state and day count API (`9c6b74a`)

“Expose photo-mode state and day count on the engine API”

- Added `engine.isPhotoMode()` and `engine.days`, with contract entries.
- A private photo-module reference lets input inspect photo mode after construction.
- Diff: 2 files, 6 insertions.

## 2026-11-09 — Chapter skeleton (`19a1f1d`)

“Add Munich date chapter skeleton and integration contract”

- Added `DATE_CONTRACT.md` and the route, story, story-UI, cast, and photo module skeletons.
- Refactored `src/anime_main.js` around the engine API, scene ownership regions, shared route/collision data, stage-aware points, module creation/update, and keyboard routing.
- Added `tools/shot.mjs` for Chrome capture, console inspection, and scripted expressions; adjusted `index.html`.
- Established `meet → fountain_talk → find_memento → photos → postcard → done` with placeholder progression. Story storage is not implemented; photo credit is unconditional and characters are capsules.
- Diff: 9 files, 583 insertions, 53 deletions.

## Historical context

The repository previously contained a procedural LMU/extended-world prototype and the concept reference. `main.js`, its `main.before-*.js` snapshots, the park/river, stair hall, coast, driving, and `our_world.js` systems are retained as legacy sources. They are not active features merely because their files are present. See [the roadmap](../docs/DESIGN.md) and [review findings](../docs/REVIEW_FINDINGS.md) before reusing them.

This file summarizes source diffs and commit metadata. It does not retroactively claim test runs for those commits; validation evidence should be added by each feature owner/integrator.
