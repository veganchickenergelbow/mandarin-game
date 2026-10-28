import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syllables} from '../js/core/pinyin.js';

const rd=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const HAN=/\p{Script=Han}/u;
const norm=s=>s.normalize('NFC').replace(/[\s.,?!:;、，。？！：；]/g,'').toLowerCase();
const ids=rd('scenes/index.json');
const wk=rd('weeks/week1.json');

test('week1 has 5 days with a skill each',()=>{
  assert.equal(wk.id,'week1');
  assert.ok(wk.title.zh&&wk.title.en);
  assert.equal(wk.days.length,5);
  wk.days.forEach((d,i)=>{
    assert.equal(d.day,i+1);
    assert.ok(d.skill.zh&&d.skill.en,'skill day '+d.day);
    assert.ok(d.phrases.length>=3&&d.phrases.length<=4,'phrase count day '+d.day);
  });
});
test('week1 scene ids exist in the index and tracks match',()=>{
  const used=new Set();
  for(const d of wk.days){
    for(const k of ['work','life']){
      assert.ok(ids.includes(d[k]),`${d[k]} is not in index.json`);
      assert.ok(d[k].startsWith(k+'_'),`${d[k]} is not a ${k} scene`);
      const sc=rd('scenes/'+d[k]+'.json');
      assert.equal(sc.id,d[k]);
      assert.equal(sc.track,k);
      used.add(d[k]);
    }
  }
  assert.equal(used.size,10,'each scene used once');
});
test('week1 phrases have well-formed word data',()=>{
  for(const d of wk.days){
    d.phrases.forEach((l,i)=>{
      const path=`day${d.day}.phrases[${i}]`;
      assert.ok(typeof l.zh==='string'&&l.zh&&typeof l.py==='string'&&l.py&&typeof l.en==='string'&&l.en.trim(),path+' fields');
      assert.ok(Array.isArray(l.w)&&l.w.length,`${path} has no w`);
      assert.equal(l.w.map(x=>x[0]).join(''),l.zh,`${path}: words must join to zh`);
      for(const [zh,py,en] of l.w){
        if(!HAN.test(zh)){assert.equal(py,undefined,`${path}: punctuation ${zh} has pinyin`);continue}
        assert.equal(syllables(py).length,[...zh].filter(c=>HAN.test(c)).length,`${path}: ${zh} / ${py}`);
        assert.ok(typeof en==='string'&&en.trim(),`${path}: ${zh} has no gloss`);
      }
      assert.equal(norm(l.w.map(x=>x[1]||'').join('')),norm(l.py),`${path}: pinyin mismatch`);
      assert.equal(syllables(l.py).length,[...l.zh].filter(c=>HAN.test(c)).length,`${path}: syllable count`);
    });
  }
});
