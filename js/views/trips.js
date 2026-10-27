// ===== ปฏิทินไปราชการ =====
import { S, userOf } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, toDate, iso, today, TH_MONTH_FULL, TH_DOW, thDate } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, avatarStack, icon, empty, calTabs } from '../ui.js';

const ui = S.ui.trip || (S.ui.trip = { y: null, m: null, sel: null });
const COLOR = '#6585A6';
const membersOf = (t) => String(t.members || '').split(',').map((s) => s.trim()).filter(Boolean);
const nick = (id) => { const u = userOf(id); return u ? u.nickname || u.full_name : id; };
const elevated = () => S.user.is_admin === true || S.user.role === 'หัวหน้า' || S.user.role === 'ธุรการ';
const canManage = (t) => elevated() || t.created_by === S.user.user_id || membersOf(t).includes(S.user.user_id);
const within = (day, t) => day >= t.date_from && day <= t.date_to;
const trips = () => S.db.Trips || [];

export function view(main, arg, app) {
  const t = today();
  if (ui.y === null) { ui.y = t.getFullYear(); ui.m = t.getMonth(); ui.sel = iso(t); }
  const first = new Date(ui.y, ui.m, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const days = []; for (let i = 0; i < 42; i++) { const dd = new Date(start); dd.setDate(start.getDate() + i); days.push(dd); }
  const weeks = days[35].getMonth() !== ui.m ? 5 : 6;
  const byDay = {}; days.slice(0, weeks * 7).forEach((dd) => { const k = iso(dd); byDay[k] = trips().filter((x) => within(k, x)); });
  const mine = trips().filter((x) => x.date_to >= iso(t) && membersOf(x).includes(S.user.user_id)).sort((a, b) => (a.date_from > b.date_from ? 1 : -1));
  main.innerHTML = `${calTabs('trips')}
  <div class="page-head"><div class="t"><h1>${TH_MONTH_FULL[ui.m]} ${ui.y + 543}</h1><span class="muted small">ปฏิทินไปราชการ — ใครไปไหน วันไหน เห็นทั้งส่วน${mine.length ? ` • คุณมีกำหนดไปราชการ ${mine.length} รายการ` : ''}</span></div>
    <div class="row"><button class="icon-btn" id="tp-prev" aria-label="เดือนก่อน">${icon('back')}</button><button class="btn sm" id="tp-today">วันนี้</button><button class="icon-btn" id="tp-next" aria-label="เดือนถัดไป">${icon('chev')}</button></div>
    <button class="btn pri" id="tp-add">${icon('plus', 16)}ลงไปราชการ</button></div>
  <div class="grid" style="grid-template-columns:minmax(0,2.2fr) minmax(280px,1fr);align-items:start" id="tp-grid">
    <section class="card flush"><div class="cal">${TH_DOW.map((dn, i) => `<div class="dh" style="${i === 0 || i === 6 ? 'color:var(--red)' : ''}">${dn.slice(0, 2)}</div>`).join('')}
      ${days.slice(0, weeks * 7).map((dd) => { const k = iso(dd), ev = byDay[k] || []; return `<button class="d ${dd.getMonth() !== ui.m ? 'out' : ''} ${k === iso(t) ? 'today' : ''} ${k === ui.sel ? 'sel' : ''} ${dd.getDay() === 0 || dd.getDay() === 6 ? 'wkd' : ''}" data-d="${k}" aria-label="${thDate(dd)}${ev.length ? ' ไปราชการ ' + ev.length + ' รายการ' : ''}"><span class="n">${dd.getDate()}</span>${ev.slice(0, 3).map((x) => `<span class="ev" style="--c:${COLOR}">${esc(x.place || x.title)}</span>`).join('')}${ev.length > 3 ? `<span class="faint">+${ev.length - 3}</span>` : ''}</button>`; }).join('')}</div></section>
    <section class="col" style="gap:10px" id="tp-day"></section>
  </div>`;
  if (window.innerWidth < 900) $('#tp-grid').style.gridTemplateColumns = '1fr';
  const drawDay = () => {
    const d = toDate(ui.sel), ev = byDay[ui.sel] || [];
    $('#tp-day').innerHTML = `<h2>${TH_DOW[d.getDay()]} ${thDate(d)}</h2>` + (ev.length ? ev.map(card).join('') : empty('ไม่มีใครไปราชการวันนี้'));
    on($('#tp-day'), '[data-edit]', 'click', (e, b) => form(trips().find((x) => x.trip_id === b.dataset.edit), app));
    on($('#tp-day'), '[data-del]', 'click', (e, b) => remove(b.dataset.del, app));
  };
  drawDay();
  on(main, '.cal .d', 'click', (e, b) => { ui.sel = b.dataset.d; const d = toDate(ui.sel); if (d.getMonth() !== ui.m) { ui.y = d.getFullYear(); ui.m = d.getMonth(); return view(main, '', app); } $$('.cal .d', main).forEach((x) => x.classList.toggle('sel', x === b)); drawDay(); });
  $('#tp-prev').onclick = () => { ui.m--; if (ui.m < 0) { ui.m = 11; ui.y--; } view(main, '', app); };
  $('#tp-next').onclick = () => { ui.m++; if (ui.m > 11) { ui.m = 0; ui.y++; } view(main, '', app); };
  $('#tp-today').onclick = () => { ui.y = t.getFullYear(); ui.m = t.getMonth(); ui.sel = iso(t); view(main, '', app); };
  $('#tp-add').onclick = () => form(null, app);
  if (arg === 'new') form(null, app);
}

function card(x) {
  const ids = membersOf(x);
  const range = x.date_from === x.date_to ? thDate(x.date_from) : thDate(x.date_from) + ' – ' + thDate(x.date_to);
  return `<article class="item" style="--edge:${COLOR}">
    <b>${esc(x.title)}</b>
    <span class="small muted">${icon('cal', 14)} ${esc(range)}${x.place ? ' • 📍 ' + esc(x.place) : ''}</span>
    <div class="row">${avatarStack(ids, 26, 6)}<span class="small">${esc(ids.map(nick).join(', '))}</span></div>
    ${x.note ? `<span class="small muted">${esc(x.note)}</span>` : ''}
    ${canManage(x) ? `<div class="row wrap"><button class="btn sm" data-edit="${esc(x.trip_id)}">แก้ไข</button><button class="btn sm danger" data-del="${esc(x.trip_id)}">ลบ</button></div>` : ''}
  </article>`;
}

function remove(id, app) {
  if (!confirm('ลบรายการไปราชการนี้?')) return;
  call('deleteTrip', { trip_id: id }).then(() => {
    S.db.Trips = trips().filter((x) => x.trip_id !== id);
    toast('ลบแล้ว'); app.go('trips');
  }).catch((e) => toast(e.message, 'err'));
}

function form(x, app) {
  const isNew = !x;
  const people = S.db.Users.filter((u) => u.role !== 'ผู้เยี่ยมชม' && u.status !== 'locked');
  const f = x ? { ...x } : { title: '', place: '', members: S.user.user_id, date_from: ui.sel || iso(today()), date_to: ui.sel || iso(today()), note: '' };
  const sel = new Set(membersOf(f));
  const draw = (dlg) => {
    dlg.innerHTML = `${modalHead(isNew ? 'ลงไปราชการ' : 'แก้ไขไปราชการ', 'เลือกผู้เดินทางได้หลายคน • ทุกคนในรายการแก้ไข/ลบได้')}
    <label class="f">เรื่อง / ภารกิจ *<input class="inp" data-k="title" value="${esc(f.title)}" placeholder="เช่น ตรวจสอบแผนงานร่วมกับแขวงน่าน 1"></label>
    <label class="f">สถานที่<input class="inp" data-k="place" value="${esc(f.place)}" placeholder="เช่น แขวงทางหลวงน่านที่ 1"></label>
    <div class="fgrid"><label class="f">วันที่ไป *<input class="inp" type="date" data-k="date_from" value="${esc(f.date_from)}"></label><label class="f">วันที่กลับ *<input class="inp" type="date" data-k="date_to" value="${esc(f.date_to)}"></label></div>
    <div class="col" style="gap:6px"><span class="small">ผู้เดินทาง * <span class="faint">(${sel.size} คน)</span></span>
      <div class="row wrap" style="gap:6px">${people.map((u) => `<button class="chip ${sel.has(u.user_id) ? 'on' : ''}" data-u="${esc(u.user_id)}">${esc(u.user_id === S.user.user_id ? 'คุณ' : u.nickname || u.full_name)}</button>`).join('')}</div></div>
    <label class="f">หมายเหตุ<input class="inp" data-k="note" value="${esc(f.note || '')}" placeholder="เช่น รถราชการ กข 1234 / ค้างคืน"></label>
    <span class="err" id="tf-err"></span>
    <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="tf-save">บันทึก</button></div>`;
    $$('[data-k]', dlg).forEach((el) => (el.oninput = el.onchange = () => (f[el.dataset.k] = el.value)));
    on(dlg, '[data-u]', 'click', (e, b) => { const id = b.dataset.u; if (sel.has(id)) sel.delete(id); else sel.add(id); draw(dlg); });
    $('#tf-save', dlg).onclick = async () => {
      const err = $('#tf-err', dlg);
      if (!String(f.title).trim()) return (err.textContent = 'กรุณาใส่เรื่อง / ภารกิจ');
      if (!f.date_from || !f.date_to) return (err.textContent = 'กรุณาเลือกวันที่');
      if (f.date_to < f.date_from) return (err.textContent = 'วันที่กลับต้องไม่ก่อนวันที่ไป');
      if (!sel.size) return (err.textContent = 'เลือกผู้เดินทางอย่างน้อย 1 คน');
      const b = $('#tf-save', dlg); busy(b);
      try {
        const r = await call('saveTrip', { trip: { ...f, members: [...sel].join(',') } });
        S.db.Trips = trips().filter((y) => y.trip_id !== r.trip.trip_id).concat([r.trip]);
        const d = toDate(r.trip.date_from); ui.y = d.getFullYear(); ui.m = d.getMonth(); ui.sel = r.trip.date_from;
        closeModal(); toast('บันทึกไปราชการแล้ว'); app.go('trips');
      } catch (y) { err.textContent = y.message; busy(b, false); }
    };
  };
  modal('', { onMount: draw });
}
