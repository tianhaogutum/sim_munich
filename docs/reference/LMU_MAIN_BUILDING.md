# LMU main building: geometry and architectural reference

Research snapshot: 2026-11-09, source checkout `19b7914`. Scope: the Gärtner east front, adjoining north/south returns and enough rear massing to prevent false silhouettes. **This is an evidence-labelled modelling brief, not a measured-building survey.** `M` means computed from mapped OSM vertices; `T` means a source's textual claim/tag; `V` means a visual estimate/count from the cited photographs. Do not promote V values to historical facts in the game's information panel.

## The recognizable building

The east-facing Gärtner building is a **three-sided forecourt composition in Rundbogenstil**, built 1835–1840, with long horizontal cornices, paired round-arched windows, a relatively low tiled roof and projecting side wings. The entrance is an **arcaded ground-floor frontage**, not a Greek/Roman temple portico with eight freestanding columns and a tall central pediment. The Gärtner front and the Bestelmeyer west entrance are different elevations from different construction phases. [LMU history](https://www.lmu.de/en/about-lmu/lmu-at-a-glance/history/1840/), [LMU building tour](https://www.lmu.de/de/newsroom/newsuebersicht/news/tour-durch-das-hauptgebaeude-der-lmu-f2b0e28c.html), [full east panorama](https://commons.wikimedia.org/wiki/File:2017_LMU_1-4_rectlinear.jpg).

**Portal correction:** the brief's “triple-arched entrance” is a useful shorthand for the central entrance emphasis, but **three is not the total exterior arcade count**. The principal ground arcade has **nine openings** (V; view the full front in [2017 LMU 2](https://commons.wikimedia.org/wiki/File:2017_LMU_2.jpg), plus the [close arcade photograph](https://commons.wikimedia.org/wiki/File:Hauptgeb%C3%A4ude_LMU_Eingangsfassade.jpg)). Its arches spring from substantial attached masonry piers. Recessed columns/vaults can be seen inside the vestibule, and slender colonnettes divide upper paired windows. Neither is an exterior row of eight 9.2 m freestanding columns. **Set exterior freestanding column count to 0; remove the `colN:8`, `colH:9.2` claim from geometry and sightseeing copy.** A central three-bay focus may be retained artistically, surrounded by the full arcade rhythm.

The [municipal planning text indexed here](https://www.muenchen-transparent.de/dokumente/8944816/datei) also describes nine arcade arches; its download returned 404 during this research, so the accessible photos, not an unavailable PDF, are the operative evidence for the count.

## Map frame and measured footprints

The fixed `date_geo.mjs` WGS84 origin is `(48.15075,11.58035)`, +X=true north, +Z=true east. It is **not an exact surveyed portal location**. The mapped central front is near `(2,13)`; the front runs about **17.7° east of north**. “Facade at z=0” and “building entirely at negative Z” are no longer safe collision assumptions. Preserve these mapping constants to avoid moving every OSM district; see [CORE_RELAYOUT_PLAN.md](CORE_RELAYOUT_PLAN.md).

[Raw OSM extract](../../project/assets/osm/core.json), [attribution/query](../../project/assets/osm/core.sources.json), [all transformed rings](core_world.json). Data timestamp is the server-returned `2026-06-01T08:52:28Z`, not a claim of a November ground survey. OSM building labels A, B, C, D, E, F, M, N are blocks used in room identifiers, not automatically architectural “wings”.

| Part / dimension | Result | Evidence and limits |
|---|---:|---|
| Recessed east-facing wall, between return wings | **123.81 m** | M: segment `(-57.37,-5.47)` → `(60.56,32.23)`; agrees with a historical guide's **124 m** front description ([transcription of Zauner guide](https://stadtgeschichte-muenchen.de/quellen/d_quellen.php?id=327)). Not the whole campus width. |
| Central A-block frontage | **46.61 m** | M: `(-22.86,5.44)` → `(21.58,19.51)`; includes frontage beside the central arcade. Not proof that the nine open arches occupy all 46.61 m. |
| Two flanking wall runs to the return wings | about **38.6 m each** | M, approximate remainder of the recessed 123.81 m wall after the 46.61 m A frontage; joins are not perfectly symmetric. |
| Broad east-building shoulder span | **160.53 m** | M: outer vertices `(-75.93,-11.19)` → `(81.21,21.61)`; useful envelope check. It does **not** justify rendering a single straight 160 m wall. |
| North forecourt return, inner face | **41.53 m** | M: `(60.56,32.23)` → `(47.85,71.77)`; returns toward the street. |
| South forecourt return, inner face | **41.31 m** | M: `(-57.37,-5.47)` → `(-69.78,33.93)` in roof outline; adjoining southern mass is not a mirror of the north. |
| North street-facing head width | about **16.4 m** | M: `(47.85,71.77)` → `(63.46,76.85)`; more meaningful than `eW=12`. |
| Roof/wing depth at north return | about **58 m overall** | M: span in local facade-normal direction of D polygon; includes front-to-back mass, not just projection. |
| Complete mapped A/B/C/D/E/F/M/N group | about **224×163 m** | M: oriented envelope parallel/perpendicular to the front; excludes other adjoining campus buildings. A whole-campus bounding box must not become a solid rectangular collider. |
| Building A / D / E / F height tags | **26 m** | T: raw `height=26`; tags are not proof of eaves level. A roof part is separately tagged **height=28**, **roof:height=2**, **roof:colour=red**. Do not blindly add all tags. |
| Practical facade eaves / ridge | **22–24 m / 26–28 m** | V, proposed visual range consistent with roof/body proportions and the conflicting overlapping height tags. No verified measured section located. |
| External storeys | **3 principal levels** | V and D/E/F OSM tags. Ground, tall principal window level, smaller upper window level. Not ground plus three identical upper rows. |

Approximate local modelling basis: tangent `u=(0.9525,0.3045)` in world `(x,z)`, outward facade normal `n=(-0.3045,0.9525)`. Normalize these rounded vectors if using them. Use `world = anchor + u * alongFacade + n * outward`. **Do not rotate already-transformed OSM rings again.**

### Original footprint components available to the scene builder

| OSM way | Room block | World X range | World Z range | Role / caution |
|---|---|---:|---:|---|
| 17973243 | A | -22.86…59.48 | -88.33…19.51 | Central frontage and rear Lichthof/stair mass, irregular polygon. |
| 17973028 | D | 14.94…81.21 | 0.88…76.85 | North front and returning wing. |
| 17973432 | E | -75.93…-4.33 | -52.87…5.44 | South front / Aula connection. |
| 17974115 | F | -136.81…-57.37 | -11.19…33.93 | Southern continuation; do not confuse with the recessed centre wall. |
| 17972691 | B | 53.35…120.57 | -74.23…-31.03 | Rear/north mass toward Adalbertstraße. |
| 17972796 | C | 63.92…101.90 | -40.74…20.91 | North connection, 4 levels tagged, postwar character differs. |
| 17973711 | M | -46.18…15.94 | -126.75…-75.18 | Bestelmeyer-side west/rear block, 5 levels tagged. |
| 17973573 | N | -67.69…-24.38 | -102.09…-46.88 | Rear/south connection. |

Use the ring itself for collisions. These ranges are diagnostic envelopes; an AABB for A fills open parts of the courtyard and blocks legitimate routes.

## Window rhythm and elevation recipe

**Counting method:** count a paired round-arched window as **one bay**, not two lights; count only a known facade plane, not a perspective combination of the end head plus return plus back wall. The full rectified [2017 panorama](https://commons.wikimedia.org/wiki/File:2017_LMU_1-4_rectlinear.jpg), [central front](https://commons.wikimedia.org/wiki/File:2017_LMU_2.jpg), [north return](https://commons.wikimedia.org/wiki/File:2017_LMU_1.jpg), [south return](https://commons.wikimedia.org/wiki/File:2017_LMU_3.jpg) and [paired-window detail](https://commons.wikimedia.org/wiki/File:Fenster_Hauptgeb%C3%A4ude_LMU.jpg) are the references. Trees obscure multiple openings; counts marked provisional should be checked on an unobstructed orthogonal photograph before fine-detail work.

| Plane / section | Visible/countable rhythm | Modelling dimensions, V only |
|---|---|---|
| Recessed back wall, principal and small upper level | **About 29 bays overall, provisional**; working decomposition **10 + 9 central + 10**, allowing ±1 at obscured end joins. The **9 open ground arcade bays** are the robust central count. | Average pitch about **4.3 m** from 123.81 m/29; do not distribute these over the full 160 m shoulder span. The A footprint covers some adjoining bays as well as the open arcade. |
| Central nine ground arches | **9 round arches**, with shared masonry piers; central entrance visually emphasized. | Each opening approximately **3.0–3.8 m clear × 6–7.5 m high**; shared pier about **0.8–1.4 m**, spring line **4.5–5.5 m**, all approximate. Reconcile total arcade width with photo before fixing pitch. |
| North street-facing head | **3 main bays per upper level**, clearly legible in 2017 LMU 1. | Head width about 16.4 m, generous outer margins; do not use wall-wide 4.1 m repetition blindly. |
| South street-facing head | **3 main bays per upper level**, legible in 2017 LMU 3/4. | Same family of proportions; different adjoining buildings and return length. |
| North courtyard return | **About 9–10 bays per upper level, provisional**, partly obscured by trees/foreshortening. | Inner face about 41.5 m; pitch roughly **4–4.6 m**. |
| South courtyard return | **About 9–10 bays per upper level, provisional**, heavier tree occlusion. | Similar scale, not evidence for exact north–south mirroring. |
| Ground wall away from arcade | Small round-headed openings and occasional doors; **no defensible complete count** from the inspected obstructed photos. | Approx. **0.9–1.4 m wide × 1.7–2.5 m high**. Place from a facade-specific reference; do not merely delete every other bay. |
| Principal upper windows | A large round-arched enclosing opening contains **2 lights**, slender central colonette, small circular/tracery field above; medallions in the decorative scheme. | Outer width **2.4–3.0 m**, height **4–5 m**; dark recessed glazing, pale stone surrounds. |
| Small upper windows | **2 small arched lights per bay**, round aperture above in many bays; no extra fourth storey. | Outer width **1.4–1.9 m**, height **2.4–3.1 m**. |

The old shader geometry's one plain blue single arch per bay misses the paired lights, central mullion/colonette and recessed reveal. Prefer paired dark openings beneath a larger framing arch. Keep ornate rosettes and portrait medallions simplified at game distance, but retain their placement and contrast.

### Vertical levels (a fitting recipe, not floor survey)

Suggested base levels: pavement/threshold y≈0–0.4, first belt around **7–8 m**, next principal division around **14.5–16 m**, cornice/eaves around **22–24 m**, roof ridge **26–28 m**. These are V ranges inferred from the three-storey facade and photographs, not verified internal floor-to-floor heights. The game's `gfH=5`, `ufH=6` and **three** upper rows should not be treated as source data. Fit the exterior bands first; internal floors can differ.

The entrance has shallow paving/threshold changes and bollards rather than an oversized 5-tier, 28 m-wide ceremonial staircase. The current single 7×10 m door is not a measured doorway. Do not rotate the XY arch mesh onto the ground when rebuilding the vertical facade.

```text
EAST ELEVATION (unfolded concept; horizontal scale is approximate)
Street head      return ~41.5 m    recessed wall ~123.8 m    return ~41.3 m   Street head
  3 bays         perpendicular    [10?] [ 9 ] [10?]          perpendicular     3 bays

ridge 26–28 m                low red tiled roof / hipped returns
                      ______/________________________________\______
eaves 22–24 m        ================================================  strong cornice
upper small row       oo oo oo ...  oo oo oo oo oo ...  oo oo oo       2 lights / bay
principal level       ∩∩ ∩∩ ∩∩ ...  ∩∩ ∩∩ ∩∩ ∩∩ ∩∩ ... ∩∩ ∩∩          larger paired arches
belt ~7–8 m          ------------------------------------------------
ground                small windows [∩ ∩ ∩ ∩ ∩ ∩ ∩ ∩ ∩] small windows
                                   nine open arcade bays
pavement 0 m         _________ shallow threshold / paving ____________
                                   no exterior colonnade

PLAN at ground (local u along facade, n outward; n is roughly east)
            rear additions / Lichthof / Bestelmeyer west entrance
          +-----------------------------------------------------+
          |   recessed east wall, portal near world (2,13)      |
          +--+                                               +--+
             |           open forecourt                      |
             |          west fountain                        |  returns ~41 m
             +--+                O                        +--+
                    Ludwigstraße runs NNE–SSW, not along Z
                              O east fountain across road
```

Question marks in the elevation are intentional count uncertainty, not extra geometry to hardcode.

## Roof, cornices and facade palette

The aerial [southeast overview](https://commons.wikimedia.org/wiki/File:Aerial_image_of_Ludwig-Maximilians-Universit%C3%A4t_M%C3%BCnchen_(view_from_the_southeast).jpg) shows continuous **pitched red tile roofs**, hipped ends and intersecting roof valleys, with rear courtyards and a glazed roof feature. Do not use a flat brown plate and a tall centre “pediment” slab. The street-return corners have their own roof hips rather than separate skyscraper-like pavilions.

The 2001 facade renovation used **six tones** to recover the historic finish, according to the [LMU-issued renovation notice](https://nachrichten.idw-online.de/2003/01/09/alte-pracht-beim-fassadenpreis-2002-finden-lmu-gebaeude-lobende-erwaehnung). Across the 2017 daylight panorama, close front and 2021 square photos it reads **pale ivory/sand with subtle ochre blocks**, not uniform saturated yellow. Hex values below are **mental visual approximations across photos**, not instrument samples or a RAL specification; exposure, sky and toon lighting change their appearance.

| Material | Suggested base | Shadow / variation | Evidence use |
|---|---|---|---|
| Main plaster | `#E8E2D2` | `#CFC6B2`, `#DDD3BD` | Warm pale sand/ivory across wall, avoid turning every bay bright yellow. |
| Ochre block/tone variation | `#D9C9AA` | `#C5B493` | Low-contrast masonry/paint variation; use sparingly. |
| Cornice / window surrounds | `#F0EBDE` | `#CEC7B8` | Reads a little lighter and more sculpted than the wall. |
| Door/recess | `#302D28` | `#181E1B` | Darker than the facade; deep reveals matter more than bright blue glass. |
| Glass | `#465A58` | `#243B3D` | Sky reflection can be added, but not uniform cyan opacity over all openings. |
| Red clay roof | `#A65B46` | `#75473A` | Aerial red/orange weathered tiles; roof is not dark chocolate. |
| Paving / plinth | `#AAA69A` | `#777A72` | Neutral stone, slightly warm. |

Carry the horizontal ground/principal belt and the stronger upper cornice across the facade and turn them around corners. Include the narrow blind-arcade/corbel-like frieze below the cornice, fine projecting mouldings, and recessed window framing. Omit neither all cornices nor replace them with a massive full-depth parapet block. A centre projection of `2.8 m` and centre height `27 m` are not sourced facts; start with near-continuous frontage and shallow relief (V: a few decimetres) instead.

## Lichthof, rear blocks, north and south

The Lichthof belongs **behind** the east vestibule within the enlarged complex. It has galleries, stairs, columns and a **radially ribbed glazed overhead opening**, seen in [Glaskuppel im Lichthof](https://commons.wikimedia.org/wiki/File:Glaskuppel_im_Lichthof.jpg). The aerial confirms rear roof complexity, not a huge glass dome sitting on the front roof edge. A first roofscape model may place a restrained skylight within A's rear/central mass (roughly X≈5…30, Z≈-35…-60, V location range); exact footprint, diameter and height are **not measured here**. Keep this placement provisional rather than copying a decorative dome to the portal. [Lichthof](https://commons.wikimedia.org/wiki/File:LMU_Hauptgeb%C3%A4ude_Lichthof.JPG), [interior Säulenhalle](https://commons.wikimedia.org/wiki/File:LMU_Hauptgeb%C3%A4ude_S%C3%A4ulenhalle_1OG.JPG).

**North / Adalbertstraße:** includes the returning D wing and later B/C additions; the historic ensemble is not a perfect symmetric extruded bar. OSM C is four levels, B three plus roof level; the north replacement/extension fabric differs from the original Gärtner face. **South / Schellingstraße:** passes through the Aula connection and onward to the adjoining former Salinenverwaltung/library complex; do not repaint the reddish neighbouring building as a mirrored pale pavilion. The rear **Bestelmeyer extension (1906–1909)** reaches toward Amalienstraße and has its own entry/sculpture language. These broad chronology points are summarized in the [building history](https://de.wikipedia.org/wiki/Hauptgeb%C3%A4ude_der_Ludwig-Maximilians-Universit%C3%A4t_M%C3%BCnchen); prioritize photos and mapped footprints for geometry rather than deriving dimensions from the narrative.

**Salinenhof is real, but it is not the front fountain lawn and not the Lichthof.** It is the rear/south open courtyard between the Historicum, physics and university-library area, named for the former salt administration. LMU's [1997 chronicle](https://epub.ub.uni-muenchen.de/13668/1/lmu_chronik_1997_00.pdf) explains the naming; the [official access guidance](https://www.lmu.de/de/workspace-fuer-studierende/support-angebote/studieren-mit-beeintraechtigung/barrierefreiheit-und-hilfsmittel/) places access behind Ludwigstraße 27 from Schellingstraße. Keep it as a distinct rear landscape, roughly southwest of the portal, not a third lawn inside Geschwister-Scholl-Platz. The **Eulenbrunnen** is separately mapped at **(-35.30,-34.95)**, node 1318875603, in the southern inner courtyard; it is not a third outdoor Roman fountain.

## What remains unverified

No primary measured architectural elevation/section was obtained. Exact floor heights, arch clear sizes, all ground-window counts, complete return counts, skylight dimensions and exact colour values remain V estimates or unresolved. The robust next-pass priorities are massing/orientation, three exterior levels, paired windows, nine-bay masonry arcade, low red roof, correct fountain/road positions and no invented exterior colonnade. Refine small bay and moulding dimensions only after those are aligned.
