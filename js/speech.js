// Speech: text-to-speech, speech-to-text, and raw mic capture (for pitch scoring).
// Rule: speech-to-text and raw recording never run at the same time.

// ---------- TTS ----------
function zhVoice() {
  const vs = (window.speechSynthesis?.getVoices() || []).filter((v) => /^zh/i.test(v.lang));
  const cn = vs.filter((v) => /zh[-_]CN/i.test(v.lang));
  return cn.find((v) => /ting-?ting/i.test(v.name)) || cn[0] || vs[0] || null;
}

/** Speak Chinese text. Resolves true when finished, false if unavailable or interrupted. */
export function speak(zh, { rate = 0.9 } = {}) {
  return new Promise((resolve) => {
    const ss = window.speechSynthesis;
    if (!ss || !zh) return resolve(false);
    ss.cancel();
    const u = new SpeechSynthesisUtterance(zh);
    u.lang = 'zh-CN'; u.rate = rate;
    const v = zhVoice();
    if (v) u.voice = v;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    ss.speak(u);
  });
}
export const cancelSpeech = () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };

// ---------- speech to text ----------
let rec = null;

/** Listen once. Resolves with the final text; rejects with a reason string. The returned promise has .cancel(). */
export function listen({ onInterim } = {}) {
  let r = null;
  const p = new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject('unavailable');
    if (mic.recording) return reject('busy: recording');
    cancelListen();
    r = rec = new SR();
    r.lang = 'zh-CN'; r.interimResults = true; r.maxAlternatives = 1;
    let text = '', err = null;
    r.onresult = (e) => { text = ''; for (const x of e.results) text += x[0].transcript; onInterim?.(text); };
    r.onerror = (e) => { err = e.error || 'error'; };
    r.onend = () => { if (rec === r) rec = null; err ? reject(err) : text ? resolve(text) : reject('no-speech'); };
    try { r.start(); } catch (e) { rec = null; reject(e.message || 'error'); }
  });
  p.cancel = () => { try { r?.abort(); } catch { /* ignore */ } };
  p.catch(() => {});   // callers handle rejection; this stops "unhandled" noise when only .cancel() is used
  return p;
}
export function cancelListen() { try { rec?.abort(); } catch { /* ignore */ } rec = null; }

// ---------- raw mic capture (ScriptProcessor, as in tone-test.html) ----------
let stream = null, ctx = null, proc = null, mute = null, chunks = [];

export const mic = {
  recording: false,
  /** Start capturing. Throws if the mic is blocked. */
  async startRecord() {
    if (this.recording) return;
    cancelListen(); cancelSpeech();
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(2048, 1, 1);
      mute = ctx.createGain(); mute.gain.value = 0;
      proc.onaudioprocess = (e) => { if (mic.recording) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    }
    await ctx.resume();
    chunks = []; this.recording = true;
  },
  /** Stop and return the audio: {samples, sr}. */
  stopRecord() {
    this.recording = false;
    let n = 0; for (const c of chunks) n += c.length;
    const samples = new Float32Array(n); n = 0;
    for (const c of chunks) { samples.set(c, n); n += c.length; }
    chunks = [];
    return { samples, sr: ctx ? ctx.sampleRate : 44100 };
  },
};
export const startRecord = () => mic.startRecord();
export const stopRecord = () => mic.stopRecord();
