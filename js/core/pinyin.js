// Pinyin helpers. Tone marks on vowels; no mark = neutral (5).
const MARK={'̄':1,'́':2,'̌':3,'̀':4};
const clean=s=>s.replace(/[^\p{L}\p{M}]/gu,'');
export const syllables=py=>py.split(/\s+/).map(clean).filter(s=>/\p{L}/u.test(s));
export function toneOf(syl){
  for(const c of syl.normalize('NFD')){const t=MARK[c];if(t)return t}
  return 5;
}
export const tonesOf=py=>syllables(py).map(toneOf);
export const hanziChars=zh=>[...zh].filter(c=>/\p{Script=Han}/u.test(c));
