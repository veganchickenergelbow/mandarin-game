import test from 'node:test';
import assert from 'node:assert/strict';
import {track,analyse,voiced,classify,TEMPLATES} from '../js/core/pitch.js';
import {synth,dip,pw} from './synth.mjs';

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

// ---- tone 3 as natives really say it: creak, half-third, low register; plus guards that must not become tone 3 ----
const cases3=[
 ['T3 full dip 200-150-210',3,{dip:dip(200,150,210),dur:.45}],
 ['T3 half-third 190-145-140',3,{dip:pw([[0,190],[.55,145],[1,140]]),dur:.4}],
 ['T3 half-third with tiny rise 190-140-150',3,{dip:pw([[0,190],[.55,140],[1,150]]),dur:.4}],
 ['T3 male 130-90-95, 80 ms creak mid',3,{dip:pw([[0,130],[.5,90],[1,95]]),dur:.4,creak:[.16,.24]}],
 ['T3 female 220-170, 90 ms creak, 200',3,{dip:pw([[0,220],[.4,170],[1,200]]),dur:.45,creak:[.18,.27]}],
 ['T3 low flat 150, speakerRef 200',3,{f0:150,f1:150,dur:.4},{speakerRef:200}],
 ['G T2 early small dip 200-195-260',2,{dip:pw([[0,200],[.15,195],[1,260]]),dur:.4}],
 ['G T4 small initial rise 250-258-140',4,{dip:pw([[0,250],[.15,258],[1,140]]),dur:.3}],
 ['G T4 staccato 300-140',4,{f0:300,f1:140,dur:.15,decay:.15,pre:.2,post:.2}],
 ['G T4 male 150-80',4,{f0:150,f1:80,dur:.22,decay:.3}],
 ['G T4 male with creaky last 40 ms',4,{f0:150,f1:80,dur:.25,decay:.3,creak:[.21,.25]}],
 ['G T4 with speakerRef 200, said at 180-100',4,{f0:180,f1:100,dur:.3},{speakerRef:200}],
 ['G T1 flat 200 with mild jitter',1,{dip:u=>200*(1+0.012*Math.sin(37*u)),dur:.4}],
 ['G T1 flat 200 with speakerRef 200',1,{f0:200,f1:200,dur:.4},{speakerRef:200}],
];
for(const [name,tone,o,opts] of cases3)for(const amp of [0.3,0.05]){
  test(`${name} amp ${amp} -> tone ${tone}`,()=>{
    const fr=track(synth({...o,amp}),sr),r=analyse(fr,opts);
    assert.ok(r.ok,r.why);
    assert.equal(r.tone,tone,`st=${r.st.map(v=>v.toFixed(1))} creak=${r.creak}`);
  });
}
test('analyse takes the full track or just the voiced frames',()=>{
  const fr=track(synth({f0:200,f1:260,dur:.4,amp:.3}),sr);
  assert.equal(analyse(fr).tone,analyse(voiced(fr)).tone);
});
test('creak frames are marked in track and reported by analyse',()=>{
  const fr=track(synth({dip:pw([[0,130],[.5,90],[1,95]]),dur:.4,amp:.3,creak:[.16,.24]}),sr);
  assert.ok(fr.some(x=>x.creak&&x.f===0));
  assert.ok(voiced(fr).every(x=>!x.creak));
  assert.ok(analyse(fr).creak>=0.03);
});
