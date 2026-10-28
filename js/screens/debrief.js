// Debrief: what happened this round, fish earned, review items, and a Next button.
import { todayKey, stepsDone, reviewMiss } from '../core/progress.js';
import { el, esc, pyHtml } from '../ui.js';
import { zhLine } from '../ui/zh.js';
import { speak } from '../speech.js';

const VERDICT = { fit: 'Great fit', generic: 'A bit generic', off: 'Off the mark', blunt: 'Rather blunt', cave: 'Giving in too fast' };

export async function render(root, ctx, log = {}) {
  const { save } = ctx;
  const pinyin = save.settings.pinyin;
  const isScene = log.kind === 'scene';
  const added = ctx.session.added;
  const tz = (line) => zhLine(line, { cls: 'zh', speak: (t) => speak(t, { rate: 0.9 }), onAddReview: (it) => { reviewMiss(save, it); ctx.persist(); } });

  root.append(el(`<div class="hero"><div class="glyph">${isScene ? '辛苦了' : '好样的'}</div><h1>${isScene ? esc(log.title.en) : 'Warm-up'} done</h1>
    <p class="dim">${isScene ? `Rung ${log.rung} · ${log.mood} mood · ${esc(log.twist)}` : 'Tones, warmed.'}</p></div>`));
  root.append(el(`<div class="row" style="justify-content:center"><span class="pill">🐟 +<span class="num">${log.fish || 0}</span></span><span class="pill">Total <span class="num">${save.fish}</span></span></div>`));

  if (isScene && log.turns.length) {
    const list = el('<section class="card stack"><h3>Turn by turn</h3></section>');
    log.turns.forEach((t, i) => {
      if (log.rung === 1) {
        const row = el(`<div class="stack" style="border-top:2px solid var(--line);padding-top:10px">
          <b class="small dim">Turn ${i + 1}: ${esc(t.npc.en)}</b>
          <div>Your pick: <span class="pk"></span> <span class="chip ${t.verdict || ''}">${VERDICT[t.verdict] || 'skipped'}</span></div>
          <div>Better reply: <span class="bt"></span>${pyHtml(t.fit.py, pinyin)}</div>
          <div>Said OK: <b>${t.said ? 'yes ✓' : 'not yet'}</b></div></div>`);
        if (t.pick) row.querySelector('.pk').append(tz(t.pick)); else row.querySelector('.pk').textContent = '—';
        row.querySelector('.bt').append(tz(t.fit));
        list.append(row);
      } else {
        const ex = t.intent.example;
        const row = el(`<div class="stack" style="border-top:2px solid var(--line);padding-top:10px">
          <b class="small dim">Turn ${i + 1}: ${esc(t.intent.en)}</b>
          <div>Key bits: <b>${t.hit ? 'all hit ✓' : 'some missed'}</b></div>
          <div>Example: <span class="ex"></span>${pyHtml(ex.py, pinyin)}</div></div>`);
        row.querySelector('.ex').append(tz(ex));
        list.append(row);
      }
    });
    root.append(list);
  } else if (isScene && log.rating) {
    root.append(el(`<section class="card stack"><h3>Free talk</h3><p>You rated it: <b>${esc(log.rating)}</b>.</p>${log.notes ? `<p class="dim">Notes: ${esc(log.notes)}</p>` : ''}</section>`));
  }

  const rv = el('<section class="card stack"><h3>Added to review</h3></section>');
  if (added.length) added.forEach((a) => rv.append(el(`<div><span class="zh line-zh">${esc(a.zh)}</span> <span class="dim small">${esc(a.py)} · ${esc(a.en || '')}</span></div>`)));
  else rv.append(el('<p class="dim">Nothing yet. The review deck is feeling very relaxed.</p>'));
  root.append(rv);

  // Next: the first undone Today step, else Home.
  const done = stepsDone(save, todayKey());
  const scenes = await ctx.scenes();
  const nextStep = ['warmup', 'work', 'life'].find((k) => !done[k] && (k === 'warmup' || scenes[k][0]));
  const label = { warmup: 'Next: tone warm-up', work: 'Next: work scene', life: 'Next: life scene' }[nextStep] || 'Back to Home';
  const b = el(`<button class="btn big block">${label}</button>`);
  b.onclick = () => (nextStep === 'warmup' ? ctx.go('warmup') : nextStep ? ctx.go('scene', { id: scenes[nextStep][0].id }) : ctx.go('home'));
  root.append(b);
  if (nextStep) { const h = el('<button class="btn ghost block">Home</button>'); h.onclick = () => ctx.go('home'); root.append(h); }
}
