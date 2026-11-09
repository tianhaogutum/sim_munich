# Ludwigskirche / south-east block

## Integration contract

`project/src/lmu_block_ludwigskirche.js` exports synchronous `createBlock(engine)`
and `LANDMARKS`; retain the returned `{ group, dispose }`. There is no animation
callback, npm dependency, image texture or shared-engine edit. Load through the
existing Three r160 import map. Every footprint, architectural frame, approach
point, paving patch and estimated archive anchor is derived from WGS84 using
**the shared `date_geo.toWorld` / `ringToWorld`, without a block-local offset**.
The earlier +145 m workaround has been removed.

A test substitutes a recalibrated geographic conversion and verifies every
surveyed vertex and every POI follows it automatically. Do not translate this
block again during integration.

## Built and retained

- St. Ludwig: exact OSM footprint, 71 m twin towers, clock/bell openings, rose
  tracery, five facade figures, triple-arch porch, nave, transept, eastern apse,
  coloured roof bands, ten open side-arcade bays and forecourt steps.
- One estimated southern annex. The estimated northern parish-house mass is
  **omitted**, because its current projected footprint overlaps `CORE_BOUNDS`.
- Staatsbibliothek: exact OSM multipolygon with two open courts, 27 facade bays,
  rusticated ground storey, two upper arched-window tiers, triple portal, split
  staircase/balustrade and four seated scholars (Thucydides, Homer, Aristotle,
  Hippocrates).
- A geographically anchored, estimated northern side-wing fragment of the
  Hauptstaatsarchiv, clipped at a geographic latitude boundary; no main portal.
- Small facade-relative paving patches, two OSM garden stairs (4 and 12 steps),
  courtyard planting and three walkable Chinese landmark approach points.

There are 17 material batches plus two major-mass ink outlines: maximum **19
scene draw calls**. No separate window/figure draw calls or per-frame allocations.
Collision uses removable `addBlocker` predicates for all buildings, arcade piers
and the library stair. Disposal is idempotent and releases only owned resources.

## Ownership and street-agent conflict

The latest instruction prioritizes exact surveyed coordinates. Under the present
origin the church spans x≈−240.609…−180.777, z≈24.004…105.248 and the library spans
x≈−454.382…−287.139, z≈−40.462…114.791. **A z≥55 limit cannot contain these complete
footprints.** They are therefore retained intact for the integrator's shared
recalibration; neither clipping nor a private translation conceals that conflict.
This extends west of the proposed z≥55 strip and needs coordinated ownership.
No geometry enters the protected core. No road asphalt is laid by this module.

The exact current-coordinate overlap with the street agent's band is:
`surveyed building polygon ∩ {x < −150, 55 ≤ z ≤ 105}`, minus courtyard holes.
The table gives bounding boxes, not substitute box-shaped obstacles. Full ordered
intersection rings below and in `assets/osm/ludwigskirche_alignment_report.json`
are the authoritative conflict polygons. `STREET_OVERLAPS` also exports them from
the pure data module and recomputes them under the shared conversion.

| Footprint | Overlap x extent (m) | Overlap z extent (m) | Area excluding holes (m²) |
|---|---:|---:|---:|
| st-ludwig | -240.609024…-193.332047 | 55…105 | 1737.286362 |
| staatsbibliothek | -452.424578…-304.320840 | 55…105 | 3234.978736 |

Other building/piers and the facade paving do not intersect that band with the
current origin. The street agent must cut around the actual overlap polygons,
not place asphalt through them. Recompute after the integrator changes `date_geo`.

### st-ludwig overlap ring

```text
(-227.658992041, 55.000000000)
(-229.352590800, 60.306996533)
(-233.864010000, 58.851310410)
(-240.277302000, 78.933837335)
(-235.887514200, 80.352388608)
(-240.609024000, 95.146912880)
(-210.137567298, 105.000000000)
(-209.292931956, 105.000000000)
(-204.650359200, 90.438213890)
(-200.901900600, 91.648810003)
(-194.466493800, 71.462305498)
(-198.192837600, 70.251709385)
(-197.031810601, 66.605067107)
(-193.332047009, 55.000000000)
```

### staatsbibliothek overlap ring

```text
(-304.320839693, 55.000000000)
(-306.323152200, 61.406188096)
(-304.996264200, 61.829525387)
(-310.502849400, 79.431444326)
(-387.548603406, 55.000000000)
(-395.764016541, 55.000000000)
(-396.507306600, 57.388197317)
(-394.041506400, 58.175456139)
(-408.701119478, 105.000000000)
(-442.642682322, 105.000000000)
(-452.424578400, 101.898028625)
(-437.749598325, 55.000000000)
```

Subtract courtyard fragment:

```text
(-325.087560000, 55.576016633)
(-326.905263980, 55.000000000)
(-324.907709658, 55.000000000)
(-325.087560000, 55.576016633)
```

## Raw OSM alignment evidence

Raw latitude/longitude is listed in **lat, lon** order. OSM IDs and original
attributes are preserved in `assets/osm/ludwigskirche_alignment.json`. The original
Overpass building response is `assets/osm/ludwigskirche.json`. Derived world
coordinates and the interpolated road point are in the alignment report JSON.

| Feature | OSM reference | Raw latitude | Raw longitude |
|---|---|---:|---:|
| LMU outer east facade at portal approach | node 5991588504, way 17973243 | 48.1507656 | 11.5805281 |
| Same facade, south line endpoint | node 186038994 | 48.1505433 | 11.5804233 |
| Same facade, north line endpoint | node 186036551 | 48.1509452 | 11.5806127 |
| LMU recessed central main door, **distinct from outer facade** | node 5991588498 | 48.1508104 | 11.5803285 |
| Ludwigstraße centerline, south bracket at church | node 1078841388, way 242358064 | 48.1488930 | 11.5805219 |
| Ludwigstraße centerline, north bracket at church | node 1954419, way 242358064 | 48.1489839 | 11.5805644 |
| Church west facade, north end | way 25440202 vertex 0 | 48.1491151 | 11.5808695 |
| Church west facade, south end | way 25440202 vertex 5 | 48.1487074 | 11.5806732 |

At the church facade midpoint latitude **48.14891125**, linear interpolation of
the two raw road nodes gives longitude **11.580530432728272** (derived, not a raw
OSM node). With ORIGIN=(48.15075, 11.58035), that road point is
**(x=−203.3179425, z=13.4006846)**. The outer LMU portal facade node is
**(x=1.7249544, z=13.2274336)**; the recessed door is
**(x=6.6786696, z=−1.5967986)**. Thus the current origin is near the recessed door
but not on the outer facade line. The assumption that the road at the church
runs at z=55…105 is also inconsistent with the raw road survey. The street is
oblique in north/east coordinates; these measurements do not support a private
145 m translation. The integrator should choose the shared origin/frame using
this evidence; this block will follow automatically.

## Provenance and simplifications

**© OpenStreetMap contributors, ODbL.** All queries, timestamps, references and
failure records are in `assets/osm/ludwigskirche.sources.json`. Initial building
footprints and stairs came from Overpass. For the newly requested reference lines,
three Overpass attempts failed (502, timeout, 502); the read-only OSM `/api/0.6/map`
endpoint succeeded. Its XML node/way attributes were losslessly serialized to a
trimmed JSON asset; coordinates were not adjusted. No API data is executed.

Reference photos were viewed only: Munich city's church page, library building
page, Literaturportal Bayern's four scholars, Commons church/archive photographs
and a library facade photograph. No photographs are copied into the repository.
Library eaves are a 21 m visual estimate (original OSM height=15 remains in tags).
Annex/archive geometry and the monumental front stair are photo/map estimates;
the two OSM stair runs are rear garden stairs, not the monumental front stair.

## Verification and handoff

- Pure block tests: **7/7**; repository tests: **49/49**.
- Exact OSM-coordinate equality for both full outer rings, open-court collision,
  all POI walkability, core exclusion, street-band intersections, no-offset
  recalibration behavior and attribution/asset bounds are covered.
- Browser audit after removing the offset: x≈−479.781…−158.823,
  z≈−50.676…122.819; **zero mesh vertices inside CORE_BOUNDS**.
- Corrected wide-view scene draw calls: **85 → 104 (+19)**.
- Dynamic import screenshots: `/tmp/ludwigskirche-surveyed-church.png`,
  `/tmp/ludwigskirche-surveyed-library.png`,
  `/tmp/ludwigskirche-surveyed-wide.png`; no console errors.
- The original church camera (−205,70) lies inside the corrected church footprint;
  the old library camera (−330,70) is also unsuitable after restoring survey
  placement. Updated street-side views look east from z<0. A screenshot-only
  camera override frames the tall church; the gameplay camera is unchanged.
- Integrator: instantiate module, register `LANDMARKS`, coordinate the exact
  overlap rings with the street agent, recalibrate the shared origin if desired,
  and merge OSM attribution into credits. Review remaining west-of-z55 ownership
  from the exact footprints. Extend base ground where the old ±300 m plane ends.
