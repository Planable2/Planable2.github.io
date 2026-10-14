// ===== เมนูเพิ่มเติม (มือถือ) + ราคาน้ำมัน =====
import { S, isAdmin, pendingFiles, pendingUsers } from '../store.js';
import { DEMO } from '../api.js';
import { CONFIG } from '../config.js';
import { esc, $, on, thDate, uniq, iso, today, toDate, by } from '../util.js';
import { avatar, icon, empty } from '../ui.js';

export function more(main, arg, app) {
  const u = S.user, pf = pendingFiles().length, pu = isAdmin() ? pendingUsers().length : 0;
  main.innerHTML = `
  <a class="card row" href="#/profile" style="background:var(--green);color:#FFFEFB">${avatar(u, 58)}<span class="col grow" style="gap:2px"><b style="font-family:var(--head);font-size:18px;font-weight:500">${esc(u.full_name)}</b><span class="small" style="color:#C7CDB8">${esc(u.position)} • ${esc(u.role)}${u.is_admin === true ? ' • แอดมิน' : ''}</span></span><span class="small" style="color:var(--gold)">โปรไฟล์ ›</span></a>
  <section class="card flush morelist">
    <a href="#/files"><span class="ic">${icon('file')}</span><span class="grow"><b>คลังเอกสาร</b><br><span class="faint">ไฟล์จากกลุ่ม LINE${pf ? ' • รอจัดหมวด ' + pf : ''}</span></span>${pf ? `<span class="badge">${pf}</span>` : ''}${icon('chev', 16)}</a>
    <a href="#/prices"><span class="ic">${icon('fuel')}</span><span class="grow"><b>ราคาวัสดุ</b><br><span class="faint">น้ำมัน • ยางแอสฟัลต์ • วัสดุจากแหล่ง • คอนกรีต/ปูน</span></span>${icon('chev', 16)}</a>
    <a href="#/people"><span class="ic">${icon('users')}</span><span class="grow"><b>บุคลากร</b><br><span class="faint">โครงสร้างส่วน${pu ? ' • รอยืนยันตัวตน ' + pu : ''}</span></span>${pu ? `<span class="badge">${pu}</span>` : ''}${icon('chev', 16)}</a>
    ${isAdmin() ? `<a href="#/settings"><span class="ic">${icon('gear')}</span><span class="grow"><b>ตั้งค่าระบบ</b><br><span class="faint">เฉพาะผู้ดูแลระบบ • แนะนำใช้บนคอมพิวเตอร์</span></span>${icon('chev', 16)}</a>` : ''}
  </section>
  <button class="btn danger block" id="mo-out">${icon('out', 16)}ออกจากระบบ</button>
  <p class="faint center">${esc(CONFIG.APP_NAME)}${DEMO ? ' • โหมดสาธิต' : ''} • ติดตั้งเป็นแอปได้จากเมนูเบราว์เซอร์ "เพิ่มลงหน้าจอหลัก"</p>`;
  $('#mo-out').onclick = () => app.logout();
}

export function fuel(main, head = '') {
  const rows = S.db.Fuel || [];
  if (!rows.length) { main.innerHTML = `${head}<h1>ราคาน้ำมัน</h1>${empty('ยังไม่มีข้อมูล — ระบบดึงราคาจาก PTT OR ให้อัตโนมัติทุกเช้า')}`; return; }
  const dates = uniq(rows.map((r) => r.date)).sort(), last = dates[dates.length - 1], prev = dates[dates.length - 2];
  const provs = uniq(rows.map((r) => r.province)), fuels = uniq(rows.map((r) => r.fuel));
  const price = (d, p, f) => { const r = rows.find((x) => x.date === d && x.province === p && x.fuel === f); return r ? Number(r.price) : null; };
  const chip = (v) => (v === null || isNaN(v) ? '' : v === 0 ? '<span class="tag">คงที่</span>' : `<span class="tag ${v > 0 ? 'red' : 'green'}">${v > 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}</span>`);

  // ช่วงเวลากราฟ: ค่าเริ่มต้น = ต้นเดือนนี้ ถึงวันนี้
  const end = iso(today()) > last ? iso(today()) : last;
  const range = (k) => { if (k === 'all') return { from: dates[0], to: end }; const s = toDate(end); if (k === 'm') s.setDate(1); else s.setMonth(s.getMonth() - 3); return { from: iso(s), to: end }; };
  const ui = main._fuel || (main._fuel = { prov: provs[0], ...range('m') });
  if (!provs.includes(ui.prov)) ui.prov = provs[0];
  const from = ui.from <= ui.to ? ui.from : ui.to, to = ui.from <= ui.to ? ui.to : ui.from;

  // PTT OR บันทึกเฉพาะวันที่ราคาเปลี่ยน → ต่อเส้นระหว่างจุด และลากราคาก่อนช่วงมาเป็นจุดเริ่ม
  const series = fuels.map((f, i) => {
    const pts = rows.filter((r) => r.province === ui.prov && r.fuel === f).sort(by('date'));
    const before = pts.filter((r) => r.date <= from).pop();
    const steps = (before ? [{ date: from, v: Number(before.price) }] : []).concat(pts.filter((r) => r.date > from && r.date <= to).map((r) => ({ date: r.date, v: Number(r.price) })));
    return { f, color: ['#4A6B42', '#C66B3D', '#6585A6'][i % 3], steps, dots: pts.filter((r) => r.date >= from && r.date <= to) };
  });
  const vals = series.flatMap((s) => s.steps.map((p) => p.v)), has = vals.length > 0;
  const mn = Math.min(...vals) - 0.3, mx = Math.max(...vals) + 0.3;
  const x0 = toDate(from).getTime(), span = Math.max(864e5, toDate(to).getTime() - x0);
  const X = (d) => ((toDate(d).getTime() - x0) / span) * 1000, Y = (v) => 200 - ((v - mn) / (mx - mn)) * 200;
  const path = (s) => s.steps.length ? `M${X(s.steps[0].date).toFixed(1)},${Y(s.steps[0].v).toFixed(1)}` + s.steps.slice(1).map((p) => `L${X(p.date).toFixed(1)},${Y(p.v).toFixed(1)}`).join('') + `L1000,${Y(s.steps[s.steps.length - 1].v).toFixed(1)}` : '';
  const mid = iso(new Date(x0 + span / 2));
  const presetOn = (k) => { const r = range(k); return r.from === ui.from && r.to === ui.to; };
  main.innerHTML = `${head}
  <div class="page-head"><div class="t"><h1>ราคาน้ำมันรายจังหวัด</h1><span class="muted small">บาท/ลิตร • ณ ${thDate(last)} • แหล่ง ${esc(rows[rows.length - 1].source || 'PTT OR')} • เทียบวันก่อนหน้า</span></div><a class="btn" href="https://www.pttor.com/th/oil_price" target="_blank" rel="noopener">${icon('ext', 16)}เว็บ PTT OR</a></div>
  <section class="card flush scroll-x"><table class="tbl"><thead><tr><th style="padding-left:18px">จังหวัด</th>${fuels.map((f) => `<th class="r">${esc(f)}</th>`).join('')}</tr></thead>
    <tbody>${provs.map((p) => `<tr><td style="padding-left:18px"><b>${esc(p)}</b></td>${fuels.map((f) => { const v = price(last, p, f), o = prev ? price(prev, p, f) : null; return `<td class="r"><b style="font-family:var(--head);font-size:21px;font-weight:500">${v === null ? '—' : v.toFixed(2)}</b><br>${chip(v !== null && o !== null ? +(v - o).toFixed(2) : null)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></section>
  <section class="card col" style="gap:12px">
    <div class="row wrap"><h2 class="grow" style="margin:0">แนวโน้มราคา</h2><select class="inp" id="fu-prov" style="width:auto;height:38px" aria-label="จังหวัด">${provs.map((p) => `<option ${p === ui.prov ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
    <div class="row wrap" style="gap:10px;align-items:flex-end">
      <label class="f" style="flex:0 1 170px">ตั้งแต่วันที่<input class="inp" type="date" id="fu-from" value="${esc(ui.from)}"></label>
      <label class="f" style="flex:0 1 170px">ถึงวันที่<input class="inp" type="date" id="fu-to" value="${esc(ui.to)}"></label>
      <div class="row wrap" style="gap:6px;padding-bottom:4px">${[['m', 'เดือนนี้'], ['3m', '3 เดือน'], ['all', 'ทั้งหมด']].map(([k, l]) => `<button class="chip ${presetOn(k) ? 'on' : ''}" data-r="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.f)}</span>`).join('')}</div>
    ${has ? `<div style="position:relative;height:220px">
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true">${series.map((s) => `<path d="${path(s)}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('')}</svg>
      ${series.map((s) => s.dots.map((r) => `<span data-tip="${esc(s.f + ' • ' + thDate(r.date) + '|' + Number(r.price).toFixed(2) + ' บาท/ลิตร')}" style="position:absolute;left:${(X(r.date) / 10).toFixed(2)}%;bottom:${(((Number(r.price) - mn) / (mx - mn)) * 100).toFixed(2)}%;width:10px;height:10px;margin:0 0 -5px -5px;border-radius:50%;background:${s.color}"></span>`).join('')).join('')}</div>
    <div class="row faint"><span class="grow">${thDate(from)}</span><span class="grow center">${thDate(mid)}</span><span>${thDate(to)}</span></div>
    <span class="faint small">จุด = วันที่ราคาเปลี่ยน</span>` : empty('ไม่มีข้อมูลราคาในช่วงวันที่นี้')}</section>`;
  $('#fu-prov').onchange = (e) => { ui.prov = e.target.value; fuel(main, head); };
  $('#fu-from').onchange = (e) => { if (e.target.value) { ui.from = e.target.value; fuel(main, head); } };
  $('#fu-to').onchange = (e) => { if (e.target.value) { ui.to = e.target.value; fuel(main, head); } };
  on(main, '[data-r]', 'click', (e, b) => { Object.assign(ui, range(b.dataset.r)); fuel(main, head); });
}
