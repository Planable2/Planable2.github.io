// ===== ราคาวัสดุ: น้ำมัน • ยางแอสฟัลต์ • วัสดุจากแหล่ง • คอนกรีต / ปูน • เหล็กเส้น • ท่อ คสล. =====
import { S, cfg, can, units } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, iso, today, thDate, truthy, by, uniq, loadXLSX } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, icon, empty } from '../ui.js';
import { fuel } from './misc.js';

const SUBS = [['fuel', 'น้ำมัน'], ['asphalt', 'ยางแอสฟัลต์'], ['quarry', 'วัสดุจากแหล่ง'], ['concrete', 'คอนกรีต / ปูนซีเมนต์'], ['steel', 'เหล็กเส้น'], ['pipe', 'ท่อ คสล.']];
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
  if (ui.sub === 'steel') return steel(main, app, head);
  if (ui.sub === 'pipe') return pipe(main, app, head);
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
/** หินผสมแอสฟัลต์ = ระบบคำนวณเอง (ไม่มีช่องกรอก): หินฝุ่น×0.40 + หิน 3/8"×0.30 + หิน 1/2"×0.20 + หิน 3/4"×0.10 */
const MIX_NAME = 'หินผสมแอสฟัลต์';
const MIX = [['หินฝุ่น', 0.40], ['หิน 3/8"', 0.30], ['หิน 1/2"', 0.20], ['หิน 3/4"', 0.10]];
function mixPrice(p, area) {
  let s = 0;
  for (const [n, w] of MIX) { const k = Object.keys(p).find((x) => normName(x) === normName(n)), v = k && p[k][area]; if (!num(v)) return null; s += Number(v) * w; }
  return Math.round(s * 100) / 100;
}
function quarry(main, app, head) {
  const all = docsOf('quarry'), at = ui.date || iso(today()), provs = provinces(), edit = can('edit_price');
  const blocks = uniq(all.map((d) => d.source).sort()).map((s) => all.filter((d) => d.source === s && d.period <= at).sort(by('period')).pop()).filter(Boolean);
  const unit = (n) => (items('quarry').find((i) => i.name === n) || {}).unit || '';
  const table = (d) => {
    const p = {}; pricesOf(d.doc_id).forEach((r) => ((p[r.item] = p[r.item] || {})[r.area] = r.price));
    const areas = uniq(provs.concat(Object.values(p).flatMap((o) => Object.keys(o)))).filter((a) => Object.values(p).some((o) => num(o[a])));
    const names = uniq(items('quarry').map((i) => i.name).concat(Object.keys(p))).filter((n) => p[n] && normName(n) !== normName(MIX_NAME));
    const mix = areas.map((a) => mixPrice(p, a)), at_ = names.findIndex((n) => normName(n) === normName('หินผสมคอนกรีต'));
    const mixRow = mix.some((x) => x !== null) ? `<tr class="mixrow"><td style="padding-left:18px;white-space:nowrap"><b>${MIX_NAME}</b> <span class="faint small">บาท/ลบ.ม.</span> <span class="tag" data-tip="คำนวณอัตโนมัติ|หินฝุ่น × 0.40|หิน 3/8&quot; × 0.30|หิน 1/2&quot; × 0.20|หิน 3/4&quot; × 0.10">คำนวณ</span></td>${mix.map((x) => cell(x, lowest(mix))).join('')}</tr>` : '';
    const rowOf = (n) => { const low = lowest(areas.map((a) => p[n][a])); return `<tr><td style="padding-left:18px;white-space:nowrap"><b>${esc(n)}</b> <span class="faint small">${esc(unit(n))}</span></td>${areas.map((a) => cell(p[n][a], low)).join('')}</tr>`; };
    const bodyRows = names.map(rowOf); bodyRows.splice(at_ >= 0 ? at_ + 1 : bodyRows.length, 0, mixRow);
    return `<section class="card flush scroll-x">
      <div class="row wrap" style="padding:14px 18px 6px"><span class="grow"><b>${esc(d.source)}</b> • ราคาที่ออกเมื่อ ${thDate(d.period)}${fileLink(d)}${d.doc_no || d.note ? `<br><span class="faint small">${esc([d.doc_no, d.note].filter(Boolean).join(' • '))}</span>` : ''}</span>${edit ? `<button class="btn sm" data-ed="${esc(d.doc_id)}">แก้ไข</button>` : ''}</div>
      <table class="tbl"><thead><tr><th style="padding-left:18px">วัสดุ</th>${areas.map((a) => `<th class="r">${esc(a)}</th>`).join('')}</tr></thead>
      <tbody>${bodyRows.join('')}</tbody></table></section>`;
  };
  const issued = all.slice().sort(by('period')).reverse();
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>ราคาวัสดุจากแหล่ง</h1><span class="muted small">ใช้ราคาที่ออกล่าสุด ณ วันที่เลือก • <b style="color:#2F5C9E">สีน้ำเงิน</b> = ถูกสุดในแถว • หินผสมแอสฟัลต์ = หินฝุ่น×0.40 + หิน 3/8"×0.30 + หิน 1/2"×0.20 + หิน 3/4"×0.10 (คำนวณอัตโนมัติ)</span></div>
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
  const body = areaSection('concrete', 'คอนกรีตผสมเสร็จ', shortConcrete, cur, provs) + areaSection('cement', 'ปูนซีเมนต์', (n) => n, cur, provs);
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>คอนกรีต / ปูนซีเมนต์ • ${thMonth(cur)}</h1><span class="muted small">พาณิชย์จังหวัด ดึงอัตโนมัติ • ไม่รวม VAT • แต่ละจังหวัดใช้เดือนล่าสุดที่ประกาศ (ถ้าไม่ใช่เดือนนี้ แสดงใต้ชื่อจังหวัด) • <b style="color:#2F5C9E">สีน้ำเงิน</b> = ถูกสุดในแถว</span></div>
    <label class="f" style="flex:0 0 170px">เดือน<input class="inp" type="month" id="pc-m" value="${esc(cur)}"></label></div>
  ${body || empty('ยังไม่มีราคาเดือนนี้ — ระบบดึงจากพาณิชย์จังหวัดให้อัตโนมัติทุกเช้า')}`;
  $('#pc-m').onchange = (e) => { if (e.target.value) { ui.cmonth = e.target.value; view(main, '', app); } };
}

/* ---------- ฟอร์มกรอกราคา (ใบสืบยาง / ออกราคาวัสดุจากแหล่ง) ---------- */
function docForm(kind, doc, period, main, app) {
  const isA = kind === 'asphalt', provs = provinces();
  // ออกราคาวัสดุจากแหล่งชุดใหม่: เริ่มจากราคาชุดล่าสุด (ชุดใหม่แทนที่ทั้งชุด — ถ้าเริ่มว่างจะทำให้รายการอื่นหายจากราคาปัจจุบัน)
  const last = !doc && !isA ? docsOf(kind).filter((d) => d.period <= iso(today())).sort(by('period')).pop() : null;
  const old = doc ? pricesOf(doc.doc_id) : last ? pricesOf(last.doc_id) : [];
  const f = doc ? { ...doc } : { source: isA ? 'Tipco' : last ? last.source : 'สทล.2', period: isA ? period : iso(today()), doc_no: '', doc_date: iso(today()), note: last ? last.note || '' : '', file_url: '' };
  const val = {}; old.forEach((r) => (val[r.item + '|' + r.area] = r));
  const v = (n, a, k) => { const r = val[n + '|' + a]; return r && num(r[k]) ? r[k] : ''; };
  const names = uniq(items(kind).map((i) => i.name).concat(old.map((r) => r.item))).filter((n) => isA || normName(n) !== normName(MIX_NAME));
  const srcs = uniq((isA ? ['Tipco', 'Zola'] : ['สทล.2']).concat(docsOf(kind).map((d) => d.source))).filter((s) => !AUTO.includes(s));
  const inp = (n, a, k, w) => `<td><input class="inp num" style="height:36px;min-width:${w}px" data-n="${esc(n)}" data-a="${esc(a)}" data-k="${k}" value="${esc(v(n, a, k))}" inputmode="decimal"></td>`;
  const bo = bulkOnly();
  const row = (n) => `<tr><td><b>${esc(n)}</b></td>${isA ? inp(n, '-', 'price', 110) + (bo.has(n) ? '<td></td>' : inp(n, '-', 'price2', 110)) : provs.map((a) => inp(n, a, 'price', 90)).join('')}</tr>`;
  modal(`${modalHead(doc ? 'แก้ไขราคา ' + doc.source : isA ? 'กรอกราคายางจากใบสืบ' : 'ออกราคาวัสดุจากแหล่ง', isA ? 'ไม่รวม VAT • Bulk = บาท/ตัน • ช่องว่าง = ไม่มีราคา' : 'มีผลตั้งแต่วันที่ออกราคา จนกว่าจะออกราคาใหม่ • ช่องว่าง = ไม่มีราคา' + (last ? ` • เริ่มจากราคาที่ออกเมื่อ ${thDate(last.period)} แก้เฉพาะที่เปลี่ยน` : ''))}
    <div class="fgrid">
      <label class="f">${isA ? 'บริษัท / แหล่งราคา *' : 'แหล่งราคา *'}<select class="inp" id="md-srcsel">${srcs.map((s) => `<option ${s === f.source ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__new">+ เพิ่ม${isA ? 'บริษัท' : 'แหล่ง'}ใหม่…</option></select></label>
      <label class="f" id="md-srcnew" style="display:none">ชื่อ${isA ? 'บริษัท' : 'แหล่ง'}ใหม่ *<input class="inp" id="md-src" placeholder="${isA ? 'เช่น Shell, ESSO, บจก. …' : 'เช่น สทล.2'}"></label>
      <label class="f">${isA ? 'เดือน *' : 'วันที่ออกราคา (มีผล) *'}<input class="inp" type="${isA ? 'month' : 'date'}" id="md-per" value="${esc(f.period)}"></label>
      <label class="f">เลขที่เอกสาร<input class="inp" id="md-no" value="${esc(f.doc_no || '')}"></label>
      ${isA ? `<label class="f">วันที่ในใบสืบ<input class="inp" type="date" id="md-dd" value="${esc(f.doc_date || '')}"></label>` : ''}
    </div>
    <label class="f">ลิงก์ไฟล์เอกสาร (Google Drive ฯลฯ)<input class="inp" id="md-url" value="${esc(f.file_url || '')}" placeholder="https://"></label>
    <label class="f">หมายเหตุ<input class="inp" id="md-note" value="${esc(f.note || '')}" placeholder="${isA ? '' : 'เช่น ราคาประชุมเมื่อ … • ไม่รวม VAT 7%'}"></label>
    ${isA ? '' : `<div class="row wrap" style="gap:8px"><label class="btn sm">${icon('up', 14)}กรอกจากไฟล์ (Excel / PDF)<input type="file" id="md-file" accept=".xlsx,.xls,.csv,.pdf" hidden></label><span class="faint small" id="md-msg">ไฟล์ต้องมีหัวตารางชื่อจังหวัด และชื่อวัสดุอยู่ต้นแถว • หินผสมแอสฟัลต์ระบบคำนวณให้เอง</span></div>`}
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
  const fileIn = $('#md-file');
  if (fileIn) fileIn.onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const msg = $('#md-msg'); msg.textContent = 'กำลังอ่านไฟล์…'; err('');
    try {
      const got = parseQuarry(await readTable(file), provs).filter((g) => normName(g.name) !== normName(MIX_NAME));
      let n = 0, added = 0;
      got.forEach((g) => {
        let tr = $$('#md-rows tr').find((x) => normName(x.cells[0].textContent) === normName(g.name)) || $$('#md-rows tr').find((x) => { const a = normName(x.cells[0].textContent), b = normName(g.name); return a.length > 2 && (b.startsWith(a) || a.startsWith(b)); });
        if (!tr) { $('#md-rows').insertAdjacentHTML('beforeend', row(g.name)); tr = $$('#md-rows tr').pop(); added++; }
        Object.entries(g.vals).forEach(([a, v]) => { const el = tr.querySelector(`[data-a="${CSS.escape(a)}"]`); if (el) { el.value = v; n++; } });
      });
      if (!n) throw new Error('อ่านไฟล์ได้แต่ไม่พบราคาที่ตรงกับรายการวัสดุ/จังหวัด');
      msg.textContent = `กรอกจากไฟล์แล้ว ${n} ช่อง${added ? ` (เพิ่มแถวใหม่ ${added} รายการ)` : ''} — ตรวจทานก่อนบันทึก`;
    } catch (x) { msg.textContent = ''; err(x.message); }
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

/* ---------- เหล็กเส้น: พาณิชย์จังหวัด + กรุงเทพฯ (อัตโนมัติ) ---------- */
const shortSteel = (n) => n.replace(/^เหล็กเส้นกลมผิวเรียบ\s*/, 'กลม ').replace(/^เหล็กเส้นกลมข้ออ้อย\s*/, 'ข้ออ้อย ').replace(/^เหล็กเส้น\s*/, '')
  .replace(/มอก\.\s*[\d-]+\s*/, '').replace(/ขนาดเส้นผ่านศูนย์กลาง\s*/, 'Ø').replace(/\s*ยาว\s*10\s*เมตร/, '').replace(/\s+/g, ' ').trim();
const natural = (a, b) => a.localeCompare(b, 'th', { numeric: true });
function steel(main, app, head) {
  const all = docsOf('steel'), months = uniq(all.map((d) => d.period)).sort();
  const cur = ui.smonth || months[months.length - 1] || iso(today()).slice(0, 7);
  const body = areaSection('steel', 'เหล็กเส้น (บาท/ตัน)', shortSteel, cur, ['กรุงเทพฯ'].concat(provinces()));
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>ราคาเหล็กเส้น • ${thMonth(cur)}</h1><span class="muted small">พาณิชย์จังหวัด + กรุงเทพฯ (ราคาส่วนกลาง) ดึงอัตโนมัติ • ไม่รวม VAT • แต่ละพื้นที่ใช้เดือนล่าสุดที่ประกาศ • <b style="color:#2F5C9E">สีน้ำเงิน</b> = ถูกสุดในแถว</span></div>
    <label class="f" style="flex:0 0 170px">เดือน<input class="inp" type="month" id="ps-m" value="${esc(cur)}"></label></div>
  ${body || empty('ยังไม่มีราคาเหล็กเส้น — ระบบดึงจากพาณิชย์ให้อัตโนมัติทุกเช้า (ครั้งแรกสั่งย้อนหลังได้ที่ GitHub › Actions › material-price › Run workflow)')}`;
  $('#ps-m').onchange = (e) => { if (e.target.value) { ui.smonth = e.target.value; view(main, '', app); } };
}

/** ตารางราคาแยกพื้นที่ (คอนกรีต / ปูน / เหล็กเส้น): แต่ละพื้นที่ใช้เดือนล่าสุด ≤ เดือนที่เลือก */
function latestByArea(kind, cur, areas) {
  const ds = S.db.MatDocs.filter((d) => d.kind === kind && d.period <= cur), per = {};
  areas.forEach((a) => {
    const d = ds.filter((x) => pricesOf(x.doc_id).some((r) => r.area === a)).sort(by('period')).pop();
    if (d) { per[a] = { period: d.period, p: {} }; pricesOf(d.doc_id).filter((r) => r.area === a).forEach((r) => (per[a].p[r.item] = r)); }
  });
  return per;
}
function areaSection(kind, title, short, cur, areaList) {
  const per = latestByArea(kind, cur, areaList), areas = areaList.filter((a) => per[a]);
  if (!areas.length) return '';
  const names = uniq(areas.flatMap((a) => Object.keys(per[a].p))).sort(natural);
  return `<section class="card flush scroll-x"><div style="padding:14px 18px 4px"><h2 style="margin:0">${title}</h2></div>
    <table class="tbl"><thead><tr><th style="padding-left:18px">รายการ</th>${areas.map((a) => `<th class="r">${esc(a)}${per[a].period !== cur ? `<br><span class="faint">${thMonth(per[a].period)}</span>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${names.map((n) => { const rs = areas.map((a) => per[a].p[n]), low = lowest(rs.map((r) => r && r.price)), u = (rs.find(Boolean) || {}).unit; return `<tr><td style="padding-left:18px" title="${esc(n)}">${esc(short(n))} <span class="faint small">${esc(u ? 'บาท/' + u : '')}</span></td>${rs.map((r) => cell(r && r.price, low)).join('')}</tr>`; }).join('')}</tbody></table></section>`;
}

/* ---------- ท่อ คสล. ของแต่ละแขวง (กรอกเอง รายเดือน) ---------- */
// source = หน่วยงาน (แขวง) • item = โรงงาน • area = Ø (ม.) • price = มอก. ชั้น 2 • price2 = ชั้น 3 • unit = ที่ตั้งโรงงาน
export const PIPE_DIA = ['0.30', '0.40', '0.60', '0.80', '1.00', '1.20', '1.50'];
const pipeUnits = () => units().filter((u) => u.kind !== 'เขต').map((u) => u.name);
function pipeData(d) {
  const f = {};
  pricesOf(d.doc_id).forEach((r) => { const o = f[r.item] || (f[r.item] = { name: r.item, loc: r.unit || '', c2: {}, c3: {} }); o.c2[r.area] = r.price; o.c3[r.area] = r.price2; if (r.unit) o.loc = r.unit; });
  return Object.values(f);
}
function pipe(main, app, head) {
  const all = docsOf('pipe'), months = uniq(all.map((d) => d.period)).sort(), edit = can('edit_price');
  const cur = ui.pmonth || months[months.length - 1] || iso(today()).slice(0, 7);
  const srcs = uniq(pipeUnits().concat(all.map((d) => d.source)));
  const blocks = srcs.map((s) => all.filter((d) => d.source === s && d.period <= cur).sort(by('period')).pop()).filter(Boolean);
  const card = (d) => {
    const fs = pipeData(d), low = (k, dia) => lowest(fs.map((f) => f[k][dia]));
    return `<section class="card flush scroll-x">
      <div class="row wrap" style="padding:14px 18px 6px"><span class="grow"><b>${esc(d.source)}</b> • ราคาเดือน ${thMonth(d.period)}${fileLink(d)}${d.doc_no || d.note ? `<br><span class="faint small">${esc([d.doc_no, d.note].filter(Boolean).join(' • '))}</span>` : ''}</span>${edit ? `<button class="btn sm" data-pe="${esc(d.doc_id)}">แก้ไข</button>` : ''}</div>
      <table class="tbl pipetbl"><thead><tr><th rowspan="2" style="padding-left:18px">โรงงาน / ที่ตั้ง</th><th colspan="${PIPE_DIA.length}" class="center">มอก. ชั้น 2 (บาท/ม.)</th><th colspan="${PIPE_DIA.length}" class="center pc3">มอก. ชั้น 3 (บาท/ม.)</th></tr>
        <tr>${['c2', 'c3'].map((k) => PIPE_DIA.map((x, i) => `<th class="r faint ${k === 'c3' && !i ? 'pc3' : ''}">Ø ${x}</th>`).join('')).join('')}</tr></thead>
      <tbody>${fs.map((f) => `<tr><td style="padding-left:18px;min-width:220px"><b>${esc(f.name)}</b>${f.loc ? `<br><span class="faint small">${esc(f.loc)}</span>` : ''}</td>${['c2', 'c3'].map((k) => PIPE_DIA.map((x, i) => cell(f[k][x], low(k, x)).replace('<td class="r num"', `<td class="r num${k === 'c3' && !i ? ' pc3' : ''}"`)).join('')).join('')}</tr>`).join('')}</tbody></table></section>`;
  };
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>ราคาท่อ คสล. • ${thMonth(cur)}</h1><span class="muted small">ราคา ณ โรงงานในพื้นที่แต่ละแขวง • บาท/ม. • ไม่รวม VAT ไม่รวมค่าขนส่ง • แต่ละแขวงใช้เดือนล่าสุดที่กรอก • <b style="color:#2F5C9E">สีน้ำเงิน</b> = ถูกสุดในแขวง</span></div>
    <label class="f" style="flex:0 0 170px">เดือน<input class="inp" type="month" id="pp-m" value="${esc(cur)}"></label>
    ${edit ? `<button class="btn pri" id="pp-add">${icon('plus', 16)}กรอกราคาท่อ</button>` : ''}</div>
  ${blocks.length ? blocks.map(card).join('') : empty('ยังไม่มีราคาท่อ — กด "กรอกราคาท่อ" แล้วกรอกเอง หรือนำเข้าจากไฟล์ Excel')}`;
  $('#pp-m').onchange = (e) => { if (e.target.value) { ui.pmonth = e.target.value; view(main, '', app); } };
  if ($('#pp-add')) $('#pp-add').onclick = () => pipeForm(null, cur, main, app);
  on(main, '[data-pe]', 'click', (e, b) => pipeForm(S.db.MatDocs.find((d) => d.doc_id === b.dataset.pe), cur, main, app));
}

function pipeForm(doc, month, main, app) {
  const us = uniq(pipeUnits().concat(doc ? [doc.source] : []));
  const f = doc ? { ...doc } : { source: us[0] || '', period: month, doc_no: '', note: 'ไม่รวม VAT 7% • ไม่รวมค่าขนส่ง', file_url: '' };
  const copy = (d) => (d ? pipeData(d).map((x) => ({ name: x.name, loc: x.loc, c2: { ...x.c2 }, c3: { ...x.c3 } })) : []);
  /** กรอกเดือนใหม่: เริ่มจากราคาเดือนล่าสุดของแขวงนั้น (แก้เฉพาะที่เปลี่ยน) */
  const latestOf = (s) => docsOf('pipe').filter((d) => d.source === s && d.period <= f.period).sort(by('period')).pop();
  let rows = copy(doc || latestOf(f.source));
  if (!rows.length) rows.push({ name: '', loc: '', c2: {}, c3: {} });
  const v = (x) => (num(x) ? x : '');
  const rowHtml = (r, i) => `<tr data-r="${i}"><td><input class="inp" data-f="name" value="${esc(r.name)}" placeholder="ชื่อโรงงาน" style="min-width:190px;height:36px"><input class="inp" data-f="loc" value="${esc(r.loc)}" placeholder="ที่ตั้ง / กม. / พิกัด" style="min-width:190px;height:32px;margin-top:4px;font-size:12px"></td>
    ${['c2', 'c3'].map((k) => PIPE_DIA.map((x) => `<td><input class="inp num" data-k="${k}" data-d="${x}" value="${esc(v(r[k][x]))}" inputmode="decimal" style="width:84px;height:36px"></td>`).join('')).join('')}
    <td><button class="icon-btn sm" data-rm="${i}" aria-label="ลบโรงงาน">${icon('x', 14)}</button></td></tr>`;
  modal(`${modalHead(doc ? 'แก้ไขราคาท่อ ' + doc.source : 'กรอกราคาท่อ คสล.', 'บาท/ม. • ไม่รวม VAT • ช่องว่าง = ไม่มีราคา • นำเข้าจากไฟล์ Excel / PDF (ที่มีตัวอักษร) ได้')}
    <div class="fgrid">
      <label class="f">แขวง *<select class="inp" id="pf-src">${us.map((s) => `<option ${s === f.source ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="f">เดือน *<input class="inp" type="month" id="pf-per" value="${esc(f.period)}"></label>
      <label class="f">เลขที่เอกสาร<input class="inp" id="pf-no" value="${esc(f.doc_no || '')}"></label>
    </div>
    <div class="fgrid"><label class="f">ลิงก์ไฟล์เอกสาร<input class="inp" id="pf-url" value="${esc(f.file_url || '')}" placeholder="https://"></label><label class="f">หมายเหตุ<input class="inp" id="pf-note" value="${esc(f.note || '')}"></label></div>
    <div class="row wrap" style="gap:8px"><label class="btn sm">${icon('up', 14)}กรอกจากไฟล์ (Excel / PDF)<input type="file" id="pf-file" accept=".xlsx,.xls,.csv,.pdf" hidden></label><button class="btn sm" id="pf-tpl">${icon('download', 14)}แม่แบบ Excel</button><span class="faint small" id="pf-msg"></span></div>
    <div class="scroll-x" style="max-height:48vh;overflow-y:auto"><table class="tbl"><thead><tr><th rowspan="2">โรงงาน / ที่ตั้ง</th><th colspan="7" class="center">มอก. ชั้น 2</th><th colspan="7" class="center">มอก. ชั้น 3</th><th rowspan="2"></th></tr>
      <tr>${PIPE_DIA.concat(PIPE_DIA).map((x) => `<th class="r faint">Ø ${x}</th>`).join('')}</tr></thead><tbody id="pf-rows"></tbody></table></div>
    <button class="btn sm" id="pf-addrow" style="align-self:flex-start">${icon('plus', 14)}เพิ่มโรงงาน</button>
    <span class="err" id="pf-err"></span>
    <div class="dlg-foot">${doc ? '<button class="btn danger" id="pf-del" style="margin-right:auto">ลบชุดราคานี้</button>' : ''}<button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="pf-save">บันทึก</button></div>`, { wide: true });
  const err = (m) => ($('#pf-err').textContent = m);
  const sync = () => $$('#pf-rows tr').forEach((tr) => { const r = rows[tr.dataset.r]; $$('[data-f]', tr).forEach((el) => (r[el.dataset.f] = el.value.trim())); $$('[data-k]', tr).forEach((el) => (r[el.dataset.k][el.dataset.d] = el.value.replace(/,/g, '').trim())); });
  const draw = () => { $('#pf-rows').innerHTML = rows.map(rowHtml).join(''); on($('#pf-rows'), '[data-rm]', 'click', (e, b) => { sync(); rows.splice(Number(b.dataset.rm), 1); if (!rows.length) rows.push({ name: '', loc: '', c2: {}, c3: {} }); draw(); }); };
  draw();
  if (!doc) $('#pf-src').onchange = (e) => { f.source = e.target.value; rows = copy(latestOf(f.source)); if (!rows.length) rows.push({ name: '', loc: '', c2: {}, c3: {} }); draw(); const l = latestOf(f.source); $('#pf-msg').textContent = l ? `เริ่มจากราคาเดือน ${thMonth(l.period)} ของแขวงนี้ — แก้เฉพาะที่เปลี่ยน` : ''; };
  if (!doc && latestOf(f.source)) $('#pf-msg').textContent = `เริ่มจากราคาเดือน ${thMonth(latestOf(f.source).period)} ของแขวงนี้ — แก้เฉพาะที่เปลี่ยน`;
  $('#pf-addrow').onclick = () => { sync(); rows.push({ name: '', loc: '', c2: {}, c3: {} }); draw(); };
  $('#pf-tpl').onclick = async () => {
    try { await loadXLSX(); } catch (x) { return toast(x.message, 'err'); }
    const aoa = [['โรงงาน', 'ที่ตั้ง'].concat(PIPE_DIA.map((x) => 'ชั้น 2 Ø' + x), PIPE_DIA.map((x) => 'ชั้น 3 Ø' + x)), ['โรงหล่อท่อ หจก.ตัวอย่าง', 'ทล.101 กม.231+800 LT • ต.… อ.… จ.…', '', 611, 845, 1430, 2730, 3705, '', '', 470, 650, 1100, 2100, 2850, '']];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'ท่อ คสล.'); XLSX.writeFile(wb, 'แม่แบบราคาท่อ.xlsx');
  };
  $('#pf-file').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const msg = $('#pf-msg'); msg.textContent = 'กำลังอ่านไฟล์…'; err('');
    try {
      const got = parsePipe(await readTable(file));
      if (!got.length) throw new Error('ไม่พบแถวราคาท่อในไฟล์ — ต้องมีหัวคอลัมน์ขนาด Ø 0.30–1.50 (ดูแม่แบบ Excel)');
      sync(); rows = rows.filter((r) => r.name || Object.values(r.c2).some(num) || Object.values(r.c3).some(num));
      got.forEach((g) => { const r = rows.find((x) => normName(x.name) === normName(g.name)); if (r) Object.assign(r, { loc: g.loc || r.loc, c2: { ...r.c2, ...g.c2 }, c3: { ...r.c3, ...g.c3 } }); else rows.push(g); });
      draw(); msg.textContent = `กรอกจากไฟล์แล้ว ${got.length} โรงงาน — ตรวจทานก่อนบันทึก`;
    } catch (x) { msg.textContent = ''; err(x.message); }
  };
  $('#pf-save').onclick = async (e) => {
    sync();
    const prices = [];
    for (const r of rows) {
      const any = PIPE_DIA.some((x) => r.c2[x] || r.c3[x]);
      if (!r.name && !any) continue;
      if (!r.name) return err('กรุณาใส่ชื่อโรงงานทุกแถวที่มีราคา');
      for (const x of PIPE_DIA) {
        const a = r.c2[x] || '', b = r.c3[x] || '';
        if ([a, b].some((y) => y !== '' && isNaN(Number(y)))) return err(`ราคา ${r.name} Ø${x} ต้องเป็นตัวเลข`);
        if (a !== '' || b !== '') prices.push({ item: r.name, area: x, price: a, price2: b, unit: r.loc });
      }
    }
    if (!prices.length) return err('กรุณากรอกราคาอย่างน้อย 1 ช่อง');
    const names = rows.filter((r) => r.name).map((r) => r.name.trim()), dupName = names.find((n, i) => names.indexOf(n) !== i);
    if (dupName) return err(`ชื่อโรงงาน "${dupName}" ซ้ำกัน — รวมเป็นแถวเดียวหรือเติมชื่อให้ต่างกัน`);
    const d = { kind: 'pipe', source: $('#pf-src').value, period: $('#pf-per').value, doc_no: $('#pf-no').value.trim(), doc_date: '', file_url: $('#pf-url').value.trim(), note: $('#pf-note').value.trim() };
    if (doc) d.doc_id = doc.doc_id;
    const b = e.currentTarget; busy(b);
    try {
      const res = await call('saveMatDoc', { doc: d, prices });
      S.db.MatDocs = S.db.MatDocs.filter((x) => x.doc_id !== res.doc.doc_id).concat([res.doc]);
      S.db.MatPrices = S.db.MatPrices.filter((x) => x.doc_id !== res.doc.doc_id).concat(res.prices);
      ui.pmonth = res.doc.period; closeModal(); toast('บันทึกราคาท่อแล้ว'); view(main, 'pipe', app);
    } catch (x) { err(x.message); busy(b, false); }
  };
  const del = $('#pf-del');
  if (del) del.onclick = async () => {
    if (!confirm('ลบราคาท่อชุดนี้ทั้งหมด?')) return;
    busy(del);
    try {
      await call('deleteMatDoc', { doc_id: doc.doc_id });
      S.db.MatDocs = S.db.MatDocs.filter((x) => x.doc_id !== doc.doc_id); S.db.MatPrices = S.db.MatPrices.filter((x) => x.doc_id !== doc.doc_id);
      closeModal(); toast('ลบแล้ว'); view(main, 'pipe', app);
    } catch (x) { err(x.message); busy(del, false); }
  };
}

/* ---------- อ่านตารางจากไฟล์ (Excel / PDF ที่มีตัวอักษร) ---------- */
/** ชื่อเทียบกันได้: ตัดช่องว่าง/เครื่องหมายคำพูด • แก้สระอำที่ PDF แยกเป็น นิคหิต+สระอา */
const normName = (s) => String(s ?? '').replace(/ํา/g, 'ำ').replace(/[″”“'`]/g, '"').replace(/\s+/g, '').toLowerCase();
const isNum = (s) => /^-?\d{1,3}(,\d{3})+(\.\d+)?$|^-?\d+(\.\d+)?$/.test(String(s).trim());
const toNum = (s) => Number(String(s).replace(/,/g, ''));
let pdfP = null;
function loadPDF() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfP || (pdfP = new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { pdfP = null; bad(new Error('โหลดตัวอ่าน PDF ไม่ได้ — ตรวจอินเทอร์เน็ต')); };
    document.head.appendChild(s);
  }));
}
/** คืน { rows: [[{x, s}]] } — Excel: x = เลขคอลัมน์ • PDF: x = ตำแหน่งแนวนอน (บรรทัดเรียงบนลงล่าง) */
async function readTable(file) {
  if (/\.pdf$/i.test(file.name)) {
    const lib = await loadPDF(), pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise, rows = [];
    let chars = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const items = (await (await pdf.getPage(i)).getTextContent()).items.filter((t) => t.str.trim());
      chars += items.reduce((a, t) => a + t.str.trim().length, 0);
      const lines = [];
      items.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]).forEach((t) => {
        const y = t.transform[5], l = lines.find((q) => Math.abs(q.y - y) < 3);
        (l ? l.c : (lines.push({ y, c: [] }), lines[lines.length - 1].c)).push({ x: t.transform[4], s: t.str.trim() });
      });
      lines.forEach((l) => rows.push(l.c.sort((a, b) => a.x - b.x)));
    }
    if (chars < 30) throw new Error('ไฟล์ PDF นี้เป็นภาพสแกน ไม่มีตัวอักษรให้อ่าน — ใช้ไฟล์ Excel (ดาวน์โหลดแม่แบบ) หรือกรอกเอง');
    return { pdf: true, rows };
  }
  await loadXLSX();
  const wb = XLSX.read(await file.arrayBuffer()), aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
  return { pdf: false, rows: aoa.map((r) => r.map((s, x) => ({ x, s: String(s ?? '').replace(/\s+/g, ' ').trim() })).filter((c) => c.s)) };
}
/** คอลัมน์ตัวเลขในแถว → คอลัมน์หัวตารางที่ใกล้ที่สุด (Excel ตรงเลขคอลัมน์ • PDF ใกล้สุดตามแนวนอน) */
function nearest(cols, x, pdf) {
  if (!pdf) return cols.find((c) => c.x === x) || null;
  let best = null, d = Infinity; cols.forEach((c) => { const k = Math.abs(c.x - x); if (k < d) { d = k; best = c; } });
  const gap = cols.length > 1 ? Math.min(...cols.slice(1).map((c, i) => Math.abs(c.x - cols[i].x))) : 80;
  return d <= gap * 0.75 ? best : null;
}
/** ราคาวัสดุจากแหล่ง: หัวตาราง = ชื่อจังหวัด • แต่ละแถว = ชื่อวัสดุ + ราคาตามจังหวัด */
function parseQuarry(t, areas) {
  const hi = t.rows.findIndex((r) => areas.filter((a) => r.some((c) => normName(c.s).includes(normName(a)))).length >= Math.min(2, areas.length));
  if (hi < 0) throw new Error('ไม่พบหัวตารางที่มีชื่อจังหวัด (' + areas.join(', ') + ')');
  const cols = areas.map((a) => { const c = t.rows[hi].find((q) => normName(q.s).includes(normName(a))); return c ? { a, x: c.x } : null; }).filter(Boolean);
  const out = [];
  t.rows.slice(hi + 1).forEach((r) => {
    const label = r.filter((c) => !isNum(c.s) && c.s !== '-').map((c) => c.s).join(' ').replace(/^\d+\.?\s*/, '').trim();
    const vals = {};
    r.filter((c) => isNum(c.s)).forEach((c) => { const col = nearest(cols, c.x, t.pdf); if (col && vals[col.a] === undefined) vals[col.a] = toNum(c.s); });
    if (label && Object.keys(vals).length) out.push({ name: label, vals });
  });
  return out;
}
/** ราคาท่อ: หัวตาราง Ø 0.30–1.50 สองชุด (ชั้น 2 แล้วชั้น 3) • แถวที่มีตัวเลข = โรงงาน • แถวข้อความถัดมา = ชื่อ/ที่ตั้งต่อ */
function parsePipe(t) {
  const diaOf = (s) => { const m = /(\d\.\d{2})/.exec(s); return m && PIPE_DIA.includes(m[1]) ? m[1] : null; };
  let hi = -1, cols = [];
  for (let i = 0; i < t.rows.length && hi < 0; i++) {
    const ds = t.rows[i].filter((c) => diaOf(c.s));
    if (ds.length >= 6) { hi = i; cols = ds.map((c, j) => ({ x: c.x, dia: diaOf(c.s), cls: /ชั้น\s*3/.test(c.s) ? 'c3' : /ชั้น\s*2/.test(c.s) ? 'c2' : j < ds.length / 2 || ds.length <= PIPE_DIA.length ? 'c2' : 'c3' })); }
  }
  if (hi < 0) return [];
  const firstNumX = Math.min(...cols.map((c) => c.x)), head = t.rows.slice(Math.max(0, hi - 3), hi + 1).flat();
  const locX = (head.find((c) => /ที่ตั้ง/.test(c.s)) || {}).x;
  const out = []; let cur = null;
  t.rows.slice(hi + 1).forEach((r) => {
    const text = r.filter((c) => !isNum(c.s) && c.s !== '-' && c.x < firstNumX - (t.pdf ? 5 : 0.5));
    const nums = r.filter((c) => isNum(c.s) && c.x >= firstNumX - (t.pdf ? 20 : 0.5));
    const nameCells = text.filter((c) => locX === undefined ? c === text[0] : c.x < locX - (t.pdf ? 5 : 0.5)), locCells = text.filter((c) => !nameCells.includes(c));
    const name = nameCells.map((c) => c.s).join(' ').replace(/^\d+\.?\s*/, '').trim(), loc = locCells.map((c) => c.s).join(' ').trim();
    if (nums.length) {
      cur = { name, loc, c2: {}, c3: {} }; out.push(cur);
      nums.forEach((c) => { const col = nearest(cols, c.x, t.pdf); if (col) cur[col.cls][col.dia] = String(toNum(c.s)); });
    } else if (cur && (name || loc) && !/หมายเหตุ|ลงชื่อ|ที่มา/.test(name + loc)) {
      // ชื่อที่ขึ้นบรรทัดใหม่ในเซลล์ (ไทยต่อไทย) ต่อกันโดยไม่เว้นวรรค • บรรทัด ต./อ./จ. เป็นที่ตั้ง
      const addLoc = (s) => (cur.loc = cur.loc ? cur.loc + ' • ' + s : s);
      if (name && /^(ต\.|อ\.|จ\.|ตำบล|อำเภอ|จังหวัด)/.test(name)) addLoc(name);
      else if (name) cur.name = cur.name + (/[฀-๿]$/.test(cur.name) && /^[฀-๿]/.test(name) ? '' : ' ') + name;
      if (loc) addLoc(loc);
    } else if (/หมายเหตุ|ลงชื่อ|ที่มา/.test(name + loc)) cur = null;
  });
  return out.filter((f) => f.name);
}

/* ---------- รายการวัสดุทั้งหมดพร้อมราคาล่าสุด (ใช้ในตรวจแผน › ค่าขนส่ง) ---------- */
/** [{ group, item, src, label, price, unit }] — ราคาล่าสุด ณ วันนี้ของทุกหมวด */
export function materialCatalog() {
  const out = [], now = iso(today()), month = now.slice(0, 7), provs = provinces(), add = (o) => num(o.price) && out.push({ ...o, price: Number(o.price) });
  const ia = (n) => (items('asphalt').find((i) => i.name === n) || {}).unit || 'บาท/ตัน';
  const asph = docsOf('asphalt'), bo = bulkOnly();
  uniq(asph.map((d) => d.source)).forEach((s) => {
    const d = asph.filter((x) => x.source === s && x.period <= month && monthsBack(x.period, month) <= 3).sort(by('period')).pop();
    if (d) pricesOf(d.doc_id).forEach((r) => { add({ group: 'ยางแอสฟัลต์', item: r.item, src: srcLabel(s) + ' • ' + thMonth(d.period), price: r.price, unit: ia(r.item).replace('บาท/', '') }); if (!bo.has(r.item)) add({ group: 'ยางแอสฟัลต์', item: r.item, src: srcLabel(s) + ' • บรรจุภัณฑ์ • ' + thMonth(d.period), price: r.price2, unit: ia(r.item).replace('บาท/', '') }); });
  });
  const qd = docsOf('quarry');
  uniq(qd.map((d) => d.source)).forEach((s) => {
    const d = qd.filter((x) => x.source === s && x.period <= now).sort(by('period')).pop(); if (!d) return;
    const p = {}; pricesOf(d.doc_id).forEach((r) => ((p[r.item] = p[r.item] || {})[r.area] = r.price));
    const qu = (n) => ((items('quarry').find((i) => i.name === n) || {}).unit || 'บาท/ลบ.ม.').replace('บาท/', '');
    Object.keys(p).filter((n) => normName(n) !== normName(MIX_NAME)).forEach((n) => Object.keys(p[n]).forEach((a) => add({ group: 'วัสดุจากแหล่ง', item: n, src: `${s} • ${a}`, price: p[n][a], unit: qu(n) })));
    uniq(Object.values(p).flatMap((o) => Object.keys(o))).forEach((a) => add({ group: 'วัสดุจากแหล่ง', item: MIX_NAME, src: `${s} • ${a} (คำนวณ)`, price: mixPrice(p, a), unit: 'ลบ.ม.' }));
  });
  [['concrete', 'คอนกรีตผสมเสร็จ', provs, shortConcrete], ['cement', 'ปูนซีเมนต์', provs, (n) => n], ['steel', 'เหล็กเส้น', ['กรุงเทพฯ'].concat(provs), shortSteel]].forEach(([k, g, areas, short]) => {
    const per = latestByArea(k, month, areas);
    Object.keys(per).forEach((a) => Object.values(per[a].p).forEach((r) => add({ group: g, item: short(r.item), src: `พาณิชย์ • ${a} • ${thMonth(per[a].period)}`, price: r.price, unit: r.unit || '' })));
  });
  const pd = docsOf('pipe');
  uniq(pd.map((d) => d.source)).forEach((s) => {
    const d = pd.filter((x) => x.source === s && x.period <= month).sort(by('period')).pop(); if (!d) return;
    pipeData(d).forEach((f) => PIPE_DIA.forEach((x) => { add({ group: 'ท่อ คสล.', item: `ท่อ คสล. ชั้น 2 Ø${x} ม.`, src: `${s} • ${f.name}`, price: f.c2[x], unit: 'ม.' }); add({ group: 'ท่อ คสล.', item: `ท่อ คสล. ชั้น 3 Ø${x} ม.`, src: `${s} • ${f.name}`, price: f.c3[x], unit: 'ม.' }); }));
  });
  return out;
}
