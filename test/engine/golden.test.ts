// golden run: seed และชุดการตัดสินใจคงที่ ผลต้องตรงกับไฟล์ใน test/golden/ ทุกตัว
// ถ้าตั้งใจเปลี่ยนเครื่องยนต์ ให้รัน vitest -u แล้วอธิบายส่วนต่างใน commit
import { describe, expect, it } from 'vitest';
import { FUELS, rateFloor, report, runPlan, type GameState, type TurnInput } from '../../src/engine/game.ts';
import { scenario as sc } from './helpers.ts';

const SEED = 20260302;
// แผนตายตัว: ชดเชย B7 ไล่ขึ้นแล้วลด · เก็บเงินแก๊สโซฮอล์ 95 · ประชุมพิเศษบางตา · ทายด้วยราคาวันอาทิตย์ก่อนหน้า
const PLAN: { b7: number; g95: number; special?: { fromDay: number; b7: number; g95: number } }[] = [
  { b7: -300, g95: 100 },
  { b7: -800, g95: 0, special: { fromDay: 3, b7: -1200, g95: 0 } },
  { b7: -1500, g95: -200 },
  { b7: -1500, g95: 0, special: { fromDay: 4, b7: -1000, g95: 100 } },
  { b7: -1000, g95: 200 },
  { b7: -600, g95: 300 },
  { b7: -300, g95: 300 },
  { b7: -200, g95: 250 },
  { b7: 0, g95: 250, special: { fromDay: 2, b7: -100, g95: 250 } },
  { b7: 50, g95: 300 },
];
const plan = (s: GameState): TurnInput => {
  const p = PLAN[s.turn - 1]!;
  const prev = s.history[s.history.length - 1];
  return {
    guessSatang: prev ? prev.retailB7Sunday : sc.b7[0]!.retail.v,
    segments: [{ fromDay: 0, b7: p.b7, g95: p.g95 }, ...(p.special ? [p.special] : [])],
  };
};

const summarize = (s: GameState) => ({
  seed: s.seed,
  turns: s.history.map((h) => ({
    turn: h.turn, shockBp: h.shockBp, guessTarget: h.guessTarget, guessPoints: h.guessPoints, timeUsed: h.timeUsed, forcedDoc: h.forcedDoc,
    flowB7: h.flows.b7, flowG95: h.flows.g95, residualOil: h.residualOil, residualLpg: h.residualLpg,
    fundOil: h.fundOil, fundLpg: h.fundLpg, retailB7Sunday: h.retailB7Sunday, maxRetailB7: h.maxRetailB7, maxG95OverBase: h.maxG95OverBase,
    authorityBreach: h.authorityBreach, trustBreach: h.trustBreach, authority: h.authority, trust: h.trust, money: h.money,
    days: FUELS.map((f) => h.days[f].map((d) => [d.date, d.rate, d.realRate, d.retail, d.realRetail, d.volume, d.flow, d.realFlow])),
  })),
  finalRates: s.rates,
  forcedDocNext: s.forcedDocNext,
  balances: s.balances,
  entries: s.entries.map((e) => [e.week, e.from, e.to, e.amount]),
  report: report(s, sc),
});

// แผนที่สอง: ชดเชยเต็มที่ทุกตา (ที่ระดับต่ำสุดที่ตั้งได้) ให้ทุนหมดและเกิดเอกสารบังคับ
const harsh = (s: GameState): TurnInput => ({ guessSatang: 4500, segments: [{ fromDay: 0, b7: rateFloor(s, sc, 'b7'), g95: rateFloor(s, sc, 'g95') }] });

describe('golden run', () => {
  it(`seed ${SEED} แผนตายตัว`, async () => {
    await expect(`${JSON.stringify(summarize(runPlan(sc, SEED, plan)), null, 1)}\n`).toMatchFileSnapshot('../golden/run-a-seed20260302.json');
  });
  it(`seed ${SEED} ชดเชยเต็มที่ทุกตา`, async () => {
    const s = runPlan(sc, SEED, harsh);
    expect(s.history.some((h) => h.forcedDoc)).toBe(true);
    await expect(`${JSON.stringify(summarize(s), null, 1)}\n`).toMatchFileSnapshot('../golden/run-a-harsh-seed20260302.json');
  });
});
