# Integrated Munich world performance audit

Measured 2026-11-09, approximately 11:34–11:35 CET, against the shared live integration at `http://localhost:8100/?notitle=1&stage=meet`.

Reproduce:

```sh
node project/tools/world_perf.mjs http://localhost:8100/ --out /tmp/lmu-world-perf.json
```

The script uses a disposable Chrome profile and temporary downloads via `qa_lib.mjs`. It makes no repository/runtime changes. It counts the entire composer render (scene, shadows and postprocessing), rather than the final fullscreen pass. The JSON is written even on failure, and browser errors fail the run.

## Backend and limits

The **observed renderer was `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)`**. The headless helper allows SwiftShader but does not force it. These results are therefore machine-specific **hardware-backed headless** observations, not software-GL results and not a frame-rate promise for phones or other GPUs. The 16.7 ms intervals coincide with the display/rAF cadence. Submission time is CPU wall time around `composer.render()`, not GPU execution time. Each view samples 60 rAF intervals after settling; this is a short regression baseline, not a long-duration soak.

## Integrated scene evidence

- Six districts and 18 atlas landmarks were present.
- 549 scene objects, 496 meshes, 35,951 instances, 279 unique geometries and 298 unique material references.
- Initial navigation to the exposed integrated engine: **1,322 ms** in this local run. CDN/network caches and concurrent agent activity mean this is not a cold-load guarantee.
- No browser errors or warnings were captured.

| View | World position X,Z | Whole-composer draw calls | Whole-composer triangles | Median submission time | Median rAF interval |
| --- | --- | ---: | ---: | ---: | ---: |
| LMU core | -52,24 | 483 | 1,676,478 | 1.4 ms | 16.7 ms |
| Siegestor north | 155.5,127 | 312 | 2,000,880 | 1.0 ms | 16.7 ms |
| Ludwigskirche | -198.70,17.02 | 287 | 1,250,377 | 1.0 ms | 16.7 ms |
| Schellingstraße west | -108,-175 | 263 | 1,200,318 | 0.7 ms | 16.7 ms |

Counts include shadows and postprocessing, so they must not be compared directly with a single scene-pass triangle count.

## Concrete findings

1. **Photography raycasting is the actionable CPU hotspot.** Framing the facade successfully, `photo.inspectView()` took a median **30.5 ms**, maximum **54.2 ms**, across 20 synchronous calls. An earlier offscreen viewpoint measured approximately 0.1 ms and was misleading; this tool now explicitly frames the facade before timing. The validator currently refreshes every 160 ms, so periodic long frames remain possible despite ordinary walking looking smooth.

   Suggested bounded fix, communicated to the photo owner: precompute transformed world-space AABBs for non-instanced candidate meshes. Reject a candidate before triangle raycasting when the ray's first box intersection lies beyond `raycaster.far`. Three.js's geometry box rejection alone uses the infinite ray and can still scan a whole distant merged district behind the target. Preserve objects containing the camera. Do **not** apply a geometry-local box to `InstancedMesh`: it omits instance transformations; retain the existing path unless an instance-aware object bound is available. Re-run this audit after the fix and compare the facade inspection result as well as its timing.

2. **Low quality reduces pixels and bloom, but not shadow work.** In the audited build, high had renderer/composer ratio 1 and bloom 0.5. Low correctly reloaded with both ratios **0.75** and bloom **0**, while `renderer.shadowMap.enabled` remained **true**. A minimal low-quality improvement is disabling shadows in `applyQuality()` and restoring them for medium/high (`shadowMap.needsUpdate=true` after change). This preserves high-quality appearance and reduces work on constrained devices. Root was notified; check the runtime version when interpreting later runs.

3. **Merged sector geometry trades draw calls for broad visibility.** North renders roughly two million triangles for one whole-composer frame. Static blocks are already material-batched, which is good for draw calls. A future mobile optimization could partition the largest batches into spatial chunks; this needs measured GPU tests because it increases draw calls and is not justified as an unmeasured last-minute rewrite.

4. **Companion pathfinding is bounded, but collision pressure deserves a slow-device check.** The cast A* has a 3,500-node limit and replans at most approximately every 650 ms; short direct routes return early. Each edge samples collision every 0.22 m with shoulder clearance. This is conservative and correct, but long wall detours can produce intermittent CPU work. Keep the bound and direct fast path. No route correctness regression was observed in this audit; this is a risk to profile during a longer roaming soak, not a measured failure.

## Acceptance

The integrated six-district scene loaded and all four sampled views rendered without browser errors. The real-photo validator correctly reported the framed facade as valid and non-framed targets as invalid during the performance sample. Local high/low settings persisted and renderer/composer ratios stayed consistent. Runtime fixes and a longer mobile soak remain outside this audit's file ownership.
