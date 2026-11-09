# Huberplatz sector

## Integration

Import `createBlock` and `LANDMARKS` from `project/src/lmu_block_huberplatz.js`, call
`createBlock(engine)` once after the engine exists, and retain the returned handle for `dispose()`.
The factory adds its group to the scene. It is synchronous, has no fetch dependency and needs no
update call. `DEFERRED_FEATURES` is also exported for the two landmarks that cannot be placed under
the current core boundary. The block does not change the engine, its materials, route bounds, camera,
other scenery or any other module. Add `LANDMARKS` to the POI/minimap system in the integrator.

## Built

- **36 OSM building footprints**, including the clipped north wing of the Georgianum (way
  1432551061), Juristisches Seminar (17970872), Ludwigstraße 28 front/rear (17970443 / 17970625),
  Fritz-Beck-Haus at Veterinärstraße 1 (17971433), Karl-Neumeyer-Haus and the intervening blocks
  through Kaulbachstraße. Source polygons, including concave wings and courtyards, drive both
  geometry and registered collision. Cropped buildings continue at the sector edges.
- **50 OSM street/footway ways**, including Veterinärstraße, Professor-Huber-Platz,
  Schackstraße, Kaulbachstraße and courtyards; asphalt, sidewalk borders and restrained paving seams.
- **19 mapped trees**, **7 mapped grass islands**, **9 cycle-parking groups** represented by
  **58 rack stands** with **23 parked bicycles**; 3 inferred benches and 2 inferred lamps.
- One **small courtyard fountain**, OSM node 12964675389, at **(-8.6137, 191.2445)**.
  Its compact dimensions are an estimate. This is **not** the Gärtner / Römischer Brunnen.
- 1,959 procedural windows; historic round arches, crossbars, stone sills and dentils;
  other buildings use rectangular windows. Gabled/hipped roofs follow the corresponding OSM
  tags, with a triangulated footprint height field rather than roofs across courtyard holes.
  The single `quadruple_saltbox` tag is approximated by a hipped height field.
  `height=26` is treated as total height (the gabled Ludwigstraße 28 eave is at 22.7 m).
- 3 short Chinese landmarks, on checked walkable ground.

All masses and details are merged by material: **23 material meshes + 5 inverted-hull mass outlines
= 28 draw calls maximum**, no per-frame allocations. `group.userData.stats` exposes the counts.
Only large building masses have outlines. All geometry triangles are clipped to the assigned sector,
including tree crowns, sills, cornices and road ribbons. The effective render boundary is inset 0.075 m
so the 0.045 m outlines also remain outside the core. Every building uses `addBlocker(pointInPolygon)`;
all blockers and owned GPU resources are released by idempotent `dispose()`.

## Sources and licensing

- Geometry: **© OpenStreetMap contributors, ODbL**. Exact Overpass query, endpoint, timestamp,
  attribution, failure/retry history and reference URLs are recorded in
  `project/assets/osm/huberplatz.sources.json`. The trimmed, otherwise unchanged Overpass response is
  `huberplatz.json` (49,873 bytes). The successful GET followed three unsuccessful POST attempts;
  **no hand-measured fallback geometry was used**.
- A supplementary OSM API map request located the two out-of-sector landmarks. Only those two
  original nodes/tags are retained in `huberplatz_landmarks.json`; the URL is in the sources file.
- Georgianum proportions/material/window rhythm: [Commons photograph 1 by Ricardalovesmonuments](https://commons.wikimedia.org/wiki/File:Georgianum_M%C3%BCnchen_Professor-Huber-Platz_(1).jpg),
  [photograph 2](https://commons.wikimedia.org/wiki/File:Georgianum_M%C3%BCnchen_Professor-Huber-Platz_(2).jpg),
  both CC BY 4.0, **viewed only**. [LMU history](https://www.lmu.de/de/die-lmu/die-lmu-auf-einen-blick/geschichte/1494/)
  supplied historical context and a further reference photo.
- [LMU fountain restoration article](https://www.lmu.de/de/newsroom/newsuebersicht/news/brunnen-sprudeln-wieder-41554b32.html)
  and its photo identify the twin bowl forms and turquoise coating.
- [LMU law faculty map/addresses](https://www.jura.lmu.de/en/faculty/arrival-and-location-map/) and
  [MVV Universität station plan](https://efa.mvv-muenchen.de/sta2/universitaet.pdf) verify buildings and exit B.
- **No photographs, remote textures, fonts, or downloaded executable content are in the repo.**

## Boundary conflicts / deviations requiring integrator attention

The prompt's protected rectangle takes precedence over placing objects within it. The current
origin and unmodified `date_geo.mjs` put the real east Gärtner fountain (OSM node **201979156**)
at **x=-24.1936, z=97.8875**, and Universität east exit B (node **288676926**) at
**x=43.0133, z=115.3706**. **Both are outside this sector and inside CORE_BOUNDS.** Neither is
silently shifted, duplicated, nor confused with the courtyard fountain. Their source data and
coordinates are supplied in `DEFERRED_FEATURES`; the integrator must place the 8.2 m / 10 m Gärtner
fountain and building-integrated exit after reconciling core ownership. The source station exit is
integrated into the university corner tower, not a freestanding outdoor stairwell.

The real Ludwigstraße east kerb is around z≈100–105, but this block starts at z=118 as instructed.
The strip between the real kerb and this boundary is left to the core/street integrator. In particular,
the historic west corner of the Juristisches Seminar is clipped. Most of the Georgianum lies south of
x=-60; only its northern wing belongs to this assignment. Extending it or moving it north would be
geographically wrong and overlap a different agent's sector. Ludwigstraße 29–31 are on the west side
of the street, outside this east sector. The Englischer Garten is beyond this sector's eastern boundary;
no park polygon was returned, so no invented park edge has been added at z=300.

Building heights without OSM values, untagged flat roofs, window bay spacing, palette, paving joints,
lamp/bench placement, parked-bike details and courtyard-fountain dimensions are visual estimates.
OSM tree positions and grass rings are preserved; no invented tree row has been claimed as mapped data.
The generic untagged heights are derived from floor count (estimated 3.5 m per floor plus 1 m).
Foliage is static. Buildings do not cast extra shadows, consistent with the core's limited shadow camera.
Mapped building passages remain solid, matching the task's requirement to block every building footprint.

## Verification

`node --test project/tests/lmu_block_huberplatz.test.mjs`: **6/6 pass**.
`node --test project/tests/*.test.mjs`: **48/48 pass**.

All screenshots were taken with the required `project/tools/shot.mjs` dynamic-import workflow,
served only at `http://localhost:8124/`. Every capture logged **no console errors**.
Camera yaw **Math.PI** faces east (+Z) in the game's spring camera.

| Screenshot | Camera / player | Observed visible draw-call delta |
|---|---|---:|
| `/tmp/huberplatz-georgianum.png` | requested (20, 0, 125), east | 27 |
| `/tmp/huberplatz-plaza.png` | requested (60, 0, 130), east | 26 |
| `/tmp/huberplatz-veterinaer.png` | requested (40, 0, 200), east | 24 |
| `/tmp/huberplatz-veterinaer-walkable.png` | actual street (-52, 0, 188), east | ≤28 |
| `/tmp/huberplatz-overview.png` | camera (-80, 140, 85), looking at (40, 0, 206) | **28** |

The requested first view sees the law-building forecourt, not the mostly out-of-sector Georgianum.
The requested plaza view (60,130) is **inside the real Ludwigstraße 28 footprint**, so it correctly
shows a close wall when teleported there. The requested street view (40,200) is in a rear courtyard.
These are coordinate conflicts in the brief, not camera or collision defects; the additional street
view and overview show the real layout. All five PNGs were visually inspected. An additional near-facade view is `/tmp/huberplatz-final.png` (27 visible added draws; construction took 214 ms in headless Chrome).

A browser audit confirmed every rendered vertex stays within x=[-59.925,149.925],
z=[118.075,299.925]. A separate lifecycle audit verifies all 36 building probes block, all 3 landmarks
remain walkable, and dispose/remount restores collision registration without console errors.
The legacy `node --test project/tests/` directory command is not supported by this Node version;
the explicit `*.test.mjs` command above is the passing full-suite command.
