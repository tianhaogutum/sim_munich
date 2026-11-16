import {CITY_MISSIONS,MISSION_STORAGE_KEY,freshMissionState,restoreMissionState,startMission,restartMission,currentObjective,updateMissionArrival,confirmMissionObjective,distanceMeters,missionRewards,missionPlace} from './city_mission_rules.mjs';

export function createCityMissions(engine) {
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./city_missions.css',import.meta.url).href;document.head.append(stylesheet);
  const root=document.createElement('div');root.id='city-missions-root';document.body.append(root);
  let state=freshMissionState(),open=false,feedback='',completion=null,elapsed=0,disposed=false,lastFocus=null,travelPending=false;
  try {state=restoreMissionState(localStorage.getItem(MISSION_STORAGE_KEY));}catch{}
  const persist=()=>{try{localStorage.setItem(MISSION_STORAGE_KEY,JSON.stringify(state));}catch{feedback='浏览器暂时无法保存；本次探索仍可继续。';}};
  const notify=text=>engine.notify?.(text);
  const position=()=>engine.player??engine.getState?.()?.player;
  const escape=text=>String(text??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function setOpen(value) {
    if(value&&!open)lastFocus=document.activeElement;
    open=value;feedback='';render();
    if(value)root.querySelector('.cm-close')?.focus();else if(lastFocus?.isConnected)lastFocus.focus();
  }
  function render() {
    if(disposed)return;
    const focused=root.contains(document.activeElement)?document.activeElement:null;
    const focusAction=focused?.dataset?.cm,focusChoice=focused?.dataset?.choice;
    const objective=currentObjective(state),count=Object.keys(state.stamps).length;
    const meters=objective?distanceMeters(position(),objective.place):Infinity;
    const range=Number.isFinite(meters)?meters<1000?`${Math.round(meters)} m`:`${(meters/1000).toFixed(1)} km`:'等待位置';
    const arrived=!!state.active?.arrived;
    root.innerHTML=`<aside class="cm-hud" aria-label="城市任务"><button class="cm-entry" data-cm="open"><span class="cm-kicker">城市委托 · ${count}/${CITY_MISSIONS.length} 印章</span><strong>${escape(objective?objective.mission.name:'领取一份城市委托')} <kbd>K</kbd></strong>${objective?`<span>${objective.index+1}/${objective.mission.steps.length} · ${escape(objective.place?.name)} · <b class="cm-distance">${range}</b></span><small>${arrived?'已抵达 · 按 E 查看并确认':'按顺序前往目标，到达后按 E 记录'}</small>`:'<span>建筑线索、河岸手记与可收集印章</span>'}</button>${objective?'<button class="cm-quick" data-cm="interact" aria-label="查看当前任务">查看任务</button>':''}</aside>${open?`<div class="cm-backdrop"><section class="cm-dialog" role="dialog" aria-modal="true" aria-labelledby="cm-title" tabindex="-1"><div class="cm-dialog-head"><span class="cm-kicker">MÜNCHEN · 城市探索手册</span><button class="cm-close" data-cm="close" aria-label="关闭任务">×</button></div><h2 id="cm-title">${completion?'委托完成！':objective?escape(objective.mission.name):'选择你的城市委托'}</h2><p class="cm-intro">按顺序抵达室外观察点，阅读资料并亲自确认。每份委托可收藏一枚印章。</p>${completion?renderCompletion():objective?renderActive(objective,range):renderCatalog()}<p class="cm-feedback" role="status" aria-live="polite">${escape(feedback)}</p><footer class="cm-footer">探索积分 ${missionRewards(state)} · 已收藏 ${count} 枚印章 · 进度自动保存在此浏览器<br>K 打开 / 关闭 · E 到达互动 · Esc 关闭</footer></section></div>`:''}`;
    if(engine.addAction&&!objective)root.querySelector('.cm-hud').hidden=true;
    if(focusAction){const next=[...root.querySelectorAll('[data-cm]')].find(el=>el.dataset.cm===focusAction&&el.dataset.choice===focusChoice);(next??root.querySelector('.cm-close'))?.focus();}
  }
  function renderCatalog() {
    return `<div class="cm-contracts">${CITY_MISSIONS.map(mission=>`<article class="cm-contract"><div class="cm-stamp ${state.stamps[mission.id]?'cm-earned':''}">${state.stamps[mission.id]?'◆':'◇'}</div><h3>${escape(mission.name)}</h3><p>${escape(mission.subtitle)}</p><small>3 个观察点 · ${mission.reward} 积分 · ${escape(mission.stamp)}</small><button data-cm="start" data-id="${mission.id}">${state.stamps[mission.id]?'再次探索':'接受委托'}</button></article>`).join('')}</div>`;
  }
  function renderActive({mission,step,index,place},range) {
    return `<ol class="cm-steps">${mission.steps.map((item,i)=>`<li class="${i<index?'cm-done':i===index?'cm-current':''}"><span>${i<index?'✓':i+1}</span>${escape(missionPlace(item)?.name)}</li>`).join('')}</ol><article class="cm-objective"><span class="cm-kicker">当前目标 ${index+1}/${mission.steps.length} · ${range}</span><h3>${escape(place?.name)}</h3><p>${escape(step.task)}</p><blockquote>${escape(place?.description)}</blockquote><a class="cm-source" href="${escape(place?.source)}" target="_blank" rel="noopener noreferrer">查看地点资料 ↗</a>${state.active.arrived?step.question?`<fieldset class="cm-choices"><legend>${escape(step.question.prompt)}</legend>${step.question.choices.map((choice,i)=>`<button data-cm="answer" data-choice="${i}">${escape(choice)}</button>`).join('')}</fieldset>`:'<button class="cm-primary" data-cm="confirm">记录观察 · 完成这一站</button>':`<p class="cm-arrival">距离目标 ${range} · 进入 ${step.radius} 米观察范围后可确认</p>`}<div class="cm-actions"><button data-cm="travel" ${travelPending?'disabled':''}>${travelPending?'正在前往…':'前往当前观察点'}</button><button data-cm="restart">从第一站重新开始</button><button data-cm="catalog">更换委托</button></div><small class="cm-outdoor">地理坐标为室外近似观察点。使用现有街道移动；委托不要求进入建筑或水面。</small></article>`;
  }
  function renderCompletion() {
    return `<div class="cm-completion"><div class="cm-medal">◆</div><h3>${escape(completion.mission.stamp)}</h3><p>${escape(completion.mission.name)} · 全部观察点已完成</p><strong>${completion.firstCompletion?`+${completion.mission.reward} 探索积分`:'再次探索完成 · 印章已在收藏中'}</strong><p>${escape(completion.mission.steps.at(-1).question?.explanation??'')}</p><button class="cm-primary" data-cm="done">查看其他委托</button></div>`;
  }
  function confirm(choice) {
    state=updateMissionArrival(state,position());
    const objective=currentObjective(state);
    const result=confirmMissionObjective(state,{position:position(),placeId:objective?.step.placeId,choice});
    state=result.state;
    feedback={inactive:'先领取一份委托。','too-far':'请先到达当前观察点。',incorrect:'再看看上方地点笔记，这条线索就在其中。','choice-required':'选择与地点笔记相符的答案。',advanced:'观察已记录。下一站已解锁。',complete:'印章已存入城市探索手册。'}[result.result]??'';
    if(result.result==='complete'){completion=result;notify(`委托完成 · ${result.mission.stamp}`);}else if(result.result==='advanced')notify('观察已记录 · 下一站已解锁');
    persist();render();
  }
  async function travel() {
    const objective=currentObjective(state);if(!objective||travelPending)return;
    travelPending=true;render();
    try {const result=await engine.travel(objective.place);feedback=result===false?'街道尚未就绪，请稍后再试。':'抵达后阅读笔记并确认观察。';}
    catch{feedback='暂时无法前往；可沿街继续靠近目标。';}
    finally {travelPending=false;if(!disposed){state=updateMissionArrival(state,position());render();}}
  }
  function onClick(event) {
    const button=event.target.closest('[data-cm]');if(!button)return;
    const action=button.dataset.cm;
    if(action==='open'||action==='interact'){completion=null;setOpen(true);}
    if(action==='close')setOpen(false);
    if(action==='start'){state=startMission(state,button.dataset.id);completion=null;feedback='委托已接受。前往第一站开始观察。';persist();render();}
    if(action==='confirm'||action==='answer')confirm(action==='answer'?Number(button.dataset.choice):undefined);
    if(action==='travel')void travel();
    if(action==='restart'){state=restartMission(state);feedback='当前委托已回到第一站。已获得的印章仍在收藏中。';persist();render();}
    if(action==='catalog'){state={...state,active:null};feedback='';persist();render();}
    if(action==='done'){completion=null;feedback='';render();}
  }
  function onKey(event) {
    if(!open||event.key!=='Tab')return;
    const focusables=[...root.querySelectorAll('.cm-dialog button:not(:disabled),.cm-dialog a[href]')];
    if(!focusables.length)return;
    const first=focusables[0],last=focusables.at(-1);
    if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}
    else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}
  }
  const removeAction=engine.addAction?.('城市委托','K',()=>{completion=null;setOpen(!open);});
  root.addEventListener('click',onClick);root.addEventListener('keydown',onKey);render();
  return {
    update(dt=0) {
      if(disposed)return;elapsed+=Number.isFinite(dt)?dt:0;if(elapsed<.3)return;elapsed=0;
      const previous=state.active?.arrived;state=updateMissionArrival(state,position());
      if(state.active?.arrived&&!previous)notify('已到达任务观察点 · 按 E 阅读笔记并确认');
      // Preserve keyboard focus and choice controls while a dialog is open.
      if(previous!==state.active?.arrived)render();
      else {const el=root.querySelector('.cm-distance'),objective=currentObjective(state);if(el&&objective){const meters=distanceMeters(position(),objective.place);el.textContent=Number.isFinite(meters)?meters<1000?`${Math.round(meters)} m`:`${(meters/1000).toFixed(1)} km`:'等待位置';}}
    },
    handleKey(key,event) {
      const k=String(key).toLowerCase();
      if(event?.target?.matches?.('input,textarea,select,[contenteditable="true"]'))return false;
      if(k==='k'&&!event?.repeat){event?.preventDefault();setOpen(!open);return true;}
      if(k==='escape'&&open){setOpen(false);return true;}
      if(k==='e'&&!event?.repeat&&state.active){completion=null;setOpen(true);return true;}
      return false;
    },
    isOpen:()=>open,
    close:()=>setOpen(false),
    dispose(){disposed=true;persist();root.removeEventListener('click',onClick);root.removeEventListener('keydown',onKey);root.remove();stylesheet.remove();if(typeof removeAction==='function')removeAction();}
  };
}
