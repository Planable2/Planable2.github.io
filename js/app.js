// ===== จุดเริ่มแอป: เข้าสู่ระบบ, เมนู, เปลี่ยนหน้า =====
import { CONFIG } from './config.js';
import { call, token, DEMO } from './api.js';
import { S, load, isGuest, isAdmin, can, myOpenOrders, pendingFiles, pendingUsers, invalidate } from './store.js';
import { esc, $, $$, on } from './util.js';
import { icon, avatar, toast, closeModal } from './ui.js';
import { loginView } from './views/login.js';
import * as Home from './views/home.js';
import * as Plans from './views/plans.js';
import * as Meetings from './views/meetings.js';
import * as Leaves from './views/leaves.js';
import * as Orders from './views/orders.js';
import * as Files from './views/files.js';
import * as People from './views/people.js';
import * as Settings from './views/settings.js';
import * as Misc from './views/misc.js';

const ROUTES = {
  home: { mod: Home, title: 'หน้าแรก', nav: 'home', guest: true },
  plans: { mod: Plans, title: 'ทะเบียนแผน', nav: 'plans' },
  plan: { mod: Plans, fn: 'detail', title: 'รายละเอียดแผน', nav: 'plans' },
  meetings: { mod: Meetings, title: 'ปฏิทินประชุม', nav: 'meetings' },
  leaves: { mod: Leaves, title: 'ปฏิทินวันลา', nav: 'leaves' },
  orders: { mod: Orders, title: 'งานสั่งการ', nav: 'orders' },
  files: { mod: Files, title: 'คลังเอกสาร', nav: 'files' },
  fuel: { mod: Misc, fn: 'fuel', title: 'ราคาน้ำมัน', nav: 'fuel' },
  people: { mod: People, title: 'บุคลากร', nav: 'people' },
  profile: { mod: People, fn: 'profile', title: 'โปรไฟล์ของฉัน', nav: 'profile' },
  settings: { mod: Settings, title: 'ตั้งค่าระบบ', nav: 'settings', admin: true },
  more: { mod: Misc, fn: 'more', title: 'เพิ่มเติม', nav: 'more' }
};

export const app = {
  go: (h) => { if (location.hash === '#/' + h) render(); else location.hash = '#/' + h; },
  refresh: () => { invalidate(); render(); },
  async reload() { const d = await call('bootstrap'); load(d); invalidate(); render(); },
  logout
};

async function boot() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('hashchange', () => { closeModal(); render(); });
  setupTip();
  if (token.get()) {
    try { load(await call('bootstrap')); return render(); } catch (e) { if (!e.auth) { showFatal(e); return; } token.set(''); }
  }
  showLogin();
}

function showLogin() {
  $('#app').innerHTML = '';
  loginView($('#app'), async (res) => { token.set(res.token); load(await call('bootstrap')); location.hash = '#/home'; render(); });
}

async function logout() {
  try { await call('logout'); } catch (e) {}
  token.set(''); S.user = null;
  try { if (window.liff && CONFIG.LIFF_ID && liff.isLoggedIn && liff.isLoggedIn()) liff.logout(); } catch (e) {}
  location.hash = '';
  showLogin();
}

function showFatal(e) {
  $('#app').innerHTML = `<div class="loading"><div class="col center"><b>เชื่อมต่อไม่สำเร็จ</b><span class="muted">${esc(e.message)}</span><button class="btn" onclick="location.reload()">ลองใหม่</button></div></div>`;
}

function parseHash() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  return { name: parts[0], arg: decodeURIComponent(parts[1] || '') };
}

function render() {
  if (!S.user) return showLogin();
  let { name, arg } = parseHash();
  let r = ROUTES[name] || ROUTES.home;
  if ((isGuest() && !r.guest) || (r.admin && !isAdmin())) { r = ROUTES.home; name = 'home'; }
  shell(r);
  const main = $('#view');
  main.innerHTML = '';
  window.scrollTo({ top: 0 });
  try { (r.fn ? r.mod[r.fn] : r.mod.view)(main, arg, app); }
  catch (e) { console.error(e); main.innerHTML = `<div class="empty">เกิดข้อผิดพลาดในการแสดงหน้า: ${esc(e.message)}</div>`; }
}

function menu() {
  if (isGuest()) return [{ k: 'home', label: 'Dashboard', href: 'home', cols: [] }];
  const o = myOpenOrders().length, f = pendingFiles().length, pu = isAdmin() ? pendingUsers().length : 0;
  const m = [
    { k: 'home', label: 'หน้าแรก', href: 'home', cols: [['สำรวจ', 'big', [['ภาพรวมแผนทั้งเขต', 'home'], ['กราฟเปรียบเทียบ', 'home']]], ['ทางลัด', 'sm', [['งานสั่งการของฉัน', 'orders'], ['ประชุมที่กำลังจะมาถึง', 'meetings']]]] },
    { k: 'plans', label: 'ทะเบียนแผน', href: 'plans', cols: [['ทะเบียนแผนงาน', 'big', [['ดูทะเบียนแผน', 'plans'], ...(can('edit_plan') ? [['ลงทะเบียนแผนใหม่', 'plans/new'], ['นำเข้าจาก Excel', 'plans/import']] : [])]]] },
    { k: 'orders', label: 'งานสั่งการ', href: 'orders', badge: o, cols: [['งานสั่งการ', 'big', [['งานของฉัน', 'orders'], ...(can('record_order') ? [['บันทึกงานสั่งการ', 'orders/new']] : [])]]] },
    { k: 'meetings', label: 'ปฏิทินประชุม', href: 'meetings', cols: [['ปฏิทิน', 'big', [['ปฏิทินเดือนนี้', 'meetings'], ...(can('manage_meeting') ? [['เพิ่มประชุม', 'meetings/new']] : [])]]] },
    { k: 'leaves', label: 'ปฏิทินวันลา', href: 'leaves', cols: [['วันลา', 'big', [['ปฏิทินเดือนนี้', 'leaves'], ['ลงวันลา', 'leaves/new']]]] },
    { k: 'files', label: 'คลังเอกสาร', href: 'files', badge: f, cols: [['คลังเอกสาร', 'big', [['รอจัดหมวด', 'files'], ['เอกสารทั้งหมด', 'files/all']]]] },
    { k: 'fuel', label: 'ราคาน้ำมัน', href: 'fuel', cols: [] },
    { k: 'people', label: 'บุคลากร', href: 'people', badge: pu, cols: [['บุคลากร', 'big', [['โครงสร้างฝ่าย', 'people'], ['โปรไฟล์ของฉัน', 'profile']]]] }
  ];
  if (isAdmin()) m.push({ k: 'settings', label: 'ตั้งค่า', href: 'settings', cols: [] });
  return m;
}

function shell(r) {
  const items = menu(), me = S.user;
  const bn = isGuest() ? [] : [['home', 'หน้าแรก', 'home', 'home'], ['plans', 'แผนงาน', 'list', 'plans'], ['meetings', 'ประชุม', 'cal', 'meetings'], ['orders', 'งานสั่งการ', 'task', 'orders'], ['more', 'เพิ่มเติม', 'more', 'more']];
  const navKey = r.nav, moreKeys = ['files', 'fuel', 'people', 'profile', 'settings', 'leaves', 'more'];
  const o = myOpenOrders().length, more = isGuest() ? 0 : pendingFiles().length + (isAdmin() ? pendingUsers().length : 0);
  $('#app').innerHTML = `
  <header class="topnav" id="topnav">
    <div class="bar"><div class="inner">
      <a class="brand" href="#/home">${icon('leaf', 22)}<span>${esc(CONFIG.ORG_NAME)}</span></a>
      <nav class="tn-links" aria-label="เมนูหลัก">${items.map((m) => `<a class="tn-link ${m.k === navKey ? 'on' : ''}" href="#/${m.href}" data-k="${m.k}">${esc(m.label)}${m.badge ? `<span class="badge">${m.badge}</span>` : ''}</a>`).join('')}</nav>
      ${DEMO ? '<span class="tag gold">โหมดสาธิต</span>' : ''}
      ${isGuest() ? '<span class="tag gold">ผู้เยี่ยมชม</span>' : `<a href="#/profile" class="icon-btn" title="โปรไฟล์ของฉัน">${avatar(me, 28)}</a>`}
      <button class="icon-btn" id="btn-logout" title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon('out', 18)}</button>
    </div></div>
    <div class="fly">${items.filter((m) => m.cols.length).map((m) => `<div class="panel" data-p="${m.k}">${m.cols.map((c, ci) => `<div class="c ${c[1]}"><span class="colh">${esc(c[0])}</span>${c[2].map((l, li) => `<a href="#/${l[1]}" style="animation-delay:${ci * 60 + 30 + li * 22}ms">${esc(l[0])}</a>`).join('')}</div>`).join('')}</div>`).join('')}</div>
  </header>
  <div class="dim" id="dim"></div>
  <div class="mhead">${['home', 'plans', 'meetings', 'orders', 'more'].includes(navKey) || isGuest() ? icon('leaf', 22) : `<a class="icon-btn" href="#/more" aria-label="กลับ">${icon('back')}</a>`}<h1 class="grow">${esc(r.title)}</h1>${DEMO ? '<span class="tag gold">สาธิต</span>' : ''}${isGuest() ? `<button class="icon-btn" id="btn-logout-m" aria-label="ออกจากระบบ">${icon('out', 18)}</button>` : `<a href="#/profile">${avatar(me, 30)}</a>`}</div>
  <main class="page" id="view"></main>
  ${bn.length ? `<nav class="bottomnav" aria-label="เมนูล่าง">${bn.map((b) => { const onk = b[0] === navKey || (b[0] === 'more' && moreKeys.includes(navKey)); const badge = b[0] === 'orders' ? o : b[0] === 'more' ? more : 0; return `<a href="#/${b[3]}" class="${onk ? 'on' : ''}" ${onk ? 'aria-current="page"' : ''}><span class="pillbg">${icon(b[2])}</span>${b[1]}${badge ? `<span class="badge">${badge}</span>` : ''}</a>`; }).join('')}</nav>` : ''}`;
  const tn = $('#topnav');
  let t;
  const open = (k) => { clearTimeout(t); $$('.fly .panel', tn).forEach((p) => p.classList.toggle('on', p.dataset.p === k)); tn.classList.toggle('open', !!$(`.fly .panel[data-p="${k}"]`, tn)); };
  const close = () => { t = setTimeout(() => tn.classList.remove('open'), 80); };
  on(tn, '.tn-link', 'mouseenter', (e, el) => open(el.dataset.k));
  on(tn, '.tn-link', 'focus', (e, el) => open(el.dataset.k));
  tn.addEventListener('mouseleave', close);
  $('.fly', tn).addEventListener('mouseenter', () => clearTimeout(t));
  $('#dim').addEventListener('mouseenter', () => tn.classList.remove('open'));
  $$('.fly a', tn).forEach((a) => a.addEventListener('click', () => tn.classList.remove('open')));
  ['#btn-logout', '#btn-logout-m'].forEach((s) => { const b = $(s); if (b) b.onclick = () => logout(); });
}

/* ทูลทิปของกราฟ: data-tip="หัวเรื่อง|บรรทัด|บรรทัด" */
function setupTip() {
  const tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip);
  const show = (e, el) => {
    const p = el.getAttribute('data-tip').split('|');
    tip.innerHTML = `<b>${esc(p[0])}</b>${p.slice(1).map((x) => `<div>${esc(x)}</div>`).join('')}`;
    const x = Math.min(e.clientX + 14, window.innerWidth - 270), y = Math.min(e.clientY + 14, window.innerHeight - 100);
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('show');
  };
  document.addEventListener('mousemove', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(e, el); else tip.classList.remove('show'); });
  document.addEventListener('touchstart', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(e.touches[0], el); else tip.classList.remove('show'); }, { passive: true });
}

window.addEventListener('unhandledrejection', (e) => {
  const err = e.reason;
  if (err && err.auth) { toast('หมดเวลาเข้าสู่ระบบ — กรุณาเข้าใหม่', 'err'); token.set(''); S.user = null; showLogin(); return; }
  if (err && err.message) toast(err.message, 'err');
});

boot();
