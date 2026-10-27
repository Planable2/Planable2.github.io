// ===== โหมดสาธิต: เลียนแบบ API ของ Apps Script ด้วยข้อมูลตัวอย่างในเครื่อง (localStorage) =====
// โครงตาราง/ชื่อคอลัมน์ตรงกับไฟล์ ฐานข้อมูล_ระบบงานฝ่ายแผนงาน.xlsx ทุกตัว
const KEY = 'plan-app-demo-v3';
const pad = (n, l = 4) => String(n).padStart(l, '0');
const nowIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}T${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:00`; };
const T = (v) => v === true || v === 'TRUE';

function seed() {
  const UNITS = ['เขต', 'แขวง 1', 'แขวง 2', 'แขวง 3', 'แขวง 4', 'แขวง 5', 'แขวง 6'];
  const OFF = ['สผ.', 'สร.', 'สร. (งานอาคาร)', 'สป.', 'สบ.', 'จังหวัด', 'กลุ่มจังหวัด'];
  const REV = { 'เขต': '', 'แขวง 1': 'P02', 'แขวง 2': 'P02', 'แขวง 3': 'P03', 'แขวง 4': 'P03', 'แขวง 5': 'P04', 'แขวง 6': 'P04' };
  const cfg = {
    cfg_Units: UNITS.map((n, i) => ({ unit_id: 'U0' + (i + 1), name: n, short: i ? 'ข.' + i : 'เขต', kind: i ? 'แขวง' : 'เขต', province: ['แพร่', 'แพร่', 'แพร่', 'น่าน', 'น่าน', 'พะเยา', 'เชียงราย'][i], reviewer_id: REV[n], sort: i + 1, active: true })),
    cfg_Offices: OFF.map((n, i) => ({ office_id: 'O0' + (i + 1), short: n, full: n, scope: n === 'สร. (งานอาคาร)' ? 'เขต และแขวง' : 'เฉพาะแขวง', has_round: i < 5, sort: i + 1, active: true })),
    cfg_Rounds: [['สผ.', '2026-10-10'], ['สร.', '2026-10-31'], ['สร. (งานอาคาร)', '2026-10-31'], ['สป.', '2026-10-20'], ['สบ.', '2026-10-25']].map((r, i) => ({ round_id: 'R0' + (i + 1), fiscal_year: 2570, office: r[0], name: 'รอบ 1', due_date: r[1], remind_days: 3, active: true })),
    cfg_Status: [['s0', 'อยู่ระหว่างจัดทำ', '#C9C1AE', 'ยังไม่ส่ง', 'ธุรการ', 'แผนของเขต', false], ['s1', 'รอแขวงส่ง', '#C9C1AE', 'ยังไม่ส่ง', 'ธุรการ', 'แผนของแขวง', false], ['s2', 'แขวงส่งแล้ว', '#6585A6', 'แขวงส่งแล้ว', 'ผู้ตรวจ', 'ทั้งหมด', false], ['s3', 'ระหว่างแก้ไข', '#D3A04A', 'แขวงส่งแล้ว', 'ผู้ตรวจ', 'ทั้งหมด', true], ['s4', 'ส่งกรมแล้ว', '#5A9585', 'ส่งกรมแล้ว', 'ผู้ตรวจ', 'ทั้งหมด', false], ['s5', 'กรมเห็นชอบ', '#46703F', 'กรมเห็นชอบ', 'ผู้ตรวจ', 'ทั้งหมด', false]]
      .map((r, i) => ({ status_code: r[0], name: r[1], color: r[2], dash_group: r[3], who: r[4], scope: r[5], need_reason: r[6], sort: i })),
    cfg_MeetKinds: [['meet', 'ประชุม', '#6585A6', false, false, false], ['online', 'ประชุมออนไลน์', '#5A9585', true, false, false], ['field', 'กิจกรรม / ลงพื้นที่', '#D3A04A', false, false, true], ['inspect', 'ตรวจรับงาน', '#9A7A9C', false, true, true]]
      .map((r) => ({ kind_id: r[0], name: r[1], color: r[2], has_link: r[3], link_plan: r[4], offsite: r[5], active: true })),
    cfg_OrderStatus: [{ code: 'ack', name: 'รับทราบ', color: '#6585A6', is_done: false, sort: 1 }, { code: 'doing', name: 'กำลังทำ', color: '#D3A04A', is_done: false, sort: 2 }, { code: 'done', name: 'เสร็จ', color: '#46703F', is_done: true, sort: 3 }],
    cfg_DocKinds: [['D01', 'หนังสือประชุม', 'ประชุม/{ปี}/{เดือน}', 'ประชุม'], ['D02', 'แผนงาน', 'แผนงาน/{ปีงบ}/{หน่วยงาน}', 'แผนงาน'], ['D03', 'ราคาสืบ', 'ราคาสืบ/{ปี}/{เดือน}', 'ไม่ผูก'], ['D04', 'งานสั่งการ', 'งานสั่งการ/{ปี}', 'งานสั่งการ'], ['D05', 'เอกสารทั่วไป', 'ทั่วไป/{ปี}', 'ไม่ผูก']]
      .map((r) => ({ kind_id: r[0], name: r[1], drive_folder: r[2], link_to: r[3], active: true })),
    cfg_Roles: [['หัวหน้า', 1, 0, 1, 1, 1, 1, 1], ['ธุรการ', 1, 1, 0, 1, 1, 1, 1], ['วิศวกร', 1, 0, 1, 0, 0, 1, 1], ['นายช่าง', 1, 0, 1, 0, 0, 1, 0], ['เจ้าหน้าที่', 1, 0, 0, 0, 0, 0, 0],
      ['พนักงานบริการ', 1, 0, 0, 0, 0, 1, 0, 'files'], ['ลูกจ้างชั่วคราว (พขร.)', 1, 0, 0, 0, 0, 0, 0, 'trips'], ['ผู้เยี่ยมชม', 0, 0, 0, 0, 0, 0, 0, 'none']]
      .map((r) => ({ role: r[0], view_internal: !!r[1], edit_plan: !!r[2], update_status: !!r[3], manage_meeting: !!r[4], record_order: !!r[5], classify_file: !!r[6], edit_price: !!r[7], badge: r[8] || 'meetings' })),
    cfg_MatItems: [
      ['A01', 'AC 60/70', '1505010101500000'], ['A02', 'AC 40/50', '1505010101600000'], ['A03', 'PARA AC', ''], ['A04', 'MC-70', '1505010300400000'], ['A05', 'PMA', '1505010400400000'],
      ['A06', 'CSS-1', '1505010200700000'], ['A07', 'CRS-2', '1505010200400000'], ['A08', 'CMS-2h', '1505010200600000'], ['A09', 'CSS-1h', '1505010200800000'], ['A10', 'CSS-1h (EMA)', '1505010200900000'],
      ['A11', 'EAP', '1505010200500000'], ['A12', 'CRS-1P', '']
    ].map((r, i) => ({ item_id: r[0], kind: 'asphalt', name: r[1], unit: 'บาท/ตัน', tpso_code: r[2], sort: i + 1, active: true }))
      .concat(['หินคลุก', 'หินฝุ่น', 'หิน 3/8"', 'หิน 1/2"', 'หิน 3/4"', 'หิน 1"', 'หินผสมคอนกรีต', 'หินใหญ่', 'ทรายผสมคอนกรีต', 'ทรายถม', 'ดินถม', 'วัสดุคัดเลือก "ก"', 'วัสดุลูกรัง']
        .map((n, i) => ({ item_id: 'Q' + pad(i + 1, 2), kind: 'quarry', name: n, unit: 'บาท/ลบ.ม.', tpso_code: '', sort: i + 1, active: true }))),
    cfg_Notify: [{ key: 'meet_new', name: 'ประชุมใหม่ / เลื่อน / ยกเลิก', value: 'ทันที', active: true }, { key: 'meet_morning', name: 'สรุปประชุมประจำวัน', value: '07:30', active: true }, { key: 'meet_before', name: 'เตือนก่อนประชุม', value: '30 นาที', active: true }, { key: 'file_reply', name: 'ตอบกลับเมื่อมีไฟล์ในกลุ่ม', value: 'ลิงก์ Drive + ลิงก์เว็บ', active: true }, { key: 'orders', name: 'งานสั่งการ', value: 'ไม่แจ้งใน LINE', active: false }],
    cfg_Settings: [{ key: 'current_fiscal_year', value: 'auto', note: 'auto = คำนวณจากวันที่' }, { key: 'fiscal_start', value: '01-10', note: '' }, { key: 'lock_closed_years', value: 'TRUE', note: '' }, { key: 'fuel_provinces', value: 'แพร่, น่าน, พะเยา, เชียงราย, กรุงเทพฯ', note: '' }, { key: 'fuel_types', value: 'ดีเซล, แก๊สโซฮอล์ 95', note: '' }],
    cfg_LeaveKinds: [['sick', 'ลาป่วย', '#C96B5B'], ['personal', 'ลากิจส่วนตัว', '#D3A04A'], ['vacation', 'ลาพักผ่อน', '#5A9585'], ['maternity', 'ลาคลอดบุตร', '#9A7A9C'], ['ordain', 'ลาอุปสมบท', '#6585A6'], ['other', 'อื่นๆ', '#8C8475']]
      .map((r) => ({ kind_id: r[0], name: r[1], color: r[2], active: true }))
  };
  const av = (k) => 'icons/avatars/av-' + k + '.svg';
  const Users = [
    ['P01', '[หัวหน้าส่วน]', 'พี่ใหญ่', 'หัวหน้าส่วนแผนงาน', 'หัวหน้า', av('h'), 'head01', '081-111-2200', '1200', 'head.plan@doh.go.th', false],
    ['P02', '[วิศวกร ก]', 'ชัย', 'วิศวกรโยธาชำนาญการ', 'วิศวกร', av('e1'), 'admin.plan', '081-234-5678', '1205', 'somchai.w@doh.go.th', true],
    ['P03', '[วิศวกร ข]', 'ฝน', 'วิศวกรโยธาปฏิบัติการ', 'วิศวกร', av('e2'), 'fon.k', '086-777-1234', '1206', 'fon.k@doh.go.th', false],
    ['P04', '[นายช่าง ก]', 'ต้น', 'นายช่างโยธาชำนาญงาน', 'นายช่าง', av('t1'), 'ton.k', '089-555-0101', '1211', 'ton.k@doh.go.th', false],
    ['P05', '[นายช่าง ข]', '', 'นายช่างโยธาปฏิบัติงาน', 'นายช่าง', '', 'boss.n', '', '1212', '', false, 'pending'],
    ['P06', '[ธุรการ]', 'แอน', 'เจ้าพนักงานธุรการ', 'ธุรการ', av('d'), 'ann.s', '083-222-4455', '1201', 'ann.s@doh.go.th', false],
    ['P07', '[พนักงานบริการ]', 'นิด', 'พนักงานบริการ', 'พนักงานบริการ', av('s1'), 'service.p', '084-333-6677', '1215', '', false, 'active', true],
    ['P08', '[พขร.]', 'เอก', 'ลูกจ้างชั่วคราว (พนักงานขับรถ)', 'ลูกจ้างชั่วคราว (พขร.)', '', 'driver.p', '', '1216', '', false, 'active', true],
    ['G01', 'ผู้เยี่ยมชม สทล.', '', '—', 'ผู้เยี่ยมชม', '', 'guest.region', '', '', '', false]
  ].map((r) => ({ user_id: r[0], full_name: r[1], nickname: r[2], position: r[3], role: r[4], line_picture_url: r[5], username: r[6], phone: r[7], ext: r[8], email: r[9], is_admin: r[10], status: r[11] || 'active', has_line: !r[12] && r[4] !== 'ผู้เยี่ยมชม', _pw: r[6] ? 'demo1234' : '' }));

  // แผนงาน 3 ปี (อัลกอริทึมเดียวกับหน้าต้นแบบ)
  const BASE = [12, 5, 3, 6, 9, 3, 2], PEND = [3, 1, 0, 4, 0, 4, 4], SCALE = { 2568: 0.8, 2569: 0.9, 2570: 1 };
  const WORK = {
    'สผ.': [['22000', 'งานเสริมผิวแอสฟัลต์'], ['21500', 'งานฉาบผิวแอสฟัลต์ (Slurry Seal)'], ['21600', 'งานฉาบผิวแอสฟัลต์ (Cape Seal)'], ['22100', 'งานบูรณะทางผิวแอสฟัลต์']],
    'สร.': [['24000', 'งานปรับปรุงทางแยก'], ['24100', 'งานขยายผิวจราจร'], ['24200', 'งานก่อสร้างสะพาน']],
    'สร. (งานอาคาร)': [['31000', 'งานปรับปรุงอาคารที่ทำการ'], ['31100', 'งานก่อสร้างอาคารที่ทำการ'], ['31200', 'งานก่อสร้างบ้านพักข้าราชการ']],
    'สป.': [['25000', 'งานติดตั้งไฟฟ้าแสงสว่าง'], ['25100', 'งานติดตั้งป้ายจราจร'], ['25200', 'งานตีเส้นจราจร']],
    'สบ.': [['23100', 'งานติดตั้งราวกันอันตราย'], ['23200', 'งานแก้ไขจุดเสี่ยงอันตราย'], ['23300', 'งานติดตั้งไฟสัญญาณจราจร']],
    'จังหวัด': [['22000', 'งานเสริมผิวแอสฟัลต์'], ['24100', 'งานขยายผิวจราจร']],
    'กลุ่มจังหวัด': [['22000', 'งานเสริมผิวแอสฟัลต์'], ['24100', 'งานขยายผิวจราจร']]
  };
  const ROADS = { 'เขต': [], 'แขวง 1': ['ทล.101', 'ทล.1083', 'ทล.11', 'ทล.1023'], 'แขวง 2': ['ทล.1080', 'ทล.1081', 'ทล.102'], 'แขวง 3': ['ทล.101', 'ทล.1251', 'ทล.1154'], 'แขวง 4': ['ทล.1101', 'ทล.1020', 'ทล.1021'], 'แขวง 5': ['ทล.1124', 'ทล.103'], 'แขวง 6': ['ทล.1091', 'ทล.1150'] };
  const REASONS = ['ปริมาณงานไม่ตรงแบบ', 'ขาดภาพถ่ายสภาพทาง', 'ราคากลางไม่เป็นปัจจุบัน', 'แบบรูปไม่ครบชุด', 'ช่วง กม. ไม่ตรงผลสำรวจ'];
  const Plans = [], Segments = [], StatusLog = [];
  let lg = 0;
  [2568, 2569, 2570].forEach((y) => {
    let seq = 0;
    UNITS.forEach((u, ui) => OFF.forEach((o, oi) => {
      const n = Math.round((ui === 0 ? (oi === 2 ? 28 : 0) : Math.max(0, BASE[oi] + ((ui * 7 + oi * 3) % 5) - 2)) * SCALE[y]);
      for (let k = 0; k < n; k++) {
        const r = (k * 7 + ui * 3 + oi * 2) % 20, p = PEND[ui];
        let g = y === 2570 ? (r < p ? 0 : r < p + 4 ? 1 : r < p + 6 ? 2 : r < p + 13 ? 3 : 4) : ((y === 2569 && r < 1) ? 3 : 4);
        const b = (1.2 + ((k * 13 + ui * 5 + oi * 7) % 40) / 10) * (y === 2568 ? 0.92 : y === 2569 ? 0.96 : 1);
        const cb = ((k + oi) % 4 === 0) ? b * 0.94 : b;
        const w = WORK[o][(k + ui) % WORK[o].length];
        const id = `PL-${y}-${pad(++seq)}`;
        let segs = [];
        if (o !== 'สร. (งานอาคาร)' && ROADS[u].length) {
          for (let s = 0; s < (k % 5 === 0 ? 2 : 1); s++) {
            const a = (((k * 7 + oi * 11 + s * 23 + ui * 5) % 140) + s * 0.5) * 1000, len = (0.5 + ((k + s + oi) % 6) * 0.5) * 1000;
            segs.push({ road: ROADS[u][(k + s + oi) % ROADS[u].length], km_from_m: a, km_to_m: a + len, side: ['LT.,RT.', 'LT.', 'RT.'][(k + s) % 3] });
          }
        }
        let code = w[0], name = w[1], budget = Math.round(b * 1000) * 1000, cut = Math.round(cb * 1000) * 1000, reasons = [];
        const nR = g === 2 ? 1 + (k % 2) : (g >= 3 && r % 3 === 0 ? 1 : 0);
        for (let q = 0; q < nR; q++) reasons.push(REASONS[(k + q + oi) % REASONS.length]);
        if (y === 2570 && ui === 1 && oi === 0 && k === 0) { code = '22000'; name = 'งานเสริมผิวแอสฟัลต์'; segs = [{ road: 'ทล.101', km_from_m: 1000, km_to_m: 3000, side: 'LT.,RT.' }, { road: 'ทล.1083', km_from_m: 5200, km_to_m: 6000, side: 'LT.' }]; budget = 4500000; cut = 4230000; g = 1; reasons = []; }
        if (y === 2570 && ui === 1 && oi === 0 && k === 1) { code = '22000'; name = 'งานเสริมผิวแอสฟัลต์'; segs = [{ road: 'ทล.11', km_from_m: 120000, km_to_m: 122500, side: 'RT.' }]; budget = 3200000; cut = 3200000; g = 2; reasons = ['ปริมาณงานไม่ตรงแบบ', 'ขาดภาพถ่ายสภาพทาง']; }
        if (y === 2570 && ui === 1 && oi === 0 && k === 11) { code = '21500'; name = 'งานฉาบผิวแอสฟัลต์ (Slurry Seal)'; segs = [{ road: 'ทล.1023', km_from_m: 12000, km_to_m: 18000, side: 'LT.,RT.' }]; budget = 2650000; cut = 2650000; g = 0; reasons = []; }
        const status = g === 0 ? (ui === 0 ? 's0' : 's1') : 's' + (g + 1);
        Plans.push({ plan_id: id, fiscal_year: y, unit: u, office: o, work_code: code, work_name: name, budget, budget_cut: cut, status, created_by: 'P06', created_at: `${y - 544}-09-25T11:00:00`, note: '' });
        segs.forEach((s, i) => Segments.push(Object.assign({ seg_id: id + '-S' + (i + 1), plan_id: id, seq: i + 1 }, s)));
        const base = new Date(y - 544, 9, 1);
        if (g >= 1) StatusLog.push({ log_id: 'LG-' + pad(++lg), plan_id: id, from_status: ui ? 's1' : 's0', to_status: 's2', reason: '', round_no: '', by_user: 'P06', at: `${y - 544}-10-01T09:20:00` });
        reasons.forEach((rs, i) => StatusLog.push({ log_id: 'LG-' + pad(++lg), plan_id: id, from_status: 's2', to_status: 's3', reason: rs, round_no: i + 1, by_user: REV[u] || 'P02', at: `${y - 544}-10-0${3 + i * 5}T14:00:00` }));
        if (g >= 3) StatusLog.push({ log_id: 'LG-' + pad(++lg), plan_id: id, from_status: 's2', to_status: 's4', reason: '', round_no: '', by_user: REV[u] || 'P02', at: `${y - 544}-10-11T10:00:00` });
        if (g >= 4) StatusLog.push({ log_id: 'LG-' + pad(++lg), plan_id: id, from_status: 's4', to_status: 's5', reason: '', round_no: '', by_user: 'P06', at: `${y - 543}-01-15T10:00:00` });
        void base;
      }
    }));
  });

  const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return `${x.getFullYear()}-${pad(x.getMonth() + 1, 2)}-${pad(x.getDate(), 2)}`; };
  const Meetings = [
    ['MT-0001', d(-6), '09:00', '12:00', 'meet', 'ประชุมประจำเดือนส่วนแผนงาน', 'ห้องประชุมชั้น 2', '', '', 'FL-0005'],
    ['MT-0002', d(2), '09:30', '12:00', 'online', 'ประชุมติดตามแผนงบประมาณ ปี 2570', 'ห้องประชุมชั้น 2 / Zoom', 'https://zoom.us/', '', 'FL-0001'],
    ['MT-0003', d(2), '13:30', '16:00', 'field', 'ตรวจแผนงานร่วมกับแขวง 3', 'แขวงทางหลวงน่านที่ 1', '', '', '', 18.7826, 100.7787],
    ['MT-0004', d(4), '10:00', '11:30', 'online', 'ชี้แจงคำขอ สร. (งานอาคาร) ทุกแขวง', 'Zoom', 'https://zoom.us/', '', ''],
    ['MT-0005', d(7), '10:00', '12:00', 'inspect', 'ตรวจรับงานเสริมผิวแอสฟัลต์ ทล.1124', 'หน้างาน แขวง 5', '', '', ''],
    ['MT-0006', d(15), '10:00', '12:00', 'online', 'ประชุมพิจารณาแผนกับกรม', 'Zoom', 'https://zoom.us/', '', 'FL-0006'],
    ['MT-0007', d(9), '09:30', '12:00', 'meet', 'ประชุมร่วมสำนักงานจังหวัดแพร่', 'ศาลากลางจังหวัดแพร่', '', '', '', 18.1450, 100.1405]
  ].map((r) => ({ meeting_id: r[0], date: r[1], start: r[2], end: r[3], kind: r[4], title: r[5], place: r[6], online_link: r[7], plan_id: r[8], file_id: r[9], notify_line: true, status: 'normal', created_by: 'P06', lat: r[10] ?? '', lng: r[11] ?? '', map_url: '' }));
  const MA = { 'MT-0001': ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08'], 'MT-0002': ['P01', 'P02', 'P03', 'P06'], 'MT-0003': ['P03', 'P04'], 'MT-0004': ['P02', 'P05'], 'MT-0005': ['P04', 'P05'], 'MT-0006': ['P01', 'P02'] };
  const MeetingAttendees = []; Object.keys(MA).forEach((m) => MA[m].forEach((u) => MeetingAttendees.push({ meeting_id: m, user_id: u })));
  const Orders = [
    ['OD-0001', 'ทล 0811/2231', 'ขอข้อมูลแผนงาน สร. (งานอาคาร) ปี 2571 ทุกแขวง', 'มอบ วศ. รวบรวมเสนอ', d(2), 'doing', ['P02', 'P05']],
    ['OD-0002', 'ทล 0811/2198', 'จัดทำสรุปผลการเบิกจ่ายไตรมาส 4', 'ดำเนินการด่วน', d(-3), 'doing', ['P02']],
    ['OD-0003', 'ทล 0811/2240', 'ตรวจสอบราคากลางงานไฟฟ้าแสงสว่าง แขวง 4', 'ตรวจและรายงาน', d(8), 'ack', ['P03']],
    ['OD-0004', 'ทล 0811/2245', 'เตรียมข้อมูลประกอบการประชุมกับกรม', 'เตรียมสไลด์และตาราง', d(14), 'ack', ['P03', 'P06']],
    ['OD-0005', 'ทล 0811/2150', 'สำรวจความต้องการครุภัณฑ์ปี 2571', 'ทราบ ดำเนินการ', d(-7), 'done', ['P04']]
  ];
  const OrderAssignees = [];
  const OrdersRows = Orders.map((r) => { r[6].forEach((u) => OrderAssignees.push({ order_id: r[0], user_id: u })); return { order_id: r[0], doc_no: r[1], title: r[2], instruction: r[3], ordered_by: 'P01', due_date: r[4], status: r[5], file_id: '', created_by: 'P06', created_at: nowIso() }; });
  const Files = [
    ['FL-0001', 'หนังสือเชิญประชุม_ติดตามแผน2570.pdf', 'pdf', 1250000, 'P06', 0, '', '', ''],
    ['FL-0002', 'ราคาสืบ_วัสดุ_ต.ค.69.xlsx', 'xlsx', 86000, 'P04', 0, '', '', ''],
    ['FL-0003', 'แบบ_ทล1023_slurry_seal.pdf', 'pdf', 4800000, 'P03', -1, '', '', ''],
    ['FL-0004', 'บันทึกข้อความ_ขอข้อมูล_สร.docx', 'docx', 120000, 'P06', -3, '', '', ''],
    ['FL-0005', 'ระเบียบวาระประชุม_ประจำเดือน.pdf', 'pdf', 640000, 'P06', -9, 'หนังสือประชุม', 'meeting', 'MT-0001'],
    ['FL-0006', 'หนังสือเชิญ_ประชุมกับกรม.pdf', 'pdf', 410000, 'P06', -10, 'หนังสือประชุม', 'meeting', 'MT-0006'],
    ['FL-0007', 'แผนงาน_สผ_แขวง1_2570.xlsx', 'xlsx', 210000, 'P02', -10, 'แผนงาน', 'plan', 'PL-2570-0002'],
    ['FL-0008', 'คำสั่งแต่งตั้งคณะทำงานจัดทำแผน.pdf', 'pdf', 310000, 'P06', -14, 'งานสั่งการ', 'order', 'OD-0005']
  ].map((r) => ({ file_id: r[0], name: r[1], ext: r[2], size_bytes: r[3], sent_by: r[4], sent_at: d(r[5]) + 'T10:00:00', category: r[6], link_type: r[7], link_id: r[8], drive_file_id: '', drive_url: 'https://drive.google.com/', line_message_id: '' }));
  const Fuel = [];
  const PROV = [['แพร่', 32.94, 37.75], ['น่าน', 33.14, 37.95], ['พะเยา', 33.04, 37.85], ['เชียงราย', 33.09, 37.90], ['กรุงเทพฯ', 32.04, 36.85]];
  for (let i = 14; i >= 0; i--) PROV.forEach((p) => { const dd = d(-i), w = Math.sin(i / 3) * 0.3; Fuel.push({ date: dd, province: p[0], fuel: 'ดีเซล', price: +(p[1] - w).toFixed(2), source: 'ตัวอย่าง' }, { date: dd, province: p[0], fuel: 'แก๊สโซฮอล์ 95', price: +(p[2] + w).toFixed(2), source: 'ตัวอย่าง' }); });
  const Leaves = [
    ['LV-0001', 'P03', 'vacation', d(3), d(5), 'พักผ่อนประจำปี'],
    ['LV-0002', 'P04', 'sick', d(1), d(1), ''],
    ['LV-0003', 'P06', 'personal', d(-2), d(-2), 'ธุระส่วนตัว']
  ].map((r) => ({ leave_id: r[0], user_id: r[1], kind: r[2], date_from: r[3], date_to: r[4], note: r[5], created_by: r[1], created_at: nowIso() }));
  const ym = (off) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() + off); return x.getFullYear() + '-' + pad(x.getMonth() + 1, 2); };
  const MatDocs = [], MatPrices = [], PV = ['แพร่', 'น่าน', 'พะเยา', 'เชียงราย'];
  const doc = (kind, source, period, extra, rows) => {
    const id = 'MD-' + pad(MatDocs.length + 1);
    MatDocs.push(Object.assign({ doc_id: id, kind, source, period, doc_no: '', doc_date: '', note: '', file_url: '', created_by: 'P06', created_at: nowIso() }, extra));
    rows.forEach((r) => MatPrices.push(Object.assign({ doc_id: id, area: '-', price: '', price2: '', unit: '' }, r)));
  };
  const TPSO = { 'AC 60/70': 43366.67, 'AC 40/50': 51800, 'MC-70': 51730, PMA: 62150, 'CSS-1': 36013.33, 'CRS-2': 35946.67, 'CMS-2h': 36893.33, 'CSS-1h': 42000, 'CSS-1h (EMA)': 50500, EAP: 39326.67 };
  doc('asphalt', 'พาณิชย์', ym(-1), { note: 'ราคาส่วนกลาง • ไม่รวม VAT' }, Object.entries(TPSO).map(([item, p]) => ({ item, price: p, unit: 'ตัน' })));
  doc('asphalt', 'พาณิชย์', ym(0), { note: 'ราคาส่วนกลาง • ไม่รวม VAT' }, Object.entries(TPSO).map(([item, p]) => ({ item, price: +(p * 1.012).toFixed(2), unit: 'ตัน' })));
  const TIPCO = { 'AC 60/70': [41300, 8960], 'AC 40/50': [44800, 9660], 'PARA AC': [49300, 10560], 'MC-70': [60800, 12860], PMA: [54300, 11560], 'CSS-1': [36300, 7960], 'CRS-2': [36100, 7920], 'CMS-2h': [36500, 8000], 'CSS-1h': [36500, 8000], 'CSS-1h (EMA)': [46000, 9900], EAP: [41500, 9000], 'CRS-1P': [51700, 11040] };
  doc('asphalt', 'Tipco', ym(-1), { doc_no: 'QUO.013/2569', doc_date: ym(-1) + '-01' }, Object.entries(TIPCO).map(([item, p]) => ({ item, price: p[0], price2: p[1] })));
  const QUARRY = { หินคลุก: [290, 380, 300, 310], หินฝุ่น: [320, 410, 350, 330], 'หิน 3/8"': [350, 420, 400, 410], 'หิน 1/2"': [430, 450, 420, 440], 'หิน 3/4"': [430, 420, 410, 410], 'หิน 1"': [430, 420, 410, 410], หินผสมคอนกรีต: [430, 420, 390, 410], หินใหญ่: [410, 380, 400, 410], ทรายผสมคอนกรีต: [350, 440, 190, 140], ทรายถม: [200, 250, 140, 120], ดินถม: [30, 30, 30, 30], 'วัสดุคัดเลือก "ก"': [40, 40, 40, 40], วัสดุลูกรัง: [50, 50, 50, 50] };
  doc('quarry', 'สทล.2', d(-28), { doc_no: 'สรุปราคาวัสดุที่แหล่ง ปีงบ 2570', note: 'ไม่รวม VAT 7%' }, Object.entries(QUARRY).flatMap(([item, ps]) => ps.map((price, i) => ({ item, area: PV[i], price }))));
  const CONC = [['180 กก./ตร.ซม. และรูปทรงกระบอก 140 กก./ตร.ซม.', 1985.98], ['210 กก./ตร.ซม. และรูปทรงกระบอก 180 กก./ตร.ซม.', 2032.71], ['240 กก./ตร.ซม. และรูปทรงกระบอก 210 กก./ตร.ซม.', 2079.44]];
  doc('concrete', 'พาณิชย์จังหวัด', ym(-1), { note: 'ไม่รวม VAT' }, PV.flatMap((a, i) => ['ตรานกอินทรี', 'ตรา ทีพีไอ'].flatMap((b, j) => CONC.map(([s, p]) => ({ item: `คอนกรีตผสมเสร็จรูปลูกบาศก์ ${s} ${b}`, area: a, price: +(p - j * 160 + i * 25).toFixed(2), unit: 'ลบ.ม.' })))));
  doc('cement', 'พาณิชย์จังหวัด', ym(-1), { note: 'ไม่รวม VAT' }, PV.flatMap((a, i) => [['ปูนซีเมนต์ปอร์ตแลนด์ ประเภท 1 ตราช้าง', 152], ['ปูนซีเมนต์ผสม ตราเสือ', 128]].map(([item, p]) => ({ item, area: a, price: p + i * 2, unit: 'ถุง' }))));
  const STEEL = [['เหล็กเส้นกลมผิวเรียบ SR.24 มอก. 20-2559 ขนาดเส้นผ่านศูนย์กลาง 6 มม. ยาว 10 เมตร', 20200], ['เหล็กเส้นกลมผิวเรียบ SR.24 มอก. 20-2559 ขนาดเส้นผ่านศูนย์กลาง 9 มม. ยาว 10 เมตร', 19450], ['เหล็กเส้นกลมข้ออ้อย SD.40 มอก. 24-2559 ขนาดเส้นผ่านศูนย์กลาง 12 มม. ยาว 10 เมตร', 19300], ['เหล็กเส้นกลมข้ออ้อย SD.40 มอก. 24-2559 ขนาดเส้นผ่านศูนย์กลาง 16 มม. ยาว 10 เมตร', 19100]];
  doc('steel', 'พาณิชย์จังหวัด', ym(-1), { note: 'ไม่รวม VAT • กรุงเทพฯ = ราคาส่วนกลาง' }, ['กรุงเทพฯ'].concat(PV).flatMap((a, i) => STEEL.map(([item, p]) => ({ item, area: a, price: i ? +(p * (1.12 + i * 0.02)).toFixed(2) : p, unit: 'ตัน' }))));
  const DIA = ['0.30', '0.40', '0.60', '0.80', '1.00', '1.20', '1.50'];
  const pipe = (unit, rows) => doc('pipe', unit, ym(-1), { doc_no: 'ข้อมูลราคาและแหล่งวัสดุ สทล.2', note: 'ราคา ณ แหล่ง บาท/ม. • ไม่รวม VAT 7% • ไม่รวมค่าขนส่ง' }, rows.flatMap(([f, loc, c2, c3]) => DIA.map((d, i) => ({ item: f, area: d, price: c2[i] ?? '', price2: c3[i] ?? '', unit: loc })).filter((r) => r.price !== '' || r.price2 !== '')));
  pipe('แขวง 1', [['โรงหล่อท่อ หจก.โชคจรรคอนกรีต', 'ทล.101 กม.231+800 LT • ต.แม่จั๊วะ อ.เด่นชัย จ.แพร่ • 17.99375, 100.09818', [null, 611, 845, 1430, 2730, 3705], [null, 470, 650, 1100, 2100, 2850]],
    ['โรงหล่อท่อ หจก.โกศัยคอนกรีต', 'ทล.129 กม.2+100 LT • ต.นาจักร อ.เมือง จ.แพร่ • 18.120443, 100.15543', [null, 732, 1224, 2280, 3144, 5100], [null, 576, 972, 1800, 2520, 4080]]]);
  pipe('แขวง 3', [['โรงหล่อท่อ บจก.ทรัพย์แสงดาว', 'ทล.101 กม.357+755 RT • ต.ดู่ใต้ อ.เมือง จ.น่าน • 18.703817, 100.74942', [null, 900, 1350, 2450, 3500, 5600, 8500], [null, 780, 1180, 1950, 2750, 4500, 7200]]]);
  const Trips = [{ trip_id: 'TR-0001', date_from: d(1), date_to: d(2), title: 'ตรวจสอบแผนงานร่วมกับแขวง', place: 'แขวงทางหลวงน่านที่ 1', members: 'P03,P04', note: 'รถราชการ', created_by: 'P03', created_at: nowIso() }];
  return { cfg, db: { Trips, Plans, Segments, StatusLog, Meetings, MeetingAttendees, Orders: OrdersRows, OrderAssignees, Files, Users, Fuel, Leaves, MatDocs, MatPrices }, sessions: {} };
}

let DB = null;
function db() {
  if (DB) return DB;
  try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
  if (!DB) { DB = seed(); persist(); }
  return DB;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
export function resetDemo() { DB = seed(); persist(); }

const pub = (u) => { const o = Object.assign({}, u); delete o._pw; o.has_password = !!u._pw; return o; };
const role = (u) => db().cfg.cfg_Roles.find((r) => r.role === u.role) || {};
const can = (u, k) => T(u.is_admin) || T(role(u)[k]);
const need = (u, k, m) => { if (!can(u, k)) throw new Error(m || 'คุณไม่มีสิทธิ์ทำรายการนี้'); };
const nextId = (rows, key, prefix) => { let m = 0; rows.forEach((r) => { const s = String(r[key]); if (s.indexOf(prefix) === 0) m = Math.max(m, parseInt(s.slice(prefix.length), 10) || 0); }); return prefix + pad(m + 1); };
const upsert = (rows, key, obj) => { const i = rows.findIndex((r) => r[key] === obj[key]); if (i >= 0) { rows[i] = Object.assign({}, rows[i], obj); return rows[i]; } rows.push(obj); return obj; };
const session = (u) => { const t = 'demo-' + Math.random().toString(36).slice(2); db().sessions[t] = u.user_id; persist(); return { token: t, user: pub(u) }; };

function savePlanCore(u, plan, segments) {
  const D = db().db;
  if (!/^\d{4}$/.test(String(plan.fiscal_year))) throw new Error('ปีงบต้องเป็นตัวเลข 4 หลัก');
  const idc = String(plan.id_code ?? '').trim(), wc = String(plan.work_code ?? '').trim();
  if (!idc && !wc) throw new Error('กรุณาใส่ ID CODE หรือรหัสงาน');
  if (idc && !/^\d{4,12}$/.test(idc)) throw new Error('ID CODE ต้องเป็นตัวเลข');
  if (wc && !/^\d{4,12}$/.test(wc)) throw new Error('รหัสงานต้องเป็นตัวเลข');
  if (!String(plan.work_name || '').trim()) throw new Error('กรุณาใส่ชื่องาน');
  if (!(Number(plan.budget) > 0)) throw new Error('งบประมาณต้องมากกว่า 0');
  if (plan.budget_cut === '' || plan.budget_cut == null) plan.budget_cut = plan.budget;
  if (Number(plan.budget_cut) > Number(plan.budget)) throw new Error('วงเงินหลังปรับลดต้องไม่เกินงบที่ได้รับ');
  if (!db().cfg.cfg_Units.some((x) => x.name === plan.unit)) throw new Error('ไม่รู้จักหน่วยงาน "' + plan.unit + '"');
  if (!db().cfg.cfg_Offices.some((x) => x.short === plan.office)) throw new Error('ไม่รู้จักสำนัก "' + plan.office + '"');
  segments.forEach((s, i) => { if (!(Number(s.km_to_m) >= Number(s.km_from_m))) throw new Error('ช่วงที่ ' + (i + 1) + ': กม.สิ้นสุด ต้องไม่น้อยกว่า กม.เริ่ม'); });
  if (!plan.plan_id) {
    plan.plan_id = nextId(D.Plans, 'plan_id', 'PL-' + plan.fiscal_year + '-');
    plan.created_by = u.user_id; plan.created_at = nowIso();
    plan.status = plan.status || ((db().cfg.cfg_Units.find((x) => x.name === plan.unit) || {}).kind === 'เขต' ? 's0' : 's1');
  }
  plan.fiscal_year = Number(plan.fiscal_year); plan.budget = Number(plan.budget); plan.budget_cut = Number(plan.budget_cut); plan.work_code = wc; plan.id_code = idc;
  const saved = upsert(D.Plans, 'plan_id', plan);
  D.Segments = D.Segments.filter((s) => s.plan_id !== plan.plan_id);
  const segRows = segments.map((s, i) => ({ seg_id: plan.plan_id + '-S' + (i + 1), plan_id: plan.plan_id, seq: i + 1, road: s.road, km_from_m: Number(s.km_from_m), km_to_m: Number(s.km_to_m), side: s.side, control: s.control || '', section: s.section || '', parallel: s.parallel || '' }));
  D.Segments.push(...segRows);
  return { plan: saved, segments: segRows };
}

const ACTIONS = {
  ping: () => ({ version: 'demo' }),
  login: (p) => {
    const u = db().db.Users.find((x) => x.username && x.username.toLowerCase() === String(p.username || '').trim().toLowerCase());
    if (!u || u._pw !== p.password) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (โหมดสาธิต: รหัสผ่าน demo1234)');
    if (u.status === 'pending') throw new Error('บัญชียังรอผู้ดูแลระบบยืนยันตัวตน');
    if (u.status === 'locked') throw new Error('บัญชีนี้ถูกล็อก');
    return session(u);
  },
  lineLogin: () => ({ needRegister: true, lineName: '[ชื่อใน LINE]', picture: '', candidates: db().db.Users.filter((x) => !x.has_line && !x._pw && x.role !== 'ผู้เยี่ยมชม').map((x) => ({ user_id: x.user_id, full_name: x.full_name, position: x.position, role: x.role })) }),
  lineRegister: (p) => {
    const u = db().db.Users.find((x) => x.user_id === p.user_id);
    if (!u || u.has_line) throw new Error('ชื่อนี้ถูกลงทะเบียนแล้ว');
    if (u._pw) throw new Error('ชื่อนี้มีบัญชีอยู่แล้ว — เข้าด้วยชื่อผู้ใช้ แล้วเชื่อม LINE ที่หน้าโปรไฟล์');
    if (!/^[A-Za-z0-9._]{4,}$/.test(String(p.username || ''))) throw new Error('ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข อย่างน้อย 4 ตัว');
    if (db().db.Users.some((x) => x.username && x.username.toLowerCase() === p.username.toLowerCase())) throw new Error('ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    if (String(p.password || '').length < 8) throw new Error('รหัสผ่านอย่างน้อย 8 ตัวอักษร');
    Object.assign(u, { has_line: true, username: p.username, _pw: p.password, status: 'pending' }); persist();
    return { pending: true };
  },
  bootstrap: (p, u) => {
    const C = db().cfg, D = db().db, internal = can(u, 'view_internal');
    const out = { user: pub(u), perms: role(u), cfg: {}, db: {} };
    Object.keys(C).forEach((t) => { if (internal || ['cfg_Units', 'cfg_Offices', 'cfg_Rounds', 'cfg_Status'].includes(t)) out.cfg[t] = C[t]; });
    if (!internal) { out.db = { Plans: D.Plans, Segments: D.Segments, StatusLog: D.StatusLog.map((l) => ({ log_id: l.log_id, plan_id: l.plan_id, to_status: l.to_status })) }; return JSON.parse(JSON.stringify(out)); }
    Object.keys(D).forEach((t) => (out.db[t] = D[t]));
    out.db.Users = D.Users.map(pub);
    return JSON.parse(JSON.stringify(out));
  },
  logout: (p) => { delete db().sessions[p.token]; persist(); return { ok: true }; },
  savePlan: (p, u) => { need(u, 'edit_plan', 'บทบาทของคุณลงทะเบียน/แก้ไขแผนไม่ได้'); const r = savePlanCore(u, p.plan, p.segments || []); persist(); return r; },
  bulkPlans: (p, u) => { need(u, 'edit_plan'); const saved = (p.items || []).map((it) => savePlanCore(u, it.plan, it.segments || [])); persist(); return { saved }; },
  deletePlan: (p, u) => {
    need(u, 'edit_plan', 'บทบาทของคุณลบแผนไม่ได้');
    const D = db().db, id = String(p.plan_id || '');
    if (!D.Plans.some((x) => x.plan_id === id)) throw new Error('ไม่พบแผน');
    D.Plans = D.Plans.filter((x) => x.plan_id !== id); D.Segments = D.Segments.filter((x) => x.plan_id !== id); D.StatusLog = D.StatusLog.filter((x) => x.plan_id !== id);
    D.Files.forEach((f) => { if (f.link_type === 'plan' && f.link_id === id) { f.link_type = ''; f.link_id = ''; } });
    D.Meetings.forEach((m) => { if (m.plan_id === id) m.plan_id = ''; });
    persist(); return { plan_id: id };
  },
  changeStatus: (p, u) => {
    need(u, 'update_status', 'บทบาทของคุณอัปเดตสถานะแผนไม่ได้');
    const D = db().db, plan = D.Plans.find((x) => x.plan_id === p.plan_id);
    if (!plan) throw new Error('ไม่พบแผน');
    const unit = db().cfg.cfg_Units.find((x) => x.name === plan.unit) || {};
    if (unit.reviewer_id !== u.user_id && !T(u.is_admin) && !['หัวหน้า', 'ธุรการ'].includes(u.role)) throw new Error('อัปเดตได้เฉพาะผู้ตรวจของ ' + plan.unit);
    const st = db().cfg.cfg_Status.find((s) => s.status_code === p.to);
    if (!st) throw new Error('ไม่รู้จักสถานะ');
    if (T(st.need_reason) && !String(p.reason || '').trim()) throw new Error('ต้องระบุเหตุผล');
    const round = T(st.need_reason) ? D.StatusLog.filter((l) => l.plan_id === plan.plan_id && l.to_status === p.to).length + 1 : '';
    const log = { log_id: nextId(D.StatusLog, 'log_id', 'LG-'), plan_id: plan.plan_id, from_status: plan.status, to_status: p.to, reason: String(p.reason || '').trim(), round_no: round, by_user: u.user_id, at: nowIso() };
    D.StatusLog.push(log); plan.status = p.to; persist();
    return { plan, log };
  },
  saveMeeting: (p, u) => {
    need(u, 'manage_meeting', 'บทบาทของคุณจัดการประชุมไม่ได้');
    const D = db().db, m = Object.assign({}, p.meeting);
    if (!String(m.title || '').trim()) throw new Error('กรุณาใส่ชื่อเรื่อง');
    if (!m.date) throw new Error('กรุณาเลือกวันที่');
    if (!m.meeting_id) { m.meeting_id = nextId(D.Meetings, 'meeting_id', 'MT-'); m.created_by = u.user_id; m.status = m.status || 'normal'; }
    const saved = upsert(D.Meetings, 'meeting_id', m);
    D.MeetingAttendees = D.MeetingAttendees.filter((a) => a.meeting_id !== m.meeting_id).concat((p.attendees || []).map((x) => ({ meeting_id: m.meeting_id, user_id: x })));
    persist(); return { meeting: saved, attendees: p.attendees || [] };
  },
  deleteMeeting: (p, u) => {
    need(u, 'manage_meeting', 'บทบาทของคุณจัดการประชุมไม่ได้');
    const D = db().db;
    if (!D.Meetings.some((m) => m.meeting_id === p.meeting_id)) throw new Error('ไม่พบประชุม');
    D.Meetings = D.Meetings.filter((m) => m.meeting_id !== p.meeting_id);
    D.MeetingAttendees = D.MeetingAttendees.filter((a) => a.meeting_id !== p.meeting_id);
    D.Files.forEach((f) => { if (f.link_type === 'meeting' && f.link_id === p.meeting_id) { f.link_type = ''; f.link_id = ''; } });
    persist(); return { meeting_id: p.meeting_id };
  },
  saveOrder: (p, u) => {
    need(u, 'record_order', 'บทบาทของคุณบันทึกงานสั่งการไม่ได้');
    const D = db().db, o = Object.assign({}, p.order);
    if (!String(o.doc_no || '').trim() || !String(o.title || '').trim()) throw new Error('กรุณากรอกเลขที่หนังสือและเรื่อง');
    if (!(p.assignees || []).length) throw new Error('เลือกผู้รับมอบอย่างน้อย 1 คน');
    if (!o.order_id) { o.order_id = nextId(D.Orders, 'order_id', 'OD-'); o.created_by = u.user_id; o.created_at = nowIso(); o.status = o.status || 'ack'; }
    const saved = upsert(D.Orders, 'order_id', o);
    D.OrderAssignees = D.OrderAssignees.filter((a) => a.order_id !== o.order_id).concat(p.assignees.map((x) => ({ order_id: o.order_id, user_id: x })));
    persist(); return { order: saved, assignees: p.assignees };
  },
  moveOrder: (p, u) => {
    const D = db().db;
    if (!D.OrderAssignees.some((a) => a.order_id === p.order_id && a.user_id === u.user_id)) need(u, 'record_order', 'ย้ายได้เฉพาะผู้รับมอบงานนี้');
    const o = D.Orders.find((x) => x.order_id === p.order_id); o.status = p.status; persist(); return { order: o };
  },
  saveLeave: (p, u) => {
    const D = db().db, elevated = T(u.is_admin) || ['หัวหน้า', 'ธุรการ'].includes(u.role);
    const l = Object.assign({}, p.leave);
    if (!l.date_from || !l.date_to) throw new Error('กรุณาเลือกวันที่');
    if (String(l.date_to) < String(l.date_from)) throw new Error('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');
    if (!db().cfg.cfg_LeaveKinds.some((k) => k.kind_id === l.kind)) throw new Error('ไม่รู้จักประเภทการลา');
    if (l.leave_id) {
      const old = D.Leaves.find((x) => x.leave_id === l.leave_id);
      if (!old) throw new Error('ไม่พบรายการวันลา');
      if (!elevated && old.user_id !== u.user_id) throw new Error('แก้ไขได้เฉพาะวันลาของตัวเอง');
      l.user_id = old.user_id; delete l.created_by; delete l.created_at;
    } else {
      l.leave_id = nextId(D.Leaves, 'leave_id', 'LV-');
      l.user_id = elevated && l.user_id ? l.user_id : u.user_id;
      l.created_by = u.user_id; l.created_at = nowIso();
    }
    const saved = upsert(D.Leaves, 'leave_id', l); persist(); return { leave: saved };
  },
  deleteLeave: (p, u) => {
    const D = db().db, row = D.Leaves.find((x) => x.leave_id === p.leave_id);
    if (!row) throw new Error('ไม่พบรายการวันลา');
    const elevated = T(u.is_admin) || ['หัวหน้า', 'ธุรการ'].includes(u.role);
    if (!elevated && row.user_id !== u.user_id) throw new Error('ลบได้เฉพาะวันลาของตัวเอง');
    D.Leaves = D.Leaves.filter((x) => x.leave_id !== row.leave_id); persist(); return { leave_id: row.leave_id };
  },
  saveMatDoc: (p, u) => {
    need(u, 'edit_price', 'บทบาทของคุณกรอกราคาวัสดุไม่ได้');
    const D = db().db, d = Object.assign({}, p.doc), AUTO = ['พาณิชย์', 'พาณิชย์จังหวัด'];
    d.source = String(d.source || '').trim();
    if (!d.source) throw new Error('กรุณาระบุแหล่งราคา');
    if (AUTO.includes(d.source)) throw new Error(`"${d.source}" ระบบดึงให้อัตโนมัติ — ใช้ชื่อแหล่งอื่น`);
    if (!d.period) throw new Error(d.kind !== 'quarry' ? 'กรุณาเลือกเดือน' : 'กรุณาเลือกวันที่ออกราคา');
    const has = (v) => v !== '' && v !== null && v !== undefined;
    const rows = (p.prices || []).filter((x) => x.item && (has(x.price) || has(x.price2))).map((x) => ({ item: x.item, area: x.area || '-', price: has(x.price) ? Number(x.price) : '', price2: has(x.price2) ? Number(x.price2) : '', unit: String(x.unit || '').trim() }));
    if (!rows.length) throw new Error('กรุณากรอกราคาอย่างน้อย 1 รายการ');
    const dup = D.MatDocs.find((x) => x.kind === d.kind && x.source === d.source && x.period === d.period);
    if (dup && dup.doc_id !== d.doc_id) throw new Error(`มีราคาของ ${d.source} ${d.kind !== 'quarry' ? 'เดือน' : 'วันที่'}นี้แล้ว — กดแก้ไขแทน`);
    if (!d.doc_id) { d.doc_id = nextId(D.MatDocs, 'doc_id', 'MD-'); d.created_by = u.user_id; d.created_at = nowIso(); }
    const saved = upsert(D.MatDocs, 'doc_id', d);
    D.MatPrices = D.MatPrices.filter((x) => x.doc_id !== d.doc_id).concat(rows.map((r) => Object.assign({ doc_id: d.doc_id }, r)));
    persist(); return { doc: saved, prices: D.MatPrices.filter((x) => x.doc_id === d.doc_id) };
  },
  saveTrip: (p, u) => {
    const D = db().db, x = Object.assign({}, p.trip); D.Trips = D.Trips || [];
    if (!String(x.title || '').trim()) throw new Error('กรุณาใส่เรื่อง / ภารกิจ');
    if (!x.date_from || !x.date_to) throw new Error('กรุณาเลือกวันที่');
    if (x.date_to < x.date_from) throw new Error('วันที่กลับต้องไม่ก่อนวันที่ไป');
    if (!String(x.members || '').trim()) throw new Error('เลือกผู้เดินทางอย่างน้อย 1 คน');
    if (!x.trip_id) { x.trip_id = nextId(D.Trips, 'trip_id', 'TR-'); x.created_by = u.user_id; x.created_at = nowIso(); }
    const saved = upsert(D.Trips, 'trip_id', x); persist(); return { trip: saved };
  },
  deleteTrip: (p) => { const D = db().db; D.Trips = (D.Trips || []).filter((x) => x.trip_id !== p.trip_id); persist(); return { trip_id: p.trip_id }; },
  deleteMatDoc: (p, u) => {
    need(u, 'edit_price', 'บทบาทของคุณกรอกราคาวัสดุไม่ได้');
    const D = db().db, x = D.MatDocs.find((y) => y.doc_id === p.doc_id);
    if (!x) throw new Error('ไม่พบเอกสารราคา');
    if (['พาณิชย์', 'พาณิชย์จังหวัด'].includes(x.source)) throw new Error('ราคาที่ระบบดึงอัตโนมัติลบไม่ได้');
    D.MatDocs = D.MatDocs.filter((y) => y.doc_id !== p.doc_id); D.MatPrices = D.MatPrices.filter((y) => y.doc_id !== p.doc_id);
    persist(); return { doc_id: p.doc_id };
  },
  classifyFile: (p, u) => { need(u, 'classify_file', 'บทบาทของคุณจัดหมวดไฟล์ไม่ได้'); const f = db().db.Files.find((x) => x.file_id === p.file_id); Object.assign(f, { category: p.category || '', link_type: p.link_type || '', link_id: p.link_id || '' }); persist(); return { file: f }; },
  updateProfile: (p, u) => { const f = p.fields || {}; ['nickname', 'phone', 'ext', 'email'].forEach((k) => { if (k in f) u[k] = String(f[k] || '').trim(); }); if (u.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง'); persist(); return { user: pub(u) }; },
  changePassword: (p, u) => { if (u._pw && u._pw !== p.current) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง'); if (String(p.next || '').length < 8) throw new Error('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร'); u._pw = p.next; persist(); return { ok: true }; },
  approveUser: (p, u) => { if (!T(u.is_admin)) throw new Error('เฉพาะผู้ดูแลระบบเท่านั้น'); const x = db().db.Users.find((y) => y.user_id === p.user_id); if (p.approve) Object.assign(x, { status: 'active' }); else Object.assign(x, { status: 'active', has_line: false, username: '', _pw: '' }); persist(); return { user: pub(x) }; },
  saveUser: (p, u) => {
    if (!T(u.is_admin)) throw new Error('เฉพาะผู้ดูแลระบบเท่านั้น');
    const D = db().db, x = Object.assign({}, p.user);
    if (!x.user_id) x.user_id = nextId(D.Users, 'user_id', x.role === 'ผู้เยี่ยมชม' ? 'G' : 'P');
    if (T(x.is_admin)) D.Users.forEach((y) => { if (y.user_id !== x.user_id) y.is_admin = false; });
    if (p.password) x._pw = p.password;
    const saved = upsert(D.Users, 'user_id', x); persist(); return { user: pub(saved) };
  },
  saveConfig: (p, u) => { if (!T(u.is_admin)) throw new Error('เฉพาะผู้ดูแลระบบเท่านั้น'); if (!db().cfg[p.table]) throw new Error('แก้ได้เฉพาะแท็บตั้งค่า'); db().cfg[p.table] = p.rows || []; persist(); return { rows: db().cfg[p.table] }; }
};

export function demoCall(body) {
  const pubActions = ['ping', 'login', 'lineLogin', 'lineRegister'];
  const fn = ACTIONS[body.action];
  if (!fn) throw new Error('ไม่รู้จักคำสั่ง ' + body.action);
  if (pubActions.includes(body.action)) return JSON.parse(JSON.stringify(fn(body)));
  const uid = db().sessions[body.token];
  const u = uid && db().db.Users.find((x) => x.user_id === uid);
  if (!u) { const e = new Error('กรุณาเข้าสู่ระบบใหม่'); e.auth = true; throw e; }
  return JSON.parse(JSON.stringify(fn(body, u)));
}
