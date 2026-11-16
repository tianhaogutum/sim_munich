#!/usr/bin/env node
// Headless Chrome check: loads a URL, reports console errors/exceptions, runs optional JS, saves a screenshot.
// Usage:
//   node project/tools/shot.mjs <url> [--out shot.png] [--wait 4000] [--size 1280x720]
//        [--eval "js expression"]... [--between 600]
// Each --eval runs in page context, in order, `--between` ms apart (await-able; result is printed).
// The game exposes window.__lmu = { engine, story, cast, photo, storyUI } for scripted checks, e.g.
//   --eval "__lmu.engine.player.pos.set(0,0,12)" --eval "dispatchEvent(new KeyboardEvent('keydown',{key:'e'}))"
// Downloads go to a temp folder that is deleted on exit; pass --keep to keep it.
// Exit code 1 if the page threw an uncaught exception.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const url = args.find(a => /^https?:\/\//.test(a));
if (!url) { console.error('usage: node project/tools/shot.mjs <url> [--out file.png] [--wait ms] [--eval js]...'); process.exit(2); }
const out = opt('out', 'shot.png');
const wait = Number(opt('wait', 4000));
const between = Number(opt('between', 600));
const [width, height] = opt('size', '1280x720').split('x').map(Number);
const evals = args.flatMap((a, i) => (a === '--eval' ? [args[i + 1]] : []));
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'lmu-shot-'));
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
  '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const finish = code => { try { proc.kill(); } catch {} if (!args.includes('--keep')) try { rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(code); };

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) { console.error('Chrome did not start'); finish(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
const problems = [];
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  const p = msg.params;
  if (msg.method === 'Runtime.exceptionThrown') problems.push(`EXCEPTION ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`);
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(p.type))
    problems.push(`console.${p.type}: ${p.args.map(a => a.value ?? a.description ?? '').join(' ')}`);
  if (msg.method === 'Log.entryAdded' && p.entry.level === 'error') problems.push(`LOG ${p.entry.text} ${p.entry.url ?? ''}`);
};
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
});

const downloads = join(profile, 'downloads');
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
// Keep test downloads (e.g. photo exports) out of ~/Downloads; they are listed at the end.
const dl = await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
if (dl.error) await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
await send('Page.navigate', { url });
await sleep(wait);
for (const expression of evals) {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const ex = reply.result?.exceptionDetails;
  const value = reply.result?.result;
  console.log(`eval> ${expression.slice(0, 90)} => ${ex ? `THROWS ${ex.exception?.description ?? ex.text}` : JSON.stringify(value?.value ?? value?.description ?? null)}`);
  await sleep(between);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log(problems.length ? problems.join('\n') : 'no console errors');
console.log(`screenshot -> ${out}`);
try { const files = readdirSync(downloads); if (files.length) console.log(`downloads (${downloads}): ${files.join(', ')}`); } catch {}
ws.close();
finish(problems.some(p => p.startsWith('EXCEPTION')) ? 1 : 0);
