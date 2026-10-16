// ===== ทะเบียนแผน: แยกปีงบ › หน่วยงาน, ลงทะเบียน/แก้ไข, นำเข้า Excel, รายละเอียด + อัปเดตสถานะ =====
import { S, plans, planYears, defaultYear, units, offices, statuses, statusOf, unitOf, userOf, can, isAdmin, currentFY, cfg, KHWAENG_STAGES } from '../store.js';
import { call } from '../api.js';
import { esc, $, $$, on, money, mil, num, kmText, kmParse, thDate, thDateTime, debounce, loadXLSX } from '../util.js';
import { modal, modalHead, closeModal, toast, busy, avatar, statusPill, icon, empty } from '../ui.js';

const ui = { year: null, q: '', unit: 'all', office: 'all', status: 'all', kw: 'all', kh: 'all', open: {} };

export function view(main, arg, app) {
  main._app = app;
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
    <label class="search">${icon('search', 16)}<input id="p-q" value="${esc(ui.q)}" placeholder="ค้น ID / ชื่องาน / ทางหลวง / ตอน / จังหวัด เช่น 108" aria-label="ค้นหา"></label>
    <select id="p-unit" aria-label="หน่วยงาน"><option value="all">ทุกหน่วยงาน</option>${units().map((u) => `<option ${u.name === ui.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
    <select id="p-office" aria-label="สำนัก"><option value="all">ทุกสำนัก</option>${offices().map((o) => `<option ${o.short === ui.office ? 'selected' : ''}>${esc(o.short)}</option>`).join('')}</select>
    <select id="p-status" aria-label="สถานะ"><option value="all">ทุกสถานะ</option>${statuses().map((s) => `<option value="${s.status_code}" ${s.status_code === ui.status ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="fix" ${ui.status === 'fix' ? 'selected' : ''}>มีส่งกลับแก้ไข</option><option value="late" ${ui.status === 'late' ? 'selected' : ''}>เลยกำหนดรอบส่ง</option></select>
    <select id="p-kw" aria-label="สถานะแขวง"><option value="all">สถานะแขวง: ทั้งหมด</option>${KHWAENG_STAGES.map((s) => `<option ${s === ui.kw ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
    <select id="p-kh" aria-label="สถานะเขต"><option value="all">สถานะเขต: ทั้งหมด</option>${khetKeys().map((s) => `<option ${s === ui.kh ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
    <button class="btn sm" id="p-clear">ล้าง</button>
    <span class="right row"><button class="btn sm" id="p-cols">${icon('cols', 14)}เลือกคอลัมน์</button><button class="btn sm" id="p-ex">ขยายทั้งหมด</button><button class="btn sm" id="p-co">ย่อทั้งหมด</button></span>
  </div>
  <span class="small muted" id="p-count"></span>
  <div class="col" style="gap:12px" id="p-groups"></div>`;
  const draw = () => drawList(main);
  draw();
  $('#p-year').onchange = (e) => { ui.year = Number(e.target.value); view(main, arg, app); };
  $('#p-q').oninput = debounce((e) => { ui.q = e.target.value; draw(); }, 200);
  ['unit', 'office', 'status', 'kw', 'kh'].forEach((k) => ($('#p-' + k).onchange = (e) => { ui[k] = e.target.value; draw(); }));
  $('#p-clear').onclick = () => { Object.assign(ui, { q: '', unit: 'all', office: 'all', status: 'all', kw: 'all', kh: 'all' }); view(main, arg, app); };
  $('#p-ex').onclick = () => { units().forEach((u) => (ui.open[u.name] = true)); draw(); };
  $('#p-co').onclick = () => { ui.open = {}; ui.forceClosed = true; draw(); };
  $('#p-cols').onclick = () => colPicker(main);
  $('#p-export').onclick = () => exportPlans(filtered());
  if ($('#p-new')) $('#p-new').onclick = () => planForm(null, app);
  if ($('#p-import')) $('#p-import').onclick = () => importDialog(app);
  if (arg === 'new' && can('edit_plan')) planForm(null, app);
  if (arg === 'import' && can('edit_plan')) importDialog(app);
}

/** ตัวเลือกสถานะเขตตามลำดับขั้น (จากสถานะในตั้งค่า) */
const khetKeys = () => ['รอแขวงส่ง', 'ระหว่างตรวจ', 'ส่งแก้ไข'].concat(statuses().filter((s) => s.dash_group !== 'ยังไม่ส่ง' && s.dash_group !== 'แขวงส่งแล้ว').map((s) => s.name));

function filtered() {
  const q = ui.q.trim().toLowerCase();
  return plans().filter((p) => p.fiscal_year === ui.year
    && (ui.unit === 'all' || p.unit === ui.unit) && (ui.office === 'all' || p.office === ui.office)
    && (ui.kw === 'all' || p.khwaeng.key === ui.kw) && (ui.kh === 'all' || p.khet.key === ui.kh)
    && (ui.status === 'all' || (ui.status === 'fix' ? p.rounds > 0 : ui.status === 'late' ? p.late : p.status === ui.status))
    && (!q || [p.plan_id, p.id_code, p.work_code, p.work_name, p.unit, p.office, p.activity, p.province].concat(p.segs.flatMap((s) => [s.road, 'ทล.' + String(s.road).replace(/^ทล\.?\s*/, ''), s.control, s.section])).join(' ').toLowerCase().includes(q)));
}

/* ---------- คอลัมน์ตาราง (ลำดับเหมือนไฟล์ พ.ร.บ. ของสำนัก • เลือกแสดงได้ • จำไว้ในเครื่อง) ---------- */
const kmRange = (s) => (Number(s.km_to_m) > Number(s.km_from_m) ? `${kmText(s.km_from_m)} – ${kmText(s.km_to_m)}` : kmText(s.km_from_m));
/** คอลัมน์ระดับช่วงสายทาง: 1 บรรทัดต่อ 1 ช่วง (แผนที่มีหลายช่วงเรียงตรงกันทุกคอลัมน์) */
const segCol = (fn) => (p) => (p.segs.length ? p.segs.map((s) => `<div class="segl">${fn(s) || '&nbsp;'}</div>`).join('') : '<span class="faint">—</span>');
const segText = (p) => (p.segs.length ? p.segs.map((s) => `<div><b>${esc(s.road)}</b> ${kmRange(s)} <span class="faint">${esc(s.side)}</span></div>`).join('') : '<span class="faint">ไม่ระบุสายทาง</span>');
const stagePill = (s) => `<span class="pill" style="--c:${esc(s.color)}">${esc(s.label)}</span>`;
const COLDEF = [
  { k: 'idcode', l: 'ID CODE', w: 92, cls: 'num', td: (p) => esc(p.id_code || '') },
  { k: 'code', l: 'รหัสงาน', w: 72, cls: 'num', td: (p) => esc(p.work_code || '') },
  { k: 'activity', l: 'กิจกรรมตาม พ.ร.บ.', w: 170, cls: 'small', td: (p) => esc(p.activity || '') },
  { k: 'office', l: 'สำนัก', w: 80, td: (p) => esc(p.office), off: true },
  { k: 'province', l: 'จังหวัด', w: 90, td: (p) => esc(p.province || '') },
  { k: 'sthl', l: 'สทล.', w: 60, cls: 'num', td: (p) => esc(p.sthl || ''), off: true },
  { k: 'road', l: 'ทางหลวง', w: 92, cls: 'num', td: segCol((s) => `<b>${esc(s.road)}</b>`) },
  { k: 'control', l: 'ตอนควบคุม', w: 74, cls: 'num', td: segCol((s) => esc(s.control || '')) },
  { k: 'section', l: 'ชื่อตอน', w: 170, cls: 'small', td: segCol((s) => esc(s.section || '')), off: true },
  { k: 'km', l: 'กม. (ดำเนินการ)', w: 176, cls: 'num', td: segCol(kmRange) },
  { k: 'side', l: 'ทางหลัก', w: 70, cls: 'small', td: segCol((s) => esc(s.side || '')) },
  { k: 'parallel', l: 'ทางขนาน', w: 70, cls: 'small', td: segCol((s) => esc(s.parallel || '')), off: true },
  { k: 'segs', l: 'สายทาง • กม. • ฝั่ง (รวม)', w: 220, cls: 'num', td: segText, off: true },
  { k: 'name', l: 'ชื่องาน (ชื่อตอน พ.ร.บ.)', w: 260, td: (p) => `<a href="#/plan/${esc(p.plan_id)}" style="color:var(--ink);text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px;font-weight:500">${esc(p.work_name)}</a>` },
  { k: 'length', l: 'ระยะทาง (กม.)', w: 100, cls: 'r num', td: (p) => (p.length_km ? p.length_km.toFixed(3) : '<span class="faint">—</span>'), off: true },
  { k: 'budget', l: 'งบประมาณ (บาท)', w: 120, cls: 'r num', td: (p) => money(p.budget) },
  { k: 'round', l: 'รอบส่ง / กำหนด', w: 116, td: (p) => { const noDue = !p.round && !(cfg('Offices').find((o) => o.short === p.office) || {}).has_round; return `<span class="small" style="color:${p.late ? 'var(--red)' : 'var(--muted)'}">${noDue ? 'ไม่มีกำหนด' : p.round ? esc(p.round.name) + ' • ' + thDate(p.round.due_date) : '—'}${p.late ? ' • เลยกำหนด' : ''}</span>`; }, off: true },
  { k: 'khwaeng', l: 'สถานะแขวง', w: 120, td: (p) => stagePill(p.khwaeng) },
  { k: 'khet', l: 'สถานะเขต', w: 128, td: (p) => stagePill(p.khet) },
  { k: 'status', l: 'สถานะในระบบ', w: 140, td: (p) => statusPill(p.status), off: true },
  { k: 'rounds', l: 'ส่งกลับแก้', w: 70, td: (p) => (p.rounds ? `<span class="tag gold" data-tip="${esc('ส่งกลับแก้ ' + p.rounds + ' รอบ|' + p.reasons.join('|'))}">${p.rounds} รอบ</span>` : '<span class="faint">—</span>') },
  { k: 'note', l: 'หมายเหตุ', w: 180, td: (p) => esc(p.note || ''), off: true },
  { k: 'id', l: 'เลขที่แผน', w: 120, cls: 'num small', td: (p) => esc(p.plan_id), off: true }
];const COL_KEY = 'plan-cols-3';
function shownCols() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(COL_KEY) || 'null'); } catch (e) {}
  return COLDEF.filter((c) => (Array.isArray(saved) ? saved.includes(c.k) : !c.off));
}
function saveCols(keys) { try { localStorage.setItem(COL_KEY, JSON.stringify(keys)); } catch (e) {} }
/** แก้ไข/ลบได้: มีสิทธิ์ลงทะเบียนแผน • ปีงบที่ปิดแล้วเฉพาะผู้ดูแลระบบ */
const mayEdit = (p) => can('edit_plan') && (Number(p.fiscal_year) >= currentFY() || isAdmin());

function drawList(main) {
  const list = filtered(), yearAll = plans().filter((p) => p.fiscal_year === ui.year), ST = statuses();
  const g = (fn) => yearAll.filter(fn).length;
  $('#p-sum').innerHTML = [
    ['all', 'แผนทั้งหมด', yearAll.length, mil(yearAll.reduce((a, p) => a + p.budget, 0)) + ' ลบ.'],
    ['s-unsent', 'ยังไม่ส่ง', g((p) => p.st.dash_group === 'ยังไม่ส่ง'), ''],
    ['fix', 'มีส่งกลับแก้ไข', g((p) => p.rounds > 0), ''],
    ['s-dept', 'ส่งกรมแล้ว', g((p) => ['ส่งกรมแล้ว', 'กรมเห็นชอบ'].includes(p.st.dash_group)), 'เห็นชอบ ' + g((p) => p.st.dash_group === 'กรมเห็นชอบ')],
    ['late', 'เลยกำหนดรอบส่ง', g((p) => p.late), '']
  ].map((k) => `<button class="kpi ${ui.status === k[0] ? 'sel' : ''}" data-k="${k[0]}" ${k[0] === 'late' && k[2] ? 'style="background:var(--red-soft);color:var(--red)"' : ''}><span class="l">${esc(k[1])}</span><span class="v">${k[2]}</span><span class="s">${esc(k[3])}</span></button>`).join('');
  on($('#p-sum'), '[data-k]', 'click', (e, b) => { const k = b.dataset.k; ui.status = k === 'all' ? 'all' : k === 's-unsent' ? (ST.find((s) => s.dash_group === 'ยังไม่ส่ง') || {}).status_code || 'all' : k === 's-dept' ? (ST.find((s) => s.dash_group === 'ส่งกรมแล้ว') || {}).status_code || 'all' : k; $('#p-status').value = ui.status; drawList(main); });
  $('#p-count').textContent = `ปีงบ ${ui.year} • แสดง ${list.length} จาก ${yearAll.length} แผน • งบประมาณ ${money(list.reduce((a, p) => a + p.budget, 0))} บาท`;
  const filtering = ui.q || ui.status !== 'all' || ui.office !== 'all' || ui.unit !== 'all' || ui.kw !== 'all' || ui.kh !== 'all';
  const box = $('#p-groups');
  if (!list.length) { box.innerHTML = empty('ไม่พบแผนตามตัวกรองในปีงบ ' + ui.year); return; }
  const cols = shownCols(), act = can('edit_plan'), width = cols.reduce((a, c) => a + c.w, 0) + (act ? 80 : 0);
  box.innerHTML = units().map((u, ui_) => {
    const l = list.filter((p) => p.unit === u.name);
    if (!l.length) return '';
    const open = ui.open[u.name] ?? (ui.forceClosed ? false : (filtering || ui_ === 1));
    const c = ST.map((s) => l.filter((p) => p.status === s.status_code).length), sent = l.filter((p) => p.sent).length, late = l.filter((p) => p.late).length;
    const rev = userOf(u.reviewer_id);
    return `<section class="grp ${open ? 'open' : ''}" data-u="${esc(u.name)}">
      <button class="gh" aria-expanded="${open}"><span class="chev">${icon('chev', 18)}</span><b style="font-family:var(--head);font-size:18px;font-weight:500;min-width:84px">${esc(u.name)}</b>
        <span class="small muted">${l.length} แผน • ${mil(l.reduce((a, p) => a + p.budget, 0))} ลบ.</span>
        <span class="track" style="flex:1 1 140px;max-width:260px;height:10px">${c.map((v, i) => `<span style="flex-grow:${v};flex-basis:0;display:${v ? 'block' : 'none'};background:${ST[i].color}" data-tip="${esc(ST[i].name + '|' + v + ' แผน')}"></span>`).join('')}</span>
        <span class="small" style="font-weight:600;color:${sent / l.length < 0.85 ? 'var(--gold-ink)' : 'var(--green-ink)'}">${u.kind === 'เขต' ? 'ส่งกรมแล้ว' : 'ส่งแล้ว'} ${sent}/${l.length}</span>
        ${late ? `<span class="tag red">เลยกำหนด ${late}</span>` : ''}
        <span class="right row small muted">ผู้ตรวจ ${rev ? avatar(rev, 28) + '<b style="color:var(--ink);font-weight:500">' + esc(rev.full_name) + '</b>' : '—'}</span></button>
      ${open ? `<div class="gb scroll-x"><table class="tbl ptbl" style="min-width:${width}px;table-layout:fixed">
        <colgroup>${cols.map((c) => `<col style="width:${c.w}px">`).join('')}${act ? '<col style="width:80px">' : ''}</colgroup>
        <thead><tr>${cols.map((c, i) => `<th class="${c.cls && c.cls.includes('r') ? 'r' : ''}" ${i === 0 ? 'style="padding-left:18px"' : ''}>${esc(c.l)}</th>`).join('')}${act ? '<th class="stick-r"></th>' : ''}</tr></thead>
        <tbody>${l.map((p) => `<tr>${cols.map((c, i) => `<td class="${c.cls || ''}" ${i === 0 ? 'style="padding-left:18px"' : ''}>${c.td(p)}</td>`).join('')}${act ? `<td class="r stick-r" style="white-space:nowrap">${mayEdit(p) ? `<button class="icon-btn sm" data-edit="${esc(p.plan_id)}" title="แก้ไขแผน" aria-label="แก้ไขแผน">${icon('edit', 16)}</button><button class="icon-btn sm" data-del="${esc(p.plan_id)}" title="ลบแผน" aria-label="ลบแผน" style="color:var(--red)">${icon('trash', 16)}</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : ''}
    </section>`;
  }).join('');
  on(box, '.gh', 'click', (e, b) => { const n = b.parentElement.dataset.u; ui.open[n] = !b.parentElement.classList.contains('open'); drawList(main); });
  const find = (id) => plans().find((p) => p.plan_id === id);
  on(box, '[data-edit]', 'click', (e, b) => planForm(find(b.dataset.edit), main._app));
  on(box, '[data-del]', 'click', (e, b) => deletePlan(find(b.dataset.del), main._app));
}

/** เลือกคอลัมน์ที่แสดงในตาราง */
function colPicker(main) {
  const cur = new Set(shownCols().map((c) => c.k));
  modal(`${modalHead('เลือกคอลัมน์ที่แสดง', 'จำไว้ในเครื่องนี้ • ส่งออก Excel ได้ทุกคอลัมน์เสมอ')}
    <div class="col" style="gap:4px">${COLDEF.map((c) => `<label class="row" style="gap:10px;padding:6px 4px;cursor:pointer"><input type="checkbox" data-c="${c.k}" ${cur.has(c.k) ? 'checked' : ''} style="width:18px;height:18px">${esc(c.l)}</label>`).join('')}</div>
    <div class="dlg-foot"><button class="btn" id="cp-reset">ค่าเริ่มต้น</button><button class="btn pri" id="cp-ok">ใช้คอลัมน์นี้</button></div>`, {
    onMount: (dlg) => {
      $('#cp-reset', dlg).onclick = () => { try { localStorage.removeItem(COL_KEY); } catch (e) {} closeModal(); drawList(main); };
      $('#cp-ok', dlg).onclick = () => { const keys = $$('[data-c]', dlg).filter((x) => x.checked).map((x) => x.dataset.c); saveCols(keys.length ? keys : ['name']); closeModal(); drawList(main); };
    }
  });
}

/** ลบแผน (ช่วงสายทาง + ประวัติสถานะลบตาม • ไฟล์ที่ผูกไว้ยังอยู่ในคลังเอกสาร) */
function deletePlan(p, app) {
  if (!p) return;
  modal(`${modalHead('ลบแผนนี้?', p.plan_id + ' • ' + p.unit + ' • ' + p.office)}
    <div class="note red">${icon('warn')}<span><b>${esc([p.id_code, p.work_code].filter(Boolean).join(' / '))} ${esc(p.work_name)}</b><br>งบประมาณ ${money(p.budget)} บาท • ${p.segs.length} ช่วงสายทาง${p.logs.length ? ' • ประวัติสถานะ ' + p.logs.length + ' รายการ' : ''}<br>ลบแล้วกู้คืนไม่ได้ — ไฟล์ที่ผูกกับแผนยังอยู่ในคลังเอกสาร</span></div>
    <span class="err" id="pdl-err"></span>
    <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn danger" id="pdl-go">${icon('trash', 16)}ลบแผน</button></div>`, {
    onMount: (dlg) => {
      $('#pdl-go', dlg).onclick = async () => {
        const b = $('#pdl-go', dlg); busy(b);
        try {
          await call('deletePlan', { plan_id: p.plan_id });
          S.db.Plans = S.db.Plans.filter((x) => x.plan_id !== p.plan_id);
          S.db.Segments = S.db.Segments.filter((x) => x.plan_id !== p.plan_id);
          S.db.StatusLog = S.db.StatusLog.filter((x) => x.plan_id !== p.plan_id);
          S.db.Files.forEach((f) => { if (f.link_type === 'plan' && f.link_id === p.plan_id) { f.link_type = ''; f.link_id = ''; } });
          S.db.Meetings.forEach((m) => { if (m.plan_id === p.plan_id) m.plan_id = ''; });
          closeModal(); toast('ลบแผนแล้ว: ' + p.plan_id + ' ' + p.work_name);
          if (location.hash.startsWith('#/plan/')) app.go('plans'); else app.refresh();
        } catch (x) { $('#pdl-err', dlg).textContent = x.message; busy(b, false); }
      };
    }
  });
}

/* ---------- รูปแบบไฟล์ พ.ร.บ. ของสำนัก (ใช้ทั้งนำเข้า/ส่งออก/แม่แบบ) ---------- */
// หัวตาราง 2 แถวเหมือนไฟล์ต้นฉบับ • 1 แถว = 1 แผน • แผนที่มีหลายช่วง: ทางหลวง/ตอน/กม./ทางหลัก ขึ้นบรรทัดใหม่ในเซลล์เดียวกัน
const XL_HEAD = [['ลำดับ', 'ที่'], ['ID', 'CODE'], ['รหัสงาน', ''], ['กิจกรรมตาม พ.ร.บ.', ''], ['แขวง', 'ทางหลวง'], ['พื้นที่ดำเนินการ', 'จังหวัด'], ['สทล.', ''], ['ทางหลวง', 'หมายเลข'], ['ตอน', 'ควบคุม'], ['ชื่อตอน', ''], ['กม.\n(ดำเนินการ)', 'เริ่มต้น'], ['', 'สิ้นสุด'], ['ทางหลัก', ''], ['ทางขนาน', ''], ['ชื่อตอน พ.ร.บ.', ''], ['งบประมาณ', '(บาท)']];
const roadNo = (r) => String(r || '').replace(/^ทล\.?\s*/, '');
const roadName = (v) => (/^\d+$/.test(v) ? 'ทล.' + v : v);

function xlRow(p, i) {
  const S_ = (fn) => p.segs.map(fn).join('\n');
  return [i + 1, p.id_code || '', p.work_code || '', p.activity || '', p.unit, p.province || '', p.sthl || '', S_((s) => roadNo(s.road)), S_((s) => s.control || ''), S_((s) => s.section || ''),
    S_((s) => kmText(s.km_from_m)), S_((s) => (Number(s.km_to_m) > Number(s.km_from_m) ? kmText(s.km_to_m) : '')), S_((s) => s.side || ''), S_((s) => s.parallel || ''), p.work_name, p.budget];
}

async function exportPlans(rows) {
  try { await loadXLSX(); } catch (e) { return toast(e.message, 'err'); }
  const extra = ['สำนัก', 'ปีงบ', 'สถานะแขวง', 'สถานะเขต', 'สถานะในระบบ', 'ส่งกลับแก้ (รอบ)', 'หมายเหตุ', 'เลขที่แผน'];
  const aoa = [[`ทะเบียนแผนงาน ปีงบประมาณ ${ui.year}`], XL_HEAD.map((h) => h[0]).concat(extra), XL_HEAD.map((h) => h[1]).concat(extra.map(() => ''))];
  rows.forEach((p, i) => aoa.push(xlRow(p, i).concat([p.office, p.fiscal_year, p.khwaeng.label, p.khet.label, p.st.name, p.rounds, p.note || '', p.plan_id])));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 1, c: 10 }, e: { r: 1, c: 11 } }];
  ws['!cols'] = [6, 11, 8, 28, 16, 12, 6, 8, 8, 24, 11, 11, 9, 9, 50, 14, 10, 7, 14, 16, 14, 8, 20, 14].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'ทะเบียนแผน');
  XLSX.writeFile(wb, `ทะเบียนแผน_ปีงบ${ui.year}.xlsx`);
}

/* ---------- ฟอร์มลงทะเบียน / แก้ไข ---------- */
const SIDES = ['LT+RT', 'LT', 'RT', 'MLR', 'FL', 'FR'];
const newSeg = () => ({ road: '', control: '', section: '', from: '', to: '', side: 'LT+RT', parallel: '' });
function planForm(plan, app) {
  const isNew = !plan;
  const f = plan ? { ...plan, segs: plan.segs.map((s) => ({ road: s.road, control: s.control || '', section: s.section || '', from: kmText(s.km_from_m), to: Number(s.km_to_m) > Number(s.km_from_m) ? kmText(s.km_to_m) : '', side: s.side, parallel: s.parallel || '' })) }
    : { fiscal_year: ui.year || currentFY(), unit: units()[1] ? units()[1].name : '', office: offices()[0] ? offices()[0].short : '', id_code: '', work_code: '', work_name: '', activity: '', province: '', sthl: '', budget: '', note: '', segs: [newSeg()] };
  if (!f.segs.length) f.segs.push(newSeg());
  const offOpts = (u) => offices().filter((o) => (unitOf(u).kind === 'เขต' ? o.scope !== 'เฉพาะแขวง' : o.scope !== 'เฉพาะเขต'));
  const acts = [...new Set(plans().map((p) => p.activity).filter(Boolean))].sort();
  const provs = [...new Set(units().map((u) => u.province).concat(plans().map((p) => p.province)).filter(Boolean))].sort();
  const draw = (dlg) => {
    dlg.innerHTML = `${modalHead(isNew ? 'ลงทะเบียนแผนงาน' : 'แก้ไขแผน ' + plan.plan_id, 'ช่องตามไฟล์ พ.ร.บ. ของสำนัก • 1 แผนมีได้หลายช่วงสายทาง • กม. รูปแบบ 12+345')}
    <datalist id="pf-acts">${acts.map((a) => `<option value="${esc(a)}">`).join('')}</datalist><datalist id="pf-provs">${provs.map((a) => `<option value="${esc(a)}">`).join('')}</datalist><datalist id="pf-sides">${SIDES.map((a) => `<option value="${a}">`).join('')}</datalist>
    <div class="fgrid">
      <label class="f">ปีงบประมาณ (พ.ศ.) *<input class="inp" data-k="fiscal_year" value="${esc(f.fiscal_year)}" inputmode="numeric" maxlength="4" placeholder="เช่น ${currentFY()}"></label>
      <label class="f">หน่วยงาน (แขวง) *<select class="inp" data-k="unit">${units().map((u) => `<option ${u.name === f.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
      <label class="f">สำนัก *<select class="inp" data-k="office">${offOpts(f.unit).map((o) => `<option ${o.short === f.office ? 'selected' : ''}>${esc(o.short)}</option>`).join('')}</select></label>
    </div>
    <div class="fgrid">
      <label class="f">ID CODE<input class="inp num" data-k="id_code" value="${esc(f.id_code || '')}" inputmode="numeric" placeholder="70026016"></label>
      <label class="f">รหัสงาน<input class="inp num" data-k="work_code" value="${esc(f.work_code || '')}" inputmode="numeric" placeholder="22000"></label>
    <div class="fgrid">
      <label class="f">กิจกรรมตาม พ.ร.บ.<input class="inp" data-k="activity" value="${esc(f.activity || '')}" list="pf-acts" placeholder="เช่น งานบำรุงตามกำหนดเวลา"></label>
      <label class="f">พื้นที่ดำเนินการ (จังหวัด)<input class="inp" data-k="province" value="${esc(f.province || '')}" list="pf-provs"></label>
      <label class="f">สทล.<input class="inp" data-k="sthl" value="${esc(f.sthl || '')}" style="max-width:120px"></label>
    </div>
    <label class="f">ชื่องาน (ชื่อตอน พ.ร.บ.) *<input class="inp" data-k="work_name" value="${esc(f.work_name)}" placeholder="เช่น งานบำรุงตามกำหนดเวลา ทางหลวงหมายเลข 101 ตอน … จ.แพร่"></label>
    <div class="col" style="background:var(--soft);border-radius:20px;padding:12px;gap:8px">
      <div class="row"><b class="small grow">ช่วงสายทาง (${f.segs.length})</b><span class="faint">กม.สิ้นสุด ว่างได้ (จุดเดียว เช่น สะพาน) • งานอาคารไม่ต้องระบุ</span></div>
      <div class="segrow segh faint"><span>ทางหลวง</span><span>ตอนควบคุม</span><span>ชื่อตอน</span><span>กม.เริ่มต้น</span><span>กม.สิ้นสุด</span><span>ทางหลัก</span><span>ทางขนาน</span><span></span></div>
      ${f.segs.map((s, i) => `<div class="segrow" data-seg="${i}">
        <input class="inp" data-s="road" value="${esc(s.road)}" placeholder="ทล.101" aria-label="ทางหลวง"><input class="inp" data-s="control" value="${esc(s.control)}" placeholder="0101" aria-label="ตอนควบคุม">
        <input class="inp" data-s="section" value="${esc(s.section)}" placeholder="ชื่อตอน" aria-label="ชื่อตอน">
        <input class="inp" data-s="from" value="${esc(s.from)}" placeholder="1+000" aria-label="กม.เริ่มต้น"><input class="inp" data-s="to" value="${esc(s.to)}" placeholder="3+000" aria-label="กม.สิ้นสุด">
        <input class="inp" data-s="side" value="${esc(s.side)}" list="pf-sides" aria-label="ทางหลัก"><input class="inp" data-s="parallel" value="${esc(s.parallel)}" list="pf-sides" aria-label="ทางขนาน">
        <button class="icon-btn" data-rm="${i}" aria-label="ลบช่วง" ${f.segs.length < 2 ? 'disabled' : ''}>${icon('x', 16)}</button></div>`).join('')}
      <button class="btn sm" id="pf-add" style="align-self:flex-start">${icon('plus', 14)}เพิ่มช่วงสายทาง</button>
    </div>
    <div class="fgrid">
      <label class="f">งบประมาณ (บาท) *<input class="inp num" data-k="budget" value="${esc(f.budget)}" inputmode="numeric"></label>
      <label class="f">หมายเหตุ<input class="inp" data-k="note" value="${esc(f.note || '')}"></label>
    </div>
    <div class="row wrap small"><span class="tag">ผู้ตรวจ: ${esc((userOf(unitOf(f.unit).reviewer_id) || {}).full_name || '—')}</span><span class="tag">${isNew ? 'สถานะเริ่มต้น' : 'สถานะ'}: ${esc(statusOf(isNew ? (unitOf(f.unit).kind === 'เขต' ? 's0' : 's1') : plan.status).name)}</span></div>
    <span class="err" id="pf-err"></span>
    <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button><button class="btn pri" id="pf-save">บันทึกแผน</button></div>`;
    $$('[data-k]', dlg).forEach((el) => (el.onchange = el.oninput = () => { f[el.dataset.k] = el.value; if (el.dataset.k === 'unit' && el.tagName === 'SELECT') { const o = offOpts(f.unit); if (!o.some((x) => x.short === f.office)) f.office = o[0] ? o[0].short : ''; if (!f.province) f.province = unitOf(f.unit).province || ''; draw(dlg); } }));
    $$('[data-seg]', dlg).forEach((r) => $$('[data-s]', r).forEach((el) => (el.oninput = el.onchange = () => (f.segs[r.dataset.seg][el.dataset.s] = el.value))));
    on(dlg, '[data-rm]', 'click', (e, b) => { f.segs.splice(Number(b.dataset.rm), 1); draw(dlg); });
    $('#pf-add', dlg).onclick = () => { const l = f.segs[f.segs.length - 1] || {}; f.segs.push({ ...newSeg(), road: l.road || '', control: l.control || '', section: l.section || '' }); draw(dlg); };
    $('#pf-save', dlg).onclick = async () => {
      const err = $('#pf-err', dlg), segs = [];
      if (!/^2[5-6]\d{2}$/.test(String(f.fiscal_year).trim())) return (err.textContent = 'ปีงบประมาณต้องเป็น พ.ศ. 4 หลัก เช่น ' + currentFY());
      const idc = String(f.id_code || '').trim(), wc = String(f.work_code || '').trim();
      if (!idc && !wc) return (err.textContent = 'กรุณาใส่ ID CODE หรือรหัสงาน อย่างน้อย 1 อย่าง');
      if ((idc && !/^\d{4,12}$/.test(idc)) || (wc && !/^\d{4,12}$/.test(wc))) return (err.textContent = 'ID CODE / รหัสงาน ต้องเป็นตัวเลข');
      for (let i = 0; i < f.segs.length; i++) {
        const s = f.segs[i]; if (!s.road && !s.from && !s.to) continue;
        const a = kmParse(s.from), b = String(s.to).trim() ? kmParse(s.to) : a;
        if (!s.road.trim() || isNaN(a) || isNaN(b)) return (err.textContent = `ช่วงที่ ${i + 1}: ใส่ทางหลวง และ กม. รูปแบบ 12+345`);
        if (b < a) return (err.textContent = `ช่วงที่ ${i + 1}: กม.สิ้นสุด ต้องไม่น้อยกว่า กม.เริ่มต้น`);
        segs.push({ road: roadName(s.road.trim()), km_from_m: a, km_to_m: b, side: s.side.trim(), control: s.control.trim(), section: s.section.trim(), parallel: s.parallel.trim() });
      }
      if (!segs.length && f.office !== 'สร. (งานอาคาร)') return (err.textContent = 'กรุณาระบุช่วงสายทางอย่างน้อย 1 ช่วง');
      const payload = { plan: { plan_id: plan ? plan.plan_id : '', fiscal_year: Number(String(f.fiscal_year).trim()), unit: f.unit, office: f.office, id_code: idc, work_code: wc, work_name: String(f.work_name).trim(), activity: (f.activity || '').trim(), province: (f.province || '').trim(), sthl: String(f.sthl || '').trim(), budget: num(f.budget), budget_cut: null, note: f.note || '' }, segments: segs };
      if (!payload.plan.plan_id) delete payload.plan.plan_id;
      const btn = $('#pf-save', dlg); busy(btn);
      try {
        const r = await call('savePlan', payload);
        mergeSaved([r]);
        ui.year = Number(r.plan.fiscal_year); ui.open[r.plan.unit] = true;
        closeModal(); toast((isNew ? 'ลงทะเบียนแล้ว: ' : 'บันทึกแล้ว: ') + r.plan.plan_id + ' ' + r.plan.work_name);
        app.refresh();
      } catch (x) { err.textContent = x.message; busy(btn, false); }
    };
  };
  modal('', { wide: true, onMount: draw });
}

/** ใส่ผลบันทึกกลับเข้าข้อมูลในเครื่อง (แผนใหม่ = เพิ่ม • แผนเดิม = แทนที่ พร้อมช่วงสายทาง) */
function mergeSaved(list) {
  list.forEach((r) => {
    const i = S.db.Plans.findIndex((x) => x.plan_id === r.plan.plan_id);
    if (i >= 0) S.db.Plans[i] = Object.assign({}, S.db.Plans[i], r.plan); else S.db.Plans.push(r.plan);
    S.db.Segments = S.db.Segments.filter((s) => s.plan_id !== r.plan.plan_id).concat(r.segments);
  });
}

/* ---------- นำเข้า Excel: อ่านไฟล์ พ.ร.บ. ของสำนักได้ตรงๆ (รวมทุกแขวงทั้งประเทศ → เลือกเฉพาะแขวงของเรา) ---------- */
const MAP_KEY = 'plan-import-map';
const norm = (v) => String(v ?? '').replace(/_x000D_|\s+/g, '');
const cellLines = (v) => String(v ?? '').replace(/_x000D_|\r/g, '').split('\n').map((x) => x.trim());
/** หัวคอลัมน์ (รวม 2 แถว) → ชนิดข้อมูล • ลำดับสำคัญ: ตรวจอันที่เจาะจงกว่าก่อน */
const FIELD = [
  ['plan_id', (s) => s.startsWith('เลขที่แผน')],
  ['id', (s) => /^ID/i.test(s)],
  ['code', (s) => s.startsWith('รหัสงาน')],
  ['activity', (s) => s.includes('กิจกรรม')],
  ['unit', (s) => s.startsWith('แขวง') || s.startsWith('หน่วยงาน')],
  ['province', (s) => s.includes('พื้นที่') || s === 'จังหวัด'],
  ['sthl', (s) => s.startsWith('สทล')],
  ['name', (s) => (s.includes('พ.ร.บ') && s.startsWith('ชื่อ')) || s.startsWith('ชื่องาน')],
  ['road', (s) => s.startsWith('ทางหลวง') || s.startsWith('สายทาง')],
  ['control', (s) => s.startsWith('ตอนควบคุม') || s === 'ตอน'],
  ['section', (s) => s.startsWith('ชื่อตอน')],
  ['from', (s) => s.includes('เริ่ม')],
  ['to', (s) => s.includes('สิ้นสุด')],
  ['side', (s) => s.startsWith('ทางหลัก') || s === 'ฝั่ง'],
  ['parallel', (s) => s.startsWith('ทางขนาน')],
  ['budget', (s) => s.startsWith('งบประมาณ') || s.startsWith('งบที่ได้รับ')],
  ['office', (s) => s.startsWith('สำนัก')],
  ['fy', (s) => s.startsWith('ปีงบ')],
  ['note', (s) => s.startsWith('หมายเหตุ')]
];

/** อ่านแผ่นงาน: หาแถวหัวตาราง → จับคอลัมน์ → รวมแถวเป็นแผน */
function readSheet(aoa, sheetName) {
  let h = aoa.findIndex((r, i) => i < 15 && r.some((c) => { const s = norm(c); return /^ID/i.test(s) || s.startsWith('รหัสงาน') || s.includes('ชื่อตอนพ.ร.บ') || s.startsWith('ชื่องาน'); }));
  if (h < 0) return { error: 'ไม่พบหัวตาราง — ต้องมีคอลัมน์ ID / รหัสงาน และ ชื่อตอน พ.ร.บ. / ชื่องาน' };
  const sub = aoa[h + 1] || [];
  const hasSub = sub.some((c) => /^(เริ่มต้น|สิ้นสุด|CODE|ที่|จังหวัด|หมายเลข|ควบคุม)/.test(norm(c)));
  const width = Math.max(...aoa.slice(h, h + 2).map((r) => r.length));
  const col = {};
  for (let c = 0; c < width; c++) {
    const s = norm(aoa[h][c]) + (hasSub ? norm(sub[c]) : '');
    const hit = FIELD.find(([k, fn]) => col[k] === undefined && s && fn(s));
    if (hit) col[hit[0]] = c;
  }
  // ปีงบจากหัวกระดาษ "…ประจำปี 2570" หรือชื่อแผ่นงาน "70"
  const title = aoa.slice(0, h).flat().join(' ');
  const fy = Number((title.match(/25\d{2}/) || [])[0]) || (/^\d{2}$/.test(String(sheetName).trim()) ? 2500 + Number(sheetName) : 0);
  const rows = [];
  aoa.slice(h + (hasSub ? 2 : 1)).forEach((r, i) => {
    const g = (k) => (col[k] === undefined ? '' : r[col[k]]);
    const id = String(g('id') ?? '').replace(/\D/g, '') + String(g('code') ?? '').replace(/\D/g, ''), name = String(g('name') ?? '').trim();
    if (!id && !name) return;   // แถวว่าง / แถวรวม "จำนวน … แผนงาน"
    rows.push({ line: i + h + (hasSub ? 3 : 2), g });
  });
  return { col, fy, rows };
}

function autoUnit(name) {
  const n = (s) => String(s || '').replace(/แขวงทางหลวง(ชนบท)?/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').toLowerCase();
  const x = n(name), u = x && units().find((u) => n(u.name) === x || n(u.short) === x);
  return u ? u.name : '';
}
function savedMap() { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}') || {}; } catch (e) { return {}; } }

/** แปลงแถวในไฟล์เป็นแผน (ยังไม่ตรวจกับระบบ) */
function toPlans(sheet, st) {
  const out = new Map();
  sheet.rows.forEach(({ line, g }) => {
    const fileUnit = String(g('unit') || '').trim(), unit = st.map[fileUnit] ?? '';
    const fy = Number(String(g('fy') || '').trim()) || st.fy, id = String(g('id') ?? '').replace(/\D/g, '');
    const plan = { fiscal_year: fy, unit, office: String(g('office') || '').trim() || st.office, id_code: id, work_code: String(g('code') ?? '').replace(/\D/g, ''), work_name: String(g('name') || '').replace(/\s+/g, ' ').trim(),
      activity: String(g('activity') || '').trim(), province: String(g('province') || '').trim(), sthl: String(g('sthl') ?? '').trim(), budget: num(g('budget')), budget_cut: null };
    if (g('note')) plan.note = String(g('note')).trim();
    const pid = String(g('plan_id') || '').trim();   // ไฟล์ที่ส่งออกจากระบบมี "เลขที่แผน" → อัปเดตแผนนั้นตรงๆ
    if (pid) plan.plan_id = pid;
    const key = pid || keyOf(plan);
    if (!out.has(key)) out.set(key, { line, fileUnit, plan, segments: [], err: '' });
    const it = out.get(key);
    // ช่วงสายทาง: บรรทัดในเซลล์ กม.เริ่มต้น = 1 ช่วง • ทางหลวง/ตอน/ชื่อตอน/ทางหลัก ที่เว้นบรรทัดไว้ใช้ค่าบรรทัดก่อนหน้า
    const L = Object.fromEntries(['road', 'control', 'section', 'from', 'to', 'side', 'parallel'].map((k) => [k, cellLines(g(k))]));
    const carry = (k, i) => { for (let j = i; j >= 0; j--) if (L[k][j]) return L[k][j]; return ''; };
    L.from.forEach((fr, i) => {
      if (!fr) return;
      let a = kmParse(fr), b = L.to[i] ? kmParse(L.to[i]) : a;
      if (isNaN(a) || isNaN(b)) { it.err = it.err || `แถว ${line}: กม. "${fr}${L.to[i] ? ' – ' + L.to[i] : ''}" ไม่ถูกต้อง`; return; }
      if (b < a) [a, b] = [b, a];
      it.segments.push({ road: roadName(carry('road', i)), control: carry('control', i), section: carry('section', i), km_from_m: a, km_to_m: b, side: carry('side', i), parallel: L.parallel[i] || '' });
    });
    if (!L.from.some(Boolean) && L.road.some(Boolean)) it.err = it.err || `แถว ${line}: มีทางหลวงแต่ไม่มี กม.`;
  });
  return [...out.values()];
}

/** แผนเดียวกัน = ปีงบ + ID CODE (ไม่ซ้ำทั้งประเทศ) • แผนเก่าที่ไม่มี ID ใช้ ปีงบ + หน่วยงาน + รหัสงาน + ชื่องาน */
const keyOf = (p) => (p.id_code ? p.fiscal_year + '|' + p.id_code : [p.fiscal_year, p.unit, p.work_code, p.work_name].join('|'));

/** ตรวจกับข้อมูลในระบบ: ใหม่ / อัปเดต (ID ซ้ำในปีงบเดียวกัน) / ผิดพลาด */
function check(items, st) {
  const O = offices().map((o) => o.short), byKey = new Map();
  plans().forEach((p) => byKey.set(keyOf(p), p));
  return items.map((it) => {
    const p = it.plan, r = { ...it, plan: { ...p }, mode: 'new' };
    const old = p.plan_id ? plans().find((x) => x.plan_id === p.plan_id) : byKey.get(keyOf(p));
    if (p.plan_id && !old) delete r.plan.plan_id;   // เลขที่แผนไม่มีในระบบ (เช่น ลบไปแล้ว) → ลงเป็นแผนใหม่
    if (r.err) return r;
    if (!/^25\d{2}$/.test(String(p.fiscal_year))) r.err = 'ไม่ทราบปีงบ — ใส่ปีงบด้านบน';
    else if (!O.includes(p.office)) r.err = `สำนัก "${p.office}" ไม่มีในระบบ`;
    else if (!p.id_code && !p.work_code) r.err = 'ไม่มี ID CODE / รหัสงาน';
    else if ((p.id_code && !/^\d{4,12}$/.test(p.id_code)) || (p.work_code && !/^\d{4,12}$/.test(p.work_code))) r.err = 'ID CODE / รหัสงาน ต้องเป็นตัวเลข';
    else if (!p.work_name) r.err = 'ไม่มีชื่องาน';
    else if (!(p.budget > 0)) r.err = 'งบประมาณว่าง';
    else if (old) { if (st.update) { r.mode = 'update'; r.plan.plan_id = old.plan_id; r.old = old; } else r.err = 'มีในระบบแล้ว (ข้าม)'; }
    return r;
  });
}

function importDialog(app) {
  const st = { file: '', sheet: null, fy: ui.year || currentFY(), office: '', map: {}, update: true, showAll: false };
  const draw = (dlg) => {
    if (!st.sheet) {
      dlg.innerHTML = `${modalHead('นำเข้าแผนจาก Excel', 'ใช้ไฟล์ทะเบียน พ.ร.บ. ของสำนักได้เลย (รวมทุกแขวง) — ระบบเลือกเฉพาะแขวงที่ตรงกับหน่วยงานในระบบ')}
        <label class="col center" style="border:2px dashed #B8C7AE;background:#F7F9F3;border-radius:24px;padding:34px;cursor:pointer;align-items:center;gap:6px">${icon('up', 34)}<b>เลือกไฟล์ .xlsx</b><span class="faint">คอลัมน์: ID CODE • รหัสงาน • กิจกรรมตาม พ.ร.บ. • แขวง • จังหวัด • สทล. • ทางหลวง • ตอนควบคุม • ชื่อตอน • กม. เริ่มต้น/สิ้นสุด • ทางหลัก • ทางขนาน • ชื่อตอน พ.ร.บ. • งบประมาณ</span><input type="file" accept=".xlsx,.xls,.csv" id="im-file" hidden></label>
        <span class="err" id="im-err"></span>
        <div class="row wrap note grey"><span class="grow">ไม่มีไฟล์? ดาวน์โหลดแม่แบบรูปแบบเดียวกับไฟล์ พ.ร.บ. • แผนที่มีหลายช่วงสายทาง ให้ขึ้นบรรทัดใหม่ในเซลล์ (Alt+Enter)</span><button class="btn sm" id="im-tpl">${icon('download', 14)}ดาวน์โหลดแม่แบบ</button></div>
        <div class="dlg-foot"><button class="btn" data-dismiss>ยกเลิก</button></div>`;
      $('#im-tpl', dlg).onclick = async () => {
        try { await loadXLSX(); } catch (x) { return toast(x.message, 'err'); }
        const u = units().find((x) => x.kind !== 'เขต') || {};
        const ws = XLSX.utils.aoa_to_sheet([[`รายละเอียดแผนงานงบประมาณ พ.ร.บ.ประจำปี ${ui.year || currentFY()}`], XL_HEAD.map((h) => h[0]), XL_HEAD.map((h) => h[1]),
          [1, 70000001, '22000', 'งานบำรุงตามกำหนดเวลา', u.name || 'แขวง 1', u.province || '', 2, 101, '0101', 'ชื่อตอน', '1+000\n5+200', '3+000\n6+000', 'LT+RT\nRT', '', 'งานบำรุงตามกำหนดเวลา ทางหลวงหมายเลข 101 ตอน ชื่อตอน จ.' + (u.province || ''), 9600000]]);
        ws['!merges'] = [{ s: { r: 1, c: 10 }, e: { r: 1, c: 11 } }];
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, String(ui.year || currentFY()).slice(-2)); XLSX.writeFile(wb, 'แม่แบบทะเบียนแผน.xlsx');
      };
      $('#im-file', dlg).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try { await loadXLSX(); } catch (x) { return toast(x.message, 'err'); }
        const wb = XLSX.read(await file.arrayBuffer());
        const name = wb.SheetNames[0], sheet = readSheet(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true }), name);
        if (sheet.error) { $('#im-err', dlg).textContent = sheet.error; return; }
        st.file = file.name; st.sheet = sheet; if (sheet.fy) st.fy = sheet.fy;
        // สำนักจากชื่อไฟล์ เช่น "ทะเบียนแผน สร..xlsx" → สร. (เลือกชื่อที่ยาวสุดที่อยู่ในชื่อไฟล์)
        st.office = offices().map((o) => o.short).filter((s) => file.name.includes(s)).sort((a, b) => b.length - a.length)[0] || (offices()[0] || {}).short || '';
        const saved = savedMap();
        [...new Set(sheet.rows.map((r) => String(r.g('unit') || '').trim()))].forEach((n) => (st.map[n] = saved[n] !== undefined ? saved[n] : autoUnit(n)));
        if (sheet.col.unit === undefined) st.map[''] = saved[''] ?? (units().find((x) => x.kind !== 'เขต') || {}).name ?? '';
        draw(dlg);
      };
      return;
    }
    const all = toPlans(st.sheet, st), mine = all.filter((x) => x.plan.unit), res = check(mine, st);
    const ok = res.filter((r) => !r.err), bad = res.filter((r) => r.err), nNew = ok.filter((r) => r.mode === 'new').length, nUp = ok.length - nNew;
    const names = [...new Set(all.map((x) => x.fileUnit))], cnt = (n) => all.filter((x) => x.fileUnit === n);
    const mapped = names.filter((n) => st.map[n]), other = names.filter((n) => !st.map[n]);
    const unitSel = (n) => `<select class="inp" data-map="${esc(n)}" style="height:36px"><option value="">— ไม่นำเข้า —</option>${units().map((u) => `<option ${u.name === st.map[n] ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
    const mapRow = (n) => `<tr><td><b>${esc(n || '(ไม่มีคอลัมน์แขวง)')}</b></td><td class="r num">${cnt(n).length}</td><td class="r num">${mil(cnt(n).reduce((a, x) => a + x.plan.budget, 0))}</td><td>${unitSel(n)}</td></tr>`;
    const changed = (r) => r.old && (r.old.work_name !== r.plan.work_name || Number(r.old.budget) !== r.plan.budget || r.old.segs.length !== r.segments.length) ? ' • มีการเปลี่ยนแปลง' : '';
    dlg.innerHTML = `${modalHead('ตรวจสอบก่อนนำเข้า', st.file + ' • ' + all.length + ' แผนในไฟล์')}
      <div class="fgrid">
        <label class="f">ปีงบประมาณ<input class="inp" id="im-fy" value="${esc(st.fy)}" inputmode="numeric" maxlength="4"></label>
        <label class="f">สำนัก (ไฟล์นี้)<select class="inp" id="im-office">${offices().map((o) => `<option ${o.short === st.office ? 'selected' : ''}>${esc(o.short)}</option>`).join('')}</select></label>
        <label class="row small" style="gap:8px;align-self:end;padding-bottom:10px;cursor:pointer"><input type="checkbox" id="im-up" ${st.update ? 'checked' : ''} style="width:18px;height:18px">อัปเดตแผนที่มี ID เดียวกันอยู่แล้ว (สถานะเดิมคงไว้)</label>
      </div>
      <section class="col" style="gap:6px"><b class="small">แขวงในไฟล์ → หน่วยงานในระบบ</b>
        ${mapped.length ? `<div class="scroll-x" style="border:1px solid var(--line2);border-radius:16px"><table class="tbl"><thead><tr><th>แขวงในไฟล์</th><th class="r">แผน</th><th class="r">ลบ.</th><th>นำเข้าเป็น</th></tr></thead><tbody>${mapped.map(mapRow).join('')}</tbody></table></div>`
          : '<div class="note">ยังไม่มีแขวงในไฟล์ที่ตรงกับชื่อหน่วยงานในระบบ — เลือกจับคู่ด้านล่าง (ระบบจำไว้ใช้ครั้งต่อไป) หรือให้ผู้ดูแลระบบตั้งชื่อหน่วยงานให้ตรงกับไฟล์ เช่น "แพร่", "น่านที่ 1"</div>'}
        ${other.length ? `<details ${mapped.length ? '' : 'open'}><summary class="small" style="cursor:pointer">แขวงอื่นในไฟล์ ${other.length} แขวง (ไม่นำเข้า) — กดเพื่อจับคู่เพิ่ม</summary>
          <div class="scroll-x" style="max-height:30vh;border:1px solid var(--line2);border-radius:16px;margin-top:6px"><table class="tbl"><tbody>${other.map(mapRow).join('')}</tbody></table></div></details>` : ''}
      </section>
      <div class="row wrap"><span class="tag green">แผนใหม่ ${nNew}</span>${nUp ? `<span class="tag" style="background:var(--blue-soft);color:#3B5A78">อัปเดต ${nUp}</span>` : ''}${bad.length ? `<span class="tag red">ข้าม ${bad.length}</span>` : ''}<span class="faint">งบรวม ${money(ok.reduce((a, r) => a + r.plan.budget, 0))} บาท</span></div>
      ${res.length ? `<div class="scroll-x" style="max-height:40vh;border:1px solid var(--line2);border-radius:16px"><table class="tbl"><thead><tr><th>แถว</th><th>หน่วยงาน</th><th>ID CODE</th><th>รหัสงาน</th><th>กิจกรรม</th><th>ชื่องาน</th><th>ช่วง</th><th class="r">งบประมาณ</th><th>ผลตรวจ</th></tr></thead>
      <tbody>${res.map((r) => `<tr style="background:${r.err ? '#FCF1EC' : ''}"><td>${r.line}</td><td>${esc(r.plan.unit)}</td><td class="num">${esc(r.plan.id_code)}</td><td class="num">${esc(r.plan.work_code)}</td><td class="small">${esc(r.plan.activity)}</td><td class="small">${esc(r.plan.work_name)}</td><td class="small num">${r.segments.map((s) => esc(s.road) + ' ' + kmRange(s)).join('<br>')}</td><td class="r num">${money(r.plan.budget)}</td>
        <td style="color:${r.err ? 'var(--red)' : r.mode === 'update' ? '#3B5A78' : 'var(--green-ink)'};font-weight:600;white-space:nowrap">${esc(r.err || (r.mode === 'update' ? '↻ อัปเดต ' + r.plan.plan_id + changed(r) : '✓ ใหม่'))}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <span class="err" id="im-err"></span>
      <div class="dlg-foot"><button class="btn" id="im-back">เลือกไฟล์ใหม่</button><button class="btn pri" id="im-go" ${ok.length ? '' : 'disabled'}>นำเข้า ${ok.length} แผน</button></div>`;
    $('#im-back', dlg).onclick = () => { st.sheet = null; draw(dlg); };
    $('#im-fy', dlg).onchange = (e) => { st.fy = Number(e.target.value) || st.fy; draw(dlg); };
    $('#im-office', dlg).onchange = (e) => { st.office = e.target.value; draw(dlg); };
    $('#im-up', dlg).onchange = (e) => { st.update = e.target.checked; draw(dlg); };
    $$('[data-map]', dlg).forEach((el) => (el.onchange = () => {
      st.map[el.dataset.map] = el.value;
      const m = savedMap(); m[el.dataset.map] = el.value; try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) {}
      draw(dlg);
    }));
    $('#im-go', dlg).onclick = async () => {
      const b = $('#im-go', dlg); busy(b);
      try {
        const r = await call('bulkPlans', { items: ok.map((x) => ({ plan: x.plan, segments: x.segments })) });
        mergeSaved(r.saved);
        closeModal(); toast(`นำเข้าแล้ว ${r.saved.length} แผน (ใหม่ ${nNew} • อัปเดต ${nUp})${bad.length ? ' • ข้าม ' + bad.length : ''}`);
        if (r.saved[0]) ui.year = Number(r.saved[0].plan.fiscal_year);
        app.refresh();
      } catch (x) { $('#im-err', dlg).textContent = x.message; busy(b, false); }
    };
  };
  modal('', { wide: true, onMount: draw });
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
    <div class="col grow" style="min-width:280px"><div class="row wrap"><span class="tag">${esc(p.plan_id)}</span>${p.id_code ? `<span class="tag">ID ${esc(p.id_code)}</span>` : ''}${p.work_code ? `<span class="tag">รหัสงาน ${esc(p.work_code)}</span>` : ''}${p.activity ? `<span class="tag">${esc(p.activity)}</span>` : ''}${p.province ? `<span class="tag">จ.${esc(p.province)}</span>` : ''}${statusPill(p.status)}${p.rounds ? `<span class="tag gold">ส่งกลับแก้ ${p.rounds} รอบ</span>` : ''}${p.late ? '<span class="tag red">เลยกำหนดรอบส่ง</span>' : ''}</div>
      <h1>${esc(p.work_name)}</h1><span class="muted small">${p.segs.map((s) => esc(s.road) + (s.control ? ' ตอน ' + esc(s.control) : '') + ' กม.' + kmRange(s) + ' ' + esc(s.side)).join(' • ') || 'ไม่ระบุสายทาง'}</span></div>
    <div class="row wrap"><div class="kpi" style="background:var(--soft)"><span class="l">งบประมาณ (บาท)</span><span class="v" style="font-size:22px">${money(p.budget)}</span></div>
      <div class="kpi" style="background:var(--soft)"><span class="l">สถานะแขวง</span><span class="v" style="font-size:16px">${stagePill(p.khwaeng)}</span></div>
      <div class="kpi" style="background:var(--soft)"><span class="l">สถานะเขต</span><span class="v" style="font-size:16px">${stagePill(p.khet)}</span></div>
      <div class="kpi" style="background:var(--soft)"><span class="l">รอบส่ง</span><span class="v" style="font-size:18px">${p.round ? esc(p.round.name) + ' • ' + thDate(p.round.due_date) : 'ไม่มีกำหนด'}</span></div></div>
    ${mayEdit(p) ? `<div class="row"><button class="btn" id="pd-edit">${icon('edit', 16)}แก้ไขแผน</button><button class="btn danger" id="pd-del">${icon('trash', 16)}ลบ</button></div>` : ''}
  </section>
  <section class="card"><div class="stepper" style="--n:${ST.length}">${ST.map((s, i) => { const now = s.status_code === p.status, done = i < curIdx && reached.has(s.status_code); return `<div class="s ${now ? 'now' : done ? 'done' : ''}" style="--c:${esc(s.color)}"><div class="dotw"><span class="ln ${i > 0 && i <= curIdx ? 'on' : ''}" style="${i === 0 ? 'visibility:hidden' : ''}"></span><span class="dt">${done ? '✓' : i + 1}</span><span class="ln ${i < curIdx ? 'on' : ''}" style="${i === ST.length - 1 ? 'visibility:hidden' : ''}"></span></div><span style="font-weight:${now ? 600 : 400}">${esc(s.name)}</span></div>`; }).join('')}</div></section>
  <div class="grid g2">
    <div class="col" style="gap:14px">
      <section class="card"><h2>ช่วงสายทาง (${p.segs.length})</h2>${p.segs.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>ทางหลวง</th><th>ตอน</th><th>ชื่อตอน</th><th>กม.เริ่มต้น</th><th>กม.สิ้นสุด</th><th>ระยะ</th><th>ทางหลัก</th><th>ทางขนาน</th></tr></thead><tbody>${p.segs.map((s) => `<tr><td><b>${esc(s.road)}</b></td><td class="num">${esc(s.control || '')}</td><td class="small">${esc(s.section || '')}</td><td class="num">${kmText(s.km_from_m)}</td><td class="num">${Number(s.km_to_m) > Number(s.km_from_m) ? kmText(s.km_to_m) : '—'}</td><td class="num">${((s.km_to_m - s.km_from_m) / 1000).toFixed(3)} กม.</td><td>${esc(s.side)}</td><td>${esc(s.parallel || '')}</td></tr>`).join('')}</tbody></table></div>` : '<span class="faint">งานอาคาร / ไม่ระบุสายทาง</span>'}</section>
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
  if ($('#pd-del')) $('#pd-del').onclick = () => deletePlan(p, app);
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
