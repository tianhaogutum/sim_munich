# Ludwigskirche / south-east block

Entry: `project/src/lmu_block_ludwigskirche.js` exports synchronous
`createBlock(engine) -> { group, dispose }` and `LANDMARKS`. Static geometry: no
update callback, animation allocations, npm, build step, image textures or global
engine changes. Import it through the existing Three r160 import map.

## Built

- St. Ludwig: OSM footprint, nave/aisles/transept/eastern semicircular apse, coloured
  roof bands, 71 m twin towers, bell openings, clocks, crosses, rose tracery, five
  facade figures, a three-arch porch and steps.
- Two photo-estimated flanking houses, connected by ten genuinely open arcade
  bays (five per side). Arcade piers have individual collision footprints.
- Bayerische Staatsbibliothek: OSM multipolygon with both open courtyard holes,
  rusticated ground storey, two upper arched-window tiers, 27 facade bays, shallow
  roof masses, three main portals, split exterior stair with balustrades, four
  seated scholars on plinths (Thucydides, Homer, Aristotle, Hippocrates).
- A clipped, explicitly estimated **northern side-wing fragment** of the
  Hauptstaatsarchiv / Ludwigstraße 14. The main central portal is not represented.
- Church forecourt paving, restrained pavement joints, courtyard planting, four
  low-poly trees and two OSM rear-garden stair runs (4 and 12 steps).
- Three Chinese landmark descriptions at walkable approach points.

Five architectural masses, 17 material batches plus two large-mass outlines.
`group.userData.drawCallBudget` = 19; no individual window or statue draw calls.
All building polygons (including courtyard holes), arcade piers and the library
stair register via removable `addBlocker` callbacks. `dispose()` removes the group,
unregisters collision and releases owned geometries/materials, idempotently. It
does not dispose the engine's shared toon gradient textures.

## Important placement deviation

The supplied `date_geo.mjs` origin maps the church to raw z≈24…105 and the library
to raw z≈−40…115. These surveyed positions cannot coexist with the requested
sector z≥100 and protected core. This block therefore applies **one explicit
+145 m eastward offset**, without altering the engine's geographic conversion.
The two OSM outlines and courtyard holes retain their exact shape and scale.
The offset is exported as `PLACEMENT_OFFSET` in the pure data module; landmark
source notes identify the map as a scene illustration. This is a deliberate placement compromise,
not a claim that the resulting map registration is geographically exact.

No geometry enters `CORE_BOUNDS`, and no geometry/road asphalt occupies the
street agent's z<100 strip. The visible forecourt is consequently deeper than in
reality. Resolve district-wide registration before aligning the final streets:
prefer a shared geographic correction over independent per-block offsets.

Other simplifications: 21 m library eaves from photo proportions (OSM `height=15`
is preserved as an original tag); shallow roofs and simplified sculptural details;
church annexes and archive fragment estimated after supplementary OSM failures;
front library stair dimensions estimated from photos. The retained OSM steps are
rear garden paths, **not** the monumental library front stair. No interiors.

## Data and reference provenance

`project/assets/osm/ludwigskirche.json`: trimmed, unmodified OSM elements from
Overpass, 4 elements (church way 25440202, library relation 52412, step ways
533428482 and 533428487), under 10 KB. Full query, timestamp, failed supplementary
queries, placement notes and reference URLs are in
`project/assets/osm/ludwigskirche.sources.json`.

**© OpenStreetMap contributors, ODbL.** The library relation preserves its outer
way 19330223 and inner ways 28494976 / 28495026 as returned member geometry.

Viewed references: Munich city St. Ludwig page; Bayerische Staatsbibliothek's
building page; Literaturportal Bayern on the four figures; Wikimedia Commons
church and archive photographs; a library facade photograph at 24books; official
Bavarian archives address/history. Photos were viewed temporarily for modelling;
**no photo file is included in the repository**. Annex and archive estimates are
labeled separately from the OSM-derived geometry.

## Verification

- `node --test project/tests/lmu_block_ludwigskirche.test.mjs`: **6/6 passed**.
- `node --test project/tests/*.test.mjs`: **48/48 passed**.
- Pure checks cover metre conversion, exact OSM retention, courtyard exclusions,
  all footprint sector/core bounds, walkable landmarks (including stair collision),
  explicit archive clipping and asset size/provenance.
- Browser geometry audit: x −479.800…−143.410, z 100…267.819, highest point 71 m;
  **zero vertices in the protected core**. All three `engine.blocked` POI probes
  returned false.
- Dynamic import via `project/tools/shot.mjs`, server port **8122**, no console
  errors. Requested ground positions are used; screenshot-only `cameraOverride`
  tilts the architectural view upward to fit the 71 m towers. Normal gameplay
  camera and engine remain untouched.
- Screenshots inspected: `/tmp/ludwigskirche-church.png` from (−205, 0, 70),
  `/tmp/ludwigskirche-library.png` from (−330, 0, 70), and
  `/tmp/ludwigskirche-wide.png` from (−120, 0, 60), looking south-east.
- Measured direct scene-render draw calls, same camera/group toggled:
  church view 80 → 97 (**+17**, some batches culled), wide view 82 → 101 (**+19**).
  Default spawn adds **0** calls because this south-east block is outside that
  view frustum. Postprocessing overhead cancels out and block meshes do not cast
  shadow passes. Browser disposal was checked twice: the group detached and its
  former church collision returned false.

## Integration requests

1. Import `createBlock`, instantiate once with the existing engine, retain its
   disposal hook, and feed `LANDMARKS` into the POI/minimap registry. No update
   hook is needed. No shared file was edited here.
2. Resolve the +145 m geographic registration compromise across district modules
   before street/footway alignment. If the integrator instead expands ownership
   to the surveyed location, remove the offset only after reviewing core overlap.
3. Extend the shared base ground/road outside the old x=−300 limit; the library
   camera at z=70 currently sees the original scene's uncovered foreground.
4. Merge the raw OSM attribution into the game's credits.
