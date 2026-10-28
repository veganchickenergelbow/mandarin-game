// Optional keep-my-last-20-recordings store (IndexedDB) plus .wav export. Pure helpers are exported for tests;
// every IndexedDB call is wrapped in try/catch and fails soft (false / []).
import { syllables, toneOf } from './core/pinyin.js';
import { todayKey } from './core/progress.js';

export const MAX = 20, RATE = 16000;
const DB = 'mg-rec', STORE = 'takes';

/** Float32 samples at sr -> Int16 at 16 kHz (box-filter average over each output sample, so no aliasing to speak of). */
export function resample16k(x, sr) {
  const ratio = sr / RATE, n = Math.max(0, Math.floor(x.length / ratio)), out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.min(x.length, Math.floor((i + 1) * ratio)));
    let s = 0; for (let k = a; k < b; k++) s += x[k];
    const v = Math.max(-1, Math.min(1, s / (b - a)));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

/** 16-bit mono PCM .wav bytes. */
export function wavBytes(pcm, rate = RATE) {
  const b = new Uint8Array(44 + pcm.length * 2), v = new DataView(b.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true);
  return b;
}

/** "nǐ hǎo" -> "ni3hao3" (neutral tone = 5, ü = v). */
export const numbered = (py) => syllables(py).map((s) => s.normalize('NFD').replace(/ü/g, 'v').replace(/\p{M}/gu, '') + toneOf(s)).join('');
/** 2026-10-28_ni3hao3_heard-2-3.wav */
export const takeName = (t) => `${todayKey(new Date(t.time))}_${numbered(t.py)}_heard-${(t.heard || []).map((h) => h ?? 'x').join('-')}.wav`;
export const labelsOf = (takes) => takes.map((t, i) => ({ file: t.file, time: new Date(t.time).toISOString(), zh: t.zh, py: t.py, expected: t.expected, heard: t.heard, scores: t.scores }));

// ---- IndexedDB (fails soft) ----
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(true); tx.onerror = tx.onabort = () => rej(tx.error); });
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** Store one take {time, zh, py, expected, heard, scores} with its audio; keeps only the last MAX. Resolves true/false. */
export async function saveTake(samples, sr, meta) {
  try {
    const db = await open();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ ...meta, rate: RATE, pcm: resample16k(samples, sr).buffer });
      await done(tx);
    } finally { db.close(); }
  } catch { return false; }
  await prune();
  return true;
}
async function prune() {
  try {
    const db = await open();
    try {
      const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE), keys = (await req(st.getAllKeys())).sort((a, b) => a - b);
      keys.slice(0, Math.max(0, keys.length - MAX)).forEach((k) => st.delete(k));
      await done(tx);
    } finally { db.close(); }
  } catch { /* ignore */ }
}
export async function listTakes() {
  try {
    const db = await open();
    try { return (await req(db.transaction(STORE).objectStore(STORE).getAll())).sort((a, b) => a.time - b.time); } finally { db.close(); }
  } catch { return []; }
}
export async function countTakes() { return (await listTakes()).length; }
export async function clearTakes() {
  try {
    const db = await open();
    try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); await done(tx); return true; } finally { db.close(); }
  } catch { return false; }
}

/** Build File objects: one .wav per take plus labels.json. */
export async function buildFiles() {
  const takes = await listTakes(), seen = {}, files = [], labelled = [];
  for (const t of takes) {
    let name = takeName(t); if (seen[name]) { seen[name]++; name = name.replace(/\.wav$/, `_${seen[name]}.wav`); } else seen[name] = 1;
    files.push(new File([wavBytes(new Int16Array(t.pcm), t.rate || RATE)], name, { type: 'audio/wav' }));
    labelled.push({ ...t, file: name });
  }
  if (files.length) files.push(new File([JSON.stringify(labelsOf(labelled), null, 2)], 'labels.json', { type: 'application/json' }));
  return files;
}
/** Share via the system sheet when allowed, else return false so the caller shows download links. */
export async function shareFiles(files) {
  try {
    if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: 'Mandarin Game recordings' }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return true; }
  return false;
}
