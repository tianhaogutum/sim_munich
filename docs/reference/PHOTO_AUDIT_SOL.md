# Photo and source audit

Audit date: 2026-11-09. Scope: the LMU reference catalogue, six new district source manifests, and existing copied nature assets. This is a provenance check; it does not establish survey accuracy or provide a legal clearance opinion.

## Result

The core catalogue is internally consistent: **37 distinct photograph records, including 9 historical images**, each with a description-page URL, original-image URL, author and license label. The source documents correctly distinguish reference viewing from redistribution. **No Munich source photograph from this catalogue is packaged as a game texture or model asset.** The new buildings are procedural interpretations of OSM footprints and photo references, not photogrammetry or photo-textured replicas.

The repository does contain downloaded external bitmap textures and a fern model under `forest_floor`, `sparse_grass` and `fern_02`; these are **Poly Haven nature assets**, separate from the Munich photo catalogue. All **12 listed local files** exist and their MD5 digests match their source manifests. The district `qa/` and `verification/` PNGs are generated game screenshots, not source photos. `lmu-game-concept-v1.png` is a separate concept reference and is not evidence of real Munich architecture.

## Live primary-source spot checks

| Source | Verified against live source | Catalogue result |
| --- | --- | --- |
| [2017 LMU stitched east panorama](https://commons.wikimedia.org/wiki/File:2017_LMU_1-4_rectlinear.jpg) | Source frames: Wikiolo; derivative panorama: Martin Kraft; CC BY-SA 3.0; page explicitly identifies stitching and possible seam differences. | Credit and license match. Do not treat the panorama as distortion-free measurement. |
| [2012 entrance facade](https://commons.wikimedia.org/wiki/File:Hauptgeb%C3%A4ude_LMU_Eingangsfassade.jpg) | A.Schnurrenberger; CC0 1.0. | Credit and license match. Good candidate if an actual bundled facade comparison photo is later desired. |
| [Geschwister-Scholl-Platz 2021](https://commons.wikimedia.org/wiki/File:Geschwister-Scholl-Platz_2021.jpg) | Felix Edelmann; CC0 1.0; taken 2 November 2021. | Credit/license match. The Commons structured caption says south while the description says north: use geometry/visible landmarks, not this caption alone, to infer direction. |
| [Theatinerkirche / Feldherrnhalle](https://commons.wikimedia.org/wiki/File:Theatinerkirche_Feldherrenhalle_Odeonsplatz.jpg) | Schlaier; author-released public domain. | District manifest matches. |
| [LMU fountain restoration report](https://www.lmu.de/de/newsroom/newsuebersicht/news/brunnen-sprudeln-wieder-41554b32.html) | University report dated 6 May 2024; image marked © LMU. | Correctly retained as link-only reference without an assumed open photo license. |
| [Poly Haven asset license](https://polyhaven.com/license) | Asset files are CC0; website example renders and other site content are distinguished from those asset files. | Existing nature asset license labels agree. |

No source photo was downloaded or modified during this audit.

## Actionable improvements

1. **Use precise wording in the game and delivery notes.** Say “OSM-derived footprints, with photo-guided procedural detail.” Avoid “photo reconstruction,” “measured replica,” or “photogrammetry.” Some 37 catalogue entries were metadata-checked rather than visually measured, as `PHOTO_SOURCES.md` already states.
2. **Connect the atlas to exact reference files.** Several current atlas source links go to an institution or category home page. For photo comparison, expose the relevant Commons description-page link and credit beside each building. The catalogue already provides these links; generic homepage links should remain institutional context.
3. **Keep snapshot age visible in technical notes.** `core.sources.json` records retrieval on 2026-11-09 but an OSM base timestamp of 2026-06-01. Decimal coordinate precision does not establish present-day or centimetre accuracy. Historical images must not drive current road/vegetation claims.
4. **Small manifest cleanup, nonblocking.** Add an explicit `license_url` to `sparse_grass/sources.json` and `fern_02/sources.json` for parity with `forest_floor`; retain existing provenance even though the assets are CC0. Document the origin of the concept PNG separately if it is redistributed outside this repository.
5. **If downloadable real photos become a product feature:** start with the two verified CC0 images above, retain their source and author metadata, record exact copied filenames and any resizing/cropping, and update the catalogue's `images_downloaded_to_repository` flag. The present flag is accurate for the current Munich reference pack.

## Local checks performed

- Parsed `PHOTO_METADATA.json`; checked 37 unique URLs, historical count, and nonempty attribution fields.
- Reviewed `PHOTO_SOURCES.md`, `LMU_MAIN_BUILDING.md`, district manifests and OSM core source timestamp/attribution.
- Enumerated packaged JPG/PNG assets; distinguished nature maps, game screenshots and the concept image from Munich reference photographs.
- Checked file existence and MD5 for all 12 downloaded nature asset files in their manifests.
- Read the six primary source pages linked above. The remaining catalogue entries were not individually reverified during this short audit.
