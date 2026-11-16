import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationDistance,navigationBearing,relativeBearing,normalizeHeading,compassLabel,hasArrived,navigationSnapshot,recordBreadcrumb,formatNavigationDistance } from '../src/city_navigation_rules.mjs';
const origin={lon:11.58,lat:48.15};
test('geographic distances are symmetric, finite for antipodes, and reject bad positions',()=>{
 const east={lon:11.581,lat:48.15};assert.ok(navigationDistance(origin,east)>74&&navigationDistance(origin,east)<75);assert.equal(navigationDistance(origin,east),navigationDistance(east,origin));assert.equal(navigationDistance(origin,origin),0);assert.equal(navigationDistance({},origin),Infinity);assert.equal(navigationDistance({lon:NaN,lat:0},origin),Infinity);assert.ok(Number.isFinite(navigationDistance({lon:0,lat:0},{lon:180,lat:0})));
});
test('bearings use north zero and clockwise east, independent of camera',()=>{
 assert.equal(navigationBearing(origin,{...origin,lat:48.16}),0);assert.ok(Math.abs(navigationBearing(origin,{...origin,lon:11.59})-90)<.01);assert.equal(navigationBearing(origin,{...origin,lat:48.14}),180);assert.equal(navigationBearing(origin,origin),null);assert.equal(navigationBearing({},origin),null);assert.equal(normalizeHeading(-90),270);assert.equal(normalizeHeading(720),0);assert.equal(relativeBearing(10,350),20);assert.equal(relativeBearing(350,10),-20);assert.equal(relativeBearing(90,90),0);assert.equal(compassLabel(359),'北 N');assert.equal(compassLabel(90),'东 E');
});
test('arrival includes the exact radius but never unknown, invalid or negative distance',()=>{
 assert.equal(hasArrived(35),true);assert.equal(hasArrived(35.00001),false);assert.equal(hasArrived(0),true);assert.equal(hasArrived(-1),false);assert.equal(hasArrived(Infinity),false);assert.equal(hasArrived(NaN),false);assert.equal(navigationSnapshot(origin,origin,90).arrived,true);assert.equal(navigationSnapshot({},origin).arrived,false);assert.equal(formatNavigationDistance(Infinity),'—');
});
test('walk breadcrumbs sample short motion, bound memory and break at teleport without changing input',()=>{
 const first=recordBreadcrumb([],origin);assert.deepEqual(first,[origin]);assert.equal(recordBreadcrumb(first,{...origin,lon:origin.lon+.00001}),first);const next=recordBreadcrumb(first,{...origin,lon:origin.lon+.0002});assert.equal(next.length,2);assert.equal(first.length,1);assert.equal(recordBreadcrumb(next,{...origin,lon:origin.lon+.1}).length,1);let points=[];for(let i=0;i<20;i++)points=recordBreadcrumb(points,{...origin,lon:origin.lon+i*.0002},{limit:4});assert.equal(points.length,4);assert.equal(recordBreadcrumb(points,{}),points);
});
