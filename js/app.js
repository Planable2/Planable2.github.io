// ===== จุดเริ่มแอป: เข้าสู่ระบบ, เมนู, เปลี่ยนหน้า =====
import { CONFIG } from './config.js';
import { call, token, DEMO } from './api.js';
import { S, load, isGuest, isAdmin, can, myOpenOrders, pendingFiles, pendingUsers, invalidate, badgeInfo } from './store.js';
import { esc, $, $$, on } from './util.js';
import { icon, avatar, toast, closeModal } from './ui.js';
import { loginView, linkLineFlow } from './views/login.js';
import * as Home from './views/home.js';
import * as Plans from './views/plans.js';
import * as Meetings from './views/meetings.js';
import * as Leaves from './views/leaves.js';
import * as Orders from './views/orders.js';
import * as Files from './views/files.js';
import * as People from './views/people.js';
import * as Settings from './views/settings.js';
import * as Misc from './views/misc.js';
import * as Prices from './views/prices.js';

const ROUTES = {
  home: { mod: Home, title: 'หน้าแรก', nav: 'home', guest: true },
  plans: { mod: Plans, title: 'ทะเบียนแผน', nav: 'plans' },
  plan: { mod: Plans, fn: 'detail', title: 'รายละเอียดแผน', nav: 'plans' },
  meetings: { mod: Meetings, title: 'ปฏิทินประชุม', nav: 'meetings' },
  leaves: { mod: Leaves, title: 'ปฏิทินวันลา', nav: 'meetings' },
  orders: { mod: Orders, title: 'งานสั่งการ', nav: 'orders' },
  files: { mod: Files, title: 'คลังเอกสาร', nav: 'files' },
  prices: { mod: Prices, title: 'ราคาวัสดุ', nav: 'prices' },
  fuel: { mod: Prices, fn: 'fuelRoute', title: 'ราคาวัสดุ', nav: 'prices' },
  people: { mod: People, title: 'บุคลากร', nav: 'people' },
  profile: { mod: People, fn: 'profile', title: 'โปรไฟล์ของฉัน', nav: 'profile' },
  settings: { mod: Settings, title: 'ตั้งค่าระบบ', nav: 'settings', admin: true },
  more: { mod: Misc, fn: 'more', title: 'เพิ่มเติม', nav: 'more' }
};

export const app = {
  go: (h) => { if (location.hash === '#/' + h) render(); else location.hash = '#/' + h; },
  refresh: () => { invalidate(); render(); },
  async reload() { const d = await call('bootstrap'); load(d); invalidate(); render(); },
  logout,
  linkLine: () => linkLineFlow((u) => {
    Object.assign(S.user, u);
    const i = S.db.Users.findIndex((x) => x.user_id === u.user_id);
    if (i >= 0) S.db.Users[i] = Object.assign({}, S.db.Users[i], u);
    toast('เชื่อมบัญชี LINE แล้ว • ใช้รูปโปรไฟล์จาก LINE');
    app.refresh();
  })
};

async function boot() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // มีเวอร์ชันใหม่ (sw.js เปลี่ยน VERSION) → โหลดหน้าใหม่ 1 ครั้ง ถ้าไม่ได้เปิดฟอร์มค้างอยู่ (ไม่ทำตอนเปิดครั้งแรก)
    const hadCtrl = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded && !$('#modal-root .overlay')) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('hashchange', () => { closeModal(); render(); });
  setupTip();
  if (token.get()) {
    try {
      load(await call('bootstrap'));
      if (sessionStorage.getItem('pa-link')) {   // กลับมาจากหน้า LINE Login ระหว่างเชื่อมบัญชี
        sessionStorage.removeItem('pa-link');
        history.replaceState(null, '', '#/profile');
        render();
        return app.linkLine();
      }
      return render();
    } catch (e) { if (!e.auth) { showFatal(e); return; } token.set(''); }
  }
  showLogin();
}

function showLogin() {
  shellKey = '';
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
  main.style.animation = 'none'; void main.offsetWidth; main.style.animation = '';
  window.scrollTo({ top: 0 });
  try { (r.fn ? r.mod[r.fn] : r.mod.view)(main, arg, app); }
  catch (e) { console.error(e); main.innerHTML = `<div class="empty">เกิดข้อผิดพลาดในการแสดงหน้า: ${esc(e.message)}</div>`; }
}

function menu() {
  if (isGuest()) return [{ k: 'home', label: 'Dashboard', href: 'home', cols: [] }];
  const o = myOpenOrders().length, f = can('classify_file') ? pendingFiles().length : 0, pu = isAdmin() ? pendingUsers().length : 0;
  const m = [
    { k: 'home', label: 'หน้าแรก', href: 'home', cols: [['สำรวจ', 'big', [['ภาพรวมแผนทั้งเขต', 'home'], ['กราฟเปรียบเทียบ', 'home']]], ['ทางลัด', 'sm', [['งานสั่งการของฉัน', 'orders'], ['ประชุมที่กำลังจะมาถึง', 'meetings']]]] },
    { k: 'plans', label: 'ทะเบียนแผน', href: 'plans', cols: [['ทะเบียนแผนงาน', 'big', [['ดูทะเบียนแผน', 'plans'], ...(can('edit_plan') ? [['ลงทะเบียนแผนใหม่', 'plans/new'], ['นำเข้าจาก Excel', 'plans/import']] : [])]]] },
    { k: 'orders', label: 'งานสั่งการ', href: 'orders', badge: o, cols: [['งานสั่งการ', 'big', [['งานของฉัน', 'orders'], ...(can('record_order') ? [['บันทึกงานสั่งการ', 'orders/new']] : [])]]] },
    { k: 'meetings', label: 'ปฏิทิน', href: 'meetings', badge: calBadge(), cols: [['ปฏิทิน', 'big', [['ประชุม', 'meetings'], ['วันลา', 'leaves']]], ['ทางลัด', 'sm', [...(can('manage_meeting') ? [['เพิ่มประชุม', 'meetings/new']] : []), ['ลงวันลา', 'leaves/new']]]] },
    { k: 'files', label: 'คลังเอกสาร', href: 'files', badge: f, cols: [['คลังเอกสาร', 'big', [['รอจัดหมวด', 'files'], ['เอกสารทั้งหมด', 'files/all']]]] },
    { k: 'prices', label: 'ราคาวัสดุ', href: 'prices', cols: [['ราคาวัสดุ', 'big', [['น้ำมัน', 'prices/fuel'], ['ยางแอสฟัลต์', 'prices/asphalt'], ['วัสดุจากแหล่ง', 'prices/quarry'], ['คอนกรีต / ปูนซีเมนต์', 'prices/concrete']]]] },
    { k: 'people', label: 'บุคลากร', href: 'people', badge: pu, cols: [['บุคลากร', 'big', [['โครงสร้างส่วน', 'people'], ['โปรไฟล์ของฉัน', 'profile']]]] }
  ];
  if (isAdmin()) m.push({ k: 'settings', label: 'ตั้งค่า', href: 'settings', cols: [] });
  return m;
}

/** ตัวเลขบนแท็บปฏิทิน: ประชุมที่ต้องเข้า หรือวันออกนอกสถานที่ (ตามบทบาท) — บทบาทนับเอกสารใช้ตัวเลขของคลังเอกสารอยู่แล้ว */
const calBadge = () => { if (isGuest()) return 0; const b = badgeInfo(); return b.mode === 'meetings' || b.mode === 'trips' ? b.n : 0; };
/** ตัวเลขบนไอคอนแอป (PWA ที่ติดตั้งแล้ว • Windows/macOS/ChromeOS และ iPhone ที่อนุญาตการแจ้งเตือน) */
let lastBadge = -1;
function appBadge(n) {
  if (n === lastBadge || !('setAppBadge' in navigator)) return;
  lastBadge = n;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

const TOP_KEYS = ['home', 'plans', 'meetings', 'orders', 'more'];
const MORE_KEYS = ['files', 'prices', 'people', 'profile', 'settings', 'more'];
const logo = (s) => `<img class="logo" src="icons/logo-tile.png" alt="" width="${s}" height="${s}">`;
let shellKey = '', fly = { close() {} };

/** เมนูสร้างครั้งเดียวแล้วคงอยู่ข้ามหน้า (สร้างใหม่เฉพาะเมื่อรายการ/ป้ายตัวเลขเปลี่ยน) — เปลี่ยนหน้าแล้วเมนูไม่กระพริบ */
function shell(r) {
  const items = menu(), me = S.user;
  const bn = isGuest() ? [] : [['home', 'หน้าแรก', 'home', 'home'], ['plans', 'แผนงาน', 'list', 'plans'], ['meetings', 'ปฏิทิน', 'cal', 'meetings'], ['orders', 'งานสั่งการ', 'task', 'orders'], ['more', 'เพิ่มเติม', 'more', 'more']];
  const o = myOpenOrders().length, more = isGuest() ? 0 : (can('classify_file') ? pendingFiles().length : 0) + (isAdmin() ? pendingUsers().length : 0);
  appBadge(isGuest() ? 0 : badgeInfo().n);
  const key = JSON.stringify([items, bn, o, more, me.user_id, me.full_name, me.line_picture_url, isGuest()]);
  if (key !== shellKey || !$('#topnav')) { shellKey = key; build(items, bn, o, more, me); }
  sync(r);
}

function build(items, bn, o, more, me) {
  $('#app').innerHTML = `
  <header class="topnav" id="topnav">
    <div class="bar"><div class="inner">
      <a class="brand" href="#/home">${logo(28)}<span>${esc(CONFIG.ORG_NAME)}</span></a>
      <nav class="tn-links" aria-label="เมนูหลัก">${items.map((m) => `<a class="tn-link" href="#/${m.href}" data-k="${m.k}">${esc(m.label)}${m.badge ? `<span class="badge">${m.badge}</span>` : ''}</a>`).join('')}</nav>
      ${DEMO ? '<span class="tag gold">โหมดสาธิต</span>' : ''}
      ${isGuest() ? '<span class="tag gold">ผู้เยี่ยมชม</span>' : `<a href="#/profile" class="icon-btn" title="โปรไฟล์ของฉัน">${avatar(me, 28)}</a>`}
      <button class="icon-btn" id="btn-logout" title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon('out', 18)}</button>
    </div></div>
    <div class="fly">${items.filter((m) => m.cols.length).map((m) => `<div class="panel" data-p="${m.k}">${m.cols.map((c, ci) => `<div class="c ${c[1]}"><span class="colh">${esc(c[0])}</span>${c[2].map((l, li) => `<a href="#/${l[1]}" style="animation-delay:${ci * 60 + 30 + li * 22}ms">${esc(l[0])}</a>`).join('')}</div>`).join('')}</div>`).join('')}</div>
  </header>
  <div class="dim" id="dim"></div>
  <div class="mhead" id="mhead"></div>
  <main class="page" id="view"></main>
  ${bn.length ? `<nav class="bottomnav" aria-label="เมนูล่าง">${bn.map((b) => { const badge = b[0] === 'orders' ? o : b[0] === 'more' ? more : b[0] === 'meetings' ? calBadge() : 0; return `<a href="#/${b[3]}" data-k="${b[0]}"><span class="pillbg">${icon(b[2])}</span>${b[1]}${badge ? `<span class="badge">${badge}</span>` : ''}</a>`; }).join('')}</nav>` : ''}`;
  const tn = $('#topnav'), box = $('.fly', tn);
  let t = null, cur = null;
  const panelOf = (k) => $(`.fly .panel[data-p="${k}"]`, tn);
  const show = (k) => {
    clearTimeout(t);
    const p = k ? panelOf(k) : null;
    $$('.fly .panel', tn).forEach((x) => x.classList.toggle('on', x === p));
    tn.classList.toggle('open', !!p);
    box.style.height = p ? p.offsetHeight + 'px' : '0px';
    cur = p ? k : null;
  };
  // เปิดอยู่แล้ว = สลับทันที • ยังไม่เปิด = รอเล็กน้อย (กันเมนูเด้งตอนเมาส์ผ่าน) • แท็บที่ไม่มีเมนูย่อย = หน่วงก่อนปิด
  const enter = (k) => {
    clearTimeout(t);
    const p = panelOf(k);
    if (cur && p) show(k);
    else if (cur) t = setTimeout(() => show(null), 160);
    else if (p) t = setTimeout(() => show(k), 110);
  };
  on(tn, '.tn-link', 'mouseenter', (e, el) => enter(el.dataset.k));
  on(tn, '.tn-link', 'focus', (e, el) => show(el.dataset.k));
  tn.addEventListener('mouseleave', () => { clearTimeout(t); t = setTimeout(() => show(null), 140); });
  box.addEventListener('mouseenter', () => clearTimeout(t));
  $('#dim').addEventListener('mouseenter', () => show(null));
  $$('.fly a', tn).forEach((a) => a.addEventListener('click', () => show(null)));
  $('#btn-logout').onclick = () => logout();
  fly = { close: () => show(null) };
}

function sync(r) {
  const k = r.nav;
  $$('#topnav .tn-link').forEach((a) => a.classList.toggle('on', a.dataset.k === k));
  $$('.bottomnav a').forEach((a) => {
    const onk = a.dataset.k === k || (a.dataset.k === 'more' && MORE_KEYS.includes(k));
    a.classList.toggle('on', onk);
    if (onk) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#mhead').innerHTML = `${TOP_KEYS.includes(k) || isGuest() ? logo(30) : `<a class="icon-btn" href="#/more" aria-label="กลับ">${icon('back')}</a>`}<h1 class="grow">${esc(r.title)}</h1>${DEMO ? '<span class="tag gold">สาธิต</span>' : ''}${isGuest() ? `<button class="icon-btn" id="btn-logout-m" aria-label="ออกจากระบบ">${icon('out', 18)}</button>` : `<a href="#/profile">${avatar(S.user, 30)}</a>`}`;
  const bm = $('#btn-logout-m'); if (bm) bm.onclick = () => logout();
  fly.close();
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
