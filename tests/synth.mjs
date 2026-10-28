// Test helper (not a test file): synthetic harmonic voices.
export const sr=48000;
let seed=1;
const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5};
export function synth({f0,f1,dur,amp,decay=1,pre=0,post=0,dip}){
  const N=Math.round((pre+dur+post)*sr),x=new Float32Array(N);let ph=0;
  for(let i=0;i<N;i++){const t=i/sr-pre;let v=0;
    if(t>=0&&t<dur){const u=t/dur;let f=dip?dip(u):f0+(f1-f0)*u;ph+=2*Math.PI*f/sr;
      const env=Math.min(1,t/0.02,(dur-t)/0.01)*(1-(1-decay)*u);
      for(let h=1;h<=5;h++)v+=Math.sin(h*ph)/h;v*=amp*env*0.55}
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
export function word(tones,{base=200,dur=0.3,gapMs=0,dipMs=60,amp=0.3}={}){
  const gap=gapMs/1000,half=dipMs/2000,n=tones.length;
  const x=new Float32Array(Math.round((n*dur+(n-1)*gap+0.4)*sr));
  let ph=0;
  for(let k=0;k<n;k++){
    const start=0.2+k*(dur+gap),fn=F[tones[k]](base);
    for(let i=Math.round(start*sr);i<Math.round((start+dur)*sr);i++){
      const t=i/sr-start;ph+=2*Math.PI*fn(t/dur)/sr;
      let env=gap>0?Math.min(1,t/0.02,(dur-t)/0.012):1;
      if(gap===0){
        if(k===0)env=Math.min(env,t/0.02);else if(t<half)env=0.15+0.85*(t/half);
        if(k===n-1)env=Math.min(env,(dur-t)/0.012);else if(dur-t<half)env=Math.min(env,0.15+0.85*((dur-t)/half));
      }
      let v=0;for(let h=1;h<=5;h++)v+=Math.sin(h*ph)/h;
      x[i]+=v*amp*0.55*Math.max(0,Math.min(1,env));
    }
  }
  for(let i=0;i<x.length;i++)x[i]+=0.0008*rnd()*2;
  return x;
}
