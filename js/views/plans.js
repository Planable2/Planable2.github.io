// ===== ทะเบียนแผน: แยกปีงบ › หน่วยงาน, ลงทะเบียน/แก้ไข, นำเข้า Excel, รายละเอียด + อัปเดตสถานะ =====
import { S, plans, planYears, defaultYear, units, offices, statuses, statusOf, unitOf, userOf, can, isAdmin, currentFY, cfg } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, money, mil, num, kmText, kmParse, thDate, thDateTime, debounce, loadXLSX } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, avatar, statusPill, icon, empty } from '../ui.js';

const ui = { year: null, q: '', unit: 'all', office: 'all', status: 'all', open: {} };

export function view(main, arg, app) {
  if (!ui.year || !planYears().includes(ui.year)) ui.year = defaultYear();
  const pre = sessionStorage.getItem('plan-unit'); if (pre) { ui.unit = pre; sessionStorage.removeItem('plan-unit'); }
  const years = planYears(), fy = currentFY();
  main.innerHTML = `
  <div class="page-head">
    <div class="t"><h1>ทะเบียนแผนงาน</h1><span class="muted small">แผนที่ได้รับงบประมาณแล้ว แยกตามปีงบ › หน่วยงาน › สำนัก</span></div>
    <label class="row small muted" style="background:var(--card);border:1px solid var(--line);border-radius:22px;padding:0 6px 0 14px;height:44px">ปีงบ
      <select id="p-year" class="inp" style="height:34px;width:auto;border:0;background:var(--green-soft);color:var(--green-ink);font-weight:600">${(years.length ? years : [fy]).map((y) => `<option value="${y}" ${y === ui.year ? 'selected' : ''}>${y}${y === fy ? ' (ปัจจุบัน)' : ''}</option>`).join('')}</select></label>
    ${can('edit_plan') ? `<button class="btn soft" id="p-import">${icon('up', 16)}นำเข้าจาก Excel</button>` : ''}
    <button class="btn" id="p-export">${icon('download', 16)}ส่งออก</button>
    ${can('edit_plan') ? `<button class="btn pri" id="p-new">${icon('plus', 16)}ลงทะเบียนแผน</button>` : ''}
  </div>
  ${ui.year < fy ? `<div class="note grey">ปีงบ ${ui.year} ปิดแล้ว — ดูและส่งออกได้ แก้ไขได้เฉพาะผู้ดูแลระบบ</div>` : ''}
  <section class="kpis" id="p-sum"></section>
  <div class="filters">
    <label class="search">${icon('search', 16)}<input id="p-q" value="${esc(ui.q)}" placeholder="ค้นรหัสงาน ชื่องาน สายทาง เช่น ทล.101" aria-label="ค้นหา"></label>
    <select id="p-unit" aria-label="หน่วยงาน"><option value="all">ทุกหน่วยงาน</option>${units().map((u) => `<option ${u.name === ui.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
    <select id="p-office" aria-label="สำนัก"><option value="all">ทุกสำนัก</option>${offices().map((o) => `<option ${o.short === ui.office ? 'selected' : ''}>${esc(o.short)}</option>`).join('')}</select>
    <select id="p-status" aria-label="สถานะ"><option value="all">ทุกสถานะ</option>${statuses().map((s) => `<option value="${s.status_code}" ${s.status_code === ui.status ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="fix" ${ui.status === 'fix' ? 'selected' : ''}>มีส่งกลับแก้ไข</option><option value="late" ${ui.status === 'late' ? 'selected' : ''}>เลยกำหนดรอบส่ง</option></select>
    <button class="btn sm" id="p-clear">ล้าง</button>
    <span class="right row"><button class="btn sm" id="p-ex">ขยายทั้งหมด</button><button class="btn sm" id="p-co">ย่อทั้งหมด</button></span>
  </div>
  <span class="small muted" id="p-count"></span>
  <div class="col" style="gap:12px" id="p-groups"></div>`;
  const draw = () => drawList(main);
  draw();
  $('#p-year').onchange = (e) => { ui.year = Number(e.target.value); view(main, arg, app); };
  $('#p-q').oninput = debounce((e) => { ui.q = e.target.value; draw(); }, 200);
  ['unit', 'office', 'status'].forEach((k) => ($('#p-' + k).onchange = (e) => { ui[k] = e.target.value; draw(); }));
  $('#p-clear').onclick = () => { Object.assign(ui, { q: '', unit: 'all', office: 'all', status: 'all' }); view(main, arg, app); };
  $('#p-ex').onclick = () => { units().forEach((u) => (ui.open[u.name] = true)); draw(); };
  $('#p-co').onclick = () => { ui.open = {}; ui.forceClosed = true; draw(); };
  $('#p-export').onclick = () => exportPlans(filtered());
  if ($('#p-new')) $('#p-new').onclick = () => planForm(null, app);
  if ($('#p-import')) $('#p-import').onclick = () => importDialog(app);
  if (arg === 'new' && can('edit_plan')) planForm(null, app);
  if (arg === 'import' && can('edit_plan')) importDialog(app);
}

function filtered() {
  const q = ui.q.trim().toLowerCase();
  return plans().filter((p) => p.fiscal_year === ui.year
    && (ui.unit === 'all' || p.unit === ui.unit) && (ui.office === 'all' || p.office === ui.office)
    && (ui.status === 'all' || (ui.status === 'fix' ? p.rounds > 0 : ui.status === 'late' ? p.late : p.status === ui.status))
    && (!q || [p.plan_id, p.work_code, p.work_name, p.unit, p.office].concat(p.segs.map((s) => s.road)).join(' ').toLowerCase().includes(q)));
}

function drawList(main) {
  const list = filtered(), yearAll = plans().filter((p) => p.fiscal_year === ui.year), ST = statuses();
  const g = (fn) => yearAll.filter(fn).length;
  $('#p-sum').innerHTML = [
    ['all', 'แผนทั้งหมด', yearAll.length, mil(yearAll.reduce((a, p) => a + p.budget_cut, 0)) + ' ลบ.'],
    ['s-unsent', 'ยังไม่ส่ง', g((p) => p.st.dash_group === 'ยังไม่ส่ง'), ''],
    ['fix', 'มีส่งกลับแก้ไข', g((p) => p.rounds > 0), ''],
    ['s-dept', 'ส่งกรมแล้ว', g((p) => ['ส่งกรมแล้ว', 'กรมเห็นชอบ'].includes(p.st.dash_group)), 'เห็นชอบ ' + g((p) => p.st.dash_group === 'กรมเห็นชอบ')],
    ['late', 'เลยกำหนดรอบส่ง', g((p) => p.late), '']
  ].map((k) => `<button class="kpi ${ui.status === k[0] ? 'sel' : ''}" data-k="${k[0]}" ${k[0] === 'late' && k[2] ? 'style="background:var(--red-soft);color:var(--red)"' : ''}><span class="l">${esc(k[1])}</span><span class="v">${k[2]}</span><span class="s">${esc(k[3])}</span></button>`).join('');
  on($('#p-sum'), '[data-k]', 'click', (e, b) => { const k = b.dataset.k; ui.status = k === 'all' ? 'all' : k === 's-unsent' ? (ST.find((s) => s.dash_group === 'ยังไม่ส่ง') || {}).status_code || 'all' : k === 's-dept' ? (ST.find((s) => s.dash_group === 'ส่งกรมแล้ว') || {}).status_code || 'all' : k; $('#p-status').value = ui.status; drawList(main); });
  $('#p-count').textContent = `ปีงบ ${ui.year} • แสดง ${list.length} จาก ${yearAll.length} แผน • งบที่ได้รับ ${money(list.reduce((a, p) => a + p.budget, 0))} บาท • หลังปรับลด ${money(list.reduce((a, p) => a + p.budget_cut, 0))} บาท`;
  const filtering = ui.q || ui.status !== 'all' || ui.office !== 'all' || ui.unit !== 'all';
  const box = $('#p-groups');
  if (!list.length) { box.innerHTML = empty('ไม่พบแผนตามตัวกรองในปีงบ ' + ui.year); return; }
  box.innerHTML = units().map((u, ui_) => {
    const l = list.filter((p) => p.unit === u.name);
    if (!l.length) return '';
    const open = ui.open[u.name] ?? (ui.forceClosed ? false : (filtering || ui_ === 1));
    const c = ST.map((s) => l.filter((p) => p.status === s.status_code).length), sent = l.filter((p) => p.sent).length, late = l.filter((p) => p.late).length;
    const rev = userOf(u.reviewer_id);
    return `<section class="grp ${open ? 'open' : ''}" data-u="${esc(u.name)}">
      <button class="gh" aria-expanded="${open}"><span class="chev">${icon('chev', 18)}</span><b style="font-family:var(--head);font-size:18px;font-weight:500;min-width:84px">${esc(u.name)}</b>
        <span class="small muted">${l.length} แผน • ${mil(l.reduce((a, p) => a + p.budget_cut, 0))} ลบ.</span>
        <span class="track" style="flex:1 1 140px;max-width:260px;height:10px">${c.map((v, i) => `<span style="flex-grow:${v};flex-basis:0;display:${v ? 'block' : 'none'};background:${ST[i].color}" data-tip="${esc(ST[i].name + '|' + v + ' แผน')}"></span>`).join('')}</span>
        <span class="small" style="font-weight:600;color:${sent / l.length < 0.85 ? 'var(--gold-ink)' : 'var(--green-ink)'}">${u.kind === 'เขต' ? 'ส่งกรมแล้ว' : 'ส่งแล้ว'} ${sent}/${l.length}</span>
        ${late ? `<span class="tag red">เลยกำหนด ${late}</span>` : ''}
        <span class="right row small muted">ผู้ตรวจ ${rev ? avatar(rev, 28) + '<b style="color:var(--ink);font-weight:500">' + esc(rev.full_name) + '</b>' : '—'}</span></button>
      ${open ? `<div class="gb scroll-x"><table class="tbl" style="min-width:1050px;table-layout:fixed">
        <colgroup><col style="width:120px"><col style="width:76px"><col style="width:240px"><col style="width:280px"><col style="width:110px"><col style="width:110px"><col style="width:130px"><col style="width:140px"><col style="width:80px"></colgroup>
        <thead><tr><th style="padding-left:18px">สำนัก</th><th>รหัสงาน</th><th>ชื่องาน</th><th>สายทาง • กม. • ฝั่ง</th><th class="r">งบที่ได้รับ</th><th class="r">หลังปรับลด</th><th>รอบส่ง / กำหนด</th><th>สถานะ</th><th>ส่งกลับแก้</th></tr></thead>
        <tbody>${l.map(row).join('')}</tbody></table></div>` : ''}
    </section>`;
  }).join('');
  on(box, '.gh', 'click', (e, b) => { const n = b.parentElement.dataset.u; ui.open[n] = !b.parentElement.classList.contains('open'); drawList(main); });
}

function row(p) {
  const noDue = !p.round && !(cfg('Offices').find((o) => o.short === p.office) || {}).has_round;
  return `<tr><td style="padding-left:18px">${esc(p.office)}</td><td class="num">${esc(p.work_code)}</td>
    <td><a href="#/plan/${esc(p.plan_id)}" style="color:var(--ink);text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px;font-weight:500">${esc(p.work_name)}</a></td>
    <td class="num">${p.segs.length ? p.segs.map((s) => `<div><b>${esc(s.road)}</b> ${kmText(s.km_from_m)} – ${kmText(s.km_to_m)} <span class="faint">${esc(s.side)}</span></div>`).join('') : '<span class="faint">ไม่ระบุสายทาง</span>'}</td>
    <td class="r num">${money(p.budget)}</td><td class="r num" style="font-weight:600;color:${p.budget_cut < p.budget ? 'var(--gold-ink)' : 'inherit'}">${money(p.budget_cut)}</td>
    <td class="small" style="color:${p.late ? 'var(--red)' : 'var(--muted)'}">${noDue ? 'ไม่มีกำหนด' : p.round ? esc(p.round.name) + ' • ' + thDate(p.round.due_date) : '—'}${p.late ? ' • เลยกำหนด' : ''}</td>
    <td>${statusPill(p.status)}</td>
    <td>${p.rounds ? `<span class="tag gold" data-tip="${esc('ส่งกลับแก้ ' + p.rounds + ' รอบ|' + p.reasons.join('|'))}">${p.rounds} รอบ</span>` : '<span class="faint">—</span>'}</td></tr>`;
}

async function exportPlans(rows) {
  try { await loadXLSX(); } catch (e) { return toast(e.message, 'err'); }
  const data = [];
  rows.forEach((p) => (p.segs.length ? p.segs : [null]).forEach((s) => data.push({ plan_id: p.plan_id, ปีงบ: p.fiscal_year, หน่วยงาน: p.unit, สำนัก: p.office, รหัสงาน: p.work_code, ชื่องาน: p.work_name, สายทาง: s ? s.road : '', 'กม.เริ่ม': s ? kmText(s.km_from_m) : '', 'กม.สิ้นสุด': s ? kmText(s.km_to_m) : '', ฝั่ง: s ? s.side : '', งบที่ได้รับ: p.budget, หลังปรับลด: p.budget_cut, สถานะ: p.st.name, 'ส่งกลับแก้ (รอบ)': p.rounds })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'ทะเบียนแผน');
  XLSX.writeFile(wb, `ทะเบียนแผน_ปีงบ${ui.year}.xlsx`);
}

/* ---------- ฟอร์มลงทะเบียน / แก้ไข ---------- */
function planForm(plan, app) {
  const isNew = !plan;
  const f = plan ? { ...plan, segs: plan.segs.map((s) => ({ road: s.road, from: kmText(s.km_from_m), to: kmText(s.km_to_m), side: s.side })) } : { fiscal_year: ui.year || currentFY(), unit: units()[1] ? units()[1].name : '', office: offices()[0] ? offices()[0].short : '', work_code: '', work_name: '', budget: '', budget_cut: '', note: '', segs: [{ road: '', from: '', to: '', side: 'LT.,RT.' }] };
  const offOpts = (u) => offices().filter((o) => (unitOf(u).kind === 'เขต' ? o.scope !== 'เฉพาะแขวง' : o.scope !== 'เฉพาะเขต'));
  const draw = (dlg) => {
    dlg.innerHTML = `${modalHead(isNew ? 'ลงทะเบียนแผนงาน' : 'แก้ไขแผน ' + plan.plan_id, '1 แผน = 1 งาน • เพิ่มได้หลายช่วงสายทาง • กม. รูปแบบ 12+345')}
    <div class="fgrid">
      <label class="f">ปีงบประมาณ (พ.ศ.) *<input class="inp" data-k="fiscal_year" value="${esc(f.fiscal_year)}" inputmode="numeric" maxlength="4" placeholder="เช่น ${currentFY()}"></label>
      <label class="f">หน่วยงาน *<select class="inp" data-k="unit">${units().map((u) => `<option ${u.name === f.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
      <label class="f">สำนัก *<select class="inp" data-k="office">${offOpts(f.unit).map((o) => `<option ${o.short === f.office ? 'selected' : ''}>${esc(o.short)}</option>`).join('')}</select></label>
      <label class="f">รหัสงาน *<input class="inp" data-k="work_code" value="${esc(f.work_code)}" inputmode="numeric" placeholder="22000"></label>
    </div>
    <label class="f">ชื่องาน *<input class="inp" data-k="work_name" value="${esc(f.work_name)}" placeholder="เช่น งานเสริมผิวแอสฟัลต์"></label>
    <div class="col" style="background:var(--soft);border-radius:20px;padding:12px;gap:8px">
      <div class="row"><b class="small grow">ช่วงสายทาง (${f.segs.length})</b><span class="faint">งานอาคารไม่ต้องระบุก็ได้</span></div>
      ${f.segs.map((s, i) => `<div style="display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 40px;gap:6px" data-seg="${i}">
        <input class="inp" data-s="road" value="${esc(s.road)}" placeholder="ทล.101" aria-label="สายทาง"><input class="inp" data-s="from" value="${esc(s.from)}" placeholder="1+000" aria-label="กม.เริ่ม"><input class="inp" data-s="to" value="${esc(s.to)}" placeholder="3+000" aria-label="กม.สิ้นสุด">
        <select class="inp" data-s="side" aria-label="ฝั่ง">${['LT.,RT.', 'LT.', 'RT.'].map((x) => `<option ${x === s.side ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <button class="icon-btn" data-rm="${i}" aria-label="ลบช่วง" ${f.segs.length < 2 ? 'disabled' : ''}>${icon('x', 16)}</button></div>`).join('')}
      <button class="btn sm" id="pf-add" style="align-self:flex-start">${icon('plus', 14)}เพิ่มช่วงสายทาง</button>
    </div>
    <div class="fgrid">
      <label class="f">งบที่ได้รับ (บาท) *<input class="inp num" data-k="budget" value="${esc(f.budget)}" inputmode="numeric"></label>
      <label class="f">วงเงินหลังปรับลด (บาท)<input class="inp num" data-k="budget_cut" value="${esc(f.budget_cut)}" inputmode="numeric" placeholder="ว่าง = เท่างบที่ได้รับ"></label>
    </div>
    <label class="f">หมายเหตุ<input class="inp" data-k="note" value="${esc(f.note || '')}"></label>
    <div class="row wrap small"><span class="tag">ผู้ตรวจ: ${esc((userOf(unitOf(f.unit).reviewer_id) || {}).full_name || '—')}</span><span class="tag">สถานะเริ่มต้น: ${esc(statusOf(isNew ? (unitOf(f.unit).kind === 'เขต' ? 's0' : 's1') : plan.status).name)}</span></div>
    <span class="err" id="pf-err"></span>
    <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="pf-save">บันทึกแผน</button></div>`;
    $$('[data-k]', dlg).forEach((el) => (el.onchange = el.oninput = () => { f[el.dataset.k] = el.value; if (el.dataset.k === 'unit') { const o = offOpts(f.unit); if (!o.some((x) => x.short === f.office)) f.office = o[0] ? o[0].short : ''; draw(dlg); } }));
    $$('[data-seg]', dlg).forEach((r) => $$('[data-s]', r).forEach((el) => (el.oninput = el.onchange = () => (f.segs[r.dataset.seg][el.dataset.s] = el.value))));
    on(dlg, '[data-rm]', 'click', (e, b) => { f.segs.splice(Number(b.dataset.rm), 1); draw(dlg); });
    $('#pf-add', dlg).onclick = () => { f.segs.push({ road: '', from: '', to: '', side: 'LT.,RT.' }); draw(dlg); };
    $('#pf-save', dlg).onclick = async () => {
      const err = $('#pf-err', dlg), segs = [];
      if (!/^2[5-6]\d{2}$/.test(String(f.fiscal_year).trim())) return (err.textContent = 'ปีงบประมาณต้องเป็น พ.ศ. 4 หลัก เช่น ' + currentFY());
      for (let i = 0; i < f.segs.length; i++) {
        const s = f.segs[i]; if (!s.road && !s.from && !s.to) continue;
        const a = kmParse(s.from), b = kmParse(s.to);
        if (!s.road.trim() || isNaN(a) || isNaN(b)) return (err.textContent = `ช่วงที่ ${i + 1}: ใส่สายทาง และ กม. รูปแบบ 12+345`);
        if (b <= a) return (err.textContent = `ช่วงที่ ${i + 1}: กม.สิ้นสุด ต้องมากกว่า กม.เริ่ม`);
        segs.push({ road: s.road.trim(), km_from_m: a, km_to_m: b, side: s.side });
      }
      if (!segs.length && f.office !== 'สร. (งานอาคาร)') return (err.textContent = 'กรุณาระบุช่วงสายทางอย่างน้อย 1 ช่วง');
      const payload = { plan: { plan_id: plan ? plan.plan_id : '', fiscal_year: Number(String(f.fiscal_year).trim()), unit: f.unit, office: f.office, work_code: String(f.work_code).trim(), work_name: String(f.work_name).trim(), budget: num(f.budget), budget_cut: String(f.budget_cut).trim() ? num(f.budget_cut) : '', note: f.note || '' }, segments: segs };
      if (!payload.plan.plan_id) delete payload.plan.plan_id;
      const btn = $('#pf-save', dlg); busy(btn);
      try {
        const r = await call('savePlan', payload);
        const i = S.db.Plans.findIndex((x) => x.plan_id === r.plan.plan_id);
        if (i >= 0) S.db.Plans[i] = r.plan; else S.db.Plans.push(r.plan);
        S.db.Segments = S.db.Segments.filter((s) => s.plan_id !== r.plan.plan_id).concat(r.segments);
        ui.year = Number(r.plan.fiscal_year); ui.open[r.plan.unit] = true;
        closeModal(); toast((isNew ? 'ลงทะเบียนแล้ว: ' : 'บันทึกแล้ว: ') + r.plan.plan_id + ' ' + r.plan.work_name);
        app.refresh();
      } catch (x) { err.textContent = x.message; busy(btn, false); }
    };
  };
  modal('', { wide: true, onMount: draw });
}

/* ---------- นำเข้า Excel ---------- */
const COLS = ['ปีงบ', 'หน่วยงาน', 'สำนัก', 'รหัสงาน', 'ชื่องาน', 'สายทาง', 'กม.เริ่ม', 'กม.สิ้นสุด', 'ฝั่ง', 'งบที่ได้รับ', 'หลังปรับลด'];
function importDialog(app) {
  const st = { rows: null, file: '' };
  const draw = (dlg) => {
    if (!st.rows) {
      dlg.innerHTML = `${modalHead('นำเข้าแผนจาก Excel', '1 แถว = 1 ช่วงสายทาง • แผนที่มีหลายช่วงให้ใส่ ปีงบ+หน่วยงาน+รหัสงาน+ชื่องาน ซ้ำ ระบบรวมเป็นแผนเดียว')}
        <label class="col center" style="border:2px dashed #B8C7AE;background:#F7F9F3;border-radius:24px;padding:34px;cursor:pointer;align-items:center;gap:6px">${icon('up', 34)}<b>เลือกไฟล์ .xlsx</b><span class="faint">หัวคอลัมน์: ${COLS.join(' • ')}</span><input type="file" accept=".xlsx,.xls,.csv" id="im-file" hidden></label>
        <div class="row wrap note grey"><span class="grow">ยังไม่มีไฟล์? ดาวน์โหลดแม่แบบที่หัวคอลัมน์ตรงกับระบบ</span><button class="btn sm" id="im-tpl">${icon('download', 14)}ดาวน์โหลดแม่แบบ</button></div>
        <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button></div>`;
      $('#im-tpl', dlg).onclick = async () => { try { await loadXLSX(); } catch (x) { return toast(x.message, 'err'); } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([COLS, [ui.year || currentFY(), 'แขวง 1', 'สผ.', '22000', 'งานเสริมผิวแอสฟัลต์', 'ทล.101', '1+000', '3+000', 'LT.,RT.', 4500000, 4230000]]), 'แผนงาน'); XLSX.writeFile(wb, 'แม่แบบนำเข้าแผน.xlsx'); };
      $('#im-file', dlg).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try { await loadXLSX(); } catch (x) { return toast(x.message, 'err'); }
        const wb = XLSX.read(await file.arrayBuffer());
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        st.file = file.name; st.rows = parse(raw); draw(dlg);
      };
      return;
    }
    const ok = st.rows.filter((r) => !r.err), bad = st.rows.filter((r) => r.err);
    dlg.innerHTML = `${modalHead('ตรวจสอบก่อนนำเข้า', st.file)}
      <div class="row wrap"><span class="tag green">พร้อมนำเข้า ${ok.length} แผน</span>${bad.length ? `<span class="tag red">ต้องแก้ ${bad.length} แผน (จะข้าม)</span>` : ''}</div>
      <div class="scroll-x" style="max-height:46vh;border:1px solid var(--line2);border-radius:16px"><table class="tbl"><thead><tr><th>แถว</th><th>ปีงบ</th><th>หน่วยงาน</th><th>สำนัก</th><th>รหัส</th><th>ชื่องาน</th><th>ช่วง</th><th class="r">งบ</th><th>ผลตรวจ</th></tr></thead>
      <tbody>${st.rows.map((r) => `<tr style="background:${r.err ? '#FCF1EC' : ''}"><td>${r.line}</td><td>${esc(r.plan.fiscal_year)}</td><td>${esc(r.plan.unit)}</td><td>${esc(r.plan.office)}</td><td>${esc(r.plan.work_code)}</td><td>${esc(r.plan.work_name)}</td><td>${r.segments.length}</td><td class="r num">${money(r.plan.budget)}</td><td style="color:${r.err ? 'var(--red)' : 'var(--green-ink)'};font-weight:600">${esc(r.err || '✓ ถูกต้อง')}</td></tr>`).join('')}</tbody></table></div>
      <span class="err" id="im-err"></span>
      <div class="dlg-foot"><button class="btn" id="im-back">เลือกไฟล์ใหม่</button><button class="btn pri" id="im-go" ${ok.length ? '' : 'disabled'}>นำเข้า ${ok.length} แผน</button></div>`;
    $('#im-back', dlg).onclick = () => { st.rows = null; draw(dlg); };
    $('#im-go', dlg).onclick = async () => {
      const b = $('#im-go', dlg); busy(b);
      try {
        const r = await call('bulkPlans', { items: ok.map((x) => ({ plan: x.plan, segments: x.segments })) });
        r.saved.forEach((s) => { S.db.Plans.push(s.plan); S.db.Segments.push(...s.segments); });
        closeModal(); toast(`นำเข้าแล้ว ${r.saved.length} แผน${bad.length ? ' • ข้าม ' + bad.length + ' แผนที่ต้องแก้' : ''}`);
        if (r.saved[0]) ui.year = Number(r.saved[0].plan.fiscal_year);
        app.refresh();
      } catch (x) { $('#im-err', dlg).textContent = x.message; busy(b, false); }
    };
  };
  modal('', { wide: true, onMount: draw });
}

function parse(raw) {
  const U = units().map((u) => u.name), O = offices().map((o) => o.short), map = new Map();
  raw.forEach((r, i) => {
    const g = (k) => String(r[k] ?? '').trim();
    const key = [g('ปีงบ'), g('หน่วยงาน'), g('รหัสงาน'), g('ชื่องาน')].join('|');
    if (!map.has(key)) map.set(key, { line: i + 2, plan: { fiscal_year: Number(g('ปีงบ')), unit: g('หน่วยงาน'), office: g('สำนัก'), work_code: g('รหัสงาน'), work_name: g('ชื่องาน'), budget: num(g('งบที่ได้รับ')), budget_cut: g('หลังปรับลด') ? num(g('หลังปรับลด')) : '' }, segments: [], err: '' });
    const it = map.get(key);
    if (g('สายทาง')) {
      const a = kmParse(g('กม.เริ่ม')), b = kmParse(g('กม.สิ้นสุด'));
      if (isNaN(a) || isNaN(b) || b <= a) it.err = it.err || `แถว ${i + 2}: กม. ไม่ถูกต้อง (รูปแบบ 12+345)`;
      else it.segments.push({ road: g('สายทาง'), km_from_m: a, km_to_m: b, side: g('ฝั่ง') || 'LT.,RT.' });
    }
  });
  const exist = new Set(plans().map((p) => [p.fiscal_year, p.unit, p.work_code, p.work_name].join('|')));
  return Array.from(map.values()).map((it) => {
    const p = it.plan;
    if (!it.err) {
      if (!/^\d{4}$/.test(String(p.fiscal_year))) it.err = 'ปีงบไม่ถูกต้อง';
      else if (!U.includes(p.unit)) it.err = `หน่วยงาน "${p.unit}" ไม่มีในระบบ`;
      else if (!O.includes(p.office)) it.err = `สำนัก "${p.office}" ไม่มีในระบบ`;
      else if (!/^\d{5}$/.test(p.work_code)) it.err = 'รหัสงานต้องเป็นตัวเลข 5 หลัก';
      else if (!(p.budget > 0)) it.err = 'งบประมาณว่าง';
      else if (p.budget_cut !== '' && p.budget_cut > p.budget) it.err = 'หลังปรับลดเกินงบ';
      else if (exist.has([p.fiscal_year, p.unit, p.work_code, p.work_name].join('|'))) it.err = 'ซ้ำกับแผนที่มีอยู่';
    }
    return it;
  });
}

/* ---------- รายละเอียดแผน ---------- */
export function detail(main, id, app) {
  const p = plans().find((x) => x.plan_id === id);
  if (!p) { main.innerHTML = empty('ไม่พบแผน ' + id); return; }
  const ST = statuses().filter((s) => s.scope === 'ทั้งหมด' || (p.isKhet ? s.scope !== 'แผนของแขวง' : s.scope !== 'แผนของเขต'));
  const curIdx = ST.findIndex((s) => s.status_code === p.status);
  const reached = new Set(p.logs.map((l) => l.to_status).concat([p.status]));
  const rev = userOf(p.reviewer), me = S.user.user_id;
  const mayUpdate = can('update_status') && (p.reviewer === me || isAdmin() || ['หัวหน้า', 'ธุรการ'].includes(S.user.role));
  const files = S.db.Files.filter((f) => f.link_type === 'plan' && f.link_id === p.plan_id);
  main.innerHTML = `
  <a href="#/plans" class="small row" style="gap:4px">${icon('back', 16)}ทะเบียนแผน › ${esc(p.unit)} › ${esc(p.office)} • ปีงบ ${p.fiscal_year}</a>
  <section class="card row wrap" style="gap:18px;align-items:flex-end">
    <div class="col grow" style="min-width:280px"><div class="row wrap"><span class="tag">${esc(p.plan_id)}</span><span class="tag">รหัสงาน ${esc(p.work_code)}</span>${statusPill(p.status)}${p.rounds ? `<span class="tag gold">ส่งกลับแก้ ${p.rounds} รอบ</span>` : ''}${p.late ? '<span class="tag red">เลยกำหนดรอบส่ง</span>' : ''}</div>
      <h1>${esc(p.work_name)}</h1><span class="muted small">${p.segs.map((s) => esc(s.road) + ' กม.' + kmText(s.km_from_m) + '–' + kmText(s.km_to_m) + ' ' + esc(s.side)).join(' • ') || 'ไม่ระบุสายทาง'}</span></div>
    <div class="row wrap"><div class="kpi" style="background:var(--soft)"><span class="l">งบที่ได้รับ</span><span class="v" style="font-size:22px">${money(p.budget)}</span></div>
      <div class="kpi" style="background:var(--soft)"><span class="l">หลังปรับลด</span><span class="v" style="font-size:22px">${money(p.budget_cut)}</span><span class="s">${p.budget_cut < p.budget ? '−' + money(p.budget - p.budget_cut) : 'ไม่ถูกปรับลด'}</span></div>
      <div class="kpi" style="background:var(--soft)"><span class="l">รอบส่ง</span><span class="v" style="font-size:18px">${p.round ? esc(p.round.name) + ' • ' + thDate(p.round.due_date) : 'ไม่มีกำหนด'}</span></div></div>
    ${can('edit_plan') ? `<button class="btn" id="pd-edit">แก้ไขแผน</button>` : ''}
  </section>
  <section class="card"><div class="stepper" style="--n:${ST.length}">${ST.map((s, i) => { const now = s.status_code === p.status, done = i < curIdx && reached.has(s.status_code); return `<div class="s ${now ? 'now' : done ? 'done' : ''}" style="--c:${esc(s.color)}"><div class="dotw"><span class="ln ${i > 0 && i <= curIdx ? 'on' : ''}" style="${i === 0 ? 'visibility:hidden' : ''}"></span><span class="dt">${done ? '✓' : i + 1}</span><span class="ln ${i < curIdx ? 'on' : ''}" style="${i === ST.length - 1 ? 'visibility:hidden' : ''}"></span></div><span style="font-weight:${now ? 600 : 400}">${esc(s.name)}</span></div>`; }).join('')}</div></section>
  <div class="grid g2">
    <div class="col" style="gap:14px">
      <section class="card"><h2>ช่วงสายทาง (${p.segs.length})</h2>${p.segs.length ? `<table class="tbl"><thead><tr><th>สายทาง</th><th>กม.เริ่ม</th><th>กม.สิ้นสุด</th><th>ระยะ</th><th>ฝั่ง</th></tr></thead><tbody>${p.segs.map((s) => `<tr><td><b>${esc(s.road)}</b></td><td class="num">${kmText(s.km_from_m)}</td><td class="num">${kmText(s.km_to_m)}</td><td class="num">${((s.km_to_m - s.km_from_m) / 1000).toFixed(3)} กม.</td><td>${esc(s.side)}</td></tr>`).join('')}</tbody></table>` : '<span class="faint">งานอาคาร / ไม่ระบุสายทาง</span>'}</section>
      <section class="card col" style="gap:10px"><h2 style="margin:0">ประวัติการเปลี่ยนสถานะ</h2>${p.logs.length ? p.logs.slice().reverse().map((l) => `<div class="row" style="align-items:flex-start"><span style="width:10px;height:10px;border-radius:50%;background:${esc(statusOf(l.to_status).color)};margin-top:6px;flex-shrink:0"></span><div class="col grow" style="gap:2px"><div class="row"><b class="small grow">${esc(statusOf(l.to_status).name)}</b><span class="faint">${thDateTime(l.at)}</span></div><span class="faint">${esc((userOf(l.by_user) || {}).full_name || l.by_user || '')}</span>${l.reason ? `<span class="small" style="background:var(--gold-soft);color:var(--gold-ink);border-radius:12px;padding:6px 10px;align-self:flex-start">รอบที่ ${esc(l.round_no || '')}: ${esc(l.reason)}</span>` : ''}</div></div>`).join('') : '<span class="faint">ยังไม่มีการเปลี่ยนสถานะ</span>'}</section>
    </div>
    <div class="col" style="gap:14px">
      <section class="card col" style="background:var(--green);color:#FFFEFB;gap:12px"><div class="row"><h2 class="grow" style="margin:0">อัปเดตสถานะ</h2><span class="small" style="color:#C7CDB8">${mayUpdate ? 'คุณอัปเดตได้' : 'เฉพาะผู้ตรวจของ ' + esc(p.unit)}</span></div>
        ${mayUpdate ? `<div class="row wrap">${ST.filter((s) => s.status_code !== p.status).map((s) => `<button class="btn sm" data-to="${esc(s.status_code)}" style="background:transparent;color:#FFFEFB;border-color:#7C8C76">${esc(s.name)}</button>`).join('')}</div>
        <label class="f" style="color:#DCE0CF">เหตุผล / หมายเหตุ <span id="pd-need"></span><textarea class="inp" id="pd-reason" style="background:#566A51;color:#fff;border-color:#687A62" placeholder="บังคับเมื่อส่งกลับแก้ไข"></textarea></label>
        <span class="err" id="pd-err" style="color:#F4C9B8"></span><button class="btn" id="pd-go" style="background:var(--gold);border-color:var(--gold);color:#3E4F3B;font-weight:600" disabled>เลือกสถานะก่อน</button>` : '<span class="small" style="color:#DCE0CF">การเปลี่ยนสถานะทำโดยผู้ตรวจที่รับผิดชอบหน่วยงานนี้</span>'}
      </section>
      <section class="card row">${rev ? avatar(rev, 46) : ''}<div class="col grow" style="gap:0"><span class="faint">ผู้ตรวจรับผิดชอบ ${esc(p.unit)}</span><b>${esc(rev ? rev.full_name + ' • ' + rev.position : '— (งานของเขต)')}</b></div></section>
      <section class="card col" style="gap:8px"><div class="row"><h3 class="grow">ไฟล์ที่ผูกกับแผนนี้</h3><a href="#/files" class="small">คลังเอกสาร</a></div>${files.length ? files.map((f) => `<a class="row small" href="${esc(f.drive_url)}" target="_blank" rel="noopener">${icon('file', 18)}<span class="grow">${esc(f.name)}</span>${icon('ext', 14)}</a>`).join('') : '<span class="faint">ยังไม่มีไฟล์ — ผูกไฟล์ได้จากหน้าคลังเอกสาร</span>'}</section>
    </div>
  </div>`;
  if ($('#pd-edit')) $('#pd-edit').onclick = () => planForm(p, app);
  let to = '';
  on(main, '[data-to]', 'click', (e, b) => {
    to = b.dataset.to; main.querySelectorAll('[data-to]').forEach((x) => { const on_ = x === b; x.style.background = on_ ? '#FFFEFB' : 'transparent'; x.style.color = on_ ? '#3E4F3B' : '#FFFEFB'; });
    const s = statusOf(to); $('#pd-need').textContent = s.need_reason === true || s.need_reason === 'TRUE' ? '* (ต้องระบุ • นับเป็นรอบส่งกลับ)' : '';
    const g = $('#pd-go'); g.disabled = false; g.textContent = 'ยืนยัน: ' + s.name;
  });
  const go = $('#pd-go');
  if (go) go.onclick = async () => {
    busy(go);
    try {
      const r = await call('changeStatus', { plan_id: p.plan_id, to, reason: $('#pd-reason').value });
      const i = S.db.Plans.findIndex((x) => x.plan_id === p.plan_id); S.db.Plans[i] = Object.assign({}, S.db.Plans[i], { status: r.plan.status });
      S.db.StatusLog.push(r.log); toast('บันทึกแล้ว → ' + statusOf(to).name); app.refresh();
    } catch (x) { $('#pd-err').textContent = x.message; busy(go, false); }
  };
}
