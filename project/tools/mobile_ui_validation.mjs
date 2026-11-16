#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { launchChrome, check, sleep } from './qa_lib.mjs';
const base = process.argv.find(a=>/^https?:/.test(a)) || 'http://localhost:8100/';
const out='/tmp/lmu-mobile-ui-sol'; await mkdir(out,{recursive:true});
const qa=await launchChrome(), rows=[];
try {
 for(const [name,width,height,touch] of [['desktop',1280,720,false],['portrait',375,812,true],['landscape',812,375,true]]) {
  await qa.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
  await qa.send('Emulation.setTouchEmulationEnabled',{enabled:touch});
  await qa.send('Page.navigate',{url:`${base}?notitle=1${touch?'&touch=1':''}`});
  await qa.until('!!window.__lmu','game ready',15000); await sleep(700); await qa.frames();
  const baseline=await qa.evaluate(`(()=>{const selectors=['#status-panel','.ds-objective','.lw-open','.dm-panel','.dc-launcher','#date-audio-root','.di-joystick','.di-actions'];const r={};for(const s of selectors){const e=document.querySelector(s);if(!e||!e.getClientRects().length||getComputedStyle(e).display==='none')continue;const q=e.getBoundingClientRect();r[s]={x:q.x,y:q.y,w:q.width,h:q.height,right:q.right,bottom:q.bottom};}return r})()`);
  for(const [s,r] of Object.entries(baseline)) check(r.x>=-1&&r.right<=width+1&&r.y>=-1&&r.bottom<=height+1,`${name} ${s} outside viewport ${JSON.stringify(r)}`);
  // Large independent interactive utility panels must not sit on top of one another.
  const pairs=[['.ds-objective','.lw-open'],['.dm-panel','.lw-open'],['.dc-launcher','.lw-open']];
  for(const [a,b] of pairs){const x=baseline[a],y=baseline[b];if(x&&y)check(Math.min(x.right,y.right)-Math.max(x.x,y.x)<=1||Math.min(x.bottom,y.bottom)-Math.max(x.y,y.y)<=1,`${name} overlap ${a}/${b}`);}
  await qa.screenshot(`${out}/${name}-walk.png`);
  await qa.tap('g');await qa.frames();check(await qa.evaluate('__lmu.world.isOpen()'),'G atlas open');
  const atlas=await qa.evaluate(`(()=>{const e=document.querySelector('.lw-atlas'),r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}})()`);
  check(atlas.x>=-1&&atlas.y>=-1&&atlas.right<=width+1&&atlas.bottom<=height+1,`${name} atlas outside viewport`);
  await qa.evaluate("document.querySelector('.lw-district button').focus()"); await qa.tap('Enter');await qa.frames();
  check(await qa.evaluate("document.activeElement.matches('.lw-district button') && document.activeElement.getAttribute('aria-pressed') === 'true'"),'Enter selects focused atlas destination');
  const before=await qa.evaluate('__lmu.engine.player.pos.toArray()');await qa.key('w');await sleep(100);await qa.key('w',false);await qa.tap('p');
  check(await qa.evaluate('!__lmu.photo.isActive()'),'P blocked in atlas');
  check(JSON.stringify(before)===JSON.stringify(await qa.evaluate('__lmu.engine.player.pos.toArray()')),'W blocked in atlas');
  await qa.evaluate("document.querySelector('.lw-go').scrollIntoView({block:'nearest'})");await qa.frames();
  check(await qa.evaluate("(()=>{const r=document.querySelector('.lw-go').getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight})()"),'Fast-travel button reachable by scrolling/focus');
  await qa.screenshot(`${out}/${name}-atlas.png`);await qa.tap('Escape');await qa.frames();
  check(await qa.evaluate('!__lmu.world.isOpen() && !__lmu.engine.isLocked()'),'Escape closes atlas and releases movement');
  await qa.tap('Escape'); await sleep(500); await qa.frames();
  await qa.screenshot(`${out}/${name}-pause.png`);await qa.tap('Escape');await sleep(500);
  rows.push({name,width,height,baseline,atlas,status:'PASS'});console.log(`${name}: PASS bounds, utility separation, atlas, keyboard selection, modal input and Escape`);
 }
 check(!qa.issues.some(i=>i.level==='error'),JSON.stringify(qa.issues));
 await writeFile(`${out}/report.json`,JSON.stringify({rows,issues:qa.issues},null,2));
 console.log(`3 viewport scenarios PASS; screenshots ${out}`);
} finally {await qa.close();}
