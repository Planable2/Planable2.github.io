// ===== เรียก API (Supabase Edge Function "api") หรือโหมดสาธิต =====
import { CONFIG } from './config.js';
import { demoCall } from './demo.js';

export const DEMO = !CONFIG.API_URL;
const KEY = 'plan-app-token';
export const token = { get: () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }, set: (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) {} } };

export async function call(action, payload = {}) {
  const body = Object.assign({ action, token: token.get() }, payload);
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 120));
    return demoCall(body);
  }
  let res;
  try {
    // text/plain = ไม่ต้อง preflight (CORS) — Edge Function อ่าน body เป็น JSON เอง
    res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
  } catch (e) {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจอินเทอร์เน็ต');
  }
  const j = await res.json().catch(() => ({ ok: false, error: 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง' }));
  if (!j.ok) { const err = new Error(j.error || 'เกิดข้อผิดพลาด'); err.auth = !!j.auth; throw err; }
  return j.data;
}
