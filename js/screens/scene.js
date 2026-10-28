// Scene engine (work + life). Rung 1: pick then say. Rung 2: say it your way. Rung 3: free talk with ChatGPT voice.
import { addFish, markStep, todayKey, rung as rungOf, recordRung, reviewMiss } from '../core/progress.js';
import { similarity, intentCheck } from '../core/match.js';
import { speak, listen } from '../speech.js';
import { el, esc, pyHtml, shuffle, pickOne } from '../ui.js';
import { zhLine } from '../ui/zh.js';

const PASS = 0.7;
const half = (n) => Math.max(1, Math.floor(n / 2));
const VERDICT = { fit: 'Great fit', generic: 'A bit generic', off: 'Off the mark', blunt: 'Rather blunt', cave: 'Giving in too fast' };

export async function render(root, ctx, { id }) {
  const { save } = ctx;
  const sc = await (await fetch(`data/scenes/${id}.json`)).json();
  const mood = pickOne(['patient', 'hurried']), twist = pickOne(sc.twists);
  const unlocked = rungOf(save, id), py = () => save.settings.pinyin;
  const log = { kind: 'scene', id, title: sc.title, mood, twist: twist.en, rung: unlocked, turns: [], fish: 0 };
  const award = (n) => { addFish(save, n); log.fish += n; ctx.persist(); return n; };
  const rate = mood === 'hurried' ? 1.05 : 0.9;
  const tz = (line, r = 0.9) => zhLine(line, { speak: (t) => speak(t, { rate: r }), onAddReview: (it) => { reviewMiss(save, it); ctx.persist(); } });
  const npcLine = (t, i) => { const l = i === 1 ? twist.turn2 : t.npc; return (mood === 'hurried' && l.hurried) || l; };
  const header = (back) => { const h = el('<div class="top"><button class="link" id="x">✕ Home</button></div>'); h.firstChild.onclick = () => ctx.go('home'); return h; };

  // ---------- intro ----------
  let chosen = unlocked;
  root.append(header());
  root.append(el(`<section class="card stack"><div class="row"><div style="font-size:40px">${sc.track === 'work' ? '💼' : '🍜'}</div>
    <div><h2>${esc(sc.character.name)}</h2><p class="dim small">${esc(sc.character.role)}</p></div>
    <span class="spacer"></span><span class="chip">${mood === 'hurried' ? '⏱ Hurried' : '☕ Patient'}</span></div>
    <p>${esc(sc.character.en)}</p><p class="dim small"><b>Your goal:</b> ${esc(sc.goal)}</p></section>`));
  const pick = el('<section class="card stack"><h3>Choose your rung</h3><div class="row wrap"></div><p class="dim small" id="rd"></p></section>');
  const names = { 1: 'Pick, then say it', 2: 'Say it your way', 3: 'Free talk' };
  const rb = pick.querySelector('.row'), rd = pick.querySelector('#rd');
  const paintRungs = () => { rb.replaceChildren(...[1, 2, 3].map((n) => { const b = el(`<button class="btn sm ${n === chosen ? '' : 'ghost'}" ${n > unlocked ? 'disabled' : ''}>${n > unlocked ? '🔒 ' : ''}${n}</button>`); b.onclick = () => { chosen = n; paintRungs(); }; return b; })); rd.textContent = `Rung ${chosen}: ${names[chosen]}`; };
  paintRungs();
  root.append(pick);
  const go = el('<button class="btn big block">Start</button>');
  go.onclick = () => (chosen === 3 ? rung3() : turns(chosen));
  root.append(go);

  // ---------- shared: speak or type ----------
  // Renders a "Say it" button into box. onText(text) gets the speech (or typed) text; onSaid() is the self-check fallback.
  function capture(box, { onText, onSaid, reward }) {
    box.replaceChildren();
    const live = el('<div class="live dim" aria-live="polite"></div>');
    const btn = el('<button class="btn coral block">🎤 Say it</button>');
    const fb = el('<div class="stack hidden"></div>');
    box.append(btn, live, fb);
    const fallback = (why) => {
      live.textContent = why ? `I couldn't listen (${why}).` : '';
      fb.classList.remove('hidden');
      fb.replaceChildren(el('<input type="text" class="zh" placeholder="Type it in Chinese" aria-label="Type it in Chinese" autocomplete="off">'),
        el('<div class="row"><button class="btn sm spacer" id="t">Check typed</button><button class="btn ghost sm spacer" id="s">I said it</button></div>'));
      fb.querySelector('#t').onclick = () => { const v = fb.querySelector('input').value.trim(); if (v) onText(v); };
      fb.querySelector('#s').onclick = () => onSaid(half(reward));
    };
    btn.onclick = async () => {
      btn.disabled = true; live.textContent = 'Listening…';
      try { const t = await listen({ onInterim: (s) => { live.textContent = s; } }); btn.disabled = false; live.textContent = t; onText(t); }
      catch (e) { btn.disabled = false; fallback(String(e)); }
    };
    return { fallback };
  }

  const npcCard = (line, i, n) => {
    const c = el(`<section class="card stack"><div class="row between"><span class="chip num">Turn ${i + 1} / ${n}</span><button class="btn ghost sm" id="p">▶ Hear</button></div>
      <div id="zhs"></div>${pyHtml(line.py, py())}
      <button class="link" id="en" style="text-align:left">Tap for English</button></section>`);
    c.querySelector('#zhs').append(tz(line, rate));
    c.querySelector('#p').onclick = () => speak(line.zh, { rate });
    const en = c.querySelector('#en'); en.onclick = () => { en.textContent = line.en; en.style.textDecoration = 'none'; en.style.color = 'inherit'; };
    speak(line.zh, { rate });
    return c;
  };
  const replyHtml = (r) => `<div class="rz"></div>${pyHtml(r.py, py())}<p class="dim small">${esc(r.en)}</p>`;
  const fillReply = (card, r) => card.querySelector('.rz').append(tz(r, 0.85));
  const nextBtn = (label, fn) => { const b = el(`<button class="btn big block">${label}</button>`); b.onclick = fn; return b; };

  // ---------- rungs 1 and 2 ----------
  function turns(r) {
    log.rung = r;
    let i = 0, ok = 0;
    const n = sc.turns.length;
    const step = () => {
      if (i >= n) return finish(r, ok / n);
      root.replaceChildren(header());
      const t = sc.turns[i], rec = { npc: npcLine(t, i), pick: null, verdict: null, fit: t.options.find((o) => o.type === 'fit'), said: false, intent: t.intent, hit: null };
      log.turns.push(rec);
      root.append(npcCard(rec.npc, i, n));
      const area = el('<div class="stack"></div>');
      root.append(area);
      const done = (good) => { if (good) ok++; area.append(nextBtn(i === n - 1 ? 'Finish' : 'Next', () => { i++; step(); })); };
      (r === 1 ? rung1 : rung2)(t, rec, area, done, i);
    };
    step();
  }

  function rung1(t, rec, area, done) {
    const opts = el('<div class="stack"><p class="dim small">What do you say? Tap a word to see its pinyin.</p></div>');
    area.append(opts);
    const buttons = shuffle(t.options).map((o) => {
      const b = el(`<button class="opt"><span class="oz"></span>${py() ? `<span class="dim small">${esc(o.py)}</span>` : ''}<span class="dim small">${esc(o.en)}</span></button>`);
      b.querySelector('.oz').replaceWith(tz(o));
      b.onclick = () => choose(o, b);
      opts.append(b); return b;
    });
    function choose(o, b) {
      buttons.forEach((x) => { x.disabled = true; });
      b.classList.add('picked');
      rec.pick = o; rec.verdict = o.type;
      const gain = o.type === 'fit' ? award(2) : 0;
      area.append(el(`<div class="card ${o.type === 'fit' ? 'good' : 'warn'} stack"><div class="row"><span class="chip ${o.type}">${VERDICT[o.type] || o.type}</span>${gain ? `<span class="chip">+${gain} 🐟</span>` : ''}</div><p>${esc(o.why)}</p></div>`));
      const say = el(`<section class="card stack"><h3>Now say it</h3>${replyHtml(rec.fit)}<button class="btn ghost sm" id="h">▶ Hear it</button><div class="box stack"></div></section>`);
      fillReply(say, rec.fit);
      say.querySelector('#h').onclick = () => speak(rec.fit.zh, { rate: 0.85 });
      area.append(say);
      const box = say.querySelector('.box');
      let tries = 0, over = false;
      const finishSay = (good, gained, text) => {
        if (over) return; over = true;
        rec.said = good;
        box.replaceChildren(el(`<div class="card ${good ? 'good' : 'warn'}"><b>${text}</b>${gained ? ` <span class="chip">+${gained} 🐟</span>` : ''}</div>`));
        done(good && o.type === 'fit');
      };
      capture(box, {
        reward: 2,
        onText: (txt) => {
          const s = similarity(txt, rec.fit.zh);
          if (s >= PASS) return finishSay(true, award(2), `✓ Nicely said! (${Math.round(s * 100)}% match)`);
          if (++tries >= 2) return finishSay(false, 0, `Heard "${esc(txt)}". Not quite, but that's what practice is for.`);
          box.querySelector('.hint')?.remove();
          box.prepend(el(`<p class="hint dim">Heard "${esc(txt)}" (${Math.round(s * 100)}%). One more go?</p>`));
        },
        onSaid: (g) => finishSay(true, award(g), 'Self-checked. Honesty is a fine ingredient.'),
      });
    }
  }

  function rung2(t, rec, area, done, idx) {
    const groups = [...t.intent.groups, ...(idx === 1 && twist.group ? [twist.group] : [])];
    const card = el(`<section class="card stack"><h3>Say it your way</h3><p><b>${esc(t.intent.en)}</b></p><div class="box stack"></div></section>`);
    area.append(card);
    const box = card.querySelector('.box');
    let over = false;
    const finishIt = (good, gained, res) => {
      if (over) return; over = true;
      rec.hit = good; rec.said = good;
      const ex = t.intent.example;
      const list = res ? groups.map((g, k) => `<div>${res.hit.includes(k) ? '✓' : '✗'} <span class="zh">${esc(g[0])}</span></div>`).join('') : '';
      box.replaceChildren(el(`<div class="card ${good ? 'good' : 'warn'} stack"><b>${good ? 'All the key bits landed!' : 'Some key bits are still missing.'}</b>${gained ? `<span class="chip">+${gained} 🐟</span>` : ''}${list}</div>`));
      const exCard = el(`<section class="card stack"><h3>One way to say it</h3>${replyHtml(ex)}<button class="btn ghost sm" id="h">▶ Hear it</button></section>`);
      fillReply(exCard, ex); area.append(exCard);
      area.querySelector('#h').onclick = () => speak(ex.zh, { rate: 0.85 });
      done(good);
    };
    capture(box, {
      reward: 3,
      onText: (txt) => { const res = intentCheck(txt, groups); res.allHit ? finishIt(true, award(3), res) : finishIt(false, 0, res); },
      onSaid: (g) => finishIt(true, award(g), null),
    });
  }

  // ---------- rung 3 ----------
  function rung3() {
    log.rung = 3;
    root.replaceChildren(header());
    const prompt = `You are role-playing ${sc.character.name}, ${sc.character.role}. ${sc.character.en}\n` +
      `I am practising Mandarin. My goal in this conversation: ${sc.goal}\n` +
      `Your hidden objection or twist, which you bring up naturally: ${twist.prompt || twist.en}\n` +
      `Mood: ${mood}.\n` +
      `Speak only Mandarin at HSK 3-4 level, in short sentences, in a Singapore context. Stay in character, and wait for my reply after each line. Do not translate unless I ask.\n` +
      `At the end of the conversation, give me 3 corrections in English.`;
    const card = el(`<section class="card stack"><h2>Free talk</h2><p class="dim">Open ChatGPT voice mode, paste this, and talk it through. ${esc(twist.en)}</p>
      <textarea readonly aria-label="Role-play prompt"></textarea><button class="btn big block" id="c">📋 Copy prompt</button></section>`);
    const ta = card.querySelector('textarea'); ta.value = prompt;
    card.querySelector('#c').onclick = async () => {
      try { await navigator.clipboard.writeText(prompt); ctx.toast('Copied! Paste it into ChatGPT voice.'); }
      catch { ta.focus(); ta.select(); ctx.toast('Copy failed. Select the text and copy it by hand.'); }
    };
    root.append(card);
    const rate3 = el(`<section class="card stack"><h3>How did it go?</h3><div class="stack">
      <button class="btn" data-n="5">Went well (+5)</button><button class="btn yellow" data-n="3">OK (+3)</button><button class="btn lav" data-n="1">Struggled (+1)</button></div>
      <input type="text" id="notes" placeholder="Notes (optional): what tripped you up?" autocomplete="off"></section>`);
    rate3.querySelectorAll('[data-n]').forEach((b) => {
      b.onclick = () => {
        const n = +b.dataset.n, notes = rate3.querySelector('#notes').value.trim();
        award(n); log.rating = { 5: 'went well', 3: 'OK', 1: 'struggled' }[n]; log.notes = notes;
        if (notes) { (save.notes = save.notes || []).push({ day: todayKey(), id, notes }); }
        finish(3, n >= 3 ? 1 : 0.5);
      };
    });
    root.append(rate3);
  }

  function finish(r, ratio) {
    recordRung(save, id, r, ratio);
    markStep(save, todayKey(), sc.track);
    ctx.persist();
    ctx.go('debrief', log);
  }
}
