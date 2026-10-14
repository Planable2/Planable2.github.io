// ===== ส่วนประกอบหน้าจอที่ใช้ซ้ำ =====
import { esc, initials, $ } from './util.js';
import { statusOf, userOf } from './store.js';

let toastTimer;
export function toast(msg, kind = 'ok') {
  const el = $('#toast');
  el.className = 'toast show ' + kind;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), kind === 'err' ? 5200 : 3200);
}

/** หน้าต่างลอย: คอมพิวเตอร์ = กลางจอ, มือถือ = เลื่อนขึ้นจากล่าง */
export function modal(html, { wide = false, onMount } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay" data-close="1"><div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const ov = root.firstElementChild;
  requestAnimationFrame(() => ov.classList.add('in'));
  ov.addEventListener('click', (e) => { if (e.target.dataset.close === '1' || e.target.closest('[data-dismiss]')) closeModal(); });
  const esc_ = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', esc_, { once: true });
  const dlg = ov.querySelector('.dialog');
  if (onMount) onMount(dlg);
  const first = dlg.querySelector('input,select,textarea,button:not([data-dismiss])');
  if (first && window.innerWidth > 860) first.focus();
  return dlg;
}
export function closeModal() {
  const ov = $('#modal-root .overlay');
  if (!ov) return;
  ov.classList.remove('in');
  setTimeout(() => { if ($('#modal-root')) $('#modal-root').innerHTML = ''; }, 220);
}

export const modalHead = (title, sub = '') => `<div class="dlg-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div><button class="icon-btn" data-dismiss aria-label="ปิด">${icon('x')}</button></div>`;

export function avatar(userOrId, size = 32, extra = '') {
  const u = typeof userOrId === 'string' ? userOf(userOrId) : userOrId;
  if (!u) return `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px" ${extra}>?</span>`;
  const name = esc(u.full_name || u.name || '');
  const pic = u.line_picture_url;
  return `<span class="av" title="${name}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px" ${extra}>${pic ? `<img src="${esc(pic)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${esc(initials(u.full_name))}</b></span>`;
}
export const avatarStack = (ids, size = 28, max = 5) =>
  `<span class="av-stack">${ids.slice(0, max).map((id) => avatar(id, size)).join('')}${ids.length > max ? `<span class="av more" style="width:${size}px;height:${size}px">+${ids.length - max}</span>` : ''}</span>`;

export function statusPill(code) {
  const s = statusOf(code);
  return `<span class="pill" style="--c:${esc(s.color)}">${esc(s.name)}</span>`;
}

/** ปุ่มสลับในแท็บปฏิทิน: ประชุม | วันลา */
export const calTabs = (cur) => `<div class="seg-ctl" role="tablist" style="align-self:flex-start">${[['meetings', 'ประชุม'], ['leaves', 'วันลา']].map(([k, l]) => `<a href="#/${k}" role="tab" aria-selected="${k === cur}" class="${k === cur ? 'on' : ''}">${l}</a>`).join('')}</div>`;

export const empty = (msg) => `<div class="empty">${esc(msg)}</div>`;

export function busy(btn, on = true) {
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>'; }
  else if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
}

/** ไอคอนเส้น (ไม่ใช้ฟอนต์ไอคอน) */
const P = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  task: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2"/><path d="M9 13l2 2 4-4"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', up: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>', down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>', file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.4 19.6l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.4-2.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.6 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>', menu: '<path d="M4 8h16M4 16h16"/>', leaf: '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19c4-4 7-7 10-10"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'
};
export const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
