// Service Worker: เก็บไฟล์หน้าเว็บไว้ในเครื่อง เปิดเร็ว/ติดตั้งเป็นแอปได้ • ข้อมูลจาก API ไม่เก็บ (ดึงสดทุกครั้ง)
const VERSION = 'plan-app-v1.12.1';   // เปลี่ยนเลขนี้ทุกครั้งที่อัปเดตไฟล์บน GitHub Pages (แอปจะโหลดเวอร์ชันใหม่ให้เอง)
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/config.js', './js/api.js', './js/demo.js', './js/store.js', './js/util.js', './js/ui.js', './js/charts.js', './js/mappick.js',
  './js/views/login.js', './js/views/home.js', './js/views/plans.js', './js/views/meetings.js', './js/views/leaves.js', './js/views/trips.js', './js/views/orders.js',
  './js/views/files.js', './js/views/people.js', './js/views/settings.js', './js/views/misc.js', './js/views/prices.js', './js/views/check.js',
  './js/data/factorf.js', './js/data/oprate.js', './js/data/transport.js',
  './icons/logo-tile.png', './icons/favicon-64.png', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' = ดึงจาก GitHub ตรงๆ ไม่ใช้สำเนาเก่าใน cache ของเบราว์เซอร์ (GitHub Pages เก็บไว้ 10 นาที)
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;                                   // POST ไป Apps Script ไม่ยุ่ง
  if (url.origin !== location.origin) {                               // ฟอนต์/ไลบรารีจาก CDN: เก็บไว้ใช้ออฟไลน์
    if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.host)) {
      e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))));
    }
    return;
  }
  // ไฟล์ของแอป: ตอบจากที่เก็บในเครื่องทันที (เปิดเร็ว) แล้วดึงฉบับล่าสุดเก็บไว้เบื้องหลัง • ออฟไลน์ก็เปิดได้
  // ไฟล์ชุดใหม่ทั้งชุดมาตอนเปลี่ยน VERSION → app.js โหลดหน้าใหม่ให้เอง 1 ครั้ง
  e.respondWith(caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => c.match('./index.html'));
  })));
});
