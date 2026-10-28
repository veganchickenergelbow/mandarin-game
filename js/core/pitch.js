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
// offline pitch track over a whole recording: [{t,f,rms}] every 5 ms frame (32 ms window); unvoiced frames have f:0
export function track(samples,sr){
  const win=Math.max(Math.round(0.032*sr),2*Math.ceil(sr/70)+2),hop=Math.round(0.005*sr),out=[],rm=[];let mx=0;
  for(let p=0;p+win<=samples.length;p+=hop){
    let s=0;for(let i=0;i<win;i++){const x=samples[p+i];s+=x*x}
    const r=Math.sqrt(s/win);rm.push(r);if(r>mx)mx=r;
  }
  const gate=Math.max(0.003,0.08*mx);
  for(let k=0,p=0;k<rm.length;k++,p+=hop){
    const t=(p+win/2)/sr;
    if(rm[k]<gate){out.push({t,f:0,rms:rm[k]});continue}
    const r=yin(samples.subarray(p,p+win),sr,70,450,0.2,0);
    out.push({t,f:r.f>0?r.f:0,rms:rm[k]});
  }
  return out;
}
export const voiced=frames=>frames.filter(x=>x.f>0);
export const toSt=(f,ref)=>12*Math.log2(f/ref);
export function median(a){const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
// frames: [{t,f}] voiced only. returns {ok, st:[12 pts], tone, why}
export function analyse(frames){
  if(frames.length<5)return {ok:false,why:'Too little voiced sound. Speak closer to the mic.'};
  // octave-jump fix vs running median of last 5 kept frames, then keep only the longest voiced run
  const gm=median(frames.map(x=>x.f)),kept=[];
  for(const x of frames){
    const h=kept.slice(-5).map(y=>y.f),med=h.length?median(h):gm,d=toSt(x.f,med);
    if(Math.abs(d)<9)kept.push(x);
    else if(Math.abs(d)<15)kept.push({t:x.t,f:d>0?x.f/2:x.f*2});
  }
  let fr=[],cur=[];
  for(const x of kept){
    if(cur.length&&x.t-cur[cur.length-1].t>0.04){if(cur.length>fr.length)fr=cur;cur=[]}
    cur.push(x);
  }
  if(cur.length>fr.length)fr=cur;
  if(fr.length<5)return {ok:false,why:'Pitch was unstable.'};
  // light smoothing (median of 3)
  const sm=fr.map((x,i)=>{const w=[fr[Math.max(0,i-1)].f,x.f,fr[Math.min(fr.length-1,i+1)].f];return {t:x.t,f:median(w)}});
  const ref=median(sm.map(x=>x.f));
  const t0=sm[0].t,t1=sm[sm.length-1].t,span=Math.max(1e-3,t1-t0);
  const N=12,st=[];
  for(let k=0;k<N;k++){
    const tt=t0+span*k/(N-1);let i=0;while(i<sm.length-1&&sm[i+1].t<tt)i++;
    const a=sm[i],b=sm[Math.min(i+1,sm.length-1)];
    const u=b.t>a.t?Math.min(1,Math.max(0,(tt-a.t)/(b.t-a.t))):0;
    st.push(toSt(a.f+(b.f-a.f)*u,ref));
  }
  return {ok:true,st,ref,dur:span,n:fr.length,tone:classify(st)};
}
export function classify(st){
  const n=st.length,m=(a,b)=>st.slice(a,b).reduce((x,y)=>x+y,0)/(b-a);
  const s=m(0,4),mid=m(4,8),e=m(8,n),mn=Math.min(...st),mx=Math.max(...st),range=mx-mn,minI=st.indexOf(mn)/(n-1),maxI=st.indexOf(mx)/(n-1);
  const slope=e-s;
  if(range<2.6&&Math.abs(slope)<1.6)return 1;
  if(s-mn>=1.3&&e-mn>=1.0&&minI>0.2&&minI<0.85&&mid<=Math.min(s,e)+0.3)return 3;
  if(slope<=-2.0&&maxI<0.6)return 4;
  if(slope>=1.8)return 2;
  if(range<3.2)return 1;
  return slope<0?4:2;
}
export const TEMPLATES={1:t=>0,2:t=>-2.5+5*t,3:t=>t<.45?-1-4*(t/.45)*0.9+0.0:-4.6+5.8*((t-.45)/.55),4:t=>4-8*t};
