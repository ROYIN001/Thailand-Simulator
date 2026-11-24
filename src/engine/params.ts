// ค่าของเกม (สมมติฐานที่ยังไม่มีข้อมูลรองรับ) · ทุกค่าอยู่ที่นี่ · ความหมายอยู่ใน docs/rattanava-engine-a.md หัวข้อ 6

export type GameParams = {
  elasticityBp: number; // ความยืดหยุ่นของปริมาณต่อราคา × 10000 (เช่น −2000 = −0.20)
  shockMaxBp: number; // ช็อกราคาของสัปดาห์ สุ่มสม่ำเสมอใน ±ค่านี้ (basis point)
  authorityDropFundSatang: number; // ฐานะรวมลดเกินเท่านี้ในสัปดาห์ → อำนาจ −1
  trustDropRetailSatang: number; // ราคา B7 วันอาทิตย์ขึ้นเกินเท่านี้ (สตางค์/ลิตร) → ความเชื่อใจ −1
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

export const DEFAULT_PARAMS: GameParams = {
  elasticityBp: ELASTICITY_PRESETS.mid,
  shockMaxBp: 200,
  authorityDropFundSatang: 8_000 * 100_000_000,
  trustDropRetailSatang: 200,
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
};
