import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createGame, guessTarget, isFinished, maxSpecialMeetings, realPathInput, report, runBaseline, runPlan, scoreGuess, submitTurn, type GameState, type TurnInput } from '../../src/engine/game.ts';
import { ledgerSum, ACCOUNTS } from '../../src/engine/ledger.ts';
import { DEFAULT_PARAMS } from '../../src/engine/params.ts';
import { scenario as sc } from './helpers.ts';

const REAL_PARAMS = { ...DEFAULT_PARAMS, shockMaxBp: 0, timePerWeek: 14 }; // เวลาพอสำหรับทุกวันที่อัตราจริงเปลี่ยน
const hold = (s: GameState): TurnInput => ({ guessSatang: 3000, segments: [{ fromDay: 0, b7: s.rates.b7, g95: s.rates.g95 }] });

describe('ยึดกับเส้นจริง', () => {
  it('ตั้งอัตราตามจริงทุกวันและปิดช็อก → ฐานะเท่าค่าจริงทุกวันอาทิตย์', () => {
    const s = runPlan(sc, 1, (st) => realPathInput(st, sc), REAL_PARAMS);
    s.history.forEach((h, i) => {
      const sun = sc.sundays[i]!;
      expect(h.fundOil).toBe(sun.fundOil.v);
      expect(h.fundLpg).toBe(sun.fundLpg.v);
      expect(h.retailB7Sunday).toBe(h.realRetailB7Sunday);
      expect(h.rateB7Sunday).toBe(h.realRateB7Sunday);
    });
  });
});

describe('บัญชีสองด้าน', () => {
  const segArb = fc.record({ b7: fc.integer({ min: -5000, max: 2000 }), g95: fc.integer({ min: -5000, max: 2000 }) });
  const turnArb = fc.record({
    guess: fc.integer({ min: 0, max: 8000 }),
    first: segArb,
    specials: fc.uniqueArray(fc.record({ fromDay: fc.integer({ min: 1, max: 6 }), b7: fc.integer({ min: -5000, max: 2000 }), g95: fc.integer({ min: -5000, max: 2000 }) }), { maxLength: 2, selector: (x) => x.fromDay }),
  });
  const toInput = (s: GameState, t: { guess: number; first: { b7: number; g95: number }; specials: { fromDay: number; b7: number; g95: number }[] }): TurnInput => ({
    guessSatang: t.guess,
    segments: [{ fromDay: 0, ...t.first }, ...[...t.specials].sort((a, b) => a.fromDay - b.fromDay).slice(0, maxSpecialMeetings(s))],
  });

  it('ยอดรวมทุกบัญชีเป็นศูนย์ทุกงวด และฐานะเปลี่ยนเท่ากับผลรวมรายการ (property)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.array(turnArb, { minLength: 10, maxLength: 10 }), (seed, turns) => {
      let s = createGame(sc, seed);
      if (ledgerSum(s.balances) !== 0) return false;
      for (const t of turns) {
        const before = s.balances;
        s = submitTurn(s, sc, toInput(s, t));
        const h = s.history[s.history.length - 1]!;
        if (ledgerSum(s.balances) !== 0) return false;
        if (s.balances['fund.oil'] - before['fund.oil'] !== h.flows.b7 + h.flows.g95 + h.residualOil) return false;
        if (s.balances['fund.lpg'] - before['fund.lpg'] !== h.residualLpg) return false;
        if (!ACCOUNTS.every((a) => Number.isSafeInteger(s.balances[a]))) return false;
      }
      return isFinished(s, sc);
    }), { numRuns: 60 });
  });

  it('ยอดรวมจากรายการทั้งหมดตรงกับยอดคงเหลือ', () => {
    const s = runPlan(sc, 7, hold);
    const sums = Object.fromEntries(ACCOUNTS.map((a) => [a, 0])) as Record<string, number>;
    for (const e of s.entries) { sums[e.from]! -= e.amount; sums[e.to]! += e.amount; }
    expect(sums).toEqual(s.balances);
  });
});

describe('deterministic', () => {
  it('seed และการตัดสินใจเดียวกันให้ผลเหมือนเดิม และสถานะเป็น JSON ได้', () => {
    const a = runPlan(sc, 99, hold), b = runPlan(sc, 99, hold);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
  it('seed ต่างกันให้ช็อกต่างกัน', () => {
    expect(createGame(sc, 1).shocksBp).not.toEqual(createGame(sc, 2).shocksBp);
  });
  it('เส้นฐานรันซ้ำได้ผลเดิม และใช้อัตรา ณ ต้นฉากทุกวัน', () => {
    const b1 = runBaseline(sc, 5), b2 = runBaseline(sc, 5);
    expect(b1).toEqual(b2);
    for (const h of b1.history) for (const d of h.days.b7) expect(d.rate).toBe(sc.startRates.b7.v);
  });
});

describe('กติกาของตา', () => {
  it('ต้องมีการประชุมปกติวันจันทร์', () => {
    expect(() => submitTurn(createGame(sc, 1), sc, { guessSatang: 0, segments: [{ fromDay: 1, b7: 0, g95: 0 }] })).toThrow();
  });
  it('ประชุมพิเศษได้ไม่เกิน 2 ครั้ง', () => {
    const s = createGame(sc, 1);
    expect(maxSpecialMeetings(s)).toBe(2);
    expect(() => submitTurn(s, sc, { guessSatang: 0, segments: [0, 1, 2, 3].map((d) => ({ fromDay: d, b7: 0, g95: 0 })) })).toThrow();
  });
  it('ปฏิเสธอัตรานอกขอบเขต และวันที่ไม่เรียง', () => {
    const s = createGame(sc, 1);
    expect(() => submitTurn(s, sc, { guessSatang: 0, segments: [{ fromDay: 0, b7: -5001, g95: 0 }] })).toThrow();
    expect(() => submitTurn(s, sc, { guessSatang: 0, segments: [{ fromDay: 0, b7: 0, g95: 0 }, { fromDay: 3, b7: 0, g95: 0 }, { fromDay: 3, b7: 0, g95: 0 }] })).toThrow();
  });
  it('ประชุมพิเศษเปลี่ยนอัตราตั้งแต่วันที่เลือก', () => {
    const s = submitTurn(createGame(sc, 1), sc, { guessSatang: 0, segments: [{ fromDay: 0, b7: -100, g95: 100 }, { fromDay: 4, b7: -300, g95: 100 }] });
    expect(s.history[0]!.days.b7.map((d) => d.rate)).toEqual([-100, -100, -100, -100, -300, -300, -300]);
  });
  it('คะแนนการทายตามช่วง', () => {
    expect(scoreGuess(1000, 1050, DEFAULT_PARAMS)).toBe(3);
    expect(scoreGuess(1000, 1051, DEFAULT_PARAMS)).toBe(1);
    expect(scoreGuess(1000, 1150, DEFAULT_PARAMS)).toBe(1);
    expect(scoreGuess(1000, 1151, DEFAULT_PARAMS)).toBe(0);
  });
  it('สิ่งที่ทายไม่ขึ้นกับอัตราที่ผู้เล่นตั้ง', () => {
    const a = runPlan(sc, 3, () => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: -5000, g95: -5000 }] }));
    const b = runPlan(sc, 3, () => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: 2000, g95: 2000 }] }));
    expect(a.history.map((h) => h.guessTarget)).toEqual(b.history.map((h) => h.guessTarget));
  });
});

describe('ทุน', () => {
  it('ชดเชยหนักทำให้อำนาจลด ไม่กระทบความเชื่อใจจากราคา', () => {
    const s = runPlan(sc, 1, () => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: -5000, g95: -5000 }] }));
    expect(Math.min(...s.history.map((h) => h.authority))).toBeLessThan(DEFAULT_PARAMS.capitalMax);
  });
  it('เก็บเงินเข้าสูงทำให้ราคาขึ้นแรงและความเชื่อใจลดในตาแรก', () => {
    const s = submitTurn(createGame(sc, 1), sc, { guessSatang: 0, segments: [{ fromDay: 0, b7: 2000, g95: 2000 }] });
    expect(s.history[0]!.trust).toBe(DEFAULT_PARAMS.capitalMax - 1);
  });
  it('ทุนหมดแล้วตาถัดไปมีเอกสารบังคับ เหลือประชุมพิเศษ 1 ครั้ง', () => {
    let s = createGame(sc, 1);
    s = { ...s, authority: 1 };
    s = submitTurn(s, sc, { guessSatang: 0, segments: [{ fromDay: 0, b7: -5000, g95: -5000 }] });
    expect(s.authority).toBe(0);
    expect(s.forcedDocNext).toBe(true);
    expect(maxSpecialMeetings(s)).toBe(1);
  });
});

describe('สรุปตอนจบ', () => {
  it('รายงานมี 3 แกนและทางจริงตรงกับฉาก', () => {
    const s = runPlan(sc, 11, (st) => ({ ...hold(st), guessSatang: guessTarget(st, sc) }));
    const r = report(s, runBaseline(sc, 11), sc);
    expect(r.understanding).toEqual({ points: 30, max: 30 });
    expect(r.pathVsReal).toHaveLength(10);
    r.pathVsReal.forEach((p, i) => expect(p.realFund).toBe(sc.sundays[i]!.fundOil.v + sc.sundays[i]!.fundLpg.v));
    expect(r.outcome.fund.real).toBe(sc.sundays[9]!.fundOil.v + sc.sundays[9]!.fundLpg.v);
  });
});
