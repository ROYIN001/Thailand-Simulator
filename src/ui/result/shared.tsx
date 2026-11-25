// ชิ้นที่จอผลสัปดาห์และบัตรรายงานใช้ร่วมกัน · เฉพาะในโฟลเดอร์นี้
import { useEffect, useRef, useState } from 'preact/hooks';
import type { DayTrace, Fuel, TurnRecord } from '../../engine/game.ts';
import { mulDiv } from '../../engine/math.ts';
import type { GameParams } from '../../engine/params.ts';
import type { FuelDay, Scenario } from '../../engine/scenario-types.ts';
import { computed, fromSourced, game, Num, type Evidence, type SourceItem } from '../evidence.tsx';
import { baht, int, mbaht, pct, thDate, WEEKDAYS_FULL } from '../format.ts';

export const FUEL_NAME: Record<Fuel, string> = { b7: 'ดีเซล B7', g95: 'แก๊สโซฮอล์ 95' };
export const UNCERTAIN_WHY = 'ราคาจริงวันนี้ไม่แน่นอน: ไม่มีระเบียนของวันนั้น และราคาเปลี่ยนก่อนระเบียนถัดไปโดยไม่รู้วันที่เปลี่ยน · ค่าที่คิดจากราคานี้จึงไม่แน่นอนด้วย';
export const PRICE_FORMULA = 'ราคาจริง × (1 + ช็อกของสัปดาห์) + (อัตราของคุณ − อัตราจริง) × 1.07 · ปัดเศษสตางค์ทิ้งทีละขั้น';

export const fundOf = (r: { fundOil: number; fundLpg: number }): number => r.fundOil + r.fundLpg;
export const openingFund = (sc: Scenario): number => sc.opening.fundOil.v + sc.opening.fundLpg.v;
/** วันก่อนหน้า (วันที่ของยอดยกมา) · อยู่นอกเครื่องยนต์ จึงใช้ Date ได้ */
export const dayBefore = (iso: string): string => new Date(Date.parse(iso) - 86_400_000).toISOString().slice(0, 10);

export const mbItem = (v: number, ev: Evidence, plus = false): SourceItem => ({ text: mbaht(v, plus), unit: 'ล้านบาท', ev });

/** ฐานะรวมจริง ณ ต้นฉาก = บัญชีน้ำมัน + บัญชี LPG (ยอดยกมาจริง) */
export const openingItem = (sc: Scenario): SourceItem =>
  mbItem(
    openingFund(sc),
    computed(
      `ฐานะกองทุนรวมจริง ณ ${thDate(dayBefore(sc.days[0] as string))} (ยอดยกมาของฉาก)`,
      'บัญชีน้ำมัน + บัญชี LPG',
      [mbItem(sc.opening.fundOil.v, fromSourced(sc.opening.fundOil, 'ฐานะบัญชีน้ำมันจริง ณ ต้นฉาก')), mbItem(sc.opening.fundLpg.v, fromSourced(sc.opening.fundLpg, 'ฐานะบัญชี LPG จริง ณ ต้นฉาก'))],
      [...sc.opening.fundOil.ids, ...sc.opening.fundLpg.ids],
    ),
  );

export const vatItem = (sc: Scenario): SourceItem => ({
  text: baht(Math.trunc((10000 + sc.vatBp.v) / 100)),
  ev: { kind: 'computed', label: 'ตัวคูณภาษีมูลค่าเพิ่มบนเงินกองทุน (1 + อัตราภาษี)', formula: sc.vatBp.note ?? '', ids: sc.vatBp.ids },
});

export const shockItem = (rec: TurnRecord, p: GameParams): SourceItem => ({
  text: pct(rec.shockBp),
  ev: game(`ช็อกราคาของตา ${rec.turn}`, `ราคาจริงทุกวันของสัปดาห์ × (1 + ช็อก) · เกมสุ่มด้วย seed สม่ำเสมอในช่วง ±${pct(p.shockMaxBp, false)} แทนเหตุที่คาดไม่ได้ · แฟ้มบอกก่อนทาย`),
});

const sourceDay = (sc: Scenario, fuel: Fuel, turn: number, i: number): FuelDay => sc[fuel][(turn - 1) * 7 + i] as FuelDay;

/** ราคาจริงของวัน: ข้อมูลจริง · ยกค่าก่อนหน้า (ค่าคำนวณ) · ไม่แน่นอน (กรอบเส้นประ ไม่แสดงค่าแทน) */
export function realRetailItem(sc: Scenario, fuel: Fuel, turn: number, i: number): SourceItem {
  const src = sourceDay(sc, fuel, turn, i);
  const label = `ราคาขายปลีก${FUEL_NAME[fuel]} กรุงเทพฯ จริง วัน${WEEKDAYS_FULL[i]} ${thDate(sc.days[(turn - 1) * 7 + i] as string)}`;
  return src.retail.kind === 'uncertain'
    ? { text: 'ไม่แน่นอน', ev: { kind: 'missing', label, formula: UNCERTAIN_WHY, ids: src.retail.ids } }
    : { text: baht(src.retail.v), unit: 'บาท/ลิตร', ev: fromSourced(src.retail, label) };
}

export function realRateItem(sc: Scenario, fuel: Fuel, turn: number, i: number): SourceItem {
  const src = sourceDay(sc, fuel, turn, i);
  return { text: baht(src.rate.v), unit: 'บาท/ลิตร', ev: fromSourced(src.rate, `อัตราเงินกองทุน${FUEL_NAME[fuel]} จริง วัน${WEEKDAYS_FULL[i]} ${thDate(sc.days[(turn - 1) * 7 + i] as string)} (ลบ = ชดเชย)`) };
}

/** ราคา ปริมาณ และเงินของหนึ่งวันในเกม พร้อมส่วนประกอบที่ตามต่อได้ ("ตามเงิน") */
export function dayItems(sc: Scenario, rec: TurnRecord, p: GameParams, fuel: Fuel, i: number) {
  const d = rec.days[fuel][i] as DayTrace;
  const src = sourceDay(sc, fuel, rec.turn, i);
  const when = `วัน${WEEKDAYS_FULL[i]} ${thDate(d.date)}`;
  const name = FUEL_NAME[fuel];
  const uncertain = src.retail.kind === 'uncertain';
  const realPrice = realRetailItem(sc, fuel, rec.turn, i);
  const rate: SourceItem = { text: baht(d.rate), unit: 'บาท/ลิตร', ev: game(`อัตราเงินกองทุน${name} ของคุณ ${when} (ลบ = ชดเชย)`, 'อัตราจากการประชุมของคุณครั้งล่าสุดที่มีผลถึงวันนี้') };
  const priceLabel = `ราคา${name} ในเกม ${when}`;
  const price: SourceItem = uncertain
    ? { text: 'ไม่แน่นอน', ev: { kind: 'missing', label: priceLabel, formula: UNCERTAIN_WHY } }
    : { text: baht(d.retail), unit: 'บาท/ลิตร', ev: computed(priceLabel, PRICE_FORMULA, [realPrice, shockItem(rec, p), rate, realRateItem(sc, fuel, rec.turn, i), vatItem(sc)]) };
  const volume: SourceItem = {
    text: int(d.volume),
    unit: 'ลิตร',
    ev: computed(
      `ปริมาณ${name} ในเกม ${when}`,
      `ปริมาณจริง × (1 + ความยืดหยุ่น × (ราคาในเกม − ราคาจริง) ÷ ราคาจริง) · ไม่ต่ำกว่าศูนย์${uncertain ? ' · วันนี้ราคาจริงไม่แน่นอน เครื่องยนต์คิดจากค่าแทน' : ''}`,
      [
        { text: int(src.volume.v), unit: 'ลิตร', ev: fromSourced(src.volume, `ปริมาณจำหน่าย${name} จริงต่อวัน ${when}`) },
        { text: baht(Math.trunc(p.elasticityBp / 100)), ev: game('ความยืดหยุ่นของปริมาณต่อราคา', 'ยังไม่มีค่าที่ตรวจแล้ว · ใช้ค่ากลางของสามชุดที่ทดลองได้') },
        price,
        realPrice,
      ],
    ),
  };
  const flow: SourceItem = {
    text: int(Math.trunc(d.flow / 100), true),
    unit: 'บาท',
    ev: computed(`เงินกองทุนจาก${name} ในเกม ${when} (บวก = เข้ากองทุน · ลบ = ชดเชย)`, 'อัตราของคุณ × ปริมาณในเกม', [rate, volume]),
  };
  return { price, realPrice, flow, uncertain };
}

/** คำตอบของการทายแยกเป็นขั้น ตามสูตรเดียวกับ guessTarget ในเครื่องยนต์ · มีเทสต์ว่ารวมแล้วเท่ากับ record.guessTarget */
export function answerSteps(sc: Scenario, rec: TurnRecord) {
  const sun = rec.days.b7[6] as DayTrace;
  const shocked = sun.realRetail + mulDiv(sun.realRetail, rec.shockBp, 10000);
  const diff = sc.startRates.b7.v - sun.realRate;
  const vatPart = mulDiv(diff, 10000 + sc.vatBp.v, 10000);
  return { sun, shocked, diff, vatPart, answer: shocked + vatPart };
}



/** SourceItem เป็นตัวเลขบนจอ */
export const It = ({ i, strong = false }: { i: SourceItem; strong?: boolean }) =>
  i.unit ? <Num v={i.text} unit={i.unit} ev={i.ev} strong={strong} /> : <Num v={i.text} ev={i.ev} strong={strong} />;

/** อัตราเป็นคำคู่ค่าสัมบูรณ์ เช่น "ชดเชย 15.00 บาท/ลิตร" */
export const Rate = ({ r, ev, unit = true }: { r: number; ev: Evidence; unit?: boolean }) => (
  <span class="nowrap">
    {r < 0 ? 'ชดเชย ' : r > 0 ? 'เก็บเข้า ' : 'อัตรา '}
    {unit ? <Num v={baht(Math.abs(r))} unit="บาท/ลิตร" ev={ev} /> : <Num v={baht(Math.abs(r))} ev={ev} />}
  </span>
);

/** ความกว้างของกล่องกราฟ (SVG วาดตามความกว้างจริง ป้ายจึงไม่ขยายตาม) · ก่อนวัดใช้ค่าเริ่มต้น */
export function useWidth(init = 340) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(init);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** ดันป้ายปลายเส้นที่ซ้อนกันให้ห่างกันอย่างน้อย gap (เรียงตาม y เดิม) */
export function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1] as { y: number };
    const cur = order[k] as { y: number };
    if (cur.y - prev.y < gap) cur.y = prev.y + gap;
  }
  const over = Math.max(0, (order[order.length - 1]?.y ?? lo) - hi);
  const out: number[] = [];
  for (const o of order) out[o.i] = Math.max(lo, o.y - over);
  return out;
}
