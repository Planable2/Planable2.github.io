// ===== ตั้งค่าการเชื่อมต่อ (แก้ไฟล์นี้ไฟล์เดียวตอนติดตั้ง) =====
// API_URL ว่าง = โหมดสาธิต (ข้อมูลตัวอย่างเก็บในเบราว์เซอร์เครื่องนั้น)
// ใช้งานจริง: ใส่ลิงก์ Edge Function จาก Supabase เช่น 'https://abcdefghij.supabase.co/functions/v1/api'
export const CONFIG = {
  // ?forceFunctionRegion= ให้ฟังก์ชันรันภูมิภาคเดียวกับฐานข้อมูล (ซิดนีย์) — ไม่ใส่จะรันที่สิงคโปร์แล้วคุยข้ามไปซิดนีย์ ช้าลง ~4 เท่า
  API_URL: 'https://atgaetzpmxpyawpnrpem.supabase.co/functions/v1/api?forceFunctionRegion=ap-southeast-2',
  LIFF_ID: '2011983561-yb9UBuYK',
  APP_NAME: 'Planable2',
  ORG_NAME: 'Planable2'
};
