import test from 'node:test';
import assert from 'node:assert/strict';
import { avoidPoint, createLifeSimulation, createWaypoints, distance, seededRandom, stepFlock, steerPedestrian, tramAtTime, TRAM_PERIOD } from '../src/lmu_life_sim.mjs';
const blocked = (x,z) => z<3 || z>118 || Math.abs(x)>100 || [-35,35].some(fx => Math.hypot(x-fx,z-48)<5.4);
const safe = (a,b) => {
  for(let t=0;t<=1;t+=.01) assert.equal(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t),false);
};
test('routes detour around either fountain and never enter blocked ground', () => {
  for(const x of [-35,35]) {
    let start={x,z:30}; const path=createWaypoints(start,{x,z:68},blocked);
    assert.ok(path.length>=2);
    for(const end of path) { safe(start,end); start=end; }
    assert.deepEqual(start,{x,z:68});
  }
});
test('unreachable destinations do not produce an unsafe fallback', () => {
  assert.deepEqual(createWaypoints({x:0,z:30},{x:35,z:48},blocked),[]);
  assert.deepEqual(createWaypoints({x:0,z:30},{x:0,z:60},(x,z)=>z>40&&z<50),[]);
});
test('walking past a player maintains more than 1.5 m of personal space', () => {
  const actor={x:-6,z:70,yaw:Math.PI/2,speed:1.2,side:1}, player={x:0,z:70};
  let minimum=Infinity;
  for(let i=0;i<900;i++) {
    steerPedestrian(actor,{x:8,z:70},player,1/60,blocked);
    minimum=Math.min(minimum,distance(actor,player)); assert.equal(blocked(actor.x,actor.z),false);
  }
  assert.ok(minimum>1.5,`minimum gap: ${minimum}`);
  assert.ok(actor.x>5,'walks around and continues toward its destination');
});
test('avoidance handles overlap and checks alternate escape directions near a wall', () => {
  const player={x:0,z:0}, result=avoidPoint({x:0,z:0},player,1.65,(x,z)=>x>0);
  assert.ok(result.x<=0); assert.ok(distance(result,player)>1.5);
});
test('a flock scatters as a group, flies for 6–10 seconds, and lands on safe ground', () => {
  const flock={x:-12,z:77,y:0,state:'ground'}, random=seededRandom(8);
  stepFlock(flock,1/60,{player:{x:-12,z:78},blocked,random});
  assert.equal(flock.state,'flight'); assert.ok(flock.duration>=6&&flock.duration<=10);
  for(let i=0;i<180;i++) stepFlock(flock,1/60,{blocked,random});
  assert.ok(flock.y>2);
  for(let i=0;i<500;i++) stepFlock(flock,1/60,{blocked,random});
  assert.equal(flock.state,'ground'); assert.equal(flock.y,0); assert.equal(blocked(flock.x,flock.z),false);
});
test('companion proximity triggers flight without needing the player', () => {
  const flock={x:10,z:70,y:0,state:'ground'};
  stepFlock(flock,.016,{companion:{x:10,z:72},blocked,random:seededRandom(2)});
  assert.equal(flock.state,'flight');
});
test('tram is periodic, crosses z=90 once per cycle, and waits between passes', () => {
  for(const t of [0,10,22,31,38]) {
    const a=tramAtTime(t),b=tramAtTime(t+TRAM_PERIOD);
    assert.equal(a.visible,b.visible); assert.ok(Math.abs(a.z-b.z)<1e-10); assert.equal(b.cycle,a.cycle+1);
  }
  assert.equal(tramAtTime(27).visible,false);
  const crossing=(90+158)/316*28-4;
  assert.ok(Math.abs(tramAtTime(crossing).z-90)<1e-9); assert.equal(tramAtTime(crossing).visible,true);
});
test('done triggers a single celebration; unchanged done allows birds to land', () => {
  const sim=createLifeSimulation({blocked,random:seededRandom(1)});
  sim.update(.016,0,null,null,'photos'); sim.update(.016,1,null,null,'done');
  assert.ok(sim.flocks.every(f=>f.state==='flight'));
  for(let i=0;i<800;i++) sim.update(.016,1+i*.016,null,null,'done');
  assert.ok(sim.flocks.every(f=>f.state==='ground'));
});
test('all pedestrian routes remain on safe ground during a long chapter', () => {
  const sim=createLifeSimulation({blocked,random:seededRandom(11)}); let sat=false;
  for(let i=0;i<6000;i++) {
    sim.update(.05,i*.05,{x:0,z:75},{x:2,z:75},'photos');
    for(const p of sim.pedestrians) { assert.equal(blocked(p.x,p.z),false); sat ||= p.seated; }
  }
  assert.ok(sat,'pedestrians occasionally sit at a bench');
});
test('postcard flock gathers near the couple, leaves photo clearance, then celebrates', () => {
  const sim=createLifeSimulation({blocked,random:seededRandom(17)}), companion={x:0,z:75};
  const initial=Math.min(...sim.flocks.map(f=>distance(f,companion)));
  for(let i=0;i<600;i++) sim.update(.05,i*.05,{x:2,z:75},companion,'postcard');
  const nearby=sim.flocks.reduce((a,b)=>distance(a,companion)<distance(b,companion)?a:b);
  assert.ok(distance(nearby,companion)<initial);
  assert.ok(distance(nearby,companion)>=7.9,'whole 1.8m flock stays clear of the couple');
  sim.update(.016,31,{x:2,z:75},companion,'done');
  assert.equal(nearby.state,'flight');
});
