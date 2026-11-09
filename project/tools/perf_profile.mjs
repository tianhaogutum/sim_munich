#!/usr/bin/env node
// Node 22+, no npm. Whole-composer counters, not the last postprocessing pass.
import { writeFileSync } from 'node:fs';
import { launch, options, numberOption, stageUrl, md, round } from './perf_lib.mjs';

const usage = `Usage: node project/tools/perf_profile.mjs <baseUrl> [--out /tmp/lmu_perf.json] [--md /tmp/lmu_perf.md]
  [--views default|spawn,facade,fountain,plaza,photo] [--stages meet,photos,done]
  [--max-calls 400] [--max-tris 2000000] [--max-frame-ms N] [--max-p95-ms N]
  [--max-heap-mb N] [--max-heap-growth-mb-min N] [--max-children-growth N]
  [--frames 180] [--heap-ms 10000] [--warmup-frames 30] [--size 1280x720]
Exit: 0 complete, 1 threshold/runtime failure, 2 configuration/startup error.
Headless SwiftShader timings are software GL baselines, not hardware FPS predictions.`;
const views = {
  spawn: null,
  facade: { pos: [0, 0, 20], yaw: 0 },
  fountain: { pos: [30, 0, 36], yaw: -0.6 },
  plaza: { pos: [0, 0, 75], yaw: Math.PI },
  photo: { pos: [0, 0, 20], yaw: 0, photo: true },
};

function installCounters() {
  const { renderer, composer } = __lmu.engine;
  const original = composer.render;
  renderer.info.autoReset = false;
  window.__perf = { last: null, samples: null, longTasks: [], observerSupported: false };
  composer.render = function (...args) {
    renderer.info.reset();
    const start = performance.now();
    const result = original.apply(this, args);
    // Heap sampling must not include a profiler-created object on every frame.
    if (!__perf.samples) return result;
    // Aggregates shadow + scene + every bloom/composer pass in this frame.
    const info = renderer.info;
    const entry = { ...info.render, geometries: info.memory.geometries,
      textures: info.memory.textures, programs: info.programs?.length ?? 0,
      submitMs: performance.now() - start };
    __perf.last = entry;
    if (__perf.samples) __perf.samples.push(entry);
    return result;
  };
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    __perf.observerSupported = true;
    __perf.observer = new PerformanceObserver(list => {
      for (const e of list.getEntries()) __perf.longTasks.push({ start: e.startTime, duration: e.duration });
    });
    __perf.observer.observe({ type: 'longtask', buffered: false });
  }
}

function frameSample(count) {
  return new Promise(resolve => {
    const times = [];
    let prev;
    const start = performance.now();
    __perf.longTasks.length = 0;
    __perf.samples = [];
    const tick = time => {
      if (prev !== undefined) times.push(time - prev);
      prev = time;
      if (times.length < count) requestAnimationFrame(tick);
      else {
        const counters = __perf.samples;
        __perf.samples = null;
        // Long-task entries can arrive after the rAF that finishes the window.
        const end = performance.now();
        setTimeout(() => resolve({ times, counters: counters.slice(-count), start, end,
          longTasks: __perf.longTasks.filter(e => e.start >= start && e.start < end),
          longTasksSupported: __perf.observerSupported }), 100);
      }
    };
    requestAnimationFrame(tick);
  });
}

function sceneCensus() {
  const { scene } = __lmu.engine;
  const materialTypes = {};
  const geometries = new Set();
  let meshes = 0, casts = 0, instancedMeshes = 0, instances = 0, expandedVertices = 0, uniqueVertices = 0;
  let outlines = 0, objects = 0;
  scene.traverse(object => {
    objects++;
    if (!object.isMesh) return;
    meshes++;
    if (object.castShadow) casts++;
    if (object.isInstancedMesh) { instancedMeshes++; instances += object.count; }
    const materials = new Set((Array.isArray(object.material) ? object.material : [object.material]).map(m => m.type));
    for (const type of materials) materialTypes[type] = (materialTypes[type] ?? 0) + 1;
    if (object.material?.type === 'ShaderMaterial' && object.material?.side === 1 && object.parent?.isMesh) outlines++;
    const geo = object.geometry;
    const vertices = geo?.attributes.position?.count ?? 0;
    expandedVertices += vertices * (object.isInstancedMesh ? object.count : 1);
    if (geo && !geometries.has(geo)) { uniqueVertices += vertices; geometries.add(geo); }
  });
  return { objects, rootChildren: scene.children.length, meshes, materialTypes,
    castShadowMeshes: casts, instancedMeshes, instances, expandedVertices, uniqueVertices,
    uniqueGeometries: geometries.size, invertedHullCandidates: outlines };
}

function growthSample(duration) {
  // Numbers only, no per-frame arrays: avoid attributing profiler allocations to the game.
  const { scene } = __lmu.engine;
  const start = performance.now();
  const initialChildren = scene.children.length;
  let min = initialChildren, max = initialChildren, previous = initialChildren, added = 0, removed = 0, frames = 0;
  let fiveSeconds = null;
  const heap = [];
  const timer = setInterval(() => {
    if (performance.memory) heap.push({ ms: performance.now() - start, bytes: performance.memory.usedJSHeapSize });
  }, 1000);
  return new Promise(resolve => {
    const tick = () => {
      frames++;
      const now = performance.now(), size = scene.children.length;
      added += Math.max(0, size - previous); removed += Math.max(0, previous - size);
      previous = size; min = Math.min(min, size); max = Math.max(max, size);
      if (!fiveSeconds && now - start >= 5000) fiveSeconds = {
        elapsedMs: now - start, start: initialChildren, end: size, min, max, added, removed, frames,
        addedPerFrame: added / frames, netPerFrame: (size - initialChildren) / frames,
      };
      if (now - start < duration) requestAnimationFrame(tick);
      else { clearInterval(timer); resolve({ elapsedMs: now - start, children5s: fiveSeconds, heap }); }
    };
    requestAnimationFrame(tick);
  });
}

const mean = numbers => numbers.reduce((a, b) => a + b, 0) / numbers.length;
function aggregate(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return { avg: round(mean(numbers)), p95: round(sorted[Math.ceil(sorted.length * .95) - 1]), max: round(sorted.at(-1)) };
}
function markdown(report) {
  const rows = report.results.map(r => `| ${r.stage} | ${r.view} | ${r.frameMs.avg} / ${r.frameMs.p95} | ${r.render.calls.avg} / ${r.render.calls.max} | ${r.render.triangles.max} | ${r.memory.geometries} / ${r.memory.textures} / ${r.memory.programs} | ${round(r.heap.afterBytes / 1048576)} | ${r.heap.growthMBPerMin} / ${r.heap.retainedMBPerMin} | ${r.domNodes} | ${r.longTasks.count} / ${r.longTasks.totalMs} | ${r.growth.children5s?.end - r.growth.children5s?.start} |`);
  return `# LMU performance profile\n\n${report.createdAt}; ${report.baseUrl}\n\n` +
    `**SwiftShader software GL** at ${report.config.size}, DPR 1. Compare relative changes on the same machine; these timings do not predict hardware FPS.\n\n` +
    `Counters include scene, shadows and all composer passes (info.autoReset=false; reset once per composer.render). Triangles therefore count repeated work. Timings cover ${report.config.frames} rAF intervals after ${report.config['warmup-frames']} warmup frames. Long tasks cover that frame window only; submit time is CPU submission, not GPU time.\n\n` +
    `| Stage | View | Frame avg / p95 ms | Calls avg / peak | Triangles peak | Geom / tex / programs | Heap MiB | Heap gross / retained MiB/min | DOM nodes | Long tasks count / ms | Δ root children 5s |\n` +
    `|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n` +
    `Heap gross = net growth during ${report.config['heap-ms']} ms after forced GC; retained = post-GC growth over the same window. Neither is a count of all allocations; natural GC may lower gross. Census and raw frame/heap samples are in JSON. Child checks sample scene.children each rAF for at least 5 s; nested churn is not counted.\n\n` +
    `## Scene census (first view; all views in JSON)\n\n\`\`\`json\n${JSON.stringify(report.results[0]?.census ?? {}, null, 2)}\n\`\`\`\n\n` +
    `## Threshold failures\n\n${report.failures.length ? report.failures.map(f => `- ${f}`).join('\n') : 'None (only explicitly supplied thresholds are enforced).'}\n\n` +
    `## Browser diagnostics\n\n${report.problems.length ? report.problems.map(p => `- ${md(p.kind)}: ${md(p.text)}`).join('\n') : 'No console errors or exceptions.'}\n`;
}

async function main() {
  const config = options(process.argv.slice(2), { out: '/tmp/lmu_perf.json', md: '/tmp/lmu_perf.md',
    views: 'default', stages: 'meet,photos,done', frames: '180', 'heap-ms': '10000', 'warmup-frames': '30', size: '1280x720' });
  if (config.help || !config.url) { console.log(usage); return config.help ? 0 : 2; }
  const allowed = new Set(['url', 'out', 'md', 'views', 'stages', 'frames', 'heap-ms', 'warmup-frames', 'size', 'help',
    'max-calls', 'max-tris', 'max-frame-ms', 'max-p95-ms', 'max-heap-mb', 'max-heap-growth-mb-min', 'max-children-growth']);
  for (const key of Object.keys(config)) if (!allowed.has(key)) throw new Error(`Unknown option --${key}`);
  const selected = config.views === 'default' ? Object.keys(views) : config.views.split(',');
  const stages = config.stages.split(',');
  if (selected.some(v => !(v in views)) || stages.some(s => !['meet', 'photos', 'done'].includes(s))) throw new Error('Unknown view or stage');
  const frames = numberOption(config, 'frames', 1), heapMs = numberOption(config, 'heap-ms', 10000), warmup = numberOption(config, 'warmup-frames', 1);
  if (![frames, warmup].every(Number.isInteger)) throw new Error('Frame counts must be integers');
  for (const key of Object.keys(config).filter(k => k.startsWith('max-'))) numberOption(config, key);
  const [width, height] = config.size.split('x').map(Number);
  if (![width, height].every(n => Number.isInteger(n) && n > 0)) throw new Error('--size must be WIDTHxHEIGHT');
  const browser = await launch({ width, height, timeout: 300000 });
  const report = { createdAt: new Date().toISOString(), baseUrl: config.url, config, results: [], failures: [], problems: browser.problems };
  try {
    report.browser = await browser.send('Browser.getVersion');
    for (const stage of stages) for (const view of selected) {
      console.error(`Profiling ${stage}/${view}…`);
      // A fresh navigation for every case prevents stage, camera, audio and photo state leaking across views.
      await browser.navigate(stageUrl(config.url, stage));
      await browser.run(installCounters);
      await browser.run(v => {
        const { engine } = __lmu;
        const pos = v?.pos ?? [engine.route.SPAWN.x, 0, engine.route.SPAWN.z];
        engine.player.pos.set(...pos); engine.player.yaw = v?.yaw ?? engine.route.SPAWN.yaw;
      }, views[view]);
      if (views[view]?.photo) await browser.key('p');
      await browser.run(n => new Promise(resolve => {
        const tick = () => --n <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick);
      }), warmup);
      const actual = await browser.evaluate(`({stage: __lmu.story.getState().stage, photo: __lmu.engine.isPhotoMode(), camera: __lmu.engine.camera.position.toArray(), player: __lmu.engine.player.pos.toArray(), yaw: __lmu.engine.player.yaw})`);
      if (actual.stage !== stage || actual.photo !== !!views[view]?.photo) throw new Error(`State mismatch: ${JSON.stringify(actual)}`);
      if (!report.gl) report.gl = await browser.evaluate(`(() => { const gl=__lmu.engine.renderer.getContext(); const ext=gl.getExtension('WEBGL_debug_renderer_info'); return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)} })()`);
      const sample = await browser.run(frameSample, frames);
      const census = await browser.run(sceneCensus);
      // Release the instrumentation's samples before the heap window; CDP owns the returned copy.
      await browser.evaluate('__perf.last = null; __perf.longTasks.length = 0; __perf.observer?.disconnect();');
      await browser.send('HeapProfiler.collectGarbage');
      const before = await browser.metrics();
      const started = Date.now();
      const growth = await browser.run(growthSample, heapMs);
      const after = await browser.metrics();
      await browser.send('HeapProfiler.collectGarbage');
      const retained = await browser.metrics();
      const minutes = (after.Timestamp - before.Timestamp) / 60 || (Date.now() - started) / 60000;
      const render = Object.fromEntries(['calls', 'triangles', 'points', 'lines', 'submitMs'].map(key => [key, aggregate(sample.counters.map(s => s[key]))]));
      const last = sample.counters.at(-1);
      const domNodes = await browser.evaluate(`(() => {
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_ALL);
        let count = 1; while (walker.nextNode()) count++; return count;
      })()`);
      const result = { stage, view, actual, frameMs: aggregate(sample.times), render,
        memory: { geometries: last.geometries, textures: last.textures, programs: last.programs },
        heap: { source: 'Performance.getMetrics.JSHeapUsedSize', beforeBytes: before.JSHeapUsedSize, afterBytes: after.JSHeapUsedSize,
          retainedBytes: retained.JSHeapUsedSize, measuredMinutes: minutes,
          growthMBPerMin: round((after.JSHeapUsedSize - before.JSHeapUsedSize) / 1048576 / minutes),
          retainedMBPerMin: round((retained.JSHeapUsedSize - before.JSHeapUsedSize) / 1048576 / minutes) },
        domNodes, allocatedDomNodes: after.Nodes, census, growth,
        longTasks: { supported: sample.longTasksSupported, count: sample.longTasks.length,
          totalMs: round(sample.longTasks.reduce((n, t) => n + t.duration, 0)), entries: sample.longTasks },
        rawFrames: sample.times, rawCounters: sample.counters };
      report.results.push(result);
      const checks = { 'max-calls': render.calls.max, 'max-tris': render.triangles.max, 'max-frame-ms': result.frameMs.avg,
        'max-p95-ms': result.frameMs.p95, 'max-heap-mb': after.JSHeapUsedSize / 1048576,
        'max-heap-growth-mb-min': result.heap.retainedMBPerMin,
        'max-children-growth': growth.children5s.end - growth.children5s.start };
      for (const [flag, value] of Object.entries(checks)) if (config[flag] !== undefined && value > Number(config[flag])) {
        report.failures.push(`${stage}/${view}: ${flag} ${round(value)} > ${config[flag]}`);
      }
      // Checkpoint every completed view, so a later crash preserves useful measurements.
      writeFileSync(config.out, JSON.stringify(report, null, 2) + '\n'); writeFileSync(config.md, markdown(report));
      console.error(`  ${result.frameMs.avg}/${result.frameMs.p95} ms; ${render.calls.max} calls; ${render.triangles.max} triangles`);
    }
    if (report.problems.some(p => p.kind === 'exception' || p.kind === 'error' || p.kind === 'assert' || p.kind === 'resource')) {
      report.failures.push('Browser reported runtime/resource errors; see diagnostics.');
    }
  } finally { await browser.close(); }
  writeFileSync(config.out, JSON.stringify(report, null, 2) + '\n');
  const table = markdown(report); writeFileSync(config.md, table); console.log(table);
  console.error(`JSON → ${config.out}\nMarkdown → ${config.md}`);
  return report.failures.length ? 1 : 0;
}
main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.stack); process.exitCode = 2; });
