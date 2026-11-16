// Integration checks for the city entrypoint, using real map tiles and keyboard input.
import {launchChrome,check,sleep} from './qa_lib.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]??'http://localhost:8100/';
const out='/tmp/munich-feature-qa';await mkdir(out,{recursive:true});
const qa=await launchChrome(),results=[];
async function step(name,fn){try{const detail=await fn();results.push({name,status:'PASS',detail});console.log('PASS',name);}catch(error){results.push({name,status:'FAIL',detail:error.message});throw error;}}
try{
 await qa.send('Page.navigate',{url:new URL('city.html',base).href});
 await qa.until('window.__city?.getState().ready && __city.getState().sourceReady','map ready',20000);
 await step('all catalog markers are present',async()=>{
  const count=await qa.evaluate(`['city-catalog','session05-places','session07-places'].reduce((n,id)=>n+__city.map.getSource(id)._data.features.length,0)`);const expected=await qa.evaluate(`import('./src/city_research_data.mjs').then(m=>m.ALL_CITY_PLACES.length)`);check(count===expected,`found ${count}, expected ${expected}`);return count;
 });
 await step('failed travel rolls back and overlapping travel requests are rejected',async()=>{
  const rollback=await qa.evaluate(`(async()=>{const city=__city,previous={...city.player},jump=city.map.jumpTo;let once=true;city.map.jumpTo=function(...args){if(once){once=false;throw new Error('injected travel failure');}return jump.apply(this,args);};try{const result=await city.travel('marienplatz');return {result,previous,current:{...city.player},paused:city.getState().paused};}finally{city.map.jumpTo=jump;}})()`);
  check(rollback.result===false&&!rollback.paused,'failed travel left the game paused');
  check(rollback.previous.lon===rollback.current.lon&&rollback.previous.lat===rollback.current.lat,'failed travel moved player');
  const results=await qa.evaluate(`Promise.all([__city.travel('lmu'),__city.travel('nymphenburg')])`);
  check(results[0]===true&&results[1]===false,'overlapping travel was accepted');
  check(await qa.evaluate(`__city.travel({lon:0,lat:0})`)===false,'outside bounds was accepted');
 });
 await step('opening a mission clears held movement, closing does not restart it',async()=>{
  await qa.key('w');await sleep(200);await qa.tap('k');
  check(await qa.evaluate('__city.features.isInputBlocked()'),'dialog did not block movement');
  const before=await qa.evaluate('({...__city.player})');await sleep(300);await qa.tap('Escape');await sleep(300);
  const after=await qa.evaluate('({...__city.player})');await qa.key('w',false);
  check(before.lon===after.lon&&before.lat===after.lat,'held input leaked out of dialog');
 });
 await step('old-town mission survives reload and awards a stamp through real travel',async()=>{
  await qa.tap('k');await qa.evaluate(`document.querySelector('[data-cm="start"][data-id="oldtown-observer"]').click()`);
  const ids=['marienplatz','frauenkirche','session01-isartor'];
  for(let i=0;i<ids.length;i++){
   check(await qa.evaluate(`__city.travel(${JSON.stringify(ids[i])})`),'travel failed');
   await qa.until(`!!document.querySelector('[data-cm="${i===2?'answer':'confirm'}"]')`,'arrival confirmation',7000);
   await qa.evaluate(`document.querySelector('[data-cm="${i===2?'answer':'confirm'}"]${i===2?'[data-choice="0"]':''}').click()`);
   if(i===0){await qa.send('Page.reload');await qa.until('window.__city?.getState().sourceReady','reload ready',20000);await qa.tap('k');}
  }
  const state=await qa.evaluate(`JSON.parse(localStorage.getItem('munich-city-contracts-v2'))`);
  check(state.stamps['oldtown-observer']?.completedAt>0,'stamp missing');check(state.active===null,'mission still active');
  await qa.screenshot(`${out}/completed-mission.png`);await qa.tap('Escape');return state;
 });
 await step('navigation search Escape releases input and target creates a map guide',async()=>{
  await qa.tap('v');await qa.evaluate(`document.querySelector('.cn-search').focus()`);await qa.tap('Escape');
  check(await qa.evaluate('!__city.features.isInputBlocked()'),'hidden search retained input lock');
  await qa.evaluate(`__city.navigator.setDestination('lmu')`);
  const target=await qa.evaluate('__city.navigator.getDestination()');check(target.id==='lmu','navigation target missing');
  await qa.until(`!!__city.map.getLayer('city-navigation-1-bearing')`,'bearing layer');
  return target;
 });
 await step('mobile mission dialog and toolbar fit a 390px viewport',async()=>{
  await qa.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await qa.frames();
  await qa.tap('k');await qa.frames();
  const bounds=await qa.evaluate(`(()=>{const r=document.querySelector('.cm-dialog').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
  check(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height,'mobile dialog overflow');check(!bounds.overflow,'page has horizontal overflow');
  await qa.screenshot(`${out}/mobile-mission.png`);await qa.tap('Escape');return bounds;
 });
 await step('feature disposal releases UI, navigation layers and catalog markers',async()=>{
  await qa.evaluate('__city.features.dispose(); __city.placeLayer.dispose()');
  check(await qa.evaluate(`!document.getElementById('city-missions-root')&&!document.querySelector('.cn-navigator')&&!document.querySelector('.ci-player-visibility')&&!__city.map.getSource('city-catalog')&&!__city.map.getLayer('city-navigation-1-bearing')`),'resources remain');
 });
 await step('no browser errors',async()=>{const errors=qa.issues.filter(i=>i.level==='error');check(!errors.length,JSON.stringify(errors));return qa.issues;});
}catch(error){console.error(error.stack);process.exitCode=1;}
finally{await writeFile(`${out}/report.json`,JSON.stringify({results,issues:qa.issues},null,2));await qa.close();}
