// Warm-up: up to 6 words, passed in by the Day screen (due reviews, day phrases, scene words). Say each one, get a tick or cross per syllable.
import { addFish, markStep, markWeek, todayKey, reviewPick, reviewMiss, reviewHit } from '../core/progress.js';
import { usable, update as updateVoice } from '../core/voice.js';
import { saveTake } from '../recordings.js';
import { syllables } from '../core/pinyin.js';
import { scoreWord } from '../core/syllables.js';
import { speak, mic } from '../speech.js';
import { drawCurve } from '../draw.js';
import { el, esc, shuffle } from '../ui.js';

const N = 6;

function buildItems(save, scenes) {
  const seen = new Set(), out = [];
  const add = (it) => { if (it && !seen.has(it.zh) && out.length < N) { seen.add(it.zh); out.push({ key: it.key || it.zh, zh: it.zh, py: it.py, en: it.en }); } };
  reviewPick(save, 2).filter((x) => x.due <= todayKey()).forEach(add);
  const work = shuffle(scenes.work.flatMap((s) => s.warmup)), life = shuffle(scenes.life.flatMap((s) => s.warmup));
  // alternate work / life, topping up from whatever is left
  for (let i = 0; out.length < N && (i < work.length || i < life.length); i++) { add(work[i]); add(life[i]); }
  return out;
}

export async function render(root, ctx, { items: given, day } = {}) {
  const { save } = ctx;
  const back = () => (day ? ctx.go('day', { n: day }) : ctx.go('home'));
  const items = given && given.length ? given : buildItems(save, await ctx.scenes());
  let i = 0, fish = 0;
  const best = items.map(() => 0);   // best syllable count per item, so retries cannot farm fish

  function show() {
    root.replaceChildren();
    if (i >= items.length) return finish();
    const it = items[i], syls = syllables(it.py);
    root.append(el(`<div class="top"><button class="link" id="x">${day ? '✕ Day ' + day : '✕ Home'}</button><span class="spacer"></span><span class="chip num">${i + 1} / ${items.length}</span><span class="pill num">🐟 ${fish}</span></div>`));
    root.querySelector('#x').onclick = back;
    const card = el(`<section class="card stack center">
      <div class="bigzh">${esc(it.zh)}</div>
      <div class="pys">${syls.map((s) => `<div class="syl"><b>${esc(s)}</b><span></span></div>`).join('')}</div>
      <p class="dim">${esc(it.en || '')}</p>
      <div class="canvaswrap hidden"><canvas></canvas></div>
      <p class="msg dim small" aria-live="polite"></p>
      <button class="btn ghost" id="play">▶ Hear it</button>
      <button class="btn coral big" id="rec">● Record</button>
      <div class="row"><button class="btn ghost sm spacer" id="retry" disabled>Retry</button><button class="btn sm spacer" id="next">${i === items.length - 1 ? 'Finish' : 'Next'}</button></div>
    </section>`);
    root.append(card);
    const $ = (s) => card.querySelector(s), msg = $('.msg'), cv = $('canvas'), wrap = $('.canvaswrap'), rec = $('#rec');
    let last = null;

    const draw = (k) => { const x = last.items[k]; wrap.classList.remove('hidden'); drawCurve(cv, x.res, x.expected, x.ok !== false, !!x.close); };
    $('#play').onclick = () => speak(it.zh, { rate: 0.8 });
    $('#next').onclick = () => { i++; show(); };
    $('#retry').onclick = () => { msg.className = 'msg dim small'; card.querySelectorAll('.syl').forEach((s) => { s.className = 'syl'; s.querySelector('span').textContent = ''; }); wrap.classList.add('hidden'); msg.textContent = ''; $('#retry').disabled = true; };

    rec.onclick = async () => {
      if (!mic.recording) {
        try { await mic.startRecord(); } catch (e) { msg.textContent = 'The mic is blocked (' + (e.name || 'error') + '). Allow it in Safari settings for this site.'; return; }
        rec.textContent = '■ Stop'; msg.textContent = 'Listening… say it once, then stop.';
        return;
      }
      rec.textContent = '● Record';
      const { samples, sr } = mic.stopRecord();
      const r = scoreWord(samples, sr, it.zh, it.py, { profile: usable(save) });
      $('#retry').disabled = false;
      if (!r.ok) { msg.textContent = r.why || 'Could not hear a voice. Try again, a bit closer to the mic.'; return; }
      last = r;
      if (save.voice && save.voice.calibrated && r.frames.length) save.voice = updateVoice(save.voice, r.frames);   // only calibrated profiles are used, so only they follow the voice
      if (save.settings.keepRecordings) saveTake(samples, sr, { time: Date.now(), zh: it.zh, py: it.py, expected: r.items.map((x) => x.expected), heard: r.items.map((x) => x.heard), scores: r.items.map((x) => x.scores) });
      const scored = r.items.filter((x) => x.ok !== null), good = scored.filter((x) => x.ok).length;
      card.querySelectorAll('.syl').forEach((s, k) => {
        const x = r.items[k]; if (!x) return;
        s.className = 'syl ' + (x.ok === null ? 'na' : x.close ? 'close' : x.ok ? 'ok' : 'no');
        s.querySelector('span').textContent = x.ok === null ? '·' : x.ok ? '✓' : '✗';
        s.onclick = () => draw(k);
      });
      const closeOnes = r.items.filter((x) => x.close);
      msg.className = 'msg small ' + (closeOnes.length ? 'amber' : 'dim');
      const firstBad = r.items.findIndex((x) => x.ok === false);
      draw(firstBad >= 0 ? firstBad : Math.max(0, r.items.findIndex((x) => x.ok)));
      const gain = Math.max(0, good - best[i]); best[i] = Math.max(best[i], good);
      if (gain) { addFish(save, gain); fish += gain; }
      if (scored.length && good === scored.length) { reviewHit(save, it.key); msg.textContent = (closeOnes.length ? 'Every tone passed. ' : 'Lovely! Every tone landed.') + (gain ? ` +${gain} fish` : ''); }
      else {
        reviewMiss(save, it);
        if (!ctx.session.added.some((a) => a.zh === it.zh)) ctx.session.added.push(it);
        const bad = r.items[firstBad];
        msg.textContent = bad ? `Close! "${bad.syl}" should be tone ${bad.expected}, I heard tone ${bad.heard}. Tap a syllable to see its curve.` + (gain ? ` +${gain} fish` : '') : 'Nearly there. Try once more.';
      }
      if (closeOnes.length) msg.textContent += ' ' + closeOnes.map((x) => `close: sounded a bit like tone ${x.heard} (${x.syl}, wanted ${x.expected})`).join('; ') + '.';
      ctx.persist();
    };
  }

  function finish() {
    markStep(save, todayKey(), 'warmup');
    if (day) markWeek(save, day, 'warmup');
    ctx.persist();
    root.append(el(`<section class="card good center stack"><div class="bigzh" style="font-size:48px">做得好!</div><h2>Warm-up done</h2>
      <p>+${fish} fish. ${ctx.session.added.length ? `${ctx.session.added.length} word${ctx.session.added.length === 1 ? '' : 's'} will come back for another go.` : fish ? 'Not a single wobble.' : 'Nothing was recorded, so the cats of Singapore are mildly curious.'}</p></section>`));
    const b = el('<button class="btn big block">Continue</button>');
    b.onclick = () => ctx.go('debrief', { kind: 'warmup', fish, day });
    root.append(b);
  }
  show();
}
