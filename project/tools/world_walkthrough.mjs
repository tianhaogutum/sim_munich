#!/usr/bin/env node
// Real browser acceptance checks for the integrated Munich atlas. No runtime changes.
// Usage: node project/tools/world_walkthrough.mjs http://localhost:8100/ --out-dir /tmp/lmu-world-qa
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launchChrome, check, sleep } from './qa_lib.mjs';
const args=process.argv.slice(2), base=args.find(x=>/^https?:/.test(x))??'http://localhost:8100/';
const oi=args.indexOf('--out-dir'),out=oi<0?'/tmp/lmu-world-qa':args[oi+1];
await mkdir(out,{recursive:true});
const qa=await launchChrome(), rows=[], url=new URL(base);url.searchParams.set('notitle','1');
qa.deadline=Date.now()+150000;
const record=(name,pass,detail)=>{rows.push({name,pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}: ${JSON.stringify(detail)}`);};
try {
 await qa.send('Page.navigate',{url:url.href});await qa.until('!!window.__lmu?.world','integrated world ready',20000);await qa.frames();
 const initial=await qa.evaluate('({blocks:__lmu.world.blocks.length,places:__lmu.world.landmarks.length,stage:__lmu.story.getState().stage})');
 record('world registry',initial.blocks===6&&initial.places===18,initial);
 // A clean profile begins at meet. Discovery can be tested without changing quest progress.
 const pois=await qa.evaluate('Object.entries(__lmu.engine.route.POIS).map(([id,p])=>({id,...p,blocked:__lmu.engine.blocked(p.x,p.z)}))');
 record('all quest points clear',pois.every(p=>!p.blocked),pois);
 const places=await qa.evaluate('__lmu.world.landmarks.map(p=>({id:p.id,name:p.name,x:p.x,z:p.z,district:p.district}))');
 for(const place of places){
  const result=await qa.evaluate(`(()=>{const w=__lmu.world,e=__lmu.engine,p=w.landmarks.find(p=>p.id===${JSON.stringify(place.id)});const stage=__lmu.story.getState().stage;const ok=w.travel(p),q=e.player.pos;return {ok,blocked:e.blocked(q.x,q.z),shoulders:[[.6,0],[-.6,0],[0,.6],[0,-.6]].some(([x,z])=>e.blocked(q.x+x,q.z+z)),distance:Math.hypot(p.x-q.x,p.z-q.z),position:q.toArray(),unchanged:stage===__lmu.story.getState().stage,discovered:w.getDiscoveries().includes(p.id)};})()`);
  await qa.frames();record(`arrival ${place.id}`,result.ok&&!result.blocked&&!result.shoulders&&result.unchanged,result);
  if(['siegestor','ludwigskirche','amalienstrasse'].includes(place.id)||!rows.some(r=>r.screenshot&&r.district===place.district)){
   await sleep(180);await qa.frames();const path=join(out,`${place.district}-${place.id}.png`);await qa.screenshot(path);rows.at(-1).screenshot=path;rows.at(-1).district=place.district;
  }
 }
 const saved=await qa.evaluate('__lmu.world.getDiscoveries().slice().sort()');
 await qa.send('Page.reload',{ignoreCache:true});await qa.until('!!window.__lmu?.world','world reload',20000);await qa.frames();
 const restored=await qa.evaluate('__lmu.world.getDiscoveries().slice().sort()');
 record('discoveries survive reload',saved.every(id=>restored.includes(id)),{saved,restored});
 await qa.tap('g');await qa.frames();record('G opens atlas',await qa.evaluate('__lmu.world.isOpen()'),null);
 const before=await qa.evaluate('__lmu.engine.player.pos.toArray()');await qa.key('w');await sleep(200);await qa.key('w',false);await qa.tap('p');await qa.frames();
 const locked=await qa.evaluate('({position:__lmu.engine.player.pos.toArray(),photo:__lmu.photo.isActive(),atlas:__lmu.world.isOpen()})');
 record('atlas blocks movement and photo',JSON.stringify(before)===JSON.stringify(locked.position)&&!locked.photo&&locked.atlas,locked);
 await qa.screenshot(join(out,'atlas.png'));await qa.tap('Escape');await qa.frames();record('Escape releases atlas lock',await qa.evaluate('!__lmu.world.isOpen()&&!__lmu.engine.isLocked()'),null);
 const errors=qa.issues.filter(i=>i.level==='error');record('no console errors',!errors.length,errors);
 const report={url:url.href,createdAt:new Date().toISOString(),rows,issues:qa.issues};await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(`${rows.filter(r=>r.pass).length} PASS; ${rows.filter(r=>!r.pass).length} FAIL; evidence ${out}`);process.exitCode=rows.some(r=>!r.pass)?1:0;
} catch(error){console.error(error.stack);process.exitCode=1;}finally{await qa.close();}
