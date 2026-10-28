// Debrief: what happened this round, fish earned, review items, and a Next button.
import { dayStep, reviewMiss } from '../core/progress.js';
import { warmupItems } from '../core/week.js';
import { el, esc, pyHtml, hearts } from '../ui.js';
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

  if (isScene && log.trust) {
    const t = log.trust, a = t.after || t.before, line = t.gained > 0 ? `${esc(log.char)} trusts you more ❤️` : t.moved < 0 ? `${esc(log.char)} trusted you a little less this time` : t.moved > 0 ? `${esc(log.char)} is warming to you` : `Trust with ${esc(log.char)}`;
    root.append(el(`<section class="card ${t.gained > 0 ? 'good' : ''} stack center"><b>${line}</b><span class="hearts">${hearts(a.hearts)}</span><span class="dim small">${a.hearts >= 5 ? 'Fully trusted' : `${a.p} / 5 to the next heart`}</span></section>`));
  }

  const rv = el('<section class="card stack"><h3>Added to review</h3></section>');
  if (added.length) added.forEach((a) => rv.append(el(`<div><span class="zh line-zh">${esc(a.zh)}</span> <span class="dim small">${esc(a.py)} · ${esc(a.en || '')}</span></div>`)));
  else rv.append(el('<p class="dim">Nothing yet. The review deck is feeling very relaxed.</p>'));
  root.append(rv);

  // Next: the first undone step of this day, else back to the day (or Home).
  const week = log.day ? await ctx.week() : null, dd = week && week.days.find((d) => d.day === log.day);
  const scenes = await ctx.scenes();
  const nextStep = dd && ['warmup', 'work', 'life'].find((k) => !dayStep(save, dd, k) && (k === 'warmup' || scenes.byId[dd[k]]));
  const label = { warmup: 'Next: warm-up', work: 'Next: work scene', life: 'Next: life scene' }[nextStep] || (dd ? `Back to Day ${dd.day}` : 'Back to Home');
  const b = el(`<button class="btn big block">${label}</button>`);
  b.onclick = () => (nextStep === 'warmup' ? ctx.go('warmup', { day: dd.day, items: warmupItems(save, dd, [scenes.byId[dd.work], scenes.byId[dd.life]].filter(Boolean)) })
    : nextStep ? ctx.go('scene', { id: dd[nextStep], day: dd.day }) : dd ? ctx.go('day', { n: dd.day }) : ctx.go('home'));
  root.append(b);
  if (nextStep || dd) { const h = el('<button class="btn ghost block">Home</button>'); h.onclick = () => ctx.go('home'); root.append(h); }
}
