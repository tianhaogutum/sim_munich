# 我们的 LMU · Our LMU

[中文说明](README.zh.md)

A browser game about a walk together around LMU Munich: an anime-style plaza, falling sakura, a companion, and small moments worth photographing. The **Munich date** chapter is being built as a 10–15 minute route: meet at the entrance, talk by the fountain, recover a sakura hair clip, take three photos, and return to “our plaza” for a postcard.

![Visual reference for the LMU game](project/assets/lmu-game-concept-v1.png)

*Visual reference: `project/assets/lmu-game-concept-v1.png`; not a guarantee of the current in-game appearance.*

**Snapshot status:** these docs describe base commit `2a24dad`, before the parallel feature merges. The plaza, route tracker, placeholder characters, basic PNG capture, procedural audio, and touch/gamepad adapter are present. Dialogue choices, story saving, real photo validation/album/postcard export, the final cast, title/settings, minimap, journal, banter, and cinematics are awaiting integration. Planned behavior is marked below; see [review findings](docs/REVIEW_FINDINGS.md) before treating this as a finished chapter.

## Run locally

From the repository root:

```sh
cd project
python3 -m http.server 8000
```

Open <http://localhost:8000/>. Keep this terminal running; stop it with Ctrl+C. Serve **`project/`**, whose `index.html` imports `src/anime_main.js`. Opening HTML with `file://` is not supported. The root `index_anime.html` is an older copy with an incorrect module path for this tree.

There is no build step, npm install, or bundled runtime. Three.js **r160 (`0.160.0`)** and postprocessing modules load from jsDelivr through the import map in `project/index.html`. Google Fonts supplies the display fonts; local fallbacks are used if fonts cannot load.

## Controls

Keys apply while the page has focus. Future modal interfaces should receive keys before world actions.

| Input | Action | Status in this snapshot |
|---|---|---|
| WASD / arrow keys | Walk relative to camera direction | Available |
| Shift + movement | Run | Available |
| Mouse drag on canvas | Orbit camera; vertical drag changes pitch | Available |
| Mouse wheel | Zoom | Available |
| E | Interact with nearest point; otherwise inspect the nearby day-count plaque | Available |
| P | Open/close photo mode | Available |
| Space | Download a PNG while photo mode is open | Available; see photo caveat below |
| Esc | Leave photo mode or close information/day panels | Available; pause menu planned |
| N | Toggle minimap | Planned `date_map.js`; not wired yet |
| M | Mute/unmute music and environmental sound | Available |
| J | Open journal | Planned `date_collect.js`; not wired yet |
| C | Toggle free camera | Planned `date_cinematic.js`; not wired yet |

**Touch:** controls appear on coarse-pointer devices or with `?touch=1`. Use the left stick to move; push to its edge to run. Drag the right look area to turn horizontally and pinch there to zoom. Buttons provide interaction/confirmation, photo mode, shutter, and back. “隐藏 HUD 提示” hides touch hints, not the full game HUD. The right touch area does not control camera pitch in this adapter.

**Gamepad:** the controller must expose the browser’s `standard` mapping. Left stick moves and runs near its edge; right stick’s horizontal axis turns. A / bottom face button interacts or confirms, X / left face button toggles photo mode, B / right face button or RT takes a photo while photo mode is active, and Start sends Esc. These are Xbox-style names; other controllers may label the same positions differently. Vertical look, zoom, dialogue-choice navigation, and the planned N/J/C actions have no gamepad mapping yet.

Sound starts after a pointer or keyboard gesture, subject to browser audio policy. The sound button also allows explicit opt-in. Muting does not block progression.

## The date chapter

<details>
<summary>Spoilers: route, stage IDs, and the current skeleton walkthrough</summary>

The HUD shows the next objective. World ground coordinates are `(x, z)`; north is decreasing `z`.

1. **`meet` — entrance `(0, 5)`:** walk north from spawn `(0, 92)` and press E near the entrance. The intended cast is the heroine with her labrador as the player party and a male lead as companion; this base still displays two capsules.
2. **`fountain_talk` — fountain `(35, 40)`:** walk to the east fountain and press E. The completed design includes a dialogue choice here. In this skeleton the visit immediately advances; there is no choice screen.
3. **`find_memento` — hair clip `(-44, 68)`:** go to the marker under the trees west of the plaza and press E. Its point is only visible during this stage. The story records `COLLECT` with ID `memento`.
4. **`photos` — facade, fountain, couple:** press P, compose a shot, and press Space. Goal IDs are `facade`, `fountain`, and `couple`. **The skeleton credits the next missing goal on every shutter press**, regardless of distance, framing, or occlusion. Three shutter presses complete this stage; each also downloads a PNG. Real validation and an album are planned.
5. **`postcard` — our plaza `(0, 75)`:** return to this marker and press E. State becomes `done`; the objective changes to the completion message. A designed ending/postcard screen and export are not present yet.

The white-rose point `(0, 55)` is an optional historical stop. The plaque at `(10, 5.5)` shows the configured relationship-day count. Neither is required for progression.

The eventual fountain choice should change the ending wording without blocking completion. This is a design goal: `postcardText()` currently returns the same text for every state. See [design](docs/DESIGN.md) for acceptance criteria.

</details>

## Saving and restarting

**Current behavior:** story progress exists only in memory and resets on reload. Only mute is persisted, under `lmu-date-audio-muted` (`"true"` / `"false"`). PNGs are browser downloads, not a saved in-game album. The day counter uses `START_DATE` in `project/src/anime_main.js`, currently `2024-03-15`.

There is no restart button yet. A reload starts again, or a developer can reset the current story in the browser console:

```js
window.__lmu.story.dispatch({ type: 'RESTART' });
```

The planned release uses `lmu-date-v1` for the chapter, `lmu-date-collect-v1` for side discoveries, `lmu-date-settings` for settings, and `lmu-date-photos-v1` for photos, alongside the existing mute key. Their schemas and restart scope still need integration; [architecture](docs/ARCHITECTURE.md) tracks the distinction. Browser storage is local to an origin and browser profile: changing host or port does not transfer it. There is no cross-device sync; do not assume restart clears all independent keys.

## Debug URLs

| Query | Meaning |
|---|---|
| `?stage=photos` | Fresh in-memory story at a valid stage. Accepted: `meet`, `fountain_talk`, `find_memento`, `photos`, `postcard`, `done`. Does not fill prerequisite choices/items/photos or move the player. Invalid values fall back to `meet`. |
| `?touch=1` | Force touch controls to appear, including on desktop. |
| `?notitle=1` | Reserved for the planned title module; ignored by this snapshot. |

Combine them with `&`, for example <http://localhost:8000/?stage=photos&touch=1>. Remove `stage` before checking normal start/save behavior. `window.__lmu` exposes `engine`, `story`, `cast`, `photo`, `storyUI`, `audio`, and `input` for debugging.

## Tests and tools

The game needs no Node runtime; developer tools do. Use Node.js 22 or newer for `shot.mjs` (native `fetch` and `WebSocket`), Python 3 for the server, and a local Chrome executable for browser capture.

From the repository root, with the server above running:

```sh
node project/tools/shot.mjs 'http://localhost:8000/?stage=photos' \
  --out /tmp/lmu-photos.png --size 1280x720 --wait 4000 \
  --eval '__lmu.engine.player.pos.set(0, 0, 30)' \
  --eval '__lmu.story.getState().stage'
```

`--eval` may be repeated; expressions run in order, separated by `--between` milliseconds (default 600). `--wait` is the initial load delay. Set `CHROME` to your Chrome/Chromium executable if it is not `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Captures go to `--out`; photo downloads go to a temporary profile folder removed on exit (`--keep` retains it). The tool prints console errors and exceptions. **Only uncaught page exceptions determine exit code 1**; review the log even after a zero exit.

These are intended QA entry points **after the QA/performance merges**:

```sh
node --test project/tests/
node project/tools/playthrough.mjs
node project/tools/perf_profile.mjs
```

`project/tests/`, `playthrough.mjs`, and `perf_profile.mjs` are absent at `2a24dad`; these commands are not currently runnable. Their browser URL/options must be documented from the landed tools, not inferred from `shot.mjs`. Pure story logic already lives in `date_story.mjs`, which can be imported without a DOM.

## Browser support and limits

Use a recent browser with ES modules, import maps, `structuredClone`, and working WebGL. Chromium is the target of the bundled capture tool; Safari/Firefox and mobile devices still need full chapter testing. Gamepad support depends on the browser, device, and mapping. There is no compatibility matrix yet.

- Initial loads require access to jsDelivr. This is not an offline bundle; no service worker caches the game.
- WebGL/GPU support is required; no canvas fallback or friendly renderer-failure screen is implemented.
- Bloom, soft shadows, geometry, and sakura can be expensive on phones. Quality settings are planned.
- The scene is an artistic, compressed reconstruction, not a navigational map. The legacy seaside is fictional.
- Dialogue/menus do not yet establish complete keyboard or screen-reader accessibility. Touch/gamepad do not yet cover all planned controls.

## Project layout

| Path | Purpose |
|---|---|
| `project/index.html` | Active page, shared HUD, Three.js import map |
| `project/src/anime_main.js` | Scene, player/camera, engine API, module construction, input routing, render loop |
| `project/src/date_route.mjs` | Stage IDs, POIs, photo targets, companion settings, bounds |
| `project/src/date_story.mjs`, `date_story_ui.js` | Pure state machine and current objective UI |
| `project/src/date_cast.js`, `date_photo.js` | Current character and photography skeletons |
| `project/src/date_audio.js`, `date_input.js`, `date_input.css` | Procedural audio; touch/gamepad adapter and styles |
| `project/tools/shot.mjs` | Headless browser capture and console inspection |
| `project/assets/` | Concept reference and legacy art assets with source metadata |
| `project/DATE_CONTRACT.md` | Integration API and original file ownership |
| `project/CHANGELOG.md` | Base commits and checklist for incoming merges |
| `docs/` | [Architecture](docs/ARCHITECTURE.md), [design/roadmap](docs/DESIGN.md), [content guide](docs/CONTENT_GUIDE.md), [review findings](docs/REVIEW_FINDINGS.md) |

`main.js`, `our_world.js`, `lmu_neighborhood.js`, `lmu_interior.js`, `sunset_coast.js`, `amg_drive.js`, `river_drift.js`, and `main.before-*.js` are legacy sources, **not loaded by the active entry**. Their park, interior, driving, and letters/wishes systems are material for future chapters, not hidden destinations in this one.

## Credits

- Three.js and contributors: MIT; included notice at [THREE-LICENSE.txt](project/src/vendor/THREE-LICENSE.txt). The active runtime uses the pinned CDN release.
- Display fonts requested from Google Fonts: Cormorant Garamond, Nunito, and Klee One.
- Existing sightseeing copy names LMU's official guide and Wikipedia as references. Building dimensions include estimates; review factual copy before publishing.
- Legacy Poly Haven assets are marked CC0 in their metadata: forest floor by eye-candy.xyz, fern by Rico Cilliers and Rob Tuytel, and sparse grass. Each asset folder's `sources.json` preserves its attribution; these assets are not used by the current procedural plaza.
- The repository includes the visual reference above but no separate provenance/license record for it, and no top-level project license. Do not infer a license for all game content from the Three.js notice.
