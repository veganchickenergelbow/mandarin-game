// Speaker profile (pure). {p10, p50, p90, n, calibrated} in semitones re 100 Hz, from voiced F0 frames.
export const st100=f=>12*Math.log2(f/100);
export const hz=st=>100*Math.pow(2,st/12);
const MIN_SPAN=3; // semitones: a narrower range is not trusted when turning pitch into a height
export function percentile(sorted,q){
  if(!sorted.length)return NaN;
  const x=(sorted.length-1)*q,i=Math.floor(x),u=x-i;
  return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*u;
}
// frames: [{f}] (anything with f>0 counts). Gross outliers (over 10 st from the median) are dropped. Returns null when empty.
export function fromFrames(frames){
  let a=frames.filter(x=>x&&x.f>0).map(x=>st100(x.f)).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=percentile(a,0.5);
  a=a.filter(v=>Math.abs(v-m)<=10);
  return {p10:percentile(a,0.1),p50:percentile(a,0.5),p90:percentile(a,0.9),n:a.length,calibrated:false};
}
export function calibrate(frames){
  const p=fromFrames(frames);
  return p&&{...p,calibrated:true};
}
// EMA over recordings (alpha 0.2). A single word's own range is much narrower than a speaker's, so p50 follows the
// EMA and carries p10/p90 with it; p10/p90 then only stretch outwards (EMA towards the take when it goes beyond).
export function update(profile,frames,alpha=0.2){
  const t=fromFrames(frames);
  if(!t)return profile;
  if(!profile)return {...t};
  const p50=profile.p50+alpha*(t.p50-profile.p50),d=p50-profile.p50;
  let p10=profile.p10+d,p90=profile.p90+d;
  if(t.p10<p10)p10+=alpha*(t.p10-p10);
  if(t.p90>p90)p90+=alpha*(t.p90-p90);
  return {p10,p50,p90,n:(profile.n|0)+1,calibrated:profile.calibrated};
}
// height 0 (bottom of the speaker's range) .. 1 (top); not clamped
export const height=(st,profile)=>(st-profile.p10)/Math.max(MIN_SPAN,profile.p90-profile.p10);
// no calibration: assume the take sits a little below the middle of the range
export const defaultProfile=takeMedianSt=>({p10:takeMedianSt-3,p50:takeMedianSt+2,p90:takeMedianSt+7,n:0,calibrated:false});
// old save shape {ref (Hz), n} or a profile; null when it is neither
export function fromSaved(v){
  if(!v||typeof v!=='object')return null;
  if([v.p10,v.p50,v.p90].every(Number.isFinite))return {p10:v.p10,p50:v.p50,p90:v.p90,n:v.n|0,calibrated:!!v.calibrated};
  if(Number.isFinite(v.ref)&&v.ref>0){const p50=st100(v.ref);return {p10:p50-5,p50,p90:p50+5,n:v.n|0,calibrated:false}}
  return null;
}
// the profile to score with: only a calibrated one counts
export const usable=s=>s&&s.voice&&s.voice.calibrated?s.voice:null;
