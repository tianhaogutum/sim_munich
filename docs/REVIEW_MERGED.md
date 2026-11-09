# Merged-module adversarial integration review

Reviewed **8b447c1** on 2026-11-09, on `t3/9c93cc61`. No production files were changed. The story, story UI, cast, photo and SCENE implementations are pending and were treated as boundaries, not reviewed as finished features. Existing items in `REVIEW_FINDINGS.md` and `QA_NOTES.md` are not repeated as new defects.

## Confirmed findings

| ID | Severity | Module boundary | Finding |
|---|---|---|---|
| R01 | P1 | Entry → journal → photo/map | Journal does not own all modal actions; N changes map, P replaces the journal with photo mode. |
| R02 | P1 | Entry → title | Focus a settings slider: Escape never reaches the title handler, retaining the title lock. |
| R03 | P1 | Title ↔ audio persistence | M mute is overwritten by title's default/stale settings on reload. |
| R04 | P1 | Title → audio API | Nonzero volume changes do nothing: title calls optional `setVolume`, audio does not implement it. |
| R05 | P1 | Cinematic → spring camera | Free-camera exit lands at a fixed 14 m / 0.28 rad pose, then moves back to the user's zoom/pitch. |
| R06 | P1 | Touch ↔ map/collect/audio layout | Joystick covers minimap; journal launcher overlaps action buttons; touch look intercepts desktop audio control. |
| R07 | P2 | Life ↔ companion | Idle/seated pedestrians skip companion avoidance and remain overlapped. |

### R01 — journal key ownership

Repro: `?notitle=1`, press J, then N or P. Runtime: journal open/locked; N changes `.dm-toggle[aria-pressed]` to `true`; P activates photo and the next collect update closes/unlocks the journal. With future photo code this may instead depend on its lock policy, but N leakage is independent of pending code. Space can also receive native button activation because collect returns false. Fix: route the open journal ahead of lower overlays, and consume remaining keys when it is open. A closed journal still returns false for unrelated keys.

### R02 — settings input bypasses modal routing

Repro: Escape → 设置 → focus `#dt-volume` → Escape. CDP keyboard input left `{screen:"settings", focused:"dt-volume", locked:true}`. `editingKey` returns early for all INPUTs, before title routing. Fix: keep IME protection first, let title consume its own controls next, then apply the gameplay text-input guard. Native field edits outside the title remain protected.

### R03 — persisted mute collision

Repro: clean save, M, reload `?notitle=1`. Before: `{muted:true,saved:"true"}`. After: `{muted:false,saved:"false"}`. Title applies its default `muted:false` during construction and audio writes it back to its own key. Fix: use audio's persisted mute as the authoritative value on menu creation and refresh the settings view from it. Volume and quality remain in the settings save.

### R04 — no audio volume implementation

Repro: set the title volume slider to 25. Saved settings report 25 but `typeof __lmu.audio.setVolume === "undefined"`. Only crossing zero affects mute; every positive volume has the same master target. Fix: implement a clamped audio volume multiplier in both initial unlock and subsequent mute/volume changes.

### R05 — camera handoff discontinuity

Repro: zoom to 5 m, drag vertically, C, C. Positions captured through the real module: before `[0,4.02323,96.12678]`; handoff `[0,5.06898,105.45478]`; after spring settles `[0,4.02321,96.12668]`. The extra excursion is about **9.4 m**, with neither player movement nor a user camera change. Fix: expose the engine's actual default spring destination and let cinematic return use that pose; keep the existing fallback for partial engines.

### R06 — independently positioned controls overlap

CDP hit tests, `?notitle=1&touch=1`:

- 1280×720: map `[18,456,196,246]`, joystick `[20,530.61,142,142]`; both touch action centers hit `.dc-launcher`. Audio center hits `.di-look`.
- 420×800: map `[12,629,128,159]`, joystick `[20,610.61,142,142]`; map center hits `.di-stick-ring`. Journal intersects the lower portion of the photo action.

Fix: expose touch mode as a body class and reserve distinct control areas only in that mode. The patch moves the map above the joystick, the journal above the actions, and audio above the look layer. This is an integration CSS rule and should be rechecked with the incoming story/photo HUDs. Normal desktop positions are unchanged.

### R07 — idle companion collision

Confirmed by `integration_merged.test.mjs`: put the companion at an idle pedestrian's position, update one frame, gap remains **0 m**. The idle `continue` checks only the player. Fix: skip idling when the companion is inside its avoidance radius, so the existing avoidance path runs.

## Evidence and verification

Commands (Node v24.21.0, Chrome headless, only port 8117):

```sh
node --test project/tests/*.test.mjs
node project/tools/review_probe.mjs http://localhost:8117/ /tmp/lmu-review-clean-profile
node project/tools/playthrough.mjs http://localhost:8117/ --out-dir /tmp/lmu-review-playthrough
```

The 42 existing tests pass. The six new integration tests produce **5 pass / 1 fail**; the intentional R07 failure proves the unpatched defect and should pass after the supplied patch. The playthrough produces **13 PASS / 0 FAIL / 1 NOT IMPLEMENTED**, with persistence correctly marked as the pending story stub. Runtime screenshots and JSON are under the `/tmp` directories above. They are evidence, not tracked assets.

## Apply-ready patch bundle

`git apply --check` validates this bundle against 8b447c1. The integrator should apply it, then run the full tests and repeat the runtime probe; no production patches were applied in this review branch.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@ -672,6 +672,12 @@
   companion: null,                                    // set below: { getPosition(), getHeadPosition(), root }
   audio: null,                                        // set below: { cue(name), setMuted(), isMuted() }
   cameraOverride: null,                               // optional (dt, et) => void; while set, the module owns the camera
+  getDefaultCameraPose: () => ({
+    position: [player.pos.x + Math.sin(player.yaw) * camDist * Math.cos(pitch),
+      player.pos.y + Math.sin(pitch) * camDist + 1.2,
+      player.pos.z + Math.cos(player.yaw) * camDist * Math.cos(pitch)],
+    target: [camTgt.x, camTgt.y, camTgt.z],
+  }),
   getCameraTarget: () => camTgt,                      // the point the default camera looks at (player head)
 };
 
@@ -710,14 +716,15 @@
 // Key routing: story UI first (dialogue), then photo mode, then the default world actions.
 // Movement keys are tracked separately above and are frozen by engine.lock().
 addEventListener('keydown', e => {
-  if (editingKey(e)) return;
+  if (e.isComposing || e.keyCode === 229) return;
   const k = e.key.toLowerCase();
-  if (title.handleKey(k, e)) { e.preventDefault(); return; }       // title / pause menu owns everything while open
+  if (title.handleKey(k, e)) { e.preventDefault(); return; }
+  if (editingKey(e)) return;       // title / pause menu owns everything while open
   if (e.repeat) {                                                   // ignore auto-repeat, but keep native defaults suppressed
     if ([' ', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
     return;
   }
-  if (cinematic.handleKey(k, e) || storyUI.handleKey(k, e) || photo.handleKey(k, e) || audio.handleKey(k, e) || map.handleKey(k, e) || collect.handleKey(k, e)) { e.preventDefault(); return; }
+  if (cinematic.handleKey(k, e) || collect.handleKey(k, e) || storyUI.handleKey(k, e) || photo.handleKey(k, e) || audio.handleKey(k, e) || map.handleKey(k, e)) { e.preventDefault(); return; }
   if (k === 'e' && !engine.isLocked() && !engine.isPhotoMode() && !storyUI.isModalOpen()) {
     if (nearestSight >= 0) {
       if (storyUI.interact(sights[nearestSight].id)) return;
--- a/project/src/date_collect.js
+++ b/project/src/date_collect.js
@@ -424,7 +424,7 @@
       else if (tab === 'memories') selectPage(page + 1);
       return true;
     }
-    return false;
+    return true; // An open journal owns the remaining keys, including Space/P/N.
   }
 
   const hook = { getStats, getFoundTitles };
--- a/project/src/date_title.js
+++ b/project/src/date_title.js
@@ -64,6 +64,8 @@
   let appliedAudio = null;
   let lastState = null;
   const settings = readSettings();
+  // M and the audio button persist through the audio module, not this menu.
+  settings.muted = engine.audio?.isMuted?.() ?? settings.muted;
   const bloomStrengths = new WeakMap();
 
   function saveSettings() {
@@ -145,6 +147,7 @@
         '<p class="dt-keyhint"><kbd>Esc</kbd> 回到你身边</p>');
       renderProgress();
     } else if (screen === 'settings') {
+      settings.muted = engine.audio?.isMuted?.() ?? settings.muted;
       const segments = (key, choices) => `<div class="dt-segments" role="group" aria-label="${key === 'quality' ? '画质' : '字幕速度'}">` +
         choices.map(([value, label]) => `<button type="button" class="dt-segment" data-dt-setting="${key}" data-dt-value="${value}" aria-pressed="${settings[key] === value}">${label}</button>`).join('') + '</div>';
       surface.innerHTML = card(heading('MAKE YOURSELF AT HOME', '偏爱，随你', '调成你最舒服的样子。设置会自动保存。') +
--- a/project/src/date_audio.js
+++ b/project/src/date_audio.js
@@ -88,6 +88,7 @@
   const doc = globalThis.document;
   let disposed = false;
   let muted = false;
+  let volume = 1;
   try { muted = globalThis.localStorage?.getItem(STORAGE_KEY) === 'true'; } catch { /* private browsing */ }
   let context = null, master = null, music = null, effects = null, fountain = null;
   let base = null, photos = null, golden = null;
@@ -197,7 +198,7 @@
         nextBar = context.currentTime + 0.06;
         nextBird = context.currentTime + 3 + Math.random() * 5;
         applyStage();
-        smooth(master.gain, muted ? 0 : 0.62, 0.12);
+        smooth(master.gain, muted ? 0 : 0.62 * volume, 0.12);
       }
       // Do not await: browsers can leave resume pending until a trusted gesture arrives.
       context.resume()?.catch(() => {});
@@ -227,10 +228,16 @@
     if (disposed) return;
     muted = Boolean(value);
     try { globalThis.localStorage?.setItem(STORAGE_KEY, String(muted)); } catch { /* storage is optional */ }
-    if (master) smooth(master.gain, muted ? 0 : 0.62, 0.045);
+    if (master) smooth(master.gain, muted ? 0 : 0.62 * volume, 0.045);
     // Begin the current progression at a fresh bar after a long silent interval.
     if (!muted && context && nextBar < context.currentTime) nextBar = context.currentTime + 0.06;
     renderIndicator();
+  }
+
+  function setVolume(value) {
+    if (disposed || !Number.isFinite(value)) return;
+    volume = clamp(value, 0, 1);
+    if (master) smooth(master.gain, muted ? 0 : 0.62 * volume, 0.045);
   }
 
   function toggleMute() {
@@ -373,7 +380,7 @@
   armGesture();
 
   return {
-    update, setMuted, isMuted: () => muted, cue,
+    update, setMuted, setVolume, isMuted: () => muted, cue,
     handleKey(k, event) {
       if (disposed || typeof k !== 'string' || k.toLowerCase() !== 'm') return false;
       if (event?.ctrlKey || event?.metaKey || event?.altKey) return false;
@@ -382,7 +389,7 @@
     },
     // Read-only diagnostics; the native context and nodes stay owned by this module.
     getDebugState: () => ({ contextState: context?.state ?? 'uninitialized', muted, disposed,
-      stage, activeVoices: voices.size, permanentNodes: permanent.length,
+      stage, volume, activeVoices: voices.size, permanentNodes: permanent.length,
       masterGain: master?.gain.value ?? 0, fountainGain: fountain?.gain.value ?? 0,
       fountainTarget: waterAmount, baseGain: base?.gain.value ?? 0,
       photosGain: photos?.gain.value ?? 0, goldenGain: golden?.gain.value ?? 0, ...counters }),
--- a/project/src/date_cinematic.js
+++ b/project/src/date_cinematic.js
@@ -72,6 +72,8 @@
       quaternion: a.quaternion.clone().slerp(b.quaternion, t), fov: lerp(a.fov, b.fov, t) };
   }
   function homePose() {
+    const live = engine.getDefaultCameraPose?.();
+    if (live) return poseFrom(live.position, live.target, originalFov);
     const target = engine.getCameraTarget?.();
     const pose = defaultCameraPose(triple(engine.player.pos), savedYaw, target ? triple(target) : undefined);
     return poseFrom(pose.position, pose.target, originalFov);
--- a/project/src/date_input.js
+++ b/project/src/date_input.js
@@ -195,6 +195,7 @@
     lastLocked = isLocked;
     lastPhoto = isPhoto;
     root.hidden = !active;
+    document.body.classList.toggle('di-touch', active);
     root.classList.toggle('di-locked', isLocked);
     root.classList.toggle('di-photo-mode', isPhoto);
     // Leave camera gestures available in photo mode even if it locks movement.
@@ -367,6 +368,7 @@
       disposed = true;
       listeners.forEach(remove => remove());
       root.remove();
+      document.body.classList.remove('di-touch');
       if (ownsStylesheet) stylesheet.remove();
       if (currentInput === api) currentInput = null;
     },
--- a/project/src/date_input.css
+++ b/project/src/date_input.css
@@ -14,6 +14,10 @@
 }
 
 .di-root[hidden], .di-root [hidden] { display: none !important; }
+/* Reserve the bottom corners for the stick and action buttons. */
+body.di-touch .dm-panel { top: 230px; bottom: auto; }
+body.di-touch .dc-launcher { bottom: calc(220px + env(safe-area-inset-bottom)); }
+body.di-touch #date-audio-root { top: 10px !important; bottom: auto !important; z-index: 26 !important; }
 .di-root * { box-sizing: border-box; }
 
 .di-look {
--- a/project/src/lmu_life_sim.mjs
+++ b/project/src/lmu_life_sim.mjs
@@ -167,7 +167,8 @@
       }
       for (const flock of flocks) stepFlock(flock, dt, { player, companion, blocked, random, celebrate });
       for (const p of pedestrians) {
-        if (p.idle > 0 && (!player || distance(p, player) > 2.2)) {
+        if (p.idle > 0 && (!player || distance(p, player) > 2.2) &&
+            (!companion || distance(p, companion) >= 1.65)) {
           p.idle -= dt; p.moving = false; continue;
         }
         p.seated = false;
```
