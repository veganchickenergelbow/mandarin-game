import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/core/progress.js';

test('newSave shape and migrate fills missing fields',()=>{
  assert.deepEqual(P.newSave(),{v:2,fish:0,days:{},rungs:{},review:[],settings:{music:false,pinyin:false,hardMoods:true},week:{id:'week1',done:{}},trust:{},played:{}});
  const m=P.migrate({fish:7,settings:{music:true},review:[{key:'a',zh:'好',py:'hǎo',en:'good'}]});
  assert.equal(m.fish,7);
  assert.deepEqual(m.settings,{music:true,pinyin:false,hardMoods:true});
  assert.equal(P.migrate({settings:{pinyin:true,pinyinSet:true}}).settings.pinyin,true); // an explicit choice is kept
  assert.deepEqual(m.days,{});assert.deepEqual(m.rungs,{});
  assert.equal(m.review[0].step,0);
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

const it=k=>({key:k,zh:k,py:k,en:k});
test('review SM-2-lite: new miss is due today, intervals 1/3/7/14, removed after a right answer at 14',()=>{
  const s=P.newSave(),T='2026-03-01';
  P.reviewMiss(s,it('a'),T);
  assert.deepEqual([s.review[0].due,s.review[0].step],[T,0]);
  P.reviewHit(s,'a',T);assert.deepEqual([s.review[0].step,s.review[0].due],[1,'2026-03-04']);
  P.reviewHit(s,'a','2026-03-04');assert.deepEqual([s.review[0].step,s.review[0].due],[2,'2026-03-11']);
  P.reviewHit(s,'a','2026-03-11');assert.deepEqual([s.review[0].step,s.review[0].due],[3,'2026-03-25']);
  P.reviewHit(s,'a','2026-03-25');assert.equal(s.review.length,0);
  P.reviewHit(s,'nope',T);
});
test('review: wrong resets to step 0, due tomorrow; a hit before it is due does nothing',()=>{
  const s=P.newSave(),T='2026-01-31';
  P.reviewMiss(s,it('a'),'2026-01-01');P.reviewHit(s,'a','2026-01-01');P.reviewHit(s,'a','2026-01-04');
  assert.equal(s.review[0].step,2);
  P.reviewMiss(s,it('a'),T);
  assert.equal(s.review.length,1);assert.deepEqual([s.review[0].step,s.review[0].due],[0,'2026-02-01']);
  P.reviewHit(s,'a',T);assert.equal(s.review[0].step,0); // not due yet, no free retry
});
test('reviewPick: due first (oldest due, weakest step), then the rest; reviewDue counts',()=>{
  const s=P.newSave();
  s.review=[{...it('late'),due:'2026-05-10',step:1},{...it('old'),due:'2026-05-01',step:2},{...it('today'),due:'2026-05-05',step:0},{...it('soon'),due:'2026-05-06',step:0}];
  assert.deepEqual(P.reviewPick(s,4,'2026-05-05').map(x=>x.key),['old','today','soon','late']);
  assert.deepEqual(P.reviewPick(s,2,'2026-05-05').map(x=>x.key),['old','today']);
  assert.equal(P.reviewDue(s,'2026-05-05').length,2);
  assert.equal(P.reviewDue(s,'2026-04-01').length,0);
});
test('migrate converts old streak-based review items without losing them',()=>{
  const m=P.migrate({v:1,review:[{key:'a',zh:'a',py:'a',en:'A',streak:0},{key:'b',zh:'b',py:'b',en:'B',streak:1},{key:'c',zh:'c',py:'c',en:'C',streak:9}]});
  assert.equal(m.v,2);assert.equal(m.review.length,3);
  const today=P.todayKey();
  for(const r of m.review){assert.equal(r.due,today);assert.ok(!('streak'in r))}
  assert.deepEqual(m.review.map(r=>r.step),[0,1,3]);
  const again=P.migrate(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(again.review,m.review);
  assert.equal(P.migrate({review:[{key:'k',due:'2026-04-02',step:2}]}).review[0].due,'2026-04-02');
});
test('migrate keeps fish, days, rungs, settings, voice; played is seeded from rungs',()=>{
  const prof={p10:-2,p50:1,p90:6,n:4,calibrated:true};
  const m=P.migrate({v:1,fish:12,days:{'2026-01-01':{warmup:true,work:false,life:false}},rungs:{x:2},voice:prof,settings:{music:true,pinyin:true,pinyinSet:true,calDismissed:true}});
  assert.equal(m.fish,12);assert.equal(m.days['2026-01-01'].warmup,true);assert.equal(m.rungs.x,2);assert.deepEqual(m.voice,prof);
  assert.equal(m.settings.calDismissed,true);assert.equal(m.settings.hardMoods,true);assert.equal(m.played.x,1);
  assert.deepEqual(m.week,{id:'week1',done:{}});
  assert.equal(P.migrate({settings:{hardMoods:false}}).settings.hardMoods,false);
});
test('trust hearts: progress, hearts, floor, max',()=>{
  const s=P.newSave();
  assert.deepEqual(P.trustOf(s,'h'),{p:0,hearts:0});
  P.trustMove(s,'h',-1);assert.deepEqual(s.trust.h,{p:0,hearts:0}); // floored
  for(let i=0;i<4;i++)P.trustMove(s,'h',1);
  assert.deepEqual(s.trust.h,{p:4,hearts:0});
  P.trustMove(s,'h',-1);assert.equal(s.trust.h.p,3);
  P.trustMove(s,'h',1);const r=P.trustMove(s,'h',1);
  assert.equal(r.gained,1);assert.deepEqual(s.trust.h,{p:0,hearts:1});
  P.trustMove(s,'h',-1);assert.deepEqual(s.trust.h,{p:0,hearts:1}); // a heart is never lost
  for(let i=0;i<5*10;i++)P.trustMove(s,'h',1);
  assert.deepEqual(s.trust.h,{p:0,hearts:5});
  assert.deepEqual(P.trustOf(s,'other'),{p:0,hearts:0});
  assert.equal(P.migrate(JSON.parse(JSON.stringify(s))).trust.h.hearts,5);
});
test('trusted: 3+ hearts unless the setting is off',()=>{
  const s=P.newSave();s.trust.h={p:0,hearts:3};s.trust.g={p:4,hearts:2};
  assert.equal(P.trusted(s)('h'),true);assert.equal(P.trusted(s)('g'),false);assert.equal(P.trusted(s)('none'),false);
  s.settings.hardMoods=false;assert.equal(P.trusted(s)('h'),false);
});
