import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityFeatureHost} from '../src/city_feature_host.mjs';

test('open dialogs consume movement and prevent a second feature opening',()=>{
 let open=false,other=0,cleared=0,editing=false;
 const host=createCityFeatureHost({clearInput:()=>cleared++,isEditing:()=>editing});
 host.add({isOpen:()=>open,handleKey(key){if(key==='k'){open=!open;return true;}if(key==='escape'){open=false;return true;}return false;},close(){open=false;}});
 host.add({handleKey(){other++;return true;}});
 assert.equal(host.handleKey('k'),true);assert.equal(host.isInputBlocked(),true);assert.ok(cleared);
 host.handleKey('w');host.handleKey('v');assert.equal(other,0);
 host.handleKey('escape');assert.equal(host.isInputBlocked(),false);
 editing=true;assert.equal(host.handleKey('k'),true);assert.equal(open,false);
 editing=false;host.handleKey('k');host.closePanels();assert.equal(open,false);
});
test('host disposes once in reverse order and stops updates and input',()=>{
 const calls=[];const host=createCityFeatureHost();
 host.add({update:dt=>calls.push(dt),dispose:()=>calls.push('first')});
 host.add({dispose:()=>calls.push('second')});
 host.update(.1);host.dispose();host.dispose();host.update(.2);
 assert.deepEqual(calls,[.1,'second','first']);assert.equal(host.isInputBlocked(),true);
 assert.equal(host.handleKey('w'),false);assert.throws(()=>host.add({}));
});
