# Writing and extending “我们的 LMU”

This guide describes the files at `2a24dad`. The date chapter is still a skeleton: there is no dialogue table, banter module, collectible journal, or localization loader in this checkout. Instructions marked **planned** describe the intended integration, not APIs that can already be called. Read [DATE_CONTRACT.md](../project/DATE_CONTRACT.md) before editing shared code; coordinate route and entry changes with the integrator.

## Voice and length

Write Chinese first. The chapter is a quiet walk with someone familiar: use a place, a gesture, or a small observation to carry the affection. Keep instructions literal and dialogue natural. A reader should know where to go without decoding a metaphor.

- Give each dialogue line one thought. Aim for 12–30 Chinese characters, with longer lines only when the meaning needs them. These are editorial targets, not engine limits.
- Prefer specific details: spray on a sleeve, a loose hair clip, a place saved on a step. Avoid interchangeable promises about forever.
- Let both people initiate, notice things, and make choices. Avoid making the companion a constant instructor or the heroine a passive reward.
- Keep choice labels short and distinct. Both answers should sound like something the player could sincerely say; neither should be a hidden wrong answer.
- Use `「」` for named places or quoted labels, Chinese punctuation in Chinese prose, and proper German spelling for place names. Use emoji sparingly in dialogue; an icon can identify a HUD action without appearing in every line.
- An objective says **action + destination**. A failed photo hint says **what to change**. Do not put engine terms, distances in internal units, save keys, or debug instructions in character speech.

Editorial examples below are suggestions, not shipped dialogue:

| Context | Suggested Chinese | Reason |
|---|---|---|
| Arrival | “给你留了这一级台阶。” | A small action establishes familiarity. |
| Fountain | “袖口都湿了，还想再靠近一点？” | The line belongs to this place. |
| Search objective | “去广场西侧的树下找樱花发夹” | Names the object and a useful direction. |
| Photo hint | “往后退一点，让廊柱也入镜。” | Tells the player how to improve the shot. |
| Quiet ending | “下次还在这里等你。” | Leaves room for another chapter. |

The White Rose memorial (`white_rose`) needs a different register. Keep its historical description factual, restrained, and sourced; give it space without romantic jokes or collectible celebration sounds. Do not invent quotations or frame the memorial as a date reward. Historical claims in `sights` are existing content, not independently verified facts in this guide. Verify new claims against an authoritative source before adding them.

## Speakers and names

There are no canonical personal names or speaker IDs in the current date modules. `date_story.mjs` calls the companion **TA**; `date_cast.js` draws two placeholder capsules. The intended cast is the heroine with a Labrador as the player group and the male lead as companion.

| Narrative role | Working display name | Authoring rule |
|---|---|---|
| Player / heroine | `我` in first-person lines; `你` when addressed | Do not confuse the player character with the camera. |
| Male companion | `TA` until a name is explicitly agreed | Keep the same label across objectives, dialogue, album, and postcard. |
| Labrador | `拉布拉多` when identification is needed | Prefer an action such as a head tilt or bark over human exposition. |
| Environmental narration | No character name | Keep short and visibly separate from spoken lines. |

These are editorial conventions, not an existing dialogue schema. When the story module gains structured dialogue, assign stable role IDs there and keep display names translatable. Do not infer personal names from asset filenames such as `male_lead.js`, or import the legacy world's terminology into this chapter by accident.

## Where content lives now

| File | Content to edit |
|---|---|
| `project/src/date_route.mjs` | `STAGES`, `POIS` IDs/labels/coordinates, `PHOTO_TARGETS`, route geometry and companion positions. Integrator-owned. |
| `project/src/anime_main.js` | `sights` names, icons, descriptions, source labels and `when` predicates; proximity/plaque text and day-counter start date. Coordinate changes with the integrator or scene owner as appropriate. |
| `project/src/date_story.mjs` | `OBJECTIVES`, `objectiveFor(state)`, `postcardText(state)`, story events and state. |
| `project/src/date_story_ui.js` | Objective display, the current `♡ 任务地点` prompt, and stage-change toast. Dialogue and restart UI remain planned. |
| `project/src/date_photo.js` | PNG download name and photo mode behavior. Album, validation messages, and postcard rendering remain planned. |
| `project/src/date_audio.js` | Audio button, mute notices, accessibility labels, and cue names. |
| `project/src/date_input.js` | Touch buttons, gesture hints, context messages, and accessibility labels. |
| `project/index.html` | Initial HUD labels, photo hint, page title, `lang="zh-CN"`, and fonts. |

Strings are embedded in module data, functions, template literals, and HTML. There is no single language file yet. `date_story.css` and `date_photo.css` are named in the module contracts but are not present in this snapshot.

## Add a point of interest

Use the same stable ID throughout the following path:

```text
date_route.mjs: POIS[id]
    → anime_main.js: sights entry + marker
    → date_story.mjs: objective / relevant event handling
    → date_story_ui.js: interaction and prompt
    → date_banter.js: optional contextual line (planned)
```

1. Agree on ownership and scope. An optional sightseeing point need not become a quest stage. A mandatory new stage affects progression, saving, tests, and all stage-aware modules.
2. Add an integrator-approved `POIS` entry with a stable `snake_case` ID, `x`, `z`, and Chinese `label`. Ground uses X/Z, with +X east and +Z south. Place it on walkable ground and outside fountain collision circles; do not copy coordinates into another module.
3. Add a `sights` entry in `anime_main.js`: `id`, `pos: poiPos(id)`, `icon`, `name`, `text`, `src`, and, when needed, `when`. The current memento uses `when` to appear only during `find_memento`. Verify both marker visibility and interaction visibility.
4. Review marker styling. The current `markerMats` array has exactly five entries and is indexed by sight order; adding a sixth sight also needs an intentional material assignment by the scene owner.
5. Add or revise `OBJECTIVES` in `date_story.mjs` if the point is a quest destination. Its `poi` must match the `POIS` key; its `text` should tell the player what to do. For a new stage, update `STAGES`, transitions and debug-stage coverage together.
6. Decide how E behaves. The current `date_story_ui.js` dispatches `VISIT` for every sight except `memento`, which dispatches `COLLECT`. It consumes the interaction only if the stage changed; otherwise the entry opens the sightseeing panel. A dialogue-driven interaction needs explicit handling and the `story-dialogue` movement lock.
7. **Planned:** add a short line to `date_banter.js` only after its actual schema exists. Scope the trigger by POI and stage, give it a cooldown/one-time policy, and suppress it during dialogue, photo framing, and memorial reading. Do not make banter required to finish the quest.
8. Check the location from the player's approach direction, with keyboard and touch. Confirm the hint is readable, E selects the intended nearby point, repeated interactions do not award duplicate progress, and any new sight remains reachable.

## Add a photo goal

The real route IDs are `facade`, `fountain`, and `couple`. `PHOTO_TARGETS` currently uses this shape:

```js
{ id: 'facade', label: '主楼与廊柱',
  target: { x: 0, y: 8, z: 3 }, minDist: 22, maxDist: 75 }
// A moving subject instead uses target: 'companion'.
```

1. Add an agreed stable ID and label in `date_route.mjs`. Use a world-space target for architecture or the supported `'companion'` sentinel for the companion. Do not invent another target type without implementing it.
2. Keep the target readable from a reachable location. The current limits are facade 22–75, fountain 7–32, and couple 2–9 scene units. They are data for future validation; the skeleton does not measure them or specify whether distance is camera- or player-based.
3. `initialState()` derives `photos` keys from `PHOTO_TARGETS`; the reducer also requires every target to complete `photos`. Update the hardcoded three-photo objective text, any future album labels, save migration, and tests when the goal list changes. Do not assume deriving the flags updates all written copy.
4. **Planned validation:** specify the distance origin, center tolerance, visibility/occlusion policy, and required subjects with the photo owner. Project the subject into the camera view, reject subjects behind/outside the frame, check distance, then check that foreground geometry does not hide it. A label like “我们的合影” also needs an explicit decision about which members of the cast must appear.
5. Award `story.dispatch({ type: 'PHOTO', id })` only after the corresponding goal passes. The current skeleton deliberately credits the next missing goal on every shutter press; it is unsuitable for validating framing content.
6. Write one short hint per correctable failure, such as “再靠近喷泉一点” or “让 TA 回到画面中央”. Do not silently fail a shutter or make a valid photo depend on a narrow, undocumented pixel position.
7. Test valid/invalid distance, off-center and occluded cases, repeat shots, completed goals, and a reload once album persistence is integrated. Confirm exported images use `engine.capture()` so the scene's bloom is preserved and HTML HUD is excluded.

## Add a collectible

The only current collectible is the quest object `memento`: its sight calls `COLLECT`, and collecting that ID during `find_memento` advances to `photos`. It is described as the companion's sakura hair clip. This story item is distinct from the **planned** optional fragment/achievement journal in `date_collect.js`.

For another quest object, agree on a new route ID, visible location, short description, stage availability, event transition, and repeat-interaction behavior with the story owner. Do not rename `memento` without migrating its saved identifier after persistence arrives.

For an optional fragment, first consult the integrated `date_collect.js` data shape; that module does not exist here. The proposed authoring record should have a stable ID, a route-backed position, a title, a short memory, and an unlock condition. Keep the fragment optional, make it reachable without clipping through scenery, and avoid competing with a nearby mandatory E interaction. A collection notice should identify what was found; a journal entry can add the longer reflection. Achievements need explicit conditions and clear names, not hidden mandatory chores. Confirm duplicate collection and reload behavior against the planned `lmu-date-collect-v1` store.

## Localization plan: zh → en

The current game is Chinese and has no language switch. Keep these changes separate from translating the README:

1. Extract player-facing strings from module data/functions and `project/index.html` into locale dictionaries. Preserve stable route, event, photo, and collectible IDs; never use translated text as a save key.
2. Define a small lookup with Chinese fallback and named placeholders. For example, store the day count as a number and format a `{days}` message in the chosen locale; do not concatenate fragments that force English into Chinese word order.
3. Put dialogue variants, objective text, prompts, album/postcard copy, touch labels, accessible names, document title, and error messages through the same lookup. Localize the selected fountain-choice branch without changing its option ID.
4. Translate for intent. Preserve the warmth and concrete detail, but allow English to use a different sentence length. Keep proper names such as LMU, Ludwigstraße, and Geschwister-Scholl-Platz consistent.
5. Update the document language and choose font fallbacks that cover Chinese, Latin text, and German diacritics. Check small screens, long English labels, line wrapping, keyboard focus, and exported postcard typography in both languages.
6. Choose and document locale persistence only when that feature is implemented. `lmu-date-settings` is a planned settings key, not a current localization API.

Keep editorial examples and proposed IDs out of production data until the responsible module owner approves the behavior they imply. Record unresolved integration differences in [REVIEW_FINDINGS.md](REVIEW_FINDINGS.md).
