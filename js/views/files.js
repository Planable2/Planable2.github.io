// ===== คลังเอกสาร: ไฟล์จากกลุ่ม LINE → Google Drive • เอกสารอ้างอิง/คู่มือ =====
import { S, cfg, can, userOf, plans } from '../store.js';
import { call } from '../api.js';
import { esc, $, on, thDateTime, truthy, debounce } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, icon, empty } from '../ui.js';

const ui = { cat: 'inbox', q: '', rcat: 'all', rq: '' };
const EXT = { pdf: ['PDF', '#A8432A', '#F6E4DA'], docx: ['DOC', '#3B5A78', '#E9EFF5'], doc: ['DOC', '#3B5A78', '#E9EFF5'], xlsx: ['XLS', '#2F6657', '#E5F0EC'], xls: ['XLS', '#2F6657', '#E5F0EC'] };
const kinds = () => cfg('DocKinds').filter((k) => truthy(k.active) || k.active === '');
const LINK = { meeting: 'ประชุม', plan: 'แผนงาน', order: 'งานสั่งการ' };
const size = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB');

export function view(main, arg, app) {
  if (arg === 'ref') return refView(main, app);
  if (arg === 'all') ui.cat = 'all';
  const K = kinds(), files = S.db.Files.slice().sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
  const count = (c) => files.filter((f) => (c === 'all' ? true : c === 'inbox' ? !f.category : f.category === c)).length;
  const q = ui.q.trim().toLowerCase();
  const list = files.filter((f) => (ui.cat === 'all' || (ui.cat === 'inbox' ? !f.category : f.category === ui.cat)) && (!q || f.name.toLowerCase().includes(q)));
  main.innerHTML = `${tabs('line')}
  <div class="page-head"><div class="t"><h1>ไฟล์จากกลุ่ม LINE</h1><span class="muted small">ไฟล์ PDF / Word / Excel ที่ส่งในกลุ่ม LINE บอทเก็บลง Google Drive อัตโนมัติ (ไม่เก็บรูปภาพ)</span></div>
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
  if (f.link_type === 'plan') { const p = plans().find((x) => x.plan_id === f.link_id); return 'แผน: ' + (p ? p.unit + ' • ' + [p.id_code, p.work_code].filter(Boolean).join('/') + ' ' + p.work_name : f.link_id); }
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
    : st.link_type === 'plan' ? plans().filter((p) => p.fiscal_year >= Math.max(...plans().map((x) => x.fiscal_year)) - 1).map((p) => [p.plan_id, p.fiscal_year + ' • ' + p.unit + ' • ' + [p.id_code, p.work_code].filter(Boolean).join('/') + ' ' + p.work_name])
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
      try { const r = await call('classifyFile', { file_id: f.file_id, ...st }); Object.assign(f, r.file); closeModal(); toast('จัดหมวดแล้ว: ' + (st.category || '—') + (r.moved ? ' • ย้ายไฟล์ใน Drive แล้ว' : '')); app.refresh(); }
      catch (x) { $('#c-err', dlg).textContent = x.message; busy(b, false); }
    };
  };
  modal('', { onMount: draw });
}

/* ---------- เอกสารอ้างอิง / คู่มือ (แยกจากไฟล์ LINE) ---------- */
/** หมวดเริ่มต้น • หมวดที่มีเครื่องมือคำนวณในระบบ มีทางลัดไปหน้าตรวจแผน */
const REF_CATS = [
  ['หลักเกณฑ์การคำนวณราคากลาง', ''],
  ['Factor F', 'check/factor'],
  ['ตารางค่าขนส่ง', 'check/transport'],
  ['ตารางค่าดำเนินการและค่าเสื่อมราคา', 'check/op'],
  ['อื่นๆ', '']
];
const MAX_UP = 15e6;
const refs = () => S.db.RefDocs || [];
const refCats = () => { const base = REF_CATS.map((c) => c[0]), extra = [...new Set(refs().map((d) => d.category))].filter((c) => !base.includes(c)); return base.slice(0, -1).concat(extra, ['อื่นๆ']); };
const tabs = (cur) => `<div class="seg-ctl" role="tablist" style="align-self:flex-start">${[['files', 'ไฟล์จากกลุ่ม LINE'], ['files/ref', 'เอกสารอ้างอิง / คู่มือ']].map(([k, l]) => `<a href="#/${k}" role="tab" aria-selected="${(k === 'files/ref') === (cur === 'ref')}" class="${(k === 'files/ref') === (cur === 'ref') ? 'on' : ''}">${l}</a>`).join('')}</div>`;

function refView(main, app) {
  const edit = can('classify_file'), q = ui.rq.trim().toLowerCase();
  const all = refs().slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const list = all.filter((d) => (ui.rcat === 'all' || d.category === ui.rcat) && (!q || [d.title, d.note, d.file_name, d.category].join(' ').toLowerCase().includes(q)));
  const cats = refCats(), shown = ui.rcat === 'all' ? cats.filter((c) => list.some((d) => d.category === c)) : [ui.rcat];
  const tool = (c) => (REF_CATS.find((x) => x[0] === c) || [])[1];
  const doc = (d) => {
    const e = EXT[String(d.ext).toLowerCase()] || (d.drive_file_id ? ['FILE', '#57524A', '#EFEBE2'] : ['LINK', '#33502F', '#E7EEDF']);
    const by_ = userOf(d.created_by);
    return `<div class="row" style="padding:12px 18px;border-top:1px solid var(--line2);align-items:flex-start">
      <span style="width:40px;height:48px;border-radius:12px;background:${e[2]};color:${e[1]};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${e[0]}</span>
      <div class="col grow" style="gap:3px"><a href="${esc(d.url || '#')}" target="_blank" rel="noopener" style="color:var(--ink)"><b class="small">${esc(d.title)}</b></a>
        ${d.note ? `<span class="small muted">${esc(d.note)}</span>` : ''}
        <span class="faint">${esc([d.file_name, Number(d.size_bytes) ? size(Number(d.size_bytes)) : '', by_ ? by_.full_name : '', thDateTime(d.created_at)].filter(Boolean).join(' • '))}</span></div>
      ${edit ? `<button class="btn sm" data-re="${esc(d.ref_id)}">แก้ไข</button>` : ''}
      <a class="icon-btn" href="${esc(d.url || '#')}" target="_blank" rel="noopener" aria-label="เปิดเอกสาร">${icon('ext', 18)}</a></div>`;
  };
  main.innerHTML = `${tabs('ref')}
  <div class="page-head"><div class="t"><h1>เอกสารอ้างอิง / คู่มือ</h1><span class="muted small">หลักเกณฑ์ ตาราง และคู่มือที่ใช้ตรวจแผน — แยกจากไฟล์ที่บันทึกจากกลุ่ม LINE • ไฟล์เก็บใน Google Drive โฟลเดอร์ "เอกสารอ้างอิง"</span></div>
    <label class="search" style="max-width:300px">${icon('search', 16)}<input id="r-q" value="${esc(ui.rq)}" placeholder="ค้นชื่อเอกสาร"></label>
    ${edit ? `<button class="btn pri" id="r-add">${icon('plus', 16)}เพิ่มเอกสาร</button>` : ''}</div>
  <div class="row wrap" style="gap:6px">${[['all', 'ทั้งหมด']].concat(cats.map((c) => [c, c])).map(([k, l]) => `<button class="chip ${ui.rcat === k ? 'on' : ''}" data-rc="${esc(k)}">${esc(l)} <b>${k === 'all' ? all.length : all.filter((d) => d.category === k).length}</b></button>`).join('')}</div>
  ${shown.length ? shown.map((c) => { const ds = list.filter((d) => d.category === c), t = tool(c); return `<section class="card flush">
    <div class="row wrap" style="padding:14px 18px 10px"><h2 class="grow" style="margin:0">${esc(c)} <span class="faint">${ds.length}</span></h2>${t ? `<a class="btn sm" href="#/${t}">${icon('calc', 14)}คำนวณในระบบ</a>` : ''}</div>
    ${ds.length ? ds.map(doc).join('') : `<div style="padding:0 18px 14px">${empty('ยังไม่มีเอกสารในหมวดนี้')}</div>`}</section>`; }).join('')
    : empty(all.length ? 'ไม่พบเอกสารตามที่ค้นหา' : 'ยังไม่มีเอกสารอ้างอิง' + (edit ? ' — กด "เพิ่มเอกสาร" เพื่ออัปโหลดไฟล์หรือใส่ลิงก์' : ''))}`;
  on(main, '[data-rc]', 'click', (e, b) => { ui.rcat = b.dataset.rc; refView(main, app); });
  $('#r-q').oninput = debounce((e) => { ui.rq = e.target.value; refView(main, app); const i = $('#r-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300);
  if ($('#r-add')) $('#r-add').onclick = () => refForm(null, main, app);
  on(main, '[data-re]', 'click', (e, b) => refForm(refs().find((d) => d.ref_id === b.dataset.re), main, app));
}

const toB64 = (file) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, '')); r.onerror = () => bad(new Error('อ่านไฟล์ไม่ได้')); r.readAsDataURL(file); });

function refForm(d, main, app) {
  const isNew = !d, cats = refCats();
  const f = d ? { ...d } : { category: ui.rcat !== 'all' ? ui.rcat : cats[0], title: '', note: '', url: '' };
  let mode = d && !d.drive_file_id ? 'link' : 'file', file = null;
  const draw = (dlg) => {
    dlg.innerHTML = `${modalHead(isNew ? 'เพิ่มเอกสารอ้างอิง' : 'แก้ไขเอกสาร', 'อัปโหลดไฟล์ (ไม่เกิน ' + MAX_UP / 1e6 + ' MB) ลง Google Drive หรือใส่ลิงก์ที่มีอยู่แล้ว')}
      <label class="f">หมวด *<input class="inp" id="rf-cat" list="rf-cats" value="${esc(f.category)}" placeholder="เลือกหรือพิมพ์หมวดใหม่"><datalist id="rf-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <label class="f">ชื่อเอกสาร *<input class="inp" id="rf-title" value="${esc(f.title)}" placeholder="เช่น หลักเกณฑ์การคำนวณราคากลางงานก่อสร้าง ปี 2569"></label>
      <label class="f">หมายเหตุ<input class="inp" id="rf-note" value="${esc(f.note || '')}" placeholder="เช่น หนังสือ กค 0433.2/ว 481 ลว. 26 มิ.ย. 69"></label>
      <div class="seg-ctl" style="align-self:flex-start"><button data-m="file" class="${mode === 'file' ? 'on' : ''}">อัปโหลดไฟล์</button><button data-m="link" class="${mode === 'link' ? 'on' : ''}">ใส่ลิงก์</button></div>
      ${mode === 'file' ? `<label class="col center" style="border:2px dashed #B8C7AE;background:#F7F9F3;border-radius:20px;padding:22px;cursor:pointer;align-items:center;gap:4px">${icon('up', 28)}<b class="small">${file ? esc(file.name) + ' • ' + size(file.size) : d && d.drive_file_id ? 'เลือกไฟล์ใหม่เพื่อแทนที่ (ไม่เลือก = ใช้ไฟล์เดิม)' : 'เลือกไฟล์ PDF / Word / Excel'}</b>${d && d.file_name && !file ? `<span class="faint">ไฟล์เดิม: ${esc(d.file_name)}</span>` : ''}<input type="file" id="rf-file" hidden></label>`
        : `<label class="f">ลิงก์เอกสาร *<input class="inp" id="rf-url" value="${esc(d && !d.drive_file_id ? d.url : f.url || '')}" placeholder="https://drive.google.com/…"></label>`}
      <span class="err" id="rf-err"></span>
      <div class="dlg-foot">${d ? '<button class="btn danger" id="rf-del" style="margin-right:auto">ลบ</button>' : ''}<button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="rf-save">บันทึก</button></div>`;
    const keep = () => { f.category = $('#rf-cat', dlg).value; f.title = $('#rf-title', dlg).value; f.note = $('#rf-note', dlg).value; if ($('#rf-url', dlg)) f.url = $('#rf-url', dlg).value; };
    on(dlg, '[data-m]', 'click', (e, b) => { keep(); mode = b.dataset.m; draw(dlg); });
    if ($('#rf-file', dlg)) $('#rf-file', dlg).onchange = (e) => {
      keep(); const x = e.target.files[0]; if (!x) return;
      if (x.size > MAX_UP) { $('#rf-err', dlg).textContent = `ไฟล์ใหญ่เกิน ${MAX_UP / 1e6} MB — อัปโหลดเข้า Drive เองแล้วใช้ "ใส่ลิงก์"`; return; }
      file = x; if (!f.title) f.title = x.name.replace(/\.[^.]+$/, ''); draw(dlg);
    };
    $('#rf-save', dlg).onclick = async () => {
      keep(); const err = $('#rf-err', dlg);
      if (!f.category.trim()) return (err.textContent = 'กรุณาเลือกหมวด');
      if (!f.title.trim()) return (err.textContent = 'กรุณาใส่ชื่อเอกสาร');
      if (mode === 'file' && !file && !(d && d.drive_file_id)) return (err.textContent = 'กรุณาเลือกไฟล์');
      if (mode === 'link' && !/^https?:\/\//i.test(f.url.trim())) return (err.textContent = 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://');
      const b = $('#rf-save', dlg); busy(b);
      try {
        const doc = { category: f.category.trim(), title: f.title.trim(), note: (f.note || '').trim() };
        if (d) doc.ref_id = d.ref_id;
        if (mode === 'link') doc.url = f.url.trim();
        const payload = { doc };
        if (mode === 'file' && file) { b.innerHTML = '<span class="spin"></span> กำลังอัปโหลด…'; payload.file = { name: file.name, mimeType: file.type, data: await toB64(file) }; }
        const r = await call('saveRefDoc', payload);
        S.db.RefDocs = refs().filter((x) => x.ref_id !== r.doc.ref_id).concat([r.doc]);
        closeModal(); toast(isNew ? 'เพิ่มเอกสารแล้ว' : 'บันทึกแล้ว'); ui.rcat = r.doc.category; refView(main, app);
      } catch (x) { err.textContent = x.message; busy(b, false); }
    };
    if ($('#rf-del', dlg)) $('#rf-del', dlg).onclick = async () => {
      if (!confirm('ลบเอกสารนี้ออกจากรายการ? (ไฟล์ใน Google Drive ยังอยู่)')) return;
      const b = $('#rf-del', dlg); busy(b);
      try { await call('deleteRefDoc', { ref_id: d.ref_id }); S.db.RefDocs = refs().filter((x) => x.ref_id !== d.ref_id); closeModal(); toast('ลบแล้ว'); refView(main, app); }
      catch (x) { $('#rf-err', dlg).textContent = x.message; busy(b, false); }
    };
  };
  modal('', { onMount: draw });
}
