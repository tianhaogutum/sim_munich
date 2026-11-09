# Architecture

This describes the checked-in chapter at `2a24dad`, before the parallel feature branches are integrated. The working application is `project/index.html` → `project/src/anime_main.js`. The contract is [DATE_CONTRACT.md](../project/DATE_CONTRACT.md); exported module headers define the callable interfaces. Features described as **planned** below are integration targets, not runtime capabilities in this snapshot.

## Entry and module map

There is no bundler, package installation, or build step. `project/index.html` supplies the canvas and shared HUD, loads fonts, and maps `three` and `three/addons/` to Three.js `0.160.0` on jsDelivr. Browser ES modules load the chapter directly.

```text
project/index.html
  └─ src/anime_main.js
       ├─ Three.js + EffectComposer / RenderPass / UnrealBloomPass / OutputPass
       ├─ date_route.mjs ── coordinates, stages, photo targets, companion settings
       ├─ engine ───────── scene, player, camera, locks, capture, feedback
       ├─ date_story.mjs ── state + reducer + subscriptions
       ├─ date_audio.js ─── procedural music, ambience, feedback, mute storage
       ├─ date_cast.js ──── visible player and companion (capsule placeholders)
       ├─ date_photo.js ─── photo overlay and PNG download (validation stub)
       ├─ date_story_ui.js  objective HUD and POI event adapter (dialogue stub)
       └─ date_input.js ─── touch / gamepad → shared keyboard and camera input
```

| File | Owns now | Important boundary |
| --- | --- | --- |
| `project/index.html` | Shared canvas, HUD, info panel, day popup, photo elements, import map | Main entry; root `index_anime.html` is a separate legacy document. |
| `project/src/anime_main.js` | Scene construction, collision, player movement, orbit camera, module wiring, key routing, frame loop | Only the entry applies ordinary movement to `engine.player.pos`. |
| `project/src/date_route.mjs` | `STAGES`, `POIS`, `INTERACT_RADIUS`, `FOUNTAINS`, `COMPANION`, `PHOTO_TARGETS`, `SPAWN`, `BOUNDS`, combined `ROUTE` | Shared quest coordinates; other agents read rather than edit them. |
| `project/src/date_story.mjs` | `initialState`, `reduce`, `createStory`, `objectiveFor`, `postcardText` | No DOM or Three.js dependency; imports route data. Persistence and dialogue gating are still stubs. |
| `project/src/date_story_ui.js` | `#date-story-root`, objective text, `interact`, `promptFor` | Sends `VISIT` / `COLLECT`; current `handleKey` never consumes input and no dialogue modal exists. |
| `project/src/date_cast.js` | Player/companion meshes; companion getters and following | Reads player motion; never writes player position. |
| `project/src/date_photo.js` | Photo overlay, shutter, canvas PNG download | Currently credits the next missing photo without checking framing; no album or postcard export yet. |
| `project/src/date_audio.js` | Web Audio graph, stage-dependent music, spatial fountain gain, footsteps, cues, mute button | Created before other visual modules; `engine.audio` is assigned immediately. |
| `project/src/date_input.js` + `date_input.css` | Touch controls, standard-mapping gamepads, virtual key lifetime | Emits keyboard events for actions/movement and adjusts orbit yaw; does not move the player directly. |

The integration plan also names `date_map.js`, `date_title.js`, `date_collect.js`, `date_banter.js`, `date_cinematic.js`, and `lmu_life.js`. These files and their entry wiring are absent at this baseline. Likewise, `project/tools/playthrough.mjs`, `project/tools/perf_profile.mjs`, and `project/tests/` are expected from other branches, not available here. The only checked-in chapter tool is `project/tools/shot.mjs`.

Legacy `main.js`, `our_world.js`, `lmu_neighborhood.js`, `lmu_interior.js`, `sunset_coast.js`, `amg_drive.js`, and `river_drift.js` belong to the earlier extended-world prototype. They are not imported by this entry. See [DESIGN.md](DESIGN.md) for reuse priorities rather than adding them wholesale to the current runtime.

## Construction and data flow

After building the scene and collision data, the entry creates modules in this order:

1. `story = createStory()`.
2. `audio = createAudio(engine, story)`; assign `engine.audio`.
3. `cast = createCast(engine, story)`; assign `engine.companion`.
4. `photo = createPhoto(engine, story)`; assign the private reference used by `engine.isPhotoMode()`.
5. `storyUI = createStoryUI(engine, story)`.
6. `input = createInput(engine, story)`.

`window.__lmu` exposes `{ engine, story, cast, photo, storyUI, audio, input }` for console and headless checks. This is a debugging surface, not a second gameplay API. For example, `__lmu.story.getState().stage` inspects progress and `__lmu.audio.getDebugState()` reports audio counters without exposing its native nodes.

```text
physical keyboard ─┐
touch / gamepad ───┴─> key tracker + ordered action handlers
                               │
                               ├─ movement → engine.player → cast / audio / camera
                               ├─ E → nearest POI → storyUI.interact(id)
                               │                     └─ story.dispatch(event)
                               └─ photo shutter ──────────┘

story.dispatch → reduce(previousState, event) → current state
                                                ├─ subscriptions → HUD / audio
                                                └─ reads → cast / POI visibility / objectives

scene + camera → composer → canvas → optional engine.capture() → PNG download
```

Modules receive `engine` and `story`; they should not reach into entry-local variables. Use subscriptions for discrete state changes and `update` for time-dependent work. Treat `getState()` as read-only: the current function returns the live object, not a defensive copy.

## Story state and events

The state shape is defined in `date_story.mjs`:

```js
{
  version: 1,
  stage: 'meet',
  choices: {},                 // dialogId → optionId
  photos: { facade: false, fountain: false, couple: false },
  collected: {},               // itemId → true
  visited: {},                 // poiId → true
  completedAt: null            // epoch milliseconds on completion
}
```

`reduce(state, event)` contains the transition rules. `createStory()` holds the state, invokes the reducer, and notifies `subscribe(fn)` listeners synchronously with `(state, previousState, event)` whenever the returned object identity changes. `subscribe` returns an unsubscribe function. Do not mutate state from listeners or dispatch every animation frame.

| Event | Current effect | Integration requirement |
| --- | --- | --- |
| `{ type: 'VISIT', id: 'entrance' }` | Records the visit; `meet` → `fountain_talk`. | Trigger after the entrance interaction/dialogue is complete. |
| `{ type: 'VISIT', id: 'fountain' }` | Records the visit; `fountain_talk` → `find_memento`. | Real dialogue must gate this advance; visiting alone currently skips the choice. |
| `{ type: 'VISIT', id: 'our_plaza' }` | During `postcard`, advances to `done` and stamps `completedAt`. | Coordinate the ending UI/export with the completion transition. |
| `{ type: 'VISIT', id }` for other IDs | Records `visited[id] = true`. | Validate stable IDs before introducing persistence. |
| `{ type: 'CHOOSE', id, option }` | Stores `choices[id] = option`; no stage or ending change. | Add authored options and choice-sensitive `postcardText`; no dialog/option IDs are defined yet. |
| `{ type: 'COLLECT', id: 'memento' }` | Records the item; `find_memento` → `photos`. | Side collectibles must not accidentally satisfy this quest gate. |
| `{ type: 'PHOTO', id }` | During `photos`, marks an existing unfinished photo; all three → `postcard`. | Only dispatch after actual framing validation succeeds. |
| `{ type: 'RESTART' }` | Returns `initialState()`. | A full restart must also reset runtime presentation and saved data according to each owner’s policy. |

Invalid/unknown event types return the original state. `VISIT`, `CHOOSE`, and `COLLECT` currently clone even when a repeated event leaves equivalent values, so “listener fired” is not proof of new progress. The reducer is DOM-free but its completion branch calls `Date.now()`, so it is not yet a fully deterministic pure function.

`objectiveFor(state)` returns `{ text, poi }`, with `poi: null` during `photos` and `done`; the photo objective includes a completed count. `postcardText(state)` returns `{ title, body }`, but its current text is fixed and ignores choices.

`createStory({ storage, search })` accepts injectable storage and URL search text. In the skeleton, `storage` is deliberately unused. A valid `?stage=meet|fountain_talk|find_memento|photos|postcard|done` replaces only the stage on a fresh initial state; it does not reconstruct prior choices, photos, visits, or collected items.

## Keyboard routing and input ownership

The current entry tracks held keys in one listener and routes non-repeated action keydowns in another:

```text
Current: storyUI.handleKey → photo.handleKey → audio.handleKey → defaults
Target:  title.handleKey → storyUI.handleKey → photo.handleKey
         → audio.handleKey → other module handlers → defaults
```

Each handler receives the lowercase `event.key` and the original event, and returns `true` if consumed. The entry then calls `preventDefault()` and skips later handlers. Repeated keydowns are skipped by the action router, while the movement tracker still maintains held state. The target order reserves first refusal for the title/pause UI; it is not implemented yet.

Default `E` handling tries `storyUI.interact(nearestPoi.id)` first, falls back to the sightseeing panel if it returns false, then checks the day-counter plaque if there is no nearby POI. Default `Escape` closes the info panel and day popup. Photo mode consumes `P`, active-mode `Space`, and active-mode `Escape`; audio consumes unmodified `M`. The planned `N`, `J`, and `C` bindings have no handlers in this snapshot.

Consuming a key does **not** erase it from the held-key tracker. Modal modules must hold an `engine.lock(id)` for as long as movement should stop. Locks stop player translation; they do not automatically stop camera orbit, other module updates, or the render loop. The current photo stub does not lock movement.

Touch/gamepad actions use the same router through synthetic keyboard events. A touch joystick or left stick maps into eight movement directions with a `0.2` dead zone and running at magnitude `0.8`. The right stick changes yaw; the touch look area changes yaw and two-finger pinch emits wheel events. On a standard-mapping controller: button `0` interacts/confirms, `2` toggles photo mode, `1` or `7` shutters while in photo mode, and `9` sends Escape. Labels vary by controller. Focus loss and disconnect paths release virtual movement keys.

## Frame order

`loop()` schedules the next animation frame, obtains `dt = min(clock.getDelta(), 0.05)` seconds and elapsed `et`, then runs:

1. Sakura particle transforms, marker visibility/pulses, and plaque glow.
2. `input.update(dt)` to poll gamepads and synchronize synthetic movement keys.
3. Player movement: normalize directional input, rotate by orbit yaw, apply walk/run speed (`4.2` / `8.5` world units per second), and test X/Z collision separately.
4. `cast.update(dt, et)` and then `audio.update(dt, et)` using the new player position.
5. Spring-camera position and look-target smoothing; call `engine.cameraOverride(dt, et)` if assigned, otherwise apply the default camera. An override’s camera position is copied back into the spring state.
6. Center the sky sphere on the camera; update the compass.
7. Find the nearest visible POI inside `INTERACT_RADIUS`; update/hide the interaction prompt according to locks, story modal state, and photo mode.
8. `photo.update(dt, et)` → `storyUI.update(dt, et)` → `sceneHooks.update(dt, et)`.
9. `composer.render()`.

There is no reducer tick. `photo.update`, `storyUI.update`, and `sceneHooks.update` are empty at this baseline. New modules need an explicit place in this order. Camera overrides must be installed before the camera phase; frame-based photo validation belongs after it. Use `dt` for motion; the existing petal integration contains per-frame increments, which is a known inconsistency rather than a pattern to copy.

## Engine API

The following is the actual shared object constructed in `anime_main.js`. Examples assume a module-local `engine` variable.

| Member | Contract and current behavior | Example |
| --- | --- | --- |
| `THREE` | Three.js namespace from the import map. | `new engine.THREE.Vector3(0, 1, 0)` |
| `scene` | Shared scene. Add only the objects your module owns; remove them on disposal. | `engine.scene.add(root)` |
| `camera` | Shared perspective camera. Ordinary control belongs to the entry; special control uses `cameraOverride`. | `point.clone().project(engine.camera)` |
| `renderer` | Shared `WebGLRenderer`; the entry owns resize and render configuration. | `engine.renderer.domElement.width` |
| `composer` | RenderPass → UnrealBloomPass → OutputPass. The entry renders each frame. | Prefer `engine.capture()` for exports. |
| `canvas` | The HTML `#c` element. | `engine.canvas.getBoundingClientRect()` |
| `player` | `{ pos: Vector3, yaw }`; `pos` is the ground anchor, `yaw` is camera orbit yaw, not avatar facing. | `const position = engine.player.pos.clone()` |
| `route` | Combined `ROUTE` object; shared coordinate and ID source. Treat it as read-only. | `engine.route.POIS.memento` |
| `blocked(x, z)` | Tests world bounds, circular fountain colliders, and three building AABBs. It is a ground-point test, not a navmesh or full mesh collision query. | `if (!engine.blocked(x, z)) { /* candidate is walkable */ }` |
| `toon(color, steps = 4, opts = {})` | Creates a `MeshToonMaterial`; exactly `steps === 3` selects the 3-step map, all other values select 4-step. `opts` is spread last. | `engine.toon(0xf2b8c6, 3, { transparent: true, opacity: 0.8 })` |
| `outline(mesh, thickness = 0.03)` | Adds an inverted-hull child sharing the mesh geometry; returns the original mesh. | `engine.outline(mesh, 0.025)` |
| `lock(id)` | Adds an ID to a shared `Set`; duplicate acquisition of the same ID is not counted twice. | `engine.lock('story-dialogue')` |
| `unlock(id)` | Removes that ID only; does not release another module’s lock. | `engine.unlock('story-dialogue')` |
| `isLocked()` | True while any movement lock exists. | `if (engine.isLocked()) return` |
| `isPhotoMode()` | Delegates to the active photo module’s `isActive()`; false before wiring. | `engine.isPhotoMode()` |
| `days` | Integer days since the entry’s `START_DATE` (`2024-03-15`), calculated once on page load and clamped to zero. | `` `在一起第 ${engine.days} 天` `` |
| `audio` | Initially null, then the audio module; use optional calls. Includes `cue`, `setMuted`, `isMuted`, `update`, `handleKey`, `getDebugState`, `dispose`. | `engine.audio?.cue('collect')` |
| `cameraOverride` | Null or one `(dt, et) => void` callback. It directly sets camera position/orientation instead of the default camera phase. No stack or ownership arbiter exists. | `engine.cameraOverride = updateShot` |
| `getCameraTarget()` | Returns the mutable shared spring-camera target, currently tracking player head height. Clone before retaining or modifying it. | `const target = engine.getCameraTarget().clone()` |
| `capture({ maxWidth = 0, type = 'image/png', quality = 0.92 } = {})` | Renders the composer and synchronously returns a canvas data URL. Positive `maxWidth` downsizes only when needed, preserving aspect ratio; CSS HUD/letterboxing is not included. | `engine.capture({ maxWidth: 1280, type: 'image/jpeg', quality: 0.85 })` |
| `toast(text, ms = 2600)` | One centered DOM notice; each call replaces the prior text and hide timer. | `engine.toast('发夹找到了', 1800)` |
| `companion` | Initially null, then `{ getPosition(), getHeadPosition(), root }` from cast. Current getters reuse internal vectors; clone values to retain them. | `const head = engine.companion?.getHeadPosition().clone()` |

Supported audio cue names are `tick`, `choose`, `stage`, `photo`, `shutter`, `collect`, and `ending`. A cue is silent before audio unlock or while muted. The audio module also subscribes to story events, so avoid scheduling duplicate cue sequences; identical cue names within 85 ms are deduplicated.

For a temporary camera owner, retain the exact callback you installed and release it only if it is still yours:

```js
const updateShot = (dt, et) => {
  engine.camera.position.set(0, 10, 30);
  engine.camera.lookAt(engine.getCameraTarget());
};
engine.lock('my-shot');
engine.cameraOverride = updateShot;

// On completion, cancellation, restart, and disposal:
if (engine.cameraOverride === updateShot) engine.cameraOverride = null;
engine.unlock('my-shot');
```

Coordinate camera ownership with photo mode and other cinematics before starting a shot. The callback guard prevents one module from clearing a replacement, but does not itself provide arbitration.

## Coordinates and collision

World ground coordinates use X/Z; Y is vertical. A positive Z position is south of the facade. Diagram is schematic, not to scale:

```text
                          north = -Z
                              ^
                 building z approximately [-22, 0]
          west -X <------------+------------> +X east
                              |
z = 0       ==================+================== facade
                              E entrance (0, 5)
                              c companion wait (2.5, 10.5)

z = 40                                          T fountain POI (35, 40)
z = 48             O (-35, 48)                  O (35, 48)
z = 55                        W white_rose (0, 55)
z = 68        M memento (-44, 68)
z = 75                        P our_plaza (0, 75)
z = 80       ------------------------------------ plaza edge
z = 92                        S spawn (0, 92)
                              |
                              v
                          south = +Z

Y = 0 is the player ground anchor; +Y points up out of this plan.
```

The plaza spans X `[-100, 100]`, Z `[0, 80]`, while movement bounds are wider: X `[-150, 150]`, Z `[-4, 118]`. At spawn yaw `0`, W moves toward `-Z` and D toward `+X`; movement remains relative to orbit yaw after rotating the camera. POI interaction uses strict distance `< 6.5` in the ground plane.

Fountain visuals have radius `5.0`; their route colliders have radius `5.4`, leaving clearance. Quest interaction is at the fountain edge, not basin center. `D` in the entry separately defines building/fountain geometry, while `ROUTE` defines collision and quest coordinates; keep them synchronized through the integrator. Do not copy the contradictory historical coordinate comments elsewhere in `anime_main.js`.

## Persistence boundaries

All keys below are scoped to a browser origin, including port; localhost on two ports has separate data. There is no server account or cloud sync. This table intentionally distinguishes planned storage from actual writes.

| Key | Owner / intended contents | Status at `2a24dad` |
| --- | --- | --- |
| `lmu-date-v1` | Story owner: versioned chapter state, choices, visits, quest collection, photo completion, completion time | Planned; `createStory` accepts storage but neither reads nor writes it. No serialized schema is implemented. |
| `lmu-date-collect-v1` | Collectibles owner: side-content collection/journal/achievement progress | Planned; `date_collect.js` is absent. Do not assume a schema or reset policy yet. |
| `lmu-date-audio-muted` | Audio owner: mute preference | Implemented. String `'true'` means muted; `'false'` means unmuted. Missing/other values start unmuted. Access errors are caught. |
| `lmu-date-settings` | Title/settings owner: user settings | Planned; `date_title.js` is absent. Field names and defaults are not established. |
| `lmu-date-photos-v1` | Photo owner: persisted album/photo data | Planned; current shutter downloads a PNG and stores no album data. Format/size limits need confirmation at integration. |

`RESTART` currently resets only in-memory story state; it neither teleports the player nor clears module storage. Before integrating a restart button, define whether side collections, photos, and settings survive, and notify/reset each owning module. Do not implement restart with `localStorage.clear()`: that also removes unrelated data for the origin. Debug stage forcing must remain separate from ordinary save loading and should not overwrite a normal run.

## Parallel ownership

The authoritative baseline ownership is in `DATE_CONTRACT.md`:

| Owner | Allowed files or regions |
| --- | --- |
| Integrator | `project/src/anime_main.js` outside scene regions; `project/src/date_route.mjs`; `project/index.html`; `project/DATE_CONTRACT.md` |
| Scene/rendering | Only `REGION: SCENE` and `REGION: SCENE HOOKS` in `anime_main.js`; new `project/src/lmu_scene_*.js` |
| Characters | `project/src/date_cast.js`; new `date_cast_*.js`; read-only imports from `anime_companion.js` and `male_lead.js` |
| Story | `project/src/date_story.mjs`, `date_story_ui.js`, `date_story.css`, `project/tests/date_story.test.mjs` |
| Photo | `project/src/date_photo.js`, `date_photo.css` |

The parallel work plan adds separate owners for audio, input, map, title/settings, collectibles, banter, cinematics, ambient life, and QA/performance tools. Keep each feature’s implementation in its assigned files; ask the integrator to add imports, construction, handler routing, frame hooks, shared route data, or new engine members. This prevents independent branches from editing the same initialization code.

Each DOM module owns one root and scoped CSS classes (`ds-` story, `dp-` photo, `di-` input). Inject a stylesheet with a module-relative URL, e.g. `new URL('./date_input.css', import.meta.url).href`. Avoid global element selectors and restyling another module’s IDs. The baseline story and audio use inline styles; the contract’s stylesheet convention is the target for new work.

## Adding a module

- [ ] Agree on file ownership, module factory/API, and required entry integration with the integrator. Read the current export headers before relying on a planned feature.
- [ ] Accept `engine` and `story`; use `engine.route` for IDs and coordinates. Propose shared data changes instead of hardcoding a second quest location.
- [ ] Return `update(dt, et)` and, if needed, `handleKey(k, event)` with a boolean consumed result. Decide the exact handler and frame positions; do not create an independent render loop.
- [ ] Keep DOM/Three.js out of reducer data and logic. Dispatch semantic events only when their gameplay conditions succeed. Subscribe for discrete changes, and retain the unsubscribe function.
- [ ] Choose a unique lock ID; release it on every completion, Escape/cancel, restart, and dispose path. Coordinate camera ownership explicitly and restore only your own override.
- [ ] Own a DOM root, class prefix, scene subtree, listeners, timers, materials, and geometry. Dispose owned resources without disposing shared engine assets; audio/input provide existing lifecycle examples.
- [ ] If persisting, assign one owning module and one versioned key, validate loaded data, catch unavailable/full storage, and document migration and restart behavior. Keep debug runs isolated from ordinary saves.
- [ ] Check keyboard, touch, and standard gamepad paths; closing one modal must not consume the next interaction or leave keys/locks held.
- [ ] Run the checks present in your checkout. At baseline use `project/tools/shot.mjs`; after QA merges, also run `node --test project/tests/` and the documented playthrough/performance tools. Do not claim absent tools ran.
- [ ] Hand the integrator a commit, exact wiring requests, and reproducible limitations. Verify the complete entrance → fountain → memento → photos → plaza path after integration, not only the module in isolation.
