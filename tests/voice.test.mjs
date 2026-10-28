import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../js/core/voice.js';
import {judge} from '../js/core/pitch.js';
import {migrate} from '../js/core/progress.js';

const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} vs ${b}`);
const frames=sts=>sts.map((s,i)=>({t:i*.005,f:V.hz(s)}));
test('st100 and hz are inverse; 100 Hz is 0',()=>{near(V.st100(100),0);near(V.st100(200),12);near(V.hz(V.st100(137)),137)});
test('fromFrames: percentiles of voiced frames, unvoiced and creak frames ignored',()=>{
  const sts=Array.from({length:101},(_,i)=>i/10); // 0..10 st
  const p=V.fromFrames([...frames(sts),{t:9,f:0,creak:true},{t:9.1,f:0}]);
  near(p.p10,1);near(p.p50,5);near(p.p90,9);assert.equal(p.n,101);assert.equal(p.calibrated,false);
  assert.equal(V.fromFrames([]),null);assert.equal(V.fromFrames([{t:0,f:0}]),null);
});
test('fromFrames drops gross outliers (over 10 st from the median)',()=>{
  const p=V.fromFrames(frames([...Array(50).fill(5),30,-30]));
  near(p.p10,5);near(p.p90,5);assert.equal(p.n,50);
});
test('calibrate marks the profile calibrated',()=>{
  assert.equal(V.calibrate(frames([1,2,3,4,5])).calibrated,true);assert.equal(V.calibrate([]),null);
});
test('update: EMA 0.2 on p50, range carried along, only stretched outwards by narrow takes',()=>{
  const prof={p10:0,p50:5,p90:10,n:20,calibrated:true};
  const u=V.update(prof,frames(Array(30).fill(10))); // a flat take at 10 st
  near(u.p50,6);near(u.p10,1);near(u.p90,11); // p90 drifts with p50; the take (p90 10) is below it, so no stretch
  assert.equal(u.n,21);assert.equal(u.calibrated,true);
  const w=V.update(prof,frames([5,5,5,5,5,12,12,12,-3,-3,-3,5])); // a take that goes beyond both ends
  assert.ok(w.p90>prof.p90&&w.p10<prof.p10);
  assert.equal(V.update(prof,[]),prof);
  near(V.update(null,frames([1,2,3])).p50,2);
});
test('update keeps an uncalibrated profile uncalibrated',()=>{
  assert.equal(V.update({p10:0,p50:5,p90:10,n:1,calibrated:false},frames([5,5,5])).calibrated,false);
});
test('height: 0 at p10, 1 at p90, not clamped, narrow ranges are not trusted',()=>{
  const p={p10:0,p50:5,p90:10};
  near(V.height(0,p),0);near(V.height(10,p),1);near(V.height(5,p),.5);near(V.height(12,p),1.2);near(V.height(-1,p),-.1);
  near(V.height(1,{p10:0,p50:0.5,p90:1}),1/3); // span floored at 3 st
});
test('defaultProfile is -3/+2/+7 around the take, uncalibrated',()=>{
  assert.deepEqual(V.defaultProfile(4),{p10:1,p50:6,p90:11,n:0,calibrated:false});
});
test('migrate: old {ref,n} -> p50 with p10/p90 at -5/+5; a new profile survives; junk is dropped',()=>{
  const o=migrate({voice:{ref:110,n:7}}).voice;
  near(o.p50,V.st100(110));near(o.p10,o.p50-5);near(o.p90,o.p50+5);assert.equal(o.calibrated,false);assert.equal(o.n,7);
  const p={p10:-1,p50:2,p90:6,n:3,calibrated:true};
  assert.deepEqual(migrate({voice:p}).voice,p);
  assert.equal(migrate({voice:{p10:'a'}}).voice,undefined);
});
test('usable: only a calibrated saved profile is used for scoring',()=>{
  assert.equal(V.usable({voice:{calibrated:false}}),null);assert.equal(V.usable({}),null);
  const c={p10:0,p50:1,p90:2,calibrated:true};assert.equal(V.usable({voice:c}),c);
});

test('judge: the argmax passes without close',()=>{
  assert.deepEqual(judge(3,{1:.1,2:.2,3:.9,4:.3}),{ok:true,close:false,top:3});
});
test('judge: within 0.1 of the top in a usual confusion passes as close (3/2, 3/4, 1/4, either way)',()=>{
  assert.deepEqual(judge(3,{1:0,2:.9,3:.82,4:0}),{ok:true,close:true,top:2});
  assert.deepEqual(judge(3,{1:0,2:0,3:.85,4:.9}),{ok:true,close:true,top:4});
  assert.deepEqual(judge(1,{1:.8,2:0,3:0,4:.85}),{ok:true,close:true,top:4});
  assert.deepEqual(judge(4,{1:.9,2:0,3:0,4:.85}),{ok:true,close:true,top:1});
});
test('judge: too far from the top, or not a usual confusion, fails',()=>{
  assert.deepEqual(judge(3,{1:0,2:.9,3:.7,4:0}),{ok:false,close:false,top:2});
  assert.equal(judge(1,{1:.85,2:.9,3:0,4:0}).ok,false); // 1/2 is not a usual confusion
  assert.equal(judge(2,{1:.9,2:.85,3:0,4:0}).ok,false);
  assert.equal(judge(2,{1:0,2:.85,3:0,4:.9}).ok,false); // 2/4
});
