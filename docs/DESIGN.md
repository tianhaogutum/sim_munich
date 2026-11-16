# Munich date: chapter design and next chapters

This document separates the intended chapter from the implementation at `2a24dad`. The current entry already supports the route, basic interaction, placeholder characters, PNG downloads, procedural audio, and touch/gamepad input. Dialogue, persistence, real photo validation, the album/postcard interface, final cast, and optional content are still awaiting their parallel merges. Proposed copy and acceptance rules below are design guidance, not claims that those systems exist.

## The promise

Spend 10–15 minutes walking around LMU with someone who has been waiting for you. Each activity should give the player a reason to notice a different part of the plaza: the entrance's scale, the fountain's sound, a small object under a tree, and a place that feels familiar on the return trip. The intended player party is the heroine and her labrador; the male lead accompanies them. The current two capsules are temporary.

The route has no combat, timer, score penalty, or bad ending. The emotional progression is arrival → ease → a small shared problem → making memories → a quiet invitation to return. Success means knowing what to do next without rushing past the place or the other person.

## Pacing and stage goals

Budgets are design targets for a first playthrough, not measured completion times. Walking and optional inspection can bring the nominal 12 minutes toward 15; experienced players can finish the skeleton much faster.

| Stage | Budget | Player goal and location | Intended payoff / exit condition |
|---|---:|---|---|
| `meet` | 2 min | Find the companion at `entrance` `(0, 5)` from spawn `(0, 92)` | A short greeting establishes the relationship and invites a walk. Complete the entrance interaction. |
| `fountain_talk` | 2 min | Walk together to `fountain` `(35, 40)` | Listen, then make one sincere dialogue choice. Finish the chosen response before advancing. |
| `find_memento` | 2 min | Find the sakura hair clip at `memento` `(-44, 68)` | A small act of care; collect the object once. A clear hint and visible marker prevent a pixel hunt. |
| `photos` | 4 min | Photograph `facade`, `fountain`, and `couple` | Revisit the space with a purpose. Valid photos fill three distinct goals, in any order. |
| `postcard` → `done` | 2 min | Return to `our_plaza` `(0, 75)` | Reuse the selected dialogue theme in an ending postcard; offer a clear finish and restart. |

The `white_rose` point `(0, 55)` remains optional. Treat it as a historical pause, with factual text and a restrained presentation; do not turn its subject into a romantic punchline or mandatory reward. The relationship-day plaque near `(10, 5.5)` is also optional.

The skeleton's actual gates are simpler: E at the entrance → E at the fountain → collect `memento` → any three shutter presses → E at our plaza. The fountain visit advances immediately, and the last visit only changes the objective to the completion text.

## Dialogue and the ending

One choice at the fountain should express the player's preferred memory of the day, not test affection. For example, one response might notice the place (“想把这里的声音记住。”), while another notices the companion (“想记住和你一起的今天。”). These are proposed lines; **no canonical dialogue or option IDs are defined in the current source**.

Both responses should:

- Receive a specific, warm acknowledgment from the male lead.
- Converge on the same hair-clip, photography, and return route.
- Persist as `choices[dialogId] = optionId`, using the IDs eventually defined by the story owner.
- Change a line in `postcardText(state)` and the corresponding ending text, while keeping both endings equally complete.

For the place-focused response, the postcard could recall fountain sound, wet sleeves, or the colonnade. For the together-focused response, it could recall a saved step, waiting, or the shared photograph. The title can remain “慕尼黑 · 我们的一天”. These are editorial directions rather than additional state branches.

Acceptance: take each option through reload and completion, confirm that its wording survives, and confirm that both options allow all three photos and the same final destination. A missing/unknown saved option should produce a warm neutral fallback. Do not infer the selected branch from which button appears first.

At baseline `CHOOSE` stores arbitrary IDs but does not advance the stage, `VISIT('fountain')` advances without it, and `postcardText()` ignores state entirely. The story and UI merges must establish the real gate together.

## Photography: composition with forgiving feedback

Photography turns traversal into observation. Goal IDs come from `PHOTO_TARGETS` in `date_route.mjs`; labels are player-facing text, not save identifiers.

| Goal ID | Subject / target | Existing distance data |
|---|---|---|
| `facade` | Main building and colonnade, target `(0, 8, 3)` | `minDist: 22`, `maxDist: 75` |
| `fountain` | East fountain, target `(35, 4.5, 48)` | `minDist: 7`, `maxDist: 32` |
| `couple` | Dynamic `'companion'` target | `minDist: 2`, `maxDist: 9` |

The route specifies these values, but the stub does not use them. It also does not define the distance origin, center tolerance, or occluder policy. The following is the proposed validation contract for the photo owner to finalize:

1. **Distance:** measure from the camera to the evaluated subject target, using the route's inclusive minimum/maximum. Label failures “closer” or “farther”, rather than showing internal units. If the implementation instead uses player-ground distance, update this document and its tests explicitly.
2. **In frame and centered:** update camera matrices, project the target, require it to be in front of the camera and inside the view, then apply a forgiving center region. A candidate region is `abs(ndc.x) <= 0.65`, `abs(ndc.y) <= 0.60`, with projected depth in `[-1, 1]`; these thresholds are proposed, not checked-in constants. Verify them on both wide and narrow screens.
3. **Occlusion:** test the line of sight from camera to meaningful subject samples. Foreground architecture should block credit, while the target's own geometry must not count as an occluder. Exclude sky, decorative markers, particles, and invisible objects. For instanced objects, honor the hit instance. A single ray to an interior point is not sufficient to distinguish a visible fountain from a blocked one.
4. **Required subjects:** the current `'companion'` sentinel only identifies the male lead. Before claiming a “couple” photo, define whether the heroine must also be visible and whether the dog is optional. Recommended design: heroine and companion visible, dog welcome but not required. Coordinate their pose and camera framing with the cast owner; this is not already guaranteed by the route data.
5. **Credit:** only dispatch `{ type: 'PHOTO', id }` for a passing goal during `photos`. A duplicate shot may still be saved but cannot increment progress twice. Arbitrary shots outside the quest should remain possible without skipping stages.

Give live framing hints without punishing failed attempts: “往后退一点”, “让喷泉回到画面中央”, or “前面被树挡住了”. The shutter should still feel responsive. Avoid hidden timing windows or forcing the companion into a pose that the player cannot request.

Capture through `engine.capture()` to preserve bloom and exclude HTML HUD. The current overlay's letterbox is CSS and is **not** baked into that image. The planned album should show accepted goals, allow reviewing images, and handle full/unavailable storage without losing quest progress or freezing. Keep the source image, goal credit, and postcard composition conceptually separate; their persistence schema belongs to the photo owner.

## Companion behavior

| Stage | Intended companion behavior | Current cast behavior |
|---|---|---|
| `meet` | Wait visibly at the entrance, facing the approaching player | Capsule waits at `COMPANION.waitAt` `(2.5, 10.5)` |
| `fountain_talk` | Follow to the fountain, settle at `fountainSeat` `(30.5, 43.5)`, face the heroine while speaking | Generic follow; seat data unused |
| `find_memento` | Follow without covering the object; look toward the search area and acknowledge recovery | Generic follow |
| `photos` | Follow normally, then offer a readable, stable pose when framed for the couple shot | Generic follow; no pose state |
| `postcard`, `done` | Accompany the return, settle near our plaza, leave room for the ending camera | Generic follow |

The current desired follow gap is `2.2` units and catch-up threshold is `28`. The fallback moves up to `6 * dt` toward the player and collision-checks each axis, but its long-distance snap does not check the destination. The finished cast should select a walkable recovery position and avoid visible teleporting during a photograph. Avatar facing must follow motion, not `engine.player.yaw`, which is the camera's orbit angle.

The heroine/dog should remain legible at the normal camera distance. Dog movement and idle behavior can add life, but should not move the camera, select dialogue, or block the hair clip. The current engine is ground-plane based: slopes, stairs, and vehicles will need a deliberate movement API extension.

## Side content

`date_collect.js`, `date_banter.js`, `date_map.js`, and `lmu_life.js` are planned modules, absent at this base. There is no checked-in fragment list, achievement list, or banter table to count or name yet.

- **Fragments and journal:** use short, place-specific memories to reward looking around. Keep `memento` as the mandatory story item; optional fragment IDs must not trigger its transition. Give discoveries stable IDs and a separate store, `lmu-date-collect-v1`, once implemented.
- **Achievements:** reward different ways of noticing the place, without turning the date into a checklist. Specify each condition before shipping and keep every achievement optional. Do not require a particular fountain choice for basic completion.
- **Banter:** brief proximity- or stage-triggered remarks, with cooldowns and no repetition on every frame. Suppress bubbles over dialogue, memorial text, photo framing, and the ending. Audio is optional; written lines must carry the meaning.
- **Minimap and ambient life:** help orientation and make the square feel inhabited. Mark the current destination clearly; crowds must not obscure it, capture focus, or make collision unpredictable.

## Audio

`date_audio.js` is implemented. It synthesizes sound with Web Audio, without downloaded music or eager `AudioContext` creation. A pointer or keyboard gesture unlocks playback; mute persists as the string value of `lmu-date-audio-muted`.

The score uses a 90 BPM, eight-bar chord/melody pattern. The base layer accompanies the walk; `photos` adds light upper notes; `postcard` and `done` add a warmer lower layer and soften the filter. Wind, occasional birds, distance-based fountain noise, and movement-based stone footsteps place the player in the square. Fountain volume reads `route.FOUNTAINS`, so any relocated fountain must update that data too.

Cues are `tick`, `choose`, `stage`, `photo`, `shutter`, `collect`, and `ending`. The module subscribes to story events, so UI owners should avoid duplicating stage/collection sequences; identical cue names within 85 ms are deduplicated. Teleports and locked movement should not produce bursts of footsteps. Verify mute, interrupted tabs, unavailable Web Audio, and transitions without requiring sound to understand the objective.

## Accessibility and comfort

The current build provides movement alternatives, a mute button with accessible labeling, touch controls with labels, run control, and an objective written in text. The touch adapter releases held input on blur/disconnect paths; keyboard movement also clears on window blur. These do not amount to a completed accessibility audit.

Release targets:

- Complete the chapter without sound, precise timing, or continuous running.
- Provide keyboard focus, readable dialogue text, visible selected choices, and restore focus after closing modals. Touch/gamepad need actual choice navigation; an Enter-only confirmation adapter is insufficient.
- Offer readable text size/contrast, reduced motion, and quality settings through the planned title/settings module. Reduced motion should address camera tours, free-camera transitions, and particle intensity.
- Make photo failure hints actionable and tolerate handheld/narrow-screen framing. A vignette, color change, or sound alone must not signal success.
- Make Esc/back behavior predictable: close the top interaction first; pause only when no higher-priority modal owns input.
- Explain restart scope before erasing saved progress. Preserve accessibility preferences across story restart; coordinate album/collectible retention with their owners.

## Roadmap: reuse the extended world

Finish and verify the current date first: both dialogue paths, save/restore/restart, photo validation, ending export, touch/gamepad completion, and console/performance checks. None of the following legacy modules is loaded by `project/index.html`.

Estimates below are **planning ranges for one developer, including adaptation and QA**, excluding new art and large story rewrites. They are not benchmark measurements or commitments. Priorities favor reusable narrative systems before terrain and a second movement mode.

| Priority | Proposed chapter / reusable source | Estimated effort | Main risk / acceptance gate |
|---|---|---|---|
| P1 | Letters and wishes: `our_world.js`, `world_rules.mjs` | 2–4 developer days | Restore missing JSON content; extract DOM/state from the old environment; define chapter save ownership and migration. Letters, wishes, and notes survive reload; no interference with date progress. |
| P2 | English Garden walk: `main.js`, garden content in `our_world.js`, `park_terrain.mjs`, `park_views.js`, `garden_detail.js`, `meadow_detail.js` | 4–7 days | Coordinate conversion, terrain height, scene disposal, textured-asset performance. Companion/dog traverse hill and bridges; return to LMU reliably. |
| P2 extension | Stream drift: `river_drift.js` | +1–2 days | Direct player manipulation and separate input assumptions. Boarding, pause, bank exit, and recovery must work on touch/gamepad without teleporting the party apart. |
| P3 | Interior stair hall: `lmu_interior.js`, `stair_hall.js`, `interior_rules.mjs` | 3–5 days | Standalone renderer/UI, missing page/photos, vertical companion navigation. Walk stairs and upper gallery; enter/leave without losing the chapter state. |
| P4 | Sunset coast: `sunset_coast.js` | 2–4 days | Global light/particle changes and direct teleporting. Restore camera, lights, party, and save position on return; label the setting as an imagined excursion. |
| P5 | A short drive together: `amg_drive.js`, `car_physics.mjs`; inspect `luxury_sedan.js` separately | 5–8 days | Vehicle/player control arbitration, wider collisions, camera comfort, boarding, and new touch/gamepad bindings. Stop safely, exit on a walkable side, and keep companion/dog state consistent. |

### Letters and wishes first

`our_world.js` has letters with stable IDs, a named bench, a day plaque, wishes, notes, a passphrase door, and memory cards. `world_rules.mjs` already validates configuration/letters, normalizes saved state, computes dates, and filters visible wishes. Reuse those pure rules before the old DOM.

The legacy store is `lmu-our-world-v1`, not `lmu-date-v1`. Required `data/world.json`, `data/letters.json`, and `data/npc_lines.json` are missing in this tree. Recreate authored content explicitly rather than shipping fallback configuration prompts. Wish reveal thresholds and the passphrase are narrative devices: the full data remains client-side, so neither is private storage or authentication.

### English Garden and the river

The legacy `main.js` is an application orchestrator, not a reusable scene factory. Most of the garden's landscape, winding stream, bridges, Monopteros and Chinese Tower are built in `our_world.js`; `park_views.js` adds skyline/stream details and visitors, while `park_terrain.mjs` defines the hill height. The drift module follows a fixed stream segment between bridges.

Convert the old neighborhood convention (+X north, +Z east) to the date convention (+X east, +Z south), including headings, bounds, paths, interaction points, and map projections. Centralize the river curve before adding more river content: it is currently duplicated across several modules. Split construction from runtime update and disposal so returning to the plaza does not leave another render loop, sound graph, or set of input listeners alive.

### The stair hall

Reuse `buildStairHall` and `floorHeight`, not `lmu_interior.js`'s independent first-person renderer and event loop. Its three discovery points can motivate the visit without inventing a new collectible system. Resolve the missing `lmu-interior.html` and reference-photo dependencies; design an in-engine transition or deliberately isolated page with a shared, versioned save contract. Ground-only `blocked(x, z)` is insufficient for companion travel on stairs.

### Coast and driving later

The coast is a deliberately separate fantasy scene near legacy x≈300, outside the date bounds. Its sea/sky shaders and sand can be reused, but the module changes global sunlight and hides points; all state must be restored when leaving. A chapter transition is clearer than pretending the beach is geographically beside LMU.

The driving code supplies a procedural coupe, a timestep-limited physics helper, footprint collision tests, braking, and safe-speed exit checks. Its current permitted lane is only z≈24.8–37.2. Build a short, forgiving route before extending the neighborhood. Agree on a single authority for the party's position while driving and recover correctly on restart, tab interruption, and disembarkation.

Track the exact legacy dependencies and defects in [REVIEW_FINDINGS.md](REVIEW_FINDINGS.md). Future chapter work should extract useful systems into the engine contract rather than importing entire legacy entry modules.
