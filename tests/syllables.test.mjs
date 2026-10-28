import test from 'node:test';
import assert from 'node:assert/strict';
import {track} from '../js/core/pitch.js';
import {splitSyllables,scoreWord} from '../js/core/syllables.js';
import {word,sr} from './synth.mjs';

const heard=r=>r.items.map(i=>i.heard);
for(const [label,opt] of [['40 ms gap',{gapMs:40}],['80 ms gap',{gapMs:80}],['amplitude valley only',{gapMs:0,dipMs:60}]]){
  test(`dà hǎi (4+3), ${label}`,()=>{
    const r=scoreWord(word([4,3],opt),sr,'大海','dà hǎi');
    assert.ok(r.ok);assert.equal(r.items.length,2);
    assert.deepEqual(heard(r),[4,3]);
    assert.deepEqual(r.items.map(i=>i.ok),[true,true]);
  });
  test(`bāo mā má / three syllables 1-2-4, ${label}`,()=>{
    const r=scoreWord(word([1,2,4],opt),sr,'妈麻骂','mā má mà');
    assert.equal(r.items.length,3);
    assert.deepEqual(heard(r),[1,2,4]);
  });
}
test('3-3 word is expected as 2-3 and a rising + dipping voice passes',()=>{
  const r=scoreWord(word([2,3],{gapMs:60,dur:0.4}),sr,'你好','nǐ hǎo');
  assert.deepEqual(r.items.map(i=>i.expected),[2,3]);
  assert.deepEqual(heard(r),[2,3]);
  assert.deepEqual(r.items.map(i=>i.ok),[true,true]);
});
test('3-3 said as dip-dip is flagged on the first syllable',()=>{
  const r=scoreWord(word([3,3],{gapMs:60,dur:0.4}),sr,'你好','nǐ hǎo');
  assert.equal(r.items[0].ok,false);
});
test('neutral tone is not scored (ok null)',()=>{
  const r=scoreWord(word([1,2],{gapMs:60}),sr,'妈吗','mā ma');
  assert.equal(r.items[1].expected,5);
  assert.equal(r.items[1].ok,null);
  assert.equal(r.items[0].ok,true);
});
test('splitSyllables returns exactly n segments of voiced frames',()=>{
  const fr=track(word([4,3,1],{gapMs:50}),sr);
  for(const n of [1,2,3,4]){
    const s=splitSyllables(fr,n);
    assert.equal(s.length,n);
    assert.ok(s.every(x=>x.frames.every(f=>f.f>0)));
  }
});
test('split points land near the real boundaries',()=>{
  const fr=track(word([4,3],{gapMs:0,dipMs:60}),sr);
  const [a,b]=splitSyllables(fr,2);
  const boundary=0.2+0.3; // end of syllable 1
  assert.ok(Math.abs(a.t1-boundary)<0.06,`a.t1=${a.t1}`);
  assert.ok(b.frames.length>20&&a.frames.length>20);
});
test('equal-split fallback for a continuous steady voice',()=>{
  const fr=track(word([1],{dur:0.6}),sr);
  const s=splitSyllables(fr,3);
  assert.equal(s.length,3);
  const n=s.map(x=>x.frames.length);
  assert.ok(Math.max(...n)-Math.min(...n)<=3,n.join());
});
test('silence or noise gives ok:false',()=>{
  const r=scoreWord(new Float32Array(sr/2),sr,'大海','dà hǎi');
  assert.equal(r.ok,false);
});
test('a segment with under 5 voiced frames is heard:null, ok:false',()=>{
  // one very short blip + a real syllable, asked for 2 syllables
  const a=word([4],{dur:0.3}),r=scoreWord(a,sr,'大海','dà hǎi');
  assert.ok(r.items.every(i=>i.heard===null||typeof i.heard==='number'));
  const tiny=new Float32Array(sr);
  const w=word([4],{dur:0.3});tiny.set(w);
  const r2=scoreWord(tiny,sr,'大','dà');
  assert.equal(r2.items.length,1);
});
