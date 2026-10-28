// Home: date, fish, streak, and the Today card with 3 steps.
import { todayKey, stepsDone, streak, rung } from '../core/progress.js';
import { el, esc } from '../ui.js';
import { countTakes, clearTakes, buildFiles, shareFiles } from '../recordings.js';

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

  if (!(save.voice && save.voice.calibrated) && !save.settings.calDismissed) {
    const c = el(`<section class="card cal stack"><b>Teach the app your voice</b>
      <p class="dim small">Count 一 to 十 once (10 seconds) so tone 3 can be heard as the low one for you.</p>
      <div class="row"><button class="btn sm spacer" id="cal">Calibrate</button><button class="btn ghost sm spacer" id="later">Not now</button></div></section>`);
    c.querySelector('#cal').onclick = () => ctx.go('calibrate');
    c.querySelector('#later').onclick = () => { save.settings.calDismissed = true; ctx.persist(); c.remove(); };
    root.append(c);
  }

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
    <button class="btn ghost sm" id="recal">Recalibrate (someone else is playing)</button>
    <label class="switch"><input type="checkbox" id="keep" ${save.settings.keepRecordings ? 'checked' : ''}> Keep my last 20 recordings</label>
    <div class="row"><button class="btn ghost sm spacer" id="exp">Export recordings</button><button class="btn ghost sm spacer" id="del">Delete saved recordings</button></div>
    <p class="dim small" id="recmsg" aria-live="polite"></p><div class="stack" id="links"></div>
    <a href="tone-test.html">Open the tone test</a></section>`);
  set.querySelector('#py').onchange = (e) => { save.settings.pinyin = e.target.checked; ctx.persist(); };
  root.append(set);
  const $ = (q) => set.querySelector(q), rm = $('#recmsg');
  $('#recal').onclick = () => ctx.go('calibrate');
  $('#keep').onchange = (e) => { save.settings.keepRecordings = e.target.checked; ctx.persist(); };
  countTakes().then((n) => { if (n) rm.textContent = `${n} saved recording${n === 1 ? '' : 's'}.`; });
  $('#exp').onclick = async () => {
    const files = await buildFiles();
    if (!files.length) { rm.textContent = 'Nothing saved yet. Turn on "Keep my last 20 recordings" and do a warm-up.'; return; }
    if (await shareFiles(files)) { rm.textContent = 'Shared.'; return; }
    const links = $('#links'); links.replaceChildren();
    for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.textContent = '⬇ ' + f.name; links.append(a); }
    rm.textContent = 'Tap each link to download it.';
  };
  $('#del').onclick = async () => { if (!confirm('Delete all saved recordings?')) return; rm.textContent = (await clearTakes()) ? 'Deleted.' : 'Could not delete (storage unavailable).'; $('#links').replaceChildren(); };
}
