// ชนิดของไฟล์ฉากที่สร้างจากไฟล์ข้อมูลกลาง (scripts/build-scenario.ts) · ทุกค่ามี id หรือสูตรที่บอกที่มา
export type Sourced = {
  v: number; // จำนวนเต็มในหน่วยของช่อง (สตางค์ สตางค์ต่อลิตร ลิตรต่อวัน หรือ basis point)
  kind: 'real' | 'computed';
  ids: string[]; // ระเบียนในไฟล์ข้อมูลกลางที่ค่านี้มาจาก
  note?: string; // สูตรหรือเหตุผล เมื่อ kind เป็น computed
};

export type FuelDay = { rate: Sourced; retail: Sourced; volume: Sourced };

export type Scenario = {
  scenarioId: 'oil-fund-2569';
  days: string[]; // วันที่ ค.ศ. ของแต่ละวันในฉาก เริ่มวันจันทร์ จบวันอาทิตย์
  weeks: number; // จำนวนตา (7 วันต่อตา)
  opening: { fundOil: Sourced; fundLpg: Sourced }; // ยอดยกมา ณ วันอาทิตย์ก่อนวันแรก
  sundays: { date: string; fundOil: Sourced; fundLpg: Sourced }[]; // ค่าจริง ณ วันอาทิตย์ที่จบแต่ละตา
  startRates: { b7: Sourced; g95: Sourced }; // อัตราที่มีผล ณ วันก่อนวันแรก
  vatBp: Sourced; // ภาษีมูลค่าเพิ่มบนเงินกองทุน (basis point)
  b7: FuelDay[];
  g95: FuelDay[];
};
