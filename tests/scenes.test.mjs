import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syllables,hanziChars,toneOf} from '../js/core/pinyin.js';
import {intentCheck} from '../js/core/match.js';

const rd=p=>JSON.parse(readFileSync(new URL('../data/scenes/'+p,import.meta.url),'utf8'));
const ids=rd('index.json');
const TYPES=['fit','generic','off','blunt','cave'];
const str=(v,l)=>assert.ok(typeof v==='string'&&v.trim(),'missing '+l);
const line=(l,where)=>{
  str(l&&l.zh,where+'.zh');str(l.py,where+'.py');str(l.en,where+'.en');
  assert.equal(syllables(l.py).length,hanziChars(l.zh).length,`${where}: ${l.zh} / ${l.py}`);
  for(const s of syllables(l.py)){
    assert.match(s,/^[A-Za-zü]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]?[a-züA-Z]*$/u,`${where} bad syllable ${s}`);
    assert.ok(s.normalize('NFD').replace(/[^̀-̄̌]/g,'').length<=1,`${where} two tone marks ${s}`);
    assert.ok(toneOf(s)>=1);
  }
};
test('index lists scene files that exist',()=>{
  assert.ok(Array.isArray(ids)&&ids.length>=2);
  for(const id of ids)assert.equal(rd(id+'.json').id,id);
});
for(const id of ids){
  const sc=rd(id+'.json');
  test(`${id}: structure`,()=>{
    assert.ok(['work','life'].includes(sc.track));
    str(sc.title.zh,'title.zh');str(sc.title.en,'title.en');
    str(sc.character.name,'name');str(sc.character.role,'role');str(sc.character.en,'char en');
    str(sc.goal,'goal');
    assert.equal(sc.twists.length,2);
    assert.ok(sc.turns.length>=4);
    assert.ok(sc.warmup.length>=4&&sc.warmup.length<=6);
    for(const [i,t] of sc.turns.entries()){
      assert.equal(t.options.length,4,'turn '+i);
      assert.equal(t.options.filter(o=>o.type==='fit').length,1,'turn '+i+' fit count');
      for(const o of t.options){assert.ok(TYPES.includes(o.type));str(o.why,'why');assert.ok(o.why.length<160)}
      assert.ok(t.intent.groups.length>=2&&t.intent.groups.length<=3,'groups');
      assert.ok(t.intent.groups.every(g=>Array.isArray(g)&&g.length>=1));
      str(t.intent.en,'intent.en');
    }
  });
  test(`${id}: pinyin matches characters 1:1`,()=>{
    sc.turns.forEach((t,i)=>{
      line(t.npc,`turn${i}.npc`);
      if(t.npc.hurried)line(t.npc.hurried,`turn${i}.hurried`);
      t.options.forEach((o,j)=>line(o,`turn${i}.opt${j}`));
      line(t.intent.example,`turn${i}.example`);
    });
    sc.twists.forEach(w=>{str(w.id,'twist id');str(w.en,'twist en');str(w.prompt,'twist prompt');
      line(w.turn2,`twist ${w.id}`);assert.ok(w.group.length>=1);if(w.example)line(w.example,`twist ${w.id} example`)});
    sc.warmup.forEach((w,i)=>{
      line(w,`warmup${i}`);
      const n=hanziChars(w.zh).length;assert.ok(n>=2&&n<=4,`warmup ${w.zh} has ${n} syllables`);
    });
  });
  test(`${id}: every intent example passes its own intentCheck`,()=>{
    sc.turns.forEach((t,i)=>{
      const r=intentCheck(t.intent.example.zh,t.intent.groups);
      assert.ok(r.allHit,`turn ${i} missed groups ${r.missed}`);
    });
  });
  test(`${id}: twist examples pass base groups plus the twist group`,()=>{
    for(const w of sc.twists){
      if(!w.example)continue;
      const r=intentCheck(w.example.zh,[...sc.turns[1].intent.groups,w.group]);
      assert.ok(r.allHit,`twist ${w.id} missed ${r.missed}`);
    }
  });
  test(`${id}: hurried variants`,()=>{
    const n=sc.turns.filter(t=>t.npc.hurried).length;
    assert.ok(n>=(sc.track==='work'?2:1));
  });
}
