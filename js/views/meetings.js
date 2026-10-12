// ===== ปฏิทินประชุม / กิจกรรม / ตรวจรับงาน =====
import { S, cfg, can, attendeesOf, userOf, plans } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, toDate, iso, today, TH_MONTH_FULL, TH_DOW, thDate, truthy } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, avatar, avatarStack, icon, empty } from '../ui.js';

const ui = { y: null, m: null, sel: null };
const kinds = () => cfg('MeetKinds').filter((k) => truthy(k.active) || k.active === '');
const kindOf = (id) => cfg('MeetKinds').find((k) => k.kind_id === id) || { name: id, color: '#A39C88' };
const STAT = { normal: '', moved: 'เลื่อน', cancelled: 'ยกเลิก' };

export function view(main, arg, app) {
  const t = today();
  if (arg && arg !== 'new') { const m = S.db.Meetings.find((x) => x.meeting_id === arg); if (m) { const d = toDate(m.date); ui.y = d.getFullYear(); ui.m = d.getMonth(); ui.sel = iso(d); } }
  if (ui.y === null) { ui.y = t.getFullYear(); ui.m = t.getMonth(); ui.sel = iso(t); }
  const first = new Date(ui.y, ui.m, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const days = []; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
  const byDay = {}; S.db.Meetings.forEach((m) => (byDay[m.date] = byDay[m.date] || []).push(m));
  Object.values(byDay).forEach((l) => l.sort((a, b) => (a.start > b.start ? 1 : -1)));
  const weeks = days[35].getMonth() !== ui.m ? 5 : 6;
  main.innerHTML = `
  <div class="page-head"><div class="t"><h1>${TH_MONTH_FULL[ui.m]} ${ui.y + 543}</h1><span class="muted small">ประชุม • กิจกรรม • ตรวจรับงาน — แจ้งกลุ่ม LINE อัตโนมัติเมื่อเพิ่ม/เลื่อน/ยกเลิก</span></div>
    <div class="row"><button class="icon-btn" id="mt-prev" aria-label="เดือนก่อน">${icon('back')}</button><button class="btn sm" id="mt-today">วันนี้</button><button class="icon-btn" id="mt-next" aria-label="เดือนถัดไป">${icon('chev')}</button></div>
    ${can('manage_meeting') ? `<button class="btn pri" id="mt-add">${icon('plus', 16)}เพิ่มประชุม</button>` : ''}</div>
  <div class="legend">${kinds().map((k) => `<span><i style="background:${esc(k.color)}"></i>${esc(k.name)}</span>`).join('')}</div>
  <div class="grid" style="grid-template-columns:minmax(0,2.2fr) minmax(280px,1fr);align-items:start" id="mt-grid">
    <section class="card flush"><div class="cal">${TH_DOW.map((d, i) => `<div class="dh" style="${i === 0 || i === 6 ? 'color:var(--red)' : ''}">${d.slice(0, 2)}</div>`).join('')}
      ${days.slice(0, weeks * 7).map((d) => { const k = iso(d), ev = byDay[k] || []; return `<button class="d ${d.getMonth() !== ui.m ? 'out' : ''} ${k === iso(t) ? 'today' : ''} ${k === ui.sel ? 'sel' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'wkd' : ''}" data-d="${k}" aria-label="${thDate(d)}${ev.length ? ' มี ' + ev.length + ' รายการ' : ''}"><span class="n">${d.getDate()}</span>${ev.slice(0, 3).map((m) => `<span class="ev ${m.status === 'cancelled' ? 'cancel' : ''}" style="--c:${esc(kindOf(m.kind).color)}">${esc(m.start || '')} ${esc(m.title)}</span>`).join('')}${ev.length > 3 ? `<span class="faint">+${ev.length - 3}</span>` : ''}</button>`; }).join('')}</div></section>
    <section class="col" style="gap:10px" id="mt-day"></section>
  </div>`;
  if (window.innerWidth < 900) $('#mt-grid').style.gridTemplateColumns = '1fr';
  const drawDay = () => {
    const d = toDate(ui.sel), ev = byDay[ui.sel] || [];
    $('#mt-day').innerHTML = `<h2>${TH_DOW[d.getDay()]} ${thDate(d)}</h2>` + (ev.length ? ev.map(card).join('') : empty('ไม่มีประชุมหรือกิจกรรม'));
    on($('#mt-day'), '[data-edit]', 'click', (e, b) => form(S.db.Meetings.find((m) => m.meeting_id === b.dataset.edit), app));
  };
  drawDay();
  on(main, '.cal .d', 'click', (e, b) => { ui.sel = b.dataset.d; const d = toDate(ui.sel); if (d.getMonth() !== ui.m) { ui.y = d.getFullYear(); ui.m = d.getMonth(); return view(main, '', app); } $$('.cal .d', main).forEach((x) => x.classList.toggle('sel', x === b)); drawDay(); });
  $('#mt-prev').onclick = () => { ui.m--; if (ui.m < 0) { ui.m = 11; ui.y--; } view(main, '', app); };
  $('#mt-next').onclick = () => { ui.m++; if (ui.m > 11) { ui.m = 0; ui.y++; } view(main, '', app); };
  $('#mt-today').onclick = () => { ui.y = t.getFullYear(); ui.m = t.getMonth(); ui.sel = iso(t); view(main, '', app); };
  if ($('#mt-add')) $('#mt-add').onclick = () => form(null, app);
  if (arg === 'new' && can('manage_meeting')) form(null, app);
}

function card(m) {
  const k = kindOf(m.kind), ids = attendeesOf(m.meeting_id), me = S.user.user_id;
  const plan = m.plan_id ? plans().find((p) => p.plan_id === m.plan_id) : null;
  const file = m.file_id ? S.db.Files.find((f) => f.file_id === m.file_id) : null;
  return `<article class="item" style="--edge:${esc(k.color)}">
    <div class="row"><span class="small" style="color:${esc(k.color)};font-weight:600">${esc(m.start || '')}${m.end ? '–' + esc(m.end) : ''} น. • ${esc(k.name)}</span>${STAT[m.status] ? `<span class="tag red">${STAT[m.status]}</span>` : ''}${ids.includes(me) ? '<span class="tag gold right">คุณต้องเข้า</span>' : ''}</div>
    <b style="font-family:var(--head);font-weight:500;font-size:16px;${m.status === 'cancelled' ? 'text-decoration:line-through' : ''}">${esc(m.title)}</b>
    <span class="small muted">${esc(m.place || '—')}</span>
    ${plan ? `<a class="tag" href="#/plan/${esc(plan.plan_id)}" style="align-self:flex-start">แผน: ${esc(plan.unit + ' • ' + plan.work_code + ' ' + plan.work_name)} ›</a>` : ''}
    <div class="row" style="border-top:1px dashed var(--line);padding-top:8px">${avatarStack(ids, 30, 6)}<span class="faint grow">${ids.length} คน • ${esc(ids.map((i) => (i === me ? 'คุณ' : (userOf(i) || {}).full_name || i)).join(', '))}</span></div>
    <div class="row wrap">${m.online_link ? `<a class="btn sm pri" href="${esc(m.online_link)}" target="_blank" rel="noopener">เข้าประชุมออนไลน์</a>` : ''}${file ? `<a class="btn sm" href="${esc(file.drive_url)}" target="_blank" rel="noopener">${icon('file', 14)}เปิดหนังสือ</a>` : ''}${can('manage_meeting') ? `<button class="btn sm" data-edit="${esc(m.meeting_id)}">แก้ไข</button>` : ''}</div>
  </article>`;
}

function form(m, app) {
  const isNew = !m;
  const f = m ? { ...m, att: attendeesOf(m.meeting_id) } : { kind: (kinds()[0] || {}).kind_id || 'meet', title: '', date: ui.sel || iso(today()), start: '09:00', end: '', place: '', online_link: '', plan_id: '', file_id: '', notify_line: true, status: 'normal', att: [] };
  const people = S.db.Users.filter((u) => u.role !== 'ผู้เยี่ยมชม' && u.status !== 'locked');
  const meetFiles = S.db.Files.filter((x) => !x.category || x.category === 'หนังสือประชุม');
  const draw = (dlg) => {
    const k = kindOf(f.kind);
    dlg.innerHTML = `${modalHead(isNew ? 'เพิ่มประชุม / กิจกรรม' : 'แก้ไข ' + m.meeting_id)}
    <div class="seg-ctl" style="align-self:flex-start">${kinds().map((x) => `<button data-kind="${esc(x.kind_id)}" class="${x.kind_id === f.kind ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>
    <label class="f">ชื่อเรื่อง *<input class="inp" data-k="title" value="${esc(f.title)}"></label>
    <div class="fgrid"><label class="f">วันที่ *<input class="inp" type="date" data-k="date" value="${esc(f.date)}"></label><label class="f">เริ่ม<input class="inp" type="time" data-k="start" value="${esc(f.start)}"></label><label class="f">สิ้นสุด<input class="inp" type="time" data-k="end" value="${esc(f.end)}"></label></div>
    <label class="f">สถานที่<input class="inp" data-k="place" value="${esc(f.place)}"></label>
    ${truthy(k.has_link) ? `<label class="f">ลิงก์ประชุมออนไลน์<input class="inp" data-k="online_link" value="${esc(f.online_link)}" placeholder="https://"></label>` : ''}
    ${truthy(k.link_plan) ? `<label class="f">ผูกกับแผนงาน *<select class="inp" data-k="plan_id"><option value="">— เลือกจากทะเบียนแผน —</option>${plans().filter((p) => p.fiscal_year >= Math.max(...plans().map((x) => x.fiscal_year)) - 1).map((p) => `<option value="${esc(p.plan_id)}" ${p.plan_id === f.plan_id ? 'selected' : ''}>${esc(p.fiscal_year + ' • ' + p.unit + ' • ' + p.work_code + ' ' + p.work_name)}</option>`).join('')}</select></label>` : ''}
    <label class="f">หนังสือประชุม<select class="inp" data-k="file_id"><option value="">— ไม่ระบุ —</option>${meetFiles.map((x) => `<option value="${esc(x.file_id)}" ${x.file_id === f.file_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <div class="col"><div class="row small muted"><span class="grow">ผู้เข้าร่วม (${f.att.length})</span><button class="chip" id="mf-all">ทุกคนในฝ่าย</button></div>
      <div class="row wrap">${people.map((u) => `<button class="chip ${f.att.includes(u.user_id) ? 'on' : ''}" data-u="${esc(u.user_id)}" style="padding-left:3px">${avatar(u, 26)}${esc(u.user_id === S.user.user_id ? 'คุณ' : u.full_name)}</button>`).join('')}</div></div>
    ${!isNew ? `<label class="f">สถานะ<select class="inp" data-k="status">${Object.entries({ normal: 'ปกติ', moved: 'เลื่อน', cancelled: 'ยกเลิก' }).map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
    <label class="row small"><input type="checkbox" id="mf-notify" ${f.notify_line !== false ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--green2)">แจ้งกลุ่ม LINE (บอทส่งทันที + เตือนก่อนประชุม)</label>
    <span class="err" id="mf-err"></span>
    <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="mf-save">บันทึก</button></div>`;
    $$('[data-k]', dlg).forEach((el) => (el.oninput = el.onchange = () => (f[el.dataset.k] = el.value)));
    on(dlg, '[data-kind]', 'click', (e, b) => { f.kind = b.dataset.kind; draw(dlg); });
    on(dlg, '[data-u]', 'click', (e, b) => { const id = b.dataset.u; f.att = f.att.includes(id) ? f.att.filter((x) => x !== id) : f.att.concat([id]); b.classList.toggle('on'); });
    $('#mf-all', dlg).onclick = () => { f.att = f.att.length === people.length ? [] : people.map((u) => u.user_id); draw(dlg); };
    $('#mf-notify', dlg).onchange = (e) => (f.notify_line = e.target.checked);
    $('#mf-save', dlg).onclick = async () => {
      const err = $('#mf-err', dlg);
      if (!f.title.trim()) return (err.textContent = 'กรุณาใส่ชื่อเรื่อง');
      if (truthy(kindOf(f.kind).link_plan) && !f.plan_id) return (err.textContent = kindOf(f.kind).name + ' — กรุณาเลือกแผนที่ผูก');
      const b = $('#mf-save', dlg); busy(b);
      const meeting = { ...f }; delete meeting.att;
      try {
        const r = await call('saveMeeting', { meeting, attendees: f.att });
        const i = S.db.Meetings.findIndex((x) => x.meeting_id === r.meeting.meeting_id);
        if (i >= 0) S.db.Meetings[i] = r.meeting; else S.db.Meetings.push(r.meeting);
        S.db.MeetingAttendees = S.db.MeetingAttendees.filter((a) => a.meeting_id !== r.meeting.meeting_id).concat(r.attendees.map((u) => ({ meeting_id: r.meeting.meeting_id, user_id: u })));
        const d = toDate(r.meeting.date); ui.y = d.getFullYear(); ui.m = d.getMonth(); ui.sel = r.meeting.date;
        closeModal(); toast('บันทึกแล้ว: ' + r.meeting.title + (f.notify_line ? ' • แจ้งกลุ่ม LINE' : '')); app.go('meetings');
      } catch (x) { err.textContent = x.message; busy(b, false); }
    };
  };
  modal('', { wide: true, onMount: draw });
}
