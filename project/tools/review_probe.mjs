#!/usr/bin/env node
// Read-only runtime review. Own Chrome profile/downloads; use only the supplied server.
import { mkdir, writeFile } from 'node:fs/promises';
import { launchChrome, sleep } from './qa_lib.mjs';

const base = process.argv[2] ?? 'http://localhost:8117/';
const out = process.argv[3] ?? '/tmp/lmu-review-merged';
await mkdir(out, { recursive: true });
const qa = await launchChrome();
const results = {};
async function load(query = '?notitle=1') {
  await qa.evaluate('delete window.__lmu');
  await qa.send('Page.navigate', { url: new URL(query, base).href });
  await qa.until('!!window.__lmu', 'entry ready', 15000);
  await sleep(250);
}
async function snapshot(name) { await qa.screenshot(`${out}/${name}.png`); }
try {
  await load();
  await qa.evaluate('localStorage.clear()');
  await load();
  await qa.tap('m');
  results.muteBeforeReload = await qa.evaluate('({muted:__lmu.audio.isMuted(),saved:localStorage.getItem("lmu-date-audio-muted")})');
  await load();
  results.muteAfterReload = await qa.evaluate('({muted:__lmu.audio.isMuted(),saved:localStorage.getItem("lmu-date-audio-muted")})');

  await qa.tap('Escape');
  await sleep(450);
  await qa.evaluate('document.querySelector("[data-dt-action=settings]").click()');
  await sleep(250);
  await qa.evaluate('document.querySelector("#dt-volume").focus()');
  await qa.tap('Escape');
  await sleep(450);
  results.escapeFromSettingsInput = await qa.evaluate('({screen:document.querySelector("#date-title-root").dataset.screen,focused:document.activeElement.id,locked:__lmu.engine.isLocked()})');
  results.volume = await qa.evaluate(`(() => {
    const e = document.querySelector('#dt-volume'); e.value=25;
    e.dispatchEvent(new Event('input',{bubbles:true}));
    return {api:typeof __lmu.audio.setVolume, settings:JSON.parse(localStorage.getItem('lmu-date-settings')),audio:__lmu.audio.getDebugState()};
  })()`);
  await snapshot('settings');
  await load();

  // Compare handoff against the actual spring camera after zooming and pitching it.
  await qa.send('Input.dispatchMouseEvent', { type:'mouseWheel',x:450,y:320,deltaX:0,deltaY:-750 });
  await qa.send('Input.dispatchMouseEvent', { type:'mousePressed',x:450,y:320,button:'left',clickCount:1 });
  await qa.send('Input.dispatchMouseEvent', { type:'mouseMoved',x:450,y:400,button:'left',buttons:1 });
  await qa.send('Input.dispatchMouseEvent', { type:'mouseReleased',x:450,y:400,button:'left',clickCount:1 });
  await sleep(1600);
  results.cameraBefore = await qa.evaluate('__lmu.engine.camera.position.toArray()');
  await qa.tap('c');
  await qa.tap('c');
  results.cameraAtHandoff = await qa.evaluate(`(() => {
    const {cinematic:c,engine:e}=__lmu;
    c.update(.1); for(let i=0;i<12;i++){c.update(.1);e.cameraOverride?.(.1,0);}
    return {position:e.camera.position.toArray(),locked:e.isLocked(),override:!!e.cameraOverride};
  })()`);
  await sleep(1600);
  results.cameraAfter = await qa.evaluate('__lmu.engine.camera.position.toArray()');

  // Journal owns modal keys before photo/map/audio, or world actions can leak through.
  await qa.tap('j');
  await qa.frames();
  results.journalOpen = await qa.evaluate('({open:!document.querySelector(".dc-overlay").hidden,locked:__lmu.engine.isLocked()})');
  await qa.tap('n');
  results.mapThroughJournal = await qa.evaluate('document.querySelector(".dm-toggle").getAttribute("aria-pressed")');
  await qa.tap('p');
  await qa.frames();
  results.photoThroughJournal = await qa.evaluate('({photo:__lmu.photo.isActive(),journal:!document.querySelector(".dc-overlay").hidden,locked:__lmu.engine.isLocked()})');
  await load('?notitle=1&touch=1');

  // A synthetic stick is deliberately supported by the input module itself.
  results.touch = await qa.evaluate(`(() => {
    const stick=document.querySelector('.di-joystick'), r=stick.getBoundingClientRect();
    stick.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height*.2,bubbles:true}));
    const a=__lmu.engine.player.pos.toArray();
    __lmu.title.handleKey('escape',new KeyboardEvent('keydown',{key:'Escape'}));
    __lmu.input.update(.016);
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch',bubbles:true}));
    return {before:a,knob:document.querySelector('.di-stick-knob').style.transform,locked:__lmu.engine.isLocked()};
  })()`);
  await qa.tap('Escape'); await sleep(500);
  const pos = await qa.evaluate('__lmu.engine.player.pos.toArray()');
  await sleep(500);
  results.touch.after = await qa.evaluate('__lmu.engine.player.pos.toArray()');
  results.touch.beforeWait = pos;

  // Capture visible positioned controls and actual hit-test occlusion at both sizes.
  for (const [width,height] of [[1280,720],[420,800]]) {
    await qa.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await qa.frames();
    results[`layout${width}`] = await qa.evaluate(`(() => {
      const controls=[...document.querySelectorAll('button,#hud,.dm-panel,.di-joystick,.di-look')].filter(e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden');
      return controls.map(e=>{ const r=e.getBoundingClientRect(), top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return {id:e.id,cls:e.className,text:e.textContent.slice(0,40),rect:[r.x,r.y,r.width,r.height],occluded:!(e===top||e.contains(top)),top:top?.className}; });
    })()`);
    await snapshot(`layout-${width}`);
  }

  // Corrupt every persisted namespace read by the merged modules, not the pending story.
  await qa.evaluate(`for(const k of ['lmu-date-collect-v1','lmu-date-settings','lmu-date-audio-muted'])localStorage.setItem(k,'{broken');`);
  const issueCursor = qa.issues.length;
  await load();
  results.corruptStorage = { issues:qa.issues.slice(issueCursor),stats:await qa.evaluate('__lmu.collect.getStats()') };

  // Synchronous batches isolate each updater from renderer work and normal RAF.
  // Sampling includes collected objects: retained-heap deltas hide allocation churn.
  results.allocations = {};
  for (const name of ['audio','input','map','banter','collect','cinematic','life']) {
    await qa.send('HeapProfiler.startSampling',{samplingInterval:4096,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
    const n = 1800;
    const ms = await qa.evaluate(`(function reviewAllocationBatch() {const start=performance.now(); for(let i=0;i<${n};i++)__lmu.${name}.update(1/60,200+i/60);return performance.now()-start;})()`);
    const {profile} = await qa.send('HeapProfiler.stopSampling');
    let bytes=0;
    const sources={};
    function visit(node,owned=false) {
      const url=node.callFrame.url;
      owned ||= node.callFrame.functionName === 'reviewAllocationBatch';
      if(owned){bytes+=node.selfSize; if(node.selfSize)sources[`${url}:${node.callFrame.lineNumber+1} ${node.callFrame.functionName}`]=(sources[`${url}:${node.callFrame.lineNumber+1} ${node.callFrame.functionName}`]??0)+node.selfSize;}
      for(const c of node.children??[])visit(c,owned);
    }
    visit(profile.head);
    results.allocations[name]={bytes,frames:n,bytesPerSecondAt60fps:bytes/n*60,ms,sources};
    await writeFile(`${out}/heap-${name}.json`,JSON.stringify(profile));
  }
  results.issues=qa.issues;
  console.log(JSON.stringify(results,null,2));
} finally {
  await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
  await qa.close();
}
