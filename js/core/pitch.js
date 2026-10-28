// Pitch tracking and tone classification (pure, no DOM). Ported from tone-test.html.
export function yin(buf,sr,fmin=70,fmax=450,thr=0.2,gate=0.01){
  const W=Math.floor(buf.length/2), tmin=Math.floor(sr/fmax), tmax=Math.min(Math.floor(sr/fmin),buf.length-W-1);
  let rms=0;for(let i=0;i<buf.length;i++)rms+=buf[i]*buf[i];rms=Math.sqrt(rms/buf.length);
  if(rms<gate)return {f:0,rms};
  const d=new Float32Array(tmax+1);
  for(let t=1;t<=tmax;t++){let s=0;for(let j=0;j<W;j++){const x=buf[j]-buf[j+t];s+=x*x}d[t]=s}
  let run=0;const n=new Float32Array(tmax+1);n[0]=1;
  for(let t=1;t<=tmax;t++){run+=d[t];n[t]=d[t]*t/(run||1)}
  let tau=-1;
  for(let t=Math.max(2,tmin);t<tmax;t++){
    if(n[t]<thr){while(t+1<tmax&&n[t+1]<n[t])t++;tau=t;break}
  }
  if(tau<0){ // fallback: global minimum (standard YIN)
    let m=1;for(let t=Math.max(2,tmin);t<tmax;t++)if(n[t]<m){m=n[t];tau=t}
    if(m>=0.4)tau=-1;
  }
  if(tau<2||tau>=tmax)return {f:0,rms};
  const a=n[tau-1],b=n[tau],c=n[tau+1],den=a-2*b+c;
  const tt=den?tau+(a-c)/(2*den):tau;
  return {f:sr/tt,rms};
}
// offline pitch track over a whole recording: [{t,f,rms}] every 5 ms frame (36 ms window); unvoiced frames have f:0.
// Frames with f:0 but rms at or above the voicing gate are marked creak:true (vocal fry: energy but no readable pitch).
export const FMIN_TRACK=55;
export function track(samples,sr){
  const win=Math.max(Math.round(0.032*sr),2*Math.ceil(sr/FMIN_TRACK)+2),hop=Math.round(0.005*sr),out=[],rm=[];let mx=0;
  for(let p=0;p+win<=samples.length;p+=hop){
    let s=0;for(let i=0;i<win;i++){const x=samples[p+i];s+=x*x}
    const r=Math.sqrt(s/win);rm.push(r);if(r>mx)mx=r;
  }
  const gate=Math.max(0.003,0.08*mx);
  for(let k=0,p=0;k<rm.length;k++,p+=hop){
    const t=(p+win/2)/sr;
    if(rm[k]<gate){out.push({t,f:0,rms:rm[k]});continue}
    const r=yin(samples.subarray(p,p+win),sr,FMIN_TRACK,450,0.2,0);
    out.push(r.f>0?{t,f:r.f,rms:rm[k]}:{t,f:0,rms:rm[k],creak:true});
  }
  return out;
}
export const voiced=frames=>frames.filter(x=>x.f>0);
export const toSt=(f,ref)=>12*Math.log2(f/ref);
export function median(a){const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
import {st100,height,defaultProfile} from './voice.js';
const HOP=0.005;
// frames: track() output (voiced, unvoiced and creak frames) or just the voiced frames.
// opts.speakerRef: the speaker's usual median pitch in Hz (lets classify see how LOW this utterance is).
// opts.profile: a calibrated voice profile (see voice.js) turns on the height rules.
// returns {ok, st:[12 pts], st100, ref, dur, n, creak, creakRatio, hStart, hEnd, hMin, hMean, scores:{1..4}, tone, pts, why}
export function analyse(frames,opts={}){
  const vf=frames.filter(x=>x.f>0),cr=frames.filter(x=>!(x.f>0)&&x.creak);
  const crAll=[...cr]; // creak frames plus voiced frames that are junk readings inside creak
  if(vf.length<5)return {ok:false,why:'Too little voiced sound. Speak closer to the mic.'};
  // octave-jump fix vs running median of last 5 kept frames
  const gm=median(vf.map(x=>x.f)),kept=[];
  for(const x of vf){
    const h=kept.slice(-5).map(y=>y.f),med=h.length?median(h):gm,d=toSt(x.f,med);
    const nearCreak=crAll.some(c=>Math.abs(c.t-x.t)<0.026);
    if(Math.abs(d)<(nearCreak?4:9))kept.push(x);
    else if(Math.abs(d)<15&&!nearCreak)kept.push({t:x.t,f:d>0?x.f/2:x.f*2});
    else crAll.push({t:x.t,f:0,creak:true}); // wild reading next to creak (or far off): treat as creak
  }
  crAll.sort((a,b)=>a.t-b.t);
  // a gap over 40 ms breaks the run, unless creak frames fill (at least half of) it and it is under 250 ms
  const bridged=(a,b)=>{
    if(b-a>0.25)return false;
    let c=0;for(const x of crAll)if(x.t>a&&x.t<b)c++;
    return c>=Math.max(1,Math.round((b-a)/HOP)-1)*0.5;
  };
  const creakIn=(a,b)=>{let c=0;for(const x of crAll)if(x.t>=a&&x.t<=b)c++;return c};
  let fr=[],best=0,cur=[];
  const close=()=>{if(!cur.length)return;const w=cur.length+creakIn(cur[0].t,cur[cur.length-1].t);if(w>best){best=w;fr=cur}};
  for(const x of kept){
    if(cur.length&&x.t-cur[cur.length-1].t>0.04&&!bridged(cur[cur.length-1].t,x.t)){close();cur=[]}
    cur.push(x);
  }
  close();
  // a tiny voiced fragment cut off from the run by creak (over 15 ms) at either end is a stray edge reading: drop it
  const frag=(a,fromEnd)=>{let n=0;for(let i=fromEnd?a.length-1:0;fromEnd?i>0:i<a.length-1;i+=fromEnd?-1:1){n++;if(Math.abs(a[i].t-a[i+(fromEnd?-1:1)].t)>0.015)return n}return 0};
  const f0=frag(fr,false);if(f0&&f0<3&&fr.length-f0>=5)fr=fr.slice(f0);
  const f1=frag(fr,true);if(f1&&f1<3&&fr.length-f1>=5)fr=fr.slice(0,fr.length-f1);
  if(fr.length<5)return {ok:false,why:'Pitch was unstable.'};
  // creak in the middle of the run (not its first and last 15%) marks the low point of the contour
  const ta=fr[0].t,tb=fr[fr.length-1].t,sp=tb-ta;
  const cm=crAll.filter(x=>x.t>=ta+0.15*sp&&x.t<=tb-0.15*sp);
  const creak=cm.length*HOP;
  let pts=fr;
  if(creak>=0.03){
    const add=[];
    for(const c of cm){
      let a=null,b=null;
      for(const x of fr){if(x.t<c.t)a=x;else{b=x;break}}
      if(a&&b)add.push({t:c.t,f:Math.min(a.f,b.f)*0.85,syn:true});
    }
    pts=[...fr,...add].sort((x,y)=>x.t-y.t);
  }
  // light smoothing (median of 3)
  const sm=pts.map((x,i)=>{const w=[pts[Math.max(0,i-1)].f,x.f,pts[Math.min(pts.length-1,i+1)].f];return {t:x.t,f:median(w),syn:!!x.syn}});
  const ref=median(sm.filter(x=>!x.syn).map(x=>x.f));
  const t0=sm[0].t,t1=sm[sm.length-1].t,span=Math.max(1e-3,t1-t0);
  const N=12,st=[];
  for(let k=0;k<N;k++){
    const tt=t0+span*k/(N-1);let i=0;while(i<sm.length-1&&sm[i+1].t<tt)i++;
    const a=sm[i],b=sm[Math.min(i+1,sm.length-1)];
    const u=b.t>a.t?Math.min(1,Math.max(0,(tt-a.t)/(b.t-a.t))):0;
    st.push(toSt(a.f+(b.f-a.f)*u,ref));
  }
  // absolute pitch (semitones re 100 Hz) and height within the speaker's range (0 = bottom, 1 = top)
  const prof=opts.profile&&opts.profile.calibrated?opts.profile:null,shown=prof||defaultProfile(st100(ref));
  const st100pts=st.map(v=>v+st100(ref));
  const hh=st100pts.map(v=>height(v,shown)),avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  // creak counted inside the run, as a share of (voiced + creak) frames
  const nCreak=creakIn(fr[0].t,fr[fr.length-1].t),creakRatio=nCreak/(fr.length+nCreak);
  const hMin=creakRatio>0.15?0:Math.min(...hh);
  const h={hStart:avg(hh.slice(0,2)),hEnd:avg(hh.slice(-2)),hMin,hMean:avg(hh)};
  // legacy: positive when this utterance sits below a bare speakerRef (Hz)
  const low=!prof&&opts.speakerRef>0?toSt(opts.speakerRef,ref):0;
  const scores=score(st,{creak,low,creakRatio,h,calibrated:!!prof});
  return {ok:true,st,st100:st100pts,ref,dur:span,n:fr.length,creak,creakRatio,...h,scores,tone:argmax(scores),calibrated:!!prof,pts:fr.map(x=>({t:x.t,f:x.f}))};
}
const ramp=(x,a,b)=>Math.min(1,Math.max(0,(x-a)/(b-a)));
export const argmax=sc=>[1,2,3,4].reduce((b,k)=>sc[k]>sc[b]?k:b,1);
// Scores 0..1 per tone. Shape rules (relative contour) give the base evidence; with a calibrated profile the height rules
// (tone 3 is LOW, tone 1 is high and flat, tone 4 starts high) add to or scale them. Higher number = earlier in the old if-chain.
// info: creak (s), low (st below a bare speakerRef), creakRatio, h {hStart,hEnd,hMin,hMean}, calibrated.
export function score(st,info={}){
  const n=st.length,m=(a,b)=>st.slice(a,b).reduce((x,y)=>x+y,0)/(b-a);
  const s=m(0,4),e=m(8,n),mn=Math.min(...st),mx=Math.max(...st),range=mx-mn,minI=st.indexOf(mn)/(n-1),maxI=st.indexOf(mx)/(n-1);
  const slope=e-s,creak=info.creak||0,low=info.low||0,cr=info.creakRatio||0,h=info.h,cal=!!(info.calibrated&&h);
  // least-squares slope of the last 5 points, as semitones per 4 steps (the last 35% of the contour)
  const tl=st.slice(n-5),tm=(tl.length-1)/2,tail=tl.reduce((a,v,i)=>a+(i-tm)*v,0)/tl.reduce((a,_,i)=>a+(i-tm)*(i-tm),0)*4;
  const early=m(0,2)-m(6,8); // drop over roughly the first 60%
  const rise=slope>=1.8;
  const fall=slope<=-2.0&&maxI<0.6&&(s-e>=5.5||tail<=-0.9); // a sustained fall, right to the end
  const sc={1:0,2:0,3:0,4:0},up=(k,v)=>{if(v>sc[k])sc[k]=v};
  // soft evidence, always below any rule
  up(1,0.3*(1-ramp(range,1,4)));up(2,0.3*ramp(slope,0,2.5));up(4,0.3*ramp(-slope,0,3));
  up(3,0.3*ramp(s-mn,0,2)*ramp(e-mn,0,1));
  // old fallbacks
  if(range<3.2&&!rise)up(1,0.4);else if(!rise)up(slope<0?4:2,0.35);
  if(rise)up(2,0.65);
  // tone 2: a real tone 2 can start with a small dip; a big rise after it is still tone 2
  if(e-s>=2.5&&s-mn<1.5)up(2,0.96);
  // tone 3
  if(creak>=0.03&&!rise&&!fall)up(3,cr>0.15?0.95:0.92);   // creaky low part
  if(s-mn>=1.0&&e-mn>=0.7&&minI>=0.2&&minI<=0.9)up(3,0.8);                              // dip
  if(early>=1.5&&Math.abs(tail)<0.9&&s-e<5.5&&minI>=0.45)up(3,0.75);                    // half-third: falls, then level
  // tone 1: flat
  const flat=range<2.6&&Math.abs(slope)<1.6;
  if(cal){
    const lowS=(1-ramp(h.hMin,0.15,0.4))*(1-ramp(h.hMean,0.35,0.6));                    // LOW in this speaker's range
    const drop=m(0,2)-m(n-2,n),highFall=ramp(h.hStart,0.45,0.65)*ramp(drop,3,4.5);        // a fall from the top
    if(!rise)up(3,0.9*lowS*(1-highFall));
    if(flat)up(1,0.85*ramp(h.hMean,0.25,0.5));
    if(fall)up(4,0.7*ramp(h.hStart,0.4,0.6));
    up(4,0.95*highFall);
  }else{
    if(low>=2&&!rise&&!fall)up(3,0.9);                                                   // legacy: low against a bare speakerRef
    if(flat)up(1,0.85);
    if(fall)up(4,0.7);
  }
  return sc;
}
export const classify=(st,info={})=>argmax(score(st,info));
// Lenient pass: the target wins, or is within 0.1 of the winner and the pair is a usual confusion (3/2, 3/4, 1/4).
const CONFUSED=new Set(['2,3','3,4','1,4']);
export function judge(target,scores){
  const top=argmax(scores);
  if(top===target)return {ok:true,close:false,top};
  const close=scores[target]>=scores[top]-0.1&&CONFUSED.has([target,top].sort().join(','));
  return {ok:close,close,top};
}
export const TEMPLATES={1:t=>0,2:t=>-2.5+5*t,3:t=>t<.45?-1-4*(t/.45)*0.9+0.0:-4.6+5.8*((t-.45)/.55),4:t=>4-8*t};
