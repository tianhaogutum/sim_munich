# Our Munich · 我们的慕尼黑

A browser sightseeing game with two connected experiences:

- **LMU date chapter:** an anime cast with a dog, dialogue choices, a keepsake hunt, three validated photography objectives, a persistent album and an exportable ending postcard.
- **Munich city exploration:** streamed OpenStreetMap streets and 3D building footprints across a broad Munich play area, 133 destinations, 25 district navigation anchors and 17 discovery trails. Every destination has a map marker; three city contracts add ordered observation tasks and collectible stamps.

## Run

```sh
cd project
python3 -m http.server 8100
```

Open [the LMU chapter](http://localhost:8100/) or [city exploration](http://localhost:8100/city.html). There is no build step. Three.js r160, MapLibre GL JS 4.7.1 and online map tiles need an internet connection. Serve `project/`; opening files directly is unsupported.

## Controls

| Input | LMU chapter | City exploration |
|---|---|---|
| WASD / arrows | Walk | Walk relative to map bearing |
| Shift | Run | Run |
| Mouse drag / wheel | Orbit / zoom | Inspect map / zoom |
| E | Talk, collect or inspect | Read and confirm the current city contract objective |
| P | Camera mode; Space takes a photo into the album | Export city screenshot |
| G | District atlas, safe fast travel, local real-photo comparisons | Destination list |
| F | — | Follow the characters |
| N / J / C | Minimap overview / journal / free camera | — |
| M | Toggle sound | — |
| K / V | — | City contracts / walking direction guide |
| Esc | Close active modal or pause | Close destination list |

City walking guidance shows straight-line distance and direction, not a verified pedestrian route. City dialogs pause movement and clear held keys when closing.

Touch controls are available on both pages. LMU settings include graphics quality, sound, camera sensitivity and dialogue speed. Progress is local to this browser; storage denial does not prevent playing.

## World and sources

The LMU core uses retained OSM footprints, a corrected angled facade, masonry arcades, paired windows and relocated octagonal fountains. Six surrounding procedural districts include Siegestor, Ludwigstraße, Professor-Huber-Platz, Maxvorstadt and Ludwigskirche/library. The atlas includes **six downloaded, openly licensed real photographs** with individual author/license/source metadata in [sources.json](project/assets/reference_photos/sources.json).

City mode streams the OpenFreeMap/OpenMapTiles basemap and building heights where available. It uses simplified extrusions, not photographic facade reconstruction. Missing heights are approximate. The play area is a rectangle containing Munich and some surrounding land, **not an exact municipality boundary**. Collision is based on locally loaded building polygons; interiors, city traffic simulation and detailed facades outside LMU are not complete.

Sources and modeling limits: [city scope](docs/CITY_SCOPE_SOL.md), [LMU references](docs/reference/LMU_MAIN_BUILDING.md), [photo audit](docs/reference/PHOTO_AUDIT_SOL.md). Map data © OpenStreetMap contributors (ODbL); tile attribution remains visible in city mode.

## Verification

```sh
node --test project/tests/*.test.mjs
node project/tools/playthrough.mjs http://localhost:8100/
node project/tools/world_walkthrough.mjs http://localhost:8100/
node project/tools/photo_validation.mjs http://localhost:8100/
node project/tools/city_validation.mjs http://localhost:8100/
node project/tools/city_features_validation.mjs http://localhost:8100/
```

Browser checks launch temporary Chrome profiles and keep downloads out of the user's Downloads directory. Performance results depend on the actual graphics backend; headless Chrome does not necessarily use software rendering.

Thirteen independent SOL conversations were subsequently created through the T3 interface,
all sharing the current checkout with no new worktrees. They produced district packs,
now compiled into playable discovery routes; several also received follow-up code tasks.
The latest request is for at least 20 sessions using the standard service tier.
The remaining seven could not be created through the built-in APIs in this run:
`parent_not_active`. Computer Use was stopped at the user's request.
See [the verified session record](docs/CITY_SESSIONS_CREATED.json).
The [100-task plan](docs/city_threads_100.json) is a prepared plan, not 100 launched agents.

Three.js is loaded from the jsDelivr CDN.

## Static renders

The v3 rendering pass of the original plaza scene is kept as its own page,
`project/render_v3.html`, because the game page now uses the mapped OSM core.
The game shares its sky, colour grade, bloom and FXAA.

Open `http://localhost:8100/render_v3.html?render=facade` (or `plaza`, `garden`)
for a composed still image. These modes hide the HUD, use a fixed scene time
and deterministic placement, and render only on initialization and resize.
They do not start the game loop or accept movement input.

To build three portable HTML previews without starting a server:

```bash
node scripts/build-static-previews.mjs /tmp/sim-munich-renders
```

Open `facade.html`, `plaza.html` or `garden.html` from that folder. Local scene
modules are embedded; an internet connection is still required for Three.js.
Static views use higher resolution shadows and supersampling with a four-million
pixel limit. The plaza and garden views show closer details of the scene.

In normal play, the animation loop stops when the page is hidden and resumes
when it becomes visible. Closing the page stops rendering.
