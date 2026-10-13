// ===== เมนูเพิ่มเติม (มือถือ) + ราคาน้ำมัน =====
import { S, isAdmin, pendingFiles, pendingUsers, setting } from '../store.js';
import { DEMO } from '../api.js';
import { esc, $, on, thDate, uniq } from '../util.js';
import { avatar, icon, empty } from '../ui.js';

export function more(main, arg, app) {
  const u = S.user, pf = pendingFiles().length, pu = isAdmin() ? pendingUsers().length : 0;
  main.innerHTML = `
  <a class="card row" href="#/profile" style="background:var(--green);color:#FFFEFB">${avatar(u, 58)}<span class="col grow" style="gap:2px"><b style="font-family:var(--head);font-size:18px;font-weight:500">${esc(u.full_name)}</b><span class="small" style="color:#C7CDB8">${esc(u.position)} • ${esc(u.role)}${u.is_admin === true ? ' • แอดมิน' : ''}</span></span><span class="small" style="color:var(--gold)">โปรไฟล์ ›</span></a>
  <section class="card flush morelist">
    <a href="#/files"><span class="ic">${icon('file')}</span><span class="grow"><b>คลังเอกสาร</b><br><span class="faint">ไฟล์จากกลุ่ม LINE${pf ? ' • รอจัดหมวด ' + pf : ''}</span></span>${pf ? `<span class="badge">${pf}</span>` : ''}${icon('chev', 16)}</a>
    <a href="#/fuel"><span class="ic">${icon('fuel')}</span><span class="grow"><b>ราคาน้ำมัน</b><br><span class="faint">${esc(setting('fuel_provinces', ''))}</span></span>${icon('chev', 16)}</a>
    <a href="#/people"><span class="ic">${icon('users')}</span><span class="grow"><b>บุคลากร</b><br><span class="faint">โครงสร้างฝ่าย${pu ? ' • รอยืนยันตัวตน ' + pu : ''}</span></span>${pu ? `<span class="badge">${pu}</span>` : ''}${icon('chev', 16)}</a>
    <a href="#/leaves"><span class="ic">${icon('cal')}</span><span class="grow"><b>ปฏิทินวันลา</b><br><span class="faint">บันทึกวันลาของตัวเอง</span></span>${icon('chev', 16)}</a>
    ${isAdmin() ? `<a href="#/settings"><span class="ic">${icon('gear')}</span><span class="grow"><b>ตั้งค่าระบบ</b><br><span class="faint">เฉพาะผู้ดูแลระบบ • แนะนำใช้บนคอมพิวเตอร์</span></span>${icon('chev', 16)}</a>` : ''}
  </section>
  <button class="btn danger block" id="mo-out">${icon('out', 16)}ออกจากระบบ</button>
  <p class="faint center">ระบบงานฝ่ายแผนงาน${DEMO ? ' • โหมดสาธิต' : ''} • ติดตั้งเป็นแอปได้จากเมนูเบราว์เซอร์ "เพิ่มลงหน้าจอหลัก"</p>`;
  $('#mo-out').onclick = () => app.logout();
}

export function fuel(main) {
  const rows = S.db.Fuel || [];
  if (!rows.length) { main.innerHTML = `<h1>ราคาน้ำมัน</h1>${empty('ยังไม่มีข้อมูล — โปรแกรม Windows ราคาน้ำมันจะส่งราคาเข้าฐานข้อมูลทุกเช้า')}`; return; }
  const dates = uniq(rows.map((r) => r.date)).sort(), last = dates[dates.length - 1], prev = dates[dates.length - 2];
  const provs = uniq(rows.map((r) => r.province)), fuels = uniq(rows.map((r) => r.fuel));
  const price = (d, p, f) => { const r = rows.find((x) => x.date === d && x.province === p && x.fuel === f); return r ? Number(r.price) : null; };
  const chip = (v) => (v === null || isNaN(v) ? '' : v === 0 ? '<span class="tag">คงที่</span>' : `<span class="tag ${v > 0 ? 'red' : 'green'}">${v > 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}</span>`);
  const ui = main._fuel || (main._fuel = { prov: provs[0] });
  const series = fuels.map((f, i) => ({ f, color: ['#4A6B42', '#C66B3D', '#6585A6'][i % 3], pts: dates.map((d) => price(d, ui.prov, f)) }));
  const all = series.flatMap((s) => s.pts.filter((x) => x !== null)), mn = Math.min(...all) - 0.3, mx = Math.max(...all) + 0.3;
  main.innerHTML = `
  <div class="page-head"><div class="t"><h1>ราคาน้ำมันรายจังหวัด</h1><span class="muted small">บาท/ลิตร • ณ ${thDate(last)} • แหล่ง ${esc(rows[rows.length - 1].source || 'PTT OR')} • เทียบวันก่อนหน้า</span></div><a class="btn" href="https://www.pttor.com/th/oil_price" target="_blank" rel="noopener">${icon('ext', 16)}เว็บ PTT OR</a></div>
  <section class="card flush scroll-x"><table class="tbl"><thead><tr><th style="padding-left:18px">จังหวัด</th>${fuels.map((f) => `<th class="r">${esc(f)}</th>`).join('')}</tr></thead>
    <tbody>${provs.map((p) => `<tr><td style="padding-left:18px"><b>${esc(p)}</b></td>${fuels.map((f) => { const v = price(last, p, f), o = prev ? price(prev, p, f) : null; return `<td class="r"><b style="font-family:var(--head);font-size:21px;font-weight:500">${v === null ? '—' : v.toFixed(2)}</b><br>${chip(v !== null && o !== null ? +(v - o).toFixed(2) : null)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></section>
  <section class="card col" style="gap:10px"><div class="row wrap"><h2 class="grow" style="margin:0">แนวโน้ม ${dates.length} วัน</h2><select class="inp" id="fu-prov" style="width:auto;height:38px">${provs.map((p) => `<option ${p === ui.prov ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
    <div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.f)}</span>`).join('')}</div>
    <div style="position:relative;height:200px">${series.map((s) => `<svg viewBox="0 0 1000 200" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true"><polyline fill="none" stroke="${s.color}" stroke-width="3" vector-effect="non-scaling-stroke" points="${s.pts.map((v, i) => v === null ? '' : `${((i / Math.max(1, dates.length - 1)) * 1000).toFixed(1)},${(200 - ((v - mn) / (mx - mn)) * 200).toFixed(1)}`).filter(Boolean).join(' ')}"/></svg>`).join('')}
      ${series.map((s) => s.pts.map((v, i) => v === null ? '' : `<span data-tip="${esc(s.f + ' • ' + thDate(dates[i]) + '|' + v.toFixed(2) + ' บาท/ลิตร')}" style="position:absolute;left:${((i / Math.max(1, dates.length - 1)) * 100).toFixed(2)}%;bottom:${(((v - mn) / (mx - mn)) * 100).toFixed(2)}%;width:10px;height:10px;margin:0 0 -5px -5px;border-radius:50%;background:${s.color}"></span>`).join('')).join('')}</div>
    <div class="row faint"><span class="grow">${thDate(dates[0])}</span><span>${thDate(last)}</span></div></section>`;
  $('#fu-prov').onchange = (e) => { ui.prov = e.target.value; fuel(main); };
}
