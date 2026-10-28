import test from 'node:test';
import assert from 'node:assert/strict';
import {track,analyse,voiced,classify,TEMPLATES} from '../js/core/pitch.js';
import {synth,dip} from './synth.mjs';

const sr=48000;
const cases=[
 ['T1 flat 200',1,{f0:200,f1:200,dur:.4}],
 ['T2 rise 180-260',2,{f0:180,f1:260,dur:.4}],
 ['T3 dip 190-140-200',3,{dip:dip(190,140,200),dur:.45}],
 ['T4 normal 260-150',4,{f0:260,f1:150,dur:.3}],
 ['T4 staccato 280-130',4,{f0:280,f1:130,dur:.18,decay:.15,pre:.2,post:.2}],
 ['T4 male 170-85',4,{f0:170,f1:85,dur:.2,decay:.15}],
];
for(const [name,tone,o] of cases)for(const amp of [0.3,0.05,0.01]){
  test(`${name} amp ${amp} -> tone ${tone}`,()=>{
    const fr=track(synth({...o,amp}),sr),r=analyse(voiced(fr));
    assert.ok(r.ok,r.why);
    assert.equal(r.tone,tone);
  });
}
test('track returns unvoiced frames with f:0 and rms on every frame',()=>{
  const fr=track(synth({f0:200,f1:200,dur:.3,amp:.3,pre:.2,post:.2}),sr);
  assert.ok(fr.some(x=>x.f===0));
  assert.ok(fr.some(x=>x.f>0));
  assert.ok(fr.every(x=>typeof x.rms==='number'&&typeof x.t==='number'));
  assert.ok(voiced(fr).every(x=>x.f>0));
});
test('templates and classify on ideal shapes',()=>{
  for(const k of [1,2,3,4]){
    const st=Array.from({length:12},(_,i)=>TEMPLATES[k](i/11));
    assert.equal(classify(st),k);
  }
});
test('silence is not ok',()=>{
  assert.equal(analyse(voiced(track(new Float32Array(sr/2),sr))).ok,false);
});
