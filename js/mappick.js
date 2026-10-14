// ===== เลือกพิกัดบนแผนที่ (Leaflet + OpenStreetMap • โหลดเมื่อเปิดใช้เท่านั้น) =====
import { esc } from './util.js';

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
const HOME = [18.1446, 100.1403];   // จ.แพร่ — จุดเริ่มเมื่อยังไม่มีพิกัด
let loading = null;

function leaflet() {
  if (window.L) return Promise.resolve(window.L);
  return loading || (loading = new Promise((ok, bad) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.min.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = LEAFLET + 'leaflet.min.js';
    s.onload = () => ok(window.L);
    s.onerror = () => { loading = null; bad(new Error('โหลดแผนที่ไม่ได้ — ตรวจอินเทอร์เน็ต')); };
    document.head.appendChild(s);
  }));
}

/** อ่านพิกัดจากลิงก์ Google Maps หรือข้อความ "lat, lng" (ลิงก์ย่อ maps.app.goo.gl อ่านไม่ได้ → ใช้ลิงก์นั้นนำทางแทน) */
export function parseLatLng(s) {
  const t = String(s || '');
  const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(t) || /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t)
    || /[?&](?:q|query|destination|ll|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i.exec(t) || /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/.exec(t);
  if (!m) return null;
  const lat = +(+m[1]).toFixed(6), lng = +(+m[2]).toFixed(6);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** เปิดแผนที่ใน box • start = {lat,lng}|null • onPick({lat,lng}) ทุกครั้งที่ปัก/ลากหมุด */
export async function pickOnMap(box, start, onPick) {
  box.innerHTML = '<span class="faint small">กำลังโหลดแผนที่…</span>';
  const L = await leaflet();
  box.innerHTML = `
    <div class="row wrap" style="gap:6px"><input class="inp" id="mp-q" placeholder="ค้นหาสถานที่ เช่น แขวงทางหลวงน่าน" style="flex:1 1 200px;height:38px">
      <button type="button" class="btn sm" id="mp-go">ค้นหา</button><button type="button" class="btn sm" id="mp-me">ตำแหน่งของฉัน</button></div>
    <div class="col" id="mp-res" style="gap:4px"></div>
    <div id="mp-map" style="height:260px;border-radius:14px;overflow:hidden;isolation:isolate"></div>
    <span class="faint small">แตะบนแผนที่เพื่อปักหมุด • ลากหมุดเพื่อปรับตำแหน่ง</span>`;
  const map = L.map(box.querySelector('#mp-map')).setView(start ? [start.lat, start.lng] : HOME, start ? 16 : 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  let pin = null;
  const put = (ll, zoom) => {
    const p = { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) };
    if (!pin) { pin = L.marker([p.lat, p.lng], { draggable: true }).addTo(map); pin.on('dragend', () => put(pin.getLatLng())); } else pin.setLatLng([p.lat, p.lng]);
    if (zoom) map.setView([p.lat, p.lng], zoom);
    onPick(p);
  };
  if (start) put(start);
  map.on('click', (e) => put(e.latlng));
  const res = box.querySelector('#mp-res');
  const search = async () => {
    const q = box.querySelector('#mp-q').value.trim(); if (!q) return;
    res.innerHTML = '<span class="faint small">กำลังค้นหา…</span>';
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=th&accept-language=th&q=' + encodeURIComponent(q)).then((x) => x.json());
      res.innerHTML = r.length ? r.map((x, i) => `<button type="button" class="chip" data-i="${i}" style="justify-content:flex-start;height:auto;padding:6px 10px;white-space:normal;text-align:left">${esc(x.display_name)}</button>`).join('') : '<span class="faint small">ไม่พบสถานที่ — ลองพิมพ์ชื่ออื่น หรือแตะบนแผนที่เอง</span>';
      res.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { const x = r[b.dataset.i]; put({ lat: +x.lat, lng: +x.lon }, 16); res.innerHTML = ''; }));
    } catch (e) { res.innerHTML = '<span class="err">ค้นหาไม่ได้ — ตรวจอินเทอร์เน็ต</span>'; }
  };
  box.querySelector('#mp-go').onclick = search;
  box.querySelector('#mp-q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } };
  box.querySelector('#mp-me').onclick = () => {
    if (!navigator.geolocation) return (res.innerHTML = '<span class="err">อุปกรณ์นี้หาตำแหน่งไม่ได้</span>');
    navigator.geolocation.getCurrentPosition((g) => put({ lat: g.coords.latitude, lng: g.coords.longitude }, 17),
      () => (res.innerHTML = '<span class="err">ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง</span>'), { enableHighAccuracy: true, timeout: 10000 });
  };
  setTimeout(() => map.invalidateSize(), 250);   // แผนที่ในหน้าต่างลอยต้องคำนวณขนาดใหม่หลังแสดง
}
