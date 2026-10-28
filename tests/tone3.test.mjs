import test from 'node:test';
import assert from 'node:assert/strict';
import {profiles,cases,run} from './tone3.mjs';
import {scoreWord,splitSyllables} from '../js/core/syllables.js';
import {track} from '../js/core/pitch.js';
import {word,sr} from './synth.mjs';

// Miss counts per case and profile mode, over 20 seeds. Printed as a table; calibrated must be perfect.
const rows=[];
for(const [pn,p] of Object.entries(profiles))for(const c of cases(p))for(const amp of [0.3,0.05]){
  const cal=run(c,{amp,profile:p}),unc=run(c,{amp,profile:null});
  rows.push(`${pn.padEnd(6)} amp ${String(amp).padEnd(4)} ${c.name.padEnd(56)} calibrated ${String(cal.misses).padStart(2)}/20   uncalibrated ${String(unc.misses).padStart(2)}/20 ${unc.misses?JSON.stringify(unc.got):''}`);
  test(`${pn} amp ${amp}: ${c.name} -> tone ${c.tone}, calibrated`,()=>assert.equal(cal.misses,0,JSON.stringify(cal.got)));
  if(!c.needsProfile)test(`${pn} amp ${amp}: ${c.name} -> tone ${c.tone}, uncalibrated (take's own default profile)`,()=>assert.ok(unc.misses<=2,JSON.stringify(unc.got)));
  else test(`${pn} amp ${amp}: ${c.name}, uncalibrated cannot be told from tone 1/4 by shape alone`,()=>assert.ok(unc.misses===0||unc.misses===20));
}
test('miss-count table',()=>{console.log('\n'+rows.join('\n'))});

// sandhi words after splitting, male and female voices, with and without a calibrated profile
const halfThird=b=>u=>u<.55?b*(1-0.3*(u/.55)):b*0.7;
for(const [pn,p] of Object.entries(profiles))for(const [mode,prof] of [['calibrated',p],['uncalibrated',null]]){
  const base=pn==='male'?110:220;
  for(const [label,zh,py,tones,opt] of [
    ['你好 2-3','你好','nǐ hǎo',[2,3],{}],
    ['你好 2-3 with creak in the 3','你好','nǐ hǎo',[2,3],{creak:{syl:1,from:.16,to:.24}}],
    ['老板 2-3','老板','lǎo bǎn',[2,3],{}],
    ['买卖 3-4','买卖','mǎi mài',[3,4],{}],
    ['买卖 half-third 3-4','买卖','mǎi mài',[3,4],{f3:halfThird}],
  ])test(`${label}, ${pn}, ${mode}`,()=>{
    const w=word(tones,{...opt,base,gapMs:60,dur:.4});
    assert.equal(splitSyllables(track(w,sr),2).length,2);
    const r=scoreWord(w,sr,zh,py,{profile:prof});
    assert.deepEqual(r.items.map(i=>i.expected),tones);
    assert.deepEqual(r.items.map(i=>i.heard),tones);
    assert.ok(r.items.every(i=>i.ok===true&&i.scores));
  });
}
