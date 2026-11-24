import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createGame, guessTarget, isAuthorityBreach, isFinished, isTrustBreach, maxSpecialMeetings, rateFloor, realPathInput, report, runBaseline, runPlan, scoreGuess, submitTurn, type GameState, type TurnInput } from '../../src/engine/game.ts';
import { ELASTICITY_PRESETS } from '../../src/engine/params.ts';
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
  // อัตราสุ่มเป็นสัดส่วน 0–10000 ของช่วง [rateFloor, rateMax] เพื่อไม่ให้ชดเชยเกินราคา
  const frac = fc.integer({ min: 0, max: 10000 });
  const turnArb = fc.record({
    guess: fc.integer({ min: 0, max: 8000 }),
    first: fc.record({ b7: frac, g95: frac }),
    specials: fc.uniqueArray(fc.record({ fromDay: fc.integer({ min: 1, max: 6 }), b7: frac, g95: frac }), { maxLength: 2, selector: (x) => x.fromDay }),
  });
  const pick = (s: GameState, fuel: 'b7' | 'g95', fromDay: number, f: number) => {
    const lo = rateFloor(s, sc, fuel, fromDay), hi = s.params.rateMaxSatang;
    return lo + Math.trunc(((hi - lo) * f) / 10000);
  };
  const toInput = (s: GameState, t: { guess: number; first: { b7: number; g95: number }; specials: { fromDay: number; b7: number; g95: number }[] }): TurnInput => ({
    guessSatang: t.guess,
    segments: [{ fromDay: 0, ...t.first }, ...[...t.specials].sort((a, b) => a.fromDay - b.fromDay).slice(0, maxSpecialMeetings(s))]
      .map((g) => ({ fromDay: g.fromDay, b7: pick(s, 'b7', g.fromDay, g.b7), g95: pick(s, 'g95', g.fromDay, g.g95) })),
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
    const a = runPlan(sc, 3, (s) => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: rateFloor(s, sc, 'b7'), g95: rateFloor(s, sc, 'g95') }] }));
    const b = runPlan(sc, 3, () => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: 2000, g95: 2000 }] }));
    expect(a.history.map((h) => h.guessTarget)).toEqual(b.history.map((h) => h.guessTarget));
  });
});

describe('ทุน', () => {
  const maxSubsidy = (s: GameState): TurnInput => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: rateFloor(s, sc, 'b7'), g95: rateFloor(s, sc, 'g95') }] });
  it('ชดเชยหนักทำให้อำนาจลด', () => {
    const s = runPlan(sc, 1, maxSubsidy);
    expect(s.history.filter((h) => h.authorityBreach).length).toBeGreaterThan(0);
    expect(Math.min(...s.history.map((h) => h.authority))).toBeLessThan(DEFAULT_PARAMS.capitalMax);
  });
  it('เก็บเงินเข้าสูงค้างไว้เสียความเชื่อใจทุกสัปดาห์ ไม่ใช่ครั้งเดียว', () => {
    const s = runPlan(sc, 1, () => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: 2000, g95: 130 }] }));
    expect(s.history.every((h) => h.trustBreach)).toBe(true);
    expect(s.trust).toBe(0);
  });
  it('อุดหนุนเฉพาะท้ายสัปดาห์ไม่หลบการวัดความเชื่อใจ', () => {
    for (const fromDay of [4, 6]) {
      const s = runPlan(sc, 20260302, (st) => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: 2000, g95: 130 }, { fromDay, b7: rateFloor(st, sc, 'b7', fromDay), g95: 130 }] }));
      expect(s.history.every((h) => h.trustBreach)).toBe(true);
      const r = report(s, sc);
      // รายงานไม่ซ่อนวันธรรมดา: ราคาเฉลี่ยทั้งฉากสูงกว่าราคาวันอาทิตย์สุดท้ายที่ถูกกดไว้
      expect(r.outcome.retailB7Average.player).toBeGreaterThan(r.outcome.retailB7LastSunday.player);
    }
  });
  it('เก็บเงินแก๊สโซฮอล์ 95 สูงกว่าเส้นฐานเกิน 2 บาท เสียความเชื่อใจ แม้ดีเซลถูก', () => {
    const s = submitTurn(createGame(sc, 1, { ...DEFAULT_PARAMS, shockMaxBp: 0 }), sc, { guessSatang: 0, segments: [{ fromDay: 0, b7: rateFloor(createGame(sc, 1, { ...DEFAULT_PARAMS, shockMaxBp: 0 }), sc, 'b7'), g95: 130 + 200 }] });
    expect(s.history[0]!.maxRetailB7).toBeLessThanOrEqual(DEFAULT_PARAMS.trustB7LevelSatang);
    expect(s.history[0]!.maxG95OverBase).toBe(Math.trunc((200 * 10700) / 10000));
    expect(s.history[0]!.trustBreach).toBe(true);
  });
  it('ขอบของเกณฑ์เป็นแบบมากกว่าเท่านั้น', () => {
    const p = DEFAULT_PARAMS;
    expect(isAuthorityBreach(p.authorityDropFundSatang, p)).toBe(false);
    expect(isAuthorityBreach(p.authorityDropFundSatang + 1, p)).toBe(true);
    expect(isTrustBreach(p.trustB7LevelSatang, p.trustG95OverBaseSatang, p)).toBe(false);
    expect(isTrustBreach(p.trustB7LevelSatang + 1, 0, p)).toBe(true);
    expect(isTrustBreach(0, p.trustG95OverBaseSatang + 1, p)).toBe(true);
  });
  it('ทุนหมดแล้วตาถัดไปมีเอกสารบังคับ เหลือประชุมพิเศษ 1 ครั้ง และใช้เวลา 2 ช่อง', () => {
    let s = createGame(sc, 1);
    s = { ...s, authority: 1 };
    s = submitTurn(s, sc, maxSubsidy(s));
    expect(s.authority).toBe(0);
    expect(s.forcedDocNext).toBe(true);
    expect(maxSpecialMeetings(s)).toBe(1);
    s = submitTurn(s, sc, maxSubsidy(s));
    expect(s.history[1]!.forcedDoc).toBe(true);
    expect(s.history[1]!.timeUsed).toBe(2);
  });
  it('มาตรเงินหมดก็ทำให้มีเอกสารบังคับ', () => {
    const s = runPlan(sc, 1, maxSubsidy);
    const firstZero = s.history.findIndex((h) => h.money === 0);
    expect(firstZero).toBeGreaterThanOrEqual(0);
    if (firstZero < 9) expect(s.history[firstZero + 1]!.forcedDoc).toBe(true);
  });
  it('ชดเชยเกินราคาไม่ได้', () => {
    expect(() => submitTurn(createGame(sc, 1), sc, { guessSatang: 0, segments: [{ fromDay: 0, b7: -5000, g95: 130 }] })).toThrow(/ชดเชยเกินราคา/);
    const s = createGame(sc, 1);
    expect(() => submitTurn(s, sc, maxSubsidy(s))).not.toThrow();
    const lo = submitTurn(s, sc, maxSubsidy(s));
    expect(Math.min(...lo.history[0]!.days.b7.map((d) => d.retail))).toBeGreaterThanOrEqual(0);
  });
});

describe('ความปลอดภัยของสถานะ', () => {
  it('DEFAULT_PARAMS แก้ไม่ได้ และสถานะถือสำเนาของ params', () => {
    expect(Object.isFrozen(DEFAULT_PARAMS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_PARAMS.guessBands[0])).toBe(true);
    const g = createGame(sc, 1);
    expect(g.params).not.toBe(DEFAULT_PARAMS);
    g.params.guessBands[0]!.points = 99;
    expect(createGame(sc, 2).params.guessBands[0]!.points).toBe(3);
  });
  it('ประวัติเก็บสำเนาของคำสั่ง ไม่รับฟิลด์เกิน', () => {
    const input = { guessSatang: 0, segments: [{ fromDay: 0, b7: -100, g95: 130, extra: 1n }] } as unknown as TurnInput;
    const s = submitTurn(createGame(sc, 1), sc, input);
    input.segments[0]!.b7 = -999;
    expect(s.history[0]!.input).toEqual({ guessSatang: 0, segments: [{ fromDay: 0, b7: -100, g95: 130 }] });
    expect(() => JSON.stringify(s)).not.toThrow();
  });
});

describe('สรุปตอนจบ', () => {
  it('เส้นฐานใช้ seed และ params ของเกมเอง', () => {
    const high = { ...DEFAULT_PARAMS, elasticityBp: ELASTICITY_PRESETS.high };
    const keepStart = () => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: sc.startRates.b7.v, g95: sc.startRates.g95.v }] });
    const r = report(runPlan(sc, 1, keepStart, high), sc);
    expect(r.outcome.fund.player).toBe(r.outcome.fund.baseline);
    expect(r.politics.authorityBreaches).toBeGreaterThanOrEqual(0);
  });
  it('วันอาทิตย์ที่ราคาจริงไม่แน่นอนไม่นับการทาย', () => {
    const s = createGame(sc, 1);
    expect(guessTarget(s, sc, 3)).toBeNull();
    expect(guessTarget(s, sc, 5)).toBeNull();
    expect(guessTarget(s, sc, 4)).not.toBeNull();
  });
  it('รายงานมี 3 แกนและทางจริงตรงกับฉาก', () => {
    const s = runPlan(sc, 11, (st) => ({ ...hold(st), guessSatang: guessTarget(st, sc) ?? 0 }));
    const r = report(s, sc);
    expect(r.understanding).toEqual({ points: 24, max: 24, voidTurns: [3, 5] });
    expect(r.pathVsReal).toHaveLength(10);
    r.pathVsReal.forEach((p, i) => expect(p.realFund.v).toBe(sc.sundays[i]!.fundOil.v + sc.sundays[i]!.fundLpg.v));
    expect(r.outcome.fund.real.v).toBe(sc.sundays[9]!.fundOil.v + sc.sundays[9]!.fundLpg.v);
  });
});
