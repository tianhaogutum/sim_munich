# City feature engine v1 — frozen 2026-11-09

Parent owns city_main.js, city.html, city_features.mjs, city_feature_host.mjs, and city_scene.js. Children own ONLY their assigned prefix module/CSS/test. Shared checkout; no git mutations, worktrees, servers, browsers or delegation. Preserve existing changes. Do not edit city_missions*, city_visibility*, city_navigator* or any other feature's files.

Each module exports `createFeature(engine)` (named export). Return optional `update(dt)`, `handleKey(key,event)` (true consumes), `isOpen()`, `dispose()`, and useful public methods. `dt` seconds, keys lower-case. No global keyboard listeners; host dispatches and isolates modals. Own and clean listeners, DOM, geometries, materials. Use textContent for external text. No package installation. JS modules should be .mjs; THREE injected, no static bare-three import, so pure tests work in node.

## Engine (available at factory call, after map load)

- `map`: MapLibre instance; `THREE`: imported Three.js; `cast`: {scene,heroine,companion,...}; `player`: live {lon,lat,yaw}; `motion`: live {speed,heading}.
- `document`, `window`, `storage` (localStorage, may throw), `ui` (feature HUD root).
- `places`, `trails`, `research`: compiled catalogs.
- `getState()`: {ready,follow,paused,sourceReady,buildings,discovered,walked,progress,lastError}; `travel(placeOrId)`: Promise<boolean>; `setFollow(bool)`; `notify(text)`; `persist()`.
- `distance(a,b)`: metres, objects {lon,lat}; `cityToLocal(lon,lat)` => {x,z}, east +X south +Z; `localToCity(x,z)`.
- `createPanel(id,{title,key,modal=true})` => {root,body,button,open(),close(),toggle(),isOpen(),dispose()}. Adds toolbar button + managed modal. Put controls into body. Host closes other panels and clears movement. For contextual prompts, append element to `engine.ui`, position via own CSS (bottom centre, above movement controls). HUD slot guidelines below.
- `getSettings()` and `setSettings(patch)` shared live settings: {quality:'medium',sound:true,hints:true,moveSensitivity:1,cameraSensitivity:1,reducedMotion:false}. Host applies movement/camera multiplier and quality controls. `onSettings(fn)` returns unsubscribe. settings feature owns persistence and reset confirmation.
- `setInput({right,forward,run,lookX,lookY})` controller axes [-1,1]; look axes [-1,1]. Controls feature calls every update, host consumes once per frame; host owns WASD, arrows, Shift, F/G/P and keyboard event dispatch. `clearInput()` clears keyboard and external axes. `interact()` dispatches key 'e' to features; no direct simulated keyboard events. `isInputBlocked()` true when modal open or editable field focused. `closePanels()`.
- `addGeoObject({group,lon,lat,minZoom=13,maxDistance=6000,replaceBuildings=false})` => cleanup function. Host attaches THREE group to cast.scene, converts geographic anchor to player-relative metres using SAME Mercator scale/frame as cast each frame. Model axes +X east,+Y up,+Z south. Construct model around local (0,0,0), metre scale. Host handles visibility by map centre distance and minZoom. No per-feature renderer/custom GL context. replaceBuildings true: host suppresses only tile polygon(s) containing this anchor; collision stays intact. Do not hide broad radii. Child must dispose own geometries/materials after cleanup. Any dimensions inferred from images must be labelled approximate.
- `onDispose(fn)` host lifetime cleanup registration, returns unregister. `now()` performance milliseconds.

## Key ownership

Existing: WASD/arrows move, Shift run, F follow, G atlas, P screenshot (photo feature), Escape close panels/atlas, navigation/missions may reserve N/M elsewhere. New: L photo album; T atmosphere panel; E contextual interact (interactions/east choose by proximity; handle only when usable); O settings. Gamepad: standard left stick movement, right stick camera, A interact, B close modal, left stick press run; controls feature only. No hotkey for landmark layers.

Photo feature must expose `capture()` used by existing toolbar/P; album key L goes through handleKey or panel host. Capture map canvas after render/triggerRepaint, actual image, bounded persisted thumbnails, graceful quota/security failures and manual exports. No synthetic placeholders.

## HUD / runtime boundaries

Managed panel UI provided by host: right side desktop, bottom sheet mobile; one modal at a time; scrollable within viewport. Toolbar buttons in host feature toolbar, no edits to existing toolbar. Context interaction prompt bottom centre; runtime guard badge top centre. Atmosphere canvas overlay pointer-events:none. Controls own bottom-left move zone and bottom-right camera zone; parent hides legacy .ci-touch when controls active. Parent handles global mobile header/atlas/progress overlap in host CSS.

Atmosphere may traverse cast.scene lights to change intensity/color (retain originals and restore on dispose); settings quality and reducedMotion must affect precipitation. No realtime-weather claims.
Runtime guard uses map events and optional `engine.metrics` mutable {frameMs,collisionMs}; expose `shouldRefreshCollision(now)` / `shouldPersist(now)` if useful. Does not replace map style; retry failed source/style carefully; dispose map listeners. Host applies update throttle to real hot path, no tile prefetch.

Children deliver working JavaScript plus focused node tests, report export/API and exact minimum integration call. Parent performs integration. No child changes to shared entrypoints.
