// Characters: everyone you have met, with hearts, scenes played and best rung.
import { trustOf, rung } from '../core/progress.js';
import { charId } from '../core/week.js';
import { el, esc, hearts } from '../ui.js';

export async function render(root, ctx) {
  const { save } = ctx;
  const scenes = await ctx.scenes(), all = [...scenes.work, ...scenes.life];
  root.append(el('<div class="top"><button class="link" id="x">✕ Home</button><span class="spacer"></span><h1>Characters</h1></div>'));
  root.querySelector('#x').onclick = () => ctx.go('home');
  const by = new Map();
  for (const sc of all) { const id = charId(sc); if (!by.has(id)) by.set(id, { c: sc.character, scenes: [] }); by.get(id).scenes.push(sc); }
  const met = [...by.entries()].filter(([id, g]) => save.trust[id] || g.scenes.some((s) => save.played[s.id]));
  if (!met.length) root.append(el('<section class="card center stack"><div class="bigzh" style="font-size:40px">👋</div><p class="dim">Nobody yet. Play a scene to meet your first character.</p></section>'));
  for (const [id, g] of met) {
    const t = trustOf(save, id), played = g.scenes.filter((s) => save.played[s.id]);
    const best = played.reduce((m, s) => Math.max(m, rung(save, s.id)), 0);
    root.append(el(`<section class="card stack"><div class="row"><div style="font-size:36px">${g.scenes[0].track === 'work' ? '💼' : '🍜'}</div>
      <div><h2 class="zh">${esc(g.c.name)}</h2><p class="dim small">${esc(g.c.role)}</p></div></div>
      <div class="row between"><span class="hearts" aria-label="${t.hearts} of 5 hearts">${hearts(t.hearts)}</span><span class="dim small">${t.hearts >= 5 ? 'Fully trusted' : `${t.p} / 5 to the next heart`}</span></div>
      <div class="row wrap"><span class="chip">${played.length} scene${played.length === 1 ? '' : 's'} played</span><span class="chip">Best rung ${best || '-'}</span>${t.hearts >= 3 && save.settings.hardMoods !== false ? '<span class="chip">⏱ Hurried by default</span>' : ''}</div></section>`));
  }
}
