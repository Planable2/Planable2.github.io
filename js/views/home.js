// ===== หน้าแรก / Dashboard =====
import { S, plans, planYears, defaultYear, units, offices, statuses, isGuest, myOpenOrders, attendeesOf, currentFY, orderDone, assigneesOf } from '../store.js';
import { esc, $, on, mil, money, thDate, toDate, today, daysBetween, TH_DOW, loadXLSX } from '../util.js';
import { chart } from '../charts.js';
import { modal, modalHead, avatarStack, icon, toast } from '../ui.js';

const ui = { year: null, type: 'stack', measure: 'count', unit: 'all', office: 'all', cb: null };
const cbDefault = () => ({ metric: 'cut', group: 'unit', split: 'year', type: 'col', years: Object.fromEntries(planYears().map((y) => [y, true])), unit: 'all', office: 'all', status: 'all' });

export function view(main, arg, app) {
  if (!ui.year || !planYears().includes(ui.year)) ui.year = defaultYear();
  if (!ui.cb) ui.cb = cbDefault();
  const years = planYears(), fy = currentFY();
  const all = plans(), yearPlans = all.filter((p) => p.fiscal_year === ui.year);
  const set = yearPlans.filter((p) => (ui.unit === 'all' || p.unit === ui.unit) && (ui.office === 'all' || p.office === ui.office));
  const ST = statuses(), money_ = ui.measure === 'budget';
  const sum = (l, f) => l.reduce((a, p) => a + f(p), 0);
  const grp = (g) => set.filter((p) => p.st.dash_group === g);
  const late = yearPlans.filter((p) => p.late);
  const lateBy = {}; late.forEach((p) => (lateBy[p.unit] = (lateBy[p.unit] || 0) + 1));

  main.innerHTML = `
  <div class="page-head">
    <div class="t"><span class="muted small">${isGuest() ? 'ยินดีต้อนรับ • โหมดผู้เยี่ยมชม' : 'สวัสดี, ' + esc(S.user.full_name) + ' • ' + TH_DOW[new Date().getDay()] + ' ' + thDate(new Date())}</span>
      <h1>ภาพรวมแผนทั้งเขต • ปีงบ ${ui.year}</h1></div>
    <label class="row small muted" style="background:var(--card);border:1px solid var(--line);border-radius:22px;padding:0 6px 0 14px;height:44px">ปีงบประมาณ
      <select id="h-year" class="inp" style="height:34px;width:auto;border:0;background:var(--green-soft);color:var(--green-ink);font-weight:600">${years.length ? years.map((y) => `<option value="${y}" ${y === ui.year ? 'selected' : ''}>${y}${y === fy ? ' (ปัจจุบัน)' : ''}</option>`).join('') : `<option>${fy}</option>`}</select></label>
    <button class="btn" id="h-export">${icon('download', 16)}ส่งออก Excel</button>
  </div>
  ${ui.year < fy ? `<div class="note grey">ปีงบ ${ui.year} ปิดแล้ว — ดูและส่งออกได้ แก้ไขได้เฉพาะผู้ดูแลระบบ</div>` : ''}
  ${!years.length ? `<div class="empty">ยังไม่มีแผนในทะเบียน — เริ่มจากหน้าทะเบียนแผน (ลงทะเบียน หรือ นำเข้าจาก Excel)</div>` : ''}
  <section class="kpis">
    ${kpi('แผนทั้งหมด', set.length, mil(sum(set, (p) => p.budget_cut)) + ' ลบ. หลังปรับลด', '#FFFEFB', 'var(--ink)')}
    ${kpi('ยังไม่ส่ง', grp('ยังไม่ส่ง').length, mil(sum(grp('ยังไม่ส่ง'), (p) => p.budget_cut)) + ' ลบ.', '#EFEBE2', '#57524A')}
    ${kpi('ส่งแล้ว', set.filter((p) => p.sent).length, 'จาก ' + set.length + ' แผน', '#E9EFF5', '#3B5A78')}
    ${kpi('ส่งกรมแล้ว', grp('ส่งกรมแล้ว').length + grp('กรมเห็นชอบ').length, mil(sum(grp('ส่งกรมแล้ว').concat(grp('กรมเห็นชอบ')), (p) => p.budget_cut)) + ' ลบ.', '#E5F0EC', '#2F6657')}
    ${kpi('กรมเห็นชอบ', grp('กรมเห็นชอบ').length, mil(sum(grp('กรมเห็นชอบ'), (p) => p.budget_cut)) + ' ลบ.', '#E7EEDF', '#33502F')}
  </section>
  <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(280px,1fr);align-items:start" id="h-main">
    <section class="card col" style="gap:12px">
      <div class="row wrap"><h2 class="grow" style="margin:0">สถานะแผน • ${esc(ui.unit === 'all' ? 'ทั้งเขต' : ui.unit)}${ui.office === 'all' ? '' : ' • ' + esc(ui.office)}</h2>
        <div class="seg-ctl" id="h-type">${[['stack', 'แท่งแนวนอน'], ['col', 'แท่งแนวตั้ง'], ['donut', 'วงกลม'], ['prog', '% ส่งแล้ว']].map((t) => `<button data-v="${t[0]}" class="${ui.type === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div></div>
      <div class="row wrap small">
        <label class="row muted">หน่วยงาน <select class="inp" id="h-unit" style="height:38px;width:auto"><option value="all">ทั้งเขต</option>${units().map((u) => `<option ${u.name === ui.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
        <label class="row muted">สำนัก <select class="inp" id="h-office" style="height:38px;width:auto"><option value="all">ทุกสำนัก</option>${offices().map((o) => `<option ${o.short === ui.office ? 'selected' : ''}>${esc(o.short)}</option>`).join('')}</select></label>
        <div class="seg-ctl right" id="h-measure">${[['count', 'จำนวนแผน'], ['budget', 'งบประมาณ']].map((t) => `<button data-v="${t[0]}" class="${ui.measure === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
      </div>
      <div id="h-chart"></div>
      <span class="faint">ชี้/แตะที่กราฟเพื่อดูตัวเลข • คลิกหน่วยงานเพื่อดูกราฟย่อยแยกสำนัก • แผนของเขตนับ "ส่งแล้ว" เมื่อส่งกรม</span>
    </section>
    <aside class="col" style="gap:14px" id="h-side"></aside>
  </div>
  <section class="card col" style="gap:14px" id="h-builder"></section>`;

  // ----- กราฟหลัก -----
  const byUnit = ui.unit === 'all';
  const keys = byUnit ? units().map((u) => u.name) : offices().map((o) => o.short);
  const cats = keys.map((k) => {
    const l = set.filter((p) => (byUnit ? p.unit === k : p.office === k));
    if (!l.length) return null;
    const vals = ST.map((s) => { const x = l.filter((p) => p.status === s.status_code); return money_ ? sum(x, (p) => p.budget_cut) / 1e6 : x.length; });
    const sent = l.filter((p) => p.sent).length;
    return { key: k, label: k, values: ui.type === 'prog' ? [(sent / l.length) * 100] : vals, sub: sent + '/' + l.length + ' แผน',
      tips: ui.type === 'prog' ? ['ส่งแล้ว ' + sent + ' จาก ' + l.length + ' แผน'] : ST.map((s) => { const x = l.filter((p) => p.status === s.status_code); return `${x.length} แผน • ${mil(sum(x, (p) => p.budget_cut))} ลบ.`; }) };
  }).filter(Boolean);
  const type = ui.type === 'stack' ? 'hbar' : ui.type;
  if (ui.type === 'donut') {
    const dcats = ST.map((s) => { const x = set.filter((p) => p.status === s.status_code); return { key: s.status_code, label: s.name, color: s.color, values: [money_ ? sum(x, (p) => p.budget_cut) / 1e6 : x.length] }; }).filter((c) => c.values[0] > 0);
    $('#h-chart').innerHTML = chart({ cats: dcats, series: [{ label: '', color: '' }], type: 'donut', fmt: (v) => (money_ ? v.toFixed(1) : String(Math.round(v))), unit: money_ ? 'ลบ.' : 'แผน' });
  } else {
    $('#h-chart').innerHTML = chart({ cats, series: ui.type === 'prog' ? [{ label: '% ส่งแล้ว', color: '#46703F' }] : ST.map((s) => ({ label: s.name, color: s.color })), type, unit: ui.type === 'prog' ? '%' : money_ ? 'ลบ.' : 'แผน', fmt: (v) => (money_ ? v.toFixed(1) : String(Math.round(v))), onCat: byUnit });
  }
  on(main, '#h-chart [data-cat]', 'click', (e, el) => drill(el.dataset.cat, yearPlans));

  // ----- ด้านขวา (บุคลากร) -----
  const side = $('#h-side');
  if (isGuest()) { side.innerHTML = `<div class="card small muted">โหมดผู้เยี่ยมชมแสดงเฉพาะภาพรวมแผนงาน</div>`; }
  else {
    const mine = myOpenOrders(), t0 = today();
    const lateO = mine.filter((o) => toDate(o.due_date) < t0).length, nearO = mine.filter((o) => { const d = daysBetween(t0, o.due_date); return d >= 0 && d <= 3; }).length;
    const ups = S.db.Meetings.filter((m) => m.status !== 'cancelled' && toDate(m.date) >= t0).sort((a, b) => (a.date + a.start > b.date + b.start ? 1 : -1)).slice(0, 4);
    side.innerHTML = `
      ${late.length && ui.year === currentFY() ? `<a class="note red" href="#/plans">${icon('warn')}<span class="grow"><b>เลยกำหนดรอบส่ง ${late.length} แผน</b><br>${Object.keys(lateBy).map((k) => esc(k) + ' (' + lateBy[k] + ')').join(', ')}</span>${icon('chev', 16)}</a>` : ''}
      <a class="card row" href="#/orders" style="color:var(--ink)"><span class="kpi" style="padding:0;background:none"><span class="v" style="color:var(--gold-ink)">${mine.length}</span></span><span class="grow"><b>งานสั่งการของคุณ</b><br><span class="muted small">ค้าง ${mine.length} งาน${lateO ? ' • เลยกำหนด ' + lateO : ''}${nearO ? ' • ใกล้กำหนด ' + nearO : ''}</span></span>${icon('chev', 16)}</a>
      <section class="card col" style="gap:8px"><div class="row"><h3 class="grow">ประชุมที่กำลังจะมาถึง</h3><a href="#/meetings" class="small">ดูปฏิทิน</a></div>
        ${ups.length ? ups.map((m) => { const d = toDate(m.date), mineM = attendeesOf(m.meeting_id).includes(S.user.user_id); return `<a href="#/meetings/${esc(m.meeting_id)}" class="row" style="color:var(--ink);padding:8px 0;border-top:1px solid var(--line2);align-items:flex-start"><span style="width:50px;border-radius:16px;background:${daysBetween(t0, d) === 0 ? 'var(--green)' : 'var(--soft2)'};color:${daysBetween(t0, d) === 0 ? '#fff' : 'var(--ink)'};display:flex;flex-direction:column;align-items:center;padding:5px 0;flex-shrink:0"><span style="font-size:11px">${TH_DOW[d.getDay()].slice(0, 2)}.</span><b style="font-family:var(--head);font-size:19px;font-weight:500">${d.getDate()}</b></span><span class="col grow" style="gap:3px"><b class="small">${esc(m.title)}</b><span class="faint">${esc(m.start || '')} น. • ${esc(m.place || '')}</span>${avatarStack(attendeesOf(m.meeting_id), 24, 6)}${mineM ? '<span class="tag gold" style="align-self:flex-start">คุณต้องเข้า</span>' : ''}</span></a>`; }).join('') : '<span class="faint">ไม่มีประชุมที่กำลังจะมาถึง</span>'}
      </section>
      ${fuelCard()}`;
  }

  builder($('#h-builder'), all, app);

  $('#h-year').onchange = (e) => { ui.year = Number(e.target.value); view(main, arg, app); };
  $('#h-unit').onchange = (e) => { ui.unit = e.target.value; view(main, arg, app); };
  $('#h-office').onchange = (e) => { ui.office = e.target.value; view(main, arg, app); };
  on(main, '#h-type button', 'click', (e, b) => { ui.type = b.dataset.v; view(main, arg, app); });
  on(main, '#h-measure button', 'click', (e, b) => { ui.measure = b.dataset.v; view(main, arg, app); });
  $('#h-export').onclick = () => exportYear(yearPlans);
  if (window.innerWidth < 900) $('#h-main').style.gridTemplateColumns = '1fr';
}

function kpi(l, v, s, bg, ink) { return `<a class="kpi" href="${isGuest() ? '#/home' : '#/plans'}" style="background:${bg};color:${ink}"><span class="l">${esc(l)}</span><span class="v">${esc(v)}</span><span class="s">${esc(s)}</span></a>`; }

function fuelCard() {
  const rows = S.db.Fuel || [];
  if (!rows.length) return '';
  const last = rows.reduce((m, r) => (r.date > m ? r.date : m), '');
  const p = rows.filter((r) => r.date === last && r.province === (rows[0].province));
  return `<a class="card row" href="#/fuel" style="color:var(--ink)"><span class="grow"><span class="faint">ราคาน้ำมัน ${esc(p[0] ? p[0].province : '')} • ${thDate(last)}</span><br>${p.map((x) => `${esc(x.fuel)} <b style="font-family:var(--head);font-size:18px;font-weight:500">${Number(x.price).toFixed(2)}</b>`).join(' • ')}</span>${icon('chev', 16)}</a>`;
}

function drill(unit, yearPlans) {
  const l = yearPlans.filter((p) => p.unit === unit), ST = statuses();
  const cats = offices().map((o) => { const x = l.filter((p) => p.office === o.short); return x.length ? { key: o.short, label: o.short, values: ST.map((s) => x.filter((p) => p.status === s.status_code).length) } : null; }).filter(Boolean);
  const sent = l.filter((p) => p.sent).length;
  modal(`${modalHead(unit + ' • ' + l.length + ' แผน', 'งบหลังปรับลด ' + mil(l.reduce((a, p) => a + p.budget_cut, 0)) + ' ลบ. • ส่งแล้ว ' + sent + '/' + l.length)}
    ${chart({ cats, series: ST.map((s) => ({ label: s.name, color: s.color })), type: 'hbar', unit: 'แผน' })}
    <div class="dlg-foot"><button class="btn" data-dismiss>ปิด</button>${isGuest() ? '' : `<a class="btn pri" href="#/plans" data-dismiss onclick="sessionStorage.setItem('plan-unit',${esc(JSON.stringify(unit))})">เปิดทะเบียนแผนของ ${esc(unit)}</a>`}</div>`, { wide: true });
}

async function exportYear(rows) {
  try { await loadXLSX(); } catch (e) { return toast(e.message, 'err'); }
  const data = rows.map((p) => ({ ปีงบ: p.fiscal_year, หน่วยงาน: p.unit, สำนัก: p.office, รหัสงาน: p.work_code, ชื่องาน: p.work_name, สายทาง: p.segs.map((s) => s.road).join(', '), 'งบที่ได้รับ': p.budget, 'หลังปรับลด': p.budget_cut, สถานะ: p.st.name, 'ส่งกลับแก้ (รอบ)': p.rounds, เลยกำหนด: p.late ? 'ใช่' : '' }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'สถานะแผน');
  XLSX.writeFile(wb, `สถานะแผน_ปีงบ${rows[0] ? rows[0].fiscal_year : ''}.xlsx`);
}

/* ---------- กราฟสร้างเอง ---------- */
function builder(box, all, app) {
  const cb = ui.cb, ST = statuses(), years = planYears().slice().sort();
  const METRICS = [['count', 'จำนวนแผน', 'แผน', 1], ['budget', 'งบประมาณที่ได้รับ', 'ลบ.', 1], ['cut', 'วงเงินหลังปรับลด', 'ลบ.', 1], ['reduced', 'ยอดที่ถูกปรับลด', 'ลบ.', 1], ['avg', 'วงเงินเฉลี่ยต่อแผน', 'ลบ.', 0], ['segs', 'จำนวนช่วงสายทาง', 'ช่วง', 1], ['length', 'ระยะทางรวม', 'กม.', 1], ['rounds', 'รอบส่งกลับแก้ไข', 'รอบ', 1], ['pctSent', '% ส่งแล้ว', '%', 0], ['pctOk', '% กรมเห็นชอบ', '%', 0]];
  const DIMS = [['year', 'ปีงบประมาณ'], ['unit', 'หน่วยงาน'], ['office', 'สำนัก'], ['status', 'สถานะ']];
  const M = METRICS.find((m) => m[0] === cb.metric) || METRICS[0];
  const pool = all.filter((p) => cb.years[p.fiscal_year] && (cb.unit === 'all' || p.unit === cb.unit) && (cb.office === 'all' || p.office === cb.office) && (cb.status === 'all' || p.status === cb.status));
  const keys = (d) => d === 'year' ? years.filter((y) => cb.years[y]).map((y) => ({ k: y, label: 'ปีงบ ' + y })) : d === 'unit' ? units().map((u) => ({ k: u.name, label: u.name })) : d === 'office' ? offices().map((o) => ({ k: o.short, label: o.short })) : d === 'status' ? ST.map((s) => ({ k: s.status_code, label: s.name, color: s.color })) : [{ k: '*', label: M[1] }];
  const val = (p, d) => d === 'year' ? p.fiscal_year : d === 'unit' ? p.unit : d === 'office' ? p.office : d === 'status' ? p.status : '*';
  const meas = (l) => {
    if (!l.length) return 0;
    switch (cb.metric) {
      case 'count': return l.length; case 'budget': return l.reduce((a, p) => a + p.budget, 0) / 1e6; case 'cut': return l.reduce((a, p) => a + p.budget_cut, 0) / 1e6;
      case 'reduced': return l.reduce((a, p) => a + (p.budget - p.budget_cut), 0) / 1e6; case 'avg': return l.reduce((a, p) => a + p.budget_cut, 0) / 1e6 / l.length;
      case 'segs': return l.reduce((a, p) => a + p.segs.length, 0); case 'length': return l.reduce((a, p) => a + p.length_km, 0); case 'rounds': return l.reduce((a, p) => a + p.rounds, 0);
      case 'pctSent': return (l.filter((p) => p.sent).length / l.length) * 100; case 'pctOk': return (l.filter((p) => p.st.dash_group === 'กรมเห็นชอบ').length / l.length) * 100;
    }
    return 0;
  };
  const fmt = (v) => (['แผน', 'ช่วง', 'รอบ'].includes(M[2]) ? Math.round(v).toLocaleString() : M[2] === '%' ? v.toFixed(0) + '%' : v.toFixed(1));
  const split = cb.split === cb.group ? 'none' : cb.split;
  const PAL = ['#4A6B42', '#6585A6', '#D3A04A', '#9A7A9C', '#5A9585', '#C66B3D', '#A39C88'], YP = ['#C9C1AE', '#9DB08F', '#4A6B42', '#2F4A2B', '#D3A04A', '#6585A6'];
  const sers = keys(split).map((s, i) => ({ k: s.k, label: s.label, color: split === 'none' ? '#5E7356' : split === 'status' ? s.color : split === 'year' ? YP[i % 6] : PAL[i % 7] }));
  const cats = keys(cb.group).map((c, ci) => {
    const inC = pool.filter((p) => val(p, cb.group) === c.k);
    if (!inC.length) return null;
    const parts = sers.map((s) => inC.filter((p) => split === 'none' || val(p, split) === s.k));
    return { key: c.k, label: c.label, color: c.color || (cb.group === 'year' ? YP[ci % 6] : PAL[ci % 7]), values: parts.map(meas), tips: parts.map((x) => `${M[1]} ${fmt(meas(x))}${M[2] === '%' ? '' : ' ' + M[2]} • ${x.length} แผน`) };
  }).filter(Boolean);
  const sel = (id, opts, v) => `<select class="inp" id="${id}" style="height:40px">${opts.map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  box.innerHTML = `
    <div class="row wrap"><div class="grow"><h2 style="margin:0">เปรียบเทียบทั้งเขต • สร้างกราฟเอง</h2><span class="muted small">${esc(M[1])} แบ่งตาม${esc(DIMS.find((d) => d[0] === cb.group)[1])}${split !== 'none' ? ' แยกสีตาม' + esc(DIMS.find((d) => d[0] === split)[1]) : ''}</span></div>
      <button class="btn sm" id="cb-reset">ค่าเริ่มต้น</button></div>
    <div class="fgrid" style="background:var(--soft);border-radius:20px;padding:14px">
      <label class="f">ค่าที่วัด (แกน Y)${sel('cb-metric', METRICS.map((m) => [m[0], m[1] + ' (' + m[2] + ')']), cb.metric)}</label>
      <label class="f">แบ่งตาม (แกน X)${sel('cb-group', DIMS, cb.group)}</label>
      <label class="f">แยกสีตาม${sel('cb-split', [['none', 'ไม่แยก']].concat(DIMS), cb.split)}</label>
      <div class="f" style="grid-column:span 2">รูปแบบกราฟ<div class="seg-ctl" id="cb-type" style="align-self:flex-start">${[['col', 'แท่งแนวตั้ง'], ['stack', 'แท่งซ้อน'], ['hbar', 'แท่งแนวนอน'], ['line', 'เส้น'], ['donut', 'วงกลม'], ['table', 'ตาราง']].map((t) => `<button data-v="${t[0]}" class="${cb.type === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div></div>
    </div>
    <div class="row wrap small">
      <span class="muted">ปีงบ</span>${years.map((y) => `<button class="chip ${cb.years[y] ? 'on' : ''}" data-y="${y}">${y}</button>`).join('')}
      <label class="row muted">หน่วยงาน ${sel('cb-unit', [['all', 'ทั้งเขต']].concat(units().map((u) => [u.name, u.name])), cb.unit)}</label>
      <label class="row muted">สำนัก ${sel('cb-office', [['all', 'ทุกสำนัก']].concat(offices().map((o) => [o.short, o.short])), cb.office)}</label>
      <label class="row muted">สถานะ ${sel('cb-status', [['all', 'ทุกสถานะ']].concat(ST.map((s) => [s.status_code, s.name])), cb.status)}</label>
    </div>
    <div id="cb-chart"></div>
    <span class="faint">${!M[3] && (cb.type === 'stack' || cb.type === 'donut') ? '"' + esc(M[1]) + '" รวมกันไม่ได้ จึงแสดงเป็นแท่งเปรียบเทียบ • ' : ''}${pool.length} แผนจากทะเบียนแผน • ข้อมูลชุดเดียวกับทุกหน้า</span>`;
  $('#cb-chart', box).innerHTML = chart({ cats: cb.type === 'donut' ? cats.map((c) => ({ ...c, values: [c.values.reduce((a, b) => a + b, 0)] })) : cats, series: sers, type: cb.type, fmt, additive: !!M[3], unit: M[2] });
  const rerender = () => builder(box, all, app);
  ['metric', 'group', 'split', 'unit', 'office', 'status'].forEach((k) => ($('#cb-' + k, box).onchange = (e) => { cb[k] = e.target.value; rerender(); }));
  on(box, '#cb-type button', 'click', (e, b) => { cb.type = b.dataset.v; rerender(); });
  on(box, '[data-y]', 'click', (e, b) => { cb.years[b.dataset.y] = !cb.years[b.dataset.y]; rerender(); });
  $('#cb-reset', box).onclick = () => { ui.cb = cbDefault(); builder(box, all, app); };
}
// ใช้ในหน้าอื่น
export { orderDone, assigneesOf, money };
