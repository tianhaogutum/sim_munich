#!/usr/bin/env node
// Whole-composer software-GL audit. Node22+, Chrome; no package install or product mutation.
// Usage: node project/tools/world_perf.mjs http://localhost:8100/ --out /tmp/lmu-world-perf.json
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { launchChrome, check, sleep } from './qa_lib.mjs';
const args=process.argv.slice(2), base=args.find(a=>/^https?:/.test(a))??'http://localhost:8100/';
const outIndex=args.indexOf('--out');
const out=outIndex<0?'/tmp/lmu-world-perf.json':args[outIndex+1];
const url=new URL(base);url.searchParams.set('notitle','1');url.searchParams.set('stage','meet');
const qa=await launchChrome();
const report={date:new Date().toISOString(),url:url.href,renderer:'headless Chrome; unsafe SwiftShader is allowed but not forced. Actual backend recorded in census.glRenderer; timings are machine-specific, not target-device FPS predictions',views:[],issues:[]};
const median=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]??0;};
try{
 const began=Date.now();await qa.send('Page.navigate',{url:url.href});await qa.until('!!window.__lmu?.world','integrated world ready',20000);await qa.frames();
 report.initialNavigationToReadyMs=Date.now()-began;
 report.census=await qa.evaluate(`(()=>{const e=__lmu.engine;let objects=0,meshes=0,instances=0;const geos=new Set(),mats=new Set();e.scene.traverse(o=>{objects++;if(!o.isMesh)return;meshes++;if(o.isInstancedMesh)instances+=o.count;geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m)});const gl=e.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {objects,meshes,instances,geometries:geos.size,materials:mats.size,glRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),districts:__lmu.world.blocks.length,landmarks:__lmu.world.landmarks.length}})()`);
 await qa.evaluate(`(()=>{const e=__lmu.engine,original=e.composer.render;e.renderer.info.autoReset=false;window.__worldPerf={frames:[],enabled:false};e.composer.render=function(...args){e.renderer.info.reset();const start=performance.now();const result=original.apply(this,args);if(__worldPerf.enabled)__worldPerf.frames.push({...e.renderer.info.render,submitMs:performance.now()-start});return result}})()`);
 const views=[['core',null],['north','siegestor'],['church','ludwigskirche'],['west','west_schelling']];
 for(const [name,id] of views){
  if(id)await qa.evaluate(`(()=>{const p=__lmu.world.landmarks.find(p=>p.id===${JSON.stringify(id)});if(!p)throw Error('missing viewpoint');__lmu.world.travel(p)})()`);
  await sleep(400);await qa.frames();
  const row=await qa.evaluate(`new Promise(resolve=>{const f=__worldPerf;f.frames=[];f.enabled=true;const times=[];let old,count=0;function frame(t){if(old!==undefined)times.push(t-old);old=t;if(++count<61)requestAnimationFrame(frame);else{f.enabled=false;resolve({times,frames:f.frames,position:__lmu.engine.player.pos.toArray()})}}requestAnimationFrame(frame)})`);
  row.name=name;row.medianFrameMs=median(row.times);row.p95FrameMs=[...row.times].sort((a,b)=>a-b)[Math.floor(row.times.length*.95)];row.medianSubmitMs=median(row.frames.map(r=>r.submitMs));row.drawCalls=median(row.frames.map(r=>r.calls));row.triangles=median(row.frames.map(r=>r.triangles));delete row.frames;delete row.times;report.views.push(row);
 }
 await qa.evaluate(`(()=>{const e=__lmu.engine,t=e.route.PHOTO_TARGETS.find(t=>t.id==='facade').target;e.player.pos.set(t.x,0,t.z+38);e.cameraOverride=()=>{e.camera.position.set(t.x,6,t.z+38);e.camera.lookAt(t.x,t.y,t.z)};e.cameraOverride()})()`);await qa.frames();
 report.photoInspect=await qa.evaluate(`(()=>{if(typeof __lmu.photo.inspectView!=='function')return {available:false};const times=[];let result;for(let i=0;i<20;i++){const t=performance.now();result=__lmu.photo.inspectView();times.push(performance.now()-t)}return {available:true,times,result}})()`);
 if(report.photoInspect.times){report.photoInspect.medianMs=median(report.photoInspect.times);report.photoInspect.maxMs=Math.max(...report.photoInspect.times);delete report.photoInspect.times;}
 report.qualityHigh=await qa.evaluate(`(()=>{const e=__lmu.engine;return {pixelRatio:e.renderer.getPixelRatio(),composerPixelRatio:e.composer._pixelRatio,bloom:e.composer.passes.find(p=>'strength'in p)?.strength,shadows:e.renderer.shadowMap.enabled}})()`);
 await qa.evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('lmu-date-settings')||'{}');p.quality='low';localStorage.setItem('lmu-date-settings',JSON.stringify(p))})()`);
 await qa.send('Page.reload',{ignoreCache:false});await sleep(500);await qa.until('!!window.__lmu?.world','low quality reload',20000);await qa.frames();
 report.qualityLow=await qa.evaluate(`(()=>{const e=__lmu.engine;return {pixelRatio:e.renderer.getPixelRatio(),composerPixelRatio:e.composer._pixelRatio,bloom:e.composer.passes.find(p=>'strength'in p)?.strength,shadows:e.renderer.shadowMap.enabled}})()`);
 report.issues=qa.issues;check(!qa.issues.some(i=>i.level==='error'),'browser errors found');
}catch(error){report.error=error.stack;process.exitCode=1;}finally{await qa.close();await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log(`Report: ${out}`);}
