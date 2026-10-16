// ===== ราคาวัสดุ: น้ำมัน • ยางแอสฟัลต์ • วัสดุจากแหล่ง • คอนกรีต / ปูน =====
import { S, cfg, can } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, iso, today, thDate, truthy, by, uniq } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, icon, empty } from '../ui.js';
import { fuel } from './misc.js';

const SUBS = [['fuel', 'น้ำมัน'], ['asphalt', 'ยางแอสฟัลต์'], ['quarry', 'วัสดุจากแหล่ง'], ['concrete', 'คอนกรีต / ปูนซีเมนต์']];
const srcLabel = (s) => (s === 'พาณิชย์' ? 'พาณิชย์ (กรุงเทพฯ)' : s);
const AUTO = ['พาณิชย์', 'พาณิชย์จังหวัด'];   // GitHub Action ดึงให้ — แก้ในเว็บไม่ได้
const ui = S.ui.prices || (S.ui.prices = { sub: 'fuel', month: '', date: '', cmonth: '' });

const tabs = (cur) => `<div class="seg-ctl" role="tablist" style="align-self:flex-start">${SUBS.map(([k, l]) => `<a href="#/prices/${k}" role="tab" aria-selected="${k === cur}" class="${k === cur ? 'on' : ''}">${l}</a>`).join('')}</div>`;
const fmt = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const thMonth = (p) => thDate(p + '-01').replace(/^\d+ /, '');
const items = (kind) => cfg('MatItems').filter((i) => i.kind === kind && (truthy(i.active) || i.active === '')).sort(by('sort'));
/** ยางที่ขายเป็นตัน (หน่วย บาท/ตัน ใน ตั้งค่า › รายการวัสดุ) แสดงเฉพาะราคา Bulk — ราคาบรรจุภัณฑ์ใช้กับรายการอื่น เช่น REJUVENATOR / JOINT SEALER */
const bulkOnly = () => new Set(items('asphalt').filter((i) => /ตัน/.test(i.unit || '')).map((i) => i.name));
const docsOf = (kind) => S.db.MatDocs.filter((d) => d.kind === kind);
const pricesOf = (id) => S.db.MatPrices.filter((p) => p.doc_id === id);
const provinces = () => uniq(cfg('Units').filter((u) => (truthy(u.active) || u.active === '') && u.province).sort(by('sort')).map((u) => u.province));
const monthsBack = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const num = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
const lowest = (vals) => { const n = vals.filter(num).map(Number); return n.length > 1 ? Math.min(...n) : null; };
const cell = (v, low) => `<td class="r num" style="${low !== null && num(v) && Number(v) === low ? 'color:#2F5C9E;font-weight:700' : ''}">${fmt(v)}</td>`;
const fileLink = (d) => (d.file_url ? ` <a href="${esc(d.file_url)}" target="_blank" rel="noopener" title="เปิดเอกสาร">${icon('file', 14)}</a>` : '');
const shortConcrete = (n) => n.replace(/^คอนกรีตผสมเสร็จ\s*/, '').replace(/รูปลูกบาศก์\s*/, 'ลูกบาศก์ ').replace(/\s*และรูปทรงกระบอก\s*/, ' / ทรงกระบอก ').replace(/กก\.\/ตร\.ซม\./g, 'ksc');

export function view(main, arg, app) {
  if (SUBS.some((s) => s[0] === arg)) ui.sub = arg;
  const head = tabs(ui.sub);
  if (ui.sub === 'fuel') return fuel(main, head);
  if (ui.sub === 'asphalt') return asphalt(main, app, head);
  if (ui.sub === 'quarry') return quarry(main, app, head);
  return concrete(main, app, head);
}
export const fuelRoute = (main, arg, app) => view(main, 'fuel', app);

/* ---------- ยางแอสฟัลต์: พาณิชย์ (อัตโนมัติ) + ใบสืบรายเดือน ---------- */
function asphalt(main, app, head) {
  const all = docsOf('asphalt'), months = uniq(all.map((d) => d.period)).sort();
  const cur = ui.month || months[months.length - 1] || iso(today()).slice(0, 7);
  const srcs = uniq(['พาณิชย์'].concat(all.map((d) => d.source).sort()));
  // แต่ละแหล่ง: ราคาเดือนที่เลือก • ถ้ายังไม่ออกใช้เดือนล่าสุดก่อนหน้า (ย้อนไม่เกิน 3 เดือน)
  const cols = srcs.map((s) => ({ s, d: all.filter((d) => d.source === s && d.period <= cur && monthsBack(d.period, cur) <= 3).sort(by('period')).pop() })).filter((c) => c.d);
  const bo = bulkOnly();
  cols.forEach((c) => { c.p = {}; pricesOf(c.d.doc_id).forEach((r) => (c.p[r.item] = r)); c.two = Object.values(c.p).some((r) => num(r.price2) && !bo.has(r.item)); });
  const names = uniq(items('asphalt').map((i) => i.name).concat(cols.flatMap((c) => Object.keys(c.p)))).filter((n) => cols.some((c) => c.p[n]));
  const edit = can('edit_price');
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>ราคายางแอสฟัลต์ • ${thMonth(cur)}</h1><span class="muted small">Bulk = บาท/ตัน • ไม่รวม VAT • พาณิชย์ (กรุงเทพฯ) ดึงอัตโนมัติ • <b style="color:#2F5C9E">สีน้ำเงิน</b> = ถูกสุดในแถว</span></div>
    <label class="f" style="flex:0 0 170px">เดือน<input class="inp" type="month" id="pa-m" value="${esc(cur)}"></label>
    ${edit ? `<button class="btn pri" id="pa-add">${icon('plus', 16)}กรอกราคาจากใบสืบ</button>` : ''}</div>
  ${names.length ? `<section class="card flush scroll-x"><table class="tbl"><thead>
    <tr><th style="padding-left:18px">ชนิดยาง</th>${cols.map((c) => `<th class="r" colspan="${c.two ? 2 : 1}"><b>${esc(srcLabel(c.s))}</b>${fileLink(c.d)}${edit && !AUTO.includes(c.s) ? ` <button class="chip" style="height:26px" data-ed="${esc(c.d.doc_id)}">แก้ไข</button>` : ''}<br><span class="faint">${c.d.period !== cur ? 'ใช้ราคา ' : ''}${thMonth(c.d.period)}${c.d.doc_no ? ' • ' + esc(c.d.doc_no) : ''}</span></th>`).join('')}</tr>
    <tr><th></th>${cols.map((c) => (c.two ? '<th class="r faint">Bulk</th><th class="r faint">บรรจุภัณฑ์</th>' : '<th class="r faint">Bulk</th>')).join('')}</tr></thead>
    <tbody>${names.map((n) => { const low = lowest(cols.map((c) => c.p[n] && c.p[n].price)); return `<tr><td style="padding-left:18px;white-space:nowrap"><b>${esc(n)}</b></td>${cols.map((c) => { const r = c.p[n] || {}; return cell(r.price, low) + (c.two ? `<td class="r num">${bo.has(n) ? '' : fmt(r.price2)}</td>` : ''); }).join('')}</tr>`; }).join('')}</tbody></table></section>
    ${cols.some((c) => c.d.note) ? `<p class="faint small" style="margin:0">${cols.filter((c) => c.d.note).map((c) => esc(srcLabel(c.s) + ': ' + c.d.note)).join(' • ')}</p>` : ''}`
    : empty('ยังไม่มีราคาเดือนนี้ — ราคาพาณิชย์ดึงอัตโนมัติทุกเช้า • ใบสืบ Tipco/Zola กด "กรอกราคาจากใบสืบ"')}`;
  $('#pa-m').onchange = (e) => { if (e.target.value) { ui.month = e.target.value; view(main, '', app); } };
  if ($('#pa-add')) $('#pa-add').onclick = () => docForm('asphalt', null, cur, main, app);
  on(main, '[data-ed]', 'click', (e, b) => docForm('asphalt', S.db.MatDocs.find((d) => d.doc_id === b.dataset.ed), cur, main, app));
}

/* ---------- วัสดุจากแหล่ง: ใช้ราคาที่ออกล่าสุด ณ วันที่เลือก ---------- */
function quarry(main, app, head) {
  const all = docsOf('quarry'), at = ui.date || iso(today()), provs = provinces(), edit = can('edit_price');
  const blocks = uniq(all.map((d) => d.source).sort()).map((s) => all.filter((d) => d.source === s && d.period <= at).sort(by('period')).pop()).filter(Boolean);
  const unit = (n) => (items('quarry').find((i) => i.name === n) || {}).unit || '';
  const table = (d) => {
    const p = {}; pricesOf(d.doc_id).forEach((r) => ((p[r.item] = p[r.item] || {})[r.area] = r.price));
    const areas = uniq(provs.concat(Object.values(p).flatMap((o) => Object.keys(o)))).filter((a) => Object.values(p).some((o) => num(o[a])));
    const names = uniq(items('quarry').map((i) => i.name).concat(Object.keys(p))).filter((n) => p[n]);
    return `<section class="card flush scroll-x">
      <div class="row wrap" style="padding:14px 18px 6px"><span class="grow"><b>${esc(d.source)}</b> • ราคาที่ออกเมื่อ ${thDate(d.period)}${fileLink(d)}${d.doc_no || d.note ? `<br><span class="faint small">${esc([d.doc_no, d.note].filter(Boolean).join(' • '))}</span>` : ''}</span>${edit ? `<button class="btn sm" data-ed="${esc(d.doc_id)}">แก้ไข</button>` : ''}</div>
      <table class="tbl"><thead><tr><th style="padding-left:18px">วัสดุ</th>${areas.map((a) => `<th class="r">${esc(a)}</th>`).join('')}</tr></thead>
      <tbody>${names.map((n) => { const low = lowest(areas.map((a) => p[n][a])); return `<tr><td style="padding-left:18px;white-space:nowrap"><b>${esc(n)}</b> <span class="faint small">${esc(unit(n))}</span></td>${areas.map((a) => cell(p[n][a], low)).join('')}</tr>`; }).join('')}</tbody></table></section>`;
  };
  const issued = all.slice().sort(by('period')).reverse();
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>ราคาวัสดุจากแหล่ง</h1><span class="muted small">ใช้ราคาที่ออกล่าสุด ณ วันที่เลือก • <b style="color:#2F5C9E">สีน้ำเงิน</b> = ถูกสุดในแถว</span></div>
    <label class="f" style="flex:0 0 170px">ราคา ณ วันที่<input class="inp" type="date" id="pq-d" value="${esc(at)}"></label>
    ${edit ? `<button class="btn pri" id="pq-add">${icon('plus', 16)}ออกราคาใหม่</button>` : ''}</div>
  ${blocks.length ? blocks.map(table).join('') : empty(all.length ? 'ยังไม่มีราคาที่ออกก่อนวันที่นี้' : 'ยังไม่มีราคา — กด "ออกราคาใหม่" เพื่อกรอกจากบันทึก สทล.2')}
  ${issued.length ? `<div class="row wrap small" style="gap:6px"><span class="muted">ราคาที่ออกแล้ว:</span>${issued.map((d) => `<button class="chip" data-go="${esc(d.period)}">${thDate(d.period)} • ${esc(d.source)}</button>`).join('')}</div>` : ''}`;
  $('#pq-d').onchange = (e) => { if (e.target.value) { ui.date = e.target.value; view(main, '', app); } };
  on(main, '[data-go]', 'click', (e, b) => { ui.date = b.dataset.go; view(main, '', app); });
  if ($('#pq-add')) $('#pq-add').onclick = () => docForm('quarry', null, at, main, app);
  on(main, '[data-ed]', 'click', (e, b) => docForm('quarry', S.db.MatDocs.find((d) => d.doc_id === b.dataset.ed), at, main, app));
}

/* ---------- คอนกรีตผสมเสร็จ / ปูนซีเมนต์: พาณิชย์จังหวัด (อัตโนมัติ) • แต่ละจังหวัดใช้เดือนล่าสุดที่ประกาศ ---------- */
function concrete(main, app, head) {
  const all = S.db.MatDocs.filter((d) => d.kind === 'concrete' || d.kind === 'cement');
  const months = uniq(all.map((d) => d.period)).sort();
  const cur = ui.cmonth || months[months.length - 1] || iso(today()).slice(0, 7), provs = provinces();
  const section = (kind, title, short) => {
    const ds = all.filter((d) => d.kind === kind && d.period <= cur);
    const per = {};
    provs.forEach((a) => {
      const d = ds.filter((x) => pricesOf(x.doc_id).some((r) => r.area === a)).sort(by('period')).pop();
      if (d) { per[a] = { period: d.period, p: {} }; pricesOf(d.doc_id).filter((r) => r.area === a).forEach((r) => (per[a].p[r.item] = r)); }
    });
    const areas = provs.filter((a) => per[a]);
    if (!areas.length) return '';
    const names = uniq(areas.flatMap((a) => Object.keys(per[a].p))).sort();
    return `<section class="card flush scroll-x"><div style="padding:14px 18px 4px"><h2 style="margin:0">${title}</h2></div>
      <table class="tbl"><thead><tr><th style="padding-left:18px">รายการ</th>${areas.map((a) => `<th class="r">${esc(a)}${per[a].period !== cur ? `<br><span class="faint">${thMonth(per[a].period)}</span>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${names.map((n) => { const rs = areas.map((a) => per[a].p[n]), low = lowest(rs.map((r) => r && r.price)), u = (rs.find(Boolean) || {}).unit; return `<tr><td style="padding-left:18px" title="${esc(n)}">${esc(short(n))} <span class="faint small">${esc(u ? 'บาท/' + u : '')}</span></td>${rs.map((r) => cell(r && r.price, low)).join('')}</tr>`; }).join('')}</tbody></table></section>`;
  };
  const body = section('concrete', 'คอนกรีตผสมเสร็จ', shortConcrete) + section('cement', 'ปูนซีเมนต์', (n) => n);
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>คอนกรีต / ปูนซีเมนต์ • ${thMonth(cur)}</h1><span class="muted small">พาณิชย์จังหวัด ดึงอัตโนมัติ • ไม่รวม VAT • แต่ละจังหวัดใช้เดือนล่าสุดที่ประกาศ (ถ้าไม่ใช่เดือนนี้ แสดงใต้ชื่อจังหวัด) • <b style="color:#2F5C9E">สีน้ำเงิน</b> = ถูกสุดในแถว</span></div>
    <label class="f" style="flex:0 0 170px">เดือน<input class="inp" type="month" id="pc-m" value="${esc(cur)}"></label></div>
  ${body || empty('ยังไม่มีราคาเดือนนี้ — ระบบดึงจากพาณิชย์จังหวัดให้อัตโนมัติทุกเช้า')}`;
  $('#pc-m').onchange = (e) => { if (e.target.value) { ui.cmonth = e.target.value; view(main, '', app); } };
}

/* ---------- ฟอร์มกรอกราคา (ใบสืบยาง / ออกราคาวัสดุจากแหล่ง) ---------- */
function docForm(kind, doc, period, main, app) {
  const isA = kind === 'asphalt', provs = provinces(), old = doc ? pricesOf(doc.doc_id) : [];
  const f = doc ? { ...doc } : { source: isA ? 'Tipco' : 'สทล.2', period: isA ? period : iso(today()), doc_no: '', doc_date: iso(today()), note: '', file_url: '' };
  const val = {}; old.forEach((r) => (val[r.item + '|' + r.area] = r));
  const v = (n, a, k) => { const r = val[n + '|' + a]; return r && num(r[k]) ? r[k] : ''; };
  const names = uniq(items(kind).map((i) => i.name).concat(old.map((r) => r.item)));
  const srcs = uniq((isA ? ['Tipco', 'Zola'] : ['สทล.2']).concat(docsOf(kind).map((d) => d.source))).filter((s) => !AUTO.includes(s));
  const inp = (n, a, k, w) => `<td><input class="inp num" style="height:36px;min-width:${w}px" data-n="${esc(n)}" data-a="${esc(a)}" data-k="${k}" value="${esc(v(n, a, k))}" inputmode="decimal"></td>`;
  const bo = bulkOnly();
  const row = (n) => `<tr><td><b>${esc(n)}</b></td>${isA ? inp(n, '-', 'price', 110) + (bo.has(n) ? '<td></td>' : inp(n, '-', 'price2', 110)) : provs.map((a) => inp(n, a, 'price', 90)).join('')}</tr>`;
  modal(`${modalHead(doc ? 'แก้ไขราคา ' + doc.source : isA ? 'กรอกราคายางจากใบสืบ' : 'ออกราคาวัสดุจากแหล่ง', isA ? 'ไม่รวม VAT • Bulk = บาท/ตัน • ช่องว่าง = ไม่มีราคา' : 'มีผลตั้งแต่วันที่ออกราคา จนกว่าจะออกราคาใหม่ • ช่องว่าง = ไม่มีราคา')}
    <div class="fgrid">
      <label class="f">${isA ? 'บริษัท / แหล่งราคา *' : 'แหล่งราคา *'}<select class="inp" id="md-srcsel">${srcs.map((s) => `<option ${s === f.source ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__new">+ เพิ่ม${isA ? 'บริษัท' : 'แหล่ง'}ใหม่…</option></select></label>
      <label class="f" id="md-srcnew" style="display:none">ชื่อ${isA ? 'บริษัท' : 'แหล่ง'}ใหม่ *<input class="inp" id="md-src" placeholder="${isA ? 'เช่น Shell, ESSO, บจก. …' : 'เช่น สทล.2'}"></label>
      <label class="f">${isA ? 'เดือน *' : 'วันที่ออกราคา (มีผล) *'}<input class="inp" type="${isA ? 'month' : 'date'}" id="md-per" value="${esc(f.period)}"></label>
      <label class="f">เลขที่เอกสาร<input class="inp" id="md-no" value="${esc(f.doc_no || '')}"></label>
      ${isA ? `<label class="f">วันที่ในใบสืบ<input class="inp" type="date" id="md-dd" value="${esc(f.doc_date || '')}"></label>` : ''}
    </div>
    <label class="f">ลิงก์ไฟล์เอกสาร (Google Drive ฯลฯ)<input class="inp" id="md-url" value="${esc(f.file_url || '')}" placeholder="https://"></label>
    <label class="f">หมายเหตุ<input class="inp" id="md-note" value="${esc(f.note || '')}" placeholder="${isA ? '' : 'เช่น ราคาประชุมเมื่อ … • ไม่รวม VAT 7%'}"></label>
    <div class="scroll-x" style="max-height:46vh;overflow-y:auto"><table class="tbl"><thead><tr><th>${isA ? 'ชนิดยาง' : 'วัสดุ'}</th>${isA ? '<th class="r">Bulk</th><th class="r">บรรจุภัณฑ์</th>' : provs.map((a) => `<th class="r">${esc(a)}</th>`).join('')}</tr></thead>
      <tbody id="md-rows">${names.map(row).join('')}</tbody></table></div>
    <div class="row wrap" style="gap:8px"><input class="inp" id="md-newitem" style="flex:1 1 220px" placeholder="${isA ? 'ชนิดยางที่ไม่มีในรายการ' : 'วัสดุที่ไม่มีในรายการ'}"><button class="btn sm" id="md-additem">${icon('plus', 14)}เพิ่มแถว</button></div>
    <span class="faint small">รายการประจำแก้ได้ที่ ตั้งค่า › รายการวัสดุ</span>
    <span class="err" id="md-err"></span>
    <div class="dlg-foot">${doc ? '<button class="btn danger" id="md-del" style="margin-right:auto">ลบชุดราคานี้</button>' : ''}<button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="md-save">บันทึก</button></div>`, { wide: true });
  const err = (m) => ($('#md-err').textContent = m);
  const done = (msg) => { closeModal(); toast(msg); view(main, kind, app); };
  const sel = $('#md-srcsel'), box = $('#md-srcnew');
  const showNew = () => { box.style.display = sel.value === '__new' ? '' : 'none'; if (sel.value === '__new') $('#md-src').focus(); };
  if (!srcs.length) sel.value = '__new';
  sel.onchange = showNew; showNew();
  const source = () => (sel.value === '__new' ? $('#md-src').value : sel.value).trim();
  $('#md-additem').onclick = () => {
    const n = $('#md-newitem').value.trim();
    if (!n) return err('พิมพ์ชื่อรายการก่อนกดเพิ่มแถว');
    if ($$('#md-rows tr').some((tr) => tr.cells[0].textContent === n)) return err(`"${n}" มีอยู่แล้ว`);
    $('#md-rows').insertAdjacentHTML('beforeend', row(n)); $('#md-newitem').value = ''; err('');
    $$('#md-rows tr').pop().querySelector('input').focus();
  };
  $('#md-save').onclick = async (e) => {
    const b = e.currentTarget, prices = {};
    $$('#modal-root [data-n]').forEach((el) => { const k = el.dataset.n + '|' + el.dataset.a; const o = prices[k] || (prices[k] = { item: el.dataset.n, area: el.dataset.a, price: '', price2: '' }); o[el.dataset.k] = el.value.replace(/,/g, '').trim(); });
    const bad = Object.values(prices).find((o) => [o.price, o.price2].some((x) => x !== '' && isNaN(Number(x))));
    if (bad) return err(`ราคา "${bad.item}" ต้องเป็นตัวเลข`);
    if (!source()) return err(`กรุณาใส่ชื่อ${isA ? 'บริษัท' : 'แหล่ง'}`);
    const d = { kind, source: source(), period: $('#md-per').value, doc_no: $('#md-no').value.trim(), doc_date: isA ? $('#md-dd').value : $('#md-per').value, file_url: $('#md-url').value.trim(), note: $('#md-note').value.trim() };
    if (doc) d.doc_id = doc.doc_id;
    busy(b);
    try {
      const r = await call('saveMatDoc', { doc: d, prices: Object.values(prices) });
      S.db.MatDocs = S.db.MatDocs.filter((x) => x.doc_id !== r.doc.doc_id).concat([r.doc]);
      S.db.MatPrices = S.db.MatPrices.filter((x) => x.doc_id !== r.doc.doc_id).concat(r.prices);
      if (isA) ui.month = r.doc.period; else ui.date = r.doc.period;
      done('บันทึกราคาแล้ว');
    } catch (x) { err(x.message); busy(b, false); }
  };
  const del = $('#md-del');
  if (del) del.onclick = async () => {
    if (!confirm('ลบราคาชุดนี้ทั้งหมด?')) return;
    busy(del);
    try {
      await call('deleteMatDoc', { doc_id: doc.doc_id });
      S.db.MatDocs = S.db.MatDocs.filter((x) => x.doc_id !== doc.doc_id);
      S.db.MatPrices = S.db.MatPrices.filter((x) => x.doc_id !== doc.doc_id);
      done('ลบแล้ว');
    } catch (x) { err(x.message); busy(del, false); }
  };
}
