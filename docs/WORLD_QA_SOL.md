# Integrated world acceptance check

Run date: 2026-11-09. Tested the shared integrated checkout at `http://localhost:8100/?notitle=1` in a fresh headless Chrome profile using the machine’s available WebGL backend (headless does not imply software rendering). This is correctness evidence, not hardware performance evidence.

```sh
node project/tools/world_walkthrough.mjs http://localhost:8100/ --out-dir /tmp/lmu-world-qa-sol
```

Result: **25 PASS, 0 FAIL**; no browser/console errors. Full machine-readable evidence: `/tmp/lmu-world-qa-sol/report.json`.

## Verified

- Six block instances and eighteen unique atlas places are loaded.
- All five chapter POIs are unblocked under the integrated core/district collision rules.
- All eighteen destinations accept `world.travel()` and land at their exact supplied viewpoint coordinates. The centre and four shoulder positions, 0.6 metres away, are unblocked. Travel does not advance the story stage.
- All eighteen discovery records survive a real page reload.
- G opens the atlas; the open atlas freezes W movement and consumes P without entering photo mode. Escape closes it and releases the world lock.
- Captured one viewpoint in each district plus the open atlas. No image export was sent to Downloads.

This checks safe arrival, not continuous pedestrian connectivity between every pair of places. The test does not claim traversable interiors or a fully surveyed street simulation.

## Visual finding requiring integration follow-up

**Fast travel camera can land inside a building.** At `west_amalien` `(28,-101)`, the default yaw-zero camera boom crosses a mapped building, filling the frame with its wall/windows. The player position and shoulder clearance are valid; the camera is the obstruction. Evidence: `/tmp/lmu-world-qa-sol/maxvorstadt_west-west_amalien.png`.

Recommended fix: camera-boom collision rejection/shortening, plus optional per-landmark arrival headings. The church arrival is safe but looks along Ludwigstraße rather than toward its principal facade, another useful case for per-landmark headings. Do not move buildings or disable their collision to fix the camera.

The Siegestor screenshot clearly shows the new gate, divided carriageways, windows and adjoining buildings. No obvious giant placeholder-building overlap appeared in the sampled views; fine seam/roof overlap is not exhaustively checked by these images.

## Evidence

- `/tmp/lmu-world-qa-sol/siegestor-siegestor.png`
- `/tmp/lmu-world-qa-sol/ludwigskirche-ludwigskirche.png`
- `/tmp/lmu-world-qa-sol/maxvorstadt_west-west_amalien.png`
- `/tmp/lmu-world-qa-sol/huberplatz-huberplatz_georgianum.png`
- `/tmp/lmu-world-qa-sol/ludwig_west-lw_philologicum.png`
- `/tmp/lmu-world-qa-sol/ludwigstrasse-ludwigstrasse-schelling.png`
- `/tmp/lmu-world-qa-sol/atlas.png`

Integrator follow-up: camera boom clipping and immediate arrival-camera reset are now implemented; the original wall-occlusion finding above refers to the pre-fix run.
