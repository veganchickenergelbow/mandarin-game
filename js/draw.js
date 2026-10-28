// Pitch-curve drawing (ported from tone-test.html's draw()).
import { TEMPLATES } from './core/pitch.js';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/** Draw the dashed target tone, plus the heard curve (res from analyse()) coloured by ok. res may be null. */
export function drawCurve(canvas, res, expectedTone, ok, close = false) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  const Y = (v) => h / 2 - v * (h / 2 - 14) / 8, X = (t) => 14 + t * (w - 28);
  g.strokeStyle = css('--line-d'); g.lineWidth = 1; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();
  const tpl = TEMPLATES[expectedTone];
  if (tpl) {
    g.setLineDash([6, 5]); g.strokeStyle = css('--ink2'); g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40, v = tpl(t); i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v)); }
    g.stroke(); g.setLineDash([]);
  }
  g.fillStyle = css('--ink2'); g.font = '12px ' + css('--font'); g.fillText('dashed = target tone ' + (expectedTone || ''), 14, h - 6);
  if (res && res.ok) {
    g.strokeStyle = close ? css('--yellow-d') : ok ? css('--good') : css('--bad'); g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
    res.st.forEach((v, i) => { const x = X(i / (res.st.length - 1)), y = Y(Math.max(-8, Math.min(8, v))); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
}
