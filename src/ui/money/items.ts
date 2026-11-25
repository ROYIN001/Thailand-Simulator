// ห่วงโซ่ "ตามเงิน" ของแท็บเงิน: ทุกยอดต่อกลับได้ถึงอัตรา ปริมาณ และราคาของแต่ละวัน จนถึงระเบียนในไฟล์ข้อมูลกลาง
// สร้างเฉพาะตาที่เล่นแล้ว (g.played · g.baselinePlayed) จึงไม่มีค่าของวันที่ยังไม่ถึง
import type { DayTrace, Fuel, TurnRecord } from '../../engine/game.ts';
import type { Scenario, Sourced } from '../../engine/scenario-types.ts';
import type { Game } from '../../game/session.ts';
import { computed, fromSourced, game, type Evidence, type SourceItem } from '../evidence.tsx';
import { baht, int, mbaht, pct, thDate, thRange } from '../format.ts';

export const FUEL_NAME: Record<Fuel, string> = { b7: 'ดีเซล B7', g95: 'แก๊สโซฮอล์ 95' };
type Who = 'player' | 'baseline';
const WHO: Record<Who, string> = { player: 'ในเกม', baseline: 'ตามเส้นฐาน' };
const ROUND = 'ตัวเลขแต่ละตัวปัดเศษทิ้งเป็นล้านบาท ผลรวมที่เห็นจึงคลาดได้เล็กน้อย การคำนวณจริงคิดเป็นสตางค์';
export const BASELINE_RULE = 'เส้นฐาน = เครื่องยนต์เดินทั้งฉากด้วยอัตรา ณ ต้นฉากทุกตา seed เดียวกัน (กรณีไม่ออกนโยบายใหม่)';

export const mItem = (satang: number, ev: Evidence, plus = false): SourceItem => ({ text: mbaht(satang, plus), unit: 'ล้านบาท', ev });

/** ค่าจากไฟล์ฉาก · uncertain ห้ามแสดงตัวเลข เพราะเป็นค่าแทนในการคำนวณเท่านั้น */
export function sourced(s: Sourced, label: string, text: string, unit?: string): SourceItem {
  const ev = fromSourced(s, label);
  if (s.kind === 'uncertain') return { text: 'ไม่แน่นอน', ev };
  return unit ? { text, unit, ev } : { text, ev };
}

const weekRange = (sc: Scenario, turn: number): string => thRange(sc.days[(turn - 1) * 7] as string, sc.days[(turn - 1) * 7 + 6] as string);
/** วันอาทิตย์ก่อนวันแรกของฉาก (วันของยอดยกมา) */
export const openingDate = (sc: Scenario): string => new Date(Date.parse(sc.days[0] as string) - 86_400_000).toISOString().slice(0, 10);

const realRateItem = (sc: Scenario, f: Fuel, idx: number): SourceItem => {
  const d = sc[f][idx] as Scenario['b7'][number];
  return sourced(d.rate, `อัตราเงินกองทุน${FUEL_NAME[f]} จริง ${thDate(sc.days[idx] as string)} (ลบ = ชดเชย · บวก = เก็บเข้า)`, baht(d.rate.v), 'บาท/ลิตร');
};
const realVolumeItem = (sc: Scenario, f: Fuel, idx: number): SourceItem => {
  const d = sc[f][idx] as Scenario['b7'][number];
  return sourced(d.volume, `ปริมาณจำหน่าย${FUEL_NAME[f]} จริงต่อวัน ${thDate(sc.days[idx] as string)}`, int(d.volume.v), 'ลิตร');
};

/** เงินของน้ำมันหนึ่งชนิดในหนึ่งวัน = อัตราที่ใช้ × ปริมาณในเกม */
function dayFlow(g: Game, rec: TurnRecord, f: Fuel, i: number, d: DayTrace, who: Who): SourceItem {
  const idx = (rec.turn - 1) * 7 + i;
  const day = g.sc[f][idx] as Scenario['b7'][number];
  const date = thDate(d.date);
  const name = FUEL_NAME[f];
  const rate: SourceItem =
    who === 'player'
      ? { text: baht(d.rate), unit: 'บาท/ลิตร', ev: game(`อัตราเงินกองทุน${name} ที่คุณตั้ง มีผล ${date} (ลบ = ชดเชย · บวก = เก็บเข้า)`, 'ค่าที่ผู้เล่นเลือกในการประชุมปกติวันจันทร์หรือประชุมพิเศษ มีผลถึงสิ้นสัปดาห์หรือจนถึงการตั้งครั้งถัดไป') }
      : sourced(g.sc.startRates[f], `อัตราเงินกองทุน${name} ณ ต้นฉาก ที่เส้นฐานใช้ (ลบ = ชดเชย · บวก = เก็บเข้า)`, baht(g.sc.startRates[f].v), 'บาท/ลิตร');
  const realRetail = sourced(day.retail, `ราคาขายปลีก${name} กรุงเทพฯ จริง ${date}`, baht(day.retail.v), 'บาท/ลิตร');
  const retailLabel = `ราคาขายปลีก${name} ${WHO[who]} ${date}`;
  const retail: SourceItem =
    day.retail.kind === 'uncertain'
      ? { text: 'ไม่แน่นอน', ev: { kind: 'missing', label: retailLabel, formula: 'ราคาจริงของวันนี้ไม่แน่นอน (ราคาเปลี่ยนก่อนระเบียนถัดไปโดยไม่รู้วันที่) เครื่องยนต์จึงใช้ค่าแทนในการคำนวณ ราคาในเกมของวันนี้จึงไม่แน่นอนด้วย', ids: day.retail.ids } }
      : {
          text: baht(d.retail),
          unit: 'บาท/ลิตร',
          ev: computed(retailLabel, 'ราคาจริง × (1 + ช็อกของสัปดาห์) + (อัตราที่ใช้ − อัตราจริง) × (1 + ภาษีมูลค่าเพิ่ม) · สมมติว่าค่าการตลาดไม่เปลี่ยนตามอัตรา', [
            realRetail,
            { text: pct(rec.shockBp), ev: game(`ช็อกราคาของสัปดาห์ ตา ${rec.turn}`, `ราคาขายปลีกในเกมทุกวันของสัปดาห์ = ราคาจริง × (1 + ช็อก) · สุ่มด้วย seed ในช่วง ±${pct(g.state.params.shockMaxBp, false)} แทนเหตุที่คาดไม่ได้`) },
            rate,
            realRateItem(g.sc, f, idx),
            sourced(g.sc.vatBp, 'ภาษีมูลค่าเพิ่มที่คิดบนเงินกองทุน', pct(g.sc.vatBp.v, false)),
          ]),
        };
  const volume: SourceItem = {
    text: int(d.volume),
    unit: 'ลิตร',
    ev: computed(`ปริมาณ${name} ${WHO[who]} ${date}`, 'ปริมาณจริง × (1 + ความยืดหยุ่น × (ราคาในเกม − ราคาจริง) ÷ ราคาจริง) ไม่ต่ำกว่าศูนย์ · ประมาณเชิงเส้น', [
      realVolumeItem(g.sc, f, idx),
      retail,
      realRetail,
      { text: baht(Math.trunc(g.state.params.elasticityBp / 100)), ev: game('ความยืดหยุ่นของปริมาณต่อราคา', 'สมมติฐานของเกม ยังไม่มีค่าที่ตรวจแล้ว (การ์ดแบบจำลอง หัวข้อ 6)') },
    ]),
  };
  return mItem(d.flow, computed(`เงิน${name} เข้ากองทุน ${WHO[who]} ${date} (ลบ = ชดเชย)`, 'อัตราที่ใช้ × ปริมาณ' + WHO[who], [rate, volume]));
}

/** เงินสุทธิของน้ำมันหนึ่งชนิดในหนึ่งตา (บวก = เข้ากองทุน · ลบ = ชดเชย) */
export function weekFlow(g: Game, rec: TurnRecord, f: Fuel, who: Who): SourceItem {
  const days = rec.days[f].map((d, i) => dayFlow(g, rec, f, i, d, who));
  return mItem(rec.flows[f], computed(`เงิน${FUEL_NAME[f]} เข้ากองทุนสุทธิ ${WHO[who]} ตา ${rec.turn} (${weekRange(g.sc, rec.turn)}) · ลบ = ชดเชย`, `ผลรวม 7 วันของ อัตราที่ใช้ × ปริมาณ · ${ROUND}`, days));
}

/** เงินตามอัตราจริงและปริมาณจริง ซึ่งใช้หักออกจากการเปลี่ยนแปลงจริงเพื่อหารายการอื่น */
function realWeekFlow(g: Game, rec: TurnRecord, f: Fuel): SourceItem {
  const days = rec.days[f].map((d, i) => {
    const idx = (rec.turn - 1) * 7 + i;
    return mItem(d.realFlow, computed(`เงิน${FUEL_NAME[f]} ตามอัตราจริง ${thDate(d.date)}`, 'อัตราจริง × ปริมาณจริง', [realRateItem(g.sc, f, idx), realVolumeItem(g.sc, f, idx)]));
  });
  const sum = rec.days[f].reduce((a, d) => a + d.realFlow, 0);
  return mItem(sum, computed(`เงิน${FUEL_NAME[f]} ตามอัตราจริงและปริมาณจริง ตา ${rec.turn}`, `ผลรวม 7 วันของ อัตราจริง × ปริมาณจริง · ${ROUND}`, days));
}

const fundSide = (g: Game, turn: number, acct: 'fundOil' | 'fundLpg'): SourceItem => {
  const name = acct === 'fundOil' ? 'บัญชีน้ำมัน' : 'บัญชี LPG';
  const s = turn === 0 ? g.sc.opening[acct] : (g.sc.sundays[turn - 1] as Scenario['sundays'][number])[acct];
  const date = turn === 0 ? openingDate(g.sc) : (g.sc.sundays[turn - 1] as Scenario['sundays'][number]).date;
  return sourced(s, `ฐานะ${name}ของกองทุนจริง ณ ${thDate(date)} (สกนช.)`, mbaht(s.v), 'ล้านบาท');
};

/** รายการอื่นตามงบจริงของบัญชีน้ำมัน: ส่วนที่แบบจำลองไม่ได้แยก เท่ากันทุกทางเลือกของผู้เล่น */
export function residualOil(g: Game, rec: TurnRecord): SourceItem {
  return mItem(
    rec.residualOil,
    computed(
      `รายการอื่นตามงบจริง บัญชีน้ำมัน ตา ${rec.turn} (${weekRange(g.sc, rec.turn)})`,
      `ฐานะบัญชีน้ำมันจริงวันอาทิตย์นี้ − วันอาทิตย์ก่อน − เงินดีเซล B7 และแก๊สโซฮอล์ 95 ตามอัตราจริง · รวมน้ำมันชนิดอื่น ค่าบริหาร จังหวะการจ่าย และความคลาดของการประมาณปริมาณ · เท่ากันทุกทางเลือกของผู้เล่น · ${ROUND}`,
      [fundSide(g, rec.turn, 'fundOil'), fundSide(g, rec.turn - 1, 'fundOil'), realWeekFlow(g, rec, 'b7'), realWeekFlow(g, rec, 'g95')],
    ),
  );
}

export function residualLpg(g: Game, rec: TurnRecord): SourceItem {
  return mItem(
    rec.residualLpg,
    computed(
      `รายการอื่นตามงบจริง บัญชี LPG ตา ${rec.turn} (${weekRange(g.sc, rec.turn)})`,
      `ฐานะบัญชี LPG จริงวันอาทิตย์นี้ − วันอาทิตย์ก่อน · เกมไม่ได้ให้ตั้งอัตรา LPG จึงเดินตามจริง · เท่ากันทุกทางเลือกของผู้เล่น · ${ROUND}`,
      [fundSide(g, rec.turn, 'fundLpg'), fundSide(g, rec.turn - 1, 'fundLpg')],
    ),
  );
}

export type Week = {
  rec: TurnRecord;
  base: TurnRecord;
  sunday: string;
  fund: SourceItem;
  baseFund: SourceItem;
  real: SourceItem;
  realV: number;
  b7: SourceItem;
  g95: SourceItem;
  baseB7: SourceItem;
  baseG95: SourceItem;
  resOil: SourceItem;
  resLpg: SourceItem;
};

export type Chain = { opening: SourceItem; openingV: number; openingOil: SourceItem; openingLpg: SourceItem; weeks: Week[] };

/** ฐานะรวมของทุกตาที่เล่นแล้ว · แต่ละตา = ตาก่อน + เงินสี่ช่องทาง */
export function fundChain(g: Game): Chain {
  const openingOil = fundSide(g, 0, 'fundOil');
  const openingLpg = fundSide(g, 0, 'fundLpg');
  const openingV = g.sc.opening.fundOil.v + g.sc.opening.fundLpg.v;
  const opening = mItem(openingV, computed(`ฐานะรวมของกองทุนยกมา ณ ${thDate(openingDate(g.sc))}`, 'บัญชีน้ำมัน + บัญชี LPG (ฐานะจริงจาก สกนช.) · เป็นจุดเริ่มของทั้งในเกมและเส้นฐาน', [openingOil, openingLpg]));
  const weeks: Week[] = [];
  let prev = opening;
  let prevBase = opening;
  g.played.forEach((rec, i) => {
    const base = g.baselinePlayed[i] as TurnRecord;
    const sun = g.sc.sundays[i] as Scenario['sundays'][number];
    const date = thDate(sun.date);
    const b7 = weekFlow(g, rec, 'b7', 'player');
    const g95 = weekFlow(g, rec, 'g95', 'player');
    const baseB7 = weekFlow(g, base, 'b7', 'baseline');
    const baseG95 = weekFlow(g, base, 'g95', 'baseline');
    const resOil = residualOil(g, rec);
    const resLpg = residualLpg(g, rec);
    const sum = 'ฐานะ ณ วันอาทิตย์ก่อน + เงินดีเซล B7 + เงินแก๊สโซฮอล์ 95 + รายการอื่นบัญชีน้ำมัน + รายการอื่นบัญชี LPG';
    const fund = mItem(rec.fundOil + rec.fundLpg, computed(`ฐานะรวมของกองทุนในเกม ณ วันอาทิตย์ ${date} (สิ้นตา ${rec.turn})`, `${sum} · ${ROUND}`, [prev, b7, g95, resOil, resLpg]));
    const baseFund = mItem(base.fundOil + base.fundLpg, computed(`ฐานะรวมของกองทุนตามเส้นฐาน ณ วันอาทิตย์ ${date}`, `${BASELINE_RULE} · ${sum} · ${ROUND}`, [prevBase, baseB7, baseG95, resOil, resLpg]));
    const real = sourced(sun.fundNet, `ฐานะกองทุนสุทธิจริง ณ วันอาทิตย์ ${date} (สกนช.)`, mbaht(sun.fundNet.v), 'ล้านบาท');
    weeks.push({ rec, base, sunday: sun.date, fund, baseFund, real, realV: sun.fundNet.v, b7, g95, baseB7, baseG95, resOil, resLpg });
    prev = fund;
    prevBase = baseFund;
  });
  return { opening, openingV, openingOil, openingLpg, weeks };
}
