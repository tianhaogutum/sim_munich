# The two university squares and Ludwigstraße

Research: 2026-11-09, based on Overpass snapshot `2026-06-01T08:52:28Z` as returned by the server. All coordinate pairs below are **(x, z) metres**, using the actual `date_geo.mjs` constants: `ORIGIN=(48.15075,11.58035)`, +X true north, +Z true east. Decimal precision is reproducibility, not survey accuracy; allow roughly 1–3 m for mapped objects and more for estimates.

## Essential correction: mapping is not an axis-aligned postcard

Geschwister-Scholl-Platz is **west** of Ludwigstraße at the main entrance; Professor-Huber-Platz is **east** of the road. There is **one** Schalenbrunnen on each side. The LMU east frontage and road run approximately 17–18° east of true north, so neither lies along a constant game X or Z. The current `date_geo` comment “portal = origin” is only approximate: the mapped central frontage is around `(2,13)`. Do not translate or rotate new OSM districts merely to preserve the old stylised core. Keep the existing mapping and place the core on it.

The supplied brief's approximate `z≈120+` for the east fountain is not the result of these constants and the returned nodes: it is **z=97.887**. Its node is consistent with the mapped basin and the two semicircular lawn/road layouts. Moving it to z=120 would put it near the eastern arc, rather than in its centre. [Municipal square overview](https://www.muenchen.de/sehenswuerdigkeiten/sehenswerte-plaetze/geschwister-scholl-platz), [official LMU restoration account](https://www.lmu.de/de/die-lmu/struktur/zentrale-universitaetsverwaltung/presse-und-kommunikation-puk/press-room/pressemitteilung/erstmal-ausgesprudelt-die-lmu-brunnen-werden-saniert-8cfa7a24.html).

## Data, footprint status and reproducible polygon vertices

[core.json](../../project/assets/osm/core.json) retains raw OSM tags, IDs and WGS84 geometry; [core.sources.json](../../project/assets/osm/core.sources.json) records query, endpoint, timestamp, trimming and attribution. [core_world.json](core_world.json) contains the transformed geometry, including **all vertices**, without hand transcription.

No `place=square` polygon or surveyed continuous kerb line was returned. Consequently the following square polygons are **reconstructions**, not OSM area objects or legal boundaries. The road/footway and lawn/basin geometries used to derive them are mapped. The semicircular rings close the street-centreline arc with a straight chord; subtract road width before using them as lawn or collision masks. The architectural envelope is useful for scene ownership, not for filling the whole forecourt with grass.

### Geschwister-Scholl-Platz inner semicircle

INFERRED area from mapped street centreline plus straight closing chord; not surveyed kerb or legal boundary. Source ways: 19423091.

```text
(38.99, 65.56), (37.30, 56.39), (34.11, 47.62), (29.53, 39.51), (23.70, 32.28), (16.74, 26.11), (8.87, 21.19), (0.29, 17.65), (-5.54, 16.13), (-15.60, 15.03), (-25.70, 15.79), (-35.49, 18.36), (-44.53, 22.60), (-52.68, 28.39), (-59.68, 35.54), (38.99, 65.56)
```

### Geschwister-Scholl-Platz architectural forecourt

INFERRED polygon between mapped U-wing inward faces; includes paved margins beyond inner semicircle. Source ways: 17973028, 17973432, 477871713.

```text
(-57.37, -5.47), (60.56, 32.23), (47.85, 71.77), (-69.78, 33.93), (-57.37, -5.47)
```

### Professor-Huber-Platz inner semicircle

INFERRED area from mapped street centrelines plus straight closing chord; arc interrupted by Veterinärstraße; not surveyed kerb or legal boundary. Source ways: 456746079, 47228748.

```text
(-32.78, 125.01), (-24.98, 126.62), (-22.60, 127.11), (-12.20, 127.27), (-1.95, 125.49), (7.79, 121.82), (16.69, 116.39), (24.44, 109.40), (31.24, 99.91), (33.94, 92.43), (-39.92, 122.28), (-46.55, 118.64), (-52.62, 114.13), (-58.04, 108.84), (-62.74, 102.82), (-66.57, 96.20), (-69.47, 89.12), (-71.40, 81.71), (-72.30, 74.11), (-72.18, 66.45), (-32.78, 125.01)
```

## Fountains: positions, basins and proportions

| Side | OSM node / lat, lon | Game centre | Basin way | Collider proposal |
|---|---|---|---|---|
| West / Geschwister-Scholl | [201978860](https://www.openstreetmap.org/node/201978860) / 48.1506744, 11.5809644 | (-8.36, 45.63) | [126489049](https://www.openstreetmap.org/way/126489049) | r=6.1 m, conservative mapped outer footprint |
| East / Professor-Huber | [201979156](https://www.openstreetmap.org/node/201979156) / 48.1505312, 11.581668 | (-24.19, 97.89) | [126489050](https://www.openstreetmap.org/way/126489050) | r=6.1 m, conservative mapped outer footprint |

Separation of mapped fountain centres: **54.60 m**, mostly east–west, with the east one **15.83 m farther south**. It is not a pair at ±35 X with shared Z.

The city gives **about 10 m basin diameter and 8.20 m cast-iron column height**; these are sourced approximate dimensions, not a laser survey. The design is **two stacked bowls**, a broad lower bowl and a smaller upper bowl, over an **octagonal** Hauzenberg granite basin/base. The 2021 photo shows people seated on the rim, with basin wall around waist height; OSM basin polygons carry `height=1.10`. The mapped polygon outer extents are approximately 11.2–11.4 m in the world X/Z directions; this is not proof of 11.4 m water diameter. It may include outer stone/apron and mapping tolerance. Use 10 m as the documented nominal basin dimension and retain a conservative 6.1 m collider until the scene's final outer rim is measured. Do not turn the 8.2 m column into an additional 8.2 m shaft plus a metre of bowls on top. [City LMU overview](https://www.muenchen.de/sehenswuerdigkeiten/bauwerke-und-denkmaeler/ludwig-maximilians-universitaet), [Commons 2021 west fountain](https://commons.wikimedia.org/wiki/File:Geschwister-Scholl-Platz_2021.jpg).

Suggested visual proportions, **photo estimates only**: outer lower bowl diameter 4.0–4.8 m; upper bowl 2.4–3.2 m; lower bowl lip y≈4–5 m, upper bowl lip y≈7–8 m; central pier is much heavier and more ornamented than a plain r=.38 cylinder. Water cascades from the upper bowl to the lower and then the basin. Confirm bowl heights together against the total before implementation. Palette: grey-beige granite `#A6A397` / shaded `#7D7F75`, patinated metal `#6F8D80` to `#47786B`; use the **2024 restored** reference to choose the final patina rather than assuming all old green/bronze photographs match today. [Official reopening](https://www.lmu.de/de/newsroom/newsuebersicht/news/brunnen-sprudeln-wieder-41554b32.html), [2024 photograph](https://commons.wikimedia.org/wiki/File:Schalenbrunnen_M%C3%BCnchen_(saniert)_--_2024-05-06.jpg).

Mapped basin rings, retained without smoothing:

- Way 126489049: `(-13.93, 46.17), (-12.07, 50.07), (-8.02, 51.52), (-4.13, 49.66), (-2.70, 45.57), (-4.54, 41.66), (-8.60, 40.21), (-12.49, 42.08), (-13.93, 46.17)`

- Way 126489050: `(-27.83, 102.11), (-23.66, 103.42), (-19.79, 101.39), (-18.48, 97.19), (-20.50, 93.29), (-24.67, 91.98), (-28.55, 94.01), (-29.86, 98.21), (-27.83, 102.11)`

## Weiße Rose pavement memorial

OSM node [5503441922](https://www.openstreetmap.org/node/5503441922), `name=Flugblätter`, is at **(-2.97,14.72)**. This is an anchor for dispersed objects, not their whole extent. The artwork is a **scattering of ceramic facsimile leaflets and documents embedded flush into cobbles**, including portraits; it is not a standing plaque or a marker at `(0,55)`. Keep it a restrained optional historical stop. [City description](https://www.muenchen.de/sehenswuerdigkeiten/sehenswerte-plaetze/geschwister-scholl-platz), [memorial artwork summary](https://de.wikipedia.org/wiki/W%C3%BCrdigung_der_Wei%C3%9Fen_Rose), [wide reference](https://commons.wikimedia.org/wiki/File:Wei%C3%9Fe-Rose-Mahnmal_(M%C3%BCnchen)_Totale_1.jpg).

**Extent estimate, not an OSM polygon:** a roughly 12–18 m long scattering along the forecourt, 3–8 m deep outward from the arcade; small individual sheets roughly A4-to-A3 scale. Reserve a tentative world envelope X≈[-11,7], Z≈[11,23], orienting it with the facade. Do not fill this envelope with one rectangular texture. Keep exact count/locations pending a close overhead survey; no exact extent is established by the node. Benches, bollards and the shallow threshold shown in the photo help scale it. Proposed interaction position is `(-3,18)`, just outside the mapped anchor.

## Lawns, hedges and paths

Four mapped grass pieces form the two paired sectors. Their edges are important: the plaza is not a solid 200×80 m cobblestone rectangle or a square grid of trees. A straight paved axis through each fountain separates the grass halves; curved peripheral walking/low-service-road routes remain open.

- Grass way [126489047](https://www.openstreetmap.org/way/126489047): `(3.53, 33.18), (-3.20, 55.35), (24.13, 64.14), (24.25, 61.20), (23.49, 56.98), (21.98, 52.80), (20.32, 49.79), (17.65, 45.02), (13.47, 40.48), (10.05, 37.22), (3.53, 33.18)`

- Grass way [126489051](https://www.openstreetmap.org/way/126489051): `(-13.82, 27.32), (-21.61, 49.43), (-48.93, 40.64), (-44.94, 37.37), (-41.13, 34.36), (-37.23, 32.22), (-31.21, 29.70), (-26.56, 27.93), (-22.82, 27.09), (-17.71, 26.98), (-13.82, 27.32)`

- Grass way [126489045](https://www.openstreetmap.org/way/126489045): `(-14.05, 92.94), (-21.57, 116.45), (-13.27, 116.45), (-6.08, 115.53), (0.06, 113.54), (5.20, 111.14), (9.94, 107.96), (14.63, 101.91), (-14.05, 92.94)`

- Grass way [126489046](https://www.openstreetmap.org/way/126489046): `(-31.27, 87.96), (-38.59, 111.26), (-42.23, 109.26), (-45.27, 106.56), (-49.42, 102.78), (-52.25, 99.11), (-54.42, 95.73), (-57.00, 91.95), (-59.11, 87.25), (-61.16, 82.18), (-61.89, 78.08), (-31.27, 87.96)`

No hedge object was returned within the principal two-square footprint; **absence of a tag is not evidence that no hedge exists**. Do not add continuous perimeter hedges as a surveyed fact. Use the linked aerial and winter photo to check lawn edging and retain mapped footways. Most local square access streets are `residential`/service access even when they look like paved paths: preserve their route instead of replacing them with arbitrary decorative paving. The west arc way 19423091 is tagged `motor_vehicle=no`, `bicycle=yes`, `foot=yes`, one lane. The east arc has bicycle-street tags and Veterinärstraße cuts its eastern side; do not build an uninterrupted monumental facade across that street.

## Mapped trees and furniture

Below are **OSM mapped positions**, not completeness claims. Full tags and geometries are in `core_world.json`; rendering should keep free space at the portal, through the fountain axis, and along the curb. Tree tags identify **broadleaved** only: no species is confirmed for these nodes. Do not label the trees Japanese cherry or claim real sakura blossom. Deciduous crowns in the photos vary; optional decorative petals remain a game art choice. Estimated mature canopy diameter 6–10 m and height 8–14 m require photo tuning.

### Trees

| OSM ID | (x,z) m | Recorded details |
|---|---|---|
| [704397713](https://www.openstreetmap.org/node/704397713) | (6.88, 31.02) | leaf_type=broadleaved |
| [1402091591](https://www.openstreetmap.org/node/1402091591) | (-21.16, 119.22) | leaf_type=broadleaved |
| [1569711298](https://www.openstreetmap.org/node/1569711298) | (-62.43, 87.02) | leaf_type=broadleaved |
| [1569711305](https://www.openstreetmap.org/node/1569711305) | (-51.77, 39.82) | leaf_type=broadleaved |
| [1569711309](https://www.openstreetmap.org/node/1569711309) | (-40.84, 113.48) | leaf_type=broadleaved |
| [1569711312](https://www.openstreetmap.org/node/1569711312) | (-45.36, 34.01) | leaf_type=broadleaved |
| [1569711315](https://www.openstreetmap.org/node/1569711315) | (-2.72, 117.13) | leaf_type=broadleaved |
| [1569711320](https://www.openstreetmap.org/node/1569711320) | (11.94, 109.62) | leaf_type=broadleaved |
| [1569711349](https://www.openstreetmap.org/node/1569711349) | (18.81, 42.03) | leaf_type=broadleaved |
| [1569711352](https://www.openstreetmap.org/node/1569711352) | (24.15, 50.06) | leaf_type=broadleaved |
| [2090080144](https://www.openstreetmap.org/node/2090080144) | (17.41, 103.50) | leaf_type=broadleaved |
| [2090080147](https://www.openstreetmap.org/node/2090080147) | (-30.11, 26.42) | leaf_type=broadleaved |
| [2090080149](https://www.openstreetmap.org/node/2090080149) | (27.58, 57.00) | leaf_type=broadleaved |
| [2090080151](https://www.openstreetmap.org/node/2090080151) | (-12.27, 119.03) | leaf_type=broadleaved |
| [2090080157](https://www.openstreetmap.org/node/2090080157) | (-38.03, 29.80) | leaf_type=broadleaved |
| [2090080159](https://www.openstreetmap.org/node/2090080159) | (29.66, 64.07) | leaf_type=broadleaved |
| [2090080161](https://www.openstreetmap.org/node/2090080161) | (-22.78, 25.42) | leaf_type=broadleaved |
| [2090080163](https://www.openstreetmap.org/node/2090080163) | (-47.49, 108.87) | leaf_type=broadleaved |
| [2090080166](https://www.openstreetmap.org/node/2090080166) | (-63.71, 78.59) | leaf_type=broadleaved |
| [2090080167](https://www.openstreetmap.org/node/2090080167) | (-53.22, 101.50) | leaf_type=broadleaved |
| [2090080168](https://www.openstreetmap.org/node/2090080168) | (-57.77, 95.12) | leaf_type=broadleaved |
| [2090080169](https://www.openstreetmap.org/node/2090080169) | (-13.29, 24.43) | leaf_type=broadleaved |
| [2090080170](https://www.openstreetmap.org/node/2090080170) | (5.91, 114.09) | leaf_type=broadleaved |
| [4466605765](https://www.openstreetmap.org/node/4466605765) | (13.20, 35.71) | leaf_type=broadleaved |
| [4753784119](https://www.openstreetmap.org/node/4753784119) | (47.89, 135.07) | leaf_type=broadleaved |
| [9961994849](https://www.openstreetmap.org/node/9961994849) | (67.31, 120.00) | leaf_type=broadleaved |

### Benches

| OSM ID | (x,z) m | Recorded details |
|---|---|---|
| [4466605766](https://www.openstreetmap.org/node/4466605766) | (29.12, 60.72) | backrest=no; material=wood |
| [4466605767](https://www.openstreetmap.org/node/4466605767) | (21.46, 45.92) | backrest=no; material=wood |
| [4466605768](https://www.openstreetmap.org/node/4466605768) | (10.63, 33.42) | backrest=no; material=wood |
| [4466605769](https://www.openstreetmap.org/node/4466605769) | (-17.87, 24.66) | backrest=no; material=wood |
| [4466605770](https://www.openstreetmap.org/node/4466605770) | (-33.79, 27.90) | backrest=no; material=wood |
| [4466605771](https://www.openstreetmap.org/node/4466605771) | (-48.69, 36.76) | backrest=no; material=wood |
| [4466605772](https://www.openstreetmap.org/node/4466605772) | (-63.13, 83.22) | backrest=no; material=wood |
| [4466605773](https://www.openstreetmap.org/node/4466605773) | (-55.56, 98.61) | backrest=no; material=wood |
| [4466605774](https://www.openstreetmap.org/node/4466605774) | (-43.74, 111.31) | backrest=no; material=wood |
| [4466605775](https://www.openstreetmap.org/node/4466605775) | (-16.23, 119.33) | backrest=no; material=wood |
| [4466605776](https://www.openstreetmap.org/node/4466605776) | (2.27, 115.99) | backrest=no; material=wood |
| [4466605777](https://www.openstreetmap.org/node/4466605777) | (15.18, 107.03) | backrest=no; material=wood |
| [4466605778](https://www.openstreetmap.org/node/4466605778) | (9.64, 111.86) | backrest=yes; material=wood |
| [4466605779](https://www.openstreetmap.org/node/4466605779) | (-7.57, 118.28) | backrest=yes; material=wood |
| [4466605780](https://www.openstreetmap.org/node/4466605780) | (25.81, 53.77) | backrest=yes; material=wood |
| [4466605781](https://www.openstreetmap.org/node/4466605781) | (16.02, 38.58) | backrest=yes; material=wood |
| [4466605782](https://www.openstreetmap.org/node/4466605782) | (-26.03, 25.44) | backrest=yes; material=wood |
| [4466605783](https://www.openstreetmap.org/node/4466605783) | (-41.31, 31.66) | backrest=yes; material=wood |
| [4466605784](https://www.openstreetmap.org/node/4466605784) | (-59.87, 91.67) | backrest=yes; material=wood |
| [4466605785](https://www.openstreetmap.org/node/4466605785) | (-50.47, 105.47) | backrest=yes; material=wood |
| [5991363329](https://www.openstreetmap.org/node/5991363329) | (-73.16, 102.45) | backrest=no; material=wood |
| [5991363338](https://www.openstreetmap.org/node/5991363338) | (-72.07, 104.33) | backrest=no; material=wood |
| [12965142591](https://www.openstreetmap.org/node/12965142591) | (23.91, 122.43) | backrest=no; material=wood |
| [12965170601](https://www.openstreetmap.org/node/12965170601) | (20.69, 124.33) | backrest=no; material=wood |

### Lamps

| OSM ID | (x,z) m | Recorded details |
|---|---|---|
| [5991363326](https://www.openstreetmap.org/node/5991363326) | (-77.71, 91.70) | lamp_mount=straight_mast; ref=2 |
| [5991363334](https://www.openstreetmap.org/node/5991363334) | (-65.80, 113.32) | lamp_mount=straight_mast; ref=4 |
| [5991363336](https://www.openstreetmap.org/node/5991363336) | (-56.26, 122.44) | lamp_mount=straight_mast; ref=5 |
| [5991363341](https://www.openstreetmap.org/node/5991363341) | (-72.67, 103.41) | lamp_mount=straight_mast; ref=3 |
| [12612381456](https://www.openstreetmap.org/node/12612381456) | (35.57, 102.43) | lamp_mount=bent_mast; ref=42 |
| [12849157762](https://www.openstreetmap.org/node/12849157762) | (-79.90, 79.91) | lamp_mount=straight_mast; ref=1 |
| [12965139945](https://www.openstreetmap.org/node/12965139945) | (3.69, 132.71) | lamp_mount=straight_mast; ref=7 |
| [12965153677](https://www.openstreetmap.org/node/12965153677) | (31.27, 113.15) | lamp_mount=straight_mast; ref=10 |
| [12965167874](https://www.openstreetmap.org/node/12965167874) | (-14.14, 131.50) | lamp_mount=straight_mast; ref=6 |
| [12965168375](https://www.openstreetmap.org/node/12965168375) | (22.27, 123.27) | lamp_mount=straight_mast; ref=9 |
| [12965169150](https://www.openstreetmap.org/node/12965169150) | (13.09, 129.82) | lamp_mount=straight_mast; ref=8 |
| [12974035978](https://www.openstreetmap.org/node/12974035978) | (-45.40, 19.23) | lamp_mount=straight_mast; ref=3 |
| [12974040286](https://www.openstreetmap.org/node/12974040286) | (-22.63, 12.60) | lamp_mount=straight_mast; ref=5 |
| [12974042113](https://www.openstreetmap.org/node/12974042113) | (-30.26, 14.10) | lamp_mount=straight_mast; ref=4 |
| [12974047974](https://www.openstreetmap.org/node/12974047974) | (23.11, 26.39) | lamp_mount=straight_mast; ref=6 |
| [12974051690](https://www.openstreetmap.org/node/12974051690) | (43.41, 63.74) | lamp_mount=straight_mast; ref=10 |
| [12974056932](https://www.openstreetmap.org/node/12974056932) | (-61.05, 30.52) | lamp_mount=straight_mast; ref=1 |
| [12974063040](https://www.openstreetmap.org/node/12974063040) | (41.81, 54.08) | lamp_mount=straight_mast; ref=9 |
| [12974066481](https://www.openstreetmap.org/node/12974066481) | (39.30, 43.40) | lamp_mount=straight_mast; ref=8 |
| [12974067864](https://www.openstreetmap.org/node/12974067864) | (32.55, 33.78) | lamp_mount=straight_mast; ref=7 |
| [12974068001](https://www.openstreetmap.org/node/12974068001) | (-54.26, 24.66) | lamp_mount=straight_mast; ref=2 |
| [13011305843](https://www.openstreetmap.org/node/13011305843) | (48.18, 77.49) | lamp_mount=bent_mast |
| [13011305844](https://www.openstreetmap.org/node/13011305844) | (6.88, 65.65) | lamp_mount=bent_mast |
| [13011305845](https://www.openstreetmap.org/node/13011305845) | (-31.78, 53.35) | lamp_mount=bent_mast |

### Bicycle parking

| OSM ID | (x,z) m | Recorded details |
|---|---|---|
| [2371910343](https://www.openstreetmap.org/node/2371910343) | (27.84, 129.36) | bicycle_parking=stands; capacity=16; covered=no |
| [2371910345](https://www.openstreetmap.org/node/2371910345) | (31.73, 117.03) | bicycle_parking=stands; capacity=11; covered=no |
| [10771991443](https://www.openstreetmap.org/node/10771991443) | (50.20, 58.38) | bicycle_parking=wall_loops; capacity=20; covered=no |
| [11762158706](https://www.openstreetmap.org/node/11762158706) | (-6.93, 134.55) | bicycle_parking=stands; capacity=13; covered=no |
| [11762158707](https://www.openstreetmap.org/node/11762158707) | (6.20, 139.28) | bicycle_parking=stands; capacity=40; covered=no |
| [12974044000](https://www.openstreetmap.org/node/12974044000) | (-60.36, 7.89) | bicycle_parking=wall_loops; capacity=50; covered=no |
| [449519241](https://www.openstreetmap.org/way/449519241) | (-19.32, 7.75) | bicycle_parking=wall_loops; capacity=20; covered=no; area/way: table gives first vertex; use full polygon, not this point as centre |
| [449519242](https://www.openstreetmap.org/way/449519242) | (37.63, 25.79) | bicycle_parking=wall_loops; capacity=50; covered=no; area/way: table gives first vertex; use full polygon, not this point as centre |
| [449519243](https://www.openstreetmap.org/way/449519243) | (53.76, 30.75) | bicycle_parking=wall_loops; capacity=100; covered=no; area/way: table gives first vertex; use full polygon, not this point as centre |

For benches the common tags are wood with both backed and backless versions; photos additionally show stone seats/bollards near the entrance. Do not treat 6 identical backrest benches at Z=22 as the entire square inventory. Lamps include both straight masts around the arcs and tall bent-neck street lights along Ludwigstraße; OSM tags do not specify heights, so 4–5 m square / 7–9 m street are **visual estimates**. Avoid one point light per lamp on top of the existing daytime lighting unless needed for the style.

## U-Bahn and bus facilities

The returned standalone entrances are [391042342](https://www.openstreetmap.org/node/391042342) **A (56.13,70.07)**, and [288676926](https://www.openstreetmap.org/node/288676926) **B (43.01,115.37)**. Both carry `wheelchair=yes`; A has `level=0`, B has `conveying=yes`. These are mapped entrance anchors, not complete stairwell footprint surveys. The [MVV station diagram](https://efa.mvv-muenchen.de/sta2/universitaet.pdf) is explicitly not to scale and supplies A/B/C/D exit grouping plus stairs/escalators/lifts. Match structures to that diagram before modelling; do not turn a point into a guessed oversized hole.

The returned stop-area relation [1619275](https://www.openstreetmap.org/relation/1619275) also supplies these southern member coordinates, outside the initial bbox (their full standalone tags were **not** returned):

- Node [711833721](https://www.openstreetmap.org/node/711833721): (-175.78, 36.27).

- Node [288677130](https://www.openstreetmap.org/node/288677130): (-171.64, 8.15).

- Node [11932723746](https://www.openstreetmap.org/node/11932723746): (-150.07, 15.34).

Do not render way **258783963** (Universität U3/U6 platform, layer/level **-2**) as a surface wall or plaza: it is underground. The extract includes the **Siegestor** bus platform areas 817844156 and 817844157 north of the square (around X≈85–100, Z≈100–115), `platform:width=3`, `kerb:height=.20`, shelters. The **Universität** bus stops farther south are indicated by the MVV plan, but this extract does not establish their precise surface geometry. Leave exact position/route signage pending refreshed local transit data instead of inventing a “bus stop at the fountain”.

## Ludwigstraße: axis, lanes and kerbs

Use mapped polylines, not the current `x=112…145` road. At the fountain latitude the road is approximately a NNE line; the two directed carriageway centreline ways are **151334113** (southbound) and **50220178** (northbound), tagged **2 lanes each**, and both join **48242678** south of the square, which is tagged **5 lanes (3 forward / 2 backward)**. Segregated cycle/foot paths are **47229154** west and **88890339** east; the latter has `cycleway:width=2`. These tags are snapshot evidence, not a guarantee of current traffic management.

At game X≈0, interpolation of the mapped carriageway centrelines gives Z≈**72.64** and **81.24**; sidepath lines give roughly Z≈**64.26** west and **90** east. Centreline-to-centreline spacing is not the carriageway width. **No explicit kerb geometry was returned.** Provisional modelling estimate: 18–22 m overall motor-traffic strip across its normal, with each through lane ≈3.0–3.3 m and variable turn/parking pockets. Sidepath/footway corridors widen the total public-road zone to approximately 30–35 m. At X=0, a first visual-only kerb pair around Z≈67 and 87 is plausible; at X=+50 add roughly 16 m to both Z values because the road is oblique. These are **not exact kerb coordinates**.

The two useful checks are the known sidepath lines and the fountain bases: never widen the road until it consumes the basin or lawns. Use the source line geometries and stroke them in their **normal direction**; a constant-Z band is wrong. Pedestrian crossing [613086894](https://www.openstreetmap.org/node/613086894) and [8042822509](https://www.openstreetmap.org/node/8042822509) lie around **(50.60,89.22)** and **(48.35,97.08)** at the northern junction and are signal-controlled. Preserve pedestrian routes there when extending the chapter across the road.

## Sightlines

Looking **north/NNE** along the road leads to **Siegestor**; looking **south/SSW** leads toward **Odeonsplatz and Feldherrnhalle**. They are not opposite targets on the +Z and -Z axes. The facade-normal view from the west fountain looks west-northwest toward the arcade, while the east-fountain view continues across Ludwigstraße to LMU. Use road-tangent direction approximately `(0.954,0.300)` north and its negative south; exact monument aim points should come from their own footprint nodes, outside this core extract. Trees and the return wings legitimately obscure parts of the full facade. [LMU's account of Gärtner's two-fountain composition](https://www.lmu.de/de/die-lmu/struktur/zentrale-universitaetsverwaltung/presse-und-kommunikation-puk/press-room/pressemitteilung/erstmal-ausgesprudelt-die-lmu-brunnen-werden-saniert-8cfa7a24.html).
