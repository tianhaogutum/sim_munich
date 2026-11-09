# Munich city-scale navigation and exploration data

Implemented 2026-11-09. This is a navigation/data layer for a streamed city game, alongside the separately handcrafted LMU chapter.

## Scope and honesty

- `CITY_BOUNDS` is a broad playable **rectangle**: longitude 11.35–11.80, latitude 48.05–48.27. It contains Munich and some surrounding land. It is **not** the legal municipality polygon.
- `CITY_DISTRICTS` contains the city's 25 official district names. Its coordinates are approximate navigation anchors, not administrative centroids or district boundaries.
- `CITY_PLACES` provides 37 named outdoor destinations across the centre, north, south, east and west. Coordinates are rounded navigation points rather than surveyed entrances; building collision and safe arrival must be handled against the rendered map.
- `CITY_SECTORS` divides the playable rectangle into 100 regular work cells. Each is explicitly marked `detailed-reference-refinement-pending`. These are neither 100 finished models nor evidence that 100 agents were started.
- Fine street/building geometry is supplied by the streaming renderer. Missing source heights, decorations and facade details remain approximations. These data files do not fabricate individual building geometry.

## Sources

The authoritative [City of Munich district directory](https://stadt.muenchen.de/rathaus/daten-fakten/bezirke.html) was checked for all district names and numbers. The [official city sightseeing overview](https://www.muenchen.de/en/sights/sightseeing-25-top-sights-and-attractions-munich) and direct landmark institutions provide place context. Named institutions have direct source links in `CITY_PLACES` (LMU, Residenz, Pinakothek, Deutsches Museum, Olympiapark, Nymphenburg, BMW Welt and Allianz Arena). Every destination also has a coordinate-specific OpenStreetMap link. Navigation anchors are explicitly marked approximate; they were not all newly surveyed from OSM nodes.

No copyrighted city photography is embedded by these modules. Existing locally licensed comparison photographs are maintained separately in `assets/reference_photos/sources.json`.

## Contracts

`city_data.mjs` exports `CITY_BOUNDS`, `CITY_ORIGIN`, `CITY_DISTRICTS`, `CITY_PLACES`, `CITY_SECTORS`, `CITY_TRAILS`, `cityToLocal` and `localToCity`.

- Coordinates use `{lon,lat}` in WGS84.
- Local helpers use metres around LMU, **+X east and +Z south**. This intentionally differs from the handcrafted LMU chapter's north/east frame. Do not mix the two frames without conversion.
- `cityToLocal(lon,lat)` returns `{x,z}`; `localToCity(x,z)` returns `{lon,lat}`. The simple local projection is for game navigation, not cadastral measurements.

`city_rules.mjs` exports versioned `loadCityProgress` / `saveCityProgress`, sanitization, clamping, Haversine distance, proximity discovery, movement accounting, mission progress and sector lookup. Storage denial/corruption does not stop play.

Four exploration trails link university to old town, museums to gardens, Nymphenburg to the Olympic area, and the Isar to the eastern city. Proximity discovery defaults to 65 metres. Fast travel does not count as walking; movement accounting excludes discontinuities over 80 metres.

## Verification

```sh
node --test project/tests/city_data.test.mjs
```

Eight tests cover unique district/destination/trail IDs, bounded coordinates, east/south frame and round trips, all 100 sector centres/edges, real proximity, immutable timestamps, malformed/future saves, fast-travel distance exclusion, trail completion and private-mode storage.

Runtime and visual checks belong to the city renderer and `tools/city_validation.mjs`; unit tests alone do not prove network tile availability or city-wide collision fidelity.
