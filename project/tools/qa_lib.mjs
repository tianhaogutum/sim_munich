// Small, dependency-free CDP client. Deliberately does not import shot.mjs (it runs on import).
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const check = (condition, message) => { if (!condition) throw new Error(message); };
export async function timeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: timed out after ${ms} ms`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

export async function launchChrome() {
  const profile = await mkdtemp(join(tmpdir(), 'lmu-playthrough-'));
  const downloads = join(profile, 'downloads');
  await mkdir(downloads);
  const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const proc = spawn(chrome, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=960,640', '--enable-unsafe-swiftshader', '--no-first-run',
    '--no-default-browser-check', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', spawnError;
  proc.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12000); });
  proc.on('error', error => { spawnError = error; });
  let ws;
  const pending = new Map();
  async function close() {
    ws?.close();
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer); reject(new Error('Chrome closed'));
    }
    pending.clear();
    if (proc.exitCode === null && !spawnError) {
      const exited = new Promise(resolve => proc.once('exit', resolve));
      proc.kill('SIGTERM');
      await Promise.race([exited, sleep(1500)]);
      if (proc.exitCode === null) { proc.kill('SIGKILL'); await Promise.race([exited, sleep(500)]); }
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  try {
    const deadline = Date.now() + 12000;
    let debuggerUrl;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (proc.exitCode !== null) throw new Error(`Chrome exited (${proc.exitCode}): ${stderr}`);
      debuggerUrl = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
      if (debuggerUrl) break;
      await sleep(100);
    }
    check(debuggerUrl, `Chrome did not expose CDP: ${stderr}`);
    const address = new URL(debuggerUrl);
    const targets = await (await fetch(`http://${address.host}/json/list`, { signal: AbortSignal.timeout(2000) })).json();
    const target = targets.find(t => t.type === 'page');
    check(target, 'Chrome has no page target');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await timeout(new Promise((resolve, reject) => {
      ws.onopen = resolve; ws.onerror = () => reject(new Error('CDP WebSocket failed'));
    }), 3000, 'CDP connect');
    let id = 0;
    const issues = [];
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id); clearTimeout(request.timer);
        if (message.error) request.reject(new Error(`${request.method}: ${JSON.stringify(message.error)}`));
        else request.resolve(message.result);
        return;
      }
      const p = message.params;
      if (message.method === 'Runtime.exceptionThrown') issues.push({
        level: 'error', source: 'exception', text: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text,
      });
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(p.type)) issues.push({
        level: p.type === 'warning' ? 'warning' : 'error', source: `console.${p.type}`,
        text: p.args.map(a => a.value ?? a.description ?? '').join(' '),
      });
      if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(p.entry.level)) issues.push({
        level: p.entry.level, source: 'browser', text: `${p.entry.text} ${p.entry.url ?? ''}`.trim(),
      });
    };
    ws.onclose = () => {
      for (const request of pending.values()) {
        clearTimeout(request.timer); request.reject(new Error('CDP WebSocket disconnected'));
      }
      pending.clear();
    };
    const qa = {
      issues, downloads, deadline: Infinity,
      send(method, params = {}, maxMs = 10000) {
        const ms = Math.min(maxMs, qa.deadline - Date.now());
        if (ms <= 0) return Promise.reject(new Error(`${method}: step deadline exceeded`));
        return new Promise((resolve, reject) => {
          const requestId = ++id;
          const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${method}: timed out`)); }, ms);
          pending.set(requestId, { resolve, reject, timer, method });
          ws.send(JSON.stringify({ id: requestId, method, params }));
        });
      },
      async evaluate(expression) {
        const result = await qa.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        check(!result.exceptionDetails, result.exceptionDetails?.exception?.description ?? result.exceptionDetails?.text);
        return result.result.value;
      },
      frames() { return qa.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); },
      async until(expression, label, maxMs = 7000) {
        const end = Math.min(Date.now() + maxMs, qa.deadline - 1500);
        while (Date.now() < end) {
          try { if (await qa.evaluate(expression)) return; }
          catch (error) {
            if (!/Execution context was destroyed|Cannot find context|Inspected target navigated/i.test(error.message)) throw error;
          }
          await sleep(80);
        }
        throw new Error(`${label}: condition not met`);
      },
      async key(key, down = true, extra = {}) {
        const codes = { Enter: 'Enter', Escape: 'Escape', ' ': 'Space' };
        const code = codes[key] ?? (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : `Digit${key}`);
        const vk = { Enter: 13, Escape: 27, ' ': 32 }[key] ?? key.toUpperCase().charCodeAt(0);
        await qa.send('Input.dispatchKeyEvent', {
          type: down ? 'keyDown' : 'keyUp', key, code, windowsVirtualKeyCode: vk,
          ...(down && key.length === 1 ? { text: key } : {}), ...extra,
        });
      },
      async tap(key) { await qa.key(key); await qa.key(key, false); },
      async screenshot(path) {
        const shot = await qa.send('Page.captureScreenshot', { format: 'png' }, 4000);
        await writeFile(path, Buffer.from(shot.data, 'base64'));
      },
      close,
    };
    await qa.send('Runtime.enable'); await qa.send('Log.enable'); await qa.send('Page.enable');
    // Never allow image exports to reach ~/Downloads. Delete the temporary profile on exit.
    try { await qa.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }); }
    catch { await qa.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }); }
    return qa;
  } catch (error) { await close(); throw error; }
}
