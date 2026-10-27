// ===== ตรวจแผน: คำนวณ Factor F • ค่าดำเนินการและค่าเสื่อมราคา • ค่าขนส่ง (ตารางกรมบัญชีกลาง โหลดเมื่อเปิดหน้า) =====
import { S } from '../store.js';
import { esc, $, $$, on, num, thDate, uniq, loadXLSX } from '../util.js';
import { toast, icon, empty } from '../ui.js';
import { materialCatalog } from './prices.js';

const SUBS = [['factor', 'คำนวณ Factor F'], ['op', 'ค่าดำเนินการและค่าเสื่อมราคา'], ['transport', 'ค่าขนส่ง']];
const ui = S.ui.check || (S.ui.check = {
  sub: 'factor',
  ff: { adv: 15, ret: 0, vat: 7, rain: 0, road: '', bridge: '', building: '', extra: '', cmp: {} },
  op: { price: '', show: 'all', q: '' },
  tr: { price: '', dist: '', truck: 't6', open: false }
});
if (!ui.tr) ui.tr = { price: '', dist: '', truck: 't6', open: false };
const tabs = (cur) => `<div class="seg-ctl" role="tablist" style="align-self:flex-start">${SUBS.map(([k, l]) => `<a href="#/check/${k}" role="tab" aria-selected="${k === cur}" class="${k === cur ? 'on' : ''}">${l}</a>`).join('')}</div>`;
const f4 = (v) => (v === null || v === undefined || isNaN(v) ? '—' : Number(v).toFixed(4));
const f2 = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ทศนิยม 4 ตำแหน่ง แบบตัดทิ้ง (ตามแบบคำนวณราคากลาง) */
const trunc4 = (x) => Math.floor(x * 1e4 + 1e-7) / 1e4;
const amount = (v) => { const n = num(v); return isNaN(n) || n < 0 ? 0 : n; };

export function view(main, arg, app) {
  if (SUBS.some((s) => s[0] === arg)) ui.sub = arg;
  main.innerHTML = `${tabs(ui.sub)}<div class="loading" style="min-height:30vh"><span class="spin"></span>กำลังโหลดตาราง…</div>`;
  const draw = ui.sub === 'op' ? opView : ui.sub === 'transport' ? transportView : factorView;
  draw(main).catch((e) => { console.error(e); main.innerHTML = tabs(ui.sub) + empty('โหลดตารางไม่ได้: ' + e.message); });
}

/* ---------- Factor F ---------- */
const KINDS = [['road', 'งานก่อสร้างทาง'], ['bridge', 'งานก่อสร้างสะพานและท่อเหลี่ยม'], ['building', 'งานก่อสร้างอาคาร']];

/** หาค่า Factor F จากตาราง: ค่างานอยู่ระหว่างช่วง → เทียบอัตราส่วน (หมายเหตุ 1 ท้ายตาราง) */
function lookup(T, key, col, costM) {
  const rows = T.t[key], st = T.steps, L = T.labels, n = st.length;
  const at = (i) => ({ i, step: st[i], label: L[i], f: rows[i][col] });
  const gt = /^>/.test(L[n - 1]);   // อาคาร: "> 500" = เกิน 500 ล้าน ใช้ค่าคงที่
  if (costM <= st[0]) return { f: rows[0][col], lo: at(0) };
  if (gt ? costM > st[n - 1] : costM >= st[n - 1]) return { f: rows[n - 1][col], lo: at(n - 1) };
  const last = gt ? n - 2 : n - 1;
  for (let i = 0; i < last; i++) {
    if (costM === st[i]) return { f: rows[i][col], lo: at(i) };
    if (costM > st[i] && costM < st[i + 1]) {
      const a = rows[i][col], b = rows[i + 1][col];
      return { f: trunc4(a - ((a - b) * (costM - st[i])) / (st[i + 1] - st[i])), lo: at(i), hi: at(i + 1) };
    }
  }
  return { f: rows[last][col], lo: at(last) };
}

async function factorView(main) {
  const { FF, FF_SOURCE } = await import('../data/factorf.js');
  const s = ui.ff, key = s.adv + '-' + s.ret;
  const colOf = (k) => (s.vat === 0 ? 0 : k === 'road' ? 1 + s.rain : 1);
  const cost = { road: amount(s.road), bridge: amount(s.bridge), building: amount(s.building) }, extra = amount(s.extra);
  const R = {};
  KINDS.forEach(([k]) => (R[k] = cost[k] > 0 ? lookup(FF[k], key, colOf(k), cost[k] / 1e6) : null));
  const base = KINDS.reduce((a, [k]) => a + (R[k] ? cost[k] * R[k].f : 0), 0);
  const f6 = base > 0 ? trunc4(1 + extra / base) : (extra > 0 ? null : 1);
  const Fn = {}; KINDS.forEach(([k]) => (Fn[k] = R[k] && f6 !== null ? trunc4(R[k].f * f6) : null));
  const total = KINDS.reduce((a, [k]) => a + (Fn[k] ? cost[k] * Fn[k] : 0), 0);
  const colName = (k) => FF[k].cols[colOf(k)];
  const sel = (id, opts, v) => `<select class="inp" id="${id}">${opts.map(([x, l]) => `<option value="${x}" ${String(x) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const moneyInp = (k, label, no) => `<label class="f"><span><b class="ffno">${no}</b> ${esc(label)}</span><input class="inp num" data-c="${k}" value="${esc(s[k])}" inputmode="decimal" placeholder="0.00"></label>`;
  // ตรวจค่าของแขวง: กรอกค่าที่แขวงใช้ → เทียบกับค่าที่คำนวณได้
  const cmp = (id, v) => {
    const got = s.cmp[id], has = got !== undefined && got !== '' && !isNaN(Number(got));
    const okv = has && v !== null && Math.abs(Number(got) - v) < 0.00005;
    return `<td class="r"><input class="inp num ffcmp" data-cmp="${id}" value="${esc(got ?? '')}" inputmode="decimal" placeholder="ค่าของแขวง" aria-label="ค่า Factor F ที่แขวงใช้"></td>
      <td style="width:92px">${has && v !== null ? (okv ? '<span class="tag green">✓ ถูกต้อง</span>' : `<span class="tag red" title="ต่างกัน ${(Number(got) - v).toFixed(4)}">✗ ต่าง ${(Number(got) - v > 0 ? '+' : '') + (Number(got) - v).toFixed(4)}</span>`) : ''}</td>`;
  };
  const row = (no, label, v, id, formula = '') => `<tr><td class="ffno-c"><b class="ffno">${no}</b></td><td>${esc(label)}${formula ? `<div class="faint small">${formula}</div>` : ''}</td><td class="r"><b class="ffv">${f4(v)}</b></td>${id ? cmp(id, v) : '<td></td><td></td>'}</tr>`;
  const step = (k) => {
    const r = R[k]; if (!r) return '';
    return `<tr><td><b>${esc(KINDS.find((x) => x[0] === k)[1])}</b><div class="faint small">${esc(colName(k))}</div></td><td class="r num">${f2(cost[k])}</td>
      <td class="r num">${esc(r.lo.label)} ล้าน<br><b>${f4(r.lo.f)}</b></td><td class="r num">${r.hi ? esc(r.hi.label) + ' ล้าน<br><b>' + f4(r.hi.f) + '</b>' : '<span class="faint">ใช้ค่าตามช่วง</span>'}</td><td class="r"><b class="ffv">${f4(r.f)}</b></td></tr>`;
  };
  main.innerHTML = `${tabs('factor')}
  <div class="page-head"><div class="t"><h1>คำนวณ Factor F</h1><span class="muted small">ตรวจค่า Factor F ของแขวง • งานทาง • สะพานและท่อเหลี่ยม • อาคาร • ${esc(FF_SOURCE)}</span></div>
    <button class="btn" id="ff-clear">ล้างค่า</button></div>
  <div class="grid ffgrid">
    <section class="card col" style="gap:12px"><h2 style="margin:0">เงื่อนไข</h2>
      <div class="fgrid">
        <label class="f">เงินล่วงหน้าจ่าย${sel('ff-adv', [0, 5, 10, 15].map((x) => [x, x + ' %']), s.adv)}</label>
        <label class="f">เงินประกันผลงาน${sel('ff-ret', [0, 5, 10].map((x) => [x, x + ' %']), s.ret)}</label>
        <label class="f">ดอกเบี้ยเงินกู้${sel('ff-int', [[6, '6.00 % ต่อปี']], 6)}</label>
        <label class="f">ภาษีมูลค่าเพิ่ม${sel('ff-vat', [[7, '7.00 %'], [0, 'ไม่ต้องชำระ VAT (เงินกู้/แหล่งอื่น)']], s.vat)}</label>
      </div>
      <label class="f">พื้นที่ฝนตกชุก (เฉพาะงานทาง)${sel('ff-rain', [[0, 'ปกติ'], [1, 'ฝนชุก 1'], [2, 'ฝนชุก 2']], s.rain)}</label>
      ${s.vat === 0 ? '<span class="faint small">ไม่ต้องชำระ VAT → ใช้ช่อง "รวมในรูป Factor" (ตารางไม่มีค่าฝนชุกสำหรับกรณีนี้)</span>' : ''}
      <h2 style="margin:6px 0 0">ค่างานต้นทุน (บาท)</h2>
      ${moneyInp('road', 'ผลรวมค่างานต้นทุนงานก่อสร้างทาง', '1')}
      ${moneyInp('bridge', 'ผลรวมค่างานต้นทุนงานก่อสร้างสะพานและท่อเหลี่ยม', '2')}
      ${moneyInp('building', 'ผลรวมค่างานต้นทุนงานก่อสร้างอาคาร', '3')}
      ${moneyInp('extra', 'ผลรวมค่าใช้จ่ายพิเศษตามข้อกำหนดและค่าใช้จ่ายอื่นๆ', '4')}
    </section>
    <section class="card col" style="gap:10px"><h2 style="margin:0">ผลการคำนวณ</h2>
      <div class="scroll-x"><table class="tbl fftbl"><thead><tr><th></th><th>รายการ</th><th class="r">Factor F</th><th class="r">ตรวจค่าของแขวง</th><th></th></tr></thead><tbody>
        ${row('5', 'ค่า Factor F งานก่อสร้างทาง', R.road ? R.road.f : null, 'road')}
        ${row('6', 'ค่า Factor F งานก่อสร้างสะพานและท่อเหลี่ยม', R.bridge ? R.bridge.f : null, 'bridge')}
        ${row('7', 'ค่า Factor F งานก่อสร้างอาคาร', R.building ? R.building.f : null, 'building')}
        ${row('8', 'ค่า Factor F ค่าใช้จ่ายพิเศษตามข้อกำหนดฯ', f6, '', '= 1 + [ ④ ÷ (①×⑤ + ②×⑥ + ③×⑦) ]')}
        ${row('9', 'Factor Fn งานก่อสร้างทาง (รวมค่าใช้จ่ายพิเศษฯ)', Fn.road, 'nroad', '= ⑤ × ⑧')}
        ${row('10', 'Factor Fn งานก่อสร้างสะพานและท่อเหลี่ยม (รวมค่าใช้จ่ายพิเศษฯ)', Fn.bridge, 'nbridge', '= ⑥ × ⑧')}
        ${row('11', 'Factor Fn งานก่อสร้างอาคาร (รวมค่าใช้จ่ายพิเศษฯ)', Fn.building, 'nbuilding', '= ⑦ × ⑧')}
      </tbody></table></div>
      ${total ? `<div class="row wrap ffsum"><span class="grow">ค่าก่อสร้างรวม Factor F <span class="faint">(①×⑨ + ②×⑩ + ③×⑪)</span></span><b>${f2(total)} บาท</b></div>` : ''}
      ${f6 === null ? '<div class="note">มีค่าใช้จ่ายพิเศษแต่ยังไม่มีค่างานต้นทุน — กรอกค่างานอย่างน้อย 1 ประเภท</div>' : ''}
      <span class="faint small">ทศนิยม 4 ตำแหน่งแบบตัดทิ้ง • ค่างานอยู่ระหว่างช่วงในตาราง ใช้การเทียบอัตราส่วน • ช่องตรวจค่าของแขวง: กรอกค่าที่แขวงใช้ ระบบบอกว่าตรงหรือไม่</span>
    </section>
  </div>
  ${KINDS.some(([k]) => R[k]) ? `<section class="card col" style="gap:8px"><h2 style="margin:0">การคำนวณค่า Factor F (เทียบอัตราส่วน)</h2>
    <div class="scroll-x"><table class="tbl"><thead><tr><th>ประเภทงาน</th><th class="r">ค่างานต้นทุน (บาท)</th><th class="r">ช่วงล่าง</th><th class="r">ช่วงบน</th><th class="r">Factor F</th></tr></thead><tbody>${KINDS.map(([k]) => step(k)).join('')}</tbody></table></div>
    <span class="faint small">F = F<sub>ล่าง</sub> − (F<sub>ล่าง</sub> − F<sub>บน</sub>) × (ค่างาน − ช่วงล่าง) ÷ (ช่วงบน − ช่วงล่าง)</span></section>` : ''}
  <details class="card"><summary><b>ดูตาราง Factor F ที่ใช้</b> <span class="faint small">เงินล่วงหน้า ${s.adv}% • ประกันผลงาน ${s.ret}% • ดอกเบี้ย 6% • VAT 7%</span></summary>
    <div class="grid fftables">${KINDS.map(([k, l]) => `<div class="scroll-x"><h3>${esc(l)}</h3><table class="tbl"><thead><tr><th>ค่างาน (ล้านบาท)</th>${FF[k].cols.map((c) => `<th class="r">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${FF[k].labels.map((lab, i) => `<tr><td class="num">${esc(lab)}</td>${FF[k].t[key][i].map((v, j) => `<td class="r num" style="${j === colOf(k) ? 'font-weight:700;color:var(--green-ink)' : ''}">${f4(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}</div></details>`;
  const redraw = () => factorView(main);
  [['adv', 'ff-adv'], ['ret', 'ff-ret'], ['vat', 'ff-vat'], ['rain', 'ff-rain']].forEach(([k, id]) => ($('#' + id).onchange = (e) => { s[k] = Number(e.target.value); redraw(); }));
  // พิมพ์ตัวเลขแล้วคำนวณเมื่อออกจากช่อง/กด Enter (ไม่วาดใหม่ระหว่างพิมพ์ กันเคอร์เซอร์กระโดด)
  const commit = (el, fn) => { el.onchange = fn; el.onkeydown = (e) => { if (e.key === 'Enter') fn(); }; };
  $$('[data-c]', main).forEach((el) => commit(el, () => { const v = el.value.trim(); s[el.dataset.c] = v && !isNaN(num(v)) ? f2(num(v)) : v; redraw(); }));
  $$('[data-cmp]', main).forEach((el) => commit(el, () => { s.cmp[el.dataset.cmp] = el.value.trim(); redraw(); }));
  $('#ff-clear').onclick = () => { Object.assign(s, { road: '', bridge: '', building: '', extra: '', cmp: {} }); redraw(); };
}

/* ---------- ค่าดำเนินการและค่าเสื่อมราคา ---------- */
async function opView(main) {
  const { OP_GROUPS, OP_RATES, OP_SOURCE } = await import('../data/oprate.js');
  const s = ui.op, keys = Object.keys(OP_RATES).map(Number).sort((a, b) => a - b), lo = keys[0], hi = keys[keys.length - 1];
  const price = num(s.price), band = !s.price || isNaN(price) ? null : Math.floor(price + 1e-9);
  const rates = band !== null ? OP_RATES[band] : null;
  // ราคาดีเซลล่าสุดของแต่ละจังหวัด (จากหน้าราคาน้ำมัน)
  const fuel = (S.db.Fuel || []).filter((r) => /ดีเซล/.test(r.fuel) && !/พรีเมี่ยม|premium/i.test(r.fuel));
  const quick = uniq(fuel.map((r) => r.province)).map((p) => fuel.filter((r) => r.province === p).reduce((m, r) => (!m || r.date > m.date ? r : m), null));
  const showN = s.show !== 'rain', showR = s.show !== 'normal';
  const q = s.q.trim().toLowerCase();
  const vc = 1 + (showN ? 2 : 0) + (showR ? 2 : 0), wide = 2 + vc;   // คอลัมน์ตัวเลข • ช่วงข้ามหลังคอลัมน์ลำดับ
  let vi = 0;
  const body = rates ? OP_GROUPS.map((g) => {
    const match = (t) => !q || (g.name + ' ' + t).toLowerCase().includes(q);
    const cells = (r) => {
      const op = r[0], tn = Math.round((r[0] + r[1]) * 100) / 100, tr = Math.round((r[0] + r[2]) * 100) / 100;
      return `<td class="r num">${f2(op)}</td>${showN ? `<td class="r num">${f2(r[1])}</td>` : ''}${showR ? `<td class="r num">${f2(r[2])}</td>` : ''}${showN ? `<td class="r num optot">${f2(tn)}</td>` : ''}${showR ? `<td class="r num optot rain">${f2(tr)}</td>` : ''}`;
    };
    if (g.unit) { const r = rates[vi++]; return match('') ? `<tr class="opg"><td class="center">${g.no}</td><td><b>${esc(g.name)}</b></td><td>${esc(g.unit)}</td>${cells(r)}</tr>` : ''; }
    const lines = g.items.map((it) => {
      if (it.note) return match(it.note) ? `<tr><td></td><td class="opi faint" colspan="${wide}">${esc(it.note)}</td></tr>` : '';
      if (it.sub) return match(it.sub) ? `<tr><td></td><td class="opi" colspan="${wide}"><i>${esc(it.sub)}</i></td></tr>` : '';
      if (it.fixed) return match(it.name) ? `<tr><td></td><td class="opi">${esc(it.name)}</td><td>${esc(it.unit)}</td><td class="r num">${f2(it.fixed)}</td>${'<td></td>'.repeat(vc - 1)}</tr>` : '';
      const r = rates[vi++];
      return match(it.name) ? `<tr><td></td><td class="opi">${esc(it.name)}</td><td>${esc(it.unit)}</td>${cells(r)}</tr>` : '';
    }).join('');
    return lines ? `<tr class="opg"><td class="center">${g.no}</td><td colspan="${wide}"><b>${esc(g.name)}</b></td></tr>${lines}` : '';
  }).join('') : '';
  main.innerHTML = `${tabs('op')}
  <div class="page-head"><div class="t"><h1>ค่าดำเนินการและค่าเสื่อมราคา</h1><span class="muted small">ราคาน้ำมันดีเซล ที่อำเภอเมือง ${lo}.00 – ${hi}.99 บาท/ลิตร • ${esc(OP_SOURCE)}</span></div>
    ${rates ? `<button class="btn" id="op-x">${icon('download', 16)}ส่งออก Excel</button>` : ''}</div>
  <section class="card col" style="gap:12px">
    <div class="row wrap" style="gap:12px;align-items:flex-end">
      <label class="f" style="flex:0 1 220px">ราคาน้ำมันดีเซล (บาท/ลิตร)<input class="inp num" id="op-price" value="${esc(s.price)}" inputmode="decimal" placeholder="เช่น 32.94" style="font-size:20px;font-family:var(--head)"></label>
      <label class="f" style="flex:0 1 230px">หรือเลือกช่วงราคา<select class="inp" id="op-band"><option value="">— เลือก —</option>${keys.map((k) => `<option value="${k}" ${k === band ? 'selected' : ''}>${k}.00 – ${k}.99 บาท/ลิตร</option>`).join('')}</select></label>
      ${rates ? `<span class="tag green" style="height:34px;font-size:14px">ใช้ตารางช่วง ${band}.00 – ${band}.99 บาท/ลิตร</span>` : ''}
    </div>
    ${quick.length ? `<div class="row wrap" style="gap:6px"><span class="muted small">ราคาดีเซลล่าสุด:</span>${quick.map((r) => `<button class="chip" data-fp="${Number(r.price).toFixed(2)}" title="${esc(r.fuel + ' • ' + thDate(r.date))}">${esc(r.province)} <b>${Number(r.price).toFixed(2)}</b></button>`).join('')}</div>` : ''}
    ${band !== null && !rates ? `<div class="note">ราคา ${esc(s.price)} บาท/ลิตร อยู่นอกตาราง (มีเฉพาะ ${lo}.00 – ${hi}.99 บาท/ลิตร)</div>` : ''}
  </section>
  ${rates ? `<div class="filters"><label class="search">${icon('search', 16)}<input id="op-q" value="${esc(s.q)}" placeholder="ค้นลักษณะงาน เช่น บดทับ, Milling" aria-label="ค้นหา"></label>
    <div class="seg-ctl" id="op-show">${[['all', 'ปกติ + ฝนชุก'], ['normal', 'ปกติ'], ['rain', 'ฝนชุก']].map(([k, l]) => `<button data-v="${k}" class="${s.show === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  <section class="card flush scroll-x"><table class="tbl optbl">
    <thead><tr><th rowspan="2" class="center" style="width:56px">ลำดับ</th><th rowspan="2">ลักษณะงาน</th><th rowspan="2">หน่วย</th><th class="r">ค่าดำเนินการ</th>${showN && showR ? '<th class="center" colspan="2">ค่าเสื่อมราคา (บาท)</th><th class="center" colspan="2">รวมค่างาน (บาท)</th>' : `<th class="r">ค่าเสื่อมราคา</th><th class="r">รวมค่างาน</th>`}</tr>
      <tr><th class="r faint">บาท/หน่วย</th>${showN ? '<th class="r faint">ปกติ</th>' : ''}${showR ? '<th class="r faint">ฝนชุก</th>' : ''}${showN ? '<th class="r faint">ปกติ</th>' : ''}${showR ? '<th class="r faint">ฝนชุก</th>' : ''}</tr></thead>
    <tbody>${body || `<tr><td colspan="9">${empty('ไม่พบลักษณะงานที่ค้นหา')}</td></tr>`}</tbody></table></section>
  <span class="faint small">รวมค่างาน = ค่าดำเนินการ + ค่าเสื่อมราคา • ฝนชุก = พื้นที่ฝนตกชุก</span>`
    : empty('กรอกราคาน้ำมันดีเซล หรือเลือกช่วงราคา เพื่อแสดงตารางค่าดำเนินการและค่าเสื่อมราคา')}`;
  const redraw = () => opView(main);
  const setPrice = (v) => { s.price = v; redraw(); };
  const pi = $('#op-price'); pi.onchange = () => setPrice(pi.value.trim()); pi.onkeydown = (e) => { if (e.key === 'Enter') setPrice(pi.value.trim()); };
  $('#op-band').onchange = (e) => setPrice(e.target.value ? e.target.value + '.00' : '');
  on(main, '[data-fp]', 'click', (e, b) => setPrice(b.dataset.fp));
  on(main, '#op-show button', 'click', (e, b) => { s.show = b.dataset.v; redraw(); });
  const qi = $('#op-q');
  if (qi) { let t; qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { s.q = qi.value; redraw().then(() => { const n = $('#op-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }, 250); }; }
  if ($('#op-x')) $('#op-x').onclick = () => exportOp(OP_GROUPS, rates, band);
}

async function exportOp(groups, rates, band) {
  try { await loadXLSX(); } catch (e) { return toast(e.message, 'err'); }
  const aoa = [[`ตารางค่าดำเนินการและค่าเสื่อมราคา • ราคาน้ำมันดีเซล ที่อำเภอเมือง ${band}.00 - ${band}.99 บาท/ลิตร`], ['ลำดับ', 'ลักษณะงาน', 'หน่วย', 'ค่าดำเนินการ (บาท/หน่วย)', 'ค่าเสื่อมราคา ปกติ', 'ค่าเสื่อมราคา ฝนชุก', 'รวมค่างาน ปกติ', 'รวมค่างาน ฝนชุก']];
  let vi = 0;
  const vals = (r) => [r[0], r[1], r[2], Math.round((r[0] + r[1]) * 100) / 100, Math.round((r[0] + r[2]) * 100) / 100];
  groups.forEach((g) => {
    if (g.unit) { aoa.push([g.no, g.name, g.unit, ...vals(rates[vi++])]); return; }
    aoa.push([g.no, g.name]);
    g.items.forEach((it) => {
      if (it.note || it.sub) aoa.push(['', '   ' + (it.note || it.sub)]);
      else if (it.fixed) aoa.push(['', '   ' + it.name, it.unit, it.fixed]);
      else aoa.push(['', '   ' + it.name, it.unit, ...vals(rates[vi++])]);
    });
  });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'ค่าดำเนินการ');
  XLSX.writeFile(wb, `ค่าดำเนินการและค่าเสื่อม_ดีเซล${band}บาท.xlsx`);
}

/* ---------- ค่าขนส่งวัสดุก่อสร้าง (6 ล้อ • 10 ล้อ • 10 ล้อลากพ่วง) ---------- */
/** ค่าขนส่งต่อหน่วยที่ระยะ d กม.: 1–200 กม. ตามตาราง • 201–1000 กม. = ค่าที่ 200 กม. + (d − 200) × อัตราต่อ กม. */
function transportCost(b, d, j) {
  if (d <= 200) return { v: b.r[d - 1][j] };
  const base = b.r[199][j], per = b.x[j];
  return { v: Math.round((base + (d - 200) * per) * 100) / 100, base, per, over: d - 200 };
}

async function transportView(main) {
  const { TR } = await import('../data/transport.js');
  const s = ui.tr;
  if (!s.price && ui.op.price) s.price = ui.op.price;
  const keys = Object.keys(TR.bands.t6).map(Number).sort((a, b) => a - b), lo = keys[0], hi = keys[keys.length - 1];
  const price = num(s.price), band = !s.price || isNaN(price) ? null : Math.floor(price + 1e-9);
  const inBand = band !== null && TR.bands.t6[band];
  const dist = num(s.dist), d = !s.dist || isNaN(dist) || dist <= 0 ? null : Math.max(1, Math.round(dist));
  const fuel = (S.db.Fuel || []).filter((r) => /ดีเซล/.test(r.fuel) && !/พรีเมี่ยม|premium/i.test(r.fuel));
  const quick = uniq(fuel.map((r) => r.province)).map((p) => fuel.filter((r) => r.province === p).reduce((m, r) => (!m || r.date > m.date ? r : m), null));
  const card = (t) => {
    const b = TR.bands[t.k][band], ton = transportCost(b, d, 0), m3 = transportCost(b, d, 1);
    const how = (c, u) => (c.over ? `<div class="faint small">${f2(c.base)} + (${c.over} กม. × ${f2(c.per)}) ${u}</div>` : '');
    return `<section class="card col trcard" style="gap:8px"><div><h3>${esc(t.name)}</h3><span class="faint">${esc(t.note)}</span></div>
      <div class="row wrap" style="gap:18px;align-items:flex-start">
        <div class="col" style="gap:2px"><span class="faint">บาท / ตัน</span><b class="trv">${f2(ton.v)}</b>${how(ton, 'บาท/ตัน')}</div>
        <div class="col" style="gap:2px"><span class="faint">บาท / ลบ.ม.</span><b class="trv">${f2(m3.v)}</b>${how(m3, 'บาท/ลบ.ม.')}</div>
      </div></section>`;
  };
  const tk = TR.trucks.find((t) => t.k === s.truck) || TR.trucks[0];
  const cat = materialCatalog(), mband = inBand ? band : null;
  const table = () => {
    const b = TR.bands[tk.k][band], N = 4, per = 50;
    const cell = (km) => { const r = b.r[km - 1], on = km === d; return `<td class="num center ${on ? 'tron' : ''}">${km}</td><td class="r num ${on ? 'tron' : ''}">${f2(r[0])}</td><td class="r num ${on ? 'tron' : ''}">${f2(r[1])}</td>`; };
    return `<div class="seg-ctl" id="tr-truck" style="margin:10px 0">${TR.trucks.map((t) => `<button data-v="${t.k}" class="${t.k === tk.k ? 'on' : ''}">${esc(t.name.replace('รถบรรทุก ', ''))}</button>`).join('')}</div>
      <div class="scroll-x"><table class="tbl trtbl"><thead><tr>${'<th class="center">ระยะ (กม.)</th><th class="r">บาท/ตัน</th><th class="r">บาท/ลบ.ม.</th>'.repeat(N)}</tr></thead>
      <tbody>${Array.from({ length: per }, (_, i) => `<tr>${Array.from({ length: N }, (_, c) => cell(c * per + i + 1)).join('')}</tr>`).join('')}
        <tr><td class="center small ${d > 200 ? 'tron' : ''}" colspan="3">201 – 1000 กม. คิดเพิ่ม กม.ละ</td><td class="r num ${d > 200 ? 'tron' : ''}" colspan="2">${f2(b.x[0])} บาท/ตัน</td><td class="r num ${d > 200 ? 'tron' : ''}">${f2(b.x[1])} บาท/ลบ.ม.</td><td colspan="6"></td></tr></tbody></table></div>`;
  };
  main.innerHTML = `${tabs('transport')}
  <div class="page-head"><div class="t"><h1>ค่าขนส่งวัสดุก่อสร้าง</h1><span class="muted small">ภูมิประเทศที่ราบ ผิวทางลาดยาง การจราจรปกติ • ราคาน้ำมันดีเซล อ.เมือง ${lo}.00 – ${hi}.99 บาท/ลิตร • ระยะ 1–200 กม. ตามตาราง เกิน 200 กม. คิดเพิ่มต่อ กม.</span></div>
    ${inBand ? `<button class="btn" id="tr-x">${icon('download', 16)}ส่งออก Excel</button>` : ''}</div>
  <section class="card col" style="gap:12px">
    <div class="row wrap" style="gap:12px;align-items:flex-end">
      <label class="f" style="flex:0 1 210px">ราคาน้ำมันดีเซล (บาท/ลิตร)<input class="inp num" id="tr-price" value="${esc(s.price)}" inputmode="decimal" placeholder="เช่น 32.94" style="font-size:20px;font-family:var(--head)"></label>
      <label class="f" style="flex:0 1 220px">หรือเลือกช่วงราคา<select class="inp" id="tr-band"><option value="">— เลือก —</option>${keys.map((k) => `<option value="${k}" ${k === band ? 'selected' : ''}>${k}.00 – ${k}.99 บาท/ลิตร</option>`).join('')}</select></label>
      <label class="f" style="flex:0 1 190px">ระยะทางขนส่ง (กม.)<input class="inp num" id="tr-dist" value="${esc(s.dist)}" inputmode="decimal" placeholder="เช่น 35" style="font-size:20px;font-family:var(--head)"></label>
      ${inBand ? `<span class="tag green" style="height:34px;font-size:14px">ตารางช่วง ${band}.00 – ${band}.99 บาท/ลิตร${d ? ' • ระยะ ' + d + ' กม.' : ''}</span>` : ''}
    </div>
    ${quick.length ? `<div class="row wrap" style="gap:6px"><span class="muted small">ราคาดีเซลล่าสุด:</span>${quick.map((r) => `<button class="chip" data-fp="${Number(r.price).toFixed(2)}" title="${esc(r.fuel + ' • ' + thDate(r.date))}">${esc(r.province)} <b>${Number(r.price).toFixed(2)}</b></button>`).join('')}</div>` : ''}
    ${band !== null && !inBand ? `<div class="note">ราคา ${esc(s.price)} บาท/ลิตร อยู่นอกตาราง (มีเฉพาะ ${lo}.00 – ${hi}.99 บาท/ลิตร)</div>` : ''}
    ${d && dist !== d ? `<span class="faint small">ระยะ ${esc(s.dist)} กม. ปัดเป็น ${d} กม. ตามตาราง (รายกิโลเมตร)</span>` : ''}
    ${d > 1000 ? '<div class="note">ตารางกำหนดอัตราเพิ่มต่อ กม. ถึง 1,000 กม. — ระยะเกินนี้คำนวณต่อด้วยอัตราเดียวกัน ควรตรวจสอบเงื่อนไขอีกครั้ง</div>' : ''}
  </section>
  ${inBand && d ? `<div class="grid trcards">${TR.trucks.map(card).join('')}</div>` : inBand ? empty('กรอกระยะทางขนส่ง เพื่อแสดงค่าขนส่งของรถทั้ง 3 ชนิด') : empty('กรอกราคาน้ำมันดีเซล หรือเลือกช่วงราคา แล้วกรอกระยะทางขนส่ง')}
  ${matSection(TR, mband, s.dist, cat)}
  ${inBand ? `<details class="card" id="tr-tbl" ${s.open ? 'open' : ''}><summary><b>ดูตารางค่าขนส่ง</b> <span class="faint small">ช่วงราคาน้ำมัน ${band}.00 – ${band}.99 บาท/ลิตร • ${esc(tk.name)} (${esc(tk.note)})</span></summary>${table()}</details>` : ''}`;
  const redraw = () => transportView(main);
  const commit = (el, fn) => { el.onchange = fn; el.onkeydown = (e) => { if (e.key === 'Enter') fn(); }; };
  commit($('#tr-price'), () => { s.price = $('#tr-price').value.trim(); redraw(); });
  commit($('#tr-dist'), () => { s.dist = $('#tr-dist').value.trim(); redraw(); });
  $('#tr-band').onchange = (e) => { s.price = e.target.value ? e.target.value + '.00' : ''; redraw(); };
  on(main, '[data-fp]', 'click', (e, b) => { s.price = b.dataset.fp; redraw(); });
  const det = $('#tr-tbl'); if (det) det.ontoggle = () => (s.open = det.open);
  on(main, '#tr-truck button', 'click', (e, b) => { s.truck = b.dataset.v; s.open = true; redraw(); });
  if ($('#tr-x')) $('#tr-x').onclick = () => exportTransport(TR, band);
  bindMat(main, TR, mband, s.dist, cat, redraw);
}

async function exportTransport(TR, band) {
  try { await loadXLSX(); } catch (e) { return toast(e.message, 'err'); }
  const wb = XLSX.utils.book_new();
  TR.trucks.forEach((t) => {
    const b = TR.bands[t.k][band];
    const aoa = [[`ตารางค่าขนส่งวัสดุก่อสร้าง ${t.name} (${t.note}) • ราคาน้ำมันดีเซล อ.เมือง ${band}.00 - ${band}.99 บาท/ลิตร`], ['ระยะขนส่ง (กม.)', 'ค่าบรรทุก บาท/ตัน', 'ค่าบรรทุก บาท/ลบ.ม.']];
    b.r.forEach((r, i) => aoa.push([i + 1, r[0], r[1]]));
    aoa.push(['201-1000 (ต่อ กม.)', b.x[0], b.x[1]]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), t.name.replace('รถบรรทุก ', '').replace(' และรถลากพ่วง', ' พ่วง'));
  });
  XLSX.writeFile(wb, `ค่าขนส่ง_ดีเซล${band}บาท.xlsx`);
}

/* ---------- ตารางรายละเอียดราคาวัสดุและค่าขนส่ง (ราคาวัสดุที่หน้างาน) ---------- */
/** ตัวแปรสภาพผิวทาง [ราบ, ลูกเนิน, ภูเขา] — 10 ล้อลากพ่วงไม่มีค่าภูเขา */
const SURF = { t6: { a: [1.00, 2.12, 2.56], l: [1.24, 2.36, 2.80] }, t10: { a: [1.00, 1.95, 2.52], l: [1.23, 2.18, 2.75] }, t10p: { a: [1.00, 2.13, null], l: [1.20, 2.33, null] } };
const DKEYS = [['pr', 'a', 0], ['ph', 'a', 1], ['pm', 'a', 2], ['lr', 'l', 0], ['lh', 'l', 1], ['lm', 'l', 2]];
/** ค่าขนขึ้นลง (บาท/ตัน) • ค่าตัด ดัด และผูกเหล็กเส้นเสริมคอนกรีต (บาท/ตัน) */
const LOADS = [['', '—', 0], ['equip', 'อุปกรณ์', 80], ['mc', 'ยาง MC', 25], ['ac', 'ยาง AC', 35], ['pma', 'ยาง P.M.A.', 50], ['steel', 'เหล็กเส้น', 80], ['cement', 'ปูนซีเมนต์', 50]];
const CUTS = [['', '—', 0], ['c10', 'ผิวเรียบ Ø < 10 มม.', 4900], ['c16', 'ผิวเรียบ/ข้ออ้อย Ø 10–16 มม.', 3900], ['c99', 'ผิวเรียบ/ข้ออ้อย Ø > 16 มม.', 3500]];
const TRUCKS3 = [['t6', '6 ล้อ'], ['t10', '10 ล้อ'], ['t10p', '10 ล้อพ่วง']];
const ROW_KEY = 'tr-rows';
const newRow = () => ({ item: '', src: '', unit: 'm3', price: '', truck: 't10', pr: '', ph: '', pm: '', lr: '', lh: '', lm: '', load: '', cut: '', place: '' });
function rowsOf() {
  if (!ui.tr.rows) { try { ui.tr.rows = JSON.parse(localStorage.getItem(ROW_KEY) || 'null'); } catch (e) { ui.tr.rows = null; } }
  if (!Array.isArray(ui.tr.rows) || !ui.tr.rows.length) ui.tr.rows = [newRow()];
  return ui.tr.rows;
}
const saveRows = () => { try { localStorage.setItem(ROW_KEY, JSON.stringify(ui.tr.rows)); } catch (e) {} };
const r2 = (x) => Math.round(x * 100) / 100;

/** ค่าเริ่มต้นตามชนิดวัสดุ: หน่วย • ค่าขนขึ้นลง • ค่าตัดดัดเหล็ก */
function guess(row, entry) {
  const g = entry.group, it = entry.item;
  row.unit = /ตัน/.test(entry.unit) ? 'ton' : /ลบ/.test(entry.unit) ? 'm3' : row.unit;
  row.load = g === 'เหล็กเส้น' ? 'steel' : g === 'ปูนซีเมนต์' ? 'cement' : g === 'ยางแอสฟัลต์' ? (/MC/i.test(it) ? 'mc' : /P\.?M\.?A/i.test(it) ? 'pma' : /AC/i.test(it) ? 'ac' : '') : '';
  const dia = Number((/Ø\s*(\d+)/.exec(it) || [])[1]);
  row.cut = g === 'เหล็กเส้น' && dia ? (dia < 10 ? 'c10' : dia <= 16 ? 'c16' : 'c99') : '';
}

function calcRow(row, cat, TR, band, top) {
  const entries = cat.filter((c) => c.group + '|' + c.item === row.item), e = entries.find((c) => c.src === row.src) || entries[0];
  const price = row.price !== '' && !isNaN(num(row.price)) ? num(row.price) : e ? e.price : null;
  const f = SURF[row.truck], ds = DKEYS.map(([k, s, i]) => ({ k, d: k === 'pr' && row.pr === '' ? (num(top) || 0) : (num(row[k]) || 0), f: f[s][i] }));
  const total = ds.reduce((a, x) => a + x.d, 0), eq = ds.reduce((a, x) => a + x.d * (x.f || 0), 0);
  const factor = total > 0 ? Math.round((eq / total) * 1e4) / 1e4 : 1;
  const b = band !== null && TR.bands[row.truck][band];
  const base = b && total > 0 ? transportCost(b, Math.max(1, Math.round(total)), row.unit === 'ton' ? 0 : 1).v : null;
  const cost = base !== null ? r2(base * factor) : null;
  const load = (LOADS.find((x) => x[0] === row.load) || LOADS[0])[2], cut = (CUTS.find((x) => x[0] === row.cut) || CUTS[0])[2];
  const site = price !== null && cost !== null ? r2(price + cost + load + cut) : null;
  return { entries, e, price, ds, total, factor, base, cost, load, cut, site };
}

function matSection(TR, band, top, cat) {
  const rows = rowsOf(), groups = uniq(cat.map((c) => c.group));
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`;
  const unitTxt = (u) => (u === 'ton' ? 'ตัน' : 'ลบ.ม.');
  const tr = (row, i) => {
    const c = calcRow(row, cat, TR, band, top), f = SURF[row.truck];
    const dIn = ([k, s, j]) => f[s][j] === null ? '<td class="center faint">—</td>' : `<td><input class="inp num trm-d" data-i="${i}" data-f="${k}" value="${esc(row[k])}" placeholder="${k === 'pr' ? esc(top || '0') : ''}" inputmode="decimal" title="ตัวแปร ${f[s][j].toFixed(2)}"></td>`;
    return `<tr>
      <td class="center">${i + 1}</td>
      <td><select class="inp trm-s" data-i="${i}" data-f="item" style="min-width:170px">${opt('', '— เลือกวัสดุ —', row.item)}${groups.map((g) => `<optgroup label="${esc(g)}">${uniq(cat.filter((x) => x.group === g).map((x) => x.item)).map((it) => opt(g + '|' + it, it, row.item)).join('')}</optgroup>`).join('')}</select></td>
      <td><select class="inp trm-s" data-i="${i}" data-f="src" style="min-width:170px" ${c.entries.length ? '' : 'disabled'}>${c.entries.map((x) => opt(x.src, `${x.src} — ${f2(x.price)}/${x.unit || ''}`, c.e && c.e.src)).join('')}</select></td>
      <td><select class="inp trm-s" data-i="${i}" data-f="unit">${opt('ton', 'ตัน', row.unit)}${opt('m3', 'ลบ.ม.', row.unit)}</select></td>
      <td><input class="inp num trm-p" data-i="${i}" data-f="price" value="${esc(row.price)}" placeholder="${c.e ? f2(c.e.price) : ''}" inputmode="decimal" title="ว่าง = ใช้ราคาจากหน้าราคาวัสดุ"></td>
      <td><select class="inp trm-s" data-i="${i}" data-f="truck">${TRUCKS3.map(([k, l]) => opt(k, l, row.truck)).join('')}</select></td>
      ${DKEYS.map(dIn).join('')}
      <td class="r num">${c.total ? f2(c.total) : '—'}</td>
      <td class="r num">${c.factor.toFixed(4)}</td>
      <td class="r num">${c.cost !== null ? f2(c.cost) : '—'}</td>
      <td><select class="inp trm-s" data-i="${i}" data-f="load" title="ค่าขนขึ้นลง บาท/ตัน">${LOADS.map(([k, l, v]) => opt(k, v ? `${l} ${v}` : l, row.load)).join('')}</select></td>
      <td><select class="inp trm-s" data-i="${i}" data-f="cut" title="ค่าตัด ดัด ผูกเหล็ก บาท/ตัน">${CUTS.map(([k, l, v]) => opt(k, v ? `${l} ${f2(v)}` : l, row.cut)).join('')}</select></td>
      <td class="r num"><b class="trm-site">${c.site !== null ? f2(c.site) : '—'}</b><div class="faint small">บาท/${unitTxt(row.unit)}</div></td>
      <td><input class="inp trm-t" data-i="${i}" data-f="place" value="${esc(row.place)}" placeholder="เช่น ท่าทรายเมืองเชียง"></td>
      <td><button class="icon-btn sm" data-rm="${i}" aria-label="ลบแถว">${icon('x', 14)}</button></td></tr>`;
  };
  return `<section class="card col" style="gap:10px" id="trm">
    <div class="row wrap"><h2 class="grow" style="margin:0">ราคาวัสดุที่หน้างาน (ราคาวัสดุ + ค่าขนส่ง)</h2>
      <button class="btn sm" id="trm-add">${icon('plus', 14)}เพิ่มรายการ</button><button class="btn sm" id="trm-x">${icon('download', 14)}ส่งออก Excel</button><button class="btn sm danger" id="trm-clear">ล้างตาราง</button></div>
    ${band === null ? '<div class="note">กรอกราคาน้ำมันด้านบนก่อน เพื่อคำนวณค่าขนส่ง</div>' : ''}
    ${cat.length ? '' : '<div class="note">ยังไม่มีราคาในหน้าราคาวัสดุ — พิมพ์ราคาเองในช่องราคาได้</div>'}
    <div class="scroll-x"><table class="tbl trmtbl"><thead>
      <tr><th rowspan="2">ลำดับ</th><th rowspan="2">วัสดุ</th><th rowspan="2">ราคาจาก</th><th rowspan="2">หน่วย</th><th rowspan="2" class="r">ราคา</th><th rowspan="2">รถขนส่ง</th><th colspan="3" class="center">ทางลาดยาง (กม.)</th><th colspan="3" class="center">ทางลูกรัง (กม.)</th><th rowspan="2" class="r">รวมระยะ</th><th rowspan="2" class="r">Factor<br>ค่าขนส่ง</th><th rowspan="2" class="r">ค่าขนส่ง</th><th rowspan="2">ค่าขนขึ้น-ลง</th><th rowspan="2">ค่าตัด/ดัดเหล็ก</th><th rowspan="2" class="r">ราคาวัสดุ<br>ที่หน้างาน</th><th rowspan="2">แหล่งวัสดุ</th><th rowspan="2"></th></tr>
      <tr><th class="center">ราบ</th><th class="center">เนิน</th><th class="center">เขา</th><th class="center">ราบ</th><th class="center">เนิน</th><th class="center">เขา</th></tr></thead>
      <tbody>${rows.map(tr).join('')}</tbody></table></div>
    <span class="faint small">ทางลาดยาง-ราบ ว่าง = ใช้ระยะทางขนส่งด้านบน • Factor ค่าขนส่ง = Σ(ระยะ × ตัวแปรสภาพผิวทาง) ÷ รวมระยะ • ค่าขนส่ง = อัตราตามตาราง (รวมระยะ) × Factor • ราคาวัสดุที่หน้างาน = ราคา + ค่าขนส่ง + ค่าขนขึ้น-ลง + ค่าตัด/ดัดเหล็ก (สองรายการหลังเป็นบาท/ตัน)</span>
    <details><summary class="small" style="cursor:pointer">ตัวแปรสภาพผิวทาง • ค่าขนขึ้นลง • ค่าตัดดัดเหล็ก</summary>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:8px">
        <table class="tbl"><thead><tr><th>รถ</th><th class="r">ลาดยาง ราบ/เนิน/เขา</th><th class="r">ลูกรัง ราบ/เนิน/เขา</th></tr></thead><tbody>${TRUCKS3.map(([k, l]) => `<tr><td>${l}</td><td class="r num">${SURF[k].a.map((x) => (x === null ? '—' : x.toFixed(2))).join(' / ')}</td><td class="r num">${SURF[k].l.map((x) => (x === null ? '—' : x.toFixed(2))).join(' / ')}</td></tr>`).join('')}</tbody></table>
        <table class="tbl"><thead><tr><th>ค่าขนขึ้นลง</th><th class="r">บาท/ตัน</th></tr></thead><tbody>${LOADS.slice(1).map(([, l, v]) => `<tr><td>${l}</td><td class="r num">${v}</td></tr>`).join('')}</tbody></table>
        <table class="tbl"><thead><tr><th>ตัด ดัด ผูกเหล็กเส้น</th><th class="r">บาท/ตัน</th></tr></thead><tbody>${CUTS.slice(1).map(([, l, v]) => `<tr><td>${l}</td><td class="r num">${f2(v)}</td></tr>`).join('')}</tbody></table>
      </div></details>
  </section>`;
}

function bindMat(main, TR, band, top, cat, redraw) {
  const rows = rowsOf();
  $$('#trm [data-f]', main).forEach((el) => (el.onchange = () => {
    const row = rows[el.dataset.i], k = el.dataset.f;
    row[k] = el.value.trim();
    if (k === 'item') { const e = cat.find((c) => c.group + '|' + c.item === row.item); row.src = e ? e.src : ''; row.price = ''; if (e) guess(row, e); }
    if (k === 'src') row.price = '';
    saveRows(); redraw();
  }));
  on(main, '#trm [data-rm]', 'click', (e, b) => { rows.splice(Number(b.dataset.rm), 1); saveRows(); redraw(); });
  $('#trm-add').onclick = () => { rows.push(newRow()); saveRows(); redraw(); };
  $('#trm-clear').onclick = () => { if (confirm('ล้างทุกแถวในตาราง?')) { ui.tr.rows = [newRow()]; saveRows(); redraw(); } };
  $('#trm-x').onclick = async () => {
    try { await loadXLSX(); } catch (x) { return toast(x.message, 'err'); }
    const aoa = [[`รายละเอียดราคาวัสดุและค่าขนส่ง • ราคาน้ำมันดีเซล ${band !== null ? band + '.00 - ' + band + '.99' : '-'} บาท/ลิตร`],
      ['ลำดับ', 'วัสดุ', 'ราคาจาก', 'ราคา', 'หน่วย', 'รถขนส่ง', 'ลาดยาง ราบ', 'ลาดยาง เนิน', 'ลาดยาง เขา', 'ลูกรัง ราบ', 'ลูกรัง เนิน', 'ลูกรัง เขา', 'รวมระยะ', 'Factor ค่าขนส่ง', 'ค่าขนส่ง', 'ค่าขนขึ้น-ลง', 'ค่าตัด/ดัดเหล็ก', 'ราคาวัสดุที่หน้างาน', 'แหล่งวัสดุ']];
    rows.forEach((row, i) => { const c = calcRow(row, cat, TR, band, top); aoa.push([i + 1, row.item.split('|')[1] || '', c.e ? c.e.src : '', c.price, row.unit === 'ton' ? 'ตัน' : 'ลบ.ม.', (TRUCKS3.find((x) => x[0] === row.truck) || [])[1], ...c.ds.map((x) => x.d), c.total, c.factor, c.cost, c.load, c.cut, c.site, row.place]); });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'ราคาวัสดุที่หน้างาน'); XLSX.writeFile(wb, 'ราคาวัสดุและค่าขนส่ง.xlsx');
  };
}
