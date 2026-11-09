#!/usr/bin/env node
// Usage: node project/tools/playthrough.mjs http://localhost:8109 [--out-dir /tmp/lmu_qa] [--keep-server]
// Node 22+; no npm. CHROME overrides the Chrome executable, just as in shot.mjs.
// An existing server is never stopped. Only an unreachable localhost:8109 may be auto-served;
// --keep-server leaves that owned server running. All Chrome downloads use a disposable temp dir.
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, check, sleep } from './qa_lib.mjs';

const args = process.argv.slice(2);
const base = args.find(arg => /^https?:\/\//.test(arg));
const outIndex = args.indexOf('--out-dir');
if (!base || (outIndex >= 0 && (!args[outIndex + 1] || args[outIndex + 1].startsWith('--')))) {
  console.error('Usage: node project/tools/playthrough.mjs <baseUrl> [--out-dir /tmp/lmu_qa] [--keep-server]');
  process.exit(2);
}
const out = resolve(outIndex < 0 ? '/tmp/lmu_qa' : args[outIndex + 1]);
await mkdir(out, { recursive: true });
const url = new URL(base);
url.searchParams.delete('stage'); // Persistence must be tested without the debug fresh-run override.
url.searchParams.set('notitle', '1'); // Skip the title screen; it would hold a movement lock until 开始 is clicked.
const routeUrl = new URL('../src/date_route.mjs', import.meta.url);
const routeSource = await readFile(routeUrl, 'utf8');
const { POIS, SPAWN, FOUNTAINS, PHOTO_TARGETS } = await import(routeUrl.href);
const rows = [];
let qa, ownedServer, serverError;
const started = Date.now();
const totalDeadline = started + 115000;

async function ensureServer() {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(2000) });
  } catch (error) {
    check(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port === '8109',
      `Cannot reach ${url}: ${error.message}. Start your server; auto-start is restricted to localhost:8109.`);
  }
  if (response) { check(response.ok, `Server returned HTTP ${response.status}`); return; }
  ownedServer = spawn('python3', ['-m', 'http.server', '8109'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), detached: args.includes('--keep-server'), stdio: 'ignore',
  });
  ownedServer.on('error', error => { serverError = error; });
  if (args.includes('--keep-server')) ownedServer.unref();
  for (let attempt = 0; attempt < 30; attempt++) {
    if (serverError) throw serverError;
    if (ownedServer.exitCode !== null) throw new Error(`Port 8109 server exited (${ownedServer.exitCode})`);
    await sleep(100);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
  }
  throw new Error('Port 8109 server did not start');
}

async function step(name, work) {
  const index = rows.length + 1;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  const stem = join(out, `${String(index).padStart(2, '0')}-${slug}`);
  const cursor = qa.issues.length;
  const began = Date.now();
  const row = { step: name, status: 'PASS', detail: '', screenshot: `${stem}.png` };
  qa.deadline = Math.min(began + 13750, totalDeadline);
  try {
    // CDP requests share the absolute deadline. Avoid racing an uncancelled work()
    // promise that could keep pressing keys during the next step after a timeout.
    const detail = await work();
    if (detail?.status) Object.assign(row, detail);
    else row.detail = detail ?? '';
    await qa.frames(); // Every step reaches at least two rendered frames before its evidence.
    await qa.screenshot(row.screenshot);
  } catch (error) {
    row.status = 'FAIL'; row.detail = error.message;
    // Bound failure evidence too: no failed step can monopolize the run.
    qa.deadline = Math.min(began + 14900, totalDeadline);
    try { await qa.frames(); await qa.screenshot(row.screenshot); }
    catch { row.screenshot = null; }
  }
  row.issues = qa.issues.slice(cursor);
  if (row.issues.some(issue => issue.level === 'error')) {
    row.status = 'FAIL'; row.detail += `${row.detail ? '; ' : ''}${row.issues.filter(i => i.level === 'error').map(i => i.text).join('; ')}`;
  }
  row.ms = Date.now() - began;
  rows.push(row);
  await writeFile(`${stem}.console.json`, JSON.stringify(row.issues, null, 2));
  console.log(`${row.status.padEnd(15)} ${name.padEnd(23)} ${row.detail}`);
  qa.deadline = totalDeadline;
  return row.status !== 'FAIL';
}

const state = () => qa.evaluate('__lmu.story.getState()');
async function teleport(x, z, yaw = 0) {
  await qa.evaluate(`__lmu.engine.player.pos.set(${x},0,${z}); __lmu.engine.player.yaw = ${yaw}`);
  await qa.frames(); // nearestSight is assigned by the engine frame, not by teleport().
}
async function visibleClick(selector) {
  return qa.evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el => {
      const style = getComputedStyle(el);
      return el.getClientRects().length && style.visibility !== 'hidden' && style.display !== 'none' && !el.disabled;
    });
    if (!el) return false; el.click(); return true;
  })()`);
}
async function advanceDialogue(expectedStage) {
  for (let beat = 0; beat < 30; beat++) {
    const current = await state();
    const modal = await qa.evaluate('!!__lmu.storyUI.isModalOpen()');
    if (current.stage === expectedStage && !modal) return;
    if (await visibleClick('[data-option], .ds-choice, .ds-option')) await qa.frames();
    await qa.tap('1'); // Support keyboard-only choices as well as clickable option markup.
    await qa.tap('Enter');
    await qa.frames();
  }
}
async function closeOverlays() {
  // Escape toggles the pause menu when nothing else is open, so only press it while something is open.
  for (let i = 0; i < 4; i++) {
    const open = await qa.evaluate(
      '!!(__lmu.title?.isOpen?.() || __lmu.engine.isLocked() || __lmu.engine.isPhotoMode() || __lmu.storyUI.isModalOpen())');
    if (!open) return;
    if (!await visibleClick('.dp-close')) await qa.tap('Escape');
    await qa.frames();
    await new Promise(r => setTimeout(r, 500));   // menus fade over ~420 ms before they release their lock
  }
}
async function visit(id, from, to) {
  const before = await state();
  check(before.stage === from, `${id}: expected ${from}, got ${before.stage}`);
  const poi = POIS[id];
  check(poi, `Route is missing POIS.${id}`);
  await teleport(poi.x, poi.z);
  for (let attempt = 0; attempt < 2; attempt++) {
    await qa.tap('e'); await qa.frames();
    await advanceDialogue(to);
    if ((await state()).stage === to) break;
    await qa.frames(); // Retry E once if the proximity update or first interaction missed.
  }
  const after = await state();
  check(after.stage === to, `${id}: expected ${to}, got ${after.stage}`);
  return `${from} → ${after.stage}`;
}

async function photo(id) {
  await advanceDialogue('photos');
  check((await state()).stage === 'photos', 'Photo step requires stage photos');
  if (!await qa.evaluate('__lmu.photo.isActive()')) { await qa.tap('p'); await qa.frames(); }
  check(await qa.evaluate('__lmu.photo.isActive()'), 'P did not enter photo mode');
  const before = await state();
  let framing = '';
  if (id === 'facade') await teleport(0, 48);
  if (id === 'fountain') await teleport(35, 64);
  if (id === 'couple') {
    await teleport(0, 64);
    // The default 14 m boom is too far for the couple's <=9 m goal. Wheel is the public zoom input.
    await qa.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 480, y: 320, deltaX: 0, deltaY: -750 });
    await sleep(350); await qa.frames();
    let best;
    for (let i = 0; i < 16; i++) {
      const yaw = i * Math.PI / 8;
      await qa.evaluate(`__lmu.engine.player.yaw = ${yaw}`);
      await sleep(80); await qa.frames();
      const candidate = await qa.evaluate(`(() => {
        const e = __lmu.engine, h = e.companion.getHeadPosition().clone();
        e.camera.updateMatrixWorld();
        const p = h.clone().project(e.camera), d = h.distanceTo(e.camera.position);
        return { x:p.x, y:p.y, z:p.z, d };
      })()`);
      const target = PHOTO_TARGETS.find(t => t.id === id);
      const front = candidate.z > -1 && candidate.z < 1;
      const range = candidate.d >= target.minDist && candidate.d <= target.maxDist;
      const score = Math.abs(candidate.x) + Math.abs(candidate.y) + (front ? 0 : 100) + (range ? 0 : 10);
      if (!best || score < best.score) best = { ...candidate, score, yaw };
    }
    await qa.evaluate(`__lmu.engine.player.yaw = ${best.yaw}`);
  }
  await sleep(1500); await qa.frames(); // Let the real spring camera settle before every shutter.
  if (id === 'couple') {
    const p = await qa.evaluate(`(() => {
      const e = __lmu.engine; e.camera.updateMatrixWorld();
      const h = e.companion.getHeadPosition().clone(), p = h.clone().project(e.camera);
      return { x:p.x, y:p.y, z:p.z, distance:h.distanceTo(e.camera.position) };
    })()`);
    check(p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `Companion is out of frame: ${JSON.stringify(p)}`);
    framing = `, head distance ${p.distance.toFixed(2)} m`;
  }
  await qa.tap(' '); await qa.frames();
  await qa.until(`Object.values(__lmu.story.getState().photos).filter(Boolean).length > ${Object.values(before.photos).filter(Boolean).length}`,
    `${id} shutter did not credit a goal`, 2200);
  const after = await state();
  check(after.photos[id], `Shutter made progress but did not credit ${id}: ${JSON.stringify(after.photos)}`);
  return `${Object.values(after.photos).filter(Boolean).length}/${PHOTO_TARGETS.length} credited${framing}`;
}

async function movement(key, direction) {
  await closeOverlays();
  check(!await qa.evaluate('__lmu.engine.isLocked()'), 'A modal movement lock remained after Escape');
  const yaw = Math.PI / 3;
  await teleport(SPAWN.x, SPAWN.z, yaw);
  const before = await qa.evaluate('__lmu.engine.player.pos.toArray()');
  try { await qa.key(key); await sleep(1000); await qa.frames(); }
  finally { await qa.key(key, false); }
  const after = await qa.evaluate('__lmu.engine.player.pos.toArray()');
  const dx = after[0] - before[0], dz = after[2] - before[2];
  const expected = direction === 'forward' ? [-Math.sin(yaw), -Math.cos(yaw)] : [Math.cos(yaw), -Math.sin(yaw)];
  const along = dx * expected[0] + dz * expected[1];
  const across = Math.abs(dx * expected[1] - dz * expected[0]);
  check(after.every(Number.isFinite) && along > 0.1 && across < Math.max(0.08, along * 0.08),
    `${key}: wrong/no motion; delta (${dx}, ${dz}), forward ${along}, cross ${across}`);
  return `Δ(${dx.toFixed(2)}, ${dz.toFixed(2)}) m; yaw 60°`;
}

try {
  await ensureServer();
  qa = await launchChrome();
  console.log(`STATUS          STEP                    DETAIL\n${'-'.repeat(85)}`);
  await step('Fresh load', async () => {
    await qa.send('Page.navigate', { url: url.href });
    await qa.until(`location.origin === ${JSON.stringify(url.origin)} && document.readyState !== 'loading'`, 'origin ready', 6000);
    await qa.evaluate('localStorage.clear(); delete window.__lmu');
    await qa.send('Page.reload', { ignoreCache: true });
    await qa.until('!!window.__lmu', 'window.__lmu', 9500);
    await qa.frames();
    // A finished title screen can delay entry; click only recognizable start controls.
    const startedTitle = await visibleClick('[data-action="start"], [data-action="new-game"], .dt-start, #date-start, #start-btn');
    if (!startedTitle) await qa.evaluate(`(() => {
      const button = [...document.querySelectorAll('button, [role="button"]')].find(el => {
        const style = getComputedStyle(el);
        return el.getClientRects().length && style.visibility !== 'hidden' && style.display !== 'none' && !el.disabled &&
          /开始|出发|继续|进入|^(?:start|continue|new game|begin)\\b/i.test(el.textContent.trim());
      });
      button?.click();
    })()`);
    await qa.frames();
    check((await state()).stage === 'meet', `Fresh stage is ${(await state()).stage}`);
    const servedRoute = await qa.evaluate('fetch("./src/date_route.mjs").then(r => r.text())');
    check(servedRoute === routeSource, 'Served date_route.mjs differs from runner checkout; run this tool from the matching checkout');
    return '__lmu ready, meet, route matches checkout';
  });
  if (await qa.evaluate('!!window.__lmu')) {
    await step('Entrance', () => visit('entrance', 'meet', 'fountain_talk'));
    await step('White rose (optional)', async () => {
      const before = (await state()).stage;
      await teleport(POIS.white_rose.x, POIS.white_rose.z);
      await qa.tap('e'); await qa.frames();
      // Optional information must not skip the required chapter objective.
      check((await state()).stage === before, 'Optional POI unexpectedly advanced the quest');
      await closeOverlays(); return `visited; stage remains ${before}`;
    });
    await step('Fountain dialogue', () => visit('fountain', 'fountain_talk', 'find_memento'));
    await step('Find hair clip', () => visit('memento', 'find_memento', 'photos'));
    for (const id of ['facade', 'fountain', 'couple']) await step(`Photo ${id}`, () => photo(id));
    await step('Our plaza / ending', async () => {
      await closeOverlays();
      const detail = await visit('our_plaza', 'postcard', 'done');
      await closeOverlays(); return detail;
    });
    await step('Reload persistence', async () => {
      check((await state()).stage === 'done', 'Completion was not reached before reload');
      const storySource = await qa.evaluate('fetch("./src/date_story.mjs").then(r => r.text())');
      // A localStorage accessor alone is not save code: the supplied stub explicitly ignores storage.
      const code = storySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const mentionsStorage = /\blocalStorage\b/.test(code);
      const writesStorage = /\bsetItem\s*\(/.test(code);
      const explicitStub = /\bvoid\s+storage\b/.test(code) && /SKELETON NOTE/.test(storySource);
      await qa.evaluate('delete window.__lmu');
      await qa.send('Page.reload', { ignoreCache: true });
      await qa.until('!!window.__lmu', 'reload __lmu'); await qa.frames();
      const stage = (await state()).stage;
      if (stage === 'done') return 'done survived reload';
      if ((!mentionsStorage || explicitStub) && !writesStorage)
        return { status: 'NOT IMPLEMENTED', detail: `reset to ${stage}; story has no save implementation` };
      throw new Error(`Save code is present but reload reset stage to ${stage}`);
    });
    await step('Movement W', () => movement('w', 'forward'));
    await step('Movement D', () => movement('d', 'right'));
    await step('Fountain collision', async () => {
      await closeOverlays();
      check(!await qa.evaluate('__lmu.engine.isLocked()'), 'Movement still locked');
      await teleport(35, 60, 0);
      // Sample every frame while moving, not just the final position (detect crossing/NaNs).
      await qa.evaluate(`window.__lmuQaSample = { positions: [], active: true };
        requestAnimationFrame(function sample() {
          if (!window.__lmuQaSample.active) return;
          window.__lmuQaSample.positions.push(__lmu.engine.player.pos.toArray()); requestAnimationFrame(sample);
        });`);
      try { await qa.key('w'); await sleep(3000); await qa.frames(); }
      finally { await qa.key('w', false); }
      const positions = await qa.evaluate('__lmuQaSample.active = false; __lmuQaSample.positions');
      check(positions.length > 1, 'No collision samples');
      check(positions.every(p => p.every(Number.isFinite)), 'Non-finite player position');
      check(positions.every(p => FOUNTAINS.every(f => Math.hypot(p[0] - f.x, p[2] - f.z) >= f.r - 1e-6)), 'Player entered a fountain circle');
      const z = positions.at(-1)[2];
      check(z < 59, `No useful movement toward the fountain (${z}); collision result would be vacuous`);
      const fountain = FOUNTAINS.find(f => f.x > 0);
      const end = positions.at(-1);
      check(fountain && Math.hypot(end[0] - fountain.x, end[2] - fountain.z) <= fountain.r + 0.4,
        `Did not reach the fountain boundary in 3 s (z=${z}); cannot confirm blocking`);
      return `${positions.length} samples, stopped z=${z.toFixed(3)}, no circle entry/NaN`;
    });
    await step('Performance (120 frames)', async () => {
      const sample = await qa.evaluate(`new Promise(resolve => {
        const times = []; let previous, finished = false;
        const finish = () => {
          if (finished) return; finished = true; clearTimeout(timer);
          resolve({count:times.length, average:times.length ? times.reduce((a,b) => a+b,0) / times.length : 0, max:times.length ? Math.max(...times) : 0});
        };
        const timer = setTimeout(finish, 8500);
        function frame(t) {
          if (finished) return;
          if (previous !== undefined) times.push(t - previous); previous = t;
          if (times.length === 120) finish();
          else requestAnimationFrame(frame);
        } requestAnimationFrame(frame);
      })`);
      return `${sample.average.toFixed(2)} ms avg, ${sample.max.toFixed(2)} ms max (${sample.count}/120 intervals; informational, software GL${sample.count < 120 ? ', 8.5 s sample cap' : ''})`;
    });
  }
} catch (error) {
  rows.push({ step: 'Harness / startup', status: 'FAIL', detail: error.stack ?? error.message });
  console.error(`FAIL            Harness / startup       ${error.message}`);
} finally {
  if (qa) {
    try {
      const downloads = await readdir(qa.downloads);
      console.log(`Temporary downloads: ${downloads.length} (deleted on Chrome exit; never ~/Downloads)`);
    } catch {}
    await writeFile(join(out, 'console.json'), JSON.stringify(qa.issues, null, 2));
    await qa.close();
  }
  if (ownedServer && !args.includes('--keep-server')) ownedServer.kill('SIGTERM');
  const report = { url: url.href, elapsedMs: Date.now() - started, rows };
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
  const failures = rows.filter(row => row.status === 'FAIL').length;
  console.log(`${'-'.repeat(85)}\n${rows.filter(r => r.status === 'PASS').length} PASS; ${failures} FAIL; ${rows.filter(r => r.status === 'NOT IMPLEMENTED').length} NOT IMPLEMENTED; ${((Date.now() - started) / 1000).toFixed(1)} s\nEvidence: ${out}`);
  // Chrome's CDP WebSocket can retain an undici handle after close. Artifacts and cleanup
  // are awaited above; do not let a closed browser keep this CLI alive past its deadline.
  process.exit(failures ? 1 : 0);
}
