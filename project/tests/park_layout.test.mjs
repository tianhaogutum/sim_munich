import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyToDate, dateToLegacy, terrainHeight, heightAt, blocked, isWater, onBridge, streamCenter, streamWidth, BOUNDS, SPAWN, TEMPLE, TOWER, TREES, COLUMNS, SIGHTS, BRIDGES } from '../src/park_layout.mjs';
import { parkHeight } from '../src/park_terrain.mjs';

test('legacy +X north / +Z east rotates into date +X east / +Z south', () => {
  assert.deepEqual(legacyToDate(1,0),{x:0,z:-1});
  assert.deepEqual(legacyToDate(0,1),{x:1,z:-0});
  assert.deepEqual(legacyToDate(17,113),TEMPLE);
  for (const [x,z] of [[17,113],[-25,115],[0,0],[-8,75]]) {
    const p=legacyToDate(x,z);assert.deepEqual(dateToLegacy(p.x,p.z),{x,z});
  }
});

test('Monopteros preserves the legacy hill in the new axes; meadow is finite and walkable', () => {
  assert.equal(terrainHeight(TEMPLE.x,TEMPLE.z),parkHeight(17,113));
  assert.equal(terrainHeight(TEMPLE.x,TEMPLE.z),3.4);
  assert.equal(blocked(SPAWN.x,SPAWN.z),false);
  for (const s of SIGHTS) assert.equal(blocked(s.x,s.z),false,s.id);
  for(let x=BOUNDS.minX;x<=BOUNDS.maxX;x+=2)for(let z=BOUNDS.minZ;z<=BOUNDS.maxZ;z+=2) {
    assert.ok(Number.isFinite(heightAt(x,z)));assert.ok(heightAt(x,z)>=0);
  }
  assert.equal(blocked(BOUNDS.minX-1,0),true);assert.equal(blocked(BOUNDS.maxX+1,0),true);
  assert.equal(blocked(80,BOUNDS.minZ-1),true);assert.equal(blocked(80,BOUNDS.maxZ+1),true);
  assert.equal(blocked(NaN,0),true);assert.equal(blocked(80,Infinity),true);
});

test('stream rejects wading and both wooden decks cross from dry bank to dry bank', () => {
  for (const x of [49,58,63,83,90,113,127,140]) {
    assert.equal(isWater(x,streamCenter(x)),true);
    assert.equal(blocked(x,streamCenter(x)),true);
    assert.equal(isWater(x,streamCenter(x)+streamWidth(x)/2+1),false);
  }
  for (const b of BRIDGES) {
    assert.equal(onBridge(b.x,b.z),true);assert.equal(blocked(b.x,b.z),false);
    assert.equal(heightAt(b.x,b.z),b.deckY);
    for(let z=b.z-7;z<=b.z+7;z+=.1) assert.equal(blocked(b.x,z),false,`bridge ${b.x} at z ${z}`);
    assert.equal(blocked(b.x+b.halfWidth,b.z),true,'railings collide');
    assert.equal(blocked(b.x+b.halfWidth+.4,b.z),true,'river alongside bridge stays blocked');
    const ramp0=heightAt(b.x,b.z+b.halfLength),ramp1=heightAt(b.x,b.z+b.halfLength+1.5);
    assert.ok(Math.abs(ramp0-b.deckY)<1e-9);assert.ok(ramp1<ramp0);
  }
});

test('trees, columns and tower collide, but the temple interior is open', () => {
  assert.ok(TREES.length>25);
  for(const t of TREES)assert.equal(blocked(t.x,t.z),true);
  for(const c of COLUMNS)assert.equal(blocked(c.x,c.z),true);
  assert.equal(blocked(TOWER.x,TOWER.z),true);
  assert.equal(blocked(TEMPLE.x,TEMPLE.z),false);
});

// Flood a 2 m grid; every edge is swept in .2 m steps so the flood cannot
// jump a narrow stream, a column or a railing between clear grid endpoints.
test('all five sights and the temple interior are reachable from spawn on a 2 m grid', () => {
  const size=2,queue=[[SPAWN.x,SPAWN.z]],seen=new Set([`${SPAWN.x},${SPAWN.z}`]);
  const swept=(x,z,nx,nz)=>{for(let j=1;j<=10;j++)if(blocked(x+(nx-x)*j/10,z+(nz-z)*j/10))return false;return true;};
  for(let head=0;head<queue.length;head++) {
    const [x,z]=queue[head];
    for(const [dx,dz]of [[size,0],[-size,0],[0,size],[0,-size]]) {
      const nx=x+dx,nz=z+dz,key=`${nx},${nz}`;
      if(seen.has(key)||blocked(nx,nz)||!swept(x,z,nx,nz))continue;
      seen.add(key);queue.push([nx,nz]);
    }
  }
  assert.ok(queue.length>1500,'substantial connected meadow');
  for(const s of [...SIGHTS,{...TEMPLE,id:'temple interior'}]) {
    const reachable=queue.some(([x,z])=>Math.hypot(x-s.x,z-s.z)<=2&&swept(x,z,s.x,s.z));
    assert.ok(reachable,`${s.id} is reachable from spawn`);
  }
});
