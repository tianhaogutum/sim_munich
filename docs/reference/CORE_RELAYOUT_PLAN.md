# Core relayout plan: preserve the date, replace the imaginary geography

Prepared from checkout `19b7914`, 2026-11-09. **Proposal only; no game code changed.** The integrator owns `date_route.mjs`, engine collision, minimap/cinematics and the contract; the scene owner applies the visual reconstruction. Source evidence: [building](LMU_MAIN_BUILDING.md), [squares](SQUARES.md), [OSM-derived geometry](core_world.json), [licensed photo index](PHOTO_SOURCES.md).

## Decision: retain the real-world mapping constants

Keep `date_geo.mjs` `ORIGIN={lat:48.15075,lon:11.58035}` and its metre conversion. Correct the stale `DATE_CONTRACT.md`, route and scene comments to +X **north**, +Z **east**, +Y up. Do not apply an extra 90-degree rotation to imported footprints. The frontage is about 17.7° oblique to +X; its outward normal is roughly `(-.3045,.9525)` in (x,z).

The hardcoded origin is about 13 m west of the **mapped** entrance, not an exact portal centre. In this fixed mapping the centre of the front arcade is around `(2,13)`. Setting the real portal exactly to `(0,0)` would require a coordinated change to ORIGIN and regeneration of **all** districts, not a cosmetic translation of the core. That larger migration is **not recommended for this pass**. Explicitly describe the current origin as approximate. The fountain nodes map to `(-8.3594,45.6313)` and `(-24.1936,97.8875)`; the brief's east-fountain `z≈120+` is not supported by this extract.

## Proposed route and invariant IDs

Keep all stage IDs, POI IDs, photo IDs and storage identifiers. Move **coordinates**, not story-state names; restore/save/restart remains compatible. Narrative markers are deliberately placed at accessible approach points, not buried in the facade or at the centre of a basin.

| Item | Proposed (x,z) m | Reason |
|---|---|---|
| `POIS.entrance` | `(4,16)` | Outside the mapped front wall near the central arcade, with clear approach from the south. |
| `POIS.white_rose` | `(-4,18)` | Near mapped memorial anchor `(-2.97,14.72)`, shifted slightly outward for interaction. 8.25 m from entrance marker to reduce nearest-POI ambiguity. |
| `POIS.fountain` | `(-5.9,38)` | On the portal-side approach to the **west** fountain, 8.02 m from basin centre, beyond r=6.1 collider. |
| `POIS.our_plaza` | `(-16,53)` | On the outward continuation of the west fountain's paved axis; 10.61 m from centre, away from its rim and the main road. |
| `POIS.memento` | `(-29,23)` | Beside tree 2090080147 at `(-30.11,26.42)`, on the accessible side, away from its trunk and mapped bench. A fictional dropped object, not a new historical fact. |
| `COMPANION.waitAt` | `(6.5,20)`, yaw `-.31` | Visible near entrance; 4.72 m from entrance marker, outside the front footprint. Face roughly outward; verify the final character model's forward axis. |
| `COMPANION.fountainSeat` | `(-3.1,38.9)` | 8.54 m from basin centre; conversational standing spot despite the legacy field name “Seat”. Do not add an invented bench at the lip. |
| `SPAWN` | `(-52,24)`, yaw `-1.4288992721907328` | Clear south-forecourt approach, about 56.6 m from entrance. Camera yaw is `atan2(spawn.x-entrance.x,spawn.z-entrance.z)` so the approach looks toward the entrance. |
| `CORE_BOUNDS` | X `[-145,125]`, Z `[-145,170]` | Covers mapped main-building/back masses, both squares and near street connections for testing. **Not a solid obstacle or a blanking mask.** |
| `BOUNDS` | unchanged | Preserve wider-district walkability. |

Fountains in data are ordered **west first, east second**; render both, and keep quest conversation/photo/audio focus on the west one. Radius 6.1 is a conservative collision envelope for the mapped outer octagon, not a claim of a 12.2 m water basin. For a closer physical fit, replace the circle with the measured basin polygon plus player clearance, but keep route tests consistent.

**All mandatory activities stay west of the arterial.** Professor-Huber-Platz remains explorable. A mandatory crossing would need safe traffic/companion behaviour and is unnecessary to preserve this chapter. Real-world walking legs are shorter than the old stylisation; achieve the intended 10–15 minutes through dialogue, optional inspection and photos, not an invented 70 m fountain separation.

### `proposed_route.json`

The standalone [proposed_route.json](proposed_route.json) is identical to this JSON. Copy fields into exports mechanically; JSON is not itself an ES module. Keep `ROUTE` exporting the same keys.

```json
{
  "STAGES": [
    "meet",
    "fountain_talk",
    "find_memento",
    "photos",
    "postcard",
    "done"
  ],
  "POIS": {
    "entrance": {
      "x": 4,
      "z": 16,
      "label": "LMU 主入口"
    },
    "white_rose": {
      "x": -4,
      "z": 18,
      "label": "白玫瑰纪念地"
    },
    "fountain": {
      "x": -5.9,
      "z": 38,
      "label": "喷泉"
    },
    "our_plaza": {
      "x": -16,
      "z": 53,
      "label": "我们的广场"
    },
    "memento": {
      "x": -29,
      "z": 23,
      "label": "纪念物"
    }
  },
  "INTERACT_RADIUS": 6.5,
  "FOUNTAINS": [
    {
      "x": -8.359394400264932,
      "z": 45.63130378085752,
      "r": 6.1
    },
    {
      "x": -24.193591199885475,
      "z": 97.88746481646685,
      "r": 6.1
    }
  ],
  "COMPANION": {
    "waitAt": {
      "x": 6.5,
      "z": 20,
      "yaw": -0.31
    },
    "followDistance": 2.2,
    "catchUpDistance": 28,
    "fountainSeat": {
      "x": -3.1,
      "z": 38.9
    }
  },
  "PHOTO_TARGETS": [
    {
      "id": "facade",
      "label": "主楼与拱廊",
      "target": {
        "x": 2,
        "y": 11.5,
        "z": 13.8
      },
      "minDist": 22,
      "maxDist": 75
    },
    {
      "id": "fountain",
      "label": "喷泉",
      "target": {
        "x": -8.359394400264932,
        "y": 4.5,
        "z": 45.63130378085752
      },
      "minDist": 7,
      "maxDist": 32
    },
    {
      "id": "couple",
      "label": "我们的合影",
      "target": "companion",
      "minDist": 2,
      "maxDist": 9
    }
  ],
  "SPAWN": {
    "x": -52,
    "z": 24,
    "yaw": -1.4288992721907328
  },
  "BOUNDS": {
    "minX": -520,
    "maxX": 520,
    "minZ": -320,
    "maxZ": 420
  },
  "CORE_BOUNDS": {
    "minX": -145,
    "maxX": 125,
    "minZ": -145,
    "maxZ": 170
  }
}
```

The `facade` label now says **拱廊** (arcade), not 廊柱 (colonnade). The target sits just outside the facade surface so a wall-centre ray does not require looking through the wall. The fountain target follows the west fountain, not the east one. All current min/max distances are preserved:

| Goal | Target (x,y,z) | Distance limits | Candidate camera position (x,y,z) | 3D distance |
|---|---|---|---|---:|
| facade | `(2,11.5,13.8)` | 22…75 m | `(26,10,32)` | 30.16 m |
| fountain | `(-8.3594,4.5,45.6313)` | 7…32 m | `(-19,8,30)` | 19.23 m |
| couple | live companion head | 2…9 m | pose from a free path near fountain/entrance | dynamic |

These camera samples are **distance-valid examples, not completed photograph validation**. In the integrated build aim at the target, wait for the camera spring to settle, verify in-frame projection and occlusion at both phone and desktop aspect ratios. Facade foliage, foreground piers and the fountain's own geometry must not make every shot impossible. Do not raise `maxDist` to conceal a wrong coordinate or silently credit arbitrary shutter presses.

## Concrete scene changes

1. **Remove the false road** from `GROUND + ROADS`: `roadCx=D.roadX+D.roadW/2`, `roadX=112`, road width 33 along **Z**, all associated longitudinal dash and cycle-strip geometry. The real artery runs NNE along **X**, through roughly Z=70…90 at X=0, then farther east as X increases. Build from ways 151334113/50220178/48242678 and sidepaths 47229154/88890339. Preserve the differing 4-lane and 5-lane segments; kerb locations remain estimates, see SQUARES. No huge straight band that intersects a fountain.
2. **Replace the solid 160×22 slab and adjacent placeholder boxes** with OSM polygon/segmented footprints for A/D/E/F, then the rear B/C/M/N masses as needed. Use `core_world.json` rings. Keep the open U-shaped forecourt. The 160 m value is a broad shoulder span, not the recessed 124 m wall length. Scene visual mesh and engine blocker must use the same footprint.
3. **Delete the external colonnade** loop, capitals, bases and entablature; remove the false elevated central pediment. Build the nine-bay masonry arcade, paired upper windows and three principal levels. Avoid retaining the single 7×10 door or a fourth row of upper windows. Draw arched openings in the vertical facade plane; the old entrance rotation lays the shape down.
4. **Replace the roof plates** with low red pitched/hipped roofs; keep the centre cornice broadly continuous. Give the rear Lichthof a restrained, provisional skylight only after front massing is correct. Do not place a glass dome at the main portal.
5. **Replace the fountain `for (sx of [-1,1])`** and `D.fnX/fnY` positions with `ROUTE.FOUNTAINS`. Construct two octagonal granite basins and two bowls each. The same centres must drive meshes, collision, sound, quest focus and photograph targets. Do not leave the original ±35 basins visible after changing route data.
6. **Replace 200×80 blanket plaza paving** with the architectural forecourt, mapped lawns 126489045/46/47/51 and their paths. The reconstructed square envelopes are ownership/planning geometry, not exact grass or kerb boundaries. Keep the east square interrupted by Veterinärstraße.
7. **Remove the hardcoded `treePts` square rows** at x=±18/±36/±54/±90 and Z=16/58/72 etc. Use mapped tree points in SQUARES, preserving broadleaved crowns and clearance. Do not scatter trunks in the central entrance/fountain line. The memento sits beside mapped tree 2090080147, not at an old nonexistent tree.
8. **Replace `benchXs` and `lampXs` rows** with mapped positions. The inventory includes wood backed/backless benches, stone seats/bollards near the entrance, straight plaza masts and bent street lights; no six-copy bench line across the plaza. Derive yaw from adjacent path tangents and photo evidence; OSM nodes do not supply a verified facing.
9. **Move the memorial visual and optional signage** to its actual near-entrance pavement setting. Keep the scattered ceramic-sheet character and nearby bollards; do not make a tall plaque at old `(0,55)`. Move the fictional relationship plaque near the new entrance without occupying a real arch or memorial sheet.
10. **Reframe petals and ambient paths** around the new geometry. Sakura is a stylistic effect, not evidence that these trees are cherries. Keep particle distribution and ambient actors out of the arcade and road, and avoid blocking photo sightlines.

## Required integration outside the scene region

These are integrator tasks, not permission to silently leave visible/logic mismatches:

- **Engine `solids` / `blocked`:** delete the old rectangle `(cx=0,cz=-11,hw=81,hd=13)` and the two giant side boxes `(±112,-26,52,52)`. Register actual polygons, including the hollow U layout, through `addBlocker`. Do not register the whole roof-part polygon and building parts twice as overlapping courtyard-filling AABBs. `heightAt=0` cannot support real multi-step traversal: keep approach paths ground-level until proper vertical movement exists.
- **`tests/route.test.mjs`:** its source guard explicitly requires bW=160/bDepth=22 and an exact copy of the old three-box collision array. Update the independent model and reviewed guard to the new production collision representation. Preserve the synchronisation check; do not merely delete it to get green tests. A polygon-aware independent implementation can share fixture data but should not call the production `blocked` function as its oracle.
- **`date_map.js`:** currently hardcodes the old 112…145 road, 160×22 building, ±35 fountains and tree layout. Update the map geometry and bounds/overview framing, not just POI dots. The geographic north arrow must reflect +X, even if screen-map axes remain x horizontal / z vertical.
- **`date_cinematic.js` + `date_cinematic_paths.mjs`:** both select `FOUNTAINS[1]` (previous quest fountain). With west-first ordering, use the west fountain explicitly, preferably by the quest/photo subject rather than a magic index. Reframe entrance and return reveal against the oblique facade. Do not reverse FOUNTAINS alone as a workaround without reviewing every consumer.
- **`lmu_life_sim.mjs` / `lmu_life.js`:** pedestrian LOOPS, flock starts and bounds are old coordinates. Retarget paths to the mapped west/east walkways and safe crossing. The current decorative tram travels along the old road (`tramAtTime` varies Z); the station plan supplies U-Bahn and buses here, not a verified present-day surface tram. Remove that false tram route or deliberately classify it as fantasy; do not just shift it onto real Ludwigstraße.
- **`date_collect.js` and helpers:** placement reads POIs/fountains, but fallback offsets must be rechecked against polygons and new r=6.1. Preserve collectible IDs and save compatibility; inspect fallback positions and tree/bench-dependent hints.
- **Story/photo/cast owners:** preserve stage gates, choice IDs, saves and automatic follow behaviour. Move positions via route data; verify nearest-POI selection around entrance/memorial, blocked recovery and companion separation. The legacy cast's long-distance snap `(player+1.5,+1.5)` is not guaranteed walkable in the new footprint.
- **Sightseeing text / DESIGN / DATE_CONTRACT:** correct the false eight columns, orientation and old coordinates; describe the two fountains on opposite squares. Do not keep “confirmed” tags on `roadX=112` or photo-estimated architecture dimensions. Keep memorial history separate from romantic game dialogue.

## Migration order with reviewable gates

**A. Data-first agreement.** Import the proposed JSON into route exports; agree west/east fountain identity. Update coordinate comments. Prepare polygon blockers and independent test fixtures from the same reviewed OSM inventory. No full-mesh move until route and collision land together.

**B. Coarse mesh plus collision.** Replace old road/building/plaza masses and basins in one integration pass. Remove old solids; add polygon blockers. Check spawn and all POIs before decorative work. Keep a walkable 2–3 m clearance at route approach points; a visible doorway need not imply a playable interior.

**C. Align every consumer.** Update minimap, ambient actors, cinematics and audio/photo focus, then relocate tree/bench/lamp/memorial detail. Confirm no old duplicate core or hardcoded ±35 fountain survives. Use `rg` to audit `112`, `145`, `fnX`, `fnY`, `FOUNTAINS[1]`, `x:35`, `z:48`, and stale axis comments. Numeric matches in unrelated animation code are not automatically defects.

**D. Run pure checks.** From the repo root:

```sh
node --test project/tests/route.test.mjs
node --test project/tests/
```

The route suite must still test (1) sync of production collision and independent model, (2) unblocked/in-bounds spawn/POIs/companion spots, (3) flood-fill reachability, (4) valid photo distance ranges and reachable samples, (5) unchanged stage/objective mappings. Ensure the flood-fill core includes the whole new route and both squares. Add collision cases at the empty forecourt and around the north/south return walls so an accidental bounding-box fill is caught.

**E. Run actual browser playthrough after the code is integrated.** The supplied harness can auto-serve only localhost:8109; otherwise start the static server deliberately on an available project port. Avoid stopping any server owned by another task.

```sh
node project/tools/playthrough.mjs http://localhost:8109 --out-dir /tmp/lmu-relayout-qa
```

Read the generated report and console logs rather than assuming screenshots mean success. Walk normally from spawn → entrance → fountain dialogue → memento → three distinct **valid** photos → our_plaza/postcard. Run both dialogue choices, reload mid-stage, save recovery and restart. Also physically traverse around each basin and both return wings; a teleport-based harness alone does not validate those narrow routes. Inspect desktop/mobile camera framing, the target's own-mesh occlusion handling, target credit, companion head position, touch/gamepad and the minimap. Cross to Professor-Huber-Platz at a safe path once to check new world connectivity, even though the chapter does not require it.

**F. Review geometry, then detail.** Compare the entry shot and fountain shot with the linked photos: one west fountain, one east fountain; road between; low red roof; three storeys; nine arcade openings; no exterior freestanding colonnade. Only then fine-tune relief, planting, materials and particles. Verify no new console errors, clipping or unacceptable draw-call/point-light growth.

## Checks actually completed for this research proposal

- Baseline `node --test project/tests/route.test.mjs`: **5/5 pass** at unchanged production code. This is baseline evidence only, not a pass for a relayout that has not been implemented.
- Independent temporary proposal check: mapped **building polygons + r=6.1 fountain circles**, 1 m four-connected flood fill with ten segment samples per edge; **38,482 reachable cells**, all five POIs, spawn, waitAt and fountainSeat reachable and outside blockers.
- Candidate facade/fountain camera points satisfy the unchanged 3D distance windows: **30.16 m** and **19.23 m**. No renderer/occlusion or companion-photo validation was run for the proposed geometry.
- JSON parsing and conversion from both original fountain nodes reproduce the listed coordinates. Polygons, rendering, live traffic and exact kerbs are not field-verified. The browser playthrough belongs after integration; there is no claim it passed here.

The stored [proposal_check.json](proposal_check.json) is the numeric check result, with its restricted scope stated. It is not a runtime test fixture or a substitute for `route.test.mjs`.
