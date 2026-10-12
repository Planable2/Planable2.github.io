// ===== เข้าสู่ระบบ: LINE (LIFF) / ชื่อผู้ใช้ + รหัสผ่าน / ลงทะเบียนครั้งแรก =====
import { CONFIG } from '../config.js';
import { call, DEMO } from '../api.js';
import { esc, $, on } from '../util.js';
import { icon, busy, toast } from '../ui.js';
import { resetDemo } from '../demo.js';

let liffReady = null;
async function initLiff() {
  if (!CONFIG.LIFF_ID || !window.liff) return false;
  if (!liffReady) liffReady = liff.init({ liffId: CONFIG.LIFF_ID }).then(() => true).catch((e) => { console.warn(e); return false; });
  return liffReady;
}

export function loginView(root, onDone) {
  const hasLine = DEMO || !!CONFIG.LIFF_ID;
  root.innerHTML = `
  <div class="login">
    <section class="hero">
      <div class="row">${icon('leaf', 28)}<b style="font-family:var(--head);font-size:18px;font-weight:500">${esc(CONFIG.ORG_NAME)}</b></div>
      <div class="col" style="gap:14px">
        <h1>${esc(CONFIG.APP_NAME)}</h1>
        <p style="margin:0;color:#E0E5D6;line-height:1.7">ติดตามแผนงานทุกแขวงและเขต • ปฏิทินประชุม • คลังเอกสารจาก LINE • งานสั่งการ — ข้อมูลชุดเดียวกันทุกหน้าจอ</p>
      </div>
      <span style="font-size:12px;color:#C7CDB8">${DEMO ? 'โหมดสาธิต: ข้อมูลตัวอย่างเก็บในเครื่องนี้เท่านั้น' : 'เชื่อมต่อฐานข้อมูลแล้ว'}</span>
    </section>
    <section class="box"><div id="lg">
      <div class="seg-ctl" role="tablist" style="align-self:flex-start"><button class="on" data-tab="staff">บุคลากร</button><button data-tab="guest">ผู้เยี่ยมชม</button></div>
      <h2 style="font-size:24px">เข้าสู่ระบบ</h2>
      ${hasLine ? `<button class="btn line block" id="b-line">เข้าสู่ระบบด้วย LINE</button><div class="row faint"><span class="grow" style="height:1px;background:var(--line)"></span>หรือใช้ชื่อผู้ใช้<span class="grow" style="height:1px;background:var(--line)"></span></div>` : ''}
      <form id="f-pw" class="col" style="gap:12px">
        <label class="f">ชื่อผู้ใช้<input class="inp" name="username" autocomplete="username" required></label>
        <label class="f">รหัสผ่าน<input class="inp" name="password" type="password" autocomplete="current-password" required></label>
        <span class="err" id="lg-err"></span>
        <button class="btn pri block" type="submit" id="b-pw">เข้าสู่ระบบ</button>
      </form>
      <button class="btn sm" id="b-setup" style="display:none;align-self:flex-start">${icon('gear', 15)}ติดตั้งครั้งแรก: ตั้งรหัสผู้ดูแลระบบ</button>
      <p class="faint" id="lg-hint">บุคลากร: ลงทะเบียนครั้งแรกด้วย LINE แล้วตั้งรหัสผ่านไว้ใช้บนคอมพิวเตอร์</p>
      ${DEMO ? `<div class="card" style="background:var(--soft2);display:flex;flex-direction:column;gap:8px"><b class="small">ทดลองเข้า (โหมดสาธิต • รหัสผ่าน demo1234)</b><div class="row wrap">
        <button class="chip" data-demo="admin.plan">วิศวกร ก (แอดมิน)</button><button class="chip" data-demo="ann.s">ธุรการ</button><button class="chip" data-demo="head01">หัวหน้า</button><button class="chip" data-demo="ton.k">นายช่าง ก</button><button class="chip" data-demo="guest.region">ผู้เยี่ยมชม</button></div>
        <button class="btn sm" id="b-reset" style="align-self:flex-start">ล้างข้อมูลสาธิตกลับค่าเริ่มต้น</button></div>` : ''}
    </div></section>
  </div>`;
  const err = (m) => ($('#lg-err').textContent = m || '');
  on(root, '[data-tab]', 'click', (e, b) => {
    root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    const g = b.dataset.tab === 'guest';
    const line = $('#b-line'); if (line) { line.style.display = g ? 'none' : ''; line.nextElementSibling.style.display = g ? 'none' : ''; }
    $('#lg-hint').textContent = g ? 'บัญชีผู้เยี่ยมชมดูได้เฉพาะ Dashboard — ขอบัญชีได้จากผู้ดูแลระบบ' : 'บุคลากร: ลงทะเบียนครั้งแรกด้วย LINE แล้วตั้งรหัสผ่านไว้ใช้บนคอมพิวเตอร์';
  });
  $('#f-pw').onsubmit = async (e) => {
    e.preventDefault(); err('');
    const fd = new FormData(e.target), b = $('#b-pw'); busy(b);
    try { onDone(await call('login', { username: fd.get('username'), password: fd.get('password') })); }
    catch (x) { err(x.message); busy(b, false); }
  };
  on(root, '[data-demo]', 'click', async (e, b) => { busy(b); try { onDone(await call('login', { username: b.dataset.demo, password: 'demo1234' })); } catch (x) { err(x.message); busy(b, false); } });
  const rs = $('#b-reset'); if (rs) rs.onclick = () => { resetDemo(); toast('ล้างข้อมูลสาธิตแล้ว'); };
  const lb = $('#b-line');
  if (lb) lb.onclick = () => lineFlow(root, onDone, err);
  // ติดตั้งครั้งแรก: ยังไม่มีผู้ดูแลระบบที่ตั้งรหัสผ่าน → แสดงปุ่มตั้งค่า
  if (!DEMO) call('ping').then((r) => { const b = $('#b-setup'); if (r && r.needsSetup && b) { b.style.display = ''; b.onclick = () => setupView(root, onDone); } }).catch(() => {});
  // เปิดจากในแอป LINE: เข้าอัตโนมัติ
  if (!DEMO && CONFIG.LIFF_ID) initLiff().then((ok) => { if (ok && (liff.isInClient() || liff.isLoggedIn())) lineFlow(root, onDone, err); });
}

async function lineFlow(root, onDone, err) {
  let idToken = 'demo';
  if (!DEMO) {
    const ok = await initLiff();
    if (!ok) return err('เชื่อมต่อ LINE ไม่ได้ — ตรวจ LIFF ID ในไฟล์ config.js');
    if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
    idToken = liff.getIDToken();
  }
  try {
    const res = await call('lineLogin', { idToken });
    if (res.token) return onDone(res);
    if (res.pending) return pendingView(root, res.user && res.user.full_name);
    if (res.needRegister) return registerView(root, idToken, res, onDone);
  } catch (x) { err(x.message); }
}

function pendingView(root, name) {
  $('#lg', root).innerHTML = `<div class="col center" style="gap:12px;align-items:center"><div style="font-size:40px">⏳</div><h2>รอผู้ดูแลระบบยืนยันตัวตน</h2>
    <p class="muted" style="margin:0;line-height:1.7">${name ? 'คุณเลือกชื่อ <b>' + esc(name) + '</b><br>' : ''}เมื่อยืนยันแล้วจะเข้าใช้งานได้ทันที</p><button class="btn" onclick="location.reload()">ตรวจสอบอีกครั้ง</button></div>`;
}

function registerView(root, idToken, res, onDone) {
  let pick = '';
  const box = $('#lg', root);
  box.innerHTML = `<h2 style="font-size:22px">ลงทะเบียนครั้งแรก</h2>
    <p class="muted" style="margin:0">สวัสดี ${esc(res.lineName || '')} — เลือกชื่อของคุณจากรายชื่อที่ผู้ดูแลระบบเพิ่มไว้</p>
    <div class="col" id="cands" style="gap:6px">${res.candidates.length ? res.candidates.map((c) => `<button class="person" data-u="${esc(c.user_id)}" style="border:1.5px solid var(--line)"><span class="grow"><b>${esc(c.full_name)}</b><br><span class="faint">${esc(c.position)} • ${esc(c.role)}</span></span></button>`).join('') : '<div class="empty">ไม่มีรายชื่อว่าง — แจ้งผู้ดูแลระบบให้เพิ่มชื่อของคุณก่อน</div>'}</div>
    <label class="f">ตั้งชื่อผู้ใช้ (ใช้บนคอมพิวเตอร์)<input class="inp" id="r-u" placeholder="ภาษาอังกฤษ/ตัวเลข อย่างน้อย 4 ตัว" autocomplete="username"></label>
    <label class="f">ตั้งรหัสผ่าน<input class="inp" id="r-p" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" autocomplete="new-password"></label>
    <label class="f">ยืนยันรหัสผ่าน<input class="inp" id="r-p2" type="password" autocomplete="new-password"></label>
    <span class="err" id="r-err"></span>
    <button class="btn pri block" id="r-go">ส่งให้ผู้ดูแลระบบยืนยัน</button>`;
  on(box, '[data-u]', 'click', (e, b) => { pick = b.dataset.u; box.querySelectorAll('[data-u]').forEach((x) => (x.style.borderColor = x === b ? 'var(--green2)' : 'var(--line)')); });
  $('#r-go').onclick = async () => {
    const e = $('#r-err'), u = $('#r-u').value.trim(), p = $('#r-p').value, p2 = $('#r-p2').value;
    if (!pick) return (e.textContent = 'กรุณาเลือกชื่อของคุณ');
    if (p !== p2) return (e.textContent = 'รหัสผ่านไม่ตรงกัน');
    const b = $('#r-go'); busy(b);
    try { await call('lineRegister', { idToken, user_id: pick, username: u, password: p }); pendingView(root, (res.candidates.find((c) => c.user_id === pick) || {}).full_name); }
    catch (x) { e.textContent = x.message; busy(b, false); }
  };
}

function setupView(root, onDone) {
  const box = $('#lg', root);
  box.innerHTML = `<h2 style="font-size:22px">ติดตั้งครั้งแรก</h2>
    <p class="muted" style="margin:0;line-height:1.7">ตั้งชื่อผู้ใช้และรหัสผ่านให้ผู้ดูแลระบบ (คนที่ตั้ง is_admin ไว้ในตาราง app_users) • ทำได้ครั้งเดียว</p>
    <label class="f">รหัสติดตั้ง (ADMIN_SETUP_KEY)<input class="inp" id="s-k" type="password" autocomplete="off"></label>
    <label class="f">ชื่อผู้ใช้ผู้ดูแลระบบ<input class="inp" id="s-u" placeholder="ภาษาอังกฤษ/ตัวเลข อย่างน้อย 4 ตัว" autocomplete="username"></label>
    <label class="f">รหัสผ่าน<input class="inp" id="s-p" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" autocomplete="new-password"></label>
    <label class="f">ยืนยันรหัสผ่าน<input class="inp" id="s-p2" type="password" autocomplete="new-password"></label>
    <span class="err" id="s-err"></span>
    <button class="btn pri block" id="s-go">บันทึกและเข้าสู่ระบบ</button>
    <button class="btn block" onclick="location.reload()">ยกเลิก</button>`;
  $('#s-go').onclick = async () => {
    const e = $('#s-err'), p = $('#s-p').value;
    if (p !== $('#s-p2').value) return (e.textContent = 'รหัสผ่านไม่ตรงกัน');
    const b = $('#s-go'); busy(b);
    try { onDone(await call('setupAdmin', { key: $('#s-k').value, username: $('#s-u').value.trim(), password: p })); }
    catch (x) { e.textContent = x.message; busy(b, false); }
  };
}
