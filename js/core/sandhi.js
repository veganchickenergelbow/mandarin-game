// Surface tones after sandhi. zh: text, tones: dictionary tones for its CJK chars (same length).
import {hanziChars} from './pinyin.js';
export function surfaceTones(zh,tones){
  const ch=hanziChars(zh),out=[...tones];
  for(let i=0;i<tones.length;i++){
    const c=ch[i],t=tones[i],nx=tones[i+1];
    if(t===3&&nx===3)out[i]=2;
    else if(c==='不'&&t===4&&nx===4)out[i]=2;
    else if(c==='一'&&t===1&&nx!==undefined&&nx!==5)out[i]=nx===4?2:4;
  }
  return out;
}
