// ค่าของเกม (สมมติฐานที่ยังไม่มีข้อมูลรองรับ) · ทุกค่าอยู่ที่นี่ · ความหมายอยู่ใน docs/rattanava-engine-a.md หัวข้อ 6

export type GameParams = {
  elasticityBp: number; // ความยืดหยุ่นของปริมาณต่อราคา × 10000 (เช่น −2000 = −0.20)
  shockMaxBp: number; // ช็อกราคาของสัปดาห์ สุ่มสม่ำเสมอใน ±ค่านี้ (basis point)
  authorityStepSatang: number; // ฐานะรวมลดทุกเท่านี้ในสัปดาห์ → อำนาจ −1 ช่อง (ราคาของการชดเชย)
  trustB7LevelSatang: number; // ราคา B7 ในเกมวันใดของสัปดาห์เกินระดับนี้ → ความเชื่อใจเริ่มลด (ราคาของการปล่อยราคา)
  trustB7StepSatang: number; // เกินระดับทุกเท่านี้ (ปัดขึ้น) → ความเชื่อใจ −1 ช่อง
  trustG95OverBaseSatang: number; // ราคาแก๊สโซฮอล์ 95 ในเกมวันใดสูงกว่าเส้นฐานเกินเท่านี้ → ความเชื่อใจเริ่มลด (ราคาของการเก็บเงินผู้ใช้เบนซิน)
  trustG95StepSatang: number; // เกินทุกเท่านี้ (ปัดขึ้น) → ความเชื่อใจ −1 ช่อง
  recoverAfterCleanWeeks: number; // ไม่เสียทุนติดกันกี่สัปดาห์จึงฟื้น
  capitalStep: number; // ฟื้นครั้งละกี่ช่อง
  capitalMax: number;
  timePerWeek: number;
  specialMeetingCost: number;
  forcedDocCost: number;
  rateMinSatang: number; // ชดเชยได้ไม่เกิน (ค่าลบ)
  rateMaxSatang: number; // เก็บเข้าได้ไม่เกิน
  guessBands: { withinSatang: number; points: number }[]; // เรียงจากแคบไปกว้าง
  moneyBandSatang: number; // มาตรเงินลด 1 ช่องทุกช่วงนี้เมื่อฐานะติดลบ
};

export const ELASTICITY_PRESETS = { low: -1000, mid: -2000, high: -3000 } as const;

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') { for (const v of Object.values(o)) deepFreeze(v); Object.freeze(o); }
  return o;
};

export const DEFAULT_PARAMS: GameParams = deepFreeze({
  elasticityBp: ELASTICITY_PRESETS.mid,
  shockMaxBp: 200,
  authorityStepSatang: 8_000 * 100_000_000,
  // 30 บาท/ลิตร คือระดับราคาดีเซลที่กรอบนโยบาย กพช. 2562 ใช้เป็นเงื่อนไขให้ใช้กองทุน (policy.nepc_framework_2562.diesel_crisis_threshold) · ใช้เป็นระดับของเกม ไม่ใช่กฎจริงของความเชื่อใจ
  trustB7LevelSatang: 3000,
  trustB7StepSatang: 500,
  trustG95OverBaseSatang: 200,
  trustG95StepSatang: 500,
  recoverAfterCleanWeeks: 2,
  capitalStep: 1,
  capitalMax: 5,
  timePerWeek: 5,
  specialMeetingCost: 2,
  forcedDocCost: 2,
  rateMinSatang: -5000,
  rateMaxSatang: 2000,
  guessBands: [
    { withinSatang: 50, points: 3 },
    { withinSatang: 150, points: 1 },
  ],
  moneyBandSatang: 20_000 * 100_000_000,
});
