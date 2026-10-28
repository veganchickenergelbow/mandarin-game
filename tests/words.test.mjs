import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syllables} from '../js/core/pinyin.js';

const rd=p=>JSON.parse(readFileSync(new URL('../data/scenes/'+p,import.meta.url),'utf8'));
const HAN=/\p{Script=Han}/u;
const norm=s=>s.normalize('NFC').replace(/[\s.,?!:;、，。？！：；]/g,'').toLowerCase();
const lines=(o,path,out=[])=>{
  if(Array.isArray(o))o.forEach((x,i)=>lines(x,`${path}[${i}]`,out));
  else if(o&&typeof o==='object'){
    if(typeof o.zh==='string'&&typeof o.py==='string')out.push([path,o]);
    for(const k in o)lines(o[k],`${path}.${k}`,out);
  }
  return out;
};
for(const id of rd('index.json')){
  const sc=rd(id+'.json');
  test(`${id}: every Chinese line has well-formed word data`,()=>{
    const all=lines(sc,id);
    assert.ok(all.length>20);
    for(const [path,l] of all){
      assert.ok(Array.isArray(l.w)&&l.w.length,`${path} has no w`);
      assert.equal(l.w.map(x=>x[0]).join(''),l.zh,`${path}: words must join to zh`);
      for(const [zh,py,en] of l.w){
        if(!HAN.test(zh)){ assert.equal(py,undefined,`${path}: punctuation ${zh} has pinyin`); continue; }
        assert.equal(syllables(py).length,[...zh].filter(c=>HAN.test(c)).length,`${path}: ${zh} / ${py}`);
        assert.ok(typeof en==='string'&&en.trim(),`${path}: ${zh} has no gloss`);
      }
      assert.equal(norm(l.w.map(x=>x[1]||'').join('')),norm(l.py),`${path}: pinyin mismatch`);
    }
  });
}
