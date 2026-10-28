// One-time (or "someone else is playing") voice calibration: count 一 to 十, take the 10th/50th/90th pitch percentiles.
import { track, voiced } from '../core/pitch.js';
import { calibrate, hz } from '../core/voice.js';
import { mic } from '../speech.js';
import { el } from '../ui.js';

const NEED_FRAMES = 300;   // 5 ms frames: 1.5 s of voiced sound

export async function render(root, ctx) {
  const { save } = ctx;
  root.append(el('<div class="top"><button class="link" id="x">✕ Home</button></div>'));
  root.querySelector('#x').onclick = () => ctx.go('home');
  const card = el(`<section class="card stack center">
    <div class="bigzh">一 二 三 … 十</div>
    <h2>Count from 一 to 十 at your normal speaking voice</h2>
    <p class="dim small">yī èr sān sì wǔ liù qī bā jiǔ shí. Not louder, not posher, just how you talk. This tells the app what high and low mean for your voice, so tone 3 can be heard as the low one.</p>
    <p class="msg dim small" aria-live="polite"></p>
    <div class="rangebar hidden"><i></i></div>
    <button class="btn coral big" id="rec">● Record</button>
    <button class="btn hidden" id="done">Done</button>
  </section>`);
  root.append(card);
  const msg = card.querySelector('.msg'), rec = card.querySelector('#rec'), done = card.querySelector('#done');
  done.onclick = () => ctx.go('home');
  rec.onclick = async () => {
    if (!mic.recording) {
      try { await mic.startRecord(); } catch (e) { msg.textContent = 'The mic is blocked (' + (e.name || 'error') + '). Allow it in Safari settings for this site.'; return; }
      rec.textContent = '■ Stop'; msg.textContent = 'Listening… count to ten, then stop.'; return;
    }
    rec.textContent = '● Record';
    const { samples, sr } = mic.stopRecord();
    const v = voiced(track(samples, sr)), prof = v.length >= NEED_FRAMES ? calibrate(v) : null;
    if (!prof) { msg.textContent = `That was only ${(v.length * 0.005).toFixed(1)} s of voice. I need about 1.5 s. Try again, a little closer to the mic.`; return; }
    save.voice = prof; ctx.persist();
    msg.textContent = `Got it. Your usual range is about ${Math.round(hz(prof.p10))} to ${Math.round(hz(prof.p90))} Hz, middle ${Math.round(hz(prof.p50))} Hz.`;
    msg.className = 'msg small';
    rec.textContent = '● Record again'; done.classList.remove('hidden');
  };
}
