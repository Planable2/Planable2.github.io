// ===== เครื่องมือทั่วไป =====
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const on = (root, sel, evt, fn) => $$(sel, root).forEach((el) => el.addEventListener(evt, (e) => fn(e, el)));

export const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const mil = (n, d = 1) => ((Number(n) || 0) / 1e6).toFixed(d);
export const num = (v) => Number(String(v ?? '').replace(/[,\s]/g, ''));

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export function thDate(v, withYear = true) {
  const d = toDate(v); if (!d) return '—';
  return `${d.getDate()} ${TH_M[d.getMonth()]}${withYear ? ' ' + String(d.getFullYear() + 543).slice(-2) : ''}`;
}
export function thDateTime(v) {
  const d = toDate(v); if (!d) return '—';
  return `${thDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** ปีงบ (พ.ศ.) ของวันที่ — เริ่ม 1 ต.ค. */
export function fiscalYear(d = new Date(), startMonth = 10) {
  return d.getFullYear() + 543 + (d.getMonth() + 1 >= startMonth ? 1 : 0);
}
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);

/** กม. เก็บเป็นเมตร → แสดง 12+345 */
export const kmText = (m) => { const v = Math.round(Number(m) || 0); return `${Math.floor(v / 1000)}+${String(v % 1000).padStart(3, '0')}`; };
/** 12+345 → 12345 เมตร (คืน NaN ถ้ารูปแบบผิด) */
export const kmParse = (s) => { const m = /^(\d{1,4})\+(\d{3})$/.exec(String(s).trim()); return m ? Number(m[1]) * 1000 + Number(m[2]) : NaN; };

export const uniq = (arr) => Array.from(new Set(arr));
export const by = (k) => (a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0);
export const truthy = (v) => v === true || v === 'TRUE' || v === 'true' || v === 1;
export const initials = (name) => { const s = String(name || '').replace(/[\[\]]/g, '').trim(); return s ? s.slice(0, 2) : '?'; };
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
