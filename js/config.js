// ===== ตั้งค่าการเชื่อมต่อ (แก้ไฟล์นี้ไฟล์เดียวตอนติดตั้ง) =====
// API_URL ว่าง = โหมดสาธิต (ข้อมูลตัวอย่างเก็บในเบราว์เซอร์เครื่องนั้น)
// ใช้งานจริง: ใส่ลิงก์ Edge Function จาก Supabase เช่น 'https://abcdefghij.supabase.co/functions/v1/api'
export const CONFIG = {
  API_URL: '',
  LIFF_ID: '',            // LIFF ID จาก LINE Developers เช่น '2001234567-AbCdEfGh'
  APP_NAME: 'ระบบงานฝ่ายแผนงาน',
  ORG_NAME: 'ฝ่ายแผนงาน'
};
