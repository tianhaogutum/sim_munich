import { createBlock as street } from './lmu_block_ludwigstrasse.js';
import { createBlock as north } from './lmu_block_siegestor.js';
import { createBlock as east } from './lmu_block_huberplatz.js';
import { createBlock as southwest } from './lmu_block_ludwig_west.js';
import { createBlock as west } from './lmu_block_maxvorstadt_west.js';
import { createBlock as southeast } from './lmu_block_ludwigskirche.js';
import { objectiveFor } from './date_story.mjs';
import { createReferencePhoto, photoForDistrict } from './lmu_reference_photos.mjs';
import { DISTRICTS, LANDMARKS, BUILDING_RINGS, ROAD_LINES, WORLD_STORAGE, normalizeDiscoveries, findSafeArrival } from './lmu_world_data.mjs';
export { LANDMARKS, DISTRICTS } from './lmu_world_data.mjs';

// One integration surface for all surveyed districts; no new global key listeners.
export function createWorld(engine, story) {
  const factories=[street,north,east,southwest,west,southeast];
  const blocks=[];
  try { for(const create of factories) blocks.push(create(engine)); }
  catch(error) { blocks.reverse().forEach(b=>b.dispose?.()); throw error; }
  let sheet=document.querySelector('link[data-lmu-world]');
  if(!sheet){sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./lmu_world.css',import.meta.url).href;sheet.dataset.lmuWorld='';document.head.append(sheet);}
  let found=[];try{found=normalizeDiscoveries(JSON.parse(localStorage.getItem(WORLD_STORAGE)||'[]'));}catch{}
  const discoveries=new Set(found);
  const root=document.createElement('div');root.id='lmu-world-root';
  root.innerHTML=`<button class="lw-open" type="button" aria-haspopup="dialog"><span>⌘</span> 慕尼黑漫游 <kbd>G</kbd><small class="lw-open-count"></small></button>
    <section class="lw-overlay" role="dialog" aria-modal="true" aria-labelledby="lw-title" hidden>
      <div class="lw-atlas"><header><div><div class="lw-eyebrow">MÜNCHEN · FIELD NOTES</div><h2 id="lw-title">在真实街区里，走远一点。</h2><p>六个街区，十八处风景。建筑轮廓来自 OpenStreetMap，细节参考实景照片。</p></div><button class="lw-close" type="button" aria-label="关闭地图">✕</button></header>
      <div class="lw-layout"><div class="lw-map-wrap"><canvas class="lw-map" width="840" height="620" aria-label="北向朝上的慕尼黑街区地图"></canvas><div class="lw-map-legend"><span>◆ 发现地点</span><span>● 你的位置</span><span>↑ 北</span></div><div class="lw-map-caption">建筑轮廓与道路来自保留的 OSM 数据；地图为游戏探索导览。</div></div>
      <div class="lw-sidebar"><div class="lw-progress"></div><div class="lw-places"></div><section class="lw-detail"><div class="lw-detail-district"></div><h3></h3><p></p><div class="lw-detail-actions"><button class="lw-go" type="button">快速前往</button><a class="lw-source" target="_blank" rel="noopener noreferrer">参考来源 ↗</a></div><small class="lw-travel-note">快速前往只改变位置，保留约会与拍照进度。</small></section></div></div>
      <footer><a class="lw-city" href="./city.html">慕尼黑全市探索 ↗</a><button class="lw-return" type="button">返回约会目标 ↗</button><span>照片用于造型参考，建筑高度与装饰有简化。<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a></span></footer></div>
    </section><div class="lw-discovered" role="status" aria-live="polite" hidden></div>`;
  document.body.append(root);
  const $=s=>root.querySelector(s), overlay=$('.lw-overlay'), canvas=$('.lw-map'), ctx=canvas.getContext('2d');
  let open=false, disposed=false, selected=LANDMARKS[0], focusBefore=null, lastUpdate=-Infinity, clock=0, noticeUntil=0;
  const referencePhoto = createReferencePhoto($('.lw-map-wrap'));
  const rows=new Map();
  const list=$('.lw-places');
  for(const d of DISTRICTS){
    const section=document.createElement('section');section.className='lw-district';
    const h=document.createElement('h3');h.textContent=d.name;section.append(h);
    for(const p of d.places){const button=document.createElement('button');button.type='button';button.dataset.place=p.id;
      const mark=document.createElement('span');mark.className='lw-place-mark';mark.textContent='◇';
      const label=document.createElement('span');label.textContent=p.name;
      const distance=document.createElement('small');button.append(mark,label,distance);
      button.onclick=()=>select(LANDMARKS.find(q=>q.id===p.id));section.append(button);rows.set(p.id,button);}
    list.append(section);
  }
  function progress(){
    $('.lw-progress').textContent=`城市手记 · 已发现 ${discoveries.size} / ${LANDMARKS.length}`;
    $('.lw-open-count').textContent=`${discoveries.size}/${LANDMARKS.length}`;
    for(const [id,row] of rows){row.classList.toggle('lw-found',discoveries.has(id));row.querySelector('.lw-place-mark').textContent=discoveries.has(id)?'◆':'◇';}
  }
  function select(place){
    if(!place)return;selected=place;
    $('.lw-detail-district').textContent=place.districtName;
    $('.lw-detail h3').textContent=place.name;
    $('.lw-detail p').textContent=place.text;
    const reference = photoForDistrict(place.district);
    $('.lw-source').href=reference?.source_page??place.source;
    $('.lw-source').textContent=reference?'实景照片原页 ↗':'参考来源 ↗';
    referencePhoto.update(place.district);
    for(const [id,row] of rows)row.setAttribute('aria-pressed',String(id===place.id));
    paint();
  }
  function setOpen(on){
    if(disposed||on===open)return false;
    if(on&&(engine.isLocked()||engine.isPhotoMode?.()))return false;
    open=on;overlay.hidden=!on;
    if(on){focusBefore=document.activeElement;engine.lock('world-atlas');select(selected);refreshDistances();$('.lw-close').focus();}
    else {engine.unlock('world-atlas');focusBefore?.isConnected&&focusBefore.focus({preventScroll:true});}
    return true;
  }
  function travel(place){
    const target=findSafeArrival(place,engine.blocked,engine.route?.BOUNDS);
    if(!target){engine.toast('这里暂时没有安全的落脚点，请沿街道靠近。');return false;}
    const p=engine.player; p.pos.set(target.x,engine.heightAt(target.x,target.z),target.z);
    // Face along the street if the destination itself is the standing viewpoint.
    p.yaw=Math.atan2(target.x-place.x||.01,target.z-place.z||12);
    engine.cameraOverride=null;
    engine.snapCamera?.();
    setOpen(false);engine.toast(`到了，${place.name??place.label??'约会地点'}。`);
    discover();return true;
  }
  function refreshDistances(){for(const p of LANDMARKS) rows.get(p.id).querySelector('small').textContent=`${Math.round(Math.hypot(p.x-engine.player.pos.x,p.z-engine.player.pos.z))} m`;}
  function paint(){
    if(!ctx)return;
    const w=canvas.width,h=canvas.height,pad=38,range={minX:-510,maxX:510,minZ:-320,maxZ:330};
    const scale=Math.min((w-pad*2)/(range.maxZ-range.minZ),(h-pad*2)/(range.maxX-range.minX));
    const mx=z=>w/2+(z-(range.minZ+range.maxZ)/2)*scale, my=x=>h/2-(x-(range.minX+range.maxX)/2)*scale;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#e9e2d0';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#dcd4bf';ctx.lineWidth=1;
    for(let x=-500;x<=500;x+=100){ctx.beginPath();ctx.moveTo(mx(-320),my(x));ctx.lineTo(mx(330),my(x));ctx.stroke();}
    for(let z=-300;z<=300;z+=100){ctx.beginPath();ctx.moveTo(mx(z),my(-510));ctx.lineTo(mx(z),my(510));ctx.stroke();}
    ctx.lineCap='round';ctx.strokeStyle='#c3b9a2';ctx.lineWidth=5;
    for(const ring of ROAD_LINES){ctx.beginPath();ring.forEach((p,i)=>i?ctx.lineTo(mx(p.z),my(p.x)):ctx.moveTo(mx(p.z),my(p.x)));ctx.stroke();}
    ctx.fillStyle='#c2b49b';ctx.strokeStyle='#a99a80';ctx.lineWidth=.6;
    for(const ring of BUILDING_RINGS){ctx.beginPath();ring.forEach((p,i)=>i?ctx.lineTo(mx(p.z),my(p.x)):ctx.moveTo(mx(p.z),my(p.x)));ctx.closePath();ctx.fill();ctx.stroke();}
    // The core may be replaced by the host; draw actual route fountains and entrance, never old assumed coordinates.
    for(const f of engine.route?.FOUNTAINS??[]){ctx.beginPath();ctx.arc(mx(f.z),my(f.x),Math.max(2,f.r*scale),0,Math.PI*2);ctx.fillStyle='#81a5a0';ctx.fill();}
    const core=engine.route?.POIS?.entrance;if(core){ctx.fillStyle='#5c6854';ctx.font='600 13px Nunito,sans-serif';ctx.textAlign='center';ctx.fillText('LMU',mx(core.z)-16,my(core.x)-12);}
    for(const place of LANDMARKS){const x=mx(place.z),y=my(place.x),chosen=place.id===selected.id;
      if(chosen){ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fillStyle='#bf775433';ctx.fill();}
      ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();
      ctx.fillStyle=chosen?'#a85837':discoveries.has(place.id)?'#536950':'#f9f4e8';ctx.fill();ctx.strokeStyle='#6e7762';ctx.lineWidth=1.5;ctx.stroke();}
    const p=engine.player.pos;ctx.beginPath();ctx.arc(mx(p.z),my(p.x),7,0,Math.PI*2);ctx.fillStyle='#344f68';ctx.fill();ctx.strokeStyle='#fff9ed';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#344d42';ctx.font='600 14px Nunito,sans-serif';ctx.textAlign='left';ctx.fillText('N ↑',24,30);
    ctx.strokeStyle='#6c7565';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(24,h-27);ctx.lineTo(24+100*scale,h-27);ctx.stroke();ctx.font='11px Nunito,sans-serif';ctx.fillText('100 m',24,h-37);
    canvas.__project=(x,z)=>({x:mx(z),y:my(x)});
  }
  function discover(){
    const p=engine.player.pos;for(const place of LANDMARKS){if(discoveries.has(place.id)||Math.hypot(p.x-place.x,p.z-place.z)>14)continue;
      discoveries.add(place.id);try{localStorage.setItem(WORLD_STORAGE,JSON.stringify([...discoveries]));}catch{}
      const notice=$('.lw-discovered');notice.textContent=`◆ 城市手记 +1 · ${place.name}`;notice.hidden=false;noticeUntil=clock+4;
      engine.audio?.cue?.('discover');progress();}
  }
  const close=()=>setOpen(false);
  $('.lw-open').onclick=()=>setOpen(true);$('.lw-close').onclick=close;$('.lw-go').onclick=()=>travel(selected);
  $('.lw-return').onclick=()=>{const id=story?objectiveFor(story.getState()).poi:'entrance';const p=engine.route?.POIS?.[id]??engine.route?.POIS?.entrance;if(p)travel({...p,name:p.label});};
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  canvas.addEventListener('click',e=>{const b=canvas.getBoundingClientRect(),x=(e.clientX-b.left)*canvas.width/b.width,y=(e.clientY-b.top)*canvas.height/b.height;
    let nearest=null,d=22;for(const p of LANDMARKS){const q=canvas.__project?.(p.x,p.z);if(!q)continue;const n=Math.hypot(q.x-x,q.y-y);if(n<d){d=n;nearest=p;}}if(nearest)select(nearest);});
  progress();select(selected);
  return { blocks,landmarks:LANDMARKS,buildingRings:BUILDING_RINGS,roadLines:ROAD_LINES,isOpen:()=>open,
    open:()=>setOpen(true),close,travel, getDiscoveries:()=>[...discoveries],
    handleKey(k,e){
      if(open){if(k==='escape'||k==='g'){close();return true;}
        if((k==='enter'||k===' ')&&e?.target?.closest?.('button,a[href]'))return false;
        if(k==='tab'){const items=[...overlay.querySelectorAll('button,a[href]')].filter(el=>!el.disabled&&!el.hidden);const i=items.indexOf(document.activeElement),step=e?.shiftKey?-1:1;items[(i+step+items.length)%items.length]?.focus();return true;}
        // Atlas owns every game shortcut while open; arrow keys and page keys can scroll the focused list.
        return !['arrowup','arrowdown','pageup','pagedown','home','end','tab'].includes(k);
      }
      if(k==='g'&&!e?.repeat)return setOpen(true);return false;
    },
    update(dt,et){if(disposed)return;clock+=Math.max(0,Math.min(dt||0,.25));
      $('.lw-open').hidden=engine.isPhotoMode?.()||(!open&&engine.isLocked());
      if(clock>=noticeUntil)$('.lw-discovered').hidden=true;
      if(clock-lastUpdate<.4)return;lastUpdate=clock;
      if(!engine.isLocked())discover();if(open){refreshDistances();paint();}
      for(const b of blocks)b.update?.(dt,et);
    },
    dispose(){if(disposed)return;setOpen(false);disposed=true;blocks.slice().reverse().forEach(b=>b.dispose?.());root.remove();},
  };
}
