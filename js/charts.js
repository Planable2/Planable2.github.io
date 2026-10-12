// ===== กราฟแบบ HTML/CSS (ไม่ใช้ไลบรารี) — ชี้เมาส์ดูตัวเลขผ่าน data-tip =====
import { esc } from './util.js';

const nice = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
const grid = (max, fmt) => [0.25, 0.5, 0.75, 1].map((f) => `<div class="gridl" style="bottom:${f * 100}%"><span>${esc(fmt(max * f))}</span></div>`).join('');

/**
 * cats: [{label, key, values:[n per series], tips:[string per series]}]
 * series: [{label, color}]
 * type: col | stack | hbar | line | donut | table | prog
 */
export function chart({ cats, series, type, fmt = (v) => String(Math.round(v)), additive = true, unit = '', onCat }) {
  if (!cats.length) return '<div class="empty">ไม่มีข้อมูลตามตัวกรองนี้</div>';
  const tot = (c) => c.values.reduce((a, b) => a + b, 0);
  if (!additive && (type === 'stack' || type === 'donut')) type = 'col';
  const legend = `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>`;
  const tipAttr = (c, i) => `data-tip="${esc(c.label + (series.length > 1 ? ' • ' + series[i].label : '') + '|' + (c.tips ? c.tips[i] : fmt(c.values[i]) + ' ' + unit))}"`;
  const click = (c) => (onCat ? `data-cat="${esc(c.key)}"` : '');

  if (type === 'donut') {
    const sum = cats.reduce((a, c) => a + tot(c), 0); let acc = 0;
    const colors = cats.map((c, i) => c.color || ['#4A6B42', '#6585A6', '#D3A04A', '#9A7A9C', '#5A9585', '#C66B3D', '#A39C88', '#C9C1AE'][i % 8]);
    const bg = sum ? `conic-gradient(${cats.map((c, i) => { const f = (acc / sum) * 360; acc += tot(c); return `${colors[i]} ${f.toFixed(2)}deg ${((acc / sum) * 360).toFixed(2)}deg`; }).join(',')})` : 'var(--soft2)';
    return `<div class="row wrap" style="justify-content:center;gap:34px;padding:8px 0"><div class="donut" style="background:${bg}"><div><b style="font-family:var(--head);font-size:26px;font-weight:500">${esc(fmt(sum))}</b><span class="faint">${esc(unit)}</span></div></div>
      <div class="col" style="min-width:230px;gap:8px">${cats.map((c, i) => `<div class="row small" ${click(c)} data-tip="${esc(c.label + '|' + fmt(tot(c)) + ' ' + unit + ' (' + (sum ? Math.round((tot(c) / sum) * 100) : 0) + '%)')}"><i style="width:12px;height:12px;border-radius:3px;background:${colors[i]}"></i><span class="grow">${esc(c.label)}</span><b class="num">${esc(fmt(tot(c)))}</b><span class="faint" style="width:40px;text-align:right">${sum ? Math.round((tot(c) / sum) * 100) : 0}%</span></div>`).join('')}</div></div>`;
  }
  if (type === 'table') {
    return `<div class="scroll-x"><table class="tbl num"><thead><tr><th>รายการ</th>${series.map((s) => `<th class="r">${esc(s.label)}</th>`).join('')}${additive && series.length > 1 ? '<th class="r">รวม</th>' : ''}</tr></thead><tbody>
      ${cats.map((c) => `<tr><td><b>${esc(c.label)}</b></td>${c.values.map((v) => `<td class="r">${esc(fmt(v))}</td>`).join('')}${additive && series.length > 1 ? `<td class="r"><b>${esc(fmt(tot(c)))}</b></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  }
  if (type === 'prog') {   // ค่า 0–100 ต่อหมวด (ใช้ค่าแรก)
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">${cats.map((c) => { const p = Math.max(0, Math.min(100, Math.round(c.values[0]))); return `<button class="card" style="border:1px solid var(--line2);display:flex;flex-direction:column;align-items:center;gap:8px" ${click(c)} ${tipAttr(c, 0)}><div class="ring" style="background:conic-gradient(#46703F 0deg ${p * 3.6}deg,#EEE8DC ${p * 3.6}deg 360deg)"><div>${p}%</div></div><b class="small">${esc(c.label)}</b><span class="faint">${esc(c.sub || '')}</span></button>`; }).join('')}</div>`;
  }
  const maxCell = Math.max(...cats.flatMap((c) => c.values), 0), maxTot = Math.max(...cats.map(tot), 0);
  const max = unit === '%' ? 100 : nice(((type === 'stack' || (type === 'hbar' && additive)) ? maxTot : maxCell) * 1.05);
  if (type === 'hbar') {
    return legend + `<div class="bars-h col" style="gap:4px;margin-top:10px">${cats.map((c) => `<div class="r" ${click(c)}><b class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.label)}</b>
      ${additive ? `<div class="track">${c.values.map((v, i) => `<span style="flex-grow:${v};flex-basis:0;display:${v ? 'block' : 'none'};background:${series[i].color}" ${tipAttr(c, i)}></span>`).join('')}<span style="flex-grow:${Math.max(0, max - tot(c))};flex-basis:0;background:transparent"></span></div>`
        : `<div class="col" style="gap:3px">${c.values.map((v, i) => `<div class="track" style="height:10px"><span style="width:${(v / max) * 100}%;background:${series[i].color}" ${tipAttr(c, i)}></span></div>`).join('')}</div>`}
      <span class="small muted right num">${esc(c.sub || fmt(additive ? tot(c) : c.values[0]) + ' ' + unit)}</span></div>`).join('')}</div>`;
  }
  if (type === 'line') {
    const n = cats.length;
    const lines = series.map((s, si) => `<svg viewBox="0 0 1000 260" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" aria-hidden="true"><polyline fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="${cats.map((c, ci) => `${(((ci + 0.5) / n) * 1000).toFixed(1)},${(260 - (c.values[si] / max) * 260).toFixed(1)}`).join(' ')}"/></svg>`).join('');
    const dots = series.map((s, si) => cats.map((c, ci) => `<span ${tipAttr(c, si)} style="position:absolute;left:${(((ci + 0.5) / n) * 100).toFixed(2)}%;bottom:${((c.values[si] / max) * 100).toFixed(2)}%;width:12px;height:12px;margin:0 0 -6px -6px;border-radius:50%;background:${s.color};border:2px solid #fff;z-index:2"></span>`).join('')).join('');
    return legend + `<div class="bars-v" style="margin-top:14px">${grid(max, fmt)}${lines}${dots}</div><div class="xl">${cats.map((c) => `<span title="${esc(c.label)}">${esc(c.label)}</span>`).join('')}</div>`;
  }
  // col / stack
  return legend + `<div class="bars-v" style="margin-top:14px">${grid(max, fmt)}${cats.map((c) => type === 'stack'
    ? `<div class="c" ${click(c)}><div class="col" style="width:100%;align-items:center;gap:4px"><span class="faint">${esc(fmt(tot(c)))}</span><div class="stk">${c.values.map((v, i) => `<span style="height:${(v / max) * 236}px;background:${series[i].color};display:${v ? 'block' : 'none'}" ${tipAttr(c, i)}></span>`).join('')}</div></div></div>`
    : `<div class="c" ${click(c)}>${c.values.map((v, i) => `<span class="b" style="height:${max ? Math.max(v > 0 ? 1 : 0, (v / max) * 100) : 0}%;background:${series[i].color}" ${tipAttr(c, i)}></span>`).join('')}</div>`).join('')}</div>
    <div class="xl">${cats.map((c) => `<span title="${esc(c.label)}">${esc(c.label)}</span>`).join('')}</div>`;
}
