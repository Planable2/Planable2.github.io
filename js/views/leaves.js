// ===== ปฏิทินวันลา =====
import { S, cfg, userOf } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, toDate, iso, today, TH_MONTH_FULL, TH_DOW, thDate, truthy } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, avatar, icon, empty, calTabs } from '../ui.js';

const ui = S.ui.cal || (S.ui.cal = { y: null, m: null, sel: null });
const kinds = () => cfg('LeaveKinds').filter((k) => truthy(k.active) || k.active === '');
const kindOf = (id) => cfg('LeaveKinds').find((k) => k.kind_id === id) || { name: id, color: '#A39C88' };
const canManage = (l) => S.user.is_admin === true || S.user.role === 'หัวหน้า' || S.user.role === 'ธุรการ' || l.user_id === S.user.user_id;
const within = (day, l) => day >= l.date_from && day <= l.date_to;

export function view(main, arg, app) {
  const t = today();
  if (ui.y === null) { ui.y = t.getFullYear(); ui.m = t.getMonth(); ui.sel = iso(t); }
  const first = new Date(ui.y, ui.m, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const days = []; for (let i = 0; i < 42; i++) { const dd = new Date(start); dd.setDate(start.getDate() + i); days.push(dd); }
  const weeks = days[35].getMonth() !== ui.m ? 5 : 6;
  const byDay = {}; days.slice(0, weeks * 7).forEach((dd) => { const k = iso(dd); byDay[k] = S.db.Leaves.filter((l) => within(k, l)); });
  main.innerHTML = `${calTabs('leaves')}
  <div class="page-head"><div class="t"><h1>${TH_MONTH_FULL[ui.m]} ${ui.y + 543}</h1><span class="muted small">ปฏิทินวันลา — บันทึกวันลาของตัวเอง ดูภาพรวมทั้งส่วน</span></div>
    <div class="row"><button class="icon-btn" id="lv-prev" aria-label="เดือนก่อน">${icon('back')}</button><button class="btn sm" id="lv-today">วันนี้</button><button class="icon-btn" id="lv-next" aria-label="เดือนถัดไป">${icon('chev')}</button></div>
    <button class="btn pri" id="lv-add">${icon('plus', 16)}ลงวันลา</button></div>
  <div class="legend">${kinds().map((k) => `<span><i style="background:${esc(k.color)}"></i>${esc(k.name)}</span>`).join('')}</div>
  <div class="grid" style="grid-template-columns:minmax(0,2.2fr) minmax(280px,1fr);align-items:start" id="lv-grid">
    <section class="card flush"><div class="cal">${TH_DOW.map((dn, i) => `<div class="dh" style="${i === 0 || i === 6 ? 'color:var(--red)' : ''}">${dn.slice(0, 2)}</div>`).join('')}
      ${days.slice(0, weeks * 7).map((dd) => { const k = iso(dd), ev = byDay[k] || []; return `<button class="d ${dd.getMonth() !== ui.m ? 'out' : ''} ${k === iso(t) ? 'today' : ''} ${k === ui.sel ? 'sel' : ''} ${dd.getDay() === 0 || dd.getDay() === 6 ? 'wkd' : ''}" data-d="${k}" aria-label="${thDate(dd)}${ev.length ? ' มี ' + ev.length + ' คนลา' : ''}"><span class="n">${dd.getDate()}</span>${ev.slice(0, 3).map((l) => `<span class="ev" style="--c:${esc(kindOf(l.kind).color)}">${esc((userOf(l.user_id) || {}).nickname || (userOf(l.user_id) || {}).full_name || l.user_id)}</span>`).join('')}${ev.length > 3 ? `<span class="faint">+${ev.length - 3}</span>` : ''}</button>`; }).join('')}</div></section>
    <section class="col" style="gap:10px" id="lv-day"></section>
  </div>`;
  if (window.innerWidth < 900) $('#lv-grid').style.gridTemplateColumns = '1fr';
  const drawDay = () => {
    const d = toDate(ui.sel), ev = byDay[ui.sel] || [];
    $('#lv-day').innerHTML = `<h2>${TH_DOW[d.getDay()]} ${thDate(d)}</h2>` + (ev.length ? ev.map(card).join('') : empty('ไม่มีใครลาวันนี้'));
    on($('#lv-day'), '[data-edit]', 'click', (e, b) => form(S.db.Leaves.find((l) => l.leave_id === b.dataset.edit), app));
    on($('#lv-day'), '[data-del]', 'click', (e, b) => remove(b.dataset.del, app));
  };
  drawDay();
  on(main, '.cal .d', 'click', (e, b) => { ui.sel = b.dataset.d; const d = toDate(ui.sel); if (d.getMonth() !== ui.m) { ui.y = d.getFullYear(); ui.m = d.getMonth(); return view(main, '', app); } $$('.cal .d', main).forEach((x) => x.classList.toggle('sel', x === b)); drawDay(); });
  $('#lv-prev').onclick = () => { ui.m--; if (ui.m < 0) { ui.m = 11; ui.y--; } view(main, '', app); };
  $('#lv-next').onclick = () => { ui.m++; if (ui.m > 11) { ui.m = 0; ui.y++; } view(main, '', app); };
  $('#lv-today').onclick = () => { ui.y = t.getFullYear(); ui.m = t.getMonth(); ui.sel = iso(t); view(main, '', app); };
  $('#lv-add').onclick = () => form(null, app);
  if (arg === 'new') form(null, app);
}

function card(l) {
  const k = kindOf(l.kind), u = userOf(l.user_id);
  const range = l.date_from === l.date_to ? thDate(l.date_from) : thDate(l.date_from) + ' – ' + thDate(l.date_to);
  return `<article class="item" style="--edge:${esc(k.color)}">
    <div class="row">${avatar(u, 30)}<span class="grow"><b>${esc(l.user_id === S.user.user_id ? 'คุณ' : (u || {}).full_name || l.user_id)}</b><br><span class="small" style="color:${esc(k.color)};font-weight:600">${esc(k.name)}</span></span></div>
    <span class="small muted">${esc(range)}${l.note ? ' • ' + esc(l.note) : ''}</span>
    ${canManage(l) ? `<div class="row wrap"><button class="btn sm" data-edit="${esc(l.leave_id)}">แก้ไข</button><button class="btn sm danger" data-del="${esc(l.leave_id)}">ลบ</button></div>` : ''}
  </article>`;
}

function remove(id, app) {
  if (!confirm('ลบรายการวันลานี้?')) return;
  call('deleteLeave', { leave_id: id }).then(() => {
    S.db.Leaves = S.db.Leaves.filter((l) => l.leave_id !== id);
    toast('ลบแล้ว'); app.go('leaves');
  }).catch((e) => toast(e.message, 'err'));
}

function form(l, app) {
  const isNew = !l;
  const elevated = S.user.is_admin === true || S.user.role === 'หัวหน้า' || S.user.role === 'ธุรการ';
  const people = S.db.Users.filter((u) => u.role !== 'ผู้เยี่ยมชม' && u.status !== 'locked');
  const f = l ? { ...l } : { user_id: S.user.user_id, kind: (kinds()[0] || {}).kind_id || '', date_from: ui.sel || iso(today()), date_to: ui.sel || iso(today()), note: '' };
  const draw = (dlg) => {
    dlg.innerHTML = `${modalHead(isNew ? 'ลงวันลา' : 'แก้ไขวันลา')}
    ${elevated ? `<label class="f">บุคลากร<select class="inp" data-k="user_id">${people.map((u) => `<option value="${esc(u.user_id)}" ${u.user_id === f.user_id ? 'selected' : ''}>${esc(u.user_id === S.user.user_id ? 'คุณ' : u.full_name)}</option>`).join('')}</select></label>` : ''}
    <label class="f">ประเภทการลา *<select class="inp" data-k="kind">${kinds().map((k) => `<option value="${esc(k.kind_id)}" ${k.kind_id === f.kind ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>
    <div class="fgrid"><label class="f">ตั้งแต่วันที่ *<input class="inp" type="date" data-k="date_from" value="${esc(f.date_from)}"></label><label class="f">ถึงวันที่ *<input class="inp" type="date" data-k="date_to" value="${esc(f.date_to)}"></label></div>
    <label class="f">หมายเหตุ<input class="inp" data-k="note" value="${esc(f.note)}"></label>
    <span class="err" id="lf-err"></span>
    <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="lf-save">บันทึก</button></div>`;
    $$('[data-k]', dlg).forEach((el) => (el.oninput = el.onchange = () => (f[el.dataset.k] = el.value)));
    $('#lf-save', dlg).onclick = async () => {
      const err = $('#lf-err', dlg);
      if (!f.kind) return (err.textContent = 'กรุณาเลือกประเภทการลา');
      if (!f.date_from || !f.date_to) return (err.textContent = 'กรุณาเลือกวันที่');
      if (f.date_to < f.date_from) return (err.textContent = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');
      const b = $('#lf-save', dlg); busy(b);
      try {
        const r = await call('saveLeave', { leave: f });
        const i = S.db.Leaves.findIndex((x) => x.leave_id === r.leave.leave_id);
        if (i >= 0) S.db.Leaves[i] = r.leave; else S.db.Leaves.push(r.leave);
        const d = toDate(r.leave.date_from); ui.y = d.getFullYear(); ui.m = d.getMonth(); ui.sel = r.leave.date_from;
        closeModal(); toast('บันทึกวันลาแล้ว'); app.go('leaves');
      } catch (x) { err.textContent = x.message; busy(b, false); }
    };
  };
  modal('', { onMount: draw });
}
