import test from 'node:test';
import assert from 'node:assert/strict';
import {resample16k,wavBytes,numbered,takeName,labelsOf} from '../js/recordings.js';

test('numbered pinyin: tone digits, neutral 5, ü as v',()=>{
  assert.equal(numbered('nǐ hǎo'),'ni3hao3');
  assert.equal(numbered('mā ma'),'ma1ma5');
  assert.equal(numbered('nǚ'),'nv3');
});
test('takeName: date, pinyin, heard tones (x for unheard)',()=>{
  const t=new Date(2026,9,28,12,0).getTime();
  assert.equal(takeName({time:t,py:'nǐ hǎo',heard:[2,3]}),'2026-10-28_ni3hao3_heard-2-3.wav');
  assert.equal(takeName({time:t,py:'dà hǎi',heard:[null,3]}),'2026-10-28_da4hai3_heard-x-3.wav');
});
test('resample16k: length, level and the sine survive 48k -> 16k',()=>{
  const sr=48000,x=new Float32Array(sr/2).map((_,i)=>0.5*Math.sin(2*Math.PI*200*i/sr));
  const y=resample16k(x,sr);
  assert.equal(y.length,8000);
  assert.ok(Math.abs(Math.max(...y)-0.5*32767)<400);
  assert.equal(resample16k(new Float32Array(0),44100).length,0);
  assert.equal(resample16k(new Float32Array([2,-2,2,-2]),16000)[0],32767); // clipped
});
test('wavBytes: a valid 16-bit mono PCM header',()=>{
  const b=wavBytes(new Int16Array([1,-2,3]),16000),v=new DataView(b.buffer);
  assert.equal(String.fromCharCode(...b.slice(0,4)),'RIFF');assert.equal(String.fromCharCode(...b.slice(8,12)),'WAVE');
  assert.equal(b.length,44+6);assert.equal(v.getUint32(4,true),36+6);assert.equal(v.getUint16(22,true),1);
  assert.equal(v.getUint32(24,true),16000);assert.equal(v.getUint32(40,true),6);assert.equal(v.getInt16(46,true),-2);
});
test('labelsOf lists file, time and tones',()=>{
  const l=labelsOf([{file:'a.wav',time:0,zh:'你好',py:'nǐ hǎo',expected:[2,3],heard:[2,3],scores:[{1:0,2:1,3:0,4:0}]}]);
  assert.equal(l[0].file,'a.wav');assert.equal(l[0].time,'1970-01-01T00:00:00.000Z');assert.deepEqual(l[0].expected,[2,3]);
});
test('IndexedDB is missing in node: saveTake/listTakes/clearTakes fail soft',async()=>{
  const R=await import('../js/recordings.js');
  assert.equal(await R.saveTake(new Float32Array(10),16000,{}),false);
  assert.deepEqual(await R.listTakes(),[]);
  assert.equal(await R.clearTakes(),false);
});
