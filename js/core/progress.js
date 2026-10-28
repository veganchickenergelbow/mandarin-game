import {fromSaved} from './voice.js';
// Save data and progression. Pure: functions take the save and mutate/return it, no storage access.
export const VERSION=2,INTERVALS=[1,3,7,14],MAXH=5;
export const newSave=()=>({v:VERSION,fish:0,days:{},rungs:{},review:[],settings:{music:false,pinyin:false,hardMoods:true},week:{id:'week1',done:{}},trust:{},played:{}});
export function migrate(o){
  const s=newSave();if(!o||typeof o!=='object')return s;
  if(Number.isFinite(o.fish))s.fish=o.fish;
  if(o.days&&typeof o.days==='object')s.days=o.days;
  if(o.rungs&&typeof o.rungs==='object')s.rungs=o.rungs;
  if(Array.isArray(o.review))s.review=o.review.filter(x=>x&&x.key).map(reviewItem);
  if(o.settings&&typeof o.settings==='object')s.settings={...s.settings,...o.settings};
  if(!s.settings.pinyinSet)s.settings.pinyin=false; // v0.2: full-line pinyin defaults off now that words are tappable
  if(o.week&&typeof o.week==='object'&&o.week.done&&typeof o.week.done==='object')s.week={id:o.week.id||'week1',done:o.week.done};
  if(o.trust&&typeof o.trust==='object')for(const[k,t]of Object.entries(o.trust))if(t&&typeof t==='object')s.trust[k]={p:clamp(t.p|0,0,4),hearts:clamp(t.hearts|0,0,MAXH)};
  if(o.played&&typeof o.played==='object')s.played=o.played;
  for(const id of Object.keys(s.rungs))if(!s.played[id])s.played[id]=1; // v2: scenes with rung progress count as played
  if(Array.isArray(o.notes))s.notes=o.notes;
  const v=fromSaved(o.voice);if(v)s.voice=v; // speaker profile {p10,p50,p90,n,calibrated}; the old {ref,n} becomes an uncalibrated one
  s.v=VERSION;return s;
}
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
// Old items were {streak}; new ones are {due,step}. A streak-based item becomes due today at step min(streak,3), so nothing is lost.
const DAY=/^\d{4}-\d{2}-\d{2}$/;
function reviewItem(x){
  const r={key:x.key,zh:x.zh||'',py:x.py||'',en:x.en||''};
  if(DAY.test(x.due||'')&&Number.isFinite(x.step)){r.due=x.due;r.step=clamp(x.step|0,0,INTERVALS.length-1)}
  else{r.due=todayKey();r.step=clamp(x.streak|0,0,INTERVALS.length-1)}
  return r;
}
export function todayKey(d=new Date()){
  const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
export const shift=(day,n)=>{const[y,m,d]=day.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)};
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
// Spaced review, SM-2-lite. step indexes INTERVALS (days). A new miss is due today; a wrong answer goes back to step 0, due tomorrow;
// a right answer (only when due) moves up a step and is due INTERVALS[step] later; a right answer at the last step removes the item.
export function reviewMiss(s,item,today=todayKey()){
  const r=s.review.find(x=>x.key===item.key);
  if(r){r.step=0;r.due=shift(today,INTERVALS[0])}
  else s.review.push({key:item.key,zh:item.zh,py:item.py,en:item.en,due:today,step:0});
}
export function reviewHit(s,key,today=todayKey()){
  const r=s.review.find(x=>x.key===key);if(!r||r.due>today)return;
  if(r.step>=INTERVALS.length-1)s.review=s.review.filter(x=>x!==r);
  else{r.step++;r.due=shift(today,INTERVALS[r.step])}
}
export const reviewDue=(s,today=todayKey())=>s.review.filter(x=>x.due<=today);
export const reviewPick=(s,n,today=todayKey())=>[...s.review].sort((a,b)=>(a.due>today)-(b.due>today)||(a.due<b.due?-1:a.due>b.due?1:0)||a.step-b.step).slice(0,n);

// Trust hearts: trust[charId]={p,hearts}. fit +1, blunt/cave -1 (never below 0 within a heart), 5 progress = a heart, max 5 hearts.
export const trustOf=(s,id)=>s.trust[id]||{p:0,hearts:0};
export function trustMove(s,id,d){
  const t=s.trust[id]||(s.trust[id]={p:0,hearts:0}),before=t.hearts;
  t.p=Math.max(0,t.p+d);
  if(t.p>=5){t.hearts=Math.min(MAXH,t.hearts+1);t.p=0}
  if(t.hearts>=MAXH)t.p=0;
  return {p:t.p,hearts:t.hearts,gained:t.hearts-before};
}
export const trusted=s=>id=>s.settings.hardMoods!==false&&trustOf(s,id).hearts>=3;
export const markPlayed=(s,id)=>{s.played[id]=(s.played[id]||0)+1};

// Week progress. days = week.days from data/weeks/week1.json. Work/life steps count as done when the scene already has rung progress (earned before the week existed).
const STEPS=['warmup','work','life'];
export const weekStep=(s,n,step)=>!!(s.week.done[n]&&s.week.done[n][step]);
export function markWeek(s,n,step){(s.week.done[n]||(s.week.done[n]={warmup:false,work:false,life:false}))[step]=true}
export function dayStep(s,day,step){
  if(weekStep(s,day.day,step))return true;
  return step!=='warmup'&&!!day[step]&&rung(s,day[step])>1;
}
export const dayDone=(s,day)=>STEPS.every(k=>dayStep(s,day,k));
/** The first unfinished day number (days.length+1 when the week is complete). Days up to and including it are unlocked. */
export const currentDay=(s,days)=>{const d=days.find(x=>!dayDone(s,x));return d?d.day:days.length+1};
export const dayUnlocked=(s,days,n)=>n>=1&&n<=days.length&&n<=currentDay(s,days);
