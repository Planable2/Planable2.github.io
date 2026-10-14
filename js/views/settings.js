// ===== ตั้งค่าระบบ (ผู้ดูแลระบบคนเดียว) — แก้ตาราง cfg_ ในฐานข้อมูลโดยไม่ต้องแก้โค้ด =====
import { S } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, truthy } from '../util.js';
import { toast, busy, icon, modal, modalHead, closeModal } from '../ui.js';

const TABS = [
  ['Units', 'หน่วยงาน', 'เขตและแขวงในสังกัด • ผู้ตรวจรายแขวง (ใส่ user_id)', { unit_id: 'รหัส', name: 'ชื่อ', short: 'ย่อ', kind: 'ประเภท (เขต/แขวง)', province: 'จังหวัด', reviewer_id: 'ผู้ตรวจ', sort: 'ลำดับ', active: 'เปิดใช้' }],
  ['Offices', 'สำนัก / แหล่งงบ', 'มีรอบส่ง = มีกำหนดส่ง (จังหวัด/กลุ่มจังหวัดไม่มี)', { office_id: 'รหัส', short: 'ชื่อย่อ', full: 'ชื่อเต็ม', scope: 'ใช้กับ', has_round: 'มีรอบส่ง', sort: 'ลำดับ', active: 'เปิดใช้' }],
  ['Rounds', 'รอบการส่งแผน', 'กำหนดส่งรวมรายสำนักต่อปีงบ • วันที่รูปแบบ YYYY-MM-DD', { round_id: 'รหัส', fiscal_year: 'ปีงบ', office: 'สำนัก', name: 'ชื่อรอบ', due_date: 'กำหนดส่ง', remind_days: 'เตือนก่อน (วัน)', active: 'ใช้งาน' }],
  ['Status', 'ขั้นตอนสถานะแผน', 'ห้ามเปลี่ยนรหัสที่ใช้แล้ว • นับใน Dashboard: ยังไม่ส่ง / แขวงส่งแล้ว / ส่งกรมแล้ว / กรมเห็นชอบ', { status_code: 'รหัส', name: 'ชื่อ', color: 'สี', dash_group: 'นับใน Dashboard', who: 'ใครเปลี่ยน', scope: 'ใช้กับ', need_reason: 'ต้องมีเหตุผล', sort: 'ลำดับ' }],
  ['MeetKinds', 'ประเภทประชุม', 'มีลิงก์ = แสดงปุ่มเข้าประชุม • ผูกแผน = เลือกงานจากทะเบียน (ตรวจรับงาน)', { kind_id: 'รหัส', name: 'ชื่อ', color: 'สี', has_link: 'มีลิงก์ออนไลน์', link_plan: 'ผูกกับแผน', active: 'เปิดใช้' }],
  ['OrderStatus', 'สถานะงานสั่งการ', 'เรียงตามลำดับ • นับว่าเสร็จ = ไม่นับเป็นงานค้าง', { code: 'รหัส', name: 'ชื่อ', color: 'สี', is_done: 'นับว่าเสร็จ', sort: 'ลำดับ' }],
  ['DocKinds', 'หมวดเอกสาร', 'โฟลเดอร์ใน Drive ใช้ {ปี} {เดือน} {ปีงบ} {หน่วยงาน} • ผูกกับ: ไม่ผูก/ประชุม/แผนงาน/งานสั่งการ', { kind_id: 'รหัส', name: 'ชื่อหมวด', drive_folder: 'โฟลเดอร์', link_to: 'ผูกกับ', active: 'เปิดใช้' }],
  ['Roles', 'บทบาทและสิทธิ์', 'ผู้เยี่ยมชม: ปิดทุกสิทธิ์ (เห็นเฉพาะ Dashboard) • สิทธิ์ตั้งค่าระบบผูกกับผู้ดูแลระบบคนเดียว', { role: 'บทบาท', view_internal: 'ดูข้อมูลภายใน', edit_plan: 'ลงทะเบียนแผน', update_status: 'อัปเดตสถานะ', manage_meeting: 'จัดการประชุม', record_order: 'บันทึกงานสั่งการ', classify_file: 'จัดหมวดไฟล์', edit_price: 'กรอกราคาวัสดุ' }],
  ['LeaveKinds', 'ประเภทการลา', 'ใช้ในปฏิทินวันลา • ปิด "เปิดใช้" แทนการลบประเภทที่เคยใช้แล้ว', { kind_id: 'รหัส', name: 'ชื่อ', color: 'สี', active: 'เปิดใช้' }],
  ['MatItems', 'รายการวัสดุ', 'หมวด: asphalt = ยางแอสฟัลต์, quarry = วัสดุจากแหล่ง • รหัสพาณิชย์ = ดึงราคาส่วนกลางอัตโนมัติ (ว่าง = กรอกจากใบสืบเท่านั้น)', { item_id: 'รหัส', kind: 'หมวด', name: 'ชื่อ', unit: 'หน่วย', tpso_code: 'รหัสพาณิชย์', sort: 'ลำดับ', active: 'เปิดใช้' }],
  ['Notify', 'การแจ้งเตือน LINE', 'แจ้งเฉพาะอีเวนต์ • งานสั่งการแสดงในแอปเท่านั้น', { key: 'รหัส', name: 'การแจ้งเตือน', value: 'ค่า', active: 'เปิด' }],
  ['Settings', 'ค่าระบบ', 'current_fiscal_year = auto (เปลี่ยนเอง 1 ต.ค.) หรือใส่ปี • fuel_provinces / fuel_types = จังหวัดและชนิดน้ำมันที่ดึงจาก PTT OR ทุกเช้า (คั่นด้วย , • ชนิดที่ใช้ได้: ดีเซล, ดีเซล B20, แก๊สโซฮอล์ 91, แก๊สโซฮอล์ 95, แก๊สโซฮอล์ E20, เบนซิน, Super Power Diesel, Super Power GSH95, Super Power X99)', { key: 'คีย์', value: 'ค่า', note: 'คำอธิบาย' }]
];
const ui = { tab: 'Units', rows: null, dirty: false };

export function view(main, arg, app) {
  if (arg) ui.tab = arg === 'users' ? 'users' : arg;
  const tabs = TABS.map((t) => [t[0], t[1]]).concat([['users', 'ผู้ใช้และการเข้าถึง']]);
  main.innerHTML = `
  <div class="page-head"><div class="t"><h1>ตั้งค่าระบบ</h1><span class="muted small">เฉพาะผู้ดูแลระบบ • บันทึกลงฐานข้อมูล (ตาราง cfg_) — ทุกหน้าใช้ค่าชุดนี้ทันที</span></div><span class="tag gold">ผู้ดูแลระบบ: ${esc(S.user.full_name)}</span></div>
  <div class="row wrap">${tabs.map((t) => `<button class="chip ${ui.tab === t[0] ? 'on' : ''}" data-t="${t[0]}">${esc(t[1])}</button>`).join('')}</div>
  <section class="card col" id="st-body" style="gap:12px"></section>`;
  on(main, '[data-t]', 'click', (e, b) => { if (ui.dirty && !confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการทิ้งไหม?')) return; ui.tab = b.dataset.t; ui.rows = null; ui.dirty = false; view(main, '', app); });
  if (ui.tab === 'users') return users($('#st-body'), app);
  table($('#st-body'), app);
}

function table(box, app) {
  const T = TABS.find((t) => t[0] === ui.tab), key = 'cfg_' + T[0];
  if (!ui.rows) ui.rows = JSON.parse(JSON.stringify(S.cfg[key] || []));
  const cols = Object.keys(T[3]);
  const isBool = (c) => ui.rows.some((r) => typeof r[c] === 'boolean' || r[c] === 'TRUE' || r[c] === 'FALSE') || ['active', 'has_round', 'need_reason', 'has_link', 'link_plan', 'is_done', 'view_internal', 'edit_plan', 'update_status', 'manage_meeting', 'record_order', 'classify_file', 'edit_price'].includes(c);
  box.innerHTML = `<div class="row wrap"><div class="grow"><h2 style="margin:0">${esc(T[1])}</h2><span class="muted small">${esc(T[2])}</span></div>
      <button class="btn sm" id="st-add">${icon('plus', 14)}เพิ่มแถว</button><button class="btn sm pri" id="st-save" ${ui.dirty ? '' : 'disabled'}>บันทึก</button></div>
    <div class="scroll-x"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${esc(T[3][c])}</th>`).join('')}<th></th></tr></thead>
    <tbody>${ui.rows.map((r, i) => `<tr>${cols.map((c) => `<td>${isBool(c) ? `<input type="checkbox" data-r="${i}" data-c="${c}" ${truthy(r[c]) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--green2)">` : c === 'color' ? `<span class="row" style="gap:6px"><input type="color" data-r="${i}" data-c="${c}" value="${esc(r[c] || '#888888')}" style="width:34px;height:30px;border:0;background:none"><span class="faint">${esc(r[c])}</span></span>` : `<input class="inp" style="height:36px;min-width:${c === 'name' || c === 'full' || c === 'note' || c === 'drive_folder' ? 180 : 90}px" data-r="${i}" data-c="${c}" value="${esc(r[c] ?? '')}">`}</td>`).join('')}
      <td><span class="row" style="gap:2px"><button class="icon-btn" data-up="${i}" aria-label="เลื่อนขึ้น" ${i ? '' : 'disabled'}>↑</button><button class="icon-btn" data-del="${i}" aria-label="ลบแถว">${icon('x', 16)}</button></span></td></tr>`).join('')}</tbody></table></div>
    <span class="faint">${T[0] === 'Units' ? 'รหัสผู้ใช้: ' + esc(S.db.Users.filter((u) => u.role !== 'ผู้เยี่ยมชม').map((u) => u.user_id + ' = ' + u.full_name).join(' • ')) : 'การลบแถวที่ถูกใช้งานแล้ว แนะนำให้ปิด "เปิดใช้" แทน'}</span>`;
  const mark = () => { ui.dirty = true; $('#st-save', box).disabled = false; };
  $$('[data-r]', box).forEach((el) => (el.onchange = el.oninput = () => { const r = ui.rows[el.dataset.r]; r[el.dataset.c] = el.type === 'checkbox' ? el.checked : (['sort', 'fiscal_year', 'remind_days'].includes(el.dataset.c) && el.value !== '' && !isNaN(el.value) ? Number(el.value) : el.value); mark(); }));
  on(box, '[data-del]', 'click', (e, b) => { ui.rows.splice(Number(b.dataset.del), 1); ui.dirty = true; table(box, app); });
  on(box, '[data-up]', 'click', (e, b) => { const i = Number(b.dataset.up); [ui.rows[i - 1], ui.rows[i]] = [ui.rows[i], ui.rows[i - 1]]; if ('sort' in T[3]) ui.rows.forEach((r, k) => (r.sort = k + 1)); ui.dirty = true; table(box, app); });
  $('#st-add', box).onclick = () => { const r = {}; cols.forEach((c) => (r[c] = isBool(c) ? true : '')); if ('sort' in T[3]) r.sort = ui.rows.length + 1; ui.rows.push(r); ui.dirty = true; table(box, app); };
  $('#st-save', box).onclick = async (e) => {
    const b = e.currentTarget; busy(b);
    try { const r = await call('saveConfig', { table: key, rows: ui.rows }); S.cfg[key] = r.rows; ui.rows = null; ui.dirty = false; toast('บันทึก "' + T[1] + '" แล้ว • ทุกหน้าใช้ค่าใหม่'); app.refresh(); }
    catch (x) { toast(x.message, 'err'); busy(b, false); }
  };
}

function users(box, app) {
  const roles = (S.cfg.cfg_Roles || []).map((r) => r.role);
  box.innerHTML = `<div class="row wrap"><div class="grow"><h2 style="margin:0">ผู้ใช้และการเข้าถึง</h2><span class="muted small">บุคลากรลงทะเบียนผ่าน LINE แล้วตั้งรหัสผ่านเอง • บัญชีผู้เยี่ยมชมสร้างที่นี่ (รหัสผ่านอย่างเดียว) • ผู้ดูแลระบบมีได้ 1 คน</span></div><button class="btn sm pri" id="us-add">${icon('plus', 14)}เพิ่มผู้ใช้</button></div>
    <div class="scroll-x"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ตำแหน่ง</th><th>บทบาท</th><th>ชื่อผู้ใช้</th><th>LINE</th><th>สถานะ</th><th>แอดมิน</th><th></th></tr></thead>
    <tbody>${S.db.Users.map((u) => `<tr><td>${esc(u.user_id)}</td><td><b>${esc(u.full_name)}</b></td><td>${esc(u.position)}</td><td>${esc(u.role)}</td><td>${esc(u.username || '—')}</td><td>${u.has_line ? '✓' : '—'}</td><td>${esc(u.status)}</td><td>${u.is_admin === true ? '★' : ''}</td><td><button class="btn sm" data-ed="${esc(u.user_id)}">แก้ไข</button></td></tr>`).join('')}</tbody></table></div>`;
  const edit = (u) => {
    const f = u ? { ...u } : { user_id: '', full_name: '', position: '', role: 'เจ้าหน้าที่', username: '', status: 'active', is_admin: false, phone: '', ext: '', email: '' };
    modal(`${modalHead(u ? 'แก้ไขผู้ใช้ ' + u.user_id : 'เพิ่มผู้ใช้')}
      <div class="fgrid"><label class="f">ชื่อ-สกุล *<input class="inp" data-k="full_name" value="${esc(f.full_name)}"></label><label class="f">ตำแหน่ง<input class="inp" data-k="position" value="${esc(f.position)}"></label>
      <label class="f">บทบาท<select class="inp" data-k="role">${roles.map((r) => `<option ${r === f.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="f">สถานะ<select class="inp" data-k="status">${['active', 'pending', 'locked'].map((s) => `<option ${s === f.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="f">ชื่อผู้ใช้ (ผู้เยี่ยมชม/คอมพิวเตอร์)<input class="inp" data-k="username" value="${esc(f.username || '')}"></label><label class="f">ตั้ง/รีเซ็ตรหัสผ่าน<input class="inp" type="password" id="ue-pw" placeholder="เว้นว่าง = ไม่เปลี่ยน" autocomplete="new-password"></label></div>
      <label class="row small"><input type="checkbox" id="ue-admin" ${f.is_admin === true ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--green2)">ผู้ดูแลระบบ (เลือกแล้วสิทธิ์จะย้ายจากคนเดิมทันที)</label>
      <span class="err" id="ue-err"></span><div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="ue-save">บันทึก</button></div>`, {
      onMount: (dlg) => {
        $$('[data-k]', dlg).forEach((el) => (el.oninput = el.onchange = () => (f[el.dataset.k] = el.value)));
        $('#ue-save', dlg).onclick = async (e) => {
          const b = e.currentTarget, pw = $('#ue-pw', dlg).value;
          if (!f.full_name.trim()) return ($('#ue-err', dlg).textContent = 'กรุณาใส่ชื่อ');
          if (pw && pw.length < 8) return ($('#ue-err', dlg).textContent = 'รหัสผ่านอย่างน้อย 8 ตัวอักษร');
          f.is_admin = $('#ue-admin', dlg).checked;
          const payload = { user: { user_id: f.user_id, full_name: f.full_name, position: f.position, role: f.role, status: f.status, username: f.username, is_admin: f.is_admin } };
          if (!payload.user.user_id) delete payload.user.user_id;
          if (pw) payload.password = pw;
          busy(b);
          try { await call('saveUser', payload); closeModal(); toast('บันทึกผู้ใช้แล้ว'); await app.reload(); }
          catch (x) { $('#ue-err', dlg).textContent = x.message; busy(b, false); }
        };
      }
    });
  };
  on(box, '[data-ed]', 'click', (e, b) => edit(S.db.Users.find((u) => u.user_id === b.dataset.ed)));
  $('#us-add', box).onclick = () => edit(null);
}
