// สร้างไฟล์ฉากของแบบ ก จากระเบียนในไฟล์ข้อมูลกลาง · ใช้เฉพาะระเบียน verified
// แปลงหน่วยครั้งเดียวที่นี่: บาท → สตางค์ (ปัดเป็นจำนวนเต็มที่ใกล้ที่สุด เพราะต้นทางมีทศนิยม 2–4 ตำแหน่ง)
// ล้านบาท → สตางค์ · พันลิตรต่อเดือน → ลิตรต่อวัน (ตัดเศษทิ้ง)
import type { FactRecord } from './schema.ts';
import type { FuelDay, Scenario, Sourced } from '../engine/scenario-types.ts';

const FIRST_DAY = '2026-03-02';
const WEEKS = 10;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysInMonth = (iso: string): number => {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function buildScenario(records: FactRecord[]): Scenario {
  const byId = new Map(records.map((r) => [r.id, r]));
  const need = (id: string): FactRecord => {
    const r = byId.get(id);
    if (!r) throw new Error(`ไม่พบระเบียน ${id}`);
    if (r.status !== 'verified') throw new Error(`ระเบียน ${id} ยังไม่ verified (${r.status})`);
    if (r.value === null) throw new Error(`ระเบียน ${id} ไม่มีค่า`);
    return r;
  };
  const real = (id: string, toUnit: (v: number) => number): Sourced => ({ v: toUnit(need(id).value as number), kind: 'real', ids: [id] });
  const millionBahtToSatang = (v: number) => {
    if (!Number.isInteger(v)) throw new Error(`ฐานะกองทุนต้องเป็นจำนวนเต็มล้านบาท: ${v}`);
    return v * 100_000_000;
  };
  const bahtToSatang = (v: number) => Math.round(v * 100);

  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(FIRST_DAY, i));
  const openingDate = addDays(FIRST_DAY, -1);

  // ระเบียนที่เป็นชุดตามวันที่ (เฉพาะ verified)
  const series = (re: RegExp): FactRecord[] =>
    records.filter((r) => re.test(r.id) && r.status === 'verified' && r.value !== null).sort((a, b) => a.asOf.localeCompare(b.asOf) || a.id.localeCompare(b.id));
  const inForce = (list: FactRecord[], date: string, what: string): FactRecord => {
    let hit: FactRecord | undefined;
    for (const r of list) if (r.asOf <= date) hit = r;
    if (!hit) throw new Error(`ไม่มี${what}ที่มีผล ณ ${date}`);
    return hit;
  };

  // ระเบียนที่บอกวันที่ราคาเปลี่ยน (ป้าย "…เป็น X บาท/ลิตร (วันที่)") · ก่อนวันนั้นราคายังเป็นค่าเดิมแน่นอน
  const isChangeEvent = (r: FactRecord): boolean => /^price\.diesel_b7\.retail_bkk\.\d{4}-\d{2}-\d{2}$/.test(r.id) && r.label.includes('เป็น');

  function fuel(rateRe: RegExp, retailRe: RegExp, salesPrefix: string): FuelDay[] {
    const rates = series(rateRe);
    const retails = series(retailRe);
    return days.map((date) => {
      const r = inForce(rates, date, 'อัตรา');
      const p = inForce(retails, date, 'ราคาขายปลีก');
      const month = date.slice(0, 7);
      const sid = `${salesPrefix}.${month}`;
      const s = need(sid);
      const dim = daysInMonth(date);
      const next = retails.find((x) => x.asOf > date);
      // หมายเหตุของระเบียนถัดไปแบบ "Previous file YYYY-MM-DD: ค่าเดิม" ยืนยันว่าราคาเดิมยังใช้อยู่ถึงวันนั้น
      const prevFile = next ? /Previous file (\d{4}-\d{2}-\d{2})/.exec(next.notes)?.[1] : undefined;
      const confirmedUntil = prevFile !== undefined && prevFile >= date;
      const changedBeforeNext = next !== undefined && next.value !== p.value && !isChangeEvent(next) && !confirmedUntil;
      const retail: Sourced = p.asOf === date
        ? { v: bahtToSatang(p.value as number), kind: 'real', ids: [p.id] }
        : changedBeforeNext
          ? { v: bahtToSatang(p.value as number), kind: 'uncertain', ids: [p.id, (next as FactRecord).id], note: `ไม่มีระเบียนของวันนี้ ราคาเปลี่ยนจาก ${p.value} (${p.asOf}) เป็น ${(next as FactRecord).value} (${(next as FactRecord).asOf}) โดยไม่รู้วันที่เปลี่ยน · ตัวเลขนี้เป็นค่าแทนในการคำนวณเท่านั้น` }
          : { v: bahtToSatang(p.value as number), kind: 'computed', ids: [p.id], note: `ไม่มีระเบียนของวันนี้ในไฟล์ข้อมูล ใช้ค่าล่าสุดก่อนหน้า (${p.asOf})` };
      return {
        rate: { v: bahtToSatang(r.value as number), kind: 'real', ids: [r.id] },
        retail,
        volume: { v: Math.trunc(((s.value as number) * 1000) / dim), kind: 'computed', ids: [sid], note: `ยอดจำหน่ายรายเดือน (พันลิตร) × 1000 ÷ ${dim} วัน ตัดเศษ` },
      };
    });
  }

  const b7Rates = series(/^rate\.diesel_b7\.(levy|compensation)\./);
  const g95Rates = series(/^rate\.gasohol95\.(levy|compensation)\./);

  // ภาษีมูลค่าเพิ่มบนเงินกองทุน: คำนวณจากโครงสร้างราคาดีเซล B7 วันที่ 2 มี.ค. 2569
  const sid = (c: string) => `structure.diesel_b7.${c}.2026-03-02`;
  const base = ['ex_refinery', 'excise', 'municipal_tax', 'oil_fund', 'conservation_fund'].map((c) => need(sid(c)).value as number).reduce((a, b) => a + b, 0);
  const vatBpRaw = ((need(sid('vat_wholesale')).value as number) / base) * 10000;
  const vatBp = Math.round(vatBpRaw);
  if (Math.abs(vatBpRaw - vatBp) > 1) throw new Error(`อัตราภาษีที่คำนวณได้ไม่ลงตัว: ${vatBpRaw}`);

  return {
    scenarioId: 'oil-fund-2569',
    days,
    weeks: WEEKS,
    opening: {
      fundOil: real(`fund.position.oil.${openingDate}`, millionBahtToSatang),
      fundLpg: real(`fund.position.lpg.${openingDate}`, millionBahtToSatang),
    },
    sundays: Array.from({ length: WEEKS }, (_, w) => {
      const date = days[w * 7 + 6] as string;
      return { date, fundOil: real(`fund.position.oil.${date}`, millionBahtToSatang), fundLpg: real(`fund.position.lpg.${date}`, millionBahtToSatang) };
    }),
    startRates: {
      b7: { v: bahtToSatang(inForce(b7Rates, openingDate, 'อัตรา B7').value as number), kind: 'real', ids: [inForce(b7Rates, openingDate, 'อัตรา B7').id] },
      g95: { v: bahtToSatang(inForce(g95Rates, openingDate, 'อัตรา G95').value as number), kind: 'real', ids: [inForce(g95Rates, openingDate, 'อัตรา G95').id] },
    },
    vatBp: { v: vatBp, kind: 'computed', ids: ['vat_wholesale', 'ex_refinery', 'excise', 'municipal_tax', 'oil_fund', 'conservation_fund'].map(sid), note: 'ภาษีมูลค่าเพิ่มขายส่ง ÷ (ราคา ณ โรงกลั่น + สรรพสามิต + ภาษีเทศบาล + เงินกองทุน + เงินกองทุนอนุรักษ์) × 10000' },
    b7: fuel(/^rate\.diesel_b7\.(levy|compensation)\./, /^price\.(retail\.diesel_b7\.bkk|diesel_b7\.retail_bkk)/, 'sales.doeb.diesel_b7'),
    g95: fuel(/^rate\.gasohol95\.(levy|compensation)\./, /^price\.retail\.gasohol95_e10\./, 'sales.doeb.gasohol95_e10'),
  };
}
