// ===== คลังเอกสาร (ไฟล์จากกลุ่ม LINE → Google Drive) =====
import { S, cfg, can, userOf, plans } from '../store.js';
import { call } from '../api.js';
import { esc, $, on, thDateTime, truthy, debounce } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, icon, empty } from '../ui.js';

const ui = { cat: 'inbox', q: '' };
const EXT = { pdf: ['PDF', '#A8432A', '#F6E4DA'], docx: ['DOC', '#3B5A78', '#E9EFF5'], doc: ['DOC', '#3B5A78', '#E9EFF5'], xlsx: ['XLS', '#2F6657', '#E5F0EC'], xls: ['XLS', '#2F6657', '#E5F0EC'] };
const kinds = () => cfg('DocKinds').filter((k) => truthy(k.active) || k.active === '');
const LINK = { meeting: 'ประชุม', plan: 'แผนงาน', order: 'งานสั่งการ' };
const size = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB');

export function view(main, arg, app) {
  if (arg === 'all') ui.cat = 'all';
  const K = kinds(), files = S.db.Files.slice().sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
  const count = (c) => files.filter((f) => (c === 'all' ? true : c === 'inbox' ? !f.category : f.category === c)).length;
  const q = ui.q.trim().toLowerCase();
  const list = files.filter((f) => (ui.cat === 'all' || (ui.cat === 'inbox' ? !f.category : f.category === ui.cat)) && (!q || f.name.toLowerCase().includes(q)));
  main.innerHTML = `
  <div class="page-head"><div class="t"><h1>คลังเอกสาร</h1><span class="muted small">ไฟล์ PDF / Word / Excel ที่ส่งในกลุ่ม LINE บอทเก็บลง Google Drive อัตโนมัติ (ไม่เก็บรูปภาพ)</span></div>
    <label class="search" style="max-width:320px">${icon('search', 16)}<input id="f-q" value="${esc(ui.q)}" placeholder="ค้นชื่อไฟล์"></label></div>
  <div class="row wrap">${[['inbox', 'รอจัดหมวด']].concat(K.map((k) => [k.name, k.name])).concat([['all', 'ทั้งหมด']]).map((c) => `<button class="chip ${ui.cat === c[0] ? 'on' : ''}" data-c="${esc(c[0])}">${esc(c[1])} <b>${count(c[0])}</b></button>`).join('')}</div>
  <section class="card flush">${list.length ? list.map((f) => row(f)).join('') : empty(ui.cat === 'inbox' ? 'ไม่มีไฟล์รอจัดหมวด' : 'ไม่มีไฟล์')}</section>
  <span class="faint">ไฟล์จริงอยู่ใน Google Drive • ระบบเก็บเฉพาะรหัสและลิงก์ • โฟลเดอร์แยกตามหมวดในตั้งค่า › หมวดเอกสาร</span>`;
  on(main, '[data-c]', 'click', (e, b) => { ui.cat = b.dataset.c; view(main, '', app); });
  $('#f-q').oninput = debounce((e) => { ui.q = e.target.value; view(main, '', app); const i = $('#f-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300);
  on(main, '[data-cls]', 'click', (e, b) => classify(S.db.Files.find((f) => f.file_id === b.dataset.cls), app));
}

function linkLabel(f) {
  if (!f.link_type || !f.link_id) return '';
  if (f.link_type === 'meeting') { const m = S.db.Meetings.find((x) => x.meeting_id === f.link_id); return 'ประชุม: ' + (m ? m.title : f.link_id); }
  if (f.link_type === 'plan') { const p = plans().find((x) => x.plan_id === f.link_id); return 'แผน: ' + (p ? p.unit + ' • ' + p.work_code + ' ' + p.work_name : f.link_id); }
  if (f.link_type === 'order') { const o = S.db.Orders.find((x) => x.order_id === f.link_id); return 'งานสั่งการ: ' + (o ? o.doc_no : f.link_id); }
  return '';
}

function row(f) {
  const e = EXT[String(f.ext).toLowerCase()] || ['FILE', '#57524A', '#EFEBE2'];
  const by_ = userOf(f.sent_by);
  return `<div class="row" style="padding:12px 18px;border-top:1px solid var(--line2);align-items:flex-start">
    <span style="width:40px;height:48px;border-radius:12px;background:${e[2]};color:${e[1]};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${e[0]}</span>
    <div class="col grow" style="gap:3px"><b class="small" style="word-break:break-all">${esc(f.name)}</b><span class="faint">${esc(by_ ? by_.full_name : f.sent_by || '—')} • ${thDateTime(f.sent_at)} • ${size(Number(f.size_bytes) || 0)}</span>
      <div class="row wrap">${f.category ? `<span class="tag green">${esc(f.category)}</span>` : '<span class="tag gold">รอจัดหมวด</span>'}${linkLabel(f) ? `<span class="tag">${esc(linkLabel(f))}</span>` : ''}</div></div>
    ${can('classify_file') ? `<button class="btn sm" data-cls="${esc(f.file_id)}">${f.category ? 'แก้หมวด' : 'จัดหมวด'}</button>` : ''}
    <a class="icon-btn" href="${esc(f.drive_url || '#')}" target="_blank" rel="noopener" aria-label="เปิดใน Drive">${icon('ext', 18)}</a></div>`;
}

function classify(f, app) {
  const st = { category: f.category || (kinds()[0] || {}).name || '', link_type: f.link_type || '', link_id: f.link_id || '' };
  const autoLink = (cat) => { const k = kinds().find((x) => x.name === cat) || {}; return { 'ประชุม': 'meeting', 'แผนงาน': 'plan', 'งานสั่งการ': 'order' }[k.link_to] || ''; };
  if (!st.link_type) st.link_type = autoLink(st.category);
  const targets = () => st.link_type === 'meeting' ? S.db.Meetings.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((m) => [m.meeting_id, m.date + ' • ' + m.title])
    : st.link_type === 'plan' ? plans().filter((p) => p.fiscal_year >= Math.max(...plans().map((x) => x.fiscal_year)) - 1).map((p) => [p.plan_id, p.fiscal_year + ' • ' + p.unit + ' • ' + p.work_code + ' ' + p.work_name])
      : st.link_type === 'order' ? S.db.Orders.map((o) => [o.order_id, o.doc_no + ' ' + o.title]) : [];
  const draw = (dlg) => {
    dlg.innerHTML = `${modalHead('จัดหมวดไฟล์', f.name)}
      <div class="col"><span class="small muted">หมวด</span><div class="row wrap">${kinds().map((k) => `<button class="chip ${k.name === st.category ? 'on' : ''}" data-cat="${esc(k.name)}">${esc(k.name)}</button>`).join('')}</div></div>
      <label class="f">ผูกกับ<select class="inp" id="c-type"><option value="">— ไม่ผูก —</option>${Object.entries(LINK).map(([v, l]) => `<option value="${v}" ${st.link_type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${st.link_type ? `<label class="f">เลือก${LINK[st.link_type]}<select class="inp" id="c-id"><option value="">— เลือก —</option>${targets().map((t) => `<option value="${esc(t[0])}" ${t[0] === st.link_id ? 'selected' : ''}>${esc(t[1])}</option>`).join('')}</select></label>` : ''}
      ${st.link_type === 'meeting' && can('manage_meeting') ? '<a class="small" href="#/meetings/new" data-dismiss>+ บันทึกประชุมใหม่จากไฟล์นี้ (ไปหน้าปฏิทิน)</a>' : ''}
      <span class="err" id="c-err"></span>
      <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="c-save">บันทึก</button></div>`;
    on(dlg, '[data-cat]', 'click', (e, b) => { st.category = b.dataset.cat; st.link_type = autoLink(st.category); st.link_id = ''; draw(dlg); });
    $('#c-type', dlg).onchange = (e) => { st.link_type = e.target.value; st.link_id = ''; draw(dlg); };
    if ($('#c-id', dlg)) $('#c-id', dlg).onchange = (e) => (st.link_id = e.target.value);
    $('#c-save', dlg).onclick = async () => {
      const b = $('#c-save', dlg); busy(b);
      try { const r = await call('classifyFile', { file_id: f.file_id, ...st }); Object.assign(f, r.file); closeModal(); toast('จัดหมวดแล้ว: ' + (st.category || '—')); app.refresh(); }
      catch (x) { $('#c-err', dlg).textContent = x.message; busy(b, false); }
    };
  };
  modal('', { onMount: draw });
}
