import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_MISSIONS,freshMissionState,startMission,restartMission,currentObjective,updateMissionArrival,confirmMissionObjective,restoreMissionState,missionRewards,distanceMeters} from '../src/city_mission_rules.mjs';
const arrive=state=>updateMissionArrival(state,currentObjective(state).place);
const confirm=(state,choice)=>confirmMissionObjective(state,{position:currentObjective(state).place,placeId:currentObjective(state).step.placeId,choice,now:1000});
test('objectives require the current place, real proximity, and explicit confirmation',()=>{
 let state=startMission(freshMissionState(),CITY_MISSIONS[0].id);
 assert.equal(confirm(state).result,'too-far');
 state=arrive(state);assert.equal(state.active.index,0);
 assert.equal(confirmMissionObjective(state,{position:currentObjective(state).place,placeId:'frauenkirche'}).result,'out-of-order');
 assert.equal(confirmMissionObjective(state,{position:{lon:0,lat:0},placeId:currentObjective(state).step.placeId}).result,'too-far');
 const next=confirm(state);assert.equal(next.result,'advanced');assert.equal(next.state.active.index,1);assert.equal(next.state.active.arrived,false);
});
test('every contract has a solvable sourced puzzle and awards its stamp once',()=>{
 for(const mission of CITY_MISSIONS){
  let state=startMission(freshMissionState(),mission.id),result;
  for(let i=0;i<mission.steps.length;i++){
   state=arrive(state);const objective=currentObjective(state);assert.ok(objective.place.source.startsWith('https:'));
   if(objective.step.question){assert.equal(confirm(state).result,'choice-required');assert.equal(confirm(state,99).result,'incorrect');}
   result=confirm(state,objective.step.question?.correct);state=result.state;
  }
  assert.equal(result.result,'complete');assert.equal(state.active,null);assert.equal(missionRewards(state),mission.reward);assert.equal(state.stamps[mission.id].completedAt,1000);
  state=startMission(state,mission.id);
  for(const step of mission.steps){state=arrive(state);result=confirm(state,step.question?.correct);state=result.state;}
  assert.equal(result.firstCompletion,false);assert.equal(missionRewards(state),mission.reward);
 }
});
test('invalid and old saves reset safely; valid saves preserve progress but verify arrival again',()=>{
 for(const value of [null,'{','{}','[]',JSON.stringify({version:1,stamps:{}}),{version:2,stamps:[]}])assert.deepEqual(restoreMissionState(value),freshMissionState());
 let state=startMission(freshMissionState(),CITY_MISSIONS[0].id);state=confirm(arrive(state)).state;state=arrive(state);
 const restored=restoreMissionState(JSON.stringify(state));assert.equal(restored.active.index,1);assert.equal(restored.active.arrived,false);
 assert.equal(restoreMissionState({version:2,stamps:{},active:{id:CITY_MISSIONS[0].id,index:100}}).active,null);
 assert.deepEqual(restoreMissionState({version:2,stamps:{unknown:{completedAt:123},[CITY_MISSIONS[0].id]:{completedAt:-1}}}).stamps,{});
});
test('restart resets sequence and arrival while keeping earned collections',()=>{
 const stamp={completedAt:1000};let state={...freshMissionState(),stamps:{[CITY_MISSIONS[1].id]:stamp}};
 state=startMission(state,CITY_MISSIONS[0].id);state=confirm(arrive(state)).state;
 const restarted=restartMission(state);assert.equal(restarted.active.index,0);assert.equal(restarted.active.arrived,false);assert.deepEqual(restarted.stamps,state.stamps);
 assert.equal(startMission(state,'missing'),state);
});
test('leaving an observation radius revokes arrival and malformed positions cannot complete',()=>{
 let state=arrive(startMission(freshMissionState(),CITY_MISSIONS[0].id));
 state=updateMissionArrival(state,{lon:0,lat:0});assert.equal(state.active.arrived,false);
 assert.equal(distanceMeters(undefined,{}),Infinity);assert.equal(distanceMeters({lon:0,lat:0},{lon:0,lat:0}),0);
 assert.equal(confirmMissionObjective(state,{position:null,placeId:currentObjective(state).step.placeId}).result,'too-far');
});
