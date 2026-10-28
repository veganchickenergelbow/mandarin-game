// Week helpers (pure). Builds a day's warm-up list: up to 3 DUE review items, then the day's phrases and its two scenes' warm-up items, 6 total.
import { reviewPick, todayKey } from './progress.js';

export const N = 6, DUE_MAX = 3;
export const charId = (sc) => (sc.character && (sc.character.id || sc.character.name)) || sc.id;

export function warmupItems(save, day, scenes = [], today = todayKey(), n = N) {
  const seen = new Set(), out = [];
  const add = (it) => { if (it && it.zh && !seen.has(it.zh) && out.length < n) { seen.add(it.zh); out.push({ key: it.key || it.zh, zh: it.zh, py: it.py, en: it.en, w: it.w }); } };
  reviewPick(save, DUE_MAX, today).filter((x) => x.due <= today).forEach(add);
  (day.phrases || []).forEach(add);
  scenes.forEach((sc) => (sc.warmup || []).forEach(add));
  return out;
}
