// Home: date, fish, streak, and the Today card with 3 steps.
import { todayKey, stepsDone, streak, rung } from '../core/progress.js';
import { el, esc } from '../ui.js';

export async function render(root, ctx) {
  const { save } = ctx;
  const day = todayKey();
  const scenes = await ctx.scenes();
  const work = scenes.work[0], life = scenes.life[0];   // one of each for now
  const done = stepsDone(save, day);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  root.append(el(`<div class="hero"><div class="glyph">你好</div><h1>Mandarin Game</h1><p class="dim">${esc(date)}</p></div>`));
  root.append(el(`<div class="row" style="justify-content:center">
    <span class="pill" title="Fish">🐟 <span class="num">${save.fish}</span></span>
    <span class="pill" title="Streak">🔥 <span class="num">${streak(save, day)}</span> day${streak(save, day) === 1 ? '' : 's'}</span></div>`));

  const steps = [
    { key: 'warmup', icon: '🎵', title: 'Tone warm-up', sub: '6 words, 1 fish per right tone', go: () => ctx.go('warmup') },
    ...[[work, 'work', '💼'], [life, 'life', '🍜']].filter(([s]) => s).map(([s, key, icon]) => ({
      key, icon, title: s.title.en, sub: `${s.title.zh} · ${s.character.name}`, badge: `Rung ${rung(save, s.id)}`, go: () => ctx.go('scene', { id: s.id }),
    })),
  ];
  const card = el('<section class="card stack"><h2>Today</h2></section>');
  for (const s of steps) {
    const b = el(`<button class="step${done[s.key] ? ' done' : ''}">
      <span class="tick">${done[s.key] ? '✓' : ''}</span>
      <span style="flex:1"><b>${s.icon} ${esc(s.title)}</b><br><span class="dim small zh">${esc(s.sub)}</span></span>
      ${s.badge ? `<span class="chip">${s.badge}</span>` : ''}</button>`);
    b.onclick = s.go;
    card.append(b);
  }
  root.append(card);

  const set = el(`<section class="card stack"><h3>Settings</h3>
    <label class="switch"><input type="checkbox" id="py" ${save.settings.pinyin ? 'checked' : ''}> Show pinyin in scenes</label>
    <a href="tone-test.html">Open the tone test</a></section>`);
  set.querySelector('#py').onchange = (e) => { save.settings.pinyin = e.target.checked; ctx.persist(); };
  root.append(set);
}
