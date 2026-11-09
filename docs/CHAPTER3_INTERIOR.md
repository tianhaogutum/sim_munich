# Chapter 3 — 光落下的地方 / Lichthof

Standalone entry: [`project/interior.html`](../project/interior.html) →
[`interior_main.js`](../project/src/interior_main.js). No build, package installation,
reference-photo folder, or legacy renderer is required. Three.js r160 and the same
fonts as the plaza load from their existing public CDNs.

## What was reused and redesigned

- Read-only import of `interior_rules.mjs`: floor selection, the 0 / 2.4 / 6 m levels,
  16 broad steps, 24 split steps, the landing plinth and column footprints. The new
  `interior_navigation.mjs` calls `floorHeight` and interpolates those same stair
  runs; swept moves preserve the legacy layer checks without camera-height jolts.
- A new `interior_scene.js` uses toon materials, procedural marble, instanced floor
  tiles, columns and balusters, inverted-hull outlines on the cast/focal pieces,
  and restrained bloom (exposure 1.0, threshold 0.9, strength 0.3). It does **not**
  import `lmu_interior.js` or `stair_hall.js` or copy their global lifecycle.
- Tall arcades, capitals, a gabled glass roof, ground-floor corridor doors, two
  visible upper arcade tiers, lanterns, white roses and leaflet reliefs. The
  memorial is explicitly an artistic tribute, not a reconstruction of the actual
  memorial layout. The little bench memory is fictional.
- One new engine/render loop with the `DATE_CONTRACT.md` API, plus `heightAt`.
  `date_audio.js`, `date_input.js`, `date_banter.js`, and `date_cinematic.js` are wired
  unchanged. The story stub has stage `interior`; the route uses local sightseeing
  points and no fountains. The separate `interior_cast.js` supplies replaceable
  toon stand-ins and a companion that follows the player's recorded legal path.
- Wall/column/slab raycasts shorten the normal 7.5 m spring camera. Wheel range is
  2.5–9 m. The exposed normal controller also supports upward orbit; C opens the
  shared free camera. Player movement uses camera-relative WASD/arrows and Shift.
- E opens a floor-aware sightseeing panel. Five visits fill the objective list,
  show a completion toast, and highlight the return link. P enters photo mode;
  Space or the shutter button downloads a composer-rendered PNG. There is no photo
  validation or album requirement. Panels and photo mode hold separate movement
  locks; Enter/E/Escape close the panel, and P/Escape exit photo mode.

## Linking it from the plaza

The integrator only needs a door action at the plaza entrance POI:

```js
// After the entrance's current story interaction, or as its explicit door choice:
location.href = './interior.html';
```

The interior always offers `← 回到广场` pointing to `./index.html`, and emphasizes
it after all five visits. It does not pass `?from=interior`, import the plaza entry,
or modify the plaza's story/localStorage. The integrator may later add explicit
spawn restoration on return if desired. None of the plaza-owned files was edited.

## Navigation and debug surface

`window.__interior` exposes `engine`, `world`, `story`, `cast`, `audio`, `input`,
`banter`, `cinematic`, `visited`, `sights`, `interact`, `closePanel`, `photo`, and
`cameraRig`. Engine `blocked(x, z, y = player.pos.y)` and
`heightAt(x, z, y = player.pos.y)` accept an optional source height; omitted height
uses the player's current layer. The pure exports default to ground height.
The query `?pos=x,z` chooses a valid floor at that point and falls back to spawn
for invalid/blocked coordinates. Where ground and gallery overlap, it chooses the
lowest valid layer. To inspect the gallery, set all three position coordinates:

```js
__interior.engine.player.pos.set(9.9, 6, -1);
__interior.cameraRig.set({ yaw: -Math.PI / 2, pitch: 0.25, distance: 7 });
```

Upper walkways are at 6 m. Their inward edges, stair sides, landing back edge,
columns, bench, and memorial stone use level-aware AABBs. The legacy plinth
footprint is represented by a visible sculpture. Stair sides cannot be entered
laterally; both branch ends join the landing and rear gallery. Every move is swept
in segments no longer than 0.07 m, including Shift movement. Open atrium space is
not a walkable upper floor.

## Verification

Use the task's dedicated port only:

```sh
cd project
python3 -m http.server 8118
# From the repository root in another terminal:
node --test project/tests/interior_*.test.mjs
node --test project/tests/*.test.mjs
node project/tools/shot.mjs 'http://localhost:8118/interior.html' \
  --out /tmp/lmu_interior_entrance.png --wait 6000 \
  --eval '({loaded:!!window.__interior,position:__interior.engine.player.pos})'
```

Verified in headless Chrome:

- All 50 repository tests pass, including eight interior navigation tests. A BFS
  over a 0.5 m grid carries height in each node and sweeps each edge through the
  real controller: ground, landing, both branch ends, both galleries, all five
  sights, reverse transitions, rail/column collision and invalid debug spawns.
- Actual keyboard traversal: spawn → broad stairs → landing → right branch → rear
  gallery → east gallery. Player reaches y = 6; E opens the gallery info panel.
- All five E panels, completion state, separate lock release, P/Space PNG download,
  Escape, C free camera and its animated return. No console errors in those runs.
- Saved and visually inspected `/tmp/lmu_interior_entrance.png`,
  `/tmp/lmu_interior_roof.png`, `/tmp/lmu_interior_landing.png`,
  `/tmp/lmu_interior_gallery.png`, `/tmp/lmu_interior_memorial.png`.
  Additional interaction captures: `/tmp/lmu_interior_playthrough.png` and
  `/tmp/lmu_interior_complete.png`.

## Known gaps / intentional scope

- The 11.6 m uppermost arcade is scenery, with no player-access staircase. Walkable
  levels are exactly 0, 2.4 and 6 m. Closed corridor doors are decorative.
- Cast meshes are simple toon placeholders. No interior narrative branch or
  persistent visit save has been added; visits reset on page reload.
- The shared audio API has no surface option. Its existing footsteps, music and
  general outdoor ambience remain; spatial fountain audio is disabled by the
  empty fountain list. Marble-specific footsteps/indoor ambience can be supplied
  by a future shared audio extension.
- Shared free camera intentionally flies through geometry; collision pull-in
  applies to the normal player camera. The cinematic module's home interpolation
  uses its plaza defaults before handing back to the shorter interior rig.
- This is a stylized architectural composition, not a measured LMU survey or a
  claim about where its real memorial/bench is situated. External CDNs still
  require network access on an uncached first load.
