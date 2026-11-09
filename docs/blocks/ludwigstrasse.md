# Ludwigstraße street block

Entry: `project/src/lmu_block_ludwigstrasse.js` → `createBlock(engine)`; exports `LANDMARKS` and `LANES`. The pure `lmu_block_ludwigstrasse_plan.mjs` contains the survey, clipping and collision plan; `lmu_block_ludwigstrasse_data.mjs` contains converted OSM coordinates. No integration files were edited.

## Built

- Both street sectors: **x ∈ [-480,-150] and [150,480]**, clipped exactly at the four seams. There is **no geometry in CORE_BOUNDS**, including pavement and markings. The street corridor follows the real axis, approximately **z = 77 + 0.315x**, not z=80 for its entire length.
- 17 motor-road sections, 16 cycle-path sections, connecting street mouths, granite-coloured slab sidewalks with joints, asphalt, kerbs, broken lane lines, directional bicycle stencils and the tagged parallel-parking strips. Roads bend around the **real Siegestor footprint**; the gate itself belongs to the northern block and is not duplicated.
- **25 double-arm candelabra / 50 emissive heads**, using two instanced draws. Thirteen positions are OSM-mapped and twelve northern infill positions are explicitly estimated. Broadleaf crowns and trunks use two instanced draws; **33 trees**, all at mapped OSM locations. No invented trees.
- **44 U-shaped bicycle stands at three mapped parking sites**; large capacity=80 sites are visually abbreviated to 16 stands. One instanced draw.
- **Two bus stops**: Universität (southern Ludwigstraße platform) and Georgenstraße (Leopoldstraße); one small glass shelter at the tagged sheltered stop. Procedural atlas signs, no downloaded textures.
- **Universität C and D subway stair-mouth proxies**, both outside the core. Railings, U3/U6 signs and blocked dark stair openings. They are surface representations, not accessible underground interiors.
- **Two distant buildings**: Theatinerkirche St. Kajetan (ochre body, two belfries, copper roofs and dome) and Feldherrnhalle (three open arches). Both use their real OSM footprint coordinates, around x=-950/-1000. This is the explicit requested far-silhouette exception to the local-sector rule. They have collision on their full OSM rings and **no ground patch outside the street sectors**.
- Three Chinese landmarks on tested walkable pavement, plus 80 directional motor/cycle polylines for the life module. Static block: no update callback and no per-frame allocations. `dispose()` removes the group, unregisters collision, and releases geometry/material/texture/instance resources.

The road/sidewalk polygons subtract neighbouring OSM building outlines, so the paving does not paint over another block's buildings. One unregisterable `addBlocker` registers 104 local furniture/opening footprints plus the two distant building rings. No `addObstacle` entries are left behind on disposal.

## Survey and sources

Raw retained response: `project/assets/osm/ludwigstrasse.json` (**74,215 bytes**). Query, Overpass endpoint, UTC timestamp and attribution: `project/assets/osm/ludwigstrasse.sources.json`. Main query bbox: `48.1463,11.5789,48.1552,11.5838`; supplementary church query bbox: `48.1411,11.5753,48.1431,11.5785`. Queried 2026-11-09. **© OpenStreetMap contributors, ODbL**: https://www.openstreetmap.org/copyright . No coordinate fallback was necessary.

Useful OSM elements:

| Element | Use |
| --- | --- |
| ways 39321854, 40317920 | Six lanes, 3+3, south of LMU |
| ways 242358060, 242358064 | Seven lanes at junction approaches, 4+3 |
| ways 50220178, 151334113 | Two-lane one-way branches around Siegestor |
| ways 151263118, 482117464 | Five-lane Leopoldstraße approaches |
| ways 34397762, 135588109, 1420377550 | Four-lane Leopoldstraße, 2+2 |
| ways 47229154, 88890339, 93192039, 330509031 | Separated cycling and sidewalk alignments, tagged 2–2.5 m cycle widths where present |
| nodes 288677130 / 711833721 | Universität entrances D / C |
| ways 377796605 / 258777119 | Universität / Georgenstraße platforms |
| ways 25514390 / 25505402 / 22727580 | Theatinerkirche / Feldherrnhalle / neighbouring Siegestor footprint |

Reference photos were viewed for material, proportion and lamp form only; **no reference photograph is included in the repository**:

- [Wikimedia: Theatinerkirche and Feldherrnhalle](https://commons.wikimedia.org/wiki/File:Theatinerkirche_Feldherrenhalle_Odeonsplatz.jpg), Schlaier, public domain: ochre church, dark copper crowns, stone loggia and arches.
- [Wikimedia: MUC Maxvorstadt Uni 01](https://commons.wikimedia.org/wiki/File:MUC_Maxvorstadt_Uni_01.jpg): street/LMU scale and warm historic lighting. Viewing only.
- [Munich tourist authority: Odeonsplatz](https://www.muenchen.de/sehenswuerdigkeiten/sehenswerte-plaetze/odeonsplatz): north/south vista relationship. The model deliberately shows the historic unclad Feldherrnhalle, rather than current renovation scaffolding.
- [City of Munich: Ludwigstraße redesign](https://stadt.muenchen.de/infos/neugestaltung-ludwigstrasse.html): existing street context. This block follows the surveyed current road tags, not the future redesign proposal.

## Reality and artistic limits

Motor-road `width` tags were absent. **3.1 m per motor lane** and **2.1 m parallel-parking strips** are estimates; lane counts and direction are tagged. The prompt's suggested 2+2 layout is correct for much of Leopoldstraße, **not** the six-/seven-lane southern Ludwigstraße in this OSM snapshot. Additional turning lanes are represented geometrically but `LANES` does not encode turn restrictions or traffic signals. Physical driving side is German right-hand traffic: northbound lanes to the east, southbound lanes to the west.

Sidewalk slab pattern, 4.4 m typical walk strip, 9.1 m lamp apex, the requested double-arm interpretation, shelter/railings and rack spacing are procedural approximations. Some mapped street lamps are labelled only bent-mast in OSM; those positions retain the requested matching candelabra style. The broadleaf foliage follows the existing game's summer palette. No signage fares or service timetable is claimed current; bus numbers are a short subset of the snapshot tags.

The church's full footprint is retained, but upper parts are simplified masses at estimated tower/dome positions. Feldherrnhalle is a distant silhouette, with simplified bronze figures. These backdrops sit outside current `route.BOUNDS`; they are not new playable destinations.

## Integration: wiring and traffic

```js
import { createBlock, LANDMARKS, LANES } from './lmu_block_ludwigstrasse.js';
const ludwigstrasse = createBlock(engine);
// Add LANDMARKS to the host's POI/minimap registry.
// Pass LANES to the life system; no module update() is needed.
// On teardown: ludwigstrasse.dispose();
```

`LANES`: `{ id, osmWayId, mode: 'motor'|'cycle', vehicleTypes, direction, width, speedLimitKmh, points: [{x,z}], next: [id] }`. Point order is travel order. Motor routes accept cars/buses; cycle routes accept bicycles. The graph uses nearby compatible endpoints, with separate turning paths around the gate. **Do not loop or connect across the ±150 core gap** until the integrator supplies the actual core lanes. `next` is a geometric hint, not a signal controller or full OSM turn-restriction graph. Remove/replace the existing stylised traffic routes when activating these.

## Precise core-road plan (integrator / scene owner)

1. **Remove the old perpendicular road**, the `D.roadX=112`, `D.roadW=33` box at `x=112…145, z=-150…150`, its z-directed lane markings, and its cycle strips. Do not simply translate that box. The real road runs mostly along X and turns slightly with the map, through the following coordinates.
2. Use the full retained **ROAD_WAYS** and **CYCLE_WAYS** arrays as the core alignment source; this module clips those same ways to its own two sectors. Clip the core addition to `x=-150…150`, while allowing the eastern carriageway near the northern seam beyond `CORE_BOUNDS.maxZ=118` in coordination with the east-sector owner.

| Section at x | Motor-road centre(s), z | Motor layout | Cycle centre(s), z |
| --- | --- | --- | --- |
| -150 seam | 30.153 | 3 southbound + 3 northbound; 18.6 m total | west 17.248 / east 40.163 |
| 0 (portal latitude) | southbound 72.645 / northbound 81.243 | two 6.2 m carriageways, 2 lanes each | west 64.261 / east 90.107 |
| +150 seam | southbound 116.412 / northbound 134.550 | two 6.2 m carriageways split around Siegestor | west 109.796 / east 142.577 |

   Widths are perpendicular to each surveyed segment, not constant-Z slabs. With +X north and +Z east, positive `offsetPath()` is the right-hand side of source travel. At x=0, approximate lane centres are **z=71.17,74.12 southbound** and **79.77,82.71 northbound**. Exact positions come from the polylines/normal offsets. The source ways transition from six to five lanes between x≈-125 and -28, then split into 2+2. Follow this taper rather than inserting a sudden 3+3→2+2 edge.

3. Continue the same cross-section: cycle lanes 2 m where untagged (west 2.5 m where tagged), a 0.18 m separator, then **4.4 m paved sidewalk on the outside**. Main asphalt y=.04, cycle surface y=.115, sidewalk y=.14, kerb top y=.165. Outward paving must be clipped against buildings and the plaza perimeter. At x=0 the western sidewalk occupies approximately **z=58.7…63.1**, so the old paving to z=80 cannot remain a single unobstructed plaza. Reconcile the `our_plaza` POI at (0,75) and the western fountain near (-35,48) with the new street cross-section; these are currently on/near the real traffic corridor. Move the affected quest spots and physical features onto the revised west-side pedestrian area together.
4. Reuse the **CORE_STREET_LAMPS** data for nine mapped street lights without duplicating this module's lamps. A representative row on the west side: `(-146.455,44.443)`, `(-112.675,54.974)`, `(-31.779,53.348)`, `(6.878,65.647)`, `(48.177,77.486)`, `(74.903,84.185)`, `(110.121,95.095)`, `(145.449,106.183)`. The ninth is `(35.572,102.433)` on the opposite side. `MAPPED_LAMPS` owns only the outside-core positions.
5. Core subway entries to add: **A** at `(56.127,70.066)` and **B** at `(43.013,115.371)`. The additional lift `Nr. 2` at `(-150.071,15.337)` is omitted because its physical footprint would straddle the protected seam. This module already owns **C** `(-175.780,36.273)` and **D** `(-171.644,8.147)`; do not duplicate them. There are more than two mapped access points to the station.
6. `DEFERRED_BUS_PLATFORMS` retains the partial northbound Universität platform 377796604 (straddling x=-150), the two Universität platforms on Schellingstraße (outside this narrow street corridor), and both Siegestor platforms within the gap. Integrate them with the relevant core/cross-street owner. Georgenstraße is already built at the northern edge.
7. **Visibility/ground:** the existing camera far plane is 900 m and the sky sphere radius is **700 m**. At the specified far test point `(-300,0,80)`, the real church/loggia are 700–800 m away and hidden by that opaque sky sphere. Increase the sky radius (e.g. 1,800 m), camera far (e.g. 2,000 m) and scene ground extent together. Keep fog start/end broad enough for the vista. This module does not modify global camera/sky/ground. From `(-430,5,-45)` the real-position buildings already render clearly without overrides to sky or materials.

## Verification

- `node --test project/tests/lmu_block_ludwigstrasse.test.mjs`: **15/15 pass**. Conversion against retained WGS84, exact sector clipping, no core overlap, walkable landmarks, right-hand traffic, lane counts, mapped trees, entrance ownership, neighbouring buildings and ODbL snapshot budget.
- `node --test project/tests/*.test.mjs`: **57/57 pass** in the final run.
- Headless dynamic import through `project/tools/shot.mjs`, served only on **8120**. No console errors. Created/disposed/recreated successfully; registered lamp collision changed from true to false on disposal.
- Composer draw-call count measured inside `requestAnimationFrame`, with `renderer.info.autoReset=false` and an explicit reset before each full composer render: **405 before → 418 after, delta +13 at the default view**. Disabling frustum culling only for this block measured **+33 calls**, including outlines, instances and signs, below the 40-draw budget even if every batch is submitted. No shadow-casting duplication. A transformed-vertex scan also found **zero street vertices inside CORE_BOUNDS**.
- Screenshots in `project/assets/ludwigstrasse/qa/`: `north-requested.png` (160,0,80), `south-requested.png` (-160,0,80), `far-south-requested.png` (-300,0,80), `lamp.png`, plus `north-surveyed.png`, `street-overview.png`, and `southern-silhouette.png`. The three requested z=80 views demonstrate the coordinate/sky mismatch, rather than a falsely recentered road. The surveyed views demonstrate the geometry at its actual alignment. Every PNG was inspected.

The QA images are generated local game renders, not downloaded reference photos. Their asset manifest is `project/assets/ludwigstrasse/sources.json`.
