// ===== งานสั่งการ (แสดงในแอป ไม่แจ้ง LINE) =====
import { S, cfg, can, assigneesOf, userOf, orderDone } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, toDate, today, daysBetween, thDate, by, iso } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, avatar, avatarStack, icon, empty } from '../ui.js';

const ui = { scope: 'mine', tab: null };
const statusList = () => cfg('OrderStatus').slice().sort(by('sort'));

export function view(main, arg, app) {
  const me = S.user.user_id, SL = statusList(), t0 = today();
  if (!can('record_order') && !S.db.OrderAssignees.some((a) => a.user_id === me)) ui.scope = 'all';
  const scoped = S.db.Orders.filter((o) => ui.scope === 'all' || assigneesOf(o.order_id).includes(me));
  const mineOpen = S.db.Orders.filter((o) => !orderDone(o.status) && assigneesOf(o.order_id).includes(me));
  const late = mineOpen.filter((o) => toDate(o.due_date) < t0).length, near = mineOpen.filter((o) => { const d = daysBetween(t0, o.due_date); return d >= 0 && d <= 3; }).length;
  const mobile = window.innerWidth < 900;
  if (!ui.tab) ui.tab = (SL[0] || {}).code;
  main.innerHTML = `
  <div class="page-head"><div class="t"><h1>งานสั่งการ</h1><span class="muted small">งานจากเกษียณหนังสือที่หัวหน้าสั่ง • ธุรการบันทึก ผู้รับมอบอัปเดตสถานะเอง</span></div>
    <div class="seg-ctl" id="o-scope">${[['mine', 'งานของฉัน'], ['all', 'ทั้งหมด']].map((s) => `<button data-v="${s[0]}" class="${ui.scope === s[0] ? 'on' : ''}">${s[1]}</button>`).join('')}</div>
    ${can('record_order') ? `<button class="btn pri" id="o-add">${icon('plus', 16)}บันทึกงานสั่งการ</button>` : ''}</div>
  ${mineOpen.length ? `<div class="note">${icon('warn', 18)}<span>งานของคุณค้าง ${mineOpen.length} งาน${late ? ' • เลยกำหนด ' + late : ''}${near ? ' • ใกล้กำหนดภายใน 3 วัน ' + near : ''}</span></div>` : ''}
  ${mobile ? `<div class="row wrap">${SL.map((s) => `<button class="chip ${ui.tab === s.code ? 'on' : ''}" data-tab="${esc(s.code)}"><span class="dot" style="background:${esc(s.color)}"></span>${esc(s.name)} ${scoped.filter((o) => o.status === s.code).length}</button>`).join('')}</div>` : ''}
  <div class="kan">${SL.filter((s) => !mobile || s.code === ui.tab).map((s, si) => { const items = scoped.filter((o) => o.status === s.code).sort(by('due_date')); return `<section class="colk"><div class="row"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:${esc(s.color)}"></span><b class="grow">${esc(s.name)}</b><span class="tag">${items.length}</span></div>${items.length ? items.map((o) => card(o, s, SL)).join('') : empty('ไม่มีงาน')}</section>`; }).join('')}</div>
  <span class="faint">ไม่แจ้งเตือนผ่าน LINE — แสดงตัวเลขที่เมนู "งานสั่งการ" และแถบเตือนเมื่อเข้าแอป • ชื่อสถานะปรับได้ในตั้งค่าระบบ</span>`;
  on(main, '#o-scope button', 'click', (e, b) => { ui.scope = b.dataset.v; view(main, '', app); });
  on(main, '[data-tab]', 'click', (e, b) => { ui.tab = b.dataset.tab; view(main, '', app); });
  on(main, '[data-move]', 'click', async (e, b) => {
    busy(b);
    try { const r = await call('moveOrder', { order_id: b.dataset.id, status: b.dataset.move }); const o = S.db.Orders.find((x) => x.order_id === r.order.order_id); o.status = r.order.status; toast('ย้ายไป "' + (SL.find((s) => s.code === o.status) || {}).name + '" แล้ว'); app.refresh(); }
    catch (x) { toast(x.message, 'err'); busy(b, false); }
  });
  on(main, '[data-edit]', 'click', (e, b) => form(S.db.Orders.find((o) => o.order_id === b.dataset.edit), app));
  if ($('#o-add')) $('#o-add').onclick = () => form(null, app);
  if (arg === 'new' && can('record_order')) form(null, app);
}

function card(o, s, SL) {
  const t0 = today(), done = orderDone(o.status), diff = daysBetween(t0, o.due_date), ids = assigneesOf(o.order_id), me = S.user.user_id;
  const idx = SL.findIndex((x) => x.code === o.status), prev = SL[idx - 1], next = SL[idx + 1];
  const mayMove = ids.includes(me) || can('record_order');
  const dueTxt = done ? 'เสร็จแล้ว' : !o.due_date ? 'ไม่มีกำหนด' : diff < 0 ? 'เลยกำหนด ' + -diff + ' วัน' : diff === 0 ? 'ครบกำหนดวันนี้' : 'กำหนด ' + thDate(o.due_date) + ' (อีก ' + diff + ' วัน)';
  const edge = done ? '#B8C7AE' : diff < 0 ? '#C8735A' : diff <= 3 ? '#D3A04A' : 'var(--line)';
  const file = o.file_id ? S.db.Files.find((f) => f.file_id === o.file_id) : null;
  return `<article class="item" style="--edge:${edge}">
    <div class="row small"><span class="muted grow">${esc(o.doc_no)}</span><span style="color:${done ? 'var(--green-ink)' : diff < 0 ? 'var(--red)' : diff <= 3 ? 'var(--gold-ink)' : 'var(--muted)'};font-weight:${!done && diff <= 3 ? 600 : 400}">${esc(dueTxt)}</span></div>
    <b style="font-family:var(--head);font-weight:500">${esc(o.title)}</b>
    <span class="small muted">ข้อสั่งการ: ${esc(o.instruction || '—')} • สั่งโดย ${esc((userOf(o.ordered_by) || {}).full_name || o.ordered_by || '—')}</span>
    <div class="row">${avatarStack(ids, 28)}<span class="faint grow">${esc(ids.map((i) => (i === me ? 'คุณ' : (userOf(i) || {}).full_name || i)).join(', '))}</span>${file ? `<a href="${esc(file.drive_url)}" target="_blank" rel="noopener" title="${esc(file.name)}">${icon('file', 18)}</a>` : ''}</div>
    ${mayMove ? `<div class="row" style="border-top:1px dashed var(--line);padding-top:8px">${prev ? `<button class="btn sm" data-move="${esc(prev.code)}" data-id="${esc(o.order_id)}">‹ ${esc(prev.name)}</button>` : ''}${can('record_order') ? `<button class="btn sm" data-edit="${esc(o.order_id)}">แก้ไข</button>` : ''}<span class="grow"></span>${next ? `<button class="btn sm pri" style="background:${esc(next.color)};border-color:${esc(next.color)}" data-move="${esc(next.code)}" data-id="${esc(o.order_id)}">${esc(next.name)} ›</button>` : ''}</div>` : ''}
  </article>`;
}

function form(o, app) {
  const isNew = !o, SL = statusList();
  const d7 = new Date(); d7.setDate(d7.getDate() + 7);
  const heads = S.db.Users.filter((u) => u.role === 'หัวหน้า');
  const f = o ? { ...o, who: assigneesOf(o.order_id) } : { doc_no: '', title: '', instruction: '', ordered_by: (heads[0] || {}).user_id || '', due_date: iso(d7), status: (SL[0] || {}).code, file_id: '', who: [] };
  const people = S.db.Users.filter((u) => u.role !== 'ผู้เยี่ยมชม' && u.status !== 'locked');
  const files = S.db.Files.filter((x) => !x.category || x.category === 'งานสั่งการ' || x.file_id === f.file_id);
  const draw = (dlg) => {
    dlg.innerHTML = `${modalHead(isNew ? 'บันทึกงานสั่งการ' : 'แก้ไข ' + o.order_id)}
    <div class="fgrid"><label class="f">เลขที่หนังสือ *<input class="inp" data-k="doc_no" value="${esc(f.doc_no)}" placeholder="ทล 0811/1234"></label><label class="f">กำหนดเสร็จ<input class="inp" type="date" data-k="due_date" value="${esc(f.due_date)}"></label>
      <label class="f">ผู้สั่ง<select class="inp" data-k="ordered_by">${people.map((u) => `<option value="${esc(u.user_id)}" ${u.user_id === f.ordered_by ? 'selected' : ''}>${esc(u.full_name)}</option>`).join('')}</select></label></div>
    <label class="f">เรื่อง *<input class="inp" data-k="title" value="${esc(f.title)}"></label>
    <label class="f">ข้อสั่งการ<textarea class="inp" data-k="instruction">${esc(f.instruction)}</textarea></label>
    <div class="col"><span class="small muted">ผู้รับมอบ * (${f.who.length})</span><div class="row wrap">${people.map((u) => `<button class="chip ${f.who.includes(u.user_id) ? 'on' : ''}" data-u="${esc(u.user_id)}" style="padding-left:3px">${avatar(u, 26)}${esc(u.user_id === S.user.user_id ? 'คุณ' : u.full_name)}</button>`).join('')}</div></div>
    <label class="f">แนบหนังสือ (จากคลังเอกสาร)<select class="inp" data-k="file_id"><option value="">— ไม่แนบ —</option>${files.map((x) => `<option value="${esc(x.file_id)}" ${x.file_id === f.file_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <span class="err" id="of-err"></span>
    <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="of-save">บันทึก</button></div>`;
    $$('[data-k]', dlg).forEach((el) => (el.oninput = el.onchange = () => (f[el.dataset.k] = el.value)));
    on(dlg, '[data-u]', 'click', (e, b) => { const id = b.dataset.u; f.who = f.who.includes(id) ? f.who.filter((x) => x !== id) : f.who.concat([id]); draw(dlg); });
    $('#of-save', dlg).onclick = async () => {
      const b = $('#of-save', dlg); busy(b);
      const order = { ...f }; delete order.who;
      try {
        const r = await call('saveOrder', { order, assignees: f.who });
        const i = S.db.Orders.findIndex((x) => x.order_id === r.order.order_id);
        if (i >= 0) S.db.Orders[i] = r.order; else S.db.Orders.push(r.order);
        S.db.OrderAssignees = S.db.OrderAssignees.filter((a) => a.order_id !== r.order.order_id).concat(r.assignees.map((u) => ({ order_id: r.order.order_id, user_id: u })));
        closeModal(); toast('บันทึกงานสั่งการแล้ว • ผู้รับมอบเห็นในแอปทันที'); app.go('orders');
      } catch (x) { $('#of-err', dlg).textContent = x.message; busy(b, false); }
    };
  };
  modal('', { wide: true, onMount: draw });
}
