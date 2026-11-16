#!/usr/bin/env node
// Heuristic live-DOM audit, not a WCAG conformance claim. Node 22+, no npm.
import { writeFileSync } from 'node:fs';
import { launch, options, stageUrl, md, round } from './perf_lib.mjs';
const usage = `Usage: node project/tools/a11y_audit.mjs <baseUrl> [--out /tmp/lmu_a11y.md]
  [--json /tmp/lmu_a11y.json] [--stages meet,photos,done] [--fail-on high|medium|low|none]
Audits 1280x720 and 420x800?touch=1, normal and 150% CSS zoom, normal/reduced motion.
Exit: 0 completed (default, findings in report); 1 findings at --fail-on severity; 2 audit error.`;

// Runs in the page. Keep this self-contained so it also works through CDP Runtime.evaluate.
function inspectDOM() {
  const css = e => getComputedStyle(e);
  const selector = e => {
    if (e.id) return `#${e.id}`;
    const parent = e.parentElement;
    const tag = e.tagName.toLowerCase();
    if (parent?.id) return `#${parent.id} > ${tag}${e.classList.length ? '.' + [...e.classList].join('.') : ''}`;
    return `${tag}${e.classList.length ? '.' + [...e.classList].join('.') : ''}`;
  };
  const rectOf = e => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  };
  const rendered = (e, onscreen = true) => {
    if (!e?.getBoundingClientRect) return false;
    for (let node = e; node; node = node.parentElement) {
      const s = css(node);
      if (node.hidden || node.inert || s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) <= .01) return false;
    }
    const r = rectOf(e);
    return r.width > 0 && r.height > 0 && (!onscreen || (r.right > 0 && r.bottom > 0 && r.x < innerWidth && r.y < innerHeight));
  };
  const parse = color => {
    const n = color.match(/[\d.]+/g)?.map(Number);
    if (!n || n.length < 3) return [0, 0, 0, 0];
    return [n[0], n[1], n[2], n[3] ?? 1];
  };
  const blend = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
  const lum = color => color.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((n, c, i) => n + c * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  const effectiveBackground = e => {
    const chain = [];
    for (let node = e; node; node = node.parentElement) chain.unshift(node);
    let bg = [10, 8, 24], bright = [255, 255, 255], opacity = 1, approximate = false;
    for (const node of chain) {
      const s = css(node), color = parse(s.backgroundColor);
      // The canvas paints over body; use the chosen backdrop until a panel is reached.
      if (node === document.body || node === document.documentElement) continue;
      bg = blend(color, bg); bright = blend(color, bright);
      opacity *= Number(s.opacity);
      if (color[3] > 0 && color[3] < 1 || s.backgroundImage !== 'none' || s.backdropFilter !== 'none') approximate = true;
    }
    return { bg, bright, opacity, approximate };
  };
  const name = e => {
    const refs = e.getAttribute('aria-labelledby');
    const referenceText = refs?.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
    return [referenceText, e.getAttribute('aria-label'), [...(e.labels ?? [])].map(l => l.textContent).join(' '),
      e.matches('input[type=button],input[type=submit]') ? e.value : '', e.textContent,
      e.getAttribute('alt'), [...e.querySelectorAll('img[alt]')].map(img => img.alt).join(' '), e.title]
      .find(value => value?.trim())?.trim() ?? '';
  };
  const controls = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[tabindex],[role=button]')]
    .filter(e => !e.disabled).map(e => ({ selector: selector(e), tag: e.tagName, role: e.getAttribute('role'),
      name: name(e), visible: rendered(e), rendered: rendered(e, false), tabIndex: e.tabIndex,
      ariaHidden: e.closest('[aria-hidden=true]') !== null, rect: rectOf(e) }));
  const contrast = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (!rendered(e) || e.closest('script,style,svg')) continue;
    const ownText = [...e.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).filter(Boolean).join(' ');
    if (!ownText) continue;
    const s = css(e), background = effectiveBackground(e), fg = parse(s.color);
    fg[3] *= background.opacity;
    const darkRatio = ratio(blend(fg, background.bg), background.bg);
    const brightRatio = ratio(blend(fg, background.bright), background.bright);
    contrast.push({ selector: selector(e), text: ownText.slice(0, 90), ratio: darkRatio,
      brightBackdropRatio: brightRatio, approximate: background.approximate,
      color: s.color, background: background.bg, fontSize: s.fontSize });
  }
  // Only independent visible HUD panels, not a parent intersecting its own children.
  const panels = [...document.querySelectorAll('#hud > *,#date-story-root,#date-audio-root,#panel,#days-popup,#photo-hint,#photo-btn,.di-actions,.di-movement,.di-hud-toggle')]
    .filter((e, i, a) => a.indexOf(e) === i && rendered(e));
  const overlaps = [];
  for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) {
    const a = panels[i], b = panels[j];
    if (a.contains(b) || b.contains(a)) continue;
    const x = rectOf(a), y = rectOf(b);
    const width = Math.min(x.right, y.right) - Math.max(x.x, y.x);
    const height = Math.min(x.bottom, y.bottom) - Math.max(x.y, y.y);
    if (width > 2 && height > 2) overlaps.push({ a: selector(a), b: selector(b), width, height });
  }
  const clipped = panels.filter(e => {
    const r = rectOf(e); return r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
  }).map(e => ({ selector: selector(e), rect: rectOf(e) }));
  const hasLive = e => !!e?.closest('[aria-live="polite"],[aria-live="assertive"],[role="status"],[role="alert"],[role="log"]');
  return { lang: document.documentElement.lang, controls, contrast, overlaps, clipped,
    objectives: [...document.querySelectorAll('#date-story-root,[data-objective],.ds-objective')].map(e => ({ selector: selector(e), live: hasLive(e), text: e.textContent.slice(0, 100) })),
    statusHints: document.querySelector('#status-panel')?.innerText ?? '',
    animations: document.getAnimations().map(a => ({ name: a.animationName ?? a.transitionProperty ?? 'web-animation',
      state: a.playState, target: a.effect?.target ? selector(a.effect.target) : null })),
    state: { photo: __lmu.engine.isPhotoMode(), info: document.getElementById('panel')?.classList.contains('open'),
      plaque: document.getElementById('days-popup')?.classList.contains('visible') },
    width: innerWidth, height: innerHeight, zoom: css(document.documentElement).zoom };
}

function auditSnapshot(snapshot, scenario, findings) {
  const add = (severity, check, target, evidence, fix) => findings.push({ severity, check, scenario, target, evidence, fix });
  if (!snapshot.lang) add('high', 'Language', 'html', 'Missing lang attribute', 'Set lang="zh-CN" on html.');
  for (const c of snapshot.controls) {
    if (c.visible && !c.name) add('high', 'Accessible name', c.selector, 'Visible control has no accessible name', 'Add a descriptive aria-label or visible associated label.');
    if (c.visible && /^[✕×✖x]$/i.test(c.name)) add('medium', 'Control purpose', c.selector, `Name is only “${c.name}”`, 'Use aria-label="关闭信息面板".');
    if (!c.visible && c.tabIndex >= 0 && c.rendered) add('high', 'Hidden keyboard target', c.selector, 'Offscreen element remains in the tab order', 'Use hidden/inert on closed panels; remove only while opening.');
    if (!c.visible && c.tabIndex >= 0 && !c.rendered) {
      // display:none removes focusability; opacity:0 does not. Confirm separately in the keyboard sweep.
    }
    if (c.visible && c.ariaHidden) add('high', 'ARIA hidden control', c.selector, 'Visible focusable descendant of aria-hidden=true', 'Remove aria-hidden from the active control ancestor.');
    if (scenario.includes('touch') && c.visible && (c.rect.width < 44 || c.rect.height < 44)) {
      add('medium', 'Touch target', c.selector, `${c.rect.width.toFixed(1)} × ${c.rect.height.toFixed(1)} CSS px`, 'Set min-width and min-height to 44px; retain spacing around controls.');
    }
  }
  for (const c of snapshot.contrast) if (c.ratio < 4.5) add('medium', 'Contrast', c.selector,
    `${c.ratio.toFixed(2)}:1; “${c.text}”${c.approximate ? ' (blended dark-panel estimate)' : ''}`,
    'Use opaque text and a darker/opaque backing panel; target at least 4.5:1.');
  for (const x of snapshot.overlaps) add('medium', snapshot.zoom === '1.5' ? '150% overlap' : 'HUD overlap', `${x.a} ↔ ${x.b}`,
    `${x.width.toFixed(1)} × ${x.height.toFixed(1)} CSS px intersection`, 'Place HUD panels in a responsive grid with reserved rows; allow scrolling in modal panels.');
  for (const c of snapshot.clipped) add('medium', 'Clipped HUD', c.selector,
    `Panel extends outside ${snapshot.width} × ${snapshot.height} viewport at zoom ${snapshot.zoom}`, 'Use max-height:calc(100dvh - 24px), overflow:auto, responsive widths and safe offsets.');
  for (const o of snapshot.objectives) if (!o.live) add('high', 'Objective announcements', o.selector,
    `Changing objective lacks aria-live: “${o.text}”`, 'Set role="status" aria-live="polite" aria-atomic="true" before updates.');
}

async function readKeyboardEvidence(browser) {
  return browser.run(async () => {
    // Follow same-origin import graph only, never assume a handler exists because a hint mentions a key.
    const queue = [...document.querySelectorAll('script[type=module][src]')].map(s => s.src), seen = new Set(), sources = [];
    while (queue.length && seen.size < 40) {
      const url = queue.shift();
      if (seen.has(url) || new URL(url).origin !== location.origin) continue;
      seen.add(url);
      const response = await fetch(url);
      if (!response.ok) continue;
      const text = await response.text();
      sources.push({ url: new URL(url).pathname, text });
      for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) queue.push(new URL(match[1], url).href);
    }
    return { sources, registered: window.__auditKeyListeners ?? [], handlers: ['photo', 'storyUI', 'audio'].map(key =>
      ({ module: key, source: __lmu[key]?.handleKey?.toString() ?? '' })) };
  });
}

async function main() {
  const config = options(process.argv.slice(2), { out: '/tmp/lmu_a11y.md', json: '/tmp/lmu_a11y.json', stages: 'meet,photos,done', 'fail-on': 'none' });
  if (config.help || !config.url) { console.log(usage); return config.help ? 0 : 2; }
  for (const key of Object.keys(config)) if (!['out','json','stages','fail-on','url','help'].includes(key)) throw new Error(`Unknown option --${key}`);
  if (!['none', 'high', 'medium', 'low'].includes(config['fail-on'])) throw new Error('Invalid --fail-on');
  const stages = config.stages.split(',');
  if (stages.some(s => !['meet', 'photos', 'done'].includes(s))) throw new Error('Invalid stage');
  const browser = await launch();
  const report = { createdAt: new Date().toISOString(), baseUrl: config.url, findings: [], snapshots: [], keyboard: null, motion: [], problems: browser.problems };
  const add = (severity, check, scenario, target, evidence, fix) => report.findings.push({ severity, check, scenario, target, evidence, fix });
  const settle = () => browser.run(async () => {
    const frames = n => new Promise(resolve => {
      const tick = () => --n <= 0 ? resolve() : requestAnimationFrame(tick);
      requestAnimationFrame(tick);
    });
    // A wall-clock sleep alone can end before even one software-rendered frame.
    // Wait for world updates, then finite UI transitions, then committed layout.
    await frames(4);
    const finite = document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime));
    await Promise.race([Promise.allSettled(finite.map(a => a.finished)),
      new Promise(resolve => setTimeout(resolve, 2000))]);
    await frames(2);
  });
  const snapshot = async scenario => {
    const data = await browser.run(inspectDOM);
    report.snapshots.push({ scenario, ...data }); auditSnapshot(data, scenario, report.findings);
    return data;
  };
  const teleport = async (x, z) => {
    await browser.run((x, z) => { __lmu.engine.player.pos.set(x, 0, z); }, x, z); await settle();
  };
  try {
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__auditKeyListeners = [];
      const add = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, callback, options) {
        if ((type === 'keydown' || type === 'keyup') && callback) window.__auditKeyListeners.push({type, source:String(callback)});
        return add.call(this, type, callback, options);
      };` });
    for (const device of [{ name: 'desktop', width: 1280, height: 720 }, { name: 'touch', width: 420, height: 800 }]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width: device.width, height: device.height, deviceScaleFactor: 1, mobile: device.name === 'touch' });
      await browser.send('Emulation.setTouchEmulationEnabled', { enabled: device.name === 'touch' });
      for (const stage of stages) {
        console.error(`Auditing ${device.name}/${stage}…`);
        const prefix = `${device.name}/${stage}`;
        await browser.navigate(stageUrl(config.url, stage, device.name === 'touch'));
        await settle();
        await snapshot(`${prefix}/spawn`);
        if (!report.keyboard) report.keyboard = await readKeyboardEvidence(browser);
        // Native tab sweep, including elements invisible through opacity rather than display:none.
        const visited = new Set();
        for (let i = 0; i < 12; i++) {
          await browser.key('Tab');
          const focus = await browser.run(() => {
            const e = document.activeElement, r = e.getBoundingClientRect();
            let hidden = r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth;
            for (let n = e; n; n = n.parentElement) if (+getComputedStyle(n).opacity <= .01) hidden = true;
            return { target: e.id ? '#' + e.id : e.tagName.toLowerCase(), hidden, text: e.textContent.slice(0, 50) };
          });
          if (visited.has(focus.target)) break; visited.add(focus.target);
          if (focus.hidden) add('high', 'Hidden keyboard target', `${prefix}/Tab`, focus.target,
            `Native Tab focused an invisible/offscreen control “${focus.text}”`, 'Toggle hidden or inert on closed panels, and restore focus to the invoking control.');
        }
        await browser.run(() => document.activeElement?.blur());
        // Test actual world actions; use the optional white-rose POI to avoid advancing the chapter.
        await teleport(0, 55); await browser.key('e'); await settle();
        const info = await snapshot(`${prefix}/info`);
        if (!info.state.info && !await browser.evaluate('__lmu.storyUI.isModalOpen()')) {
          add('high', 'Keyboard interaction', `${prefix}/info`, 'E', 'E at white-rose POI did not open an information/dialogue panel',
            'Ensure E reaches the active POI handler after movement and proximity update.');
        }
        await browser.key('Escape'); await settle();
        await teleport(10, 5.5); await browser.key('e'); await settle();
        const plaque = await snapshot(`${prefix}/plaque`);
        if (!plaque.state.plaque) add('high', 'Keyboard interaction', `${prefix}/plaque`, 'E',
          'E at the plaque did not open the days popup', 'Keep a keyboard equivalent for the plaque and avoid shadowing its proximity action.');
        await browser.key('Escape'); await settle();
        await teleport(0, 20); await browser.key('p'); await settle();
        const photo = await snapshot(`${prefix}/photo`);
        if (!await browser.evaluate('__lmu.engine.isPhotoMode()')) add('high', 'Keyboard photo', `${prefix}/photo`, 'P', 'P did not open photo mode', 'Route P to photo.handleKey before world controls.');
        await browser.key('Escape'); await settle();
        // Make a real toast, identify the changed node without depending on a generated selector.
        const toast = await browser.run(() => {
          __lmu.engine.toast('无障碍检查 · 提示公告', 1000);
          const e = [...document.querySelectorAll('body *')].find(e => e.textContent === '无障碍检查 · 提示公告');
          return { exists: !!e, live: !!e?.closest('[aria-live=polite],[aria-live=assertive],[role=status],[role=alert]') };
        });
        if (!toast.live) add('high', 'Toast announcements', prefix, 'engine.toast', 'Toast appears without an aria-live/status ancestor', 'Create role="status" aria-live="polite" aria-atomic="true" before setting toast text.');
        // Text-only CSS zoom is explicit: page-scale pinch zoom alone does not exercise reflow.
        await browser.run(() => { document.documentElement.style.zoom = '1.5'; }); await settle();
        await snapshot(`${prefix}/150%-zoom`);
        await browser.run(() => { document.documentElement.style.zoom = ''; });
        // Compare key-driven camera capabilities with actual handler source. Never claim full completion.
        const hints = photo.statusHints || report.snapshots.at(-2)?.statusHints || '';
        if (/鼠标|滚轮/.test(hints)) {
          const registered = report.keyboard.registered.map(x => x.source).join('\n');
          const keyboardCamera = /(?:yaw|pitch|camDist|camera\.(?:rotation|position|zoom))\s*(?:[+*\-/]?=)/.test(registered);
          if (!keyboardCamera) add('high', 'Keyboard camera', prefix, '#status-panel',
            'Hints require mouse drag/wheel; registered key handlers contain no yaw/pitch/zoom assignment',
            'Add Q/R yaw, PageUp/PageDown pitch and +/- zoom bindings; document them in status hints.');
        }
      }
      // Trigger transitions under both media values in the same live page, sampling synchronously.
      for (const value of ['no-preference', 'reduce']) {
        await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
        await browser.run(() => { document.getElementById('panel')?.classList.remove('open'); }); await settle();
        const motion = await browser.run(() => {
          const panel = document.getElementById('panel');
          if (panel) { panel.getBoundingClientRect(); panel.classList.add('open'); panel.getBoundingClientRect(); }
          return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
            animations: document.getAnimations().filter(a => a.playState === 'running').map(a => ({
              name: a.animationName ?? a.transitionProperty ?? 'web-animation',
              target: a.effect?.target?.id ?? a.effect?.target?.className ?? '' })) };
        });
        report.motion.push({ device: device.name, media: value, ...motion });
        if (value === 'reduce' && motion.animations.length) add('medium', 'Reduced CSS motion', device.name, '#panel',
          `${motion.animations.length} CSS animation(s)/transition(s) still running: ${motion.animations.map(a => a.name).join(', ')}`,
          'Under prefers-reduced-motion:reduce, disable decorative animation and transition on the HUD.');
      }
      const webglMotion = await browser.run(async () => {
        let object;
        __lmu.engine.scene.traverse(o => { if (!object && o.isInstancedMesh && o.count >= 200 && o.geometry.type === 'ShapeGeometry') object = o; });
        if (!object) return { tested: false };
        const before = Array.from(object.instanceMatrix.array.slice(-16));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { tested: true, changed: before.some((v, i) => v !== object.instanceMatrix.array[object.instanceMatrix.array.length - 16 + i]) };
      });
      if (webglMotion.changed) add('medium', 'Reduced WebGL motion', device.name, 'sakura InstancedMesh',
        'Petal transform still changes across two rAFs while reduce matches', 'Read the media query in the render loop; pause decorative petals, pulses and optional camera motion.');
      await browser.send('Emulation.setEmulatedMedia', { features: [] });
    }
    add('review', 'Keyboard completion', 'all', 'chapter route',
      'E, P and Escape were exercised; name/Tab/source checks do not prove every branching dialogue, photo framing or final restart can be completed.',
      'After integration, complete meet → dialogue choices → memento → three framed photos → postcard → restart using only keyboard; verify modal focus/return.');
    for (const p of report.problems.filter(p => p.kind === 'exception' || p.kind === 'error' || p.kind === 'resource')) {
      add('high', 'Runtime error', 'all', p.url ?? 'console', p.text, 'Resolve runtime/resource error, then rerun the audit.');
    }
  } finally { await browser.close(); }
  // Consolidate repeated findings while retaining every affected state and actual evidence.
  const groups = new Map();
  for (const f of report.findings) {
    const key = [f.severity, f.check, f.target, f.fix].join('|');
    const row = groups.get(key);
    if (row) { if (!row.scenarios.includes(f.scenario)) row.scenarios.push(f.scenario); if (!row.evidence.includes(f.evidence)) row.evidence.push(f.evidence); }
    else groups.set(key, { ...f, scenarios: [f.scenario], evidence: [f.evidence] });
  }
  report.groupedFindings = [...groups.values()];
  const rows = report.groupedFindings.map(f => `| ${md(f.severity)} | ${md(f.check)} | ${md(f.target)} | ${md(f.scenarios.join(', '))} | ${md(f.evidence.join('; '))} | ${md(f.fix)} |`);
  const contrastSamples = report.snapshots.flatMap(s => s.contrast);
  const text = `# LMU accessibility audit\n\n${report.createdAt}; ${report.baseUrl}\n\n` +
    `Live DOM: desktop 1280×720 and touch 420×800 with ?touch=1; stages ${config.stages}; spawn, info, plaque, photo, toast and CSS zoom 150%.\n\n` +
    `**Heuristic audit, not certification.** Contrast composites computed rgba ancestors over an assumed dark scene (10,8,24); JSON also records a bright-scene estimate. Canvas, gradients, shadows, overlap and backdrop blur require visual confirmation. All text uses the requested 4.5:1 threshold, including large text. CSS zoom tests layout reflow; native page pinch zoom is not used. Native Tab is checked; source inspection is supplementary and cannot prove route completion.\n\n` +
    `${report.snapshots.length} snapshots; ${contrastSamples.length} text samples; ${report.groupedFindings.length} distinct findings (${report.findings.length} state occurrences).\n\n` +
    `| Severity | Check | Target | States | Evidence | Suggested fix |\n|---|---|---|---|---|---|\n${rows.join('\n') || '| pass | Automated checks | — | all | No findings | Manually validate screen-reader and full keyboard route. |'}\n\n` +
    `## Motion measurements\n\n\`\`\`json\n${JSON.stringify(report.motion, null, 2)}\n\`\`\`\n\n` +
    `## Keyboard handler evidence\n\n${report.keyboard.registered.length} key listeners captured before module initialization; handler and same-origin module source stored in JSON.\n\n` +
    `## Browser diagnostics\n\n${report.problems.length ? report.problems.map(p => `- ${md(p.kind)}: ${md(p.text)}`).join('\n') : 'No console errors or exceptions.'}\n`;
  writeFileSync(config.out, text); writeFileSync(config.json, JSON.stringify(report, null, 2) + '\n');
  console.log(text); console.error(`Markdown → ${config.out}\nJSON → ${config.json}`);
  const levels = { high: 3, medium: 2, low: 1, review: 0, none: Infinity };
  return report.findings.some(f => levels[f.severity] >= levels[config['fail-on']]) ? 1 : 0;
}
main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.stack); process.exitCode = 2; });
