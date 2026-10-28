// Shared Chinese line renderer. zhLine(line, {speak, onAddReview}) returns a <span class="zhl"> of tappable words.
// Tapping a word opens one small popover (characters, tone-coloured pinyin, gloss, hear + add to review).
import { syllables, toneOf } from '../core/pinyin.js';

const HAN = /\p{Script=Han}/u;
let pop = null, openWord = null, wired = false;

function injectCss() {
  if (document.getElementById('zh-css')) return;
  const s = document.createElement('style');
  s.id = 'zh-css';
  s.textContent = `
:root { --t1: #E0443E; --t2: #E08A00; --t3: #1E9E84; --t4: #4A68E0; --t5: #8A8096; }
@media (prefers-color-scheme: dark) { :root { --t1: #FF7E75; --t2: #FFB04D; --t3: #4FDDBE; --t4: #8FA8FF; --t5: #A89FB8; } }
.zhl { line-height: 32px; }
.zhw { display: inline-block; min-height: 32px; line-height: 32px; padding: 0 1px; border-radius: 8px; cursor: pointer; text-decoration: underline dotted var(--ink2); text-decoration-thickness: 2px; text-underline-offset: 5px; -webkit-tap-highlight-color: transparent; outline: none; }
.zhw.on { background: var(--soft); box-shadow: 0 0 0 2px var(--lav); text-decoration-color: transparent; }
.zhw:focus-visible { box-shadow: 0 0 0 2px var(--sky); }
.zhpop { position: fixed; z-index: 40; width: max-content; max-width: min(260px, calc(100vw - 16px)); box-sizing: border-box; background: var(--card); color: var(--ink); border: 2px solid var(--line-d); border-radius: 16px; box-shadow: 0 4px 0 var(--line-d), 0 10px 24px rgba(0,0,0,.18); padding: 10px 12px; display: grid; gap: 6px; font-family: var(--font); text-align: left; font-size: 15px; font-weight: 700; line-height: 1.3; }
.zhpop .zc { font-family: var(--zh); font-size: 30px; font-weight: 700; line-height: 1.2; }
.zhpop .zp { font-size: 18px; font-weight: 800; display: flex; gap: 6px; flex-wrap: wrap; }
.zhpop .zg { color: var(--ink2); }
.zhpop .zb { display: flex; gap: 8px; flex-wrap: wrap; }
.zhpop button { font: inherit; font-size: 14px; font-weight: 800; min-height: 36px; padding: 0 12px; border-radius: 12px; border: 2px solid var(--line-d); background: var(--bg); color: var(--ink); box-shadow: 0 2px 0 var(--line-d); }
.zhpop button:disabled { color: var(--good); border-color: var(--good); box-shadow: none; }
.zt1 { color: var(--t1); } .zt2 { color: var(--t2); } .zt3 { color: var(--t3); } .zt4 { color: var(--t4); } .zt5 { color: var(--t5); }
`;
  document.head.appendChild(s);
}

function closePop() {
  pop?.remove(); pop = null;
  openWord?.classList.remove('on'); openWord?.removeAttribute('aria-expanded'); openWord = null;
}

function wire() {
  if (wired) return; wired = true;
  document.addEventListener('pointerdown', (e) => {
    if (!pop) return;
    if (!openWord?.isConnected || !(pop.contains(e.target) || openWord.contains(e.target))) closePop();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('resize', closePop);
  window.addEventListener('scroll', closePop, true);
}

function place() {
  const r = openWord.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 8;
  const left = Math.max(m, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - m));
  const below = r.bottom + 6 + h <= innerHeight - m;
  const top = below || r.top - 6 - h < m ? Math.min(r.bottom + 6, Math.max(m, innerHeight - h - m)) : r.top - 6 - h;
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
}

function openPop(node, word, { speak, onAddReview }) {
  closePop();
  openWord = node; node.classList.add('on'); node.setAttribute('aria-expanded', 'true');
  const [zh, py, en] = word;
  pop = document.createElement('div');
  pop.className = 'zhpop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', zh);
  const c = document.createElement('div'); c.className = 'zc'; c.textContent = zh;
  const p = document.createElement('div'); p.className = 'zp';
  for (const sy of syllables(py)) { const t = document.createElement('span'); t.className = 'zt' + toneOf(sy); t.textContent = sy; p.append(t); }
  pop.append(c, p);
  if (en) { const g = document.createElement('div'); g.className = 'zg'; g.textContent = en; pop.append(g); }
  const row = document.createElement('div'); row.className = 'zb';
  if (speak) { const b = document.createElement('button'); b.type = 'button'; b.textContent = '▶ Hear'; b.setAttribute('aria-label', 'Hear ' + zh); b.onclick = (e) => { e.stopPropagation(); speak(zh); }; row.append(b); }
  if (onAddReview) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Add to review';
    b.onclick = (e) => { e.stopPropagation(); onAddReview({ key: 'w:' + zh, zh, py, en: en || '' }); b.textContent = 'Added ✓'; b.disabled = true; };
    row.append(b);
  }
  if (row.children.length) pop.append(row);
  pop.style.visibility = 'hidden';
  document.body.append(pop);
  place();
  pop.style.visibility = '';
}

/** Word list for a line: line.w if present, else one chunk per character paired with py. */
function wordsOf(line) {
  if (Array.isArray(line.w) && line.w.length) return line.w;
  const syl = syllables(line.py || '');
  const han = [...line.zh].filter((c) => HAN.test(c)).length;
  let k = 0;
  return [...line.zh].map((c) => (HAN.test(c) ? [c, han === syl.length ? syl[k++] : '', ''] : [c]));
}

export function zhLine(line, { speak, onAddReview, cls = 'line-zh' } = {}) {
  injectCss(); wire();
  const root = document.createElement('span');
  root.className = `zhl ${cls}`;
  for (const word of wordsOf(line)) {
    if (!HAN.test(word[0]) || !word[1]) { root.append(document.createTextNode(word[0])); continue; }
    const n = document.createElement('span');
    n.className = 'zhw'; n.textContent = word[0];
    n.setAttribute('role', 'button'); n.tabIndex = 0;
    n.setAttribute('aria-label', `${word[0]}, ${word[1]}${word[2] ? ', ' + word[2] : ''}`);
    const toggle = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (openWord === n) closePop(); else openPop(n, word, { speak, onAddReview });
    };
    n.addEventListener('click', toggle);
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
    root.append(n);
  }
  return root;
}
