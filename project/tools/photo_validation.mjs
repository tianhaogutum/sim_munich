#!/usr/bin/env node
// Browser regression checks for real photo geometry. Downloads stay in a disposable profile.
import { launchChrome, check, sleep } from './qa_lib.mjs';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
const base=process.argv.find(a=>/^https?:/.test(a))??'http://localhost:8100/';
const out='/tmp/lmu-photo-validation';await mkdir(out,{recursive:true});
const qa=await launchChrome();const results=[];
try{
 await qa.send('Page.navigate',{url:new URL('?stage=photos&notitle=1',base).href});
 await qa.until('!!window.__lmu?.photo?.inspectView','photo diagnostics ready',15000);
 await qa.tap('Escape');await qa.frames();
 await qa.evaluate(`(()=>{const e=__lmu.engine,t=e.route.PHOTO_TARGETS.find(t=>t.id==='facade');window.__photoTest={target:t, distance:50, opposite:false};e.cameraOverride=()=>{const q=__photoTest,n=q.target.normal??{x:0,z:1},p=q.target.target;e.camera.position.set(p.x+n.x*q.distance,p.y,p.z+n.z*q.distance);e.camera.lookAt(q.opposite?new e.THREE.Vector3(2*e.camera.position.x-p.x,p.y,2*e.camera.position.z-p.z):new e.THREE.Vector3(p.x,p.y,p.z));e.camera.updateMatrixWorld(true);};})()`);
 async function inspect(distance,opposite=false){await qa.evaluate(`__photoTest.distance=${distance};__photoTest.opposite=${opposite}`);await qa.frames();return qa.evaluate(`__lmu.photo.inspectView().find(r=>r.id==='facade')`);}
 let view=await inspect(50);check(view.valid,`clear real facade should be valid: ${JSON.stringify(view)}`);results.push({check:'clear surveyed facade',status:'PASS'});
 view=await inspect(150);check(!view.valid&&view.reason==='far','distant photo must fail');results.push({check:'distance rejects far photograph',status:'PASS'});
 view=await inspect(5);check(!view.valid&&view.reason==='near','near photo must fail');results.push({check:'distance rejects near photograph',status:'PASS'});
 view=await inspect(50,true);check(!view.valid&&['frame','missing'].includes(view.reason),'offscreen photo must fail');results.push({check:'offscreen photograph rejected',status:'PASS'});
 await inspect(50);
 await qa.evaluate(`(()=>{const e=__lmu.engine,p=__photoTest.target.target,n=__photoTest.target.normal??{x:0,z:1};const m=new e.THREE.Mesh(new e.THREE.SphereGeometry(18,12,8),new e.THREE.MeshBasicMaterial({color:0x883344}));m.position.set(p.x+n.x*25,p.y,p.z+n.z*25);e.scene.add(m);__photoTest.blocker=m;})()`);await qa.frames();
 view=await qa.evaluate(`__lmu.photo.inspectView().find(r=>r.id==='facade')`);check(!view.valid&&view.reason==='blocked',`opaque intervening geometry must block: ${JSON.stringify(view)}`);results.push({check:'opaque world geometry blocks photograph',status:'PASS'});
 await qa.evaluate(`__photoTest.blocker.removeFromParent();__photoTest.blocker.geometry.dispose();__photoTest.blocker.material.dispose();`);
 await qa.frames();await qa.screenshot(`${out}/clear-facade.png`);
 // Capture real images using public photo controls, and verify that framing gates progress.
 await qa.tap('p');await qa.frames();
 check(await qa.evaluate('__lmu.photo.isActive()'),'photo mode opens');
 await inspect(50,true);await qa.tap(' ');await sleep(450);
 check(await qa.evaluate('Object.values(__lmu.story.getState().photos).every(v=>!v)'),'invalid shutter must not grant any photo credit');
 results.push({check:'invalid shutter preserves quest progress',status:'PASS'});
 await inspect(50);await qa.tap(' ');await sleep(450);
 check(await qa.evaluate('__lmu.story.getState().photos.facade'),'valid shutter credits facade');
 await qa.until(`!!JSON.parse(localStorage.getItem('lmu-date-photos-v1')||'{}').facade`,'thumbnail persistence',4000);
 results.push({check:'valid photograph credits goal and persists thumbnail',status:'PASS'});
 // Debug-started chapters intentionally do not save; restore precisely the state produced above.
 await qa.evaluate(`localStorage.setItem('lmu-date-v1',JSON.stringify(__lmu.story.getState()));history.replaceState(null,'','?notitle=1');delete window.__lmu`);
 await qa.send('Page.reload',{ignoreCache:true});await qa.until('!!window.__lmu?.photo','restored photo module',15000);
 const restored=await qa.evaluate('__lmu.photo.getAlbumStats()');
 check(restored.restored===1&&restored.count===1&&restored.goals.includes('facade'),`restored photos must remain in visible album: ${JSON.stringify(restored)}`);
 results.push({check:'reload restores credited image into visible album',status:'PASS'});
 await qa.tap('Escape');await qa.frames();
 await qa.evaluate(`window.dispatchEvent(new CustomEvent('lmu:show-postcard'))`);
 await qa.until(`!!document.querySelector('.dp-save-postcard:not(:disabled)')`,'postcard rendered',10000);
 await qa.evaluate(`document.querySelector('.dp-save-postcard').focus(); window.__photoClicked=0;document.querySelector('.dp-save-postcard').addEventListener('click',()=>__photoClicked++)`);await qa.tap('Enter');await sleep(1800);console.log('export diagnostic',await qa.evaluate(`({focus:document.activeElement.className,clicks:__photoClicked,modal:__lmu.photo.isModalOpen(),disabled:document.querySelector('.dp-save-postcard').disabled})`),await readdir(qa.downloads));
 check((await readdir(qa.downloads)).some(name=>name.endsWith('.png')),'keyboard postcard export should download PNG');
 results.push({check:'postcard renders and exports PNG by keyboard',status:'PASS'});
 await qa.screenshot(`${out}/postcard.png`);
 await qa.tap('Escape');await qa.frames();check(!await qa.evaluate('__lmu.photo.isModalOpen()'),'Esc closes postcard');
 results.push({check:'postcard modal releases input on Escape',status:'PASS'});
 check(!qa.issues.some(i=>i.level==='error'),JSON.stringify(qa.issues));
 console.log(JSON.stringify(results,null,2));
}catch(error){results.push({check:'photo regression',status:'FAIL',detail:error.message});console.error(error.stack);process.exitCode=1;}
finally{await writeFile(`${out}/report.json`,JSON.stringify({results,issues:qa.issues},null,2));await qa.close();}
