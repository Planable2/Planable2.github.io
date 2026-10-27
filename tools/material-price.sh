#!/usr/bin/env bash
# ดึงราคาวัสดุจากกระทรวงพาณิชย์ (index-api.tpso.go.th) แล้วส่งเข้าระบบ (matIngest) — เรียกจาก .github/workflows/material-price.yml
#   ยางมะตอย = ราคากรุงเทพฯ (ส่วนกลาง) • คอนกรีตผสมเสร็จ / ปูนซีเมนต์ = พาณิชย์จังหวัด (จังหวัดของหน่วยงานในตั้งค่า › หน่วยงาน)
#   เหล็กเส้น (SR24 กลม / SD ข้ออ้อย รหัส 040101/040102) = พาณิชย์จังหวัด + กรุงเทพฯ (ส่วนกลาง)
#   แต่ละจังหวัดประกาศไม่พร้อมกัน → ย้อนทีละเดือนจนเจอเดือนล่าสุดของทุกจังหวัด (อย่างน้อย 6 เดือน)
#   MONTHS = ดึงอย่างน้อยกี่เดือน • ว่าง = อัตโนมัติ (ยังไม่เคยดึง → 6 เดือน, ปกติ → 1)
#   ราคาไม่รวม VAT • ไฟล์จากพาณิชย์ ~8MB/เดือน ใช้เวลาราว 1–2 นาทีต่อเดือน
set -euo pipefail
api() { curl -sS --max-time 120 -X POST -H 'Content-Type: text/plain' --data-binary @- "$API_URL"; }

CFG=$(jq -n --arg key "$FUEL_API_KEY" '{action: "ingestConfig", key: $key}' | api)
echo "$CFG" | jq -e '.ok == true' > /dev/null || { echo "อ่านค่าตั้งจากระบบไม่สำเร็จ: $CFG"; exit 1; }
PROVS=$(echo "$CFG" | jq -c '.data.provinces')
if [ -z "${MONTHS:-}" ]; then
  if [ "$(echo "$CFG" | jq -r '.data.mat_auto_docs')" = "0" ]; then MONTHS=6; else MONTHS=1; fi
fi
WANT=$(echo "$PROVS" | jq -c '["กรุงเทพฯ"] + .')
LIMIT=$(( MONTHS > 6 ? MONTHS : 6 ))
echo "จังหวัด $PROVS • ดึงอย่างน้อย $MONTHS เดือน (ย้อนได้ถึง $LIMIT)"

FOUND='[]'; LEFT="$WANT"; DOCS='[]'
MID=$(TZ=Asia/Bangkok date +%Y-%m-15)
for ((i = 0; i < LIMIT; i++)); do
  Y=$(date -d "$MID -$i month" +%Y); M=$(date -d "$MID -$i month" +%-m); PERIOD=$(date -d "$MID -$i month" +%Y-%m)
  echo "ดึงเดือน $PERIOD"
  curl -sS --max-time 240 -X POST -H 'Content-Type: application/json' -d "{\"year\":$((Y + 543)),\"month\":$M}" \
    https://index-api.tpso.go.th/OpenApi/CmiPrice/Month -o month.json || echo '[]' > month.json
  ADD=$(jq -c --arg period "$PERIOD" --argjson provs "$PROVS" '
    def nm: (.commodityNameTH // "") | gsub("\\s+"; " ") | sub("^ "; "") | sub(" $"; "");
    def inprov: .typeName as $t | any($provs[]; . == $t);
    def code: (.commodityCode // "");
    if type != "array" then [] else
    [ { kind: "asphalt", source: "พาณิชย์", period: $period, note: "ราคากรุงเทพฯ (ส่วนกลาง) • ไม่รวม VAT",
        prices: [ .[] | select(.type == "10" and .priceCur != null and (code | startswith("15050"))) | {code: .commodityCode, price: .priceCur, unit: .unitName} ] },
      { kind: "concrete", source: "พาณิชย์จังหวัด", period: $period, note: "ไม่รวม VAT",
        prices: [ .[] | select(.priceCur != null and inprov and (nm | startswith("คอนกรีตผสมเสร็จ"))) | {item: nm, area: .typeName, price: .priceCur, unit: .unitName} ] },
      { kind: "cement", source: "พาณิชย์จังหวัด", period: $period, note: "ไม่รวม VAT",
        prices: [ .[] | select(.priceCur != null and inprov and (code | (startswith("1501") or startswith("1502")))) | {item: nm, area: .typeName, price: .priceCur, unit: .unitName} ] },
      { kind: "steel", source: "พาณิชย์จังหวัด", period: $period, note: "ไม่รวม VAT • กรุงเทพฯ = ราคาส่วนกลาง",
        prices: [ .[] | select(.priceCur != null and (code | (startswith("040101") or startswith("040102"))) and (.type == "10" or inprov))
                  | {item: nm, area: (if .type == "10" then "กรุงเทพฯ" else .typeName end), price: .priceCur, unit: .unitName} ] }
    ] | map(select(.prices | length > 0)) end' month.json 2>/dev/null || echo '[]')
  GOT=$(echo "$ADD" | jq -c '[.[] | if .kind == "asphalt" then "กรุงเทพฯ" else .prices[].area end] | unique')
  echo "  ได้ $(echo "$ADD" | jq '[.[].prices | length] | add // 0') รายการ • มีราคา: $GOT"
  DOCS=$(echo "$DOCS" | jq -c --argjson add "$ADD" '. + $add')
  FOUND=$(jq -cn --argjson f "$FOUND" --argjson g "$GOT" '$f + $g | unique')
  LEFT=$(jq -cn --argjson w "$WANT" --argjson f "$FOUND" '$w - $f')
  if [ $((i + 1)) -ge "$MONTHS" ] && [ "$LEFT" = "[]" ]; then echo "เจอเดือนล่าสุดครบทุกจังหวัดแล้ว"; break; fi
done
if [ "$LEFT" != "[]" ]; then echo "ย้อน $LIMIT เดือนแล้วยังไม่พบราคาของ: $LEFT"; fi

[ "$(echo "$DOCS" | jq length)" -gt 0 ] || { echo "ไม่ได้ราคาเลย — เว็บพาณิชย์อาจล่มหรือเปลี่ยนรูปแบบ"; exit 1; }
RES=$(echo "$DOCS" | jq -c --arg key "$FUEL_API_KEY" '{action: "matIngest", key: $key, docs: .}' | api)
echo "$RES"
echo "$RES" | jq -e '.ok == true' > /dev/null
