# Siegestor north district

Entry: `project/src/lmu_block_siegestor.js`, exporting `createBlock(engine)` and `LANDMARKS`.
Pure geographic fixtures: `project/src/lmu_block_siegestor_data.mjs`.

## Built

- 85 OSM building features: the three-passage Siegestor plus 84 surrounding building footprints, including boundary-clipped fragments. Each building registers precise polygon collision. All three gate passages remain open.
- The gate follows its actual diagonal street alignment at approximately `(176.96, 132.96)`. Its stone body is approximately 21 m high, with a procedural Bavaria/four-lion quadriga above. South-facing peace-inscription band is shallow, non-emissive relief; north-facing attic has medallions and simplified figures.
- Academy old building: actual U-shaped footprint, lower wings, raised central/end pavilions, present-day flat pavilion roofs, rusticated base, arched windows, pilasters, portrait medallions, entrance portico/steps and two simplified equestrian sculptures.
- Small LMU/university blocks at the southern boundary; the west-side Akademiestraße fabric; Leopoldstraße office/residential frontages, Georgenstraße and Ohmstraße, and the in-sector portions of Adalbertstraße and Amalienstraße.
- 99 source road/path ways, clipped when rendered; sidewalks, asphalt, lane dashes, courtyard lawns, 20 lamps, and 64 mapped trees (30 rendered as columnar poplars). Tree species silhouettes and untagged building heights are estimates.
- Three Chinese landmarks: gate south approach, Academy courtyard, Leopoldstraße sidewalk.

19 merged material meshes + 5 large-mass ink hulls = **24 maximum block draw calls**. All surfaces use engine toon materials. No texture files, point lights, shadow casters, animation callback, per-frame allocations, network requests, or dependencies beyond the existing Three.js r160 import map. `dispose()` unregisters collision and releases owned geometry/materials; shared engine gradient maps remain untouched.

## Sources

`project/assets/osm/siegestor.json` is the original Overpass response trimmed to used elements: 128,805 bytes. Full query, endpoint, UTC retrieval time, ODbL attribution, and reference URLs are in `siegestor.sources.json`. Geometry retrieval succeeded from overpass-api.de; no hand-measured fallback was used.

Attribution: **© OpenStreetMap contributors, ODbL**.

Visual reference only (no external imagery is included in this module):

- [Munich city: Siegestor](https://www.muenchen.de/en/sights/siegestor)
- [Academy: building history](https://www.adbk.de/en/akademie-en/archive-historical/buildings.html)
- [South gate photo](https://commons.wikimedia.org/wiki/File:Muenchen_Siegestor01.jpg)
- [North gate photo](https://commons.wikimedia.org/wiki/File:Siegestor_Muenchen_January_2013.JPG)
- [Academy photo](https://commons.wikimedia.org/wiki/File:Akademie_Muenchen2.JPG)
- [Munich tourism: street transition](https://www.munich.travel/en/pois/urban-districts/siegestor)

## Verification

`node --test project/tests/lmu_block_siegestor.test.mjs`: **5/5 pass** (sector/core exclusion, landmarks, open arches/solid piers, geographic fidelity, source budget).

`node --test project/tests/*.test.mjs`: **47/47 pass**.

Dynamic import through `project/tools/shot.mjs` on port **8121**: **no console errors**. Browser checks also confirmed zero ray intersections through all three passages at pedestrian height, all landmarks accepted by `engine.blocked`, all mesh bounding boxes within the sector, and collision removed/reinstated by dispose/recreate. Repeated disposal is safe.

Inspected screenshots, saved outside the repository:

| View | Screenshot | Camera / target |
|---|---|---|
| South gate | `/tmp/siegestor-south.png` | `(139,4,121)` → `(177,12,133)`; player `(155,0,112)` |
| North gate | `/tmp/siegestor-north.png` | `(224,5,148)` → `(177,12,133)` |
| Academy | `/tmp/siegestor-academy.png` | `(211,12,-22)` → `(270,11,0)` |
| Wide | `/tmp/siegestor-wide.png` | `(300,55,0)` → `(196,4,124)` |

At the default spawn, direct scene rendering measured **336 → 353 draw calls, delta +17**. At the wide view it measured **210 → 234, delta +24**, including outlines. The theoretical maximum remains 24 at any view. Shared scene/postprocessing calls are outside this block's budget.

## Deviations and integrator actions

- The supplied `(155,0,80)` camera/player point is inside OSM building 19423768; `(300,0,0)` is inside the Academy. South photography therefore uses the nearby clear approach; the requested wide X/Z is retained with the camera raised above the roof.
- Footprints are clipped to the assigned sector with a 0.12 m inset. Window/cornice endpoints stop at the seam; even the expanded outlines remain outside `CORE_BOUNDS`.
- Facade decoration and sculptures are procedural abstractions. Missing heights use level estimates; generic gabled/hipped/mansard roofs are simplified folded surfaces. Academy pavilion roof shape follows the current building/reference history rather than OSM's generic `gabled` tag. Steps are decorative and do not change the shared ground-height API.
- Schellingstraße and most of the LMU Ludwigstraße frontage lie south of this sector. No invented Ludwigstraße 25–31 address assignments were made; the actual in-sector university fragments are included.
- Import and call `createBlock(engine)` once, retain `dispose()` for teardown, and add `LANDMARKS` to the POI/minimap system. There is no update hook. Do not rotate this block: it already uses `date_geo.mjs` (+X north, +Z east).
- The existing stylized right-adjacent core mass/obstacle extends to x≈164 at z<26 and overlaps some south-boundary OSM fragments. Scene/integration owners should trim that legacy extension; this module does not edit or remove shared geometry/obstacles.
- For the final app, retain a visible OSM attribution link. No `anime_main.js`, route, or other agents' files were changed.
