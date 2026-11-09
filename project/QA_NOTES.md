# Munich date: integration QA

Reviewed baseline: `9c6b74a`. Only QA files were changed. Findings below refer to the
baseline line numbers; re-check them after merging the feature modules. Tests exercise
the public `window.__lmu` API and real keyboard events, never dispatch quest events to
force progress. POI coordinates come from an imported `date_route.mjs`.

## Run the fast checks

```sh
node --test project/tests/route.test.mjs
cd project
python3 -m http.server 8109
```

In another terminal, from the repo root:

```sh
node project/tools/playthrough.mjs http://localhost:8109 --out-dir /tmp/lmu_qa
```

Node 22+ and Chrome are required. `CHROME` can override the same macOS executable
default used by `shot.mjs`. No npm packages or build step are used. The CLI can
auto-start a server **only** for unreachable localhost port **8109**, serving its own
`project` directory. `--keep-server` keeps that auto-started server; an existing server
is always left alone. It never serves on, stops, or modifies another agent's port.
The URL's `stage` query parameter is removed to avoid bypassing fresh-load/save tests.

Each step has a <15 s budget, two-frame waits, a PNG and a `.console.json` file.
`report.json` records status, duration, and evidence paths; `console.json` contains all
browser errors/warnings. Warnings are recorded; errors and uncaught exceptions fail.
A failed run exits 1. The total browser work is capped near 115 s plus cleanup; a
normal stub run takes about 20 s. `Performance` reports up to 120 intervals, with a
8.5 s sampling cap, and never fails merely for a slow frame rate.

Every download goes to a temporary Chrome profile and is deleted on exit. Nothing is
written to `~/Downloads`. Evidence is outside git. Scripts do not import `shot.mjs`.

### Scope and interpretation

- The story must advance through `meet → fountain_talk → find_memento → photos →
  postcard → done`. Dialogue advances with Enter, capped at 30 beats per attempt;
  visible `[data-option], .ds-choice, .ds-option` controls choose the first option,
  with keyboard `1` as a fallback. E is retried once after a frame wait.
- All five POIs are visited, including optional white rose. Photo shots use the
  requested facade/fountain positions, and scan 16 camera yaws for the companion.
  The couple shot zooms in through the wheel input: the default 14 m camera boom is
  incompatible with the goal's maximum 9 m camera-to-subject distance.
- Fresh-load clearing runs through `Runtime.evaluate`, followed by reload. Reload
  waits for a newly created `__lmu`, so the previous page cannot falsely pass the
  persistence assertion. A stub's `void storage` is recognized as no save code;
  a real implementation that loses completion is a FAIL, not a skip.
- A title screen can use `[data-action="start"]`, `[data-action="new-game"]`,
  `.dt-start`, `#date-start`, or `#start-btn`. Visible start/continue button text in
  English or Chinese is also recognized. If the merged title uses another control,
  update this QA-owned adapter. Do not bypass its lock in the test.
- The walkthrough checks progression and head-in-frame projection, not photographic
  quality, occlusion, touch controls, or a real device's performance. It does not
  prove a 10–15 minute narrative experience. Review PNGs and do one human read-through.
- `route.test.mjs` intentionally keeps an independent copy of solids/blocking math.
  A source guard checks the engine dimensions, solids expressions and `blocked()`
  body. If it fails after a legitimate engine edit, review and re-sync the copy;
  do not merely delete the guard. BOUNDS/FOUNTAINS are shared route imports.
- The route test's photo check samples reachable ground positions with a 52° FOV
  and a 1.6 m eye/head height. It is a geometric feasibility test; the browser
  walkthrough is the integration check for the actual spring camera.

## Actual baseline results

Latest verified output is recorded below; timing/positions can vary slightly between
runs. Screenshots and the machine-readable report are in `/tmp/lmu_qa`.

<!-- ACTUAL_OUTPUT_START -->
```text
STATUS          STEP                    DETAIL
-------------------------------------------------------------------------------------
PASS            Fresh load              __lmu ready, meet, route matches checkout
PASS            Entrance                meet → fountain_talk
PASS            White rose (optional)   visited; stage remains fountain_talk
PASS            Fountain dialogue       fountain_talk → find_memento
PASS            Find hair clip          find_memento → photos
PASS            Photo facade            1/3 credited
PASS            Photo fountain          2/3 credited
PASS            Photo couple            3/3 credited, head distance 6.88 m
PASS            Our plaza / ending      postcard → done
NOT IMPLEMENTED Reload persistence      reset to meet; story has no save implementation
PASS            Movement W              Δ(-3.76, -2.17) m; yaw 60°
PASS            Movement D              Δ(2.17, -3.76) m; yaw 60°
PASS            Fountain collision      182 samples, stopped z=53.421, no circle entry/NaN
PASS            Performance (120 frames) 16.67 ms avg, 16.80 ms max (120/120 intervals; informational, software GL)
Temporary downloads: 1 (deleted on Chrome exit; never ~/Downloads)
-------------------------------------------------------------------------------------
13 PASS; 0 FAIL; 1 NOT IMPLEMENTED; 18.3 s
Evidence: /tmp/lmu_qa
```

Pure-logic test output (exit 0):

```text
✔ collision copy is in sync with engine dimensions, solids and blocked() (0.567625ms)
✔ spawn, every POI, companion waiting spot and fountain seat are walkable and bounded (0.098958ms)
✔ every POI is reachable from spawn over a 1 m grid (1.369125ms)
✔ photo goals have ordered distance limits and a reachable, roughly front-facing shot (1.433459ms)
✔ STAGES covers objective mappings and state comparisons; objective POIs exist (0.684542ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 68.120959
```

The playthrough exited 0; every step stayed below 15 s. All 14 PNGs were
created and all console logs were empty. Auto-start on port 8109 and default
shutdown passed in a separate 18.2 s run; `--keep-server` left its server alive
as requested. That QA-owned server was stopped after verification. A deliberate
negative run against `/src/` exited 1 in 10.1 s with `window.__lmu: condition
not met` and captured its 404 console messages and screenshot.
<!-- ACTUAL_OUTPUT_END -->

Additional focused runtime probes were run against the same port and baseline,
with no console errors. Raw probe data: `/tmp/lmu_review/probes.json`.

## Confirmed findings and suggested patches

### 1. P1: photo mode prevents dragging to aim

**Files:** `index.html:170–175` (`#photo-overlay`),
`src/anime_main.js:580–587`, `src/date_photo.js:24–28`.

**Repro:** Enter P, then drag in the middle of the scene. The active full-screen
overlay receives mousedown; only the canvas starts a drag. CDP pointer drag from
(480,280) to (560,280) left yaw at 0; `elementFromPoint` returned `photo-overlay`.
The playthrough uses the explicitly requested debug yaw positioning, so a passing
photo step does **not** cover this user-facing defect. It matters especially when
the finished module requires valid framing.

**Suggested minimal patch:** Let noninteractive framing graphics pass pointer
events to the canvas. Keep actual photo controls pointer-enabled.

```diff
--- a/project/index.html
+++ b/project/index.html
@@
-#photo-overlay.active{opacity:1;pointer-events:all}
+#photo-overlay.active{opacity:1;pointer-events:none}
```

Apply the equivalent rule in `date_photo.css` if the photo agent replaces the overlay.

### 2. P1: companion recovery can put it inside collision and leave it stranded

**File:** `src/date_cast.js:35–42`.

**Repro A:** At any post-meet stage, set the player to (30,44) and the companion far
away. The player position is walkable, but catch-up snaps the companion to
(31.5,45.5), inside the (35,48) fountain. After 200 updates it is still there. The
snap skips `engine.blocked`, and the 2.12 m new gap is smaller than followDistance.

**Repro B:** Put the player at (35,56), companion at (35,40). After 200 updates the
companion stops at z=42.4, 13.6 m from the player. Axis sliding cannot get around a
circle when both x positions match, and catch-up never triggers below 28 m.

**Suggested minimal recovery patch:** Search legal offsets for catch-up, and detect
prolonged lack of progress. A waypoint/breadcrumb follower is preferable for smooth
movement; the following fallback prevents the two permanent traps without phasing
the companion's final position into an obstacle.

```diff
--- a/project/src/date_cast.js
+++ b/project/src/date_cast.js
@@
   const headPos = new THREE.Vector3();
+  let stalledFor = 0;
+  function recoverNear(p, c) {
+    for (const radius of [2.2, 3.5, 5, 0]) {
+      for (let i = 0; i < 16; i++) {
+        const angle = i * Math.PI / 8;
+        const x = p.x + Math.cos(angle) * radius;
+        const z = p.z + Math.sin(angle) * radius;
+        if (!engine.blocked(x, z)) { c.set(x, 0.9, z); stalledFor = 0; return; }
+      }
+    }
+  }
@@
-    if (d > route.COMPANION.catchUpDistance) { c.set(p.x + 1.5, 0.9, p.z + 1.5); return; }
+    if (d > route.COMPANION.catchUpDistance || engine.blocked(c.x, c.z)) {
+      recoverNear(p, c); return;
+    }
@@
     if (d > gap) {
+      const beforeX = c.x, beforeZ = c.z;
       const s = Math.min(d - gap, 6 * dt) / d;
@@
       if (!engine.blocked(c.x, nz)) c.z = nz;
+      stalledFor = Math.hypot(c.x - beforeX, c.z - beforeZ) < 0.001 ? stalledFor + dt : 0;
+      if (stalledFor > 1.5) recoverNear(p, c);
-    }
+    } else stalledFor = 0;
```

### 3. P1: composition/editing input can move the player or advance the quest

**File:** `src/anime_main.js:570–572, 681–688`.

**Repro:** At entrance in `meet`, dispatch a composing keydown with `key:'e',
isComposing:true`; stage becomes `fountain_talk`. Focus an input and hold W for
300 ms; the player moves from z=92 to z≈90.74. Both listeners operate before
checking IME or editable targets. Future name/text fields will inherit this problem.

**Suggested patch:** Use one guard in both keydown listeners. Keep keyup unconditional
so releasing a movement key while a modal is focused still clears it.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
+function editingKey(e) {
+  const el = e.target;
+  return e.isComposing || e.keyCode === 229 ||
+    (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
+}
+addEventListener('keydown', e => {
+  if (!editingKey(e)) keys[e.key.toLowerCase()] = true;
+});
@@
 addEventListener('keydown', e => {
+  if (editingKey(e)) return;
   if (e.repeat) return;
```

When opening a blocking modal, clear held movement intent as well as acquiring its
lock if movement should require a fresh press after dismissal. The current stub has
no story modal, so that future policy remains an integration check, not a confirmed
stuck-key defect. A direct test of keyup while locked passed: unlocking did not move
the player. The existing blur handler also correctly clears keyboard movement.

### 4. P1 release gap: persistence is deliberately absent in the story stub

**File:** `src/date_story.mjs:86–107`.

**Repro:** Finish the route, reload with no `?stage`; `done` resets to `meet`.
`safeLocalStorage()` only obtains storage; `void storage` discards it. Searching only
for the word `localStorage` would wrongly classify this as a regression in implemented
save code. The harness marks this exact stub **NOT IMPLEMENTED**; the release must
have no such row.

**Suggested patch direction for the story owner:** Restore a versioned, validated
state and save changed states, catching storage failures; debug stages must remain
unsaved. This is a minimal outline, not a replacement for the story agent's schema
validation/migration implementation:

```diff
--- a/project/src/date_story.mjs
+++ b/project/src/date_story.mjs
@@
-  void storage; // skeleton: persistence is added by the story agent
-  let state = initialState();
   const forced = new URLSearchParams(search).get('stage');
+  let state = forced ? initialState() : loadValidatedState(storage) ?? initialState();
@@
       if (next !== prev) {
         state = next;
+        if (!forced) saveStateSafely(storage, state);
         for (const fn of listeners) fn(state, prev, event);
```

`loadValidatedState` must reject malformed/version-mismatched stages, photo booleans,
choice/collection/visit objects and completion timestamps. `saveStateSafely` must
catch quota/denied-storage exceptions. Test RESTART persistence, not just completion.

### 5. P2: world E interactions still run behind photo mode

**File:** `src/anime_main.js:684–688` and `src/date_photo.js:46–50`.

**Repro:** At entrance in `meet`, press P, then E. State becomes `fountain_talk`
while photo mode stays active, although the proximity prompt is hidden. The photo
module consumes only P/Space/Escape, so E falls through to the world. A blocking
future modal can do the same unless its handler consumes every world action.

**Suggested patch:** Gate the action, not only its visual prompt. Keep story/photo
first-refusal routing so their own modal buttons and Escape continue working.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-  if (k === 'e') {
+  if (k === 'e' && !engine.isLocked() && !engine.isPhotoMode() && !storyUI.isModalOpen()) {
```

### 6. P2: repeat suppression allows native Space/arrow defaults

**File:** `src/anime_main.js:681–684`.

**Repro:** While photo mode is active, a repeat Space keydown has
`defaultPrevented === false`. The non-repeat event is consumed. With a focused button
or a scrollable future overlay this permits native activation/scrolling on repeats.
The current body has `overflow:hidden`, so page scrolling is not presently visible;
this is a confirmed routing gap with a UI-dependent consequence.

**Suggested patch:** Suppress relevant native defaults even when ignoring repeats.
Put this after the editable/IME guard from finding 3, so normal text entry is preserved.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-  if (e.repeat) return;
   const k = e.key.toLowerCase();
+  if (e.repeat) {
+    if ([' ', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
+    return;
+  }
```

### 7. P2: blur cancels keys but not dragging; touch contacts are never retired

**File:** `src/anime_main.js:572, 578–606`.

**Repro:** Canvas mousedown → window blur → mousemove by 50 px changes yaw by -0.2
without another mousedown. `drag` stays true if mouseup happened outside the window.
There is also no touchend/touchcancel handler, so completed touch identifiers remain
in `touches`. Browsers may reuse identifiers, but the retained state is unnecessary
and permits stale gestures across interrupted sessions.

**Suggested patch:** Put this after `drag` and `touches` have been declared, replacing
the old blur registration. A pointer-events-based controller could replace the
whole gesture implementation when the touch agent lands.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-addEventListener('blur',    () => { for (const k in keys) keys[k] = false; });
@@
 let touches = {};
+addEventListener('blur', () => {
+  for (const k in keys) keys[k] = false;
+  drag = false;
+  touches = {};
+});
+const endTouches = e => {
+  for (const t of e.changedTouches) delete touches[t.identifier];
+};
+canvas.addEventListener('touchend', endTouches);
+canvas.addEventListener('touchcancel', endTouches);
```

### 8. P2: 204 light petal instances are unused; petal speed depends on refresh rate

**File:** `src/anime_main.js:460–482, 719–735`.

**Repro:** Inspect matrices in the two petal meshes. The 680-instance light mesh has
exactly 204 identity matrices: dark petals write to a separate mesh but their slots
in the light mesh are never written. Those instances overlap at the origin and still
cost draw/vertex work. All translation and spin increments are per-frame; a 120 Hz
display animates roughly twice as fast as 60 Hz despite movement being dt-scaled.

**Suggested patch:** Pack each instanced mesh and scale the nominal 60 Hz increments.
Use the same `frameScale` for all position and rotation updates, not only Y below.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
 const PETAL_COUNT = 680;
+const DARK_COUNT = Math.floor(PETAL_COUNT * .3);
@@
-const sakuraInst = new THREE.InstancedMesh(petalGeoBase, mat.sakura, PETAL_COUNT);
-const sakuraDInst = new THREE.InstancedMesh(petalGeoBase, mat.sakuraD, Math.floor(PETAL_COUNT*.3));
+const sakuraInst = new THREE.InstancedMesh(petalGeoBase, mat.sakura, PETAL_COUNT - DARK_COUNT);
+const sakuraDInst = new THREE.InstancedMesh(petalGeoBase, mat.sakuraD, DARK_COUNT);
@@
-  dark: i < PETAL_COUNT*.3,
+  dark: i < DARK_COUNT,
@@
+  const frameScale = dt * 60;
   petals.forEach((p, i) => {
@@
-    p.y += p.vy;
+    p.y += p.vy * frameScale;
@@
-    if (p.dark) sakuraDInst.setMatrixAt(i % Math.floor(PETAL_COUNT*.3), dummy.matrix);
-    else        sakuraInst.setMatrixAt(i, dummy.matrix);
+    if (p.dark) sakuraDInst.setMatrixAt(i, dummy.matrix);
+    else        sakuraInst.setMatrixAt(i - DARK_COUNT, dummy.matrix);
```

The loop reuses `dummy`, vectors, matrices, geometry and materials; no recurring
per-petal geometry/material allocation was found. Initial renderer geometry counts
can rise as the spring camera reveals previously unrendered objects, so that alone
is not evidence of a memory leak. Three later samples taken two seconds apart were
stable at 108 geometries and 16 textures, with no console errors.

### 9. P2: resize does not refresh devicePixelRatio

**File:** `src/anime_main.js:42, 702–707`.

**Repro:** Start at DPR 1; emulate 800×600 at DPR 2. `devicePixelRatio` is 2 but
`renderer.getPixelRatio()` stays 1 and both canvas/composer targets remain 800×600.
Aspect is correctly 4/3. A display-scale change therefore keeps the old resolution.

**Suggested patch:** Update the renderer and composer pixel ratios together.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
 addEventListener('resize', () => {
   camera.aspect = innerWidth / innerHeight;
   camera.updateProjectionMatrix();
+  const ratio = Math.min(devicePixelRatio, 2);
+  renderer.setPixelRatio(ratio);
+  composer.setPixelRatio(ratio);
   renderer.setSize(innerWidth, innerHeight);
   composer.setSize(innerWidth, innerHeight);
 });
```

## Verified non-bugs and remaining integration risks

- **Capture is not blank with `preserveDrawingBuffer:false`.**
  `src/anime_main.js:633–640` renders the composer immediately before synchronous
  `toDataURL`/`drawImage`. A decoded `capture({maxWidth:160})` was 160×92; all 14,720
  pixels were opaque and red ranged 43–253. Do not enable preserveDrawingBuffer just
  to fix a hypothetical blank shot. The PNG was also visually checked.
- **Keyboard blur clearing and keyup while locked work in the baseline.** The focused
  probe held W, blurred and saw no further displacement. It also released W under a
  lock, unlocked, and stayed at (0,0,92). Re-check these after touch/title bindings land.
- **Escape order needs integration testing.** Story gets first refusal, then photo,
  then legacy panels. Each layer should consume Escape only if it actually closes
  its own topmost modal, restore the HUD, and release exactly its own lock. If the
  final story handler returns true unconditionally, photo mode becomes impossible
  to close. This is a risk, not a confirmed defect in the no-modal stub.
- **Photo framing remains unvalidated in the stub.** Every shutter credits the next
  missing goal even when aimed away. That is intentional scaffolding; do not ship
  it as genuine framing validation. Verify the final module rejects one deliberately
  off-target shot before accepting correctly aimed shots.
- **Dialogue/choice correctness is beyond stage advancement.** The stub advances
  fountain chat on VISIT with no choice. The final story's unit tests must require
  the choice, reject out-of-order events and corrupt saves, and check restart/debug
  save isolation. The route harness cannot invent final dialogue IDs.
- **Pointer wheel is global.** `anime_main.js:588` zooms even over scrollable UI. Scope
  it to gameplay or stop propagation from photo album/dialogue scroll containers
  if those modules add them. No scrollable album exists in the baseline to reproduce.
- **Native touch/device testing remains necessary.** CDP desktop key tests cannot
  validate mobile joystick sizing, touch scrolling, safe areas, audio unlock or
  screen rotation. Test title → movement → dialogue → shutter on one real phone.

## Ordered merge checklist

1. Merge feature commits without changing file ownership assumptions. Check imports
   and the API names in `DATE_CONTRACT.md`; keep `window.__lmu` reachable after title
   initialization. Grep for `SKELETON NOTE`, `void storage`, and `next missing` to
   find any remaining intentional scaffolding.
2. Inspect `git diff` for duplicate key/pointer listeners, repeated DOM IDs, and
   duplicate stylesheet injection. In particular grep for `keydown`, `keyup`,
   `isComposing`, `e.repeat`, `lock(`, `unlock(`, `isModalOpen`, and `isActive`.
3. Run `node --test project/tests/` first (including the story owner's tests). A
   collision source-guard failure requires review, not suppression. The new test
   must keep the main entrance, companion spots and all POIs connected.
4. Start **one** local server on the integrator's assigned port; pass its URL to the
   runner. Port inventory observed at 10:36 CET: 8100, 8101, 8105, 8106, 8107, 8108
   were in use by other processes; 8109 was this QA server. 8102–8104 were not in that
   snapshot. Treat **8100–8109 as allocated/reserved**, re-check with
   `lsof -nP -iTCP:8100-8109 -sTCP:LISTEN`, and never stop another agent's listener.
5. Run the playthrough with a clean output directory. Require no FAIL and, for the
   finished game, no NOT IMPLEMENTED. Inspect all screenshots, especially the
   companion and ending. Read `.console.json` files even if errors are zero.
6. Verify the first fountain choice has persisted, the hair clip is actually hidden
   until its stage, the three distinct goals are credited once, postcard closes,
   and reload restores `done`. Restart must survive another reload as `meet`.
7. Manually drag to aim in P; test one invalid shot, album open/close/export, and the
   postcard image. Check Escape with story, album, photo and legacy panels open in
   several orders. Check held W → open modal → release W → close modal and blur
   during both mouse and touch gestures.
8. Walk around both fountains with the companion, approach entrance corners, and
   run far enough to trigger catch-up. Do not confuse player-only collision success
   with proof of companion pathfinding.
9. Test title start/continue/restart, audio unlock/mute, map and touch UI, a narrow
   viewport, and DPR change. The 120-frame number is a smoke measurement on headless
   software GL, not a production performance threshold.
10. Keep test evidence under `/tmp`, stage only intended source/QA files, and commit.
    This QA task does not push, merge, rebase, switch branches, or touch other worktrees.
