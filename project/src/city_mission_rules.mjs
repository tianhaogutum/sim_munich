import { ALL_CITY_PLACES } from './city_research_data.mjs';

export const MISSION_SAVE_VERSION = 2;
export const MISSION_STORAGE_KEY = 'munich-city-contracts-v2';
const places = new Map(ALL_CITY_PLACES.map(place => [place.id, place]));
const step = (placeId, task, question = null) => Object.freeze({placeId, task, question, radius:85});
export const CITY_MISSIONS = Object.freeze([
  Object.freeze({id:'oldtown-observer', name:'旧城建筑侦探', subtitle:'广场 → 双塔 → 城门', stamp:'旧城观察员', reward:120, steps:Object.freeze([
    step('marienplatz','抵达旧城中心，确认这段建筑观察之旅。'),
    step('frauenkirche','在教堂周边观察双塔轮廓，留下观察记录。'),
    step('session01-isartor','阅读现场笔记，破解伊萨尔门的时钟线索。',{prompt:'根据资料，伊萨尔门朝 Tal 街一面的钟面有什么特点？', choices:['反向读时','没有指针','只有一个刻度'], correct:0, explanation:'资料说明：朝 Tal 的西侧钟面反向，朝 Isartorplatz 的东侧正常。'})
  ])}),
  Object.freeze({id:'art-and-garden', name:'艺术与花园调查', subtitle:'国王广场 → 老绘画馆 → 宫廷花园', stamp:'花园调查员', reward:150, steps:Object.freeze([
    step('koenigsplatz','从公共广场观察古典建筑的轮廓。'),
    step('alte-pinakothek','在艺术区的室外步行节点记录博物馆外部。'),
    step('session01-hofgarten','阅读花园笔记，找出亭子与步道之间的关系。',{prompt:'中央亭的多少个入口拱洞呼应了花园路径？', choices:['四个','八个','十二个'], correct:1, explanation:'宫廷花园资料记载：亭子的八个入口拱洞呼应花园路径。'})
  ])}),
  Object.freeze({id:'isar-observer', name:'伊萨尔河岸手记', subtitle:'河桥 → 博物馆岛 → 圣路加堂', stamp:'河岸记录员', reward:130, steps:Object.freeze([
    step('isar','在 Reichenbachbrücke 附近的河岸观察点开始手记。'),
    step('deutsches-museum','从室外观察博物馆岛与伊萨尔河桥梁。'),
    step('session01-st-lukas','阅读圣路加堂河岸笔记，完成轮廓辨认。',{prompt:'圣路加堂河岸资料建议首先辨认哪一种轮廓？', choices:['穹顶','城门拱洞','八角侧塔'], correct:0, explanation:'资料建议从伊萨尔河西岸步道旁观察圣路加堂的穹顶轮廓。'})
  ])})
]);
export const missionById = id => CITY_MISSIONS.find(mission => mission.id === id) ?? null;
export const missionPlace = objective => places.get(objective?.placeId) ?? null;
export function distanceMeters(a,b) {
  if(!a || !b || !Number.isFinite(a.lon) || !Number.isFinite(a.lat) || !Number.isFinite(b.lon) || !Number.isFinite(b.lat)) return Infinity;
  const radians=Math.PI/180, lat=(a.lat+b.lat)*.5*radians;
  return Math.hypot((a.lon-b.lon)*111320*Math.cos(lat),(a.lat-b.lat)*111320);
}
export const freshMissionState = () => ({version:MISSION_SAVE_VERSION, active:null, stamps:{}});
export function restoreMissionState(raw) {
  try {
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data || data.version!==MISSION_SAVE_VERSION || !data.stamps || typeof data.stamps!=='object' || Array.isArray(data.stamps)) return freshMissionState();
    const state=freshMissionState();
    for(const mission of CITY_MISSIONS) {
      const stamp=data.stamps[mission.id];
      if(stamp && Number.isSafeInteger(stamp.completedAt) && stamp.completedAt>0) state.stamps[mission.id]={completedAt:stamp.completedAt};
    }
    const active=data.active, mission=missionById(active?.id);
    if(mission && Number.isInteger(active.index) && active.index>=0 && active.index<mission.steps.length) {
      // Arrival is always verified again from live position, never trusted from disk.
      state.active={id:mission.id,index:active.index,arrived:false};
    }
    return state;
  } catch { return freshMissionState(); }
}
export function startMission(state,id) {
  if(!missionById(id)) return state;
  return {...state,active:{id,index:0,arrived:false}};
}
export const restartMission = state => state.active ? startMission(state,state.active.id) : state;
export function currentObjective(state) {
  const mission=missionById(state.active?.id);
  return mission ? {mission,step:mission.steps[state.active.index],index:state.active.index,place:missionPlace(mission.steps[state.active.index])} : null;
}
export function updateMissionArrival(state,position) {
  const objective=currentObjective(state);
  if(!objective) return state;
  const arrived=distanceMeters(position,objective.place)<=objective.step.radius;
  return arrived===state.active.arrived ? state : {...state,active:{...state.active,arrived}};
}
export function confirmMissionObjective(state,{position,placeId,choice,now=Date.now()}={}) {
  const objective=currentObjective(state);
  if(!objective) return {state,result:'inactive'};
  if(placeId!==objective.step.placeId) return {state,result:'out-of-order'};
  if(!state.active.arrived || distanceMeters(position,objective.place)>objective.step.radius) return {state,result:'too-far'};
  if(objective.step.question && choice!==objective.step.question.correct) return {state,result:choice===undefined?'choice-required':'incorrect'};
  if(objective.index+1<objective.mission.steps.length) return {state:{...state,active:{id:objective.mission.id,index:objective.index+1,arrived:false}},result:'advanced'};
  const firstCompletion=!state.stamps[objective.mission.id];
  return {state:{...state,active:null,stamps:{...state.stamps,[objective.mission.id]:state.stamps[objective.mission.id]??{completedAt:Number.isSafeInteger(now)&&now>0?now:Date.now()}}},result:'complete',mission:objective.mission,firstCompletion};
}
export function missionRewards(state) {
  return CITY_MISSIONS.reduce((total,mission)=>total+(state.stamps[mission.id]?mission.reward:0),0);
}
