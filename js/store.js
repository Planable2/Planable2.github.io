// ===== สถานะของแอป + คำนวณค่าที่ได้จากข้อมูลชุดเดียว =====
import { truthy, toDate, today, fiscalYear, by, iso } from './util.js';

export const S = { user: null, perms: {}, cfg: {}, db: {}, ui: {} };

export function load(data) {
  S.user = data.user; S.perms = data.perms || {}; S.cfg = data.cfg || {};
  S.db = Object.assign({ Plans: [], Segments: [], StatusLog: [], Meetings: [], MeetingAttendees: [], Orders: [], OrderAssignees: [], Files: [], Users: [], Fuel: [], Leaves: [], Trips: [], RefDocs: [], KmLog: [], MatDocs: [], MatPrices: [] }, data.db || {});
  cache = null;
}
let cache = null;
export const invalidate = () => { cache = null; };

export const cfg = (t) => (S.cfg['cfg_' + t] || []);
export const isGuest = () => !truthy(S.perms.view_internal) && !truthy(S.user?.is_admin);
export const isAdmin = () => truthy(S.user?.is_admin);
export const can = (k) => isAdmin() || truthy(S.perms[k]);

export const units = () => cfg('Units').filter((u) => truthy(u.active) || u.active === '').sort(by('sort'));
export const offices = () => cfg('Offices').filter((o) => truthy(o.active) || o.active === '').sort(by('sort'));
export const statuses = () => cfg('Status').slice().sort(by('sort'));
/** สถานะ 2 กลุ่ม: สถานะแผน (dash_group 4 ค่านี้) • สถานะจัดซื้อจัดจ้าง (dash_group อื่น เช่น ร่าง TOR, ออกประกาศ …) */
export const PLAN_GROUPS = ['ยังไม่ส่ง', 'แขวงส่งแล้ว', 'ส่งกรมแล้ว', 'กรมเห็นชอบ'];
export const isProcStatus = (s) => !!s && !!s.dash_group && !PLAN_GROUPS.includes(s.dash_group);
export const planStatuses = () => statuses().filter((s) => !isProcStatus(s));
export const procStatuses = () => statuses().filter(isProcStatus);
/** สถานะ "กรมเห็นชอบ" = ขั้นแรกของจัดซื้อจัดจ้าง (แผนที่อยู่ในขั้นจัดซื้อแล้ว นับว่าเห็นชอบแผนแล้ว) */
export const approvedStatus = () => statuses().find((s) => s.dash_group === 'กรมเห็นชอบ') || { status_code: 's5', name: 'กรมเห็นชอบ', color: '#46703F', dash_group: 'กรมเห็นชอบ' };
export const statusOf = (code) => statuses().find((s) => s.status_code === code) || { status_code: code, name: code, color: '#C9C1AE', dash_group: 'ยังไม่ส่ง' };
export const unitOf = (name) => cfg('Units').find((u) => u.name === name) || {};
/** ลงทะเบียน/แก้ไขแผนของหน่วยงานนี้ได้ไหม: บทบาทมีสิทธิ์ edit_plan (ทุกหน่วยงาน) หรือเป็นผู้ตรวจของหน่วยงานนั้น — ตรงกับ planGate ในหลังบ้าน */
export const canEditUnit = (name) => can('edit_plan') || (!!S.user && !!name && unitOf(name).reviewer_id === S.user.user_id);
export const editableUnits = () => units().filter((u) => canEditUnit(u.name));
export const canAddPlan = () => editableUnits().length > 0;
export const userOf = (id) => S.db.Users.find((u) => u.user_id === id) || null;
export const setting = (k, d = '') => { const r = cfg('Settings').find((x) => x.key === k); return r ? r.value : d; };

export function currentFY() {
  const v = setting('current_fiscal_year', 'auto');
  if (/^\d{4}$/.test(String(v))) return Number(v);
  const st = String(setting('fiscal_start', '01-10')).split('-');
  return fiscalYear(new Date(), Number(st[1] || 10));
}

/** แผนพร้อมค่าที่คำนวณ: ผู้ตรวจ ช่วงสายทาง รอบส่งกลับ เลยกำหนด ส่งแล้ว */
export function plans() {
  if (cache) return cache;
  const segBy = {}, logBy = {}, kmBy = {};
  (S.db.KmLog || []).forEach((l) => (kmBy[l.plan_id] = kmBy[l.plan_id] || []).push(l));
  S.db.Segments.forEach((s) => (segBy[s.plan_id] = segBy[s.plan_id] || []).push(s));
  S.db.StatusLog.forEach((l) => (logBy[l.plan_id] = logBy[l.plan_id] || []).push(l));
  const reasonCodes = statuses().filter((s) => truthy(s.need_reason)).map((s) => s.status_code);
  const t = today();
  cache = S.db.Plans.map((p) => {
    const u = unitOf(p.unit), st = statusOf(p.status), segs = (segBy[p.plan_id] || []).sort(by('seq'));
    const logs = (logBy[p.plan_id] || []).sort(by('at'));
    const off = cfg('Offices').find((o) => o.short === p.office) || {};
    const round = truthy(off.has_round) ? cfg('Rounds').find((r) => Number(r.fiscal_year) === Number(p.fiscal_year) && r.office === p.office && (truthy(r.active) || r.active === '')) : null;
    const due = round ? toDate(round.due_date) : null;
    const proc = isProcStatus(st), pg = proc ? 'กรมเห็นชอบ' : (st.dash_group || 'ยังไม่ส่ง');   // pg = กลุ่มสถานะแผน
    const unsent = pg === 'ยังไม่ส่ง';
    const isKhet = u.kind === 'เขต';
    const sent = isKhet ? ['ส่งกรมแล้ว', 'กรมเห็นชอบ'].includes(pg) : !unsent;
    const sendbacks = logs.filter((l) => reasonCodes.includes(l.to_status));
    const { khwaeng, khet, procStage } = stages(st, sendbacks.length, pg, proc);
    return Object.assign({}, p, {
      fiscal_year: Number(p.fiscal_year), budget: Number(p.budget) || 0,
      reviewer: u.reviewer_id || '', isKhet, st, pg, proc, procStage, segs, logs, kmlogs: (kmBy[p.plan_id] || []).sort(by('at')), sent, round, due, khwaeng, khet,
      late: !!(due && unsent && due < t), rounds: sendbacks.length, reasons: sendbacks.map((l, i) => `รอบ ${l.round_no || i + 1}: ${l.reason || '—'}`),
      length_km: segs.reduce((a, s) => a + Math.max(0, (Number(s.km_to_m) - Number(s.km_from_m)) / 1000), 0)
    });
  });
  return cache;
}

/** สถานะแยก 2 ฝั่งจากสถานะเดียวกัน + จำนวนรอบส่งกลับ:
 *  แขวง = กำลังดำเนินการ (ยังไม่ส่ง/ถูกส่งกลับแก้) | ส่งแล้ว
 *  เขต  = ระหว่างตรวจ → ส่งแก้ไข → ตรวจรอบที่ 2 → แก้ไขรอบที่ 2 … → ส่งกรมแล้ว/กรมเห็นชอบ (สถานะอื่นใช้ชื่อตามตั้งค่า) */
export const KHWAENG_STAGES = ['กำลังดำเนินการ', 'ส่งแล้ว'];
function stages(st, n, pg, proc) {
  const fix = truthy(st.need_reason), unsent = pg === 'ยังไม่ส่ง';
  const khwaeng = unsent || fix ? { label: fix ? 'กำลังแก้ไข' : 'กำลังดำเนินการ', key: 'กำลังดำเนินการ', color: fix ? '#D3A04A' : '#C9C1AE' } : { label: 'ส่งแล้ว', key: 'ส่งแล้ว', color: '#6585A6' };
  let khet;
  if (unsent) khet = { label: 'รอแขวงส่ง', key: 'รอแขวงส่ง', color: '#C9C1AE' };
  else if (fix) khet = { label: n > 1 ? `แก้ไขรอบที่ ${n}` : 'ส่งแก้ไข', key: 'ส่งแก้ไข', color: st.color };
  else if (pg === 'แขวงส่งแล้ว') khet = { label: n ? `ตรวจรอบที่ ${n + 1}` : 'ระหว่างตรวจ', key: 'ระหว่างตรวจ', color: st.color };
  else if (proc) { const a = approvedStatus(); khet = { label: a.name, key: a.name, color: a.color }; }
  else khet = { label: st.name, key: st.name, color: st.color };
  // สถานะจัดซื้อจัดจ้าง: เริ่มนับเมื่อกรมเห็นชอบแผน
  const procStage = proc ? { label: st.name, key: st.status_code, color: st.color } : pg === 'กรมเห็นชอบ' ? { label: 'รอเริ่มจัดซื้อ', key: 'wait', color: '#B9C3AE' } : { label: '—', key: 'none', color: '' };
  return { khwaeng, khet, procStage };
}

export const planYears = () => Array.from(new Set(plans().map((p) => p.fiscal_year))).sort((a, b) => b - a);
export function defaultYear() {
  const ys = planYears(), fy = currentFY();
  return ys.includes(fy) ? fy : (ys[0] || fy);
}

/** ผู้ใช้ปัจจุบันเกี่ยวข้องกับงานสั่งการไหน */
export const assigneesOf = (orderId) => S.db.OrderAssignees.filter((a) => a.order_id === orderId).map((a) => a.user_id);
export const attendeesOf = (meetingId) => S.db.MeetingAttendees.filter((a) => a.meeting_id === meetingId).map((a) => a.user_id);
export const orderDone = (code) => truthy((cfg('OrderStatus').find((s) => s.code === code) || {}).is_done);

export function myOpenOrders() {
  const me = S.user?.user_id;
  return S.db.Orders.filter((o) => !orderDone(o.status) && assigneesOf(o.order_id).includes(me));
}
export const pendingFiles = () => S.db.Files.filter((f) => !f.category);
export const pendingUsers = () => S.db.Users.filter((u) => u.status === 'pending');

/** ลิงก์นำทาง Google Maps ของประชุม (พิกัด → เส้นทาง • ไม่มีพิกัดใช้ลิงก์ที่วางไว้) */
export function navUrl(m) {
  const has = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  if (has(m.lat) && has(m.lng)) return `https://www.google.com/maps/dir/?api=1&destination=${Number(m.lat)},${Number(m.lng)}`;
  return /^https?:\/\//i.test(String(m.map_url || '')) ? m.map_url : '';
}
/** นอกสถานที่ = ปักพิกัด/มีลิงก์แผนที่ หรือเป็นประเภทที่ติ๊ก "นอกสถานที่" ในตั้งค่า */
export const isOffsite = (m) => !!navUrl(m) || truthy((cfg('MeetKinds').find((k) => k.kind_id === m.kind) || {}).offsite);

/** ตัวเลขแจ้งเตือนตามบทบาท (ตั้งค่า › บทบาท › ตัวเลขบนไอคอน): meetings | files | trips | none */
export function badgeInfo() {
  const mode = String(S.perms.badge || 'meetings').trim(), t = iso(today()), me = S.user?.user_id;
  const up = S.db.Meetings.filter((m) => m.status !== 'cancelled' && m.date >= t);
  if (mode === 'none') return { mode, n: 0, label: '' };
  if (mode === 'files') return { mode, n: pendingFiles().length, label: 'เอกสารรอจัดหมวด' };
  if (mode === 'trips') {   // วันที่มีประชุมนอกสถานที่ หรือมีคนไปราชการ (นับวันที่ยังไม่ผ่าน)
    const days = new Set(up.filter(isOffsite).map((m) => m.date));
    (S.db.Trips || []).forEach((x) => { for (let d = new Date(x.date_from < t ? t : x.date_from), end = new Date(x.date_to); d <= end; d.setDate(d.getDate() + 1)) days.add(iso(d)); });
    return { mode, n: days.size, label: 'วันที่ต้องออกนอกสถานที่ / ไปราชการ' };
  }
  return { mode: 'meetings', n: up.filter((m) => attendeesOf(m.meeting_id).includes(me)).length, label: 'ประชุม/กิจกรรมที่ต้องเข้า' };
}
