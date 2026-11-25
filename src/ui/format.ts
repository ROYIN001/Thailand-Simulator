// การเขียนตัวเลขตาม DESIGN.md หัวข้อ "การเขียนตัวเลข" · ค่าลบใช้ U+2212 · ช่วงใช้ U+2013 · ปี พ.ศ.
// ตัวเลขที่แสดงเป็นจำนวนเต็มของหน่วยที่แสดง ปัดเศษทิ้งเข้าหาศูนย์ (กฎเดียวกับเครื่องยนต์)
export const MINUS = '−';
export const DASH = '–';

const sign = (x: number, plus: boolean): string => (x < 0 ? MINUS : plus && x > 0 ? '+' : '');
export const group = (n: number): string => String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** สตางค์ → บาท 2 ตำแหน่ง เช่น 5580 → "55.80" */
export function baht(satang: number, plus = false): string {
  const a = Math.abs(Math.trunc(satang));
  return `${sign(satang, plus)}${group(Math.trunc(a / 100))}.${String(a % 100).padStart(2, '0')}`;
}

/** สตางค์ → ล้านบาท จำนวนเต็ม เช่น −2,556,100,000,000 → "−25,561" */
export function mbaht(satang: number, plus = false): string {
  const m = Math.trunc(satang / 100_000_000);
  return `${sign(m, plus)}${group(m)}`;
}

/** basis point → ร้อยละ 2 ตำแหน่ง เช่น 73 → "+0.73%" */
export function pct(bp: number, plus = true): string {
  const a = Math.abs(Math.trunc(bp));
  return `${sign(bp, plus)}${Math.trunc(a / 100)}.${String(a % 100).padStart(2, '0')}%`;
}

/** จำนวนเต็มคั่นหลักพัน เช่น ลิตร */
export const int = (n: number, plus = false): string => `${sign(n, plus)}${group(n)}`;

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const WEEKDAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']; // 0 = จันทร์ ตามวันในสัปดาห์ของตา
export const WEEKDAYS_FULL = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

const parts = (iso: string): [number, number, number] => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`วันที่ไม่ถูกรูปแบบ: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

/** "2026-03-23" → "23 มี.ค. 2569" · year = false → "23 มี.ค." */
export function thDate(iso: string, year = true): string {
  const [y, mo, d] = parts(iso);
  return `${d} ${MONTHS[mo - 1]}${year ? ` ${y + 543}` : ''}`;
}

/** ช่วงวันที่ เช่น "23–29 มี.ค. 2569" หรือ "30 มี.ค.–5 เม.ย. 2569" */
export function thRange(a: string, b: string): string {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  if (ya === yb && ma === mb) return `${da}${DASH}${db} ${MONTHS[mb - 1]} ${yb + 543}`;
  if (ya === yb) return `${da} ${MONTHS[ma - 1]}${DASH}${db} ${MONTHS[mb - 1]} ${yb + 543}`;
  return `${thDate(a)}${DASH}${thDate(b)}`;
}
