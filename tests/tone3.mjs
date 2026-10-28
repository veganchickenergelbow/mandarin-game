// Test helper: the phase 2 tone 3 case matrix (synthetic voices, male ~110 Hz and female ~220 Hz), with and without calibration.
import {track,analyse} from '../js/core/pitch.js';
import {st100,hz} from '../js/core/voice.js';
import {synth,pw,reseed,sr} from './synth.mjs';

export const profiles={
  male:{p10:st100(110)-4,p50:st100(110),p90:st100(110)+5,n:50,calibrated:true},
  female:{p10:st100(220)-4,p50:st100(220),p90:st100(220)+5,n:50,calibrated:true},
};
// contour in semitones [[u, st]...] (u 0..1) -> pitch function in Hz
const C=pts=>{const f=pw(pts);return u=>hz(f(u))};
export const cases=p=>[
  {name:'half-third p50 -> p10-1 (0.3 s)',tone:3,dur:.3,f:C([[0,p.p50],[.55,p.p10-1],[1,p.p10-1]])},
  {name:'half-third p50 -> p10-1 (0.4 s)',tone:3,dur:.4,f:C([[0,p.p50],[.55,p.p10-1],[1,p.p10-1]])},
  {name:'dip-rise p50 -> p10 -> p50+1, 100 ms creak at the bottom',tone:3,dur:.45,f:C([[0,p.p50],[.5,p.p10],[1,p.p50+1]]),creak:[.17,.27]},
  {name:'dip-rise, 60 ms creak',tone:3,dur:.45,f:C([[0,p.p50],[.5,p.p10],[1,p.p50+1]]),creak:[.19,.25]},
  {name:'dip-rise, 120 ms creak',tone:3,dur:.5,f:C([[0,p.p50],[.5,p.p10],[1,p.p50+1]]),creak:[.19,.31]},
  {name:'low flat at p10',tone:3,dur:.35,f:C([[0,p.p10],[1,p.p10]]),needsProfile:true},
  {name:'high flat at p90',tone:1,dur:.35,f:C([[0,p.p90],[1,p.p90]])},
  {name:'high steep fall p90 -> p10 (0.15 s)',tone:4,dur:.15,f:C([[0,p.p90],[1,p.p10]]),pre:.2,post:.2},
  {name:'mid fall p50 -> p10-2 (0.35 s)',tone:3,dur:.35,f:C([[0,p.p50],[1,p.p10-2]]),needsProfile:true},
];
// returns {misses, n, got:{tone:count}} over seeds
export function run(c,{amp=.3,seeds=20,profile=null}={}){
  let misses=0;const got={};
  for(let s=1;s<=seeds;s++){
    reseed(s*7919);
    const r=analyse(track(synth({dip:c.f,dur:c.dur,amp,pre:c.pre||0,post:c.post||0,creak:c.creak}),sr),{profile});
    const t=r.ok?r.tone:0;got[t]=(got[t]||0)+1;if(t!==c.tone)misses++;
  }
  return {misses,n:seeds,got};
}
