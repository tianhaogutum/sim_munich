import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraBoomFraction } from '../src/date_camera.mjs';
test('camera clips a wall between player and requested camera even when endpoint is clear', () => {
  const f = cameraBoomFraction({x:0,z:0},{x:10,z:0},(x,z)=>x>=4 && x<=5);
  assert.ok(f > .3 && f < .4);
});
test('camera keeps an unobstructed boom and a zero-distance camera', () => {
  assert.equal(cameraBoomFraction({x:0,z:0},{x:0,z:10},()=>false),1);
  assert.equal(cameraBoomFraction({x:0,z:0},{x:0,z:0},()=>true),1);
});
test('camera immediately outside an obstacle stays on the player side without a negative boom', () => {
  assert.equal(cameraBoomFraction({x:0,z:0},{x:10,z:0},x=>x>=.1),0);
});
