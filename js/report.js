// ===== รายงานสถานะแผน: ตาราง (หน้าเว็บ) + วาดเป็นภาพ PNG (canvas) เพื่อส่งรายงานทาง LINE/มือถือ =====
import { units, offices, statuses, setting } from './store.js';
import { esc, mil, money, thDate, truthy } from './util.js';
import { modal, modalHead, toast, icon } from './ui.js';

/* ---------- ข้อมูล ---------- */
const GROUPS = ['ยังไม่ส่ง', 'แขวงส่งแล้ว', 'ส่งกรมแล้ว', 'กรมเห็นชอบ'];
const gi = (p) => Math.max(0, GROUPS.indexOf(p.st.dash_group));
/** คอลัมน์สะสม (นับแผนที่ไปถึงขั้นนั้นแล้ว) + กำลังแก้ไข (ตอนนี้) */
export const COLS = [
  { k: 'n', l: 'จำนวนแผน', s: 'แผน', f: () => true },
  { k: 'sent', l: 'ส่งแผนแล้ว', s: 'ส่ง', f: (p) => gi(p) >= 1 },
  { k: 'fix', l: 'ระหว่างแก้ไข', s: 'แก้ไข', f: (p) => truthy(p.st.need_reason) },
  { k: 'dept', l: 'ส่งกรมแล้ว', s: 'ส่งกรม', f: (p) => gi(p) >= 2 },
  { k: 'ok', l: 'กรมเห็นชอบ', s: 'เห็นชอบ', f: (p) => gi(p) >= 3 }
];
export const PROG = { sent: 'ส่งแผนแล้ว', dept: 'ส่งกรมแล้ว', ok: 'กรมเห็นชอบ' };
const PROG_S = { sent: '% ส่งแผน', dept: '% ส่งกรม', ok: '% เห็นชอบ' };
export const ORG = () => setting('org_name', 'สทล.2 (แพร่)');
/** ชื่อหน่วยงานแบบสั้น: "แขวงทางหลวงน่านที่ 1" → "น่านที่ 1" */
export const uLabel = (n) => String(n || '').replace(/^แขวงทางหลวง(ชนบท)?\s*/, '') || String(n || '');

export function tally(list) {
  const r = { budget: list.reduce((a, p) => a + p.budget, 0), late: list.filter((p) => p.late).length };
  COLS.forEach((c) => (r[c.k] = list.filter(c.f).length));
  return r;
}
const pct = (r, prog) => (r.n ? (r[prog] / r.n) * 100 : 0);
const unitsOf = (set) => units().filter((u) => set.some((p) => p.unit === u.name) || u.kind !== 'เขต');
/** บล็อกต่อสำนัก + บล็อกรวม (เหมือนรายงานตัวอย่างของเขตอื่น) */
export function officeBlocks(set) {
  const us = unitsOf(set);
  const block = (title, l) => ({ title, rows: us.map((u) => ({ label: uLabel(u.name), key: u.name, ...tally(l.filter((p) => p.unit === u.name)) })), total: tally(l) });
  const out = offices().filter((o) => set.some((p) => p.office === o.short)).map((o) => block(o.full && o.full !== o.short ? `${o.full} (${o.short})` : o.short, set.filter((p) => p.office === o.short)));
  if (out.length > 1) out.push(block('รวมทุกสำนัก', set));
  return out;
}
export const summaryBlock = (set) => ({ title: 'รวมทุกสำนัก', rows: unitsOf(set).map((u) => ({ label: uLabel(u.name), key: u.name, ...tally(set.filter((p) => p.unit === u.name)) })), total: tally(set) });

const heatColor = (v, n) => (!n ? '#F1ECE1' : v >= 100 ? '#46703F' : v >= 75 ? '#7FA36F' : v >= 50 ? '#B7CC9C' : v >= 25 ? '#EAD9A6' : v > 0 ? '#F2C9A8' : '#EFD7CF');
/** สีอ่อน → ใช้ตัวอักษรเข้ม */
const light = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 170; };
const heatInk = (v, n) => (n && v >= 75 ? '#fff' : '#2B2A22');

/* ---------- HTML (หน้าเว็บ) ---------- */
const hd = (l, s) => `<span class="hl">${l}</span><span class="hs">${s}</span>`;
const nz = (v) => (v ? Number(v).toLocaleString() : '-');
function tableHTML(b, prog) {
  const p = pct(b.total, prog);
  return `<div class="rep-blk"><div class="rep-ttl">${esc(b.title)}</div>
    <div class="scroll-x"><table class="tbl rep-tbl"><thead><tr><th>${hd('หน่วยงาน', '')}</th>${COLS.map((c) => `<th class="r">${hd(c.l, c.s)}</th>`).join('')}<th class="r bud">งบ (ลบ.)</th><th class="r">${hd(PROG_S[prog], '%')}</th></tr></thead><tbody>
    ${b.rows.map((r) => `<tr data-cat="${esc(r.key)}"><td><b>${esc(r.label)}</b></td>${COLS.map((c) => `<td class="r">${nz(r[c.k])}</td>`).join('')}<td class="r bud">${r.budget ? mil(r.budget) : '-'}</td><td class="r">${r.n ? Math.round(pct(r, prog)) + '%' : '-'}</td></tr>`).join('')}
    <tr class="rep-tot"><td><b>รวม</b></td>${COLS.map((c) => `<td class="r"><b>${nz(b.total[c.k])}</b></td>`).join('')}<td class="r bud"><b>${mil(b.total.budget)}</b></td><td class="r"><b>${Math.round(p)}%</b></td></tr></tbody></table></div>
    <div class="rep-prog"><span class="small">ความก้าวหน้า (${esc(PROG[prog])}) ${b.total[prog]} จาก ${b.total.n} แผน</span><b class="small">${p.toFixed(2)}%</b><div class="track"><span style="width:${p}%"></span></div></div></div>`;
}
export const officeHTML = (set, prog) => (set.length ? officeBlocks(set).map((b) => tableHTML(b, prog)).join('') : '<div class="empty">ไม่มีแผนตามตัวกรองนี้</div>');
export const summaryHTML = (set, prog) => (set.length ? tableHTML(summaryBlock(set), prog) : '<div class="empty">ไม่มีแผนตามตัวกรองนี้</div>');
export function heatHTML(set, prog) {
  if (!set.length) return '<div class="empty">ไม่มีแผนตามตัวกรองนี้</div>';
  const us = unitsOf(set), os = offices().filter((o) => set.some((p) => p.office === o.short));
  const cell = (l) => { const r = tally(l), v = pct(r, prog); return `<td class="heat" style="background:${heatColor(v, r.n)};color:${heatInk(v, r.n)}" data-tip="${esc(r.n ? `${r[prog]}/${r.n} แผน • ${mil(r.budget)} ลบ.` : 'ไม่มีแผน')}">${r.n ? `<b>${Math.round(v)}%</b><span>${r[prog]}/${r.n}</span>` : '—'}</td>`; };
  return `<div class="scroll-x"><table class="tbl heat-tbl"><thead><tr><th>หน่วยงาน</th>${os.map((o) => `<th>${esc(o.short)}</th>`).join('')}<th>รวม</th></tr></thead><tbody>
    ${us.map((u) => `<tr data-cat="${esc(u.name)}"><td><b>${esc(uLabel(u.name))}</b></td>${os.map((o) => cell(set.filter((p) => p.unit === u.name && p.office === o.short))).join('')}${cell(set.filter((p) => p.unit === u.name))}</tr>`).join('')}
    <tr class="rep-tot"><td><b>รวม</b></td>${os.map((o) => cell(set.filter((p) => p.office === o.short))).join('')}${cell(set)}</tr></tbody></table></div>
    <div class="legend" style="margin-top:8px">${[[0, '0%'], [1, '1–24%'], [25, '25–49%'], [50, '50–74%'], [75, '75–99%'], [100, '100%']].map(([v, l]) => `<span><i style="background:${heatColor(v, 1)}"></i>${l}</span>`).join('')}<span class="faint">= ${esc(PROG[prog])} ÷ จำนวนแผน</span></div>`;
}
/** แผนที่ยังไม่ส่ง / เลยกำหนด / ระหว่างแก้ไข ต่อหน่วยงาน */
export function pendingHTML(set) {
  const l = set.filter((p) => gi(p) === 0 || truthy(p.st.need_reason)).sort((a, b) => (b.late - a.late) || a.unit.localeCompare(b.unit) || b.budget - a.budget);
  if (!l.length) return '<div class="empty">ไม่มีแผนค้าง — ส่งครบแล้ว 🎉</div>';
  return `<table class="tbl pend-tbl"><thead><tr><th>หน่วยงาน</th><th>งาน</th><th class="r">ลบ.</th><th>สถานะ</th></tr></thead><tbody>
    ${l.map((p) => `<tr><td><b class="small">${esc(uLabel(p.unit))}</b><br><span class="faint">${esc(p.office)}</span></td><td class="small"><a href="#/plan/${esc(p.plan_id)}" class="num">${esc(p.id_code || p.work_code || p.plan_id)}</a> ${esc(p.work_name)}</td><td class="r num small">${mil(p.budget)}</td><td class="small">${p.late ? '<span class="tag red">เลยกำหนด</span><br>' : ''}${esc(p.khet.label)}</td></tr>`).join('')}</tbody></table>
    <span class="faint">${l.length} แผนที่ยังไม่ส่งหรือกำลังแก้ไข • เรียงเลยกำหนดก่อน</span>`;
}

/* ---------- ภาพรายงาน (canvas) ---------- */
const W = 1000, PAD = 28, C = { ink: '#2B2A22', muted: '#6E6857', faint: '#A39C88', line: '#E3DCCB', soft: '#FAF7F1', card: '#FFFEFB', green: '#33502F', bar: '#46703F', gold: '#F6EBCD', head: '#EFE9DC' };
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
  rrect(ctx, 0, 0, W, 92, 0, C.green);
  text(ctx, title, PAD, 34, { size: 26, w: 500, head: true, color: '#fff' });
  text(ctx, `${ORG()} • ปีงบประมาณ ${meta.year}${meta.filter ? ' • ' + meta.filter : ''}`, PAD, 68, { size: 16, color: '#DCE5D3' });
  text(ctx, `ณ วันที่ ${thDate(new Date())}`, W - PAD, 34, { size: 16, color: '#DCE5D3', align: 'right' });
  text(ctx, 'Planable2', W - PAD, 68, { size: 14, color: '#AFC0A4', align: 'right' });
  return 112;
}
function kpis(ctx, y, t) {
  const items = [['แผนทั้งหมด', t.n, mil(t.budget) + ' ลบ.'], ['ส่งแผนแล้ว', t.sent, Math.round(pct(t, 'sent')) + '%'], ['ระหว่างแก้ไข', t.fix, 'แผน'], ['ส่งกรมแล้ว', t.dept, Math.round(pct(t, 'dept')) + '%'], ['กรมเห็นชอบ', t.ok, Math.round(pct(t, 'ok')) + '%']];
  const gap = 12, w = (W - PAD * 2 - gap * 4) / 5;
  items.forEach(([l, v, s], i) => {
    const x = PAD + i * (w + gap);
    rrect(ctx, x, y, w, 96, 16, i === 0 ? C.soft : ['', '#E9EFF5', '#FBF1DD', '#E5F0EC', '#E7EEDF'][i]);
    text(ctx, l, x + 14, y + 22, { size: 14, color: C.muted });
    text(ctx, Number(v).toLocaleString(), x + 14, y + 54, { size: 30, w: 500, head: true });
    text(ctx, s, x + 14, y + 80, { size: 13, color: C.muted });
  });
  return y + 96 + 20;
}
function progBar(ctx, y, label, p, sub) {
  text(ctx, label, PAD, y + 10, { size: 14, color: C.muted });
  text(ctx, p.toFixed(2) + '%', W - PAD, y + 10, { size: 15, w: 600, color: C.green, align: 'right' });
  rrect(ctx, PAD, y + 22, W - PAD * 2, 10, 5, '#ECE6D9');
  if (p > 0) rrect(ctx, PAD, y + 22, Math.max(10, (W - PAD * 2) * Math.min(1, p / 100)), 10, 5, C.bar);
  if (sub) text(ctx, sub, PAD, y + 46, { size: 13, color: C.faint });
  return y + (sub ? 62 : 44);
}
function tableBlock(ctx, y, b, prog) {
  const cols = [{ l: 'หน่วยงาน', w: 170, a: 'left' }].concat(COLS.map((c) => ({ l: c.l, w: 105 })), [{ l: 'งบ (ลบ.)', w: 110 }, { l: PROG_S[prog], w: 0 }]);
  const fixedW = cols.reduce((a, c) => a + c.w, 0); cols[cols.length - 1].w = W - PAD * 2 - fixedW;
  rrect(ctx, PAD, y, W - PAD * 2, 40, 10, C.green);
  text(ctx, b.title, PAD + 14, y + 20, { size: 18, w: 500, head: true, color: '#fff', max: W - PAD * 2 - 28 });
  y += 40;
  const row = (cells, bg, bold, h = 34, size = 15) => {
    ctx.fillStyle = bg; ctx.fillRect(PAD, y, W - PAD * 2, h);
    let x = PAD;
    cells.forEach((v, i) => { const c = cols[i]; text(ctx, v, c.a === 'left' ? x + 12 : x + c.w - 12, y + h / 2, { size, w: bold || i === 0 ? 600 : 400, align: c.a === 'left' ? 'left' : 'right', max: c.w - 16 }); x += c.w; });
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD, y + h - 0.5); ctx.lineTo(W - PAD, y + h - 0.5); ctx.stroke();
    y += h;
  };
  row(cols.map((c) => c.l), C.head, true, 36, 13.5);
  const cellsOf = (r, label) => [label].concat(COLS.map((c) => (r[c.k] ? Number(r[c.k]).toLocaleString() : '-')), [r.budget ? mil(r.budget) : '-', r.n ? Math.round(pct(r, prog)) + '%' : '-']);
  b.rows.forEach((r, i) => row(cellsOf(r, r.label), i % 2 ? C.soft : C.card));
  row(cellsOf(b.total, 'รวม'), C.gold, true);
  return progBar(ctx, y + 8, `ความก้าวหน้า (${PROG[prog]})`, pct(b.total, prog), `${PROG[prog]} ${b.total[prog]} จาก ${b.total.n} แผน • งบประมาณ ${money(b.total.budget)} บาท`) + 14;
}
function footer(ctx, y) {
  text(ctx, 'ข้อมูลจากทะเบียนแผน Planable2 • ' + new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }), W / 2, y + 16, { size: 13, color: C.faint, align: 'center' });
  return y + 40;
}

function statusRows(set, measure) {
  const ST = statuses(), money_ = measure === 'budget';
  return { ST, rows: unitsOf(set).map((u) => { const l = set.filter((p) => p.unit === u.name); return { label: uLabel(u.name), n: l.length, vals: ST.map((s) => { const x = l.filter((p) => p.status === s.status_code); return money_ ? x.reduce((a, p) => a + p.budget, 0) / 1e6 : x.length; }) }; }).filter((r) => r.n) };
}
function legend(ctx, y, items) {
  let x = PAD;
  items.forEach(([l, c]) => { font(ctx, 14); const w = ctx.measureText(l).width + 34; if (x + w > W - PAD) { x = PAD; y += 26; } rrect(ctx, x, y + 4, 14, 14, 3, c); text(ctx, l, x + 20, y + 11, { size: 14, color: C.muted }); x += w; });
  return y + 34;
}

/** แต่ละแบบคืนค่า y สุดท้าย (วาด 2 รอบ: วัดความสูง แล้ววาดจริง) */
const KINDS = {
  office: { l: 'ตารางแยกสำนัก', d: 'เหมือนรายงานของเขตอื่น • ทุกสำนัก + รวม', draw(ctx, set, m) { let y = header(ctx, m, 'ระบบติดตามสถานะแผน'); officeBlocks(set).forEach((b) => (y = tableBlock(ctx, y, b, m.prog))); return footer(ctx, y); } },
  summary: { l: 'สรุปรวม + ตาราง', d: 'ตัวเลขสรุป + ตารางรวมทุกหน่วยงาน', draw(ctx, set, m) { let y = header(ctx, m, 'สรุปสถานะแผนงาน'); y = kpis(ctx, y, tally(set)); y = tableBlock(ctx, y, summaryBlock(set), m.prog); return footer(ctx, y); } },
  bars: { l: 'กราฟแท่งสถานะ', d: 'สถานะปัจจุบันแยกหน่วยงาน', draw(ctx, set, m) {
    let y = header(ctx, m, 'สถานะแผนแยกหน่วยงาน'); y = kpis(ctx, y, tally(set));
    const { ST, rows } = statusRows(set, m.measure), max = Math.max(1, ...rows.map((r) => r.vals.reduce((a, b) => a + b, 0)));
    y = legend(ctx, y, ST.map((s) => [s.name, s.color]));
    const LW = 170, RW = 120, BW = W - PAD * 2 - LW - RW;
    rows.forEach((r) => {
      text(ctx, r.label, PAD, y + 18, { size: 16, w: 600, max: LW - 10 });
      rrect(ctx, PAD + LW, y + 6, BW, 24, 8, '#F1ECE1');
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
    let y = header(ctx, m, 'สัดส่วนสถานะแผน');
    const ST = statuses(), money_ = m.measure === 'budget';
    const vals = ST.map((s) => { const x = set.filter((p) => p.status === s.status_code); return { s, n: x.length, v: money_ ? x.reduce((a, p) => a + p.budget, 0) / 1e6 : x.length }; }).filter((x) => x.n);
    const sum = vals.reduce((a, x) => a + x.v, 0) || 1, cx = PAD + 190, cy = y + 200, R = 170;
    let a0 = -Math.PI / 2;
    vals.forEach((x) => { const a1 = a0 + (x.v / sum) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fillStyle = x.s.color; ctx.fill(); a0 = a1; });
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.58, 0, Math.PI * 2); ctx.fillStyle = C.card; ctx.fill();
    text(ctx, money_ ? sum.toFixed(1) : String(set.length), cx, cy - 10, { size: 40, w: 500, head: true, align: 'center' });
    text(ctx, money_ ? 'ล้านบาท' : 'แผน', cx, cy + 28, { size: 16, color: C.muted, align: 'center' });
    let ly = y + 60; const lx = PAD + 420;
    vals.forEach((x) => {
      rrect(ctx, lx, ly, 18, 18, 4, x.s.color);
      text(ctx, x.s.name, lx + 30, ly + 9, { size: 18 });
      text(ctx, (money_ ? x.v.toFixed(1) + ' ลบ.' : x.n + ' แผน') + '  ' + Math.round((x.v / sum) * 100) + '%', W - PAD, ly + 9, { size: 18, w: 600, align: 'right' });
      ly += 46;
    });
    y = Math.max(cy + R, ly) + 24;
    y = progBar(ctx, y, `ความก้าวหน้า (${PROG[m.prog]})`, pct(tally(set), m.prog), `${tally(set)[m.prog]} จาก ${set.length} แผน`);
    return footer(ctx, y);
  } },
  heat: { l: 'ตารางสี (Heatmap)', d: 'หน่วยงาน × สำนัก เห็นจุดที่ช้า', draw(ctx, set, m) {
    let y = header(ctx, m, 'ความก้าวหน้าแยกหน่วยงาน × สำนัก');
    const us = unitsOf(set), os = offices().filter((o) => set.some((p) => p.office === o.short));
    const LW = 180, cw = (W - PAD * 2 - LW) / (os.length + 1), h = 54;
    text(ctx, `ค่าในช่อง = ${PROG[m.prog]} ÷ จำนวนแผน`, PAD, y + 8, { size: 14, color: C.muted }); y += 24;
    os.concat([{ short: 'รวม' }]).forEach((o, i) => {
      font(ctx, 15, 600); const x = PAD + LW + cw * i + cw / 2;
      if (ctx.measureText(o.short).width <= cw - 8 || !o.short.includes(' ')) text(ctx, o.short, x, y + 20, { size: 15, w: 600, align: 'center', max: cw - 8 });
      else { const k = o.short.indexOf(' '); text(ctx, o.short.slice(0, k), x, y + 10, { size: 14, w: 600, align: 'center', max: cw - 8 }); text(ctx, o.short.slice(k + 1), x, y + 29, { size: 13, align: 'center', max: cw - 8 }); }
    });
    y += 42;
    const cell = (x, l) => { const r = tally(l), v = pct(r, m.prog); rrect(ctx, x + 3, y + 3, cw - 6, h - 6, 10, heatColor(v, r.n)); if (r.n) { text(ctx, Math.round(v) + '%', x + cw / 2, y + 20, { size: 17, w: 600, align: 'center', color: heatInk(v, r.n) }); text(ctx, `${r[m.prog]}/${r.n}`, x + cw / 2, y + 39, { size: 13, align: 'center', color: heatInk(v, r.n) }); } else text(ctx, '—', x + cw / 2, y + h / 2, { size: 15, align: 'center', color: C.faint }); };
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
    let y = header(ctx, m, 'สรุปสถานะแผน'); const t = tally(set);
    y = kpis(ctx, y, t);
    y = progBar(ctx, y, `ความก้าวหน้าทั้งเขต (${PROG[m.prog]})`, pct(t, m.prog), `${t[m.prog]} จาก ${t.n} แผน • งบประมาณ ${money(t.budget)} บาท`) + 8;
    const rows = summaryBlock(set).rows.filter((r) => r.n), cw = (W - PAD * 2 - 24) / 3, h = 112;
    rows.forEach((r, i) => {
      const x = PAD + (i % 3) * (cw + 12), yy = y + Math.floor(i / 3) * (h + 12), v = pct(r, m.prog);
      rrect(ctx, x, yy, cw, h, 16, C.soft);
      const cx = x + 52, cy = yy + h / 2;
      ctx.lineWidth = 10; ctx.strokeStyle = '#ECE6D9'; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = C.bar; ctx.beginPath(); ctx.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + (v / 100) * Math.PI * 2); ctx.stroke();
      text(ctx, Math.round(v) + '%', cx, cy, { size: 16, w: 600, align: 'center' });
      text(ctx, r.label, x + 100, yy + 34, { size: 17, w: 600, max: cw - 110 });
      text(ctx, `${r[m.prog]}/${r.n} แผน`, x + 100, yy + 60, { size: 14, color: C.muted });
      text(ctx, (r.fix ? `แก้ไข ${r.fix} • ` : '') + (r.late ? `เลยกำหนด ${r.late}` : `${mil(r.budget)} ลบ.`), x + 100, yy + 84, { size: 13, color: r.late ? '#B4532A' : C.faint, max: cw - 110 });
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
  ctx.fillStyle = '#F6F3EC'; ctx.fillRect(0, 0, W, H);
  KINDS[kind].draw(ctx, set, meta);
  return cv;
}

/** หน้าต่าง "ส่งออกเป็นภาพ": เลือกแบบ → ดูตัวอย่าง → บันทึก / แชร์ / คัดลอก */
export function imageDialog(set, meta) {
  const st = { kind: meta.kind && KINDS[meta.kind] ? meta.kind : 'office', prog: meta.prog || 'dept', measure: meta.measure || 'count' };
  let cv = null;
  const fname = () => `สถานะแผน_ปีงบ${meta.year}_${KINDS[st.kind].l.replace(/[^฀-๿A-Za-z0-9]+/g, '')}.png`;
  const blobOf = () => new Promise((r) => cv.toBlob(r, 'image/png'));
  const draw = async (dlg) => {
    dlg.innerHTML = `${modalHead('ส่งออกสถานะเป็นภาพ', `ปีงบ ${meta.year}${meta.filter ? ' • ' + meta.filter : ''} • ${set.length} แผน — ใช้ส่งรายงานทาง LINE ได้ทันที`)}
      <div class="rep-kinds">${Object.entries(KINDS).map(([k, v]) => `<button class="rep-kind ${k === st.kind ? 'on' : ''}" data-k="${k}"><b>${v.l}</b><span>${v.d}</span></button>`).join('')}</div>
      <div class="row wrap small">
        <label class="row muted">ความก้าวหน้านับจาก <select class="inp" id="ri-prog" style="height:36px;width:auto">${Object.entries(PROG).map(([k, l]) => `<option value="${k}" ${k === st.prog ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${['bars', 'donut'].includes(st.kind) ? `<div class="seg-ctl" id="ri-meas">${[['count', 'จำนวนแผน'], ['budget', 'งบประมาณ']].map((t) => `<button data-v="${t[0]}" class="${st.measure === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>` : ''}
      </div>
      <div class="rep-prev" id="ri-prev"><span class="faint">กำลังสร้างภาพ…</span></div>
      <div class="dlg-foot"><button class="btn" data-dismiss>ปิด</button><button class="btn" id="ri-copy">${icon('file', 16)}คัดลอกภาพ</button><button class="btn" id="ri-save">${icon('download', 16)}บันทึกภาพ</button><button class="btn pri" id="ri-share">${icon('share', 16)}แชร์</button></div>`;
    dlg.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { st.kind = b.dataset.k; draw(dlg); }));
    dlg.querySelector('#ri-prog').onchange = (e) => { st.prog = e.target.value; draw(dlg); };
    dlg.querySelectorAll('#ri-meas button').forEach((b) => (b.onclick = () => { st.measure = b.dataset.v; draw(dlg); }));
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }));
    if (!canShare) dlg.querySelector('#ri-share').style.display = 'none';
    if (!(navigator.clipboard && window.ClipboardItem)) dlg.querySelector('#ri-copy').style.display = 'none';
    dlg.querySelector('#ri-save').onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await blobOf()); a.download = fname(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('บันทึกภาพแล้ว'); };
    dlg.querySelector('#ri-share').onclick = async () => { try { await navigator.share({ files: [new File([await blobOf()], fname(), { type: 'image/png' })], title: 'สถานะแผน ปีงบ ' + meta.year }); } catch (e) { if (e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ — ใช้ "บันทึกภาพ" แทน', 'err'); } };
    dlg.querySelector('#ri-copy').onclick = async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobOf() })]); toast('คัดลอกภาพแล้ว — วางในแชตได้เลย'); } catch (e) { toast('คัดลอกไม่ได้ — ใช้ "บันทึกภาพ" แทน', 'err'); } };
    cv = await render(st.kind, set, { ...meta, prog: st.prog, measure: st.measure });
    const prev = dlg.querySelector('#ri-prev'); if (!prev) return;
    prev.innerHTML = ''; const img = new Image(); img.src = cv.toDataURL('image/png'); img.alt = KINDS[st.kind].l; prev.appendChild(img);
  };
  modal('', { wide: true, onMount: draw });
}
export const REPORT_KINDS = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.l]));
