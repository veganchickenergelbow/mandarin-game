// Home: date, fish, streak, words due, and the Week 1 strip of day cards.
import { todayKey, streak, reviewDue, currentDay, dayDone, dayUnlocked } from '../core/progress.js';
import { el, esc } from '../ui.js';
import { countTakes, clearTakes, buildFiles, shareFiles } from '../recordings.js';

export async function render(root, ctx) {
  const { save } = ctx;
  const day = todayKey();
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

  const due = reviewDue(save, day).length;
  if (due) root.append(el(`<div class="row" style="justify-content:center"><span class="pill" title="Review">📚 <span class="num">${due}</span> word${due === 1 ? '' : 's'} due</span></div>`));

  const week = await ctx.week();
  const cur = currentDay(save, week.days), all = cur > week.days.length;
  const sec = el(`<section class="card stack"><div class="row between"><h2>${esc(week.title.en)}</h2><span class="chip num">${week.days.filter((d) => dayDone(save, d)).length} / ${week.days.length} done</span></div><div class="strip"></div></section>`);
  const strip = sec.querySelector('.strip');
  for (const d of week.days) {
    const fin = dayDone(save, d), open = dayUnlocked(save, week.days, d.day), isCur = d.day === cur;
    const b = el(`<button class="day${fin ? ' done' : ''}${isCur ? ' cur' : ''}${open ? '' : ' next'}">
      <span class="dn"><span>Day ${d.day}</span><span>${fin ? '✓' : isCur ? '▶' : '🔒'}</span></span>
      <b class="sk zh">${esc(d.skill.zh)}</b><span class="dim small">${esc(d.skill.en)}</span>
      ${open ? '' : '<span class="chip">next</span>'}</button>`);
    b.onclick = () => (open ? ctx.go('day', { n: d.day }) : ctx.toast(`Finish Day ${cur} first`));
    strip.append(b);
  }
  if (all) sec.append(el('<div class="card good center stack"><div class="bigzh" style="font-size:40px">第一周完成!</div><b>Week 1 complete</b><p class="dim small">Tap any day to replay it. Scenes pick new twists and moods each time.</p></div>'));
  root.append(sec);
  strip.querySelector('.cur')?.scrollIntoView?.({ block: 'nearest', inline: 'start' });
  const cb = el('<button class="btn ghost block">👥 Characters</button>');
  cb.onclick = () => ctx.go('characters');
  root.append(cb);

  const set = el(`<section class="card stack"><h3>Settings</h3>
    <label class="switch"><input type="checkbox" id="py" ${save.settings.pinyin ? 'checked' : ''}> Show pinyin in scenes</label>
    <label class="switch"><input type="checkbox" id="hard" ${save.settings.hardMoods !== false ? 'checked' : ''}> Harder moods for trusted characters</label>
    <button class="btn ghost sm" id="recal">Recalibrate (someone else is playing)</button>
    <label class="switch"><input type="checkbox" id="keep" ${save.settings.keepRecordings ? 'checked' : ''}> Keep my last 20 recordings</label>
    <div class="row"><button class="btn ghost sm spacer" id="exp">Export recordings</button><button class="btn ghost sm spacer" id="del">Delete saved recordings</button></div>
    <p class="dim small" id="recmsg" aria-live="polite"></p><div class="stack" id="links"></div>
    <a href="tone-test.html">Open the tone test</a></section>`);
  set.querySelector('#py').onchange = (e) => { save.settings.pinyin = e.target.checked; save.settings.pinyinSet = true; ctx.persist(); };
  set.querySelector('#hard').onchange = (e) => { save.settings.hardMoods = e.target.checked; ctx.persist(); };
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
