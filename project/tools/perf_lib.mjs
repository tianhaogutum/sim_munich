// Shared dependency-free CDP transport. Deliberately does not import shot.mjs (which runs on import).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const md = value => String(value ?? 'n/a').replaceAll('|', '\\|').replaceAll('\n', ' ');
export const round = (n, digits = 2) => Number.isFinite(n) ? Number(n.toFixed(digits)) : null;
export function options(argv, defaults = {}) {
  const result = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=');
      if (key === 'help') { result.help = true; continue; }
      const value = inline ?? argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
      result[key] = value;
    } else if (!result.url) result.url = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (result.url && !/^https?:\/\//.test(result.url)) throw new Error('baseUrl must be http(s)');
  return result;
}
export function numberOption(opts, key, min = 0) {
  const n = Number(opts[key]);
  if (!Number.isFinite(n) || n < min) throw new Error(`--${key} must be a number >= ${min}`);
  return n;
}

export async function launch({ width = 1280, height = 720, timeout = 120000 } = {}) {
  if (typeof WebSocket === 'undefined') throw new Error('Node 22+ is required (native WebSocket).');
  const binary = process.env.CHROME ?? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find(existsSync);
  if (!binary) throw new Error('Chrome not found; set CHROME to its executable.');
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const profile = mkdtempSync(join(tmpdir(), 'lmu-audit-'));
  const proc = spawn(binary, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--enable-precise-memory-info', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  let socket, closed = false, launchError;
  proc.on('error', error => { launchError = error; });
  const pending = new Map();
  const problems = [];
  const close = async () => {
    if (closed) return;
    closed = true;
    socket?.close();
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('CDP closed')); }
    pending.clear();
    if (proc.exitCode === null && !launchError) {
      const ended = once(proc, 'exit').catch(() => {});
      proc.kill();
      await Promise.race([ended, sleep(2000)]);
      if (proc.exitCode === null) { proc.kill('SIGKILL'); await Promise.race([ended, sleep(1000)]); }
    }
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    process.off('SIGINT', interrupt); process.off('SIGTERM', terminate);
  };
  const interrupt = () => { close().finally(() => process.exit(130)); };
  const terminate = () => { close().finally(() => process.exit(143)); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) {
      if (launchError) throw launchError;
      if (proc.exitCode !== null) throw new Error(`Chrome exited (${proc.exitCode})`);
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
      if (!target) await sleep(150);
    }
    if (!target) throw new Error('Chrome did not start within 15 s');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let nextId = 0;
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id); clearTimeout(item.timer);
        if (message.error) item.reject(new Error(`${item.method}: ${message.error.message}`));
        else item.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') {
        problems.push({ kind: 'exception', text: message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text });
      } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(message.params.type)) {
        problems.push({ kind: message.params.type, text: message.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
      } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        problems.push({ kind: 'resource', text: message.params.entry.text, url: message.params.entry.url });
      }
    };
    socket.onclose = () => {
      for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('Chrome disconnected')); }
      pending.clear();
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
      pending.set(id, { resolve, reject, timer, method });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
      return reply.result?.value;
    };
    const run = (fn, ...args) => evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`);
    await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
    await send('Performance.enable');
    await send('Browser.setDownloadBehavior', { behavior: 'deny' });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const navigate = async url => {
      // Consecutive viewpoints use the same URL. Do not mistake the outgoing
      // document's __lmu for the new scene while Page.navigate is still loading.
      await evaluate('window.__lmuAuditOldDocument = true');
      const result = await send('Page.navigate', { url });
      if (result.errorText) throw new Error(result.errorText);
      const until = Date.now() + 45000;
      while (Date.now() < until) {
        try {
          if (await evaluate(`!window.__lmuAuditOldDocument && location.href === ${JSON.stringify(url)} && !!window.__lmu?.engine?.renderer`)) return;
        } catch (error) { if (!/context|navigation/i.test(error.message)) throw error; }
        await sleep(200);
      }
      throw new Error(`Scene did not expose __lmu within 45 s: ${url}\n${JSON.stringify(problems)}`);
    };
    const key = async (key, code = key.length === 1 ? `Key${key.toUpperCase()}` : key) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    };
    const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    return { send, evaluate, run, navigate, key, metrics, close, problems, binary };
  } catch (error) { await close(); throw error; }
}

export function stageUrl(baseUrl, stage, touch = false) {
  const url = new URL(baseUrl);
  url.searchParams.set('stage', stage);
  if (touch) url.searchParams.set('touch', '1');
  return url.href;
}
