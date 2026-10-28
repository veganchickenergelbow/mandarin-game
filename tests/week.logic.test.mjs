import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as P from '../js/core/progress.js';
import {warmupItems,charId} from '../js/core/week.js';

const week=JSON.parse(readFileSync(new URL('./fixtures/week-mini.json',import.meta.url),'utf8')),D=week.days;
const all=(s,n)=>['warmup','work','life'].forEach(k=>P.markWeek(s,n,k));

test('day unlocking: day 1 open, next day opens only when all 3 steps are done',()=>{
  const s=P.newSave();
  assert.equal(P.currentDay(s,D),1);
  assert.deepEqual([1,2,3].map(n=>P.dayUnlocked(s,D,n)),[true,false,false]);
  P.markWeek(s,1,'warmup');P.markWeek(s,1,'work');
  assert.equal(P.dayDone(s,D[0]),false);assert.equal(P.dayUnlocked(s,D,2),false);
  P.markWeek(s,1,'life');
  assert.equal(P.dayDone(s,D[0]),true);assert.equal(P.currentDay(s,D),2);
  assert.deepEqual([1,2,3].map(n=>P.dayUnlocked(s,D,n)),[true,true,false]); // playing back is allowed
});
test('week complete: current day passes the end, every day stays unlocked for replay',()=>{
  const s=P.newSave();[1,2,3].forEach(n=>all(s,n));
  assert.equal(P.currentDay(s,D),4);
  assert.ok([1,2,3].every(n=>P.dayUnlocked(s,D,n)));assert.equal(P.dayUnlocked(s,D,4),false);
});
test('existing scene progress counts as earned (rung above 1), warm-up never does',()=>{
  const s=P.newSave();s.rungs.w1=2;s.rungs.l1=3;
  assert.equal(P.dayStep(s,D[0],'work'),true);assert.equal(P.dayStep(s,D[0],'life'),true);assert.equal(P.dayStep(s,D[0],'warmup'),false);
  assert.equal(P.dayDone(s,D[0]),false);P.markWeek(s,1,'warmup');assert.equal(P.dayDone(s,D[0]),true);
});
test('week progress survives migrate',()=>{
  const s=P.newSave();P.markWeek(s,1,'work');
  assert.deepEqual(P.migrate(JSON.parse(JSON.stringify(s))).week.done[1],{warmup:false,work:true,life:false});
});
test('warm-up: up to 3 due first, then day phrases, then scene words, 6 total, no repeats',()=>{
  const s=P.newSave(),T='2026-04-10';
  s.review=[{...{key:'d1',zh:'到1',py:'dào',en:''},due:'2026-04-01',step:0},{key:'d2',zh:'到2',py:'dào',en:'',due:T,step:1},{key:'d3',zh:'到3',py:'dào',en:'',due:T,step:0},{key:'d4',zh:'到4',py:'dào',en:'',due:T,step:2},{key:'f',zh:'未',py:'wèi',en:'',due:'2026-05-01',step:0}];
  const sc=[{warmup:[{zh:'你好',py:'nǐ hǎo',en:'dup'},{zh:'价格',py:'jià gé',en:'price'},{zh:'贵',py:'guì',en:'dear'}]},{warmup:[{zh:'鸡饭',py:'jī fàn',en:'rice'},{zh:'辣',py:'là',en:'spicy'}]}];
  const w=warmupItems(s,D[0],sc,T);
  assert.equal(w.length,6);
  assert.deepEqual(w.map(x=>x.zh),['到1','到3','到2','你好','谢谢','价格']);
  assert.equal(new Set(w.map(x=>x.zh)).size,6);
  assert.ok(!w.some(x=>x.zh==='未')); // not due
  assert.deepEqual(warmupItems(P.newSave(),D[1],[],T).map(x=>x.zh),['再见']);
});
test('charId falls back to the character name',()=>{
  assert.equal(charId({id:'s',character:{id:'huang',name:'黄总'}}),'huang');
  assert.equal(charId({id:'s',character:{name:'黄总'}}),'黄总');
});
