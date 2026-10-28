// Fuzzy matching of speech-to-text results.
export const normalize=s=>[...String(s||'').toLowerCase()].filter(c=>/[\p{Script=Han}a-z0-9]/u.test(c)).join('');
export function similarity(heard,target){
  const a=[...normalize(heard)],b=[...normalize(target)];
  if(!b.length)return 0;
  let prev=new Array(b.length+1).fill(0);
  for(let i=1;i<=a.length;i++){
    const cur=[0];
    for(let j=1;j<=b.length;j++)cur[j]=a[i-1]===b[j-1]?prev[j-1]+1:Math.max(prev[j],cur[j-1]);
    prev=cur;
  }
  return prev[b.length]/b.length;
}
export function intentCheck(heard,groups){
  const h=normalize(heard),hit=[],missed=[];
  groups.forEach((g,i)=>(g.some(a=>{const n=normalize(a);return n&&h.includes(n)})?hit:missed).push(i));
  return {allHit:missed.length===0,hit,missed};
}
