// ค่าประมาณบนจอตั้งอัตรา (ค่าคำนวณ) · เลขจำนวนเต็ม ปัดทิ้งเข้าหาศูนย์ตามเครื่องยนต์
// หลัก: ประมาณจากคำทายของผู้เล่นเองและข้อมูลที่รู้ก่อนตัดสินใจ ไม่ใช้ราคาจริงของสัปดาห์ที่ยังไม่เกิด
// คลาดจากเครื่องยนต์ได้ 1 สตางค์ เพราะเครื่องยนต์ปัดส่วนต่างจากอัตราจริง (ซึ่งผู้เล่นยังไม่รู้) แยกสองครั้ง · มีเทสต์
import { mul, mulDiv } from '../engine/math.ts';
import { trustLoss, type Fuel, type GameState, type RateSegment } from '../engine/game.ts';
import type { GameParams } from '../engine/params.ts';
import type { Scenario } from '../engine/scenario-types.ts';

const vatMul = (sc: Scenario, d: number): number => mulDiv(d, 10000 + sc.vatBp.v, 10000);

/** ราคา B7 วันอาทิตย์โดยประมาณ ถ้าอัตราวันอาทิตย์เป็น rate · ต่อจากคำทาย (คำทายคือกรณีอัตรา ณ ต้นฉาก) ด้วยสูตรเดียวกับเครื่องยนต์ */
export const b7SundayFromGuess = (sc: Scenario, guess: number, rate: number): number => guess + vatMul(sc, rate - sc.startRates.b7.v);

/** ราคาแก๊สโซฮอล์ 95 ในเกมสูงกว่าเส้นฐานเท่าไร · คิดได้ตรงจากอัตรา เพราะราคาจริงและช็อกหักกันหมด */
export const g95OverBase = (sc: Scenario, rate: number): number => vatMul(sc, rate - sc.startRates.g95.v);

/** อัตราที่มีผลในวัน i (0 = จันทร์) ของสัปดาห์ */
export const rateOnDay = (segments: RateSegment[], fuel: Fuel, i: number): number => {
  let r: number | undefined;
  for (const g of segments) if (g.fromDay <= i) r = g[fuel];
  if (r === undefined) throw new Error('ต้องมีอัตราตั้งแต่วันจันทร์');
  return r;
};

/** เงินเข้ากองทุนของสัปดาห์โดยประมาณ (บวก = เข้า ลบ = ชดเชย) = อัตรา × ปริมาณจริงของเดือน · ไม่รวมผลของราคาต่อปริมาณ */
export function weekFlowEstimate(s: GameState, sc: Scenario, fuel: Fuel, segments: RateSegment[]): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = sc[fuel][(s.turn - 1) * 7 + i];
    if (!d) throw new Error('ฉากจบแล้ว');
    sum += mul(rateOnDay(segments, fuel, i), d.volume.v);
  }
  return sum;
}

/** ช่องความเชื่อใจที่จะเสียโดยประมาณ จากราคา B7 วันอาทิตย์โดยประมาณ และแก๊สโซฮอล์ 95 ที่สูงกว่าเส้นฐานมากที่สุดในสัปดาห์
 * shortcut: ราคา B7 ใช้วันอาทิตย์วันเดียว ของจริงวัดราคาสูงสุดทุกวัน · จอต้องบอกข้อนี้ */
export function trustLossEstimate(sc: Scenario, p: GameParams, guess: number, segments: RateSegment[]): number {
  const b7 = b7SundayFromGuess(sc, guess, rateOnDay(segments, 'b7', 6));
  const g95 = Math.max(...segments.map((g) => g95OverBase(sc, g.g95)));
  return trustLoss(b7, g95, p);
}
