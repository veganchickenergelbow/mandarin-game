// Split one recording into n syllables by energy valleys, then score each tone.
import {track,voiced,analyse,median,judge} from './pitch.js';
import {syllables,tonesOf} from './pinyin.js';
import {surfaceTones} from './sandhi.js';

const MIN_GAP=12,MIN_EDGE=8,MIN_DEPTH=0.1; // frames of 5 ms: 60 ms apart, 40 ms from the ends

// frames: full track() output (voiced, unvoiced, creak). Returns exactly n [{t0,t1,frames,all}], frames = voiced only,
// all = every track frame of the segment (creak included) from its first to its last voiced frame.
// Creak frames (energy but no readable pitch) are part of the voice: they are never syllable-boundary gaps.
export function splitSyllables(frames,n){
  const vi=[];frames.forEach((x,i)=>{if(x.f>0)vi.push(i)});
  if(!vi.length||n<1)return Array.from({length:Math.max(n,0)},()=>({t0:0,t1:0,frames:[]}));
  const a=vi[0],b=vi[vi.length-1];
  let cuts=[];
  if(n>1){
    const sm=[];for(let i=0;i<frames.length;i++){ // ~15 ms moving average (3 frames)
      let s=0,c=0;for(let k=i-1;k<=i+1;k++)if(frames[k]){s+=frames[k].rms||0;c++}sm[i]=s/c}
    const cand=new Set();
    for(let i=a+1;i<b;i++)if(sm[i]<=sm[i-1]&&sm[i]<sm[i+1])cand.add(i);
    for(let i=a;i<=b;){ // unvoiced gaps: centre of each run
      if(frames[i].f>0||frames[i].creak){i++;continue}
      let j=i;while(j<=b&&frames[j].f===0&&!frames[j].creak)j++;
      cand.add(Math.floor((i+j-1)/2));i=j;
    }
    const W=30,mx=(x,y)=>{let m=0;for(let k=Math.max(a,x);k<=Math.min(b,y);k++)m=Math.max(m,sm[k]);return m};
    const scored=[...cand].filter(c=>c-a>=MIN_EDGE&&b-c>=MIN_EDGE).map(c=>{
      const peak=Math.min(mx(c-W,c),mx(c,c+W)); // neighbouring peaks, within ~150 ms each side
      return {c,peak,depth:peak>0?(peak-sm[c])/peak:0};
    }).filter(x=>x.depth>=MIN_DEPTH).sort((x,y)=>y.depth-x.depth);
    for(const s of scored){
      if(cuts.length>=n-1)break;
      // same valley (no real rise between the two points) counts as one cut
      if(cuts.every(c=>Math.abs(c-s.c)>=MIN_GAP&&mx(Math.min(c,s.c),Math.max(c,s.c))-Math.max(sm[c],sm[s.c])>=0.15*s.peak))cuts.push(s.c);
    }
    cuts.sort((x,y)=>x-y);
    if(cuts.length<n-1){ // fallback: equal split of the voiced span
      cuts=[];for(let k=1;k<n;k++)cuts.push(Math.round(a+(b-a+1)*k/n));
    }
  }
  const bounds=[a,...cuts,b+1],out=[];
  for(let k=0;k<n;k++){
    const s=bounds[k],e=bounds[k+1];
    const seg=frames.slice(s,e),vs=seg.filter(x=>x.f>0),all=vs.length?seg.slice(seg.indexOf(vs[0]),seg.indexOf(vs[vs.length-1])+1):[];
    out.push({t0:frames[s].t,t1:frames[Math.min(e,frames.length)-1].t,frames:vs,all});
  }
  return out;
}

// opts.profile: calibrated voice profile (voice.js); opts.speakerRef: legacy bare median (Hz).
// Returns {ok, items, ref, frames}: ref = median pitch of the word (Hz), frames = the pitch frames used (for updating the profile).
// Each item: {syl, expected, heard, ok, close, scores, creakRatio, res}. ok uses the lenient judge(); close = passed as a near miss.
export function scoreWord(samples,sr,zh,py,opts={}){
  const fr=track(samples,sr);
  if(voiced(fr).length<5)return {ok:false,why:'Too little voiced sound. Speak closer to the mic.',items:[]};
  const syl=syllables(py),n=syl.length;
  const exp=surfaceTones(zh,tonesOf(py));
  const segs=splitSyllables(fr,n);
  const items=syl.map((s,i)=>{
    const expected=exp[i],seg=segs[i];
    const res=seg.frames.length<5?{ok:false,why:'Too little voiced sound in this syllable.'}:analyse(seg.all,{speakerRef:opts.speakerRef,profile:opts.profile});
    const heard=res.ok?res.tone:null;
    const j=res.ok&&expected!==5?judge(expected,res.scores):{ok:false,close:false};
    return {syl:s,expected,heard,ok:expected===5?null:j.ok,close:!!j.close&&expected!==5,scores:res.ok?res.scores:null,creakRatio:res.ok?res.creakRatio:0,res};
  });
  const refs=items.filter(i=>i.res.ok).map(i=>i.res.ref);
  return {ok:true,items,ref:refs.length?median(refs):null,frames:items.flatMap(i=>i.res.ok?i.res.pts:[])};
}
