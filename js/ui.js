// Tiny DOM helpers shared by the screens.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Build one element from an HTML string. */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el(`<div class="toast" role="status">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

export const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

/** Pinyin line shown only when the toggle is on. */
export const pyHtml = (py, on) => (on && py ? `<div class="dim small">${esc(py)}</div>` : '');

/** Hearts row, e.g. ❤️❤️🤍🤍🤍. */
export const hearts = (n) => '❤️'.repeat(n) + '🤍'.repeat(5 - n);
