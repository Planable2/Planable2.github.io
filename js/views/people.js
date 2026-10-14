// ===== บุคลากร + โปรไฟล์ของฉัน =====
import { S, isAdmin, plans, units, myOpenOrders, attendeesOf, assigneesOf, orderDone } from '../store.js';
import { call, DEMO } from '../api.js';
import { CONFIG } from '../config.js';
import { esc, $, on, today, toDate, thDate } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, avatar, icon, empty } from '../ui.js';

const ROLE_ORDER = ['หัวหน้า', 'วิศวกร', 'นายช่าง', 'ธุรการ', 'เจ้าหน้าที่'];
const reviewOf = (uid) => units().filter((u) => u.reviewer_id === uid).map((u) => u.name);

function statsOf(uid) {
  const t0 = today(), revUnits = reviewOf(uid);
  const fy = Math.max(0, ...plans().map((p) => p.fiscal_year));
  const review = plans().filter((p) => p.fiscal_year === fy && revUnits.includes(p.unit) && ['แขวงส่งแล้ว'].includes(p.st.dash_group)).length;
  const orders = S.db.Orders.filter((o) => !orderDone(o.status) && assigneesOf(o.order_id).includes(uid)).length;
  const meets = S.db.Meetings.filter((m) => m.status !== 'cancelled' && toDate(m.date) >= t0 && attendeesOf(m.meeting_id).includes(uid)).length;
  return [[revUnits.length ? review : '—', revUnits.length ? 'แผนรอตรวจ/แก้ไข' : 'ไม่ได้เป็นผู้ตรวจ', 'plans'], [orders, 'งานสั่งการค้าง', 'orders'], [meets, 'ประชุมที่ต้องเข้า', 'meetings']];
}

export function view(main, arg, app) {
  const people = S.db.Users.filter((u) => u.role !== 'ผู้เยี่ยมชม');
  const pending = people.filter((u) => u.status === 'pending');
  const head = people.filter((u) => u.role === 'หัวหน้า');
  const groups = ROLE_ORDER.filter((r) => r !== 'หัวหน้า').map((r) => [r, people.filter((u) => u.role === r)]).filter((g) => g[1].length);
  main.innerHTML = `
  <div class="page-head"><div class="t"><h1>บุคลากร</h1><span class="muted small">${people.length} คน • คลิกชื่อเพื่อดูรายละเอียด • รูปจาก LINE เมื่อยืนยันตัวตน</span></div>${isAdmin() ? '<a class="btn" href="#/settings/users">จัดการบัญชีผู้ใช้</a>' : ''}</div>
  ${isAdmin() && pending.length ? pending.map((u) => `<div class="note"><span class="badge" style="background:#06C755">LINE</span><span class="grow"><b>รอยืนยันตัวตน</b> • บัญชี LINE เลือกว่าเป็น ${esc(u.full_name)} (${esc(u.position)}) • ชื่อผู้ใช้ ${esc(u.username || '—')}</span><button class="btn sm" data-rej="${esc(u.user_id)}">ไม่ใช่</button><button class="btn sm pri" data-ok="${esc(u.user_id)}">ยืนยัน</button></div>`).join('') : ''}
  <section class="col" style="align-items:center;gap:0">${head.map((u) => `<button class="card row" data-p="${esc(u.user_id)}" style="background:var(--green);color:#FFFEFB;border:0;gap:14px;text-align:left">${avatar(u, 60)}<span class="col" style="gap:0"><b style="font-family:var(--head);font-size:18px;font-weight:500">${esc(u.full_name)}</b><span class="small" style="color:#E0E5D6">${esc(u.position)}</span></span><span class="tag" style="background:var(--gold);color:#3E4F3B">หัวหน้า</span>${icon('chev', 18)}</button>`).join('')}<span style="width:2px;height:22px;background:var(--line)"></span></section>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(270px,1fr))">${groups.map(([r, l]) => `<section class="card" style="padding:16px"><h3 style="margin-bottom:6px">${esc(r)} <span class="faint">${l.length} คน</span></h3>${l.map((u) => `<button class="person" data-p="${esc(u.user_id)}">${avatar(u, 46)}<span class="col grow" style="gap:0"><b>${esc(u.full_name)}${u.user_id === S.user.user_id ? ' <span class="small" style="color:var(--green2)">(คุณ)</span>' : ''}</b><span class="faint">${esc(u.position)}</span><span class="faint" style="color:${u.status === 'pending' ? 'var(--gold-ink)' : ''}">${u.status === 'pending' ? 'รอยืนยันตัวตน' : esc(reviewOf(u.user_id).length ? 'ผู้ตรวจ ' + reviewOf(u.user_id).join(', ') : '')}${u.is_admin === true ? ' • ผู้ดูแลระบบ' : ''}</span></span>${icon('chev', 16)}</button>`).join('')}</section>`).join('')}</div>`;
  on(main, '[data-p]', 'click', (e, b) => detail(b.dataset.p));
  on(main, '[data-ok],[data-rej]', 'click', async (e, b) => {
    busy(b);
    try { const r = await call('approveUser', { user_id: b.dataset.ok || b.dataset.rej, approve: !!b.dataset.ok }); const i = S.db.Users.findIndex((u) => u.user_id === r.user.user_id); S.db.Users[i] = r.user; toast(b.dataset.ok ? 'ยืนยันแล้ว — เข้าใช้งานได้ทันที' : 'ปฏิเสธแล้ว — ต้องลงทะเบียนใหม่'); app.refresh(); }
    catch (x) { toast(x.message, 'err'); busy(b, false); }
  });
}

function detail(uid) {
  const u = S.db.Users.find((x) => x.user_id === uid); if (!u) return;
  const rev = reviewOf(uid), me = uid === S.user.user_id;
  modal(`<div class="col center" style="align-items:center;gap:6px;background:var(--green);color:#FFFEFB;margin:-22px -24px 0;padding:22px;border-radius:28px 28px 0 0;position:relative">
      <button class="icon-btn" data-dismiss style="position:absolute;right:12px;top:12px;color:#fff" aria-label="ปิด">${icon('x')}</button>
      ${avatar(u, 92)}<b style="font-family:var(--head);font-size:21px;font-weight:500">${esc(u.full_name)}${u.nickname ? ' <span style="font-size:15px;color:#DCE0CF">(' + esc(u.nickname) + ')</span>' : ''}</b><span class="small" style="color:#E0E5D6">${esc(u.position)}</span>
      <div class="row wrap" style="justify-content:center"><span class="tag">${esc(u.role)}</span>${rev.length ? `<span class="tag green">ผู้ตรวจ ${esc(rev.join(', '))}</span>` : ''}${u.is_admin === true ? '<span class="tag" style="background:var(--gold);color:#3E4F3B">ผู้ดูแลระบบ</span>' : ''}</div>
      ${!u.line_picture_url ? '<span class="small" style="color:var(--gold)">ยังไม่มีรูปจาก LINE — แสดงอักษรย่อแทน</span>' : ''}</div>
    <div class="row">${u.phone ? `<a class="btn soft grow" href="tel:${esc(String(u.phone).replace(/-/g, ''))}">${icon('phone', 16)}โทร ${esc(u.phone)}</a>` : ''}${u.email ? `<a class="btn grow" href="mailto:${esc(u.email)}">ส่งอีเมล</a>` : ''}</div>
    <table class="tbl"><tbody>${[['เบอร์ภายใน', u.ext], ['อีเมล', u.email], ['สถานะบัญชี', u.status === 'pending' ? 'รอยืนยันตัวตน' : u.status === 'locked' ? 'ล็อก' : 'ใช้งาน'], ['เข้าระบบด้วย', [u.has_line ? 'LINE' : '', u.username ? 'รหัสผ่าน (' + u.username + ')' : ''].filter(Boolean).join(' • ') || '—']].map((r) => `<tr><td class="muted" style="width:130px">${r[0]}</td><td>${esc(r[1] || '—')}</td></tr>`).join('')}</tbody></table>
    <div class="kpis">${statsOf(uid).map((s) => `<a class="kpi" href="#/${s[2]}" data-dismiss style="background:var(--soft)"><span class="v">${esc(s[0])}</span><span class="l">${esc(s[1])}</span></a>`).join('')}</div>
    <div class="dlg-foot">${me ? '<a class="btn pri" href="#/profile" data-dismiss>แก้ไขข้อมูลของฉัน</a>' : ''}${isAdmin() ? '<a class="btn" href="#/settings/users" data-dismiss>แก้ตำแหน่ง/บทบาท</a>' : ''}<button class="btn" data-dismiss>ปิด</button></div>`);
}

/* ---------- โปรไฟล์ของฉัน ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

export function profile(main, arg, app) {
  const u = S.user, rev = reviewOf(u.user_id);
  main.innerHTML = `
  <section class="card row wrap" style="background:var(--green);color:#FFFEFB;gap:20px">${avatar(u, 96)}
    <div class="col grow" style="gap:4px;min-width:220px"><b style="font-family:var(--head);font-size:26px;font-weight:500">${esc(u.full_name)}${u.nickname ? ' <span style="font-size:17px;color:#DCE0CF">(' + esc(u.nickname) + ')</span>' : ''}</b><span style="color:#E0E5D6">${esc(u.position)} • ${esc(u.role)}</span>
      <div class="row wrap">${rev.length ? `<span class="tag green">ผู้ตรวจ ${esc(rev.join(', '))}</span>` : ''}${u.is_admin === true ? '<span class="tag" style="background:var(--gold);color:#3E4F3B">ผู้ดูแลระบบ</span>' : ''}</div></div>
    <div class="col"><button class="btn" id="pf-install" style="display:none">${icon('download', 16)}ติดตั้งแอปบนเครื่องนี้</button><button class="btn danger" id="pf-logout">${icon('out', 16)}ออกจากระบบ</button></div></section>
  <div class="grid g2">
    <section class="card col" style="gap:12px"><h2 style="margin:0">ข้อมูลส่วนตัวและการติดต่อ</h2>
      <div class="fgrid"><label class="f">ชื่อเล่น<input class="inp" id="me-nick" value="${esc(u.nickname || '')}"></label><label class="f">เบอร์มือถือ<input class="inp" id="me-phone" value="${esc(u.phone || '')}" inputmode="tel" placeholder="08x-xxx-xxxx"></label>
        <label class="f">เบอร์ภายใน<input class="inp" id="me-ext" value="${esc(u.ext || '')}" inputmode="numeric"></label><label class="f">อีเมลหน่วยงาน<input class="inp" id="me-email" value="${esc(u.email || '')}" inputmode="email"></label></div>
      <div class="note grey small">🔒 ชื่อ-สกุล ตำแหน่ง บทบาท และแขวงที่รับผิดชอบ แก้ได้โดยผู้ดูแลระบบ • รูปโปรไฟล์อัปเดตจาก LINE ทุกครั้งที่เข้าผ่าน LINE</div>
      <span class="err" id="me-err"></span><button class="btn pri" id="me-save" style="align-self:flex-end">บันทึก</button></section>
    <div class="col" style="gap:14px">
      <section class="card"><h2>งานของฉัน</h2><div class="kpis">${statsOf(u.user_id).map((s) => `<a class="kpi" href="#/${s[2]}" style="background:var(--soft)"><span class="v">${esc(s[0])}</span><span class="l">${esc(s[1])}</span></a>`).join('')}</div></section>
      <section class="card col" style="gap:10px"><h2 style="margin:0">บัญชีและรหัสผ่าน</h2>
        <table class="tbl"><tbody><tr><td class="muted" style="width:130px">ชื่อผู้ใช้</td><td>${esc(u.username || '—')}</td></tr><tr><td class="muted">เข้าระบบด้วย</td><td>${u.has_line ? 'LINE (มือถือ) • ' : ''}รหัสผ่าน (คอมพิวเตอร์)</td></tr></tbody></table>
        ${!DEMO && CONFIG.LIFF_ID ? `<button class="btn line" id="pf-line" style="align-self:flex-start">${u.has_line ? 'อัปเดตรูปโปรไฟล์จาก LINE' : 'เชื่อมบัญชี LINE • ใช้รูปโปรไฟล์จาก LINE'}</button>` : ''}
        <div class="fgrid"><label class="f">รหัสผ่านปัจจุบัน<input class="inp" type="password" id="pw-cur" autocomplete="current-password"></label><label class="f">รหัสผ่านใหม่<input class="inp" type="password" id="pw-new" autocomplete="new-password"></label><label class="f">ยืนยันรหัสใหม่<input class="inp" type="password" id="pw-new2" autocomplete="new-password"></label></div>
        <span class="err" id="pw-err"></span><button class="btn" id="pw-save" style="align-self:flex-end">เปลี่ยนรหัสผ่าน</button></section>
    </div>
  </div>
  ${DEMO ? '<span class="faint">โหมดสาธิต: การแก้ไขเก็บในเครื่องนี้เท่านั้น</span>' : ''}`;
  $('#pf-logout').onclick = () => app.logout();
  const pl = $('#pf-line');
  if (pl) pl.onclick = async () => { busy(pl); await app.linkLine(); busy(pl, false); };
  const inst = $('#pf-install');
  if (deferredPrompt) { inst.style.display = ''; inst.onclick = async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; inst.style.display = 'none'; }; }
  $('#me-save').onclick = async (e) => {
    const b = e.currentTarget, phone = $('#me-phone').value.trim(), digits = phone.replace(/\D/g, '');
    if (phone && !/^0\d{8,9}$/.test(digits)) return ($('#me-err').textContent = 'เบอร์มือถือต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก');
    busy(b);
    try { const r = await call('updateProfile', { fields: { nickname: $('#me-nick').value, phone, ext: $('#me-ext').value, email: $('#me-email').value } }); Object.assign(S.user, r.user); const i = S.db.Users.findIndex((x) => x.user_id === r.user.user_id); if (i >= 0) S.db.Users[i] = Object.assign({}, S.db.Users[i], r.user); toast('บันทึกข้อมูลแล้ว'); app.refresh(); }
    catch (x) { $('#me-err').textContent = x.message; busy(b, false); }
  };
  $('#pw-save').onclick = async (e) => {
    const b = e.currentTarget, n = $('#pw-new').value;
    if (n !== $('#pw-new2').value) return ($('#pw-err').textContent = 'รหัสผ่านใหม่ไม่ตรงกัน');
    busy(b);
    try { await call('changePassword', { current: $('#pw-cur').value, next: n }); toast('เปลี่ยนรหัสผ่านแล้ว'); ['#pw-cur', '#pw-new', '#pw-new2'].forEach((s) => ($(s).value = '')); $('#pw-err').textContent = ''; }
    catch (x) { $('#pw-err').textContent = x.message; }
    busy(b, false);
  };
}
