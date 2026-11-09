import test from 'node:test';
import assert from 'node:assert/strict';
import { hasClearance, clearCastSegment, safeCastPosition, planCastPath, moveCastAlongPath } from '../src/date_cast_follow.mjs';
const empty = () => false;
const wall = (x,z) => Math.abs(x) < .45 && z > -4 && z < 4;

test('companion clearance catches shoulders next to a wall', () => {
  assert.equal(hasClearance(.6, 0, wall), false);
  assert.equal(hasClearance(.85, 0, wall), true);
});
test('segment sampling catches thin walls even when endpoints are free', () => {
  assert.equal(clearCastSegment({x:-2,z:0},{x:2,z:0}, wall), false);
  assert.equal(clearCastSegment({x:-2,z:5},{x:2,z:5}, wall), true);
});
test('safe catchup searches around blocked targets and respects player separation', () => {
  const spot = safeCastPosition({x:0,z:0}, wall, 4, {x:1,z:0});
  assert.ok(spot);
  assert.ok(hasClearance(spot.x,spot.z,wall));
  assert.ok(Math.hypot(spot.x-1,spot.z) >= .85);
});
test('safe catchup has no unchecked blocked fallback', () => {
  assert.equal(safeCastPosition({x:0,z:0}, () => true, 2), null);
});
test('path planner finds and smooths an obstacle detour without wall penetration', () => {
  const start={x:-3,z:0},goal={x:3,z:0};
  const path=planCastPath(start,goal,wall);
  assert.ok(path.length > 1);
  assert.deepEqual(path.at(-1),goal);
  let current=start;
  for (const point of path) { assert.ok(clearCastSegment(current,point,wall));current=point; }
  assert.ok(path.some(point=>Math.abs(point.z)>4));
});
test('sealed destination returns no path rather than a direct fallback', () => {
  const box=(x,z)=>Math.abs(x)<1.3 && Math.abs(z)<1.3 && (Math.abs(x)>.6 || Math.abs(z)>.6);
  assert.deepEqual(planCastPath({x:-3,z:0},{x:0,z:0},box),[]);
});
test('following is bounded after a long frame and never tunnels through new obstacles', () => {
  const position={x:-2,z:0},path=[{x:2,z:0}];
  const distance=moveCastAlongPath(position,path,8,3,empty);
  assert.ok(distance <= .64001);
  const blockedPath=[{x:2,z:0}];
  for(let i=0;i<30;i++)moveCastAlongPath(position,blockedPath,8,.04,wall);
  assert.ok(position.x<-.72);
  assert.equal(blockedPath.length,0);
});
test('empty space uses a single direct waypoint and reaches the exact goal', () => {
  const start={x:0,z:0},goal={x:1,z:1};
  const path=planCastPath(start,goal,empty);
  assert.deepEqual(path,[goal]);
  for(let i=0;i<30;i++)moveCastAlongPath(start,path,4,.04,empty);
  assert.ok(Math.hypot(start.x-1,start.z-1)<1e-9);
  assert.equal(path.length,0);
});
