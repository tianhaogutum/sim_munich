# Ludwigstraße west / Maxvorstadt

## Delivered

`project/src/lmu_block_ludwig_west.js` exports synchronous `createBlock(engine)` and `LANDMARKS`; the pure data and collision helpers are in adjacent `lmu_block_ludwig_west_*.mjs` files. Call `createBlock` once, retain the returned object, and call `dispose()` when unloading. There is no update loop, asynchronous fetch, npm dependency, or change to the shared engine. Dispose unregisters collision, removes the group, and releases its geometry, materials, and procedural sign texture; repeated disposal is safe.

- 75 OSM building footprints: southern part of Ludwigstraße 27; Philologicum / former Blindeninstitut at 25; Verwaltungsgerichtshof at 23; the Ludwigstraße 21 / Theresienstraße institutional block; Schellingstraße 3, including its courtyard; the Fremdspracheninstitut at Amalienstraße 36; and surrounding Maxvorstadt blocks.
- 4,690 batched window openings with mullions, sill and cornice details; 144 generic shop awnings; 12 OSM trees, 8 kerbside lamps, 4 benches, and 6 bicycle-parking groups. The 128 retained OSM road/path ways provide clipped asphalt, footpaths and sidewalks, including Theresienstraße, Schellingstraße, Amalienstraße and the small Fürstenstraße / Rheinbergerstraße edge.
- Three Chinese POIs: Philologicum, Verwaltungsgerichtshof, Theresienstraße. Each has an inline source note and a walkable position.
- **19 draw calls** including one inverted-hull outline draw for the merged masonry. Geometry is merged by toon material; facade and roof colors use vertex colors. No per-frame geometry allocation. Collision checks use polygon rings and preserve courtyard holes.

## Sources and geographic decisions

Raw response, trimmed only by dropping unused elements: `project/assets/osm/ludwig_west.json` (**101,643 bytes**). Exact Overpass queries, endpoint, fetch times and ODbL attribution: `project/assets/osm/ludwig_west.sources.json`. Ways were fetched 2026-11-09 10:00 UTC; a smaller relation query succeeded at 10:05 UTC after broad relation queries failed. **No hand-measured footprint fallback was needed.** Derived coordinates use `date_geo.mjs`, rounded to the nearest millimetre and clipped at the ownership boundary.

Photographic references and institutional sources: `project/assets/ludwig_west/sources.json`. The Philologicum, Amalienstraße 40 and Theresienstraße 4 photographs were visually inspected for proportions, material colors, window rhythm, cornices and storefront character. **No photos are distributed**; the only texture is a procedural text atlas.

The real Ludwigstraße centerline is oblique in this coordinate system: approximately `z = 0.314*x + 77`. At Schellingstraße it is around `(-195,16)`; near Theresienstraße `(-434,-59)`. This is different from a constant z=55–105 strip. Buildings retain their actual OSM footprints; they were not shifted to fit the proposed road line. East-side St. Ludwig, its associated buildings, the state library, and the state archive were deliberately excluded even where their polygons intersect the rectangular query. Ludwigstraße 1–13 / Odeonsplatz lie south of this sector; no invented Bazar block was added.

All geometry is within **x=[-479.9,-150.2], z=[-249.9,54.8]**. This leaves the stylized core and z≥55 street-agent strip clear. Some northern/western buildings are necessarily cut at the sector boundary. Ground elevation is approximately zero; the original base plane remains untouched.

## Known simplifications

OSM footprints and mapped road centerlines are retained, including the Schellingstraße 3 courtyard hole. Heights use tagged levels / height when available; untagged houses default to five floors (3.35 m each), and small garages to one floor. Historic landmark floor heights are estimated at 4.5 m; Ludwigstraße 23 is rendered as three principal facade levels (17.8 m), following the photo rhythm rather than four generic OSM levels. The insurance block uses a 20 m envelope.

Roofs follow tagged flat/gabled/hipped forms where provided. Gambrel is approximated as gabled. Roof heights/ridges, windows, signs, awnings and lamps are stylized, not surveyed. Complex roofs use a longest-edge-oriented envelope clipped to the exact footprint. The modern western Philologicum louver facade, ornate sculpture, balconies, dormers, interiors and detailed brick bonds are not modeled. Generic shop labels do not identify actual current tenants. No interior access or roof navigation is provided.

## Verification

- `node --test project/tests/lmu_block_ludwig_west.test.mjs`: **6/6 passed**. Covers conversion signs and round trips, all boundary vertices, core exclusion, original OSM provenance, known-coordinate accuracy, every building's collision, courtyard openness, walkable sourced POIs, and raw-data budget.
- `node --test project/tests/*.test.mjs`: **48/48 passed**.
- Dynamic import through `project/tools/shot.mjs` on **port 8123**, unmodified game, `?notitle=1&stage=photos`: no console errors. All geometry attributes are finite.
- Same-frame renderer comparison at default spawn: **328 → 347 calls (+19)**. After `dispose()` twice: **328**, group absent. Re-creation succeeds. These are direct `renderer.render` counters, excluding identical composer postprocessing passes; no new object casts a shadow.
- Measured complete Three.js group bounds: min `(-479.899994, ≈0, -249.899994)`, max `(-150.199997,27,54.799999)`; shader outline adds only 0.055 m.
- Inspected screenshots (local `/tmp`, deliberately outside the repo):
  - `/tmp/ludwig_west_south.png`: player `(-160,0,75)`, yaw `π/2` toward south/-X.
  - `/tmp/ludwig_west_side_requested.png`: `(-300,0,-60)`, yaw `π/2`. This point is a mapped internal court, not Theresienstraße. Yaw 0 puts the spring-arm camera inside the adjacent facade; the player position itself is walkable.
  - `/tmp/ludwig_west_wide.png`: `(-250,0,120)`, yaw 0 toward west/-Z.
  - `/tmp/ludwig_west_qa.png`: additional clear Theresienstraße view `(-389,0,-166)`, yaw 0; also the lifecycle/bounds check.
  - `/tmp/ludwig_west_philologicum.png`: closer facade inspection `(-224,0,7)`, yaw 0.

## Integrator requests

1. Import `createBlock` / `LANDMARKS`; create once and add POIs to the chosen minimap/interaction registry. Keep the returned instance for disposal. Shared code has not been edited.
2. Reconcile the street module with **actual oblique Ludwigstraße coordinates**, rather than moving the building footprints. This module includes asphalt inside its own sector only, in the separately named `ludwig_west_ludwig_road` mesh; it can be hidden if the street module replaces it. Sidewalks and lane markings are other shared batches within this module, so a full replacement should also coordinate their surfaces.
3. Do not continue clipped northern building footprints into the core without reconciling core ownership. For a clear street-side photo use the extra Theresienstraße pose above; the requested `(-300,-60)` pose lies in the courthouse court.
4. Distant facades remain subject to the scene's bright exposure/fog. No renderer, light, world-bound, or camera changes were made.
