#!/usr/bin/env bash
# ดึงราคาน้ำมันจาก PTT OR แล้วส่งเข้าระบบ (fuelIngest) — เรียกจาก .github/workflows/fuel-price.yml
# จังหวัดและชนิดน้ำมันตั้งที่หน้าเว็บ: ตั้งค่า › ค่าระบบ › fuel_provinces, fuel_types (คั่นด้วย ,)
# ชนิดที่ใช้ได้: ดีเซล, ดีเซล B20, แก๊สโซฮอล์ 91, แก๊สโซฮอล์ 95, แก๊สโซฮอล์ E20, เบนซิน, Super Power Diesel, Super Power GSH95, Super Power X99
# MONTHS ว่าง = อัตโนมัติ: ข้อมูลยังไม่ถึง 2 เดือน → ย้อน 12 เดือน • ปกติ → เดือนนี้ + เดือนก่อน
set -euo pipefail
api() { curl -sS --max-time 120 -X POST -H 'Content-Type: text/plain' --data-binary @- "$API_URL"; }

CFG=$(jq -n --arg key "$FUEL_API_KEY" '{action: "ingestConfig", key: $key}' | api)
echo "$CFG" | jq -e '.ok == true' > /dev/null || { echo "อ่านค่าตั้งจากระบบไม่สำเร็จ: $CFG"; exit 1; }
PROVS=$(echo "$CFG" | jq -c '.data.fuel_provinces')
TYPES=$(echo "$CFG" | jq -c '.data.fuel_types')
SINCE=$(echo "$CFG" | jq -r '.data.fuel_since')
if [ -z "${MONTHS:-}" ]; then
  if [ -z "$SINCE" ] || [[ "$SINCE" > "$(date -d '-60 days' +%Y-%m-%d)" ]]; then MONTHS=12; else MONTHS=2; fi
fi
echo "จังหวัด $PROVS • ชนิด $TYPES • ดึง $MONTHS เดือน (ในระบบมีตั้งแต่ ${SINCE:-ยังไม่มี})"

ptt() {  # $1 = province (ชื่อในระบบ)
  if [ "$1" = "กรุงเทพฯ" ] || [ "$1" = "กรุงเทพมหานคร" ]; then
    curl -sS --max-time 60 -X POST https://www.pttor.com/wp-admin/admin-ajax.php --data-urlencode "action=fetch_oil_prices" \
      --data-urlencode "province=กรุงเทพมหานคร" --data-urlencode "month=$MONTH" --data-urlencode "year=$YEAR_BE" || echo '{}'
  else
    curl -sS --max-time 60 -X POST https://www.pttor.com/wp-admin/admin-ajax.php --data-urlencode "action=fetch_regional_oil_prices" \
      --data-urlencode "province=$1" --data-urlencode "district=เมือง$1" --data-urlencode "month=$MONTH" --data-urlencode "year=$YEAR_BE" || echo '{}'
  fi
}

ROWS='[]'
MID=$(TZ=Asia/Bangkok date +%Y-%m-15)
for ((i = 0; i < MONTHS; i++)); do
  YEAR_BE=$(( $(date -d "$MID -$i month" +%Y) + 543 )); MONTH=$(date -d "$MID -$i month" +%-m)
  while IFS= read -r PROV; do
    ADD=$(ptt "$PROV" | jq -c --arg prov "$PROV" --argjson types "$TYPES" '
      def norm: sub("^เบนซินแก๊สโซฮอล์"; "แก๊สโซฮอล์");
      [ ((.data | if type == "object" then .rows else . end) // [])[] | . as $r
        | ($r.priceData // [])[] | (.OilTypeId | norm) as $t
        | select(.Price != null and any($types[]; . == $t))
        | {date: $r.priceDate[0:10], province: $prov, fuel: $t, price: .Price, source: "PTT OR"} ]' 2>/dev/null || echo '[]')
    echo "  $MONTH/$YEAR_BE $PROV: $(echo "$ADD" | jq length) แถว"
    ROWS=$(echo "$ROWS" | jq -c --argjson add "$ADD" '. + $add')
  done < <(echo "$PROVS" | jq -r '.[]')
done

N=$(echo "$ROWS" | jq length)
echo "รวม $N แถว"
[ "$N" -gt 0 ] || { echo "ไม่ได้ราคาเลย — เว็บ PTT OR อาจเปลี่ยนรูปแบบ หรือชื่อจังหวัด/ชนิดน้ำมันในตั้งค่าไม่ตรง"; exit 1; }
for ((s = 0; s < N; s += 400)); do   # ส่งทีละ 400 แถว กัน Edge Function หมดเวลา
  RES=$(echo "$ROWS" | jq -c --arg key "$FUEL_API_KEY" --argjson s "$s" '{action: "fuelIngest", key: $key, rows: .[$s:$s + 400]}' | api)
  echo "$RES"
  echo "$RES" | jq -e '.ok == true' > /dev/null
done
