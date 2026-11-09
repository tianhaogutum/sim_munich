# Munich: 100 shared-checkout tasks

The requested 100 independent T3 conversations have **not been created**. Both
`create_threads` and `t3_thread_launch` returned `parent_not_active` in this run.
Native agents completed the game work in bounded concurrent batches instead.

The prepared work divides each of Munich's 25 districts into four independent
deliverables: landmark coordinates, street geometry, architectural photo
references, and outdoor discovery walks. Each worker owns exactly one file under
`project/assets/city_research/dNN-{landmarks,streets,architecture,walks}.json`.
No worker may edit a shared entry point, switch branches, create a worktree,
launch another agent, or start a browser/server process. This avoids checkout
conflicts and 100 simultaneous browsers.

JSON results must distinguish measured/map-derived coordinates from estimates,
include source URLs and licensing, and contain no unsupported dimensions. The
city's streaming tile renderer provides geographic coverage independently of
these optional district refinements. The 100 spatial sectors in city_data.mjs
are geographic work units, not a claim of 100 active agents.
