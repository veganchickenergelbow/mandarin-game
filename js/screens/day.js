// Day screen: the skill card (function phrases, tappable words + hear), then the 3 steps. Each step ticks when done.
import { dayStep, dayDone, currentDay, reviewMiss } from '../core/progress.js';
import { warmupItems } from '../core/week.js';
import { el, esc } from '../ui.js';
import { zhLine } from '../ui/zh.js';
import { speak } from '../speech.js';

export async function render(root, ctx, { n }) {
  const { save } = ctx;
  const week = await ctx.week(), scenes = await ctx.scenes();
  const day = week.days.find((d) => d.day === n);
  if (!day) return ctx.go('home');
  const work = scenes.byId[day.work], life = scenes.byId[day.life];

  root.append(el(`<div class="top"><button class="link" id="x">✕ Home</button><span class="spacer"></span><span class="chip num">Day ${day.day} / ${week.days.length}</span></div>`));
  root.querySelector('#x').onclick = () => ctx.go('home');

  const sk = el(`<section class="card stack"><div class="center stack"><div class="bigzh" style="font-size:40px">${esc(day.skill.zh)}</div><h2>${esc(day.skill.en)}</h2></div></section>`);
  for (const p of day.phrases) {
    const row = el('<div class="phrase"><div class="stack spacer" style="gap:2px"><div class="z"></div><span class="dim small">' + esc(p.en) + '</span></div><button class="btn ghost sm" aria-label="Hear phrase">▶</button></div>');
    row.querySelector('.z').append(zhLine(p, { speak: (t) => speak(t, { rate: 0.85 }), onAddReview: (it) => { reviewMiss(save, it); ctx.persist(); } }));
    row.querySelector('button').onclick = () => speak(p.zh, { rate: 0.85 });
    sk.append(row);
  }
  root.append(sk);

  const steps = [
    { key: 'warmup', icon: '🎵', title: 'Warm-up', sub: 'Up to 6 words, 1 fish per right tone', go: () => ctx.go('warmup', { day: day.day, items: warmupItems(save, day, [work, life].filter(Boolean)) }) },
    ...[[work, 'work', '💼'], [life, 'life', '🍜']].filter(([s]) => s).map(([s, key, icon]) => ({
      key, icon, title: s.title.en, sub: `${s.title.zh} · ${s.character.name}`, go: () => ctx.go('scene', { id: s.id, day: day.day }),
    })),
  ];
  const card = el('<section class="card stack"><h2>Today\'s steps</h2></section>');
  for (const s of steps) {
    const ok = dayStep(save, day, s.key);
    const b = el(`<button class="step${ok ? ' done' : ''}"><span class="tick">${ok ? '✓' : ''}</span>
      <span style="flex:1"><b>${s.icon} ${esc(s.title)}</b><br><span class="dim small zh">${esc(s.sub)}</span></span></button>`);
    b.onclick = s.go;
    card.append(b);
  }
  root.append(card);

  if (dayDone(save, day)) {
    const last = day.day === week.days.length, wk = currentDay(save, week.days) > week.days.length;
    root.append(el(`<section class="card good center stack"><div class="bigzh" style="font-size:40px">${wk && last ? '第一周完成!' : '做得好!'}</div><b>${wk && last ? 'Week 1 complete' : `Day ${day.day} complete`}</b>
      <p class="dim small">${last ? 'Replay any day whenever you like.' : `Day ${day.day + 1} is unlocked.`}</p></section>`));
  }
}
