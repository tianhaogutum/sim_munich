# Maxvorstadt west block

`project/src/lmu_block_maxvorstadt_west.js` exports synchronous `createBlock(engine)` and
`LANDMARKS`. It imports one pure data/helper module and three.js r160's existing CDN
`BufferGeometryUtils`; no build step, dependency install, asynchronous fetch, or update hook.

## Built

- 123 clipped OSM building footprints, including the rear university wings, Amalienstraße's
  two frontages, the in-sector Schellingstraße end, Amalienpassage, and Türkenstraße/Blütenstraße.
- 4,727 upper windows; 196 fictional shop/awning bays; 74 balconies; ground-floor glazing,
  cornices, dormers, pale window surrounds, and selected arched windows.
- Flat, gabled, hipped and mansard/gambrel roof interpretations, respecting mapped roof tags.
  Roof surfaces are clipped to the original footprint triangulation, preserving courtyards.
- 104 mapped roads/paths represented by 263 clipped segments, with asphalt, sidewalk ribbons
  and kerb setts. Amalienstraße, Schellingstraße, Türkenstraße, Adalbertstraße, Blütenstraße.
- 58 OSM trees, 140 parked bicycles, 38 café tables with two chairs each, umbrellas and menu
  boards, two freestanding kiosks, and street-name plaques. Furniture is procedural.
- Three Chinese POIs on open sidewalks. All building polygons register precise collision;
  tables, trees and kiosks have small additional collision circles. Disposal unregisters
  the block and releases its geometry, materials and generated sign atlas.
- 12 drawable meshes including the single inverted-hull outline pass. Windows, trim,
  awnings and café furniture share an instanced box mesh; trees and bikes are instanced.
  No per-frame work or allocations.

## Data and references

`project/assets/osm/maxvorstadt_west.json` is 137,321 bytes. It preserves source OSM IDs,
node references, WGS84 geometry and tags, with only the selected buildings/highways/trees/
bicycle parking retained. `maxvorstadt_west.sources.json` records the requested Overpass
query, retrieval timestamp, endpoint, attribution, and photo references.

**Retrieval deviation:** the first three Overpass attempts failed (primary HTTP 502,
Kumi timeout, primary timeout); GET retries also failed. The official OSM map API succeeded:
<https://www.openstreetmap.org/api/0.6/map?bbox=11.57631,48.14939,11.57995,48.15211>.
Its XML geometry/tag selection was converted losslessly to JSON. No hand-measured building
coordinates were substituted. © OpenStreetMap contributors, ODbL.

Viewed, but **not shipped**, Wikimedia Commons photographs:

- [Schellingstraße 9 / Amalienstraße corner](https://commons.wikimedia.org/wiki/File:Schellingstr._9_Muenchen-4.jpg),
  Rufus46, CC BY-SA 3.0: peach/sage plaster, pale arched surrounds and ground-floor rhythm.
- [Amalienstraße 53](https://commons.wikimedia.org/wiki/File:Amalienstr._53_Muenchen-2.jpg),
  Rufus46, CC BY-SA 3.0: five-storey window rhythm, balcony ironwork, cornices and dormers.

All surfaces and lettering are procedural; the only runtime texture is the generated
sign atlas. Verification PNGs contain the rendered project, not reference photography.

## Verification

- `node --test project/tests/lmu_block_maxvorstadt_west.test.mjs`: **7/7 pass**.
- `node --test project/tests/*.test.mjs`: **49/49 pass**.
- Dynamic import on port **8125**, no console errors. Building registration, disposal,
  double-disposal and recreation checked; exactly one block remains after recreation.
- All three landmarks return `engine.blocked(...) === false` after registration.
- Browser geometry bounds, including transformed instanced details and signs:
  **x = [-150,150], z = [-300,-30]**. Nothing reaches `CORE_BOUNDS`.
- Direct composer draw-call measurement uses `renderer.info.autoReset = false`, resets
  before each explicit render, and compares identical camera views with block hidden/visible.
  **161 → 173 calls, delta +12**, below the 40-call budget. Reading the last compositor pass
  alone would misleadingly report one call.

Committed screenshots in `project/assets/maxvorstadt_west/verification/`:

| Image | Player x,z; yaw | Notes |
|---|---|---|
| `amalien.png` | 28,-101; -1.99 | Actual Amalienstraße sidewalk, looking along its diagonal northward course |
| `schelling.png` | -108,-175; 0 | Actual Schellingstraße/Amalienstraße corner |
| `tuerken.png` | 99,-254; 1.16 | Türkenstraße/Blütenstraße, looking south along the street |
| `wide.png` | 0,-200; π | Elevated camera (0,53,-200), looking at (0,16,-40) |
| `requested_amalien.png` | -100,-60; -π/2 | Requested position is a rear courtyard, not Amalienstraße |
| `requested_schelling.png` | 60,-80; 0 | Requested camera arm intersects a mapped campus wing |
| `requested_wide.png` | 0,-200; π | Requested player position lies inside an OSM building |

The requested positions were tested without moving mapped geometry. Additional views
make the intended streets and roofs inspectable. Rerun with the task's `shot.mjs` command,
importing `/src/lmu_block_maxvorstadt_west.js`, then set the listed player position/yaw.
For the elevated view assign a constant `engine.cameraOverride` to the camera coordinates above.

## Deliberate simplifications and sector exclusions

- Heights use OSM `height`/`building:levels` where present; otherwise 5 floors for housing,
  4 for university buildings, 1 for small structures. The floor pitch is 3.15 m plus 0.8 m
  of base/cornice; missing roof heights use 3.5 m. Roof profiles, colours, balconies, bays,
  shopfronts and furniture are interpretations, not surveyed architectural reconstructions.
- Road widths and curbs are stylised, derived from road class; no traffic simulation.
  Known bicycle-parking nodes seed racks, augmented on open mapped sidewalks.
- Indoor/underground highways are omitted. Building passages are not carved from collision
  (courtyard openings in the actual polygon remain open). No navigable building interiors.
- Theresienstraße, Schelling-Salon, and the Schellingstraße/Türkenstraße junction lie outside
  this exact rectangle. They have not been relocated into it. The in-sector Türkenstraße
  corner is Blütenstraße. The streets run diagonally in the contract's north/east frame.

## Integrator requests

1. Import and call `createBlock(engine)` once after engine creation; retain `dispose()`.
   Add `LANDMARKS` to the POI/minimap registry. There is no per-frame hook.
2. Remove/reconcile the **existing generic adjacent-building boxes and their solids** in
   the scene region. At this base commit they overlap the real rear campus around
   x≈±112 and z≈[-78,0], making the requested courtyard position (-100,-60) blocked
   even before this block is created. This module does not edit the core or global solids.
3. Use the actual street coordinates above for POI/camera review; add spring-arm building
   avoidance if camera travel is required around the newly mapped blocks.
4. Include visible OSM attribution in the eventual global map/about UI. This module's
   group metadata and source files already retain the attribution.

Port 8125 was used only for verification. No changes to the entry point, engine, route,
other agents' modules, or shared files are included.
