// Service Worker: เก็บไฟล์หน้าเว็บไว้ในเครื่อง เปิดเร็ว/ติดตั้งเป็นแอปได้ • ข้อมูลจาก API ไม่เก็บ (ดึงสดทุกครั้ง)
const VERSION = 'plan-app-v1.4.0';   // เปลี่ยนเลขนี้ทุกครั้งที่อัปเดตไฟล์บน GitHub Pages
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/config.js', './js/api.js', './js/demo.js', './js/store.js', './js/util.js', './js/ui.js', './js/charts.js',
  './js/views/login.js', './js/views/home.js', './js/views/plans.js', './js/views/meetings.js', './js/views/leaves.js', './js/views/orders.js',
  './js/views/files.js', './js/views/people.js', './js/views/settings.js', './js/views/misc.js', './js/views/prices.js',
  './icons/logo-tile.png', './icons/favicon-64.png', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  // ไฟล์ของแอป: ใช้เน็ตก่อน (ได้เวอร์ชันล่าสุด) ถ้าออฟไลน์ใช้ที่เก็บไว้
  e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
});
