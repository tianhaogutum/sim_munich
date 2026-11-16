# Whole-city acceptance checks

`project/tools/city_validation.mjs` exercises the city page in a fresh, real headless Chrome profile. Downloads stay in its disposable profile. It does not replace vector tiles, fabricate building geometry, or grant exploration/photo credits.

```sh
node project/tools/city_validation.mjs http://localhost:8100/ --out-dir /tmp/lmu-city-qa-sol
```

The checks inspect actual OpenFreeMap network resource requests and loaded OpenMapTiles building features in five distant areas: LMU, Marienplatz, Nymphenburg, Olympiapark and Messestadt. They inspect positive building heights and real fill-extrusion style layers, move the avatar with real keyboard input, find a loaded building polygon edge for a wall-collision approach, reload a saved location and inspect attribution/return links. Screenshots and JSON evidence are written under the supplied output directory.

## What this can establish

- Geographic streaming coverage at the sampled districts and buildings with source-derived height properties.
- A functioning city-scale exploration page, genuine input and collision against loaded footprints.
- The presence of 25 district records, 100 planned refinement sectors and persistent player state.

## Limits

- Bounding-box extent is not an exact municipal boundary.
- Streaming footprint extrusion is not photogrammetry, textured street-view reconstruction, or individually modeled interiors.
- Collision at unloaded tiles, full pedestrian connectivity and every building in Munich are not proven by a five-location sample.
- Headless Chrome may use hardware acceleration; the tool makes no software-renderer or universal FPS claim.

## Latest run

Tested **2026-11-09T10:50:44.823Z**, using the integrated city page: **14 PASS / 0 FAIL**. No runtime/browser errors during the normal online suite. The final network-interruption check deliberately blocked OpenFreeMap and confirmed an explicit failure/loading message rather than a silent blank page.

The CDP client also attached to dedicated map workers. It retained **7 successful HTTP 200 vector-tile responses**, including:

- `https://tiles.openfreemap.org/planet/20261101_080013_pt/14/8719/5685.pbf`
- `https://tiles.openfreemap.org/planet/20261101_080013_pt/14/8715/5684.pbf`
- `https://tiles.openfreemap.org/planet/20261101_080013_pt/14/8724/5686.pbf`

These are genuine map tile requests, distinct from glyph `.pbf` files. Full request/response records, loaded feature counts and screenshots are in `/tmp/lmu-city-qa-sol/report.json`.

Verified outcomes:

- Real building features and positive source heights loaded at LMU, Marienplatz, Nymphenburg, Olympiapark and Messestadt.
- The Three.js walking cast custom layer exists with scene objects; the LMU screenshot visibly includes the heroine, companion and dog.
- Real keyboard walking moved approximately **2.19 m** in the sample; Shift running moved **5.17 m**. The test asserts that running is faster.
- A source-polygon wall approach recorded **88 frames**, useful movement toward the wall, and no entry into the building footprint.
- Location/discoveries survived reload with **0 m** location offset.
- All four outside-rectangle directions are blocked by the runtime collision rule.
- Required map attribution and return link to the detailed LMU game are present.

The full-suite snapshot retained six nonfatal public-style numeric-null warnings during initial style parsing. The renderer subsequently moved height fallback normalization before the style is loaded; a separate fresh smoke check is recorded below. Those warnings were not runtime exceptions.

Fresh post-fallback smoke check: initial LMU ready/cast checks and real Marienplatz travel both succeeded; `shot.mjs` reported **no console errors or warnings**. Screenshot: `/tmp/lmu-city-final-smoke.png`. Immediately after arrival/orbit adjustment the tile-source readiness flag can briefly be false while newly visible tiles arrive; movement is gated during that interval.

Remaining visual limitation: the Marienplatz arrival camera can still place foreground roof geometry across most of the avatar bodies, despite a collision-safe standing point and attempted arrival-bearing selection. The final smoke screenshot shows their heads above the foreground roof. Correctness checks for location/collision do not establish unobstructed third-person framing; further camera visibility handling or an occluded-avatar indicator would improve narrow-street play.
