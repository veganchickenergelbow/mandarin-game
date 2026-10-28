// Test helper (not a test file): synthetic harmonic voices.
export const sr=48000;
let seed=1;
export const reseed=n=>{seed=n};
const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5};
// Creaky stretch: jittered damped pulses at random 8-20 ms intervals (aperiodic, so YIN finds no pitch), scaled to rms.
export function creakBuf(n,rms){
  const b=new Float32Array(n);let p=Math.round((0.004+0.008*(rnd()+.5))*sr);
  while(p<n){
    const A=0.6+0.8*(rnd()+.5);
    for(let k=0;k<Math.round(0.015*sr)&&p+k<n;k++)b[p+k]+=A*Math.exp(-k/(0.003*sr))*Math.sin(2*Math.PI*350*k/sr);
    p+=Math.round((0.008+0.012*(rnd()+.5))*sr);
  }
  let e=0;for(let i=0;i<n;i++)e+=b[i]*b[i];e=Math.sqrt(e/n)||1;
  for(let i=0;i<n;i++)b[i]*=rms/e;
  return b;
}
// piecewise-linear pitch: pw([[0,250],[.15,258],[1,140]]) -> u=>Hz
export const pw=pts=>u=>{for(let i=1;i<pts.length;i++)if(u<=pts[i][0]||i===pts.length-1){const[a,fa]=pts[i-1],[b,fb]=pts[i];return fa+(fb-fa)*Math.min(1,Math.max(0,(u-a)/(b-a)))}};
// creak: [from,to] seconds inside the voiced part; the amplitude carries on but the signal is aperiodic there.
export function synth({f0,f1,dur,amp,decay=1,pre=0,post=0,dip,creak}){
  const N=Math.round((pre+dur+post)*sr),x=new Float32Array(N);let ph=0;
  const c0=creak?Math.round((pre+creak[0])*sr):0,c1=creak?Math.round((pre+creak[1])*sr):0;
  const cb=creak?creakBuf(c1-c0,amp*0.47):null;
  for(let i=0;i<N;i++){const t=i/sr-pre;let v=0;
    if(t>=0&&t<dur){const u=t/dur;let f=dip?dip(u):f0+(f1-f0)*u;ph+=2*Math.PI*f/sr;
      const env=Math.min(1,t/0.02,(dur-t)/0.01)*(1-(1-decay)*u);
      for(let h=1;h<=5;h++)v+=Math.sin(h*ph)/h;v*=amp*env*0.55;
      if(cb&&i>=c0&&i<c1)v=cb[i-c0]*env}
    x[i]=v+0.0008*rnd()*2}
  return x}
export const dip=(a,b,c)=>u=>u<.5?a+(b-a)*(u/.5):b+(c-b)*((u-.5)/.5);
const F={
  1:b=>u=>b,
  2:b=>u=>b*0.85+b*0.3*u,
  3:b=>u=>u<.5?b*(1-0.3*(u/.5)):b*0.7+b*0.3*((u-.5)/.5),
  4:b=>u=>b*1.25-b*0.5*u,
};
// tones[] -> one continuous voice. gapMs>0: silence between syllables; gapMs=0: only an amplitude valley (dipMs wide).
// f3: optional replacement for the tone 3 shape, b=>u=>Hz (e.g. a half-third). creak: {syl,from,to} seconds inside that syllable.
export function word(tones,{base=200,dur=0.3,gapMs=0,dipMs=60,amp=0.3,creak,f3}={}){
  const gap=gapMs/1000,half=dipMs/2000,n=tones.length;
  const x=new Float32Array(Math.round((n*dur+(n-1)*gap+0.4)*sr));
  let ph=0;
  for(let k=0;k<n;k++){
    const start=0.2+k*(dur+gap),fn=(tones[k]===3&&f3?f3:F[tones[k]])(base);
    const cs=creak&&creak.syl===k?Math.round((start+creak.from)*sr):0,ce=creak&&creak.syl===k?Math.round((start+creak.to)*sr):0;
    const cb=ce>cs?creakBuf(ce-cs,amp*0.47):null;
    for(let i=Math.round(start*sr);i<Math.round((start+dur)*sr);i++){
      const t=i/sr-start;ph+=2*Math.PI*fn(t/dur)/sr;
      let env=gap>0?Math.min(1,t/0.02,(dur-t)/0.012):1;
      if(gap===0){
        if(k===0)env=Math.min(env,t/0.02);else if(t<half)env=0.15+0.85*(t/half);
        if(k===n-1)env=Math.min(env,(dur-t)/0.012);else if(dur-t<half)env=Math.min(env,0.15+0.85*((dur-t)/half));
      }
      let v=0;for(let h=1;h<=5;h++)v+=Math.sin(h*ph)/h;
      if(cb&&i>=cs&&i<ce)v=cb[i-cs]/(amp*0.55);
      x[i]+=v*amp*0.55*Math.max(0,Math.min(1,env));
    }
  }
  for(let i=0;i<x.length;i++)x[i]+=0.0008*rnd()*2;
  return x;
}
