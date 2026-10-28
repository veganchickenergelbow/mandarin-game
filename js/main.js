// Tiny router. Each screen is render(root, ctx, params) and draws into #app.
import { load, persist, state } from './store.js';
import { toast } from './ui.js';
import { cancelSpeech, cancelListen, mic } from './speech.js';
import * as home from './screens/home.js';
import * as warmup from './screens/warmup.js';
import * as scene from './screens/scene.js';
import * as debrief from './screens/debrief.js';
import * as calibrate from './screens/calibrate.js';

const screens = { home, warmup, scene, debrief, calibrate };
const root = document.getElementById('app');
const scenesCache = {};
const session = { added: [] };   // review items added this visit, shown in the debrief

const ctx = {
  get save() { return state.save; },
  persist,
  session,
  go,
  toast,
  /** Scene list grouped by track: {work:[scene], life:[scene]}. */
  async scenes() {
    if (!scenesCache.all) {
      const ids = await (await fetch('data/scenes/index.json')).json();
      const list = await Promise.all(ids.map((id) => fetch(`data/scenes/${id}.json`).then((r) => r.json())));
      scenesCache.all = { work: list.filter((s) => s.track === 'work'), life: list.filter((s) => s.track === 'life') };
    }
    return scenesCache.all;
  },
};

let token = 0;
export async function go(name, params = {}) {
  const my = ++token;
  cancelSpeech(); cancelListen(); if (mic.recording) mic.stopRecord();
  root.replaceChildren();
  window.scrollTo(0, 0);
  try { await screens[name].render(root, ctx, params); } catch (e) {
    if (my !== token) return;
    console.error(e);
    root.innerHTML = '<div class="card bad"><h2>Oops, the kettle fell over</h2><p class="dim">Something went wrong loading this screen.</p></div>';
    const b = document.createElement('button'); b.className = 'btn block'; b.textContent = 'Back home'; b.onclick = () => go('home'); root.append(b);
  }
}

load();
go('home');
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
