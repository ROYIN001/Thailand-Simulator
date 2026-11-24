// golden run: seed และชุดการตัดสินใจคงที่ ผลต้องตรงกับไฟล์ใน test/golden/ ทุกตัว
// ถ้าตั้งใจเปลี่ยนเครื่องยนต์ ให้รัน vitest -u แล้วอธิบายส่วนต่างใน commit
import { describe, expect, it } from 'vitest';
import { report, runBaseline, runPlan, type GameState, type TurnInput } from '../../src/engine/game.ts';
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

describe('golden run', () => {
  it(`seed ${SEED} แผนตายตัว`, async () => {
    const s = runPlan(sc, SEED, plan);
    const base = runBaseline(sc, SEED);
    const summary = {
      seed: SEED,
      turns: s.history.map((h) => ({
        turn: h.turn, shockBp: h.shockBp, guessTarget: h.guessTarget, guessPoints: h.guessPoints, timeUsed: h.timeUsed, forcedDoc: h.forcedDoc,
        flowB7: h.flows.b7, flowG95: h.flows.g95, residualOil: h.residualOil, residualLpg: h.residualLpg,
        fundOil: h.fundOil, fundLpg: h.fundLpg, retailB7Sunday: h.retailB7Sunday, authority: h.authority, trust: h.trust, money: h.money,
      })),
      report: report(s, base, sc),
    };
    await expect(`${JSON.stringify(summary, null, 1)}\n`).toMatchFileSnapshot('../golden/run-a-seed20260302.json');
  });
});
