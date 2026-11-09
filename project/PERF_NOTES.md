# Munich date: performance and accessibility integration audit

## Scope and reproducibility

This audit owns only `tools/perf_profile.mjs`, `tools/a11y_audit.mjs`, `tools/perf_lib.mjs`, and this report. No scene, UI, stylesheet, asset, dependency or contract was changed. The audited snapshot is branch `t3/performance-accessibility-audit` at base commit `2a24dadab4cd4247907e3933db154571562ea397`; the cast, story and photo modules are still stubs. Findings against those stubs must be retested after integration. Line references below refer to that snapshot, not proposed patches. Host: Apple M4 Pro; this is a software-renderer run even though the host has a GPU.

Run with Node 22+ (tested Node 24.21.0), installed Chrome, and no npm dependencies:

```sh
cd project && python3 -m http.server 8114
# In a second terminal, from repository root:
node project/tools/perf_profile.mjs http://localhost:8114 \
  --max-calls 400 --max-tris 2000000 \
  --out /tmp/lmu_perf.json --md /tmp/lmu_perf.md
node project/tools/a11y_audit.mjs http://localhost:8114 \
  --out /tmp/lmu_a11y.md --json /tmp/lmu_a11y.json
```

Set `CHROME` if the executable is elsewhere. Both tools create their own temporary profile and prohibit downloads; neither touches the user's Chrome profile or Downloads folder. They close their Chrome child on completion or SIGINT/SIGTERM. Run the tools **sequentially** for timing comparisons. The full perf run navigates afresh for each of 15 stage/view pairs, waits 30 rAF frames, measures 180 rAF intervals, then measures a separate 10-second allocation window. Views teleport the **player**, with the standard spring-arm camera following: spawn, facade `(0,0,20), yaw=0`, fountain `(30,0,36), yaw=-0.6`, plaza `(0,0,75), yaw=π`, and facade with photo mode opened through P.

`renderer.info.autoReset=false` plus one reset around each `composer.render()` counts **all** render passes, including the shadow pass and fullscreen effects. Default Three.js counters otherwise report the final pass only. Counters are read after the composer; average, p95 and maximum are in JSON. Frame time is rAF wall time; submission time is not GPU time. These runs force **SwiftShader software GL**, at 1280×720/DPR 1. Do not convert their milliseconds to an integrated/discrete GPU prediction.

Heap growth is a pressure **proxy**, not total allocated bytes: force GC at start, read `Performance.getMetrics.JSHeapUsedSize`, run 10 seconds, read again, force GC and read a third time. Report both gross net growth and retained growth, normalized by the measured interval. Natural GC, compiler caches and audio scheduling can change the result. A positive 10-second retained slope alone is not proof of a leak. Profiler frame-object collection is disabled during this window. Live DOM count traverses the document; the separate `allocatedDomNodes` metric may include detached nodes. Scene child additions/removals are sampled on each rAF for the first 5 seconds; transient changes between frames or nested object churn are outside that detector.

For quick repro use `--views facade --stages meet`; use defaults for acceptance. Optional perf gates: `--max-calls`, `--max-tris`, `--max-frame-ms`, `--max-p95-ms`, `--max-heap-mb`, `--max-heap-growth-mb-min` (post-GC retained slope), `--max-children-growth`. A threshold/runtime failure exits 1; configuration/startup failure exits 2. A11y defaults to exit 0 with findings; use `--fail-on high` for an integration gate. A11y checks are heuristics, not a conformance certificate.

## Measured summary

- Final baseline: **15/15 cases passed** `--max-calls 400 --max-tris 2000000`; no browser diagnostics. Chrome **156.0.8078.80**, ANGLE Vulkan SwiftShader, Apple M4 Pro host, 1280×720/DPR 1.
- Peak submitted calls **221**; peak submitted triangles **30,780**. Average rAF interval **53.33–106.76 ms**, p95 **66.7–200.1 ms**. The slow end came from the later `done` cases despite substantially identical rendering counters; retain those results rather than treating timing variation as extra geometry.
- Isolated fresh-browser repeat of `done/spawn`: **75.83 ms average / 133.3 ms p95**, versus **106.76 / 200.1 ms** in the full run, with identical **220 calls / 30,372 triangles**. The original results are preserved below; timing variability is material, so draw-count/geometry comparisons are more stable than a single software-GL FPS value.
- Post-GC retained slope **0.50–0.65 MiB/min** over the 10-second windows; highest sampled JS heap **14.18 MiB**. All root-child checks stayed **142 → 142**, zero detected additions/removals. Longer warmup and multi-minute tests are needed before calling small retained slopes leaks.
- Census: **185 meshes**, 132 MeshToonMaterial meshes, 53 ShaderMaterial meshes, **52 inverted-hull candidates**, **58 shadow-casting meshes**, **9 InstancedMeshes / 1,074 advertised instances**, 27,864 expanded vertices / 6,156 unique vertices across 126 geometries.
- At meet/fountain the live DOM was **209 nodes**, while the allocated/detached-node metric was **1,054**; at meet/plaza it was **209 / 1,325**. This supports the repeated-prompt-replacement finding, not an accumulating live DOM leak.
- Accessibility: **28 consolidated rows** (6 high, 21 medium, 1 manual review), from 30 settled snapshots. DOM and native-Tab checks independently report the same hidden info close button. `lang="zh-CN"` is present; no visible unnamed controls were found, but the close glyph lacks descriptive purpose. All tested E/P/Escape actions worked; camera key equivalents are missing. A complete keyboard-only narrative/photo/restart playthrough remains manual acceptance work.

## Integration budget

| Measure | Acceptance / investigation budget | Rationale |
|---|---|---|
| Whole-frame calls | ≤400 hard gate, aim ≤250 at all five views | Leaves room above current scenery for cast and life; includes shadows and postprocessing. |
| Whole-frame triangles | ≤2,000,000 hard gate, aim ≤750,000 | Counts repeated shadow/outline work, not unique geometry. |
| Root scene children | 0 net growth at rest over 5 s; review any repeated additions | Transient intentional life effects need bounded pools and explicit cleanup. |
| Retained JS heap | Aim ≤1 MiB/min after warmup; investigate >2 MiB/min sustained over five minutes | Use paired post-GC samples; ignore a single 10 s burst as proof of a leak. |
| Mid-range laptop GPU, 1280×720 / effective DPR ≤1.5 | **Unmeasured target** avg ≤16.7 ms, p95 ≤22 ms; fallback quality avg ≤33.3 ms, p95 ≤40 ms | Engineering target/estimate only. Validate on real hardware; SwiftShader cannot establish it. |
| Same-machine SwiftShader regression | Investigate >20% avg or p95 increase vs a fresh baseline with identical Chrome, DPR and viewport | Repeat borderline results after shader warmup and without other renderers. |
| A11y | Zero unnamed visible controls, hidden focus stops, unannounced objectives/toasts; 44×44 touch controls | Full keyboard date route and screen-reader modal flow still need manual acceptance. |

Do not initially gate on absolute software-rendered frame time. Keep budget and JSON next to each integration test result, compare the same stage/view, and record added modules. A scene-wide vertex census is not submitted triangle count: instancing, culling, shadows and outlines affect those differently.

## Top five actionable findings and proposed patches

### 1. Decorative petals spend CPU every frame, move faster at higher FPS, and contain 204 unused instances

**Locations:** `src/anime_main.js:466`, `:472`, `:727`–`:744`. The light batch has count 680, but only indices 204–679 are populated; the dark batch has count 204. Consequently 204 identity transforms remain at the origin and the batches advertise 884 petals, not 680. On each frame the code composes 680 matrices, performs trigonometry and uploads both instance buffers; positions and rotations advance without multiplying by dt. Repro: inspect both ShapeGeometry InstancedMesh counts and the first light matrix, then compare travel at 30/60 FPS. This also ignores reduced-motion preferences.

**Suggested self-contained patch** (scene owner applies): replace the entire existing SAKURA PARTICLE SYSTEM block through `const petals = ...`, and replace the CPU animation block. This preserves toon lighting, moves exactly 680 instances in the vertex shader, rotates normals, initializes instance matrices once, uses seconds rather than frame count, and bounds shader-driven displacement explicitly. Validate visual character of the drift after application; this is a proposed behavior change, not an applied optimization.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@ -463,26 +463,61 @@
 const petalShape = new THREE.Shape();
 petalShape.ellipse(0, 0, .28, .16, 0, Math.PI*2, false, 0);
 const petalGeoBase = new THREE.ShapeGeometry(petalShape, 6);
-const sakuraInst = new THREE.InstancedMesh(petalGeoBase, mat.sakura, PETAL_COUNT);
-const sakuraDInst = new THREE.InstancedMesh(petalGeoBase, mat.sakuraD, Math.floor(PETAL_COUNT*.3));
+const petalSeed = new Float32Array(PETAL_COUNT * 4);
+const petalMotion = new Float32Array(PETAL_COUNT * 4);
+for (let i = 0; i < PETAL_COUNT; i++) {
+  petalSeed.set([(Math.random()-.5)*220, (Math.random()-.5)*120+40,
+    Math.random()*34.5, 6+Math.random()*13.2], i*4);
+  petalMotion.set([(Math.random()-.5)*4.8, (Math.random()-.5)*3.6,
+    Math.random()*Math.PI*2, .3+Math.random()*1.2], i*4);
+}
+petalGeoBase.setAttribute('aPetalSeed', new THREE.InstancedBufferAttribute(petalSeed, 4));
+petalGeoBase.setAttribute('aPetalMotion', new THREE.InstancedBufferAttribute(petalMotion, 4));
+const petalTime = { value: 0 };
+const petalMaterial = mat.sakura.clone();
+petalMaterial.color.set(0xffffff); // instanceColor supplies pink shades
+petalMaterial.onBeforeCompile = shader => {
+  shader.uniforms.uPetalTime = petalTime;
+  shader.vertexShader = `
+    uniform float uPetalTime;
+    attribute vec4 aPetalSeed;
+    attribute vec4 aPetalMotion;
+    mat3 petalRotation() {
+      float a = aPetalMotion.z + uPetalTime*aPetalMotion.w;
+      float c = cos(a), s = sin(a), b = a*.7;
+      return mat3(c,s,0., -s,c,0., 0.,0.,1.) *
+        mat3(1.,0.,0., 0.,cos(b),sin(b), 0.,-sin(b),cos(b));
+    }
+  ` + shader.vertexShader;
+  shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>',
+    '#include <beginnormal_vertex>\nobjectNormal = petalRotation() * objectNormal;');
+  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
+    #include <begin_vertex>
+    float t = uPetalTime;
+    vec3 center = vec3(
+      mod(aPetalSeed.x + 110. + aPetalMotion.x*t, 220.) - 110.,
+      34. - mod(aPetalSeed.z + t*aPetalSeed.w, 34.5),
+      mod(aPetalSeed.y + 20. + aPetalMotion.y*t, 120.) - 20.);
+    center.x += sin(t*.4+aPetalMotion.z)*2.;
+    center.z += cos(t*.3+aPetalMotion.z)*1.5;
+    transformed = petalRotation()*transformed + center;
+  `);
+};
+petalMaterial.customProgramCacheKey = () => 'lmu-gpu-petals-v1';
+const sakuraInst = new THREE.InstancedMesh(petalGeoBase, petalMaterial, PETAL_COUNT);
+const petalIdentity = new THREE.Matrix4();
+const petalColor = new THREE.Color();
+for (let i = 0; i < PETAL_COUNT; i++) {
+  sakuraInst.setMatrixAt(i, petalIdentity);
+  sakuraInst.setColorAt(i, petalColor.setHex(i < Math.floor(PETAL_COUNT*.3) ? 0xFF88AA : 0xFFB0C2));
+}
+sakuraInst.instanceMatrix.needsUpdate = true;
+sakuraInst.instanceColor.needsUpdate = true;
 sakuraInst.castShadow = false;
-sakuraDInst.castShadow = false;
-scene.add(sakuraInst, sakuraDInst);
-
-const petals = Array.from({ length: PETAL_COUNT }, (_, i) => ({
-  x: (Math.random()-.5)*220,
-  y: Math.random()*28 + 3,
-  z: (Math.random()-.5)*120 + 40,
-  vx: (Math.random()-.5)*.08,
-  vy: -(Math.random()*.22+.10),
-  vz: (Math.random()-.5)*.06,
-  rx: Math.random()*Math.PI*2,
-  ry: Math.random()*Math.PI*2,
-  rz: Math.random()*Math.PI*2,
-  vrx: Math.random()*.025, vry: Math.random()*.018, vrz: Math.random()*.012,
-  phase: Math.random()*Math.PI*2,
-  dark: i < PETAL_COUNT*.3,
-}));
+// Instance matrices cannot describe shader displacement to Three's CPU culler.
+sakuraInst.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 17, 40), 150);
+scene.add(sakuraInst);
+const petalMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
 
 // ── SIGHTSEEING POINTS ────────────────────────────────────────────────────────
 // Positions come from date_route.mjs (POIS); `when` hides quest-only points outside their stage.
@@ -724,24 +759,7 @@
   const et  = clock.elapsedTime;
 
   // ── Sakura animation ──
-  petals.forEach((p, i) => {
-    p.x += p.vx + Math.sin(et*.4 + p.phase) * .018;
-    p.y += p.vy;
-    p.z += p.vz + Math.cos(et*.3 + p.phase) * .012;
-    p.rx += p.vrx; p.ry += p.vry; p.rz += p.vrz;
-    if (p.y < -.5) {
-      p.y = 22 + Math.random()*12;
-      p.x = (Math.random()-.5)*220;
-      p.z = (Math.random()-.5)*120 + 40;
-    }
-    dummy.position.set(p.x, p.y, p.z);
-    dummy.rotation.set(p.rx, p.ry, p.rz);
-    dummy.updateMatrix();
-    if (p.dark) sakuraDInst.setMatrixAt(i % Math.floor(PETAL_COUNT*.3), dummy.matrix);
-    else        sakuraInst.setMatrixAt(i, dummy.matrix);
-  });
-  sakuraInst.instanceMatrix.needsUpdate  = true;
-  sakuraDInst.instanceMatrix.needsUpdate = true;
+  petalTime.value = petalMotionQuery.matches ? 0 : et;
 
   // ── Marker pulse ──
   markers.forEach((m, i) => {
```

A lower-risk interim fix is to allocate `680 - floor(680*.3)` light instances, write light index `i - floor(680*.3)`, multiply velocities by `dt*60`, and use `DynamicDrawUsage` for the two instanceMatrix attributes. That fixes count/frame-rate errors but retains matrix work/uploads. Do not apply both alternatives.

### 2. Closed panels remain keyboard focus stops; the camera has no keyboard rotation/zoom

**Locations:** `index.html:97`–`:109`, `:136`–`:147`, `:277`–`:290`; `src/anime_main.js:582`–`:608`, `:687`–`:707`; `src/date_photo.js:25`–`:48`. Repro: reload, press Tab before opening anything. Then attempt to compose a photo using only the key hints. Movement keys are available but yaw, pitch and distance are controlled only by mouse/touch/gamepad. Photo mode does not focus the shutter or return focus. The close glyph's accessible name is just “✕”.

**Suggested patch** for initial hidden/inert panels, focus return, and camera keys (integrator merges with new modal owners):

```diff
--- a/project/index.html
+++ b/project/index.html
@@
-<div id="panel">
-  <button id="panel-close">✕</button>
+<div id="panel" inert role="dialog" aria-labelledby="panel-title">
+  <button id="panel-close" aria-label="关闭信息面板">✕</button>
@@
-<div id="days-popup">
+<div id="days-popup" inert role="dialog" aria-label="在一起的日子">
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-document.getElementById('panel-close').onclick = () => panel.classList.remove('open');
-document.getElementById('days-popup-close').onclick = () => daysPopup.classList.remove('visible');
+let panelReturnFocus = null;
+const openPanel = (el, className, closeId) => {
+  panelReturnFocus = document.activeElement;
+  engine.lock('info-panel');
+  el.inert = false;
+  el.classList.add(className);
+  document.getElementById(closeId).focus({ preventScroll: true });
+};
+const closePanels = () => {
+  panel.classList.remove('open'); panel.inert = true;
+  daysPopup.classList.remove('visible'); daysPopup.inert = true;
+  engine.unlock('info-panel');
+  panelReturnFocus?.focus?.({ preventScroll: true });
+};
+document.getElementById('panel-close').onclick = closePanels;
+document.getElementById('days-popup-close').onclick = closePanels;
@@
-  panel.classList.add('open');
+  openPanel(panel, 'open', 'panel-close');
@@
   const k = e.key.toLowerCase();
+  if (e.target instanceof HTMLElement && e.target.matches('input,textarea,select,[contenteditable="true"]')) return;
   if (storyUI.handleKey(k, e) || photo.handleKey(k, e) || audio.handleKey(k, e)) { e.preventDefault(); return; }
+  // Handle Tab/Enter in focused buttons normally. Camera bindings avoid WASD.
+  if (['q','r','pageup','pagedown','+','=','-'].includes(k)) {
+    if (k === 'q') player.yaw += .12;
+    if (k === 'r') player.yaw -= .12;
+    if (k === 'pageup') pitch = Math.min(1.15, pitch + .08);
+    if (k === 'pagedown') pitch = Math.max(.08, pitch - .08);
+    if (k === '+' || k === '=') camDist = Math.max(5, camDist - 1);
+    if (k === '-') camDist = Math.min(22, camDist + 1);
+    e.preventDefault(); return;
+  }
@@
-      daysPopup.classList.add('visible'); return;
+      openPanel(daysPopup, 'visible', 'days-popup-close'); return;
@@
-    panel.classList.remove('open');
-    daysPopup.classList.remove('visible');
+    closePanels();
```

Also document Q/R, PageUp/PageDown and +/- in `#status-panel`; do not merely add bindings without hints. Locking these panels also suppresses the world proximity prompt and movement while they are open. The repeated-key guard can be relaxed **for camera keys only** if continuous keyboard orbit is desired. These one-close-button panels do not justify `aria-modal=true` unless the integrator also traps focus and locks the world; new multi-control story dialogs need a real focus trap. Move focus to the photo shutter when opening, remember the previous focused element, and restore it when closing. Space on a focused native button must not invoke both the global shutter shortcut and the browser's synthetic click.

### 3. Visible POI prompts churn DOM and strings every frame

**Locations:** `src/anime_main.js:817`, `:820`; `src/date_story_ui.js:39`. Repro: stand at fountain `(30,0,36)` where the prompt is visible. `innerHTML` reparses the same kbd/text each frame, creating detached nodes; `objectiveFor` also creates a new object/string through `promptFor`. This can elevate raw heap/DOM metrics without a retained leak. No `new THREE.Vector2` remains in the proximity loop: lines 806–809 correctly use `Math.hypot`.

**Suggested minimal patch** (integrator); retain visibility logic and avoid repeated DOM writes. Further throttle objective lookup on story changes rather than each frame.

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
 let nearestSight = -1;
+let previousPromptHTML = '';
+function setPromptHTML(html) {
+  if (html === previousPromptHTML) return;
+  previousPromptHTML = html;
+  promptEl.innerHTML = html;
+}
@@
-    promptEl.innerHTML = `<kbd>E</kbd> ${storyUI.promptFor(s.id) ?? `${s.icon} ${s.name}`}`;
+    setPromptHTML(`<kbd>E</kbd> ${storyUI.promptFor(s.id) ?? `${s.icon} ${s.name}`}`);
@@
-    promptEl.innerHTML = `<kbd>E</kbd> ✦ 查看纪念铭牌`;
+    setPromptHTML(`<kbd>E</kbd> ✦ 查看纪念铭牌`);
```

The guard is safe for the current static, trusted strings; if future modules supply user text, construct the kbd once and use `textContent` for the message instead of HTML.

### 4. Objective/toast changes are silent to assistive technology; motion preferences are ignored

**Locations:** `src/date_story_ui.js:18`–`:25`, `src/anime_main.js:645`–`:650`, `index.html:86`, `:107`, `:144`, `:173`. Repro: progress an objective or toggle sound and inspect the live-region ancestry; emulate reduced motion and open the information panel. JS petals and marker/panel motion continue. Live-region attributes must be present **before** updating the text.

```diff
--- a/project/src/date_story_ui.js
+++ b/project/src/date_story_ui.js
@@
   root.id = 'date-story-root';
+  root.setAttribute('role', 'status');
+  root.setAttribute('aria-live', 'polite');
+  root.setAttribute('aria-atomic', 'true');
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
       toastEl = document.createElement('div');
+      toastEl.setAttribute('role', 'status');
+      toastEl.setAttribute('aria-live', 'polite');
+      toastEl.setAttribute('aria-atomic', 'true');
--- a/project/index.html
+++ b/project/index.html
@@
 </style>
+<style>
+@media (prefers-reduced-motion: reduce) {
+  #hud, #hud *, #panel, #days-popup, #photo-overlay, #photo-overlay *,
+  #date-story-root *, #date-photo-root * {
+    animation: none !important;
+    transition: none !important;
+  }
+}
+</style>
```

The GPU petal patch above handles one WebGL motion source. Gate marker bob/scale (`anime_main.js:746`–`:750`) and optional cinematic camera movement too; essential movement remains available. Do not announce decorative per-frame changes or a continuously updating compass.

### 5. Touch targets, contrast and enlarged HUD layout need integration fixes

**Locations:** `index.html:121`–`:132`, `:159`–`:165`, `:184`–`:197`, `:213`–`:224`; `src/date_audio.js:358`–`:363`. Repro: `420×800?touch=1`, open info/plaque/photo, then apply 150% CSS zoom. The audit below contains exact measured rectangles, intersections and computed contrast estimates. Text over transparent canvas backgrounds needs visual confirmation under both dark and bright scenery.

```diff
--- a/project/index.html
+++ b/project/index.html
@@
 </style>
+<style>
+#panel-close, #days-popup-close, #photo-btn, #date-audio-root button {
+  min-width: 44px; min-height: 44px;
+}
+#panel-close, #panel-source { color: #E8DFC0; }
+#photo-hint { color: #F5D878; background: #0C091C; padding: 4px 8px; }
+#panel, #days-popup { max-height: calc(100dvh - 24px); overflow: auto; }
+@media (max-width: 700px) {
+  #hud { display: grid; grid-template-columns: minmax(0,1fr) 44px;
+    grid-auto-rows: min-content; gap: 8px; padding: 64px 12px 12px; }
+  #status-panel, #days-counter, #date-story-root, #compass-wrap {
+    position: static; transform: none; min-width: 0; max-width: 100% !important;
+  }
+  #days-counter { grid-column: 1; grid-row: 1; white-space: normal; }
+  #compass-wrap { grid-column: 2; grid-row: 1; }
+  #status-panel { grid-column: 1 / -1; grid-row: 2; }
+  #date-story-root { grid-column: 1 / -1; grid-row: 3; }
+  #date-audio-root { top: 8px !important; }
+}
+@media (max-width: 480px) {
+  .di-actions { grid-template-columns: 76px; }
+  .di-movement, .di-joystick { width: 120px; }
+  .di-joystick { height: 120px; }
+}
+</style>
```

This is a proposed baseline layout, not a guaranteed post-integration solution: account for the new minimap, collectibles, title UI and expanded story panels. Retest 420×800 and 150% after merging all HUD owners. Touch controls in `date_input.css` already use 56px buttons and visible focus outlines.

## Remaining rendering and lifecycle review

- **Outline overhead** — `anime_main.js:116`–`:127`: each `ol()` allocates its own ShaderMaterial and child mesh, even with identical thickness. Shader program reuse does not eliminate draw calls. The census quantifies hull count below. Batch outlines for static scenery by thickness using Three's same-version `BufferGeometryUtils.mergeGeometries`, applying each source mesh's matrixWorld, then render one mesh per thickness. Use `engine.THREE`/same CDN revision; do not combine a second Three version. Keep animated/skinned character hulls separate. A screen-space normal/depth edge pass is an alternative, with a different visual style and fullscreen cost; measure both. A safe partial patch shares outline materials by thickness, reducing material allocation but **not** calls:

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-function ol(mesh, thick=0.055) {
-  const m = new THREE.ShaderMaterial({ side:THREE.BackSide,
-    uniforms:{ t:{value:thick} },
-    vertexShader:_outlineVert, fragmentShader:_outlineFrag });
+const outlineMaterials = new Map();
+function ol(mesh, thick=0.055) {
+  let m = outlineMaterials.get(thick);
+  if (!m) {
+    m = new THREE.ShaderMaterial({ side:THREE.BackSide,
+      uniforms:{ t:{value:thick} },
+      vertexShader:_outlineVert, fragmentShader:_outlineFrag });
+    outlineMaterials.set(thick, m);
+  }
```

- **Shadow map vs frustum** — `anime_main.js:539`–`:544`: a 2048² shadow map covers 260×120 world units, about 0.127×0.059 units/texel. Reducing to 1024² quarters texels but halves linear detail; do not recommend it without measuring acne/peter-panning and character feet. First derive tight light-space bounds for actual shadow receivers/casters near the current player, add margin, snap to texels to prevent shimmer, and call `sun.shadow.camera.updateProjectionMatrix()`. Static-map freezing would lose moving cast shadows, so do not set `shadowMap.autoUpdate=false` globally while characters move. Exclude giant ground/plaza planes from **casting** (still receive shadows), since they do not meaningfully shadow themselves:

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-box([0,-0.15,0],[600,0.3,600], mat.plaza, true, false);
+const ground = box([0,-0.15,0],[600,0.3,600], mat.plaza, true, false);
+ground.castShadow = false;
@@
-box([0,0,D.plD*.5], [D.plW, 0.06, D.plD], mat.plaza, true, false);
+const plaza = box([0,0,D.plD*.5], [D.plW, 0.06, D.plD], mat.plaza, true, false);
+plaza.castShadow = false;
```

- **Bloom/DPR** — `anime_main.js:43`, `:56`–`:60`: DPR cap is already **2**, not uncapped. That is up to 4× pixels versus DPR 1; UnrealBloomPass r160 already creates half-resolution bright and mip-chain targets internally. Do not describe it as full-resolution blur. Its bright extraction/composite and the composer still scale with drawing-buffer size. Cap DPR at 1.5 for the balanced tier; use 1.0/bloom disabled only as an explicit low tier after visual QA. Call `composer.setPixelRatio()` when DPR changes, not just renderer.setPixelRatio. Proposed resize-safe balanced tier:

```diff
--- a/project/src/anime_main.js
+++ b/project/src/anime_main.js
@@
-renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
+const renderDpr = () => Math.min(devicePixelRatio, 1.5);
+renderer.setPixelRatio(renderDpr());
@@
 addEventListener('resize', () => {
   camera.aspect = innerWidth / innerHeight;
   camera.updateProjectionMatrix();
+  renderer.setPixelRatio(renderDpr());
+  composer.setPixelRatio(renderDpr());
   renderer.setSize(innerWidth, innerHeight);
   composer.setSize(innerWidth, innerHeight);
 });
```

`composer.setSize` is **already present** at line 714. Existing resize is not a missing-composer-size bug. The addition above handles DPR changes (e.g. moving between displays) and a lower cap.

- **Lifecycle** — entry listeners at `anime_main.js:572`–`:608`, `:689`, `:710` have no removal; the RAF has no cancellation/dispose. Normal full navigation releases them, so this is not evidence of a leak in the current single-entry page. If restart re-creates the engine instead of resetting story state, use an AbortController signal for all entry listeners, store/cancel the RAF id, clear the toast timeout, and dispose geometries/materials/textures, composer passes, renderer and modules. Story UI line 25 discards `story.subscribe`'s unsubscribe and has no dispose. Photo line 49 installs an onclick with no dispose. Cast creates two capsule geometries/materials and has no dispose. Add explicit disposal to their contract before hot reinitialization. Audio already disconnects/stops nodes, removes gesture listeners, unsubscribes and closes its context in `dispose()` (`date_audio.js:389`–`:412`); input removes its listener list/root/styles and disposes previous instances (`date_input.js:12`, `:363`–`:372`). Do not call these modules leaky merely because they install listeners.
- **Small allocation pressure** — `date_input.js:322`–`:336` allocates `Set`, arrays and button-state arrays during gamepad polling even without meaningful state changes. This is bounded garbage, not proven retained growth. Skip polling when there are no connected gamepads and reuse scratch state if profiling identifies it. `date_audio.js` schedules bounded transient nodes and disconnects them on ended; keep lifecycle tests after merging.

## Tool validation and interpretation

- All three `.mjs` files pass `node --check`; both CLIs show help without launching Chrome and reject malformed thresholds/severity with exit 2.
- The CDP transport was exercised against the actual scene, including rejecting an invalid protocol command and closing its owned browser/profile.
- A raw default `renderer.info.render.calls` read returned **1** (the last output pass), confirming why whole-composer reset/aggregation is necessary.
- A deliberate `--max-calls 1 --views facade --stages meet --frames 10 --warmup-frames 10` run exited **1** with the observed 146 calls, verifying threshold enforcement.
- The complete a11y run with `--fail-on high` exits **1** as expected: 30 settled snapshots, 28 consolidated findings (6 high, 21 medium, 1 manual review), no runtime errors, and successful E/P/Escape panel checks in all tested stages/viewports.
- The proposed GPU-petal replacement was compiled/rendered in a temporary live scene using the existing Three.js instance: **680 instances**, 680 colors/seeds, `MeshToonMaterial`, bounding radius 150, and **no browser diagnostics**. The generated unified diff also passes `git apply --check` against the audited base. It was not written into the application. Visual style and hardware speedups remain unmeasured.
- Contrast, geometric overlap, and camera-handler checks are explicitly approximate. Invisible panels were also tested with native Tab. Finite animations are allowed to settle before DOM snapshots; reduced-motion transitions are sampled immediately after opening, so motion evidence is not lost by waiting for it to finish.

## Actual tool output

The complete measured tables follow. Raw JSON includes frame counters, per-view census, heap samples, DOM rectangles, exact handler sources and all state occurrences. The reports intentionally preserve warnings and failed checks instead of calling the build accessible.

### Accessibility stdout (complete)

Command: `node project/tools/a11y_audit.mjs http://localhost:8114 --fail-on high` (exit 1, expected findings).

# LMU accessibility audit

2026-11-09T09:49:11.818Z; http://localhost:8114

Live DOM: desktop 1280×720 and touch 420×800 with ?touch=1; stages meet,photos,done; spawn, info, plaque, photo, toast and CSS zoom 150%.

**Heuristic audit, not certification.** Contrast composites computed rgba ancestors over an assumed dark scene (10,8,24); JSON also records a bright-scene estimate. Canvas, gradients, shadows, overlap and backdrop blur require visual confirmation. All text uses the requested 4.5:1 threshold, including large text. CSS zoom tests layout reflow; native page pinch zoom is not used. Native Tab is checked; source inspection is supplementary and cannot prove route completion.

30 snapshots; 606 text samples; 28 distinct findings (176 state occurrences).

| Severity | Check | Target | States | Evidence | Suggested fix |
|---|---|---|---|---|---|
| high | Hidden keyboard target | #panel-close | desktop/meet/spawn, desktop/meet/plaque, desktop/meet/photo, desktop/meet/150%-zoom, desktop/photos/spawn, desktop/photos/plaque, desktop/photos/photo, desktop/photos/150%-zoom, desktop/done/spawn, desktop/done/plaque, desktop/done/photo, desktop/done/150%-zoom, touch/meet/spawn, touch/meet/plaque, touch/meet/photo, touch/meet/150%-zoom, touch/photos/spawn, touch/photos/plaque, touch/photos/photo, touch/photos/150%-zoom, touch/done/spawn, touch/done/plaque, touch/done/photo, touch/done/150%-zoom | Offscreen element remains in the tab order | Use hidden/inert on closed panels; remove only while opening. |
| medium | Contrast | #sakura-info | desktop/meet/spawn, desktop/meet/info, desktop/meet/plaque, desktop/meet/150%-zoom, desktop/photos/spawn, desktop/photos/info, desktop/photos/plaque, desktop/photos/150%-zoom, desktop/done/spawn, desktop/done/info, desktop/done/plaque, desktop/done/150%-zoom | 4.05:1; “✿ 樱花飘落中” | Use opaque text and a darker/opaque backing panel; target at least 4.5:1. |
| high | Objective announcements | #date-story-root | desktop/meet/spawn, desktop/meet/info, desktop/meet/plaque, desktop/meet/photo, desktop/meet/150%-zoom, desktop/photos/spawn, desktop/photos/info, desktop/photos/plaque, desktop/photos/photo, desktop/photos/150%-zoom, desktop/done/spawn, desktop/done/info, desktop/done/plaque, desktop/done/photo, desktop/done/150%-zoom, touch/meet/spawn, touch/meet/info, touch/meet/plaque, touch/meet/photo, touch/meet/150%-zoom, touch/photos/spawn, touch/photos/info, touch/photos/plaque, touch/photos/photo, touch/photos/150%-zoom, touch/done/spawn, touch/done/info, touch/done/plaque, touch/done/photo, touch/done/150%-zoom | Changing objective lacks aria-live: “✦ 去主楼入口和 TA 见面”; Changing objective lacks aria-live: “✦ 拍三张照片：主楼 · 喷泉 · 合影（0/3）”; Changing objective lacks aria-live: “✦ 今天的约会完成了 ♡” | Set role="status" aria-live="polite" aria-atomic="true" before updates. |
| high | Hidden keyboard target | #panel-close | desktop/meet/Tab, desktop/photos/Tab, desktop/done/Tab, touch/meet/Tab, touch/photos/Tab, touch/done/Tab | Native Tab focused an invisible/offscreen control “✕” | Toggle hidden or inert on closed panels, and restore focus to the invoking control. |
| high | Hidden keyboard target | #days-popup-close | desktop/meet/Tab, desktop/photos/Tab, desktop/done/Tab, touch/meet/Tab, touch/photos/Tab, touch/done/Tab | Native Tab focused an invisible/offscreen control “关闭 ♡” | Toggle hidden or inert on closed panels, and restore focus to the invoking control. |
| medium | Control purpose | #panel-close | desktop/meet/info, desktop/photos/info, desktop/done/info, touch/meet/info, touch/photos/info, touch/done/info | Name is only “✕” | Use aria-label="关闭信息面板". |
| medium | Contrast | #panel-close | desktop/meet/info, desktop/photos/info, desktop/done/info, touch/meet/info, touch/photos/info, touch/done/info | 4.27:1; “✕” (blended dark-panel estimate) | Use opaque text and a darker/opaque backing panel; target at least 4.5:1. |
| medium | Contrast | #panel-icon | desktop/meet/info, desktop/photos/info, desktop/done/info, touch/meet/info, touch/photos/info, touch/done/info | 1.07:1; “✉” (blended dark-panel estimate) | Use opaque text and a darker/opaque backing panel; target at least 4.5:1. |
| medium | Contrast | #panel-source | desktop/meet/info, desktop/photos/info, desktop/done/info, touch/meet/info, touch/photos/info, touch/done/info | 3.67:1; “来源：de.wikipedia.org/wiki/Weiße_Rose” (blended dark-panel estimate) | Use opaque text and a darker/opaque backing panel; target at least 4.5:1. |
| medium | HUD overlap | #prompt ↔ #panel | desktop/meet/info, desktop/photos/info, desktop/done/info, touch/meet/info, touch/photos/info, touch/done/info | 265.4 × 40.0 CSS px intersection; 210.0 × 59.0 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| high | Toast announcements | engine.toast | desktop/meet, desktop/photos, desktop/done, touch/meet, touch/photos, touch/done | Toast appears without an aria-live/status ancestor | Create role="status" aria-live="polite" aria-atomic="true" before setting toast text. |
| high | Keyboard camera | #status-panel | desktop/meet, desktop/photos, desktop/done, touch/meet, touch/photos, touch/done | Hints require mouse drag/wheel; registered key handlers contain no yaw/pitch/zoom assignment | Add Q/R yaw, PageUp/PageDown pitch and +/- zoom bindings; document them in status hints. |
| medium | Reduced CSS motion | #panel | desktop, touch | 1 CSS animation(s)/transition(s) still running: transform | Under prefers-reduced-motion:reduce, disable decorative animation and transition on the HUD. |
| medium | Reduced WebGL motion | sakura InstancedMesh | desktop, touch | Petal transform still changes across two rAFs while reduce matches | Read the media query in the render loop; pause decorative petals, pulses and optional camera motion. |
| medium | Touch target | #date-audio-root > button | touch/meet/spawn, touch/meet/info, touch/meet/plaque, touch/meet/photo, touch/photos/spawn, touch/photos/info, touch/photos/plaque, touch/photos/photo, touch/done/spawn, touch/done/info, touch/done/plaque, touch/done/photo | 131.4 × 32.8 CSS px; 106.5 × 32.8 CSS px | Set min-width and min-height to 44px; retain spacing around controls. |
| medium | HUD overlap | #days-counter ↔ #date-audio-root | touch/meet/spawn, touch/photos/spawn, touch/done/spawn | 7.5 × 30.8 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | Touch target | #panel-close | touch/meet/info, touch/photos/info, touch/done/info | 16.8 × 26.0 CSS px | Set min-width and min-height to 44px; retain spacing around controls. |
| medium | HUD overlap | #prompt ↔ #date-input-root > button.di-hud-toggle | touch/meet/info, touch/photos/info, touch/done/info | 13.2 × 33.0 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | HUD overlap | #prompt ↔ #date-input-root > div.di-movement | touch/meet/info, touch/meet/plaque, touch/photos/info, touch/photos/plaque, touch/done/info, touch/done/plaque | 57.0 × 13.4 CSS px intersection; 42.8 × 13.4 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | HUD overlap | #panel ↔ #date-input-root > button.di-hud-toggle | touch/meet/info, touch/photos/info, touch/done/info | 93.0 × 56.0 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | HUD overlap | #panel ↔ #date-input-root > div.di-movement | touch/meet/info, touch/photos/info, touch/done/info | 136.8 × 165.4 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | HUD overlap | #panel ↔ #date-input-root > div.di-actions | touch/meet/info, touch/photos/info, touch/done/info | 154.8 × 122.0 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | Touch target | #days-popup-close | touch/meet/plaque, touch/photos/plaque, touch/done/plaque | 103.6 × 39.0 CSS px | Set min-width and min-height to 44px; retain spacing around controls. |
| medium | Touch target | #photo-btn | touch/meet/photo, touch/photos/photo, touch/done/photo | 87.4 × 43.0 CSS px | Set min-width and min-height to 44px; retain spacing around controls. |
| medium | HUD overlap | #photo-btn ↔ #date-input-root > div.di-actions | touch/meet/photo, touch/photos/photo, touch/done/photo | 87.4 × 43.0 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | 150% overlap | #days-counter ↔ #date-audio-root | touch/meet/150%-zoom, touch/photos/150%-zoom, touch/done/150%-zoom | 77.4 × 45.2 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| medium | 150% overlap | #date-input-root > div.di-movement ↔ #date-input-root > div.di-actions | touch/meet/150%-zoom, touch/photos/150%-zoom, touch/done/150%-zoom | 93.0 × 183.0 CSS px intersection | Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels. |
| review | Keyboard completion | chapter route | all | E, P and Escape were exercised; name/Tab/source checks do not prove every branching dialogue, photo framing or final restart can be completed. | After integration, complete meet → dialogue choices → memento → three framed photos → postcard → restart using only keyboard; verify modal focus/return. |

## Motion measurements

```json
[
  {
    "device": "desktop",
    "media": "no-preference",
    "matches": false,
    "animations": [
      {
        "name": "transform",
        "target": "panel"
      },
      {
        "name": "opacity",
        "target": ""
      }
    ]
  },
  {
    "device": "desktop",
    "media": "reduce",
    "matches": true,
    "animations": [
      {
        "name": "transform",
        "target": "panel"
      }
    ]
  },
  {
    "device": "touch",
    "media": "no-preference",
    "matches": false,
    "animations": [
      {
        "name": "transform",
        "target": "panel"
      },
      {
        "name": "opacity",
        "target": ""
      }
    ]
  },
  {
    "device": "touch",
    "media": "reduce",
    "matches": true,
    "animations": [
      {
        "name": "transform",
        "target": "panel"
      }
    ]
  }
]
```

## Keyboard handler evidence

6 key listeners captured before module initialization; handler and same-origin module source stored in JSON.

## Browser diagnostics

No console errors or exceptions.


### Performance stdout (complete)

Command: `node project/tools/perf_profile.mjs http://localhost:8114 --max-calls 400 --max-tris 2000000` (exit 0).

# LMU performance profile

2026-11-09T09:50:51.153Z; http://localhost:8114

**SwiftShader software GL** at 1280x720, DPR 1. Compare relative changes on the same machine; these timings do not predict hardware FPS.

Counters include scene, shadows and all composer passes (info.autoReset=false; reset once per composer.render). Triangles therefore count repeated work. Timings cover 180 rAF intervals after 30 warmup frames. Long tasks cover that frame window only; submit time is CPU submission, not GPU time.

| Stage | View | Frame avg / p95 ms | Calls avg / peak | Triangles peak | Geom / tex / programs | Heap MiB | Heap gross / retained MiB/min | DOM nodes | Long tasks count / ms | Δ root children 5s |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| meet | spawn | 65.28 / 83.4 | 221 / 221 | 30780 | 108 / 16 / 20 | 5.79 | 5.71 / 0.65 | 206 | 0 / 0 | 0 |
| meet | facade | 69.44 / 83.4 | 146 / 146 | 27652 | 109 / 16 / 20 | 5.67 | 4.89 / 0.61 | 206 | 0 / 0 | 0 |
| meet | fountain | 69.44 / 83.4 | 135 / 135 | 27226 | 112 / 16 / 20 | 5.74 | 5.07 / 0.52 | 209 | 0 / 0 | 0 |
| meet | plaza | 53.33 / 66.7 | 81 / 81 | 25350 | 108 / 16 / 20 | 5.77 | 5.22 / 0.54 | 209 | 0 / 0 | 0 |
| meet | photo | 68.52 / 83.4 | 146 / 146 | 27652 | 104 / 16 / 20 | 5.9 | 5.8 / 0.56 | 206 | 0 / 0 | 0 |
| photos | spawn | 67.4 / 83.4 | 220 / 220 | 30372 | 108 / 16 / 20 | 9.96 | 5.03 / 0.55 | 206 | 0 / 0 | 0 |
| photos | facade | 68.05 / 83.3 | 146 / 146 | 27652 | 108 / 16 / 20 | 9.8 | 3.99 / 0.53 | 206 | 0 / 0 | 0 |
| photos | fountain | 69.26 / 83.3 | 136 / 136 | 27634 | 113 / 16 / 20 | 9.4 | 1.55 / 0.52 | 209 | 0 / 0 | 0 |
| photos | plaza | 62.13 / 83.4 | 81 / 81 | 25350 | 107 / 16 / 20 | 10.02 | 5.39 / 0.5 | 209 | 0 / 0 | 0 |
| photos | photo | 71.2 / 83.4 | 146 / 146 | 27652 | 108 / 16 / 20 | 9.56 | 2.36 / 0.51 | 206 | 0 / 0 | 0 |
| done | spawn | 106.76 / 200.1 | 220 / 220 | 30372 | 108 / 16 / 20 | 13.57 | 1.35 / 0.55 | 206 | 0 / 0 | 0 |
| done | facade | 86.39 / 133.4 | 146 / 146 | 27652 | 107 / 16 / 20 | 13.7 | 2.08 / 0.51 | 206 | 0 / 0 | 0 |
| done | fountain | 74.9 / 100 | 136 / 136 | 27634 | 113 / 16 / 20 | 14.18 | 4.9 / 0.52 | 209 | 0 / 0 | 0 |
| done | plaza | 62.96 / 83.4 | 81 / 81 | 25350 | 107 / 16 / 20 | 13.67 | 1.92 / 0.52 | 209 | 0 / 0 | 0 |
| done | photo | 85.74 / 150.1 | 146 / 146 | 27652 | 107 / 16 / 20 | 13.97 | 3.43 / 0.51 | 206 | 0 / 0 | 0 |

Heap gross = net growth during 10000 ms after forced GC; retained = post-GC growth over the same window. Neither is a count of all allocations; natural GC may lower gross. Census and raw frame/heap samples are in JSON. Child checks sample scene.children each rAF for at least 5 s; nested churn is not counted.

## Scene census (first view; all views in JSON)

```json
{
  "objects": 195,
  "rootChildren": 142,
  "meshes": 185,
  "materialTypes": {
    "ShaderMaterial": 53,
    "MeshToonMaterial": 132
  },
  "castShadowMeshes": 58,
  "instancedMeshes": 9,
  "instances": 1074,
  "expandedVertices": 27864,
  "uniqueVertices": 6156,
  "uniqueGeometries": 126,
  "invertedHullCandidates": 52
}
```

## Threshold failures

None (only explicitly supplied thresholds are enforced).

## Browser diagnostics

No console errors or exceptions.


### Isolated timing repeat stdout (complete)

Command: `node project/tools/perf_profile.mjs http://localhost:8114 --views spawn --stages done --max-calls 400 --max-tris 2000000 --out /tmp/lmu_perf_repeat.json --md /tmp/lmu_perf_repeat.md` (exit 0).

# LMU performance profile

2026-11-09T09:58:47.818Z; http://localhost:8114

**SwiftShader software GL** at 1280x720, DPR 1. Compare relative changes on the same machine; these timings do not predict hardware FPS.

Counters include scene, shadows and all composer passes (info.autoReset=false; reset once per composer.render). Triangles therefore count repeated work. Timings cover 180 rAF intervals after 30 warmup frames. Long tasks cover that frame window only; submit time is CPU submission, not GPU time.

| Stage | View | Frame avg / p95 ms | Calls avg / peak | Triangles peak | Geom / tex / programs | Heap MiB | Heap gross / retained MiB/min | DOM nodes | Long tasks count / ms | Δ root children 5s |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| done | spawn | 75.83 / 133.3 | 220 / 220 | 30372 | 108 / 16 / 20 | 5.19 | 2.16 / 0.63 | 206 | 0 / 0 | 0 |

Heap gross = net growth during 10000 ms after forced GC; retained = post-GC growth over the same window. Neither is a count of all allocations; natural GC may lower gross. Census and raw frame/heap samples are in JSON. Child checks sample scene.children each rAF for at least 5 s; nested churn is not counted.

## Scene census (first view; all views in JSON)

```json
{
  "objects": 195,
  "rootChildren": 142,
  "meshes": 185,
  "materialTypes": {
    "ShaderMaterial": 53,
    "MeshToonMaterial": 132
  },
  "castShadowMeshes": 58,
  "instancedMeshes": 9,
  "instances": 1074,
  "expandedVertices": 27864,
  "uniqueVertices": 6156,
  "uniqueGeometries": 126,
  "invertedHullCandidates": 52
}
```

## Threshold failures

None (only explicitly supplied thresholds are enforced).

## Browser diagnostics

No console errors or exceptions.

