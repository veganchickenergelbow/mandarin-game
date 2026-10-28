import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/core/progress.js';

test('newSave shape and migrate fills missing fields',()=>{
  assert.deepEqual(P.newSave(),{v:1,fish:0,days:{},rungs:{},review:[],settings:{music:false,pinyin:true}});
  const m=P.migrate({fish:7,settings:{music:true},review:[{key:'a',zh:'好',py:'hǎo',en:'good'}]});
  assert.equal(m.fish,7);
  assert.deepEqual(m.settings,{music:true,pinyin:true});
  assert.deepEqual(m.days,{});assert.deepEqual(m.rungs,{});
  assert.equal(m.review[0].streak,0);
  assert.deepEqual(P.migrate(null),P.newSave());
  assert.deepEqual(P.migrate('junk'),P.newSave());
});
test('todayKey is local YYYY-MM-DD',()=>{
  assert.equal(P.todayKey(new Date(2026,0,5,23,59)),'2026-01-05');
  assert.equal(P.todayKey(new Date(2026,11,31,0,0)),'2026-12-31');
});
test('fish',()=>{const s=P.newSave();P.addFish(s,3);P.addFish(s,2);assert.equal(s.fish,5)});
test('steps and streak across days, month boundary and gaps',()=>{
  const s=P.newSave();
  assert.deepEqual(P.stepsDone(s,'2026-02-01'),{warmup:false,work:false,life:false});
  P.markStep(s,'2026-01-30','warmup');
  P.markStep(s,'2026-01-31','work');
  P.markStep(s,'2026-02-01','life');
  P.markStep(s,'2026-02-01','warmup');
  assert.deepEqual(P.stepsDone(s,'2026-02-01'),{warmup:true,work:false,life:true});
  assert.equal(P.streak(s,'2026-02-01'),3);
  assert.equal(P.streak(s,'2026-02-02'),3); // yesterday counts, today not started
  assert.equal(P.streak(s,'2026-02-03'),0); // broken
  P.markStep(s,'2026-02-03','work');
  assert.equal(P.streak(s,'2026-02-03'),1);
  assert.equal(P.streak(P.newSave(),'2026-02-03'),0);
});
test('rungs: start at 1, unlock the next at 0.8 only',()=>{
  const s=P.newSave();
  assert.equal(P.rung(s,'x'),1);
  P.recordRung(s,'x',1,0.79);assert.equal(P.rung(s,'x'),1);
  P.recordRung(s,'x',1,0.8);assert.equal(P.rung(s,'x'),2);
  P.recordRung(s,'x',1,1);assert.equal(P.rung(s,'x'),2);
  P.recordRung(s,'x',2,0.5);assert.equal(P.rung(s,'x'),2);
  P.recordRung(s,'x',2,0.9);assert.equal(P.rung(s,'x'),3);
  P.recordRung(s,'x',3,1);assert.equal(P.rung(s,'x'),3);
  assert.equal(P.rung(s,'other'),1);
});
test('review: miss adds, repeat miss resets, 2 hits remove',()=>{
  const s=P.newSave(),it={key:'gl',zh:'顾虑',py:'gù lǜ',en:'concern'};
  P.reviewMiss(s,it);assert.equal(s.review.length,1);
  P.reviewHit(s,'gl');assert.equal(s.review[0].streak,1);
  P.reviewMiss(s,it);assert.equal(s.review.length,1);assert.equal(s.review[0].streak,0);
  P.reviewHit(s,'gl');P.reviewHit(s,'gl');
  assert.equal(s.review.length,0);
  P.reviewHit(s,'nope');
});
test('reviewPick returns up to n, weakest first',()=>{
  const s=P.newSave();
  for(const k of ['a','b','c'])P.reviewMiss(s,{key:k,zh:k,py:k,en:k});
  P.reviewHit(s,'a');
  const p=P.reviewPick(s,2);
  assert.equal(p.length,2);assert.ok(!p.some(x=>x.key==='a'));
  assert.equal(P.reviewPick(s,10).length,3);
});
test('migrate keeps a voice profile and converts the old {ref,n} shape',()=>{
  const prof={p10:-2,p50:1,p90:6,n:4,calibrated:true};
  assert.deepEqual(P.migrate(JSON.parse(JSON.stringify({voice:prof}))).voice,prof);
  const old=P.migrate({voice:{ref:200,n:3}}).voice;
  assert.ok(Math.abs(old.p50-12*Math.log2(2))<1e-9);
  assert.ok(Math.abs(old.p10-(old.p50-5))<1e-9&&Math.abs(old.p90-(old.p50+5))<1e-9);
  assert.equal(old.calibrated,false);assert.equal(old.n,3);
  assert.equal(P.migrate({voice:{ref:'x'}}).voice,undefined);
  assert.equal(P.migrate({voice:null}).voice,undefined);
  assert.equal(P.migrate(P.newSave()).voice,undefined);
});
