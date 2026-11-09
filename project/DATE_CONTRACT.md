# "Munich date" chapter: integration contract

Shared rules for every agent working on this chapter. The stub headers in `src/date_*.js|mjs` are the
authoritative API; this file explains ownership, coordinates, and how to test.

## Goal

Turn the LMU anime scene into a playable 10–15 minute date with a beginning and an ending:

meet at the LMU entrance → chat at the fountain (dialogue choice) → find the lost memento →
take three photos (facade, fountain, couple) → return to "our plaza" for an ending postcard.
Progress survives a reload; the player can restart.

## Entry and engine API

`project/index.html` loads `src/anime_main.js`. It creates `engine` and the chapter modules, routes
keys, and calls each module's `update(dt, et)` every frame. Modules only receive `engine` and `story`:

| `engine.` | Meaning |
|---|---|
| `THREE, scene, camera, renderer, composer, canvas` | Three.js r160 objects (from the CDN import map) |
| `player` | `{ pos: Vector3, yaw }`. `yaw` is the camera orbit yaw. Only the entry moves the player. |
| `route` | Everything in `src/date_route.mjs` |
| `blocked(x, z)` | true if a ground point is not walkable (building, fountains, world bounds) |
| `toon(color, steps = 4, opts)` | house cel-shaded material; `steps` 3 or 4 |
| `outline(mesh, thickness)` | house ink outline (inverted hull), returns the mesh |
| `lock(id)`, `unlock(id)`, `isLocked()` | freeze player movement while any lock is held |
| `isPhotoMode()` | true while the photo overlay is open |
| `days` | days together (the "在一起第 N 天" counter) |
| `capture({ maxWidth, type, quality })` | renders the composer (bloom included) and returns a data URL |
| `toast(text, ms)` | short centered notice |
| `companion` | `{ getPosition(), getHeadPosition(), root }` from the cast module |

Key routing in `anime_main.js`: `storyUI.handleKey` → `photo.handleKey` → defaults
(E interacts with the nearest POI: `storyUI.interact(id)` first, otherwise the info panel; Esc closes panels).

Debug: `?stage=<stage>` starts a fresh run at a stage. `window.__lmu = { engine, story, cast, photo, storyUI }`.

## File ownership

Edit only the files you own. Need a change elsewhere? Note it in your final report; the integrator applies it.

| Owner | Files |
|---|---|
| Integrator | `src/anime_main.js` outside the two scene regions, `src/date_route.mjs`, `index.html`, this file |
| Scene / rendering | `src/anime_main.js` inside `REGION: SCENE` and `REGION: SCENE HOOKS` only; new `src/lmu_scene_*.js` files |
| Characters | `src/date_cast.js`; new `src/date_cast_*.js`; may import (read-only) `anime_companion.js`, `male_lead.js` |
| Story | `src/date_story.mjs`, `src/date_story_ui.js`, `src/date_story.css`, `tests/date_story.test.mjs` |
| Photo | `src/date_photo.js`, `src/date_photo.css` |

CSS: inject your stylesheet from your module with a `<link>`; prefix classes (`ds-`, `dp-`); never restyle shared ids.

## Coordinates (`src/date_route.mjs`)

+X east, +Y up, +Z south. Facade at z = 0 facing +Z; plaza x ∈ [-100, 100], z ∈ [0, 80];
fountain basins (±35, 48), r = 5; spawn (0, 92). POIs: entrance (0, 5), white_rose (0, 55),
fountain (35, 40), our_plaza (0, 75), memento (-44, 68). Do not hardcode other quest coordinates.

## Run and check

```bash
cd project && python3 -m http.server <your port>
node tools/shot.mjs "http://localhost:<port>/?stage=photos" --out /tmp/check.png \
  --eval "__lmu.engine.player.pos.set(0,0,30)" --eval "__lmu.story.getState().stage"
node --test tests/          # pure-logic tests (story)
```

`shot.mjs` prints console errors and uncaught exceptions and saves a screenshot you can open.
Three.js loads from jsDelivr, so the first load needs network.

## Definition of done (every module)

- No console errors on load or during your feature; the game still runs if your module is the only real one.
- The full chapter can still be completed (the stubs keep that path working).
- Commit your work on your branch with clear messages. Do not push, merge, or rebase.
