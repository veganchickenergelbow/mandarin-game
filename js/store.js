// Save/load. localStorage key 'mg.save', filled in by progress.migrate(). Falls back to memory (with one toast) if storage throws.
import { migrate, newSave } from './core/progress.js';
import { toast } from './ui.js';

const KEY = 'mg.save';
let memory = null;
let warned = false;

export const state = { save: newSave(), storageOk: true };

function warn() {
  state.storageOk = false;
  if (!warned) { warned = true; toast('Progress cannot be saved in this browser mode'); }
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { warn(); raw = memory; }
  try { state.save = migrate(raw ? JSON.parse(raw) : null); } catch { state.save = newSave(); }
  return state.save;
}

export function persist() {
  const s = JSON.stringify(state.save);
  try { localStorage.setItem(KEY, s); } catch { memory = s; warn(); }
}
