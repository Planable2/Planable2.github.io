// ===== รายงานสถานะแผน: ตาราง (หน้าเว็บ) + วาดเป็นภาพ PNG (canvas) เพื่อส่งรายงานทาง LINE/มือถือ =====
// สถานะ 2 กลุ่ม: สถานะแผน (ยังไม่ส่ง → แขวงส่ง → ส่งกรม → เห็นชอบ) • สถานะจัดซื้อจัดจ้าง (เห็นชอบ → ร่าง TOR → … → ลงนามสัญญา)
import { units, offices, statuses, setting, PLAN_GROUPS, planStatuses, procStatuses, approvedStatus } from './store.js';
import { esc, mil, money, thDate, truthy } from './util.js';
import { modal, modalHead, toast, icon } from './ui.js';

/* ---------- ข้อมูล ---------- */
const gi = (p) => Math.max(0, PLAN_GROUPS.indexOf(p.pg));
const procIdx = (p) => (p.proc ? procStatuses().findIndex((s) => s.status_code === p.status) : -1);
export const MODES = { plan: 'สถานะแผน', proc: 'สถานะจัดซื้อจัดจ้าง', both: 'ทั้ง 2 แบบ' };
const shortName = (n) => (n.length > 9 ? n.slice(0, 8) + '…' : n);
/** คอลัมน์สะสม (นับแผนที่ไปถึงขั้นนั้นแล้ว) ตามแบบที่เลือก • prog = ใช้เป็นตัววัดความก้าวหน้าได้ */
export function colsFor(mode = 'plan') {
  const n = { k: 'n', l: 'จำนวนแผน', s: 'แผน', f: () => true };
  const sent = { k: 'sent', l: 'ส่งแผนแล้ว', s: 'ส่ง', f: (p) => gi(p) >= 1, prog: 1 };
  const fix = { k: 'fix', l: 'ระหว่างแก้ไข', s: 'แก้ไข', f: (p) => truthy(p.st.need_reason) };
  const dept = { k: 'dept', l: 'ส่งกรมแล้ว', s: 'ส่งกรม', f: (p) => gi(p) >= 2, prog: 1 };
  const ok = { k: 'ok', l: 'กรมเห็นชอบ', s: 'เห็นชอบ', f: (p) => gi(p) >= 3, prog: 1 };
  const proc = procStatuses().map((s, i) => ({ k: 'p_' + s.status_code, l: s.name, s: shortName(s.name), color: s.color, f: (p) => procIdx(p) >= i, prog: 1 }));
  if (mode === 'proc') return [n, ok].concat(proc);
  if (mode === 'both') return [n, sent, dept, ok].concat(proc);
  return [n, sent, fix, dept, ok];
}
export const progOptions = (mode) => colsFor(mode).filter((c) => c.prog);
export function defaultProg(mode) { const o = progOptions(mode); return mode === 'plan' ? 'dept' : (o[o.length - 1] || { k: 'ok' }).k; }
const progLabel = (mode, prog) => (colsFor(mode).find((c) => c.k === prog) || { l: prog }).l;
const progShort = (mode, prog) => { const c = colsFor(mode).find((x) => x.k === prog) || { l: prog, s: prog }; return '% ' + (c.l.length <= 12 ? c.l : c.s); };
/** ตัวเลือกที่ส่งเข้ามา (mode/prog) → ค่าที่ใช้ได้จริง */
function opt(o = {}) { const mode = MODES[o.mode] ? o.mode : 'plan'; const prog = progOptions(mode).some((c) => c.k === o.prog) ? o.prog : defaultProg(mode); return { mode, prog, cols: colsFor(mode) }; }
export const ORG = () => setting('org_name', 'สทล.2 (แพร่)');
/** ชื่อหน่วยงานแบบสั้น: "แขวงทางหลวงน่านที่ 1" → "น่านที่ 1" */
export const uLabel = (n) => String(n || '').replace(/^แขวงทางหลวง(ชนบท)?\s*/, '') || String(n || '');

/** สถานะสำหรับกราฟตามแบบที่เลือก: แผน = จัดซื้อทั้งหมดนับเป็น "กรมเห็นชอบ" • จัดซื้อ = ก่อนเห็นชอบรวมเป็น "ยังไม่ถึงขั้นจัดซื้อ" */
export function seriesFor(mode = 'both') {
  if (mode === 'plan') return planStatuses().map((s) => ({ code: s.status_code, name: s.name, color: s.color }));
  if (mode === 'proc') { const a = approvedStatus(); return [{ code: '__pre', name: 'ยังไม่ถึงขั้นจัดซื้อ', color: '#E5E5EA' }, { code: a.status_code, name: 'รอเริ่มจัดซื้อ (เห็นชอบแล้ว)', color: a.color }].concat(procStatuses().map((s) => ({ code: s.status_code, name: s.name, color: s.color }))); }
  return statuses().map((s) => ({ code: s.status_code, name: s.name, color: s.color }));
}
export function codeFor(p, mode = 'both') {
  if (mode === 'plan') return p.proc ? approvedStatus().status_code : p.status;
  if (mode === 'proc') return p.proc ? p.status : p.pg === 'กรมเห็นชอบ' ? approvedStatus().status_code : '__pre';
  return p.status;
}

/** ความก้าวหน้าของรายการแผน ตามแบบ/ตัววัดที่เลือก → { n, v (จำนวนที่ถึงขั้นแล้ว), label } */
export function progOf(list, o) { o = opt(o); const c = o.cols.find((x) => x.k === o.prog); return { n: list.length, v: c ? list.filter(c.f).length : 0, label: c ? c.l : '' }; }
export function tally(list, cols = colsFor('plan')) {
  const r = { budget: list.reduce((a, p) => a + p.budget, 0), late: list.filter((p) => p.late).length, fixN: list.filter((p) => truthy(p.st.need_reason)).length };
  cols.forEach((c) => (r[c.k] = list.filter(c.f).length));
  return r;
}
const pct = (r, prog) => (r.n ? ((r[prog] || 0) / r.n) * 100 : 0);
const unitsOf = (set) => units().filter((u) => set.some((p) => p.unit === u.name) || u.kind !== 'เขต');
/** บล็อกต่อสำนัก + บล็อกรวม (เหมือนรายงานตัวอย่างของเขตอื่น) */
export function officeBlocks(set, cols) {
  const us = unitsOf(set);
  const block = (title, l) => ({ title, rows: us.map((u) => ({ label: uLabel(u.name), key: u.name, ...tally(l.filter((p) => p.unit === u.name), cols) })), total: tally(l, cols) });
  const out = offices().filter((o) => set.some((p) => p.office === o.short)).map((o) => block(o.full && o.full !== o.short ? `${o.full} (${o.short})` : o.short, set.filter((p) => p.office === o.short)));
  if (out.length > 1) out.push(block('รวมทุกสำนัก', set));
  return out;
}
export const summaryBlock = (set, cols) => ({ title: 'รวมทุกสำนัก', rows: unitsOf(set).map((u) => ({ label: uLabel(u.name), key: u.name, ...tally(set.filter((p) => p.unit === u.name), cols) })), total: tally(set, cols) });

const heatColor = (v, n) => (!n ? '#EFEFF4' : v >= 100 ? '#30A14E' : v >= 75 ? '#8FD6A3' : v >= 50 ? '#CDEBD5' : v >= 25 ? '#FFF0C2' : v > 0 ? '#FFE0C2' : '#FBD9D6');
/** สีอ่อน → ใช้ตัวอักษรเข้ม */
const light = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 170; };
const heatInk = (v, n) => (n && v >= 100 ? '#fff' : '#1D1D1F');

/* ---------- HTML (หน้าเว็บ) ---------- */
const hd = (l, s) => `<span class="hl">${esc(l)}</span><span class="hs">${esc(s)}</span>`;
const nz = (v) => (v ? Number(v).toLocaleString() : '-');
const EMPTY = '<div class="empty">ไม่มีแผนตามตัวกรองนี้</div>';
function tableHTML(b, o) {
  const p = pct(b.total, o.prog), pl = progLabel(o.mode, o.prog);
  const cls = (c) => (c.color ? ` style="box-shadow:inset 0 -3px 0 ${esc(c.color)}"` : '');
  return `<div class="rep-blk"><div class="rep-ttl">${esc(b.title)}${o.mode !== 'plan' ? `<span class="rep-mode">${esc(MODES[o.mode])}</span>` : ''}</div>
    <div class="scroll-x"><table class="tbl rep-tbl ${o.mode}"><thead><tr><th>${hd('หน่วยงาน', '')}</th>${o.cols.map((c) => `<th class="r"${cls(c)}>${hd(c.l, c.s)}</th>`).join('')}<th class="r bud">งบ (ลบ.)</th><th class="r">${hd(progShort(o.mode, o.prog), '%')}</th></tr></thead><tbody>
    ${b.rows.map((r) => `<tr data-cat="${esc(r.key)}"><td><b>${esc(r.label)}</b></td>${o.cols.map((c) => `<td class="r">${nz(r[c.k])}</td>`).join('')}<td class="r bud">${r.budget ? mil(r.budget) : '-'}</td><td class="r">${r.n ? Math.round(pct(r, o.prog)) + '%' : '-'}</td></tr>`).join('')}
    <tr class="rep-tot"><td><b>รวม</b></td>${o.cols.map((c) => `<td class="r"><b>${nz(b.total[c.k])}</b></td>`).join('')}<td class="r bud"><b>${mil(b.total.budget)}</b></td><td class="r"><b>${Math.round(p)}%</b></td></tr></tbody></table></div>
    <div class="rep-prog"><span class="small">ความก้าวหน้า (${esc(pl)}) ${b.total[o.prog] || 0} จาก ${b.total.n} แผน</span><b class="small">${p.toFixed(2)}%</b><div class="track"><span style="width:${p}%"></span></div></div></div>`;
}
export const officeHTML = (set, o) => { o = opt(o); return set.length ? officeBlocks(set, o.cols).map((b) => tableHTML(b, o)).join('') : EMPTY; };
export const summaryHTML = (set, o) => { o = opt(o); return set.length ? tableHTML(summaryBlock(set, o.cols), o) : EMPTY; };
export function heatHTML(set, o) {
  o = opt(o);
  if (!set.length) return EMPTY;
  const us = unitsOf(set), os = offices().filter((x) => set.some((p) => p.office === x.short));
  const cell = (l) => { const r = tally(l, o.cols), v = pct(r, o.prog); return `<td class="heat" style="background:${heatColor(v, r.n)};color:${heatInk(v, r.n)}" data-tip="${esc(r.n ? `${r[o.prog]}/${r.n} แผน • ${mil(r.budget)} ลบ.` : 'ไม่มีแผน')}">${r.n ? `<b>${Math.round(v)}%</b><span>${r[o.prog]}/${r.n}</span>` : '—'}</td>`; };
  return `<div class="scroll-x"><table class="tbl heat-tbl"><thead><tr><th>หน่วยงาน</th>${os.map((x) => `<th>${esc(x.short)}</th>`).join('')}<th>รวม</th></tr></thead><tbody>
    ${us.map((u) => `<tr data-cat="${esc(u.name)}"><td><b>${esc(uLabel(u.name))}</b></td>${os.map((x) => cell(set.filter((p) => p.unit === u.name && p.office === x.short))).join('')}${cell(set.filter((p) => p.unit === u.name))}</tr>`).join('')}
    <tr class="rep-tot"><td><b>รวม</b></td>${os.map((x) => cell(set.filter((p) => p.office === x.short))).join('')}${cell(set)}</tr></tbody></table></div>
    <div class="legend" style="margin-top:8px">${[[0, '0%'], [1, '1–24%'], [25, '25–49%'], [50, '50–74%'], [75, '75–99%'], [100, '100%']].map(([v, l]) => `<span><i style="background:${heatColor(v, 1)}"></i>${l}</span>`).join('')}<span class="faint">= ${esc(progLabel(o.mode, o.prog))} ÷ จำนวนแผน</span></div>`;
}
/** แผนค้าง: สถานะแผน = ยังไม่ส่ง/กำลังแก้ไข • จัดซื้อจัดจ้าง = เห็นชอบแล้วแต่ยังไม่ถึงขั้นสุดท้าย */
export function pendingHTML(set, o) {
  o = opt(o);
  const last = procStatuses().length - 1;
  const planP = (p) => gi(p) === 0 || truthy(p.st.need_reason), procP = (p) => p.pg === 'กรมเห็นชอบ' && procIdx(p) < last;
  const l = set.filter((p) => (o.mode === 'plan' ? planP(p) : o.mode === 'proc' ? procP(p) : planP(p) || procP(p)))
    .sort((a, b) => (b.late - a.late) || (procIdx(a) - procIdx(b)) || a.unit.localeCompare(b.unit) || b.budget - a.budget);
  if (!l.length) return `<div class="empty">ไม่มีแผนค้าง${o.mode === 'proc' ? 'ในขั้นจัดซื้อจัดจ้าง' : ''} 🎉</div>`;
  return `<table class="tbl pend-tbl"><thead><tr><th>หน่วยงาน</th><th>งาน</th><th class="r">ลบ.</th><th>สถานะ</th></tr></thead><tbody>
    ${l.map((p) => `<tr data-plan="${esc(p.plan_id)}"><td><b class="small">${esc(uLabel(p.unit))}</b><br><span class="faint">${esc(p.office)}</span></td><td class="small"><a href="#/plan/${esc(p.plan_id)}" class="num">${esc(p.id_code || p.work_code || p.plan_id)}</a> ${esc(p.work_name)}</td><td class="r num small">${mil(p.budget)}</td><td class="small">${p.late ? '<span class="tag red">เลยกำหนด</span><br>' : ''}${esc(procP(p) ? p.procStage.label : p.khet.label)}</td></tr>`).join('')}</tbody></table>
    <span class="faint">${l.length} แผน${o.mode === 'proc' ? 'ที่เห็นชอบแล้วแต่ยังไม่ถึง "' + esc((procStatuses()[last] || {}).name || '') + '"' : 'ที่ยังไม่ส่งหรือกำลังแก้ไข'} • เรียงเลยกำหนดก่อน</span>`;
}

/* ---------- ภาพรายงาน (canvas) ---------- */
const W = 1000, PAD = 28, C = { ink: '#1D1D1F', muted: '#6E6E73', faint: '#86868B', line: '#E5E5EA', soft: '#F5F5F7', card: '#FFFFFF', panel: '#1D1D1F', bar: '#0071E3', total: '#F2F2F7', head: '#EFEFF4' };
const TILE = ['#FFFFFF', '#E8F1FD', '#FFF4E0', '#E3F6F9', '#E6F4EA', '#F3EEFB', '#FDECEB', '#EAF0FF', '#EFEFF4'];
const FH = "'Mitr', 'IBM Plex Sans Thai Looped', sans-serif", FB = "'IBM Plex Sans Thai Looped', 'Sarabun', sans-serif";
const font = (ctx, size, w = 400, head = false) => (ctx.font = `${w} ${size}px ${head ? FH : FB}`);
function text(ctx, s, x, y, { size = 16, w = 400, head = false, color = C.ink, align = 'left', max } = {}) {
  font(ctx, size, w, head); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  let t = String(s);
  if (max) while (t.length > 1 && ctx.measureText(t).width > max) t = t.slice(0, -2) + '…';
  ctx.fillText(t, x, y);
}
function rrect(ctx, x, y, w, h, r, fill) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fillStyle = fill; ctx.fill(); }
function wrap(ctx, s, max) { const out = []; let line = ''; for (const ch of String(s)) { if (ctx.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; }

function header(ctx, meta, title) {
  rrect(ctx, 0, 0, W, 92, 0, C.panel);
  text(ctx, title, PAD, 34, { size: 26, w: 500, head: true, color: '#fff' });
  text(ctx, `${ORG()} • ปีงบประมาณ ${meta.year}${meta.filter ? ' • ' + meta.filter : ''}`, PAD, 68, { size: 16, color: 'rgba(255,255,255,.75)' });
  text(ctx, `ณ วันที่ ${thDate(new Date())}`, W - PAD, 34, { size: 16, color: 'rgba(255,255,255,.75)', align: 'right' });
  text(ctx, 'Planable2', W - PAD, 68, { size: 14, color: 'rgba(255,255,255,.5)', align: 'right' });
  return 112;
}
function kpis(ctx, y, t, o) {
  const items = o.cols.map((c) => [c.l, t[c.k], c.k === 'n' ? mil(t.budget) + ' ลบ.' : c.k === 'fix' ? 'แผน' : Math.round(pct(t, c.k)) + '%']);
  const per = items.length > 5 ? Math.ceil(items.length / 2) : items.length, gap = 12, w = (W - PAD * 2 - gap * (per - 1)) / per;
  items.forEach(([l, v, s], i) => {
    const x = PAD + (i % per) * (w + gap), yy = y + Math.floor(i / per) * (96 + gap);
    rrect(ctx, x, yy, w, 96, 16, TILE[i % TILE.length]);
    text(ctx, l, x + 14, yy + 22, { size: 14, color: C.muted, max: w - 24 });
    text(ctx, Number(v || 0).toLocaleString(), x + 14, yy + 54, { size: 30, w: 500, head: true });
    text(ctx, s, x + 14, yy + 80, { size: 13, color: C.muted });
  });
  return y + Math.ceil(items.length / per) * (96 + gap) + 8;
}
function progBar(ctx, y, label, p, sub) {
  text(ctx, label, PAD, y + 10, { size: 14, color: C.muted });
  text(ctx, p.toFixed(2) + '%', W - PAD, y + 10, { size: 15, w: 600, color: C.panel, align: 'right' });
  rrect(ctx, PAD, y + 22, W - PAD * 2, 10, 5, '#E8E8ED');
  if (p > 0) rrect(ctx, PAD, y + 22, Math.max(10, (W - PAD * 2) * Math.min(1, p / 100)), 10, 5, C.bar);
  if (sub) text(ctx, sub, PAD, y + 46, { size: 13, color: C.faint });
  return y + (sub ? 62 : 44);
}
/** หัวตารางยาว → 2 บรรทัด (ตัดที่ช่องว่าง ถ้าไม่มีตัดตามตัวอักษร) */
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
/** ตัดคำภาษาไทยตามขอบเขตคำ (Intl.Segmenter) — ไม่ตัดกลางคำ */
const words = (s) => (SEG ? [...SEG.segment(s)].map((x) => x.segment) : String(s).split(/(\s+)/));
function head2(ctx, s, max) {
  font(ctx, 13, 600); if (ctx.measureText(s).width <= max) return [s];
  const w = words(s); let a = '', i = 0;
  while (i < w.length && ctx.measureText((a + w[i]).trim()).width <= max) a += w[i++];
  if (!a) return [s];   // คำเดียวยาวเกิน → ให้ text() ย่อด้วย …
  return [a.trim(), w.slice(i).join('').trim()];
}
function tableBlock(ctx, y, b, o) {
  const prog = o.prog, bud = o.cols.length <= 7, last = 92, uw = 160;
  const each = (W - PAD * 2 - uw - last - (bud ? 100 : 0)) / o.cols.length;
  const cols = [{ l: 'หน่วยงาน', w: uw, a: 'left' }].concat(o.cols.map((c) => ({ l: c.l, w: each, color: c.color })), bud ? [{ l: 'งบ (ลบ.)', w: 100 }] : [], [{ l: progShort(o.mode, prog), w: last }]);
  rrect(ctx, PAD, y, W - PAD * 2, 40, 10, C.panel);
  text(ctx, b.title, PAD + 14, y + 20, { size: 18, w: 500, head: true, color: '#fff', max: W - PAD * 2 - 28 });
  y += 40;
  const row = (cells, bg, bold, h = 34, size = 15) => {
    ctx.fillStyle = bg; ctx.fillRect(PAD, y, W - PAD * 2, h);
    let x = PAD;
    cells.forEach((v, i) => { const c = cols[i]; text(ctx, v, c.a === 'left' ? x + 12 : x + c.w - 10, y + h / 2, { size, w: bold || i === 0 ? 600 : 400, align: c.a === 'left' ? 'left' : 'right', max: c.w - 14 }); x += c.w; });
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD, y + h - 0.5); ctx.lineTo(W - PAD, y + h - 0.5); ctx.stroke();
    y += h;
  };
  // หัวตาราง: ยาวได้ 2 บรรทัด + แถบสีของสถานะจัดซื้อ
  const heads = cols.map((c) => head2(ctx, c.l, c.w - 14)), hh = heads.some((h) => h.length > 1) ? 50 : 36;
  ctx.fillStyle = C.head; ctx.fillRect(PAD, y, W - PAD * 2, hh);
  let hx = PAD;
  heads.forEach((h, i) => { const c = cols[i], tx = c.a === 'left' ? hx + 12 : hx + c.w - 10, al = c.a === 'left' ? 'left' : 'right';
    h.forEach((ln, k) => text(ctx, ln, tx, y + hh / 2 + (h.length > 1 ? (k ? 9 : -9) : 0), { size: 13, w: 600, align: al, max: c.w - 12 }));
    if (c.color) { ctx.fillStyle = c.color; ctx.fillRect(hx + 4, y + hh - 4, c.w - 8, 4); }
    hx += c.w; });
  y += hh;
  const cellsOf = (r, label) => [label].concat(o.cols.map((c) => (r[c.k] ? Number(r[c.k]).toLocaleString() : '-')), bud ? [r.budget ? mil(r.budget) : '-'] : [], [r.n ? Math.round(pct(r, prog)) + '%' : '-']);
  b.rows.forEach((r, i) => row(cellsOf(r, r.label), i % 2 ? C.soft : C.card));
  row(cellsOf(b.total, 'รวม'), C.total, true);
  const pl = progLabel(o.mode, prog);
  return progBar(ctx, y + 8, `ความก้าวหน้า (${pl})`, pct(b.total, prog), `${pl} ${b.total[prog] || 0} จาก ${b.total.n} แผน • งบประมาณ ${money(b.total.budget)} บาท`) + 14;
}
function footer(ctx, y) {
  text(ctx, 'ข้อมูลจากทะเบียนแผน Planable2 • ' + new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }), W / 2, y + 16, { size: 13, color: C.faint, align: 'center' });
  return y + 40;
}

function statusRows(set, measure, mode) {
  const ST = seriesFor(mode), money_ = measure === 'budget';
  return { ST, rows: unitsOf(set).map((u) => { const l = set.filter((p) => p.unit === u.name); return { label: uLabel(u.name), n: l.length, vals: ST.map((s) => { const x = l.filter((p) => codeFor(p, mode) === s.code); return money_ ? x.reduce((a, p) => a + p.budget, 0) / 1e6 : x.length; }) }; }).filter((r) => r.n) };
}
function legend(ctx, y, items) {
  let x = PAD;
  items.forEach(([l, c]) => { font(ctx, 14); const w = ctx.measureText(l).width + 34; if (x + w > W - PAD) { x = PAD; y += 26; } rrect(ctx, x, y + 4, 14, 14, 3, c); text(ctx, l, x + 20, y + 11, { size: 14, color: C.muted }); x += w; });
  return y + 34;
}

/** แต่ละแบบคืนค่า y สุดท้าย (วาด 2 รอบ: วัดความสูง แล้ววาดจริง) */
const KINDS = {
  office: { l: 'ตารางแยกสำนัก', d: 'เหมือนรายงานของเขตอื่น • ทุกสำนัก + รวม', draw(ctx, set, m) { let y = header(ctx, m, m.mode === 'proc' ? 'ติดตามสถานะจัดซื้อจัดจ้าง' : 'ระบบติดตามสถานะแผน'); officeBlocks(set, m.cols).forEach((b) => (y = tableBlock(ctx, y, b, m))); return footer(ctx, y); } },
  summary: { l: 'สรุปรวม + ตาราง', d: 'ตัวเลขสรุป + ตารางรวมทุกหน่วยงาน', draw(ctx, set, m) { let y = header(ctx, m, m.mode === 'proc' ? 'สรุปสถานะจัดซื้อจัดจ้าง' : 'สรุปสถานะแผนงาน'); y = kpis(ctx, y, tally(set, m.cols), m); y = tableBlock(ctx, y, summaryBlock(set, m.cols), m); return footer(ctx, y); } },
  bars: { l: 'กราฟแท่งสถานะ', d: 'สถานะปัจจุบันแยกหน่วยงาน', draw(ctx, set, m) {
    let y = header(ctx, m, m.mode === 'proc' ? 'สถานะจัดซื้อจัดจ้างแยกหน่วยงาน' : 'สถานะแผนแยกหน่วยงาน'); y = kpis(ctx, y, tally(set, m.cols), m);
    const { ST, rows } = statusRows(set, m.measure, m.mode), max = Math.max(1, ...rows.map((r) => r.vals.reduce((a, b) => a + b, 0)));
    y = legend(ctx, y, ST.map((s) => [s.name, s.color]));
    const LW = 170, RW = 120, BW = W - PAD * 2 - LW - RW;
    rows.forEach((r) => {
      text(ctx, r.label, PAD, y + 18, { size: 16, w: 600, max: LW - 10 });
      rrect(ctx, PAD + LW, y + 6, BW, 24, 8, '#E8E8ED');
      let x = PAD + LW; ctx.save(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PAD + LW, y + 6, BW, 24, 8) : ctx.rect(PAD + LW, y + 6, BW, 24); ctx.clip();
      r.vals.forEach((v, i) => { const w = (v / max) * BW; if (w > 0) { ctx.fillStyle = ST[i].color; ctx.fillRect(x, y + 6, w, 24); if (w > 26) text(ctx, m.measure === 'budget' ? v.toFixed(0) : String(v), x + w / 2, y + 18, { size: 13, w: 600, color: light(ST[i].color) ? C.ink : '#fff', align: 'center' }); } x += w; });
      ctx.restore();
      const tot = r.vals.reduce((a, b) => a + b, 0);
      text(ctx, m.measure === 'budget' ? tot.toFixed(1) + ' ลบ.' : r.n + ' แผน', W - PAD, y + 18, { size: 15, color: C.muted, align: 'right' });
      y += 40;
    });
    return footer(ctx, y + 6);
  } },
  donut: { l: 'กราฟวงกลม', d: 'สัดส่วนสถานะทั้งหมด', draw(ctx, set, m) {
    let y = header(ctx, m, m.mode === 'proc' ? 'สัดส่วนสถานะจัดซื้อจัดจ้าง' : 'สัดส่วนสถานะแผน');
    const ST = seriesFor(m.mode), money_ = m.measure === 'budget';
    const vals = ST.map((s) => { const x = set.filter((p) => codeFor(p, m.mode) === s.code); return { s, n: x.length, v: money_ ? x.reduce((a, p) => a + p.budget, 0) / 1e6 : x.length }; }).filter((x) => x.n);
    const sum = vals.reduce((a, x) => a + x.v, 0) || 1, cx = PAD + 190, cy = y + 200, R = 170;
    let a0 = -Math.PI / 2;
    vals.forEach((x) => { const a1 = a0 + (x.v / sum) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fillStyle = x.s.color; ctx.fill(); a0 = a1; });
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.58, 0, Math.PI * 2); ctx.fillStyle = C.card; ctx.fill();
    text(ctx, money_ ? sum.toFixed(1) : String(set.length), cx, cy - 10, { size: 40, w: 500, head: true, align: 'center' });
    text(ctx, money_ ? 'ล้านบาท' : 'แผน', cx, cy + 28, { size: 16, color: C.muted, align: 'center' });
    let ly = y + Math.max(20, 200 - vals.length * 23); const lx = PAD + 420;
    vals.forEach((x) => {
      rrect(ctx, lx, ly, 18, 18, 4, x.s.color);
      text(ctx, x.s.name, lx + 30, ly + 9, { size: 18, max: 300 });
      text(ctx, (money_ ? x.v.toFixed(1) + ' ลบ.' : x.n + ' แผน') + '  ' + Math.round((x.v / sum) * 100) + '%', W - PAD, ly + 9, { size: 18, w: 600, align: 'right' });
      ly += 46;
    });
    y = Math.max(cy + R, ly) + 24;
    const t = tally(set, m.cols); y = progBar(ctx, y, `ความก้าวหน้า (${progLabel(m.mode, m.prog)})`, pct(t, m.prog), `${t[m.prog] || 0} จาก ${set.length} แผน`);
    return footer(ctx, y);
  } },
  heat: { l: 'ตารางสี (Heatmap)', d: 'หน่วยงาน × สำนัก เห็นจุดที่ช้า', draw(ctx, set, m) {
    let y = header(ctx, m, 'ความก้าวหน้าแยกหน่วยงาน × สำนัก');
    const us = unitsOf(set), os = offices().filter((o) => set.some((p) => p.office === o.short));
    const LW = 180, cw = (W - PAD * 2 - LW) / (os.length + 1), h = 54;
    text(ctx, `ค่าในช่อง = ${progLabel(m.mode, m.prog)} ÷ จำนวนแผน`, PAD, y + 8, { size: 14, color: C.muted }); y += 24;
    os.concat([{ short: 'รวม' }]).forEach((o, i) => {
      font(ctx, 15, 600); const x = PAD + LW + cw * i + cw / 2;
      if (ctx.measureText(o.short).width <= cw - 8 || !o.short.includes(' ')) text(ctx, o.short, x, y + 20, { size: 15, w: 600, align: 'center', max: cw - 8 });
      else { const k = o.short.indexOf(' '); text(ctx, o.short.slice(0, k), x, y + 10, { size: 14, w: 600, align: 'center', max: cw - 8 }); text(ctx, o.short.slice(k + 1), x, y + 29, { size: 13, align: 'center', max: cw - 8 }); }
    });
    y += 42;
    const cell = (x, l) => { const r = tally(l, m.cols), v = pct(r, m.prog); rrect(ctx, x + 3, y + 3, cw - 6, h - 6, 10, heatColor(v, r.n)); if (r.n) { text(ctx, Math.round(v) + '%', x + cw / 2, y + 20, { size: 17, w: 600, align: 'center', color: heatInk(v, r.n) }); text(ctx, `${r[m.prog]}/${r.n}`, x + cw / 2, y + 39, { size: 13, align: 'center', color: heatInk(v, r.n) }); } else text(ctx, '—', x + cw / 2, y + h / 2, { size: 15, align: 'center', color: C.faint }); };
    us.concat([{ name: '__all' }]).forEach((u) => {
      const all = u.name === '__all', l = all ? set : set.filter((p) => p.unit === u.name);
      text(ctx, all ? 'รวม' : uLabel(u.name), PAD, y + h / 2, { size: 16, w: 600, max: LW - 10 });
      os.forEach((o, i) => cell(PAD + LW + cw * i, l.filter((p) => p.office === o.short)));
      cell(PAD + LW + cw * os.length, l);
      y += h;
    });
    y = legend(ctx, y + 12, [[0, '0%'], [1, '1–24%'], [25, '25–49%'], [50, '50–74%'], [75, '75–99%'], [100, '100%']].map(([v, l]) => [l, heatColor(v, 1)]));
    return footer(ctx, y);
  } },
  brief: { l: 'สรุปย่อ (การ์ดเดียว)', d: 'ตัวเลขสำคัญ + % ต่อหน่วยงาน อ่านง่ายบนมือถือ', draw(ctx, set, m) {
    let y = header(ctx, m, m.mode === 'proc' ? 'สรุปสถานะจัดซื้อจัดจ้าง' : 'สรุปสถานะแผน'); const t = tally(set, m.cols);
    y = kpis(ctx, y, t, m);
    y = progBar(ctx, y, `ความก้าวหน้าทั้งเขต (${progLabel(m.mode, m.prog)})`, pct(t, m.prog), `${t[m.prog] || 0} จาก ${t.n} แผน • งบประมาณ ${money(t.budget)} บาท`) + 8;
    const rows = summaryBlock(set, m.cols).rows.filter((r) => r.n), cw = (W - PAD * 2 - 24) / 3, h = 112;
    rows.forEach((r, i) => {
      const x = PAD + (i % 3) * (cw + 12), yy = y + Math.floor(i / 3) * (h + 12), v = pct(r, m.prog);
      rrect(ctx, x, yy, cw, h, 16, C.soft);
      const cx = x + 52, cy = yy + h / 2;
      ctx.lineWidth = 10; ctx.strokeStyle = '#E8E8ED'; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = C.bar; ctx.beginPath(); ctx.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + (v / 100) * Math.PI * 2); ctx.stroke();
      text(ctx, Math.round(v) + '%', cx, cy, { size: 16, w: 600, align: 'center' });
      text(ctx, r.label, x + 100, yy + 34, { size: 17, w: 600, max: cw - 110 });
      text(ctx, `${r[m.prog]}/${r.n} แผน`, x + 100, yy + 60, { size: 14, color: C.muted });
      text(ctx, (r.fixN && m.mode !== 'proc' ? `แก้ไข ${r.fixN} • ` : '') + (r.late && m.mode !== 'proc' ? `เลยกำหนด ${r.late}` : `${mil(r.budget)} ลบ.`), x + 100, yy + 84, { size: 13, color: r.late && m.mode !== 'proc' ? '#C9291E' : C.faint, max: cw - 110 });
    });
    y += Math.ceil(rows.length / 3) * (h + 12) + 4;
    return footer(ctx, y);
  } }
};

async function render(kind, set, meta) {
  try { await Promise.all([`500 20px Mitr`, `400 16px "IBM Plex Sans Thai Looped"`, `600 16px "IBM Plex Sans Thai Looped"`].map((f) => document.fonts.load(f, 'ทดสอบ'))); } catch (e) { /* ใช้ฟอนต์ระบบ */ }
  const probe = document.createElement('canvas').getContext('2d');
  const H = Math.ceil(KINDS[kind].draw(probe, set, meta));
  const S = 2, cv = document.createElement('canvas');
  cv.width = W * S; cv.height = H * S;
  const ctx = cv.getContext('2d'); ctx.scale(S, S);
  ctx.fillStyle = '#F5F5F7'; ctx.fillRect(0, 0, W, H);
  KINDS[kind].draw(ctx, set, meta);
  return cv;
}

/** หน้าต่าง "ส่งออกเป็นภาพ": เลือกแบบ → ดูตัวอย่าง → บันทึก / แชร์ / คัดลอก */
export function imageDialog(set, meta) {
  const st = { kind: meta.kind && KINDS[meta.kind] ? meta.kind : 'office', mode: MODES[meta.mode] ? meta.mode : 'plan', prog: meta.prog, measure: meta.measure || 'count' };
  let cv = null, gen = 0;   // gen: กันภาพเก่าที่วาดเสร็จทีหลังมาทับภาพล่าสุด
  const fname = () => `สถานะแผน_ปีงบ${meta.year}_${KINDS[st.kind].l.replace(/[^฀-๿A-Za-z0-9]+/g, '')}.png`;
  const blobOf = () => new Promise((r) => cv.toBlob(r, 'image/png'));
  const draw = async (dlg) => {
    st.prog = opt(st).prog;
    dlg.innerHTML = `${modalHead('ส่งออกสถานะเป็นภาพ', `ปีงบ ${meta.year}${meta.filter ? ' • ' + meta.filter : ''} • ${set.length} แผน — ใช้ส่งรายงานทาง LINE ได้ทันที`)}
      <div class="rep-kinds">${Object.entries(KINDS).map(([k, v]) => `<button class="rep-kind ${k === st.kind ? 'on' : ''}" data-k="${k}"><b>${v.l}</b><span>${v.d}</span></button>`).join('')}</div>
      <div class="row wrap small">
        <div class="seg-ctl" id="ri-mode">${Object.entries(MODES).map(([k, l]) => `<button data-v="${k}" class="${st.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <label class="row muted">ความก้าวหน้านับจาก <select class="inp" id="ri-prog" style="height:36px;width:auto">${progOptions(st.mode).map((c) => `<option value="${c.k}" ${c.k === st.prog ? 'selected' : ''}>${esc(c.l)}</option>`).join('')}</select></label>
        ${['bars', 'donut'].includes(st.kind) ? `<div class="seg-ctl" id="ri-meas">${[['count', 'จำนวนแผน'], ['budget', 'งบประมาณ']].map((t) => `<button data-v="${t[0]}" class="${st.measure === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>` : ''}
      </div>
      <div class="rep-prev" id="ri-prev"><span class="faint">กำลังสร้างภาพ…</span></div>
      <div class="dlg-foot"><button class="btn" data-dismiss>ปิด</button><button class="btn" id="ri-copy">${icon('file', 16)}คัดลอกภาพ</button><button class="btn" id="ri-save">${icon('download', 16)}บันทึกภาพ</button><button class="btn pri" id="ri-share">${icon('share', 16)}แชร์</button></div>`;
    dlg.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { st.kind = b.dataset.k; draw(dlg); }));
    dlg.querySelector('#ri-prog').onchange = (e) => { st.prog = e.target.value; draw(dlg); };
    dlg.querySelectorAll('#ri-mode button').forEach((b) => (b.onclick = () => { st.mode = b.dataset.v; st.prog = defaultProg(st.mode); draw(dlg); }));
    dlg.querySelectorAll('#ri-meas button').forEach((b) => (b.onclick = () => { st.measure = b.dataset.v; draw(dlg); }));
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }));
    if (!canShare) dlg.querySelector('#ri-share').style.display = 'none';
    if (!(navigator.clipboard && window.ClipboardItem)) dlg.querySelector('#ri-copy').style.display = 'none';
    dlg.querySelector('#ri-save').onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await blobOf()); a.download = fname(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('บันทึกภาพแล้ว'); };
    dlg.querySelector('#ri-share').onclick = async () => { try { await navigator.share({ files: [new File([await blobOf()], fname(), { type: 'image/png' })], title: 'สถานะแผน ปีงบ ' + meta.year }); } catch (e) { if (e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ — ใช้ "บันทึกภาพ" แทน', 'err'); } };
    dlg.querySelector('#ri-copy').onclick = async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobOf() })]); toast('คัดลอกภาพแล้ว — วางในแชตได้เลย'); } catch (e) { toast('คัดลอกไม่ได้ — ใช้ "บันทึกภาพ" แทน', 'err'); } };
    const o = opt(st), my = ++gen; st.prog = o.prog;
    const c = await render(st.kind, set, { ...meta, ...o, measure: st.measure });
    if (my !== gen) return;
    cv = c;
    const prev = dlg.querySelector('#ri-prev'); if (!prev) return;
    prev.innerHTML = ''; const img = new Image(); img.src = cv.toDataURL('image/png'); img.alt = KINDS[st.kind].l; prev.appendChild(img);
  };
  modal('', { wide: true, onMount: draw });
}
export const REPORT_KINDS = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.l]));
