# Chapter 2 — 风经过英国公园

`project/park.html` is a standalone anime-style English Garden walk. It loads
`src/park_main.js` using the same Three.js r160 CDN import map as the LMU entry;
there is no build step, npm dependency, or change to Chapter 1.

## Integrator handoff

Add a title-screen button **「第二章 · 英国公园散步」** that navigates to
`./park.html` (for example, `location.href = './park.html'`). No engine wiring is
needed in `anime_main.js`. Both the always-visible **「← 回到 LMU」** link and the
five-stop completion link navigate to `./index.html`.

This change only adds `park.html`, `park.css`, `park_main.js`, `park_layout.mjs`,
`park_scene.js`, `tests/park_layout.test.mjs`, and this document. Existing date
modules and legacy park files are imported/read without modification.

## What was ported

- **Terrain:** imports the original pure `parkHeight()` from `park_terrain.mjs`.
  The Monopteros mound keeps its original 3.4 m plateau. Small meadow undulations
  fade to level ground at the stream. One continuous mesh and `heightAt()` drive
  the scene, player ground anchor, camera, and companion.
- **Coordinate system:** legacy north/east `(x, z)` becomes date east/south
  `(z, -x)`. Thus the old temple `(17, 113)` is now `(113, -17)`, and the Chinese
  Tower `(-25, 115)` is `(115, 25)`. Both helpers and all bounds, sights, trees,
  columns, bridges, and stream functions live in `park_layout.mjs`.
- **Stream and bridges:** preserves the legacy sinusoidal bend and width profile
  from `our_world.js` / `garden_detail.js` / `river_drift.js`, rotated to the new
  axes. There is one shared curve for water, banks, paths, ripples, reeds, ducks,
  sound proximity, and water collision. Two wooden bridges sit at `x=75, 101`.
  Their open ends meet height-aware ramps; their side rails collide.
- **Landmarks:** ten-column Monopteros, copper dome and ribs, five-tier Chinese
  Tower, a lantern-lit beer garden with tables, benches, picnic cloths, and a
  stylized western Munich skyline with Frauenkirche and Theatinerkirche shapes.
- **Nature:** deterministic instanced trunks/crowns, flowers and reeds, floating
  sakura petals, moving ripple lines, swimming ducks and dusk fireflies.
  Picnic cloth colors use an independent index, resolving legacy L10.

The visuals are reauthored as cel-shaded geometry and inverted-hull ink outlines,
not copied realistic materials. Renderer exposure is `1.0`; bloom strength is
`0.35`, threshold `0.9`. The sky uses a gradient shader. Shadows, fog, a smooth
spring arm, terrain clearance and tree/roof camera collision keep the world
readable. Characters are simple procedural stand-ins, with collision-aware
following and a walkable recovery point after a debug teleport or separation.

## Shared modules and engine

The entry exposes the `DATE_CONTRACT.md` engine surface, including capture,
movement locks, a companion, camera override, and a terrain-aware player.
`isPhotoMode()` starts false and tracks the local P overlay. `audio` starts null,
then receives `createAudio()`.

It wires `date_audio.js`, `date_input.js`, `date_banter.js`, and
`date_cinematic.js` against a minimal, nonpersistent story stub:

```js
{ getState: () => ({ stage: 'park' }), subscribe: () => () => {}, dispatch() {} }
```

Only C free camera is invoked; there are no Chapter 1 story tours. Park dialogue
is scheduled through the existing banter queue, with a pending park line keeping
campus-specific ambient triggers out of this standalone chapter. The shared
procedural audio uses stream samples as its proximity sources. Real user input
unlocks Web Audio; synthesized QA key events do not bypass autoplay rules.

## Play and controls

Visit five locations, in any order, then press **E** at each marker:

| Stop | World `(x, z)` | Experience |
| --- | --- | --- |
| Monopteros | `(103, -17)` | Hill and temple approach |
| Eisbach-inspired wave | `(61, 13.5)` | A fictional standing wave, seen from shore |
| Chinese Tower | `(109, 25)` | Beer garden and lanterns |
| Stream bend | `(89, 1)` | Ducks, reeds and drifting water |
| Our bench | `(98, -1)` | A quiet personal ending |

The objective list shows distance and visited status. E opens an information
panel and records a visit exactly once; E, Enter, Escape or its buttons close
it. Completing all five shows a toast and a return link. Panels lock movement
and keep keyboard focus inside the panel.

- **WASD / arrows:** walk; **Shift:** run. At yaw zero W moves north (`−Z`);
  after orbiting it follows `−(sin(yaw), cos(yaw))`.
- **Drag / wheel:** orbit and zoom. The camera stays above terrain and shortens
  at tree crowns and landmark roofs. Characters very close to the camera hide
  instead of filling the entire screen.
- **P:** photo overlay; **Space:** download the composited PNG; **P / Escape:**
  close. Photos are intentionally unvalidated, contain no HTML HUD, and do not
  affect objective completion.
- **C:** shared free camera; WASD fly, Q/E descend/ascend, Shift accelerates,
  drag looks around, wheel changes speed. C or Escape returns smoothly.
- **M:** shared audio mute. The dusk button fades between afternoon and evening,
  revealing fireflies. Touch/gamepad movement and photo actions use the shared
  input adapter; mobile HUD links sit above its look surface.

## Debug and verification

Serve only on the assigned port:

```sh
cd project
python3 -m http.server 8116
```

Optional parameters: `?pos=103,-17`, `?dusk=1`, `?touch=1`. Invalid, nonfinite,
out-of-bounds, or blocked spawn coordinates fall back to the default `(65,-1.5)`.
`window.__park` exposes the engine, modules, layout functions/constants, visited
set, `teleport(x,z,yaw)`, `setView({x,z,yaw,pitch,distance})`, and `setDusk(bool)`.
Use `engine.cameraOverride` for a fixed scenic shot. Debug helpers do not write
Chapter 1 saves.

```sh
node --test project/tests/park_*.test.mjs
node project/tools/shot.mjs "http://localhost:8116/park.html" \
  --out /tmp/lmu_park_spawn.png --wait 6000 \
  --eval "({ready:!!window.__park,position:__park.engine.player.pos.toArray()})"
```

Five Node tests pass: axis conversion/inversion; the preserved hill and world
bounds; water/deck/ramp rules; tree/column/tower collision; and reachability of
all five stops plus the open temple interior on a 2 m grid. Flood edges are
sampled every 0.2 m so the search cannot jump a thin rail or stream.

Headless browser verification passed with no console errors: camera-relative
movement at yaw 0 and π/2; all five actual E interactions; panel lock/unlock;
completion and return link; P/Space PNG download; C free-camera entry/return;
and 390 px touch HUD return/audio hit testing. The shot tool confirmed a PNG in
its temporary download directory, then removed its own temporary profile.

Visually inspected screenshots are under `/tmp/`:

- `lmu_park_spawn.png`
- `lmu_park_bridge.png`
- `lmu_park_monopteros.png` (from below)
- `lmu_park_beer_garden.png`
- `lmu_park_hill.png` (fixed scenic camera from the hill toward Munich)
- `lmu_park_dusk.png`
- `lmu_park_completed.png`
- `lmu_park_mobile.png`

## Deliberate scope and limitations

The park is a compressed, fictional walking scene, not a navigational map or a
claim about current Eisbach surfing access. Progress lasts for this page visit;
no park save schema is introduced. The shared audio mute preference remains the
only persistent setting used here.

Legacy `main.js`, `our_world.js` and their DOM/controllers are not loaded. Missing
letters/wishes data, cottage interactions, vehicles, river rafting, Water.js
reflection passes, GLTF ferns, photographic ground textures, the old map, and
invisible legacy flow-line updates were intentionally dropped. Those systems
would need separate adaptation, not an extra import into this entry.

The placeholder companion does not have a pathfinder: it walks when the direct
route is clear and recovers to a checked walkable point if left far behind. Tree
trunks, temple columns, the tower, water and bridge rails collide; furniture is
decorative. The tree/roof spring-arm test is a center ray rather than a full
camera-volume sweep. CDN access is required on the first load, as in Chapter 1.
