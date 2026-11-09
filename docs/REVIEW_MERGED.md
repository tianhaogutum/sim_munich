# Merged-module adversarial integration review

Reviewed **8b447c1** on 2026-11-09, on `t3/adversarial-integration-review`. No production files were changed. The story, story UI, cast, photo and SCENE implementations are pending and were treated as boundaries, not reviewed as finished features. Existing items in `REVIEW_FINDINGS.md` and `QA_NOTES.md` are not repeated as new defects.

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
| R08 | P2 | Life / cinematic / collect / map updates | Warm allocation samples exceed 50 KB/s; targeted reductions supplied, life/cinematic still above target. |
| R09 | P2 | Playthrough harness | Optional white-rose step reports success when E was swallowed and no visit/dialogue/panel occurred. |

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

### R08 — allocation churn (confirmed; performance target still open)

CDP `HeapProfiler.startSampling`, 4 KiB interval, includes objects collected by minor/major GC. Each ordinary updater was warmed for 1,800 calls, then sampled for 1,800 more at `dt=1/60`. Attribution is restricted to the named synchronous call subtree, excluding unrelated RAF/render work. Active cinema includes both `update` and the camera override for 600 frames. Values below are allocated bytes divided by simulated time, **not retained heap growth**, and are estimates at 60 fps rather than measured frame-rate guarantees.

| Updater | Baseline bytes/s | Proposed bytes/s |
|---|---:|---:|
| life | 2,227,813 | 612,000 |
| cinematic, playing | 143,666 | 96,002 |
| collect | 112,469 | 29,831 |
| map | 72,809 | 41,595 |
| input, no controller | 52,114 | 21,264 |
| audio, context not running | 5,743 | 7,384 |
| banter, idle | 3,829 | 6,016 |
| cinematic, idle | 2,051 | 2,188 |

Input is borderline and varied below the threshold in one cold sample; it is not a memory-leak claim. Audio's event-driven live-node allocations are not represented by the inactive-context batch. Small rates vary with sampling. The large life/cinematic costs are repeatable.

Minimal targeted changes in the bundle: reuse cyclist and cinematic vectors/poses, allow allocation-free path sampling into an optional output buffer, stop copying entire idle NPC records, avoid temporary collision callbacks, cache the flock context, avoid the empty-gamepad allocation path, throttle achievement snapshots to 2 Hz (pickups/story events still check immediately), and paint the minimap at 10 Hz. Update the existing collision source guard alongside the mathematically equivalent squared-distance test. Public camera sampling keeps independently owned output by default.

**Remaining:** life and active cinematics still exceed the requested 50 KB/s threshold after these safe changes. These are partial performance mitigations, not performance sign-off. Further instance-transform/simulation refactoring belongs to those module owners; the measured excess should not be described as fixed. No escalating retained geometry/texture leak was established.

### R09 — optional-visit false positive in the runner

Runtime repro: place the player at white rose, hold a temporary engine lock, press E, then evaluate the runner's exact condition (`stage === before`). It is true even though `visited.white_rose` is false, `storyUI.isModalOpen()` is false, and no `#panel.open` exists. The current step prints “visited” without verifying an interaction. This matters as the new cinematic/title locks can legitimately swallow E. The bundle adds a positive postcondition accepting the recorded visit, an actual dialogue, or the information panel. A missing interaction then fails instead of being reported as a pass.

## Other checked boundaries / remaining scope

- Free-camera and sequence disposal release only their own locks, clear their camera override, unsubscribe, and resolve pending play promises. The runtime probe also covers `done` during free camera, deferred ending after exit, and RESTART during that ending. No leaked lock was found in these paths.
- J → Escape closes the journal rather than opening pause, since title refuses to open under its lock. Opening J during free camera is denied. The journal patch prevents P from creating the photo/journal overlap. Final story/photo Escape behavior must be rechecked after those pending modules land.
- Held touch-stick → pause → pointer release → close pause produces no movement afterwards. Synthetic keys reach the shared router; `isTrusted` filtering is restricted to distinguishing physical movement keys in input. Synthetic-first audio stays suspended until a real gesture, then a CDP pointer gesture resumes it. A 100-call synchronous `cue('stage')` burst produces one cue (three extra voices), not 100. Visibility/interruption recovery on a real mobile browser remains unverified.
- Garbage JSON in `lmu-date-collect-v1`, `lmu-date-settings`, and `lmu-date-audio-muted` reloads without an exception. Collect state resets safely. There are no locale-storage reads in these merged modules. Story save/restart and photo persistence remain pending-owner checks; the known baseline restart/spawn issue is not relabeled as a new finding.
- Cast assumptions are compatible with its header: banter needs finite world-space `getHeadPosition()`/`getPosition()` values; map, life and cinematic need finite `getPosition()` coordinates. They copy/read returned scratch vectors synchronously. None of the reviewed merged modules reads `companion.root.children`, mesh names, skeleton bones, or a fixed child hierarchy. Incoming cast must keep these getters available from its first frame and must not return local coordinates.
- Frame placement is appropriate: cast/life/audio/collect after movement; cinematic before camera; photo/story/map/title/banter after camera. Banter explicitly refreshes the camera matrix. The incoming photo implementation must refresh matrices before its own projection/raycast work, since it runs before banter.
- The playthrough deliberately forces `notitle=1`; it does not test real Start/Continue/Restart navigation. Its off-target-photo gap is already documented in the baseline QA and is not a new finding here. Final dialogue choices, meaningful photo validation, and persistence remain unverified until the pending modules land.
- Screenshots were visually inspected at 420×800 before/after the proposed touch layout rules. Repositioning clears the control overlaps. This does not claim mobile audio/hardware validation or approve the still-pending scene visuals.

## Evidence and verification

Commands (Node v24.21.0, Chrome headless, only port 8117):

```sh
node --test project/tests/*.test.mjs
node project/tools/review_probe.mjs http://localhost:8117/ /tmp/lmu-review-final
node project/tools/playthrough.mjs http://localhost:8117/ --out-dir /tmp/lmu-review-playthrough
```

The 42 existing tests pass. The eight new integration tests produce **6 pass / 2 fail**; intentional R04/R07 failures prove the unpatched defects. Combined suite: **48 pass / 2 fail**. Loading the proposed source changes through a temporary Node module loader, without editing production files, yields **50 pass / 0 fail**. The original and proposed-harness playthroughs both produce **13 PASS / 0 FAIL / 1 NOT IMPLEMENTED**, with persistence correctly marked as the pending story stub.

Proposed JS was also loaded through data-URL modules in a disposable browser document, with proposed CSS injected as styles. Results: mute survives reload; Escape on the slider returns to pause; the volume API reports 0.25; N/P leave the journal open; camera handoff matches the prior 5 m/pitched pose within 0.001 m; touch action centers no longer hit the journal. Application code produced no uncaught exceptions. This staging document generated a harmless missing `favicon.ico` request, distinct from the zero-error unmodified playthrough.

Raw JSON/screenshots/profiles: `/tmp/lmu-review-final`, `/tmp/lmu-review-baseline-warm`, `/tmp/lmu-review-patched-warm`, `/tmp/lmu-review-playthrough`. The optional `REVIEW_PATCH_JSON` environment variable for the probe accepts a map of repo-relative filenames to proposed source strings; this validates candidate sources without editing the entry/modules. Temporary artifacts are not committed.

## Apply-ready patch bundle

**One patch bundle, nine findings, fourteen files.** `git apply --check` validates this against the reviewed baseline. Apply it to the feature branch, run the full tests, and repeat the runtime probe. Production files remain unchanged in this review branch. R08 is explicitly a partial performance mitigation.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@ -572,8 +572,15 @@
 ];
 function blocked(x, z) {
   if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
-  if (FOUNTAINS.some(f => Math.hypot(x - f.x, z - f.z) < f.r)) return true;
-  return solids.some(s => Math.abs(x-s.cx) < s.hw && Math.abs(z-s.cz) < s.hd);
+  for (let i = 0; i < FOUNTAINS.length; i++) {
+    const f = FOUNTAINS[i], dx = x - f.x, dz = z - f.z;
+    if (dx * dx + dz * dz < f.r * f.r) return true;
+  }
+  for (let i = 0; i < solids.length; i++) {
+    const s = solids[i];
+    if (Math.abs(x - s.cx) < s.hw && Math.abs(z - s.cz) < s.hd) return true;
+  }
+  return false;
 }
 // Keys typed into a text field or during IME composition never reach the game (QA finding 3).
 function editingKey(e) {
@@ -672,6 +679,12 @@
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

@@ -707,17 +720,18 @@
   panel.classList.add('open');
 }

-// Key routing: story UI first (dialogue), then photo mode, then the default world actions.
+// Key routing: title/cinematic, journal, story/photo, then shared and world actions.
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
@@ -20,13 +20,13 @@
   const storage = attempt(() => globalThis.localStorage);
   let saved = attempt(() => validateCollectState(JSON.parse(storage?.getItem(COLLECT_STORAGE_KEY))), initialCollectState());
   let disposed = false, opened = false, page = 0, tab = 'memories', lastPos = null;
-  let saveIn = 0, renderIn = 0, previousFocus = null, toastIn = 0, badgeIn = 0;
+  let saveIn = 0, renderIn = 0, achievementIn = 0, previousFocus = null, toastIn = 0, badgeIn = 0;
   const objects = [];
   const listeners = [];
   let root, panel, content, launcher, toast, badge;
-  const state = () => attempt(() => story.getState?.(), {}) ?? {};
-  const photoMode = () => !!attempt(() => engine.isPhotoMode?.(), false);
-  const locked = () => !!attempt(() => engine.isLocked?.(), false);
+  const state = () => { try { return story.getState?.() ?? {}; } catch { return {}; } };
+  const photoMode = () => { try { return !!engine.isPhotoMode?.(); } catch { return false; } };
+  const locked = () => { try { return !!engine.isLocked?.(); } catch { return false; } };
   const getStats = () => snapshotStats(saved, state());
   const getFoundTitles = () => MEMORY_ITEMS.filter(item => saved.found[item.id]).map(item => item.title);
   const persist = () => attempt(() => storage?.setItem(COLLECT_STORAGE_KEY, JSON.stringify(saved)));
@@ -297,6 +297,7 @@
     if (saved.found[object.item.id]) return;
     saved.found[object.item.id] = { foundAt: Date.now(), elapsedSeconds: saved.elapsedSeconds };
     object.pop = 0;
+    checkAchievements();
     notify(`✦ 拾起回忆：${object.item.title} · ${getStats().fragmentsFound}/8`, 3400);
     attempt(() => engine.audio?.cue?.('collect'));
     if (toast) {
@@ -365,7 +366,8 @@
     if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) {
       const movement = lastPos ? Math.hypot(p.x - lastPos.x, p.z - lastPos.z) : Infinity;
       if (visible && !locked() && !hiding) saved.distanceWalked += distanceStep(lastPos, p);
-      lastPos = { x: p.x, z: p.z };
+      if (!lastPos) lastPos = { x: p.x, z: p.z };
+      else { lastPos.x = p.x; lastPos.z = p.z; }
       const pois = engine.route?.POIS ?? POIS;
       for (const id of VISIT_IDS) {
         const point = pois[id];
@@ -390,10 +392,14 @@
         object.body.rotation.y = time * .5 + object.phase;
         object.ring.position.y = .10 - group.position.y;
         object.ring.material.opacity = .3 + Math.sin(time * 2 + object.phase) * .1;
-        object.sparkles.forEach((sparkle, i) => { sparkle.rotation.y = time + i; sparkle.scale.setScalar(.75 + Math.sin(time * 2 + i) * .3); });
-      }
-    }
-    checkAchievements();
+        for (let i = 0; i < object.sparkles.length; i++) {
+          const sparkle = object.sparkles[i];
+          sparkle.rotation.y = time + i; sparkle.scale.setScalar(.75 + Math.sin(time * 2 + i) * .3);
+        }
+      }
+    }
+    achievementIn += step;
+    if (achievementIn >= .5) { checkAchievements(); achievementIn = 0; }
     if (toastIn > 0 && !opened && !hiding) { toastIn -= step; if (toastIn <= 0 && toast) toast.hidden = true; }
     if (badgeIn > 0 && !opened && !hiding) { badgeIn -= step; if (badgeIn <= 0 && badge) badge.hidden = true; }
     saveIn += step;
@@ -424,7 +430,7 @@
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
@@ -18,6 +18,10 @@
   let stage = story?.getState?.().stage;
   const held = new Set();
   const poseCamera = camera.clone();
+  const lookTarget = new THREE.Vector3();
+  const pathSample = { position: new Float64Array(3), target: new Float64Array(3), fov: camera.fov };
+  const sampledPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: camera.fov };
+  const mixedPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: camera.fov };
   const move = new THREE.Vector3();
   const rotation = new THREE.Euler(0, 0, 0, 'YXZ');

@@ -56,8 +60,11 @@
   }
   function poseFrom(position, target, fov) {
     poseCamera.position.fromArray(position);
-    poseCamera.lookAt(new THREE.Vector3().fromArray(target));
-    return { position: poseCamera.position.clone(), quaternion: poseCamera.quaternion.clone(), fov };
+    poseCamera.lookAt(lookTarget.fromArray(target));
+    sampledPose.position.copy(poseCamera.position);
+    sampledPose.quaternion.copy(poseCamera.quaternion);
+    sampledPose.fov = fov;
+    return sampledPose;
   }
   function currentPose() {
     return { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
@@ -68,10 +75,14 @@
     setFov(pose.fov);
   }
   function mixPose(a, b, t) {
-    return { position: a.position.clone().lerp(b.position, t),
-      quaternion: a.quaternion.clone().slerp(b.quaternion, t), fov: lerp(a.fov, b.fov, t) };
+    mixedPose.position.copy(a.position).lerp(b.position, t);
+    mixedPose.quaternion.copy(a.quaternion).slerp(b.quaternion, t);
+    mixedPose.fov = lerp(a.fov, b.fov, t);
+    return mixedPose;
   }
   function homePose() {
+    const live = engine.getDefaultCameraPose?.();
+    if (live) return poseFrom(live.position, live.target, originalFov);
     const target = engine.getCameraTarget?.();
     const pose = defaultCameraPose(triple(engine.player.pos), savedYaw, target ? triple(target) : undefined);
     return poseFrom(pose.position, pose.target, originalFov);
@@ -123,7 +134,7 @@
   }
   function sequencePose(sequence, elapsed) {
     const t = Math.max(0, elapsed - sequence.spec.leadIn);
-    const sampled = samplePath(sequence.spec.path, t, originalFov);
+    const sampled = samplePath(sequence.spec.path, t, originalFov, pathSample);
     const pose = poseFrom(sampled.position, sampled.target, sampled.fov);
     return sequence.spec.leadIn && elapsed < sequence.spec.leadIn
       ? mixPose(sequence.from, pose, easeInOut(elapsed / sequence.spec.leadIn)) : pose;
@@ -251,7 +262,11 @@
               beginReturn(spec.handoff);
               active.elapsed = overflow;
             } else {
-              const card = spec.captions.find(c => elapsed >= c.start && elapsed <= c.end);
+              let card = null;
+              for (let i = 0; i < spec.captions.length; i++) {
+                const candidate = spec.captions[i];
+                if (elapsed >= candidate.start && elapsed <= candidate.end) { card = candidate; break; }
+              }
               if (card) {
                 if (title.textContent !== card.title) title.textContent = card.title;
                 if (subtitle.textContent !== card.subtitle) subtitle.textContent = card.subtitle;
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
@@ -321,6 +322,9 @@
     let pads;
     // Some embedding contexts disallow access to the gamepad API.
     try { pads = navigator.getGamepads?.() ?? []; } catch { pads = []; }
+    let connected = false;
+    for (let i = 0; i < pads.length; i++) if (pads[i]?.connected !== false && pads[i]?.mapping === 'standard') { connected = true; break; }
+    if (!connected) { padButtons.clear(); padNeedsBaseline = true; return; }
     const present = new Set();
     const editing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
     for (const pad of pads) {
@@ -367,6 +371,7 @@
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
@@ -3,7 +3,10 @@
 export const TRAM_TRAVEL = 28;
 const TAU = Math.PI * 2;
 const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
-export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
+export const distance = (a, b) => {
+  const dx = a.x - b.x, dz = a.z - b.z;
+  return Math.sqrt(dx * dx + dz * dz);
+};
 export function seededRandom(seed = 714) {
   return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
 }
@@ -56,14 +59,14 @@
 // Projection handles even a player teleporting onto an NPC. If walls constrain
 // the first escape direction, search around the personal-space circle instead.
 export function avoidPoint(pos, obstacle, radius, blocked = () => false, side = 1) {
-  if (!obstacle || distance(pos, obstacle) >= radius) return { ...pos };
+  if (!obstacle || distance(pos, obstacle) >= radius) return pos;
   const angle = Math.atan2(pos.x - obstacle.x || .001 * side, pos.z - obstacle.z);
   for (let i = 0; i < 32; i++) {
     const a = angle + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 16;
     const p = { x: obstacle.x + Math.sin(a) * (radius + .01), z: obstacle.z + Math.cos(a) * (radius + .01) };
     if (!blocked(p.x, p.z)) return p;
   }
-  return { ...pos };
+  return pos;
 }
 export function steerPedestrian(actor, target, player, dt, blocked = () => false) {
   dt = clamp(dt, 0, .1);
@@ -144,6 +147,7 @@
       route, goal: (i + 1) % route.length, waypoints: [], idle: 0, seated: false, moving: true, phase: random() * TAU };
   });
   let previousStage = null, endingFlock = null;
+  const flockContext = { blocked, random, player: null, companion: null, celebrate: false };
   return {
     flocks, pedestrians,
     update(dt, time, player, companion, stage) {
@@ -165,9 +169,11 @@
             Object.assign(endingFlock,next);
         }
       }
-      for (const flock of flocks) stepFlock(flock, dt, { player, companion, blocked, random, celebrate });
+      flockContext.player = player; flockContext.companion = companion; flockContext.celebrate = celebrate;
+      for (const flock of flocks) stepFlock(flock, dt, flockContext);
       for (const p of pedestrians) {
-        if (p.idle > 0 && (!player || distance(p, player) > 2.2)) {
+        if (p.idle > 0 && (!player || distance(p, player) > 2.2) &&
+            (!companion || distance(p, companion) >= 1.65)) {
           p.idle -= dt; p.moving = false; continue;
         }
         p.seated = false;
--- a/project/tests/route.test.mjs
+++ b/project/tests/route.test.mjs
@@ -16,8 +16,15 @@
 ];
 function blocked(x, z) {
   if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
-  if (FOUNTAINS.some(f => Math.hypot(x - f.x, z - f.z) < f.r)) return true;
-  return solids.some(s => Math.abs(x - s.cx) < s.hw && Math.abs(z - s.cz) < s.hd);
+  for (let i = 0; i < FOUNTAINS.length; i++) {
+    const f = FOUNTAINS[i], dx = x - f.x, dz = z - f.z;
+    if (dx * dx + dz * dz < f.r * f.r) return true;
+  }
+  for (let i = 0; i < solids.length; i++) {
+    const s = solids[i];
+    if (Math.abs(x - s.cx) < s.hw && Math.abs(z - s.cz) < s.hd) return true;
+  }
+  return false;
 }
 const syncMessage = 'Engine collision rule changed: review anime_main.js and RE-SYNC the independent copy in tests/route.test.mjs; do not just suppress this guard.';

--- a/project/src/lmu_life.js
+++ b/project/src/lmu_life.js
@@ -12,6 +12,8 @@
   const matrix = new T.Matrix4(), local = new T.Matrix4(), world = new T.Matrix4();
   const pos = new T.Vector3(), scale = new T.Vector3(), quat = new T.Quaternion(), euler = new T.Euler();
   const color = new T.Color();
+  const hip = new T.Vector3(), foot = new T.Vector3(), knee = new T.Vector3();
+  const direction = new T.Vector3(), up = new T.Vector3(0, 1, 0);
   const sphere = (r = 1) => new T.SphereGeometry(r, 8, 6);
   const box = () => new T.BoxGeometry(1, 1, 1);
   const capsule = (r, length) => new T.CapsuleGeometry(r, length, 3, 7);
@@ -201,7 +203,7 @@
       if(!flying && !blocked(x+wanderX,z+wanderZ)) { x+=wanderX; z+=wanderZ; }
       // If the companion moves into an individual bird's footprint, lift it
       // immediately; group takeoff follows on the next simulation step.
-      const personalLift=!flying && companion && distance({x,z},companion)<3 ? 3.3 : 0;
+      const personalLift=!flying && companion && Math.hypot(x-companion.x,z-companion.z)<3 ? 3.3 : 0;
       const yaw=flying?Math.atan2(flock.to.x-flock.from.x,flock.to.z-flock.from.z)+Math.sin(flock.time)*.25:o.yaw+Math.sin(elapsed*.38+o.phase)*.5;
       const y=.38+flock.y+personalLift+(flying?Math.sin(o.phase+flock.time*2)*.25:0);
       const peck=!flying && Math.sin(elapsed*1.8+o.phase)>.65?.42:0;
@@ -236,13 +238,15 @@
       put(riders,i,0,1.39,-.04,.30); put(helmets,i,0,1.95,.16,.12);
       for(let s=0;s<2;s++) {
         const a=elapsed*7+s*Math.PI+i;
-        const hip=new T.Vector3((s?1:-1)*.15,1.08,-.17);
-        const foot=new T.Vector3((s?1:-1)*.15,.43+Math.sin(a)*.16,.04+Math.cos(a)*.16);
-        const knee=new T.Vector3(hip.x,(hip.y+foot.y)*.5+.04,(hip.z+foot.z)*.5+.20);
-        for(const [j,a,b] of [[0,hip,knee],[1,knee,foot]]) {
-          const direction=b.clone().sub(a), length=direction.length();
-          pos.copy(a.clone().add(b).multiplyScalar(.5));
-          quat.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()); scale.set(1,length/.43,1);
+        hip.set((s?1:-1)*.15,1.08,-.17);
+        foot.set((s?1:-1)*.15,.43+Math.sin(a)*.16,.04+Math.cos(a)*.16);
+        knee.set(hip.x,(hip.y+foot.y)*.5+.04,(hip.z+foot.z)*.5+.20);
+        for(let j=0;j<2;j++) {
+          const a=j===0?hip:knee, b=j===0?knee:foot;
+          direction.subVectors(b,a);
+          const length=direction.length();
+          pos.addVectors(a,b).multiplyScalar(.5);
+          quat.setFromUnitVectors(up,direction.normalize()); scale.set(1,length/.43,1);
           local.compose(pos,quat,scale); matrix.multiplyMatrices(world,local);
           // Leg geometry runs downward from the joint. Centre it on the bone.
           local.makeTranslation(0,.15,0); matrix.multiply(local); pedals.setMatrixAt(i*4+s*2+j,matrix);
--- a/project/src/date_collect_data.mjs
+++ b/project/src/date_collect_data.mjs
@@ -70,7 +70,7 @@
 }

 export function distanceStep(previous, current) {
-  if (![previous?.x, previous?.z, current?.x, current?.z].every(finite)) return 0;
+  if (!finite(previous?.x) || !finite(previous?.z) || !finite(current?.x) || !finite(current?.z)) return 0;
   const step = Math.hypot(current.x - previous.x, current.z - previous.z);
   return step <= 5 ? step : 0;
 }
--- a/project/src/date_map.js
+++ b/project/src/date_map.js
@@ -264,7 +264,7 @@
     if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) { panel.hidden = true; edge.hidden = true; return; }
     panel.hidden = false;
     const time = Number.isFinite(et) ? et : clock;
-    if (lastPaint >= 0 && clock - lastPaint < 1 / 30) return;
+    if (lastPaint >= 0 && clock - lastPaint < 1 / 10) return;
     lastPaint = clock;
     if (resizePending) {
       const bounds = canvas.getBoundingClientRect();
--- a/project/src/date_cinematic_paths.mjs
+++ b/project/src/date_cinematic_paths.mjs
@@ -19,16 +19,23 @@
   return easeInOut(t);
 }

-export function catmullRom(p0, p1, p2, p3, t) {
+export function catmullRom(p0, p1, p2, p3, t, out = [0, 0, 0]) {
   t = clamp01(t);
-  return p1.map((v, i) => 0.5 * ((2 * v) + (-p0[i] + p2[i]) * t
-    + (2 * p0[i] - 5 * v + 4 * p2[i] - p3[i]) * t * t
-    + (-p0[i] + 3 * v - 3 * p2[i] + p3[i]) * t * t * t));
+  for (let i = 0; i < 3; i++) {
+    const v = p1[i];
+    out[i] = 0.5 * ((2 * v) + (-p0[i] + p2[i]) * t
+      + (2 * p0[i] - 5 * v + 4 * p2[i] - p3[i]) * t * t
+      + (-p0[i] + 3 * v - 3 * p2[i] + p3[i]) * t * t * t);
+  }
+  return out;
 }

-export function sampleSpline(points, segment, t) {
-  const at = index => points[Math.max(0, Math.min(points.length - 1, index))];
-  return catmullRom(at(segment - 1), at(segment), at(segment + 1), at(segment + 2), t);
+export function sampleSpline(points, segment, t, out) {
+  const last = points.length - 1;
+  return catmullRom(points[Math.max(0, Math.min(last, segment - 1))],
+    points[Math.max(0, Math.min(last, segment))],
+    points[Math.max(0, Math.min(last, segment + 1))],
+    points[Math.max(0, Math.min(last, segment + 2))], t, out);
 }

 export function buildArcLengthTable(points, segment, samples = 160) {
@@ -77,7 +84,7 @@
   };
 }

-export function samplePath(path, time, fallbackFov = 52) {
+export function samplePath(path, time, fallbackFov = 52, out = { position: [0, 0, 0], target: [0, 0, 0], fov: fallbackFov }) {
   const { frames } = path;
   time = Math.max(frames[0].time, Math.min(path.duration, time));
   let i = 0;
@@ -85,11 +92,10 @@
   const a = frames[i], b = frames[i + 1];
   const progress = ease((time - a.time) / (b.time - a.time), a.ease ?? 'linear');
   const u = arcParameter(path.arcs[i], progress);
-  return {
-    position: sampleSpline(path.positions, i, u),
-    target: sampleSpline(path.targets, i, u),
-    fov: lerp(a.fov ?? fallbackFov, b.fov ?? fallbackFov, progress),
-  };
+  sampleSpline(path.positions, i, u, out.position);
+  sampleSpline(path.targets, i, u, out.target);
+  out.fov = lerp(a.fov ?? fallbackFov, b.fov ?? fallbackFov, progress);
+  return out;
 }

 export function defaultCameraPose(position = [SPAWN.x, 0, SPAWN.z], yaw = SPAWN.yaw, target) {
--- a/project/tools/playthrough.mjs
+++ b/project/tools/playthrough.mjs
@@ -244,6 +244,9 @@
       await qa.tap('e'); await qa.frames();
       // Optional information must not skip the required chapter objective.
       check((await state()).stage === before, 'Optional POI unexpectedly advanced the quest');
+      check(await qa.evaluate(`!!(__lmu.story.getState().visited?.white_rose ||
+        __lmu.storyUI.isModalOpen() || document.querySelector('#panel.open'))`),
+        'White rose input was ignored: no recorded visit, dialogue, or information panel');
       await closeOverlays(); return `visited; stage remains ${before}`;
     });
     await step('Fountain dialogue', () => visit('fountain', 'fountain_talk', 'find_memento'));
```
