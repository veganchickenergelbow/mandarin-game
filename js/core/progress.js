import {fromSaved} from './voice.js';
// Save data and progression. Pure: functions take the save and mutate/return it, no storage access.
export const newSave=()=>({v:1,fish:0,days:{},rungs:{},review:[],settings:{music:false,pinyin:false}});
export function migrate(o){
  const s=newSave();if(!o||typeof o!=='object')return s;
  if(Number.isFinite(o.fish))s.fish=o.fish;
  if(o.days&&typeof o.days==='object')s.days=o.days;
  if(o.rungs&&typeof o.rungs==='object')s.rungs=o.rungs;
  if(Array.isArray(o.review))s.review=o.review.filter(x=>x&&x.key).map(x=>({key:x.key,zh:x.zh||'',py:x.py||'',en:x.en||'',streak:x.streak|0}));
  if(o.settings&&typeof o.settings==='object')s.settings={...s.settings,...o.settings};
  if(!s.settings.pinyinSet)s.settings.pinyin=false; // v0.2: full-line pinyin defaults off now that words are tappable
  if(Array.isArray(o.notes))s.notes=o.notes;
  const v=fromSaved(o.voice);if(v)s.voice=v; // speaker profile {p10,p50,p90,n,calibrated}; the old {ref,n} becomes an uncalibrated one
  return s;
}
export function todayKey(d=new Date()){
  const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
const shift=(day,n)=>{const[y,m,d]=day.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)};
export const addFish=(s,n)=>{s.fish=Math.max(0,s.fish+n)};
export function markStep(s,day,step){(s.days[day]||(s.days[day]={warmup:false,work:false,life:false}))[step]=true}
export const stepsDone=(s,day)=>{const d=s.days[day]||{};return {warmup:!!d.warmup,work:!!d.work,life:!!d.life}};
const any=(s,day)=>{const d=stepsDone(s,day);return d.warmup||d.work||d.life};
export function streak(s,day){
  let d=any(s,day)?day:shift(day,-1),n=0;
  while(any(s,d)){n++;d=shift(d,-1)}
  return n;
}
export const rung=(s,id)=>Math.min(3,Math.max(1,s.rungs[id]||1));
export function recordRung(s,id,rungNo,ratio){
  if(ratio>=0.8)s.rungs[id]=Math.max(rung(s,id),Math.min(3,rungNo+1));
}
export function reviewMiss(s,item){
  const r=s.review.find(x=>x.key===item.key);
  if(r)r.streak=0;else s.review.push({key:item.key,zh:item.zh,py:item.py,en:item.en,streak:0});
}
export function reviewHit(s,key){
  const r=s.review.find(x=>x.key===key);if(!r)return;
  r.streak++;if(r.streak>=2)s.review=s.review.filter(x=>x!==r);
}
export const reviewPick=(s,n)=>[...s.review].sort((a,b)=>a.streak-b.streak).slice(0,n);
