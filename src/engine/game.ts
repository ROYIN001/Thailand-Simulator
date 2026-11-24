// เครื่องยนต์ของแบบ ก · ไม่มี UI · ฟังก์ชันบริสุทธิ์: สถานะเข้า → สถานะใหม่ออก · สถานะเป็น JSON ได้ทั้งหมด
// แนวคิด: ยึดกับเส้นจริง แล้วคิดใหม่เฉพาะเงินของ B7 และแก๊สโซฮอล์ 95 (docs/rattanava-engine-a.md)
import { clamp, mul, mulDiv } from './math.ts';
import { createRng, intInRange } from './prng.ts';
import { emptyBalances, ledgerSum, post, signedEntry, type Balances, type Entry } from './ledger.ts';
import { DEFAULT_PARAMS, type GameParams } from './params.ts';
import type { Scenario } from './scenario-types.ts';

export type Fuel = 'b7' | 'g95';
export const FUELS: Fuel[] = ['b7', 'g95'];

/** การตั้งอัตราหนึ่งครั้ง: มีผลตั้งแต่วันที่ fromDay ของสัปดาห์ (0 = จันทร์) ถึงสิ้นสัปดาห์หรือจนถึงการตั้งครั้งถัดไป */
export type RateSegment = { fromDay: number; b7: number; g95: number };
export type TurnInput = { guessSatang: number; segments: RateSegment[] };

export type DayTrace = { date: string; rate: number; realRate: number; retail: number; realRetail: number; volume: number; flow: number; realFlow: number };

export type TurnRecord = {
  turn: number;
  input: TurnInput;
  shockBp: number;
  guessTarget: number; // ราคา B7 วันอาทิตย์ ถ้าใช้อัตรา ณ ต้นฉาก (สตางค์/ลิตร)
  guessPoints: number;
  forcedDoc: boolean; // ตานี้มีเอกสารบังคับที่ใช้เวลา
  timeUsed: number;
  days: Record<Fuel, DayTrace[]>;
  flows: Record<Fuel, number>; // เงินเข้ากองทุนสุทธิของสัปดาห์ (บวก = เข้า)
  residualOil: number;
  residualLpg: number;
  fundOil: number;
  fundLpg: number;
  realFundOil: number;
  realFundLpg: number;
  retailB7Sunday: number;
  realRetailB7Sunday: number;
  rateB7Sunday: number;
  realRateB7Sunday: number;
  authority: number;
  trust: number;
  money: number;
};

export type GameState = {
  scenarioId: Scenario['scenarioId'];
  seed: number;
  params: GameParams;
  turn: number; // ตาที่จะเล่นต่อไป · weeks + 1 = จบแล้ว
  shocksBp: number[];
  balances: Balances;
  entries: Entry[];
  rates: { b7: number; g95: number };
  authority: number;
  trust: number;
  forcedDocNext: boolean;
  prevRetailB7: number;
  history: TurnRecord[];
};

const fundTotal = (b: Balances): number => b['fund.oil'] + b['fund.lpg'];

export function moneyGauge(total: number, p: GameParams): number {
  if (total >= 0) return p.capitalMax;
  const bands = Math.trunc((-total + p.moneyBandSatang - 1) / p.moneyBandSatang);
  return clamp(p.capitalMax - bands, 0, p.capitalMax);
}

export function createGame(sc: Scenario, seed: number, params: GameParams = DEFAULT_PARAMS): GameState {
  const rng = createRng(seed);
  const shocksBp = Array.from({ length: sc.weeks }, () => (params.shockMaxBp === 0 ? 0 : intInRange(rng, -params.shockMaxBp, params.shockMaxBp)));
  let balances = emptyBalances();
  const entries: Entry[] = [
    signedEntry(0, 'opening', 'fund.oil', sc.opening.fundOil.v, 'ยอดยกมา บัญชีน้ำมัน'),
    signedEntry(0, 'opening', 'fund.lpg', sc.opening.fundLpg.v, 'ยอดยกมา บัญชี LPG'),
  ];
  for (const e of entries) balances = post(balances, e);
  const first = sc.b7[0];
  if (!first) throw new Error('ฉากไม่มีวัน');
  return {
    scenarioId: sc.scenarioId,
    seed,
    params,
    turn: 1,
    shocksBp,
    balances,
    entries,
    rates: { b7: sc.startRates.b7.v, g95: sc.startRates.g95.v },
    authority: params.capitalMax,
    trust: params.capitalMax,
    forcedDocNext: false,
    prevRetailB7: first.retail.v,
    history: [],
  };
}

export const isFinished = (s: GameState, sc: Scenario): boolean => s.turn > sc.weeks;
export const timeAvailable = (s: GameState): number => s.params.timePerWeek - (s.forcedDocNext ? s.params.forcedDocCost : 0);
export const maxSpecialMeetings = (s: GameState): number => Math.trunc(Math.max(0, timeAvailable(s)) / s.params.specialMeetingCost);

const withShock = (price: number, shockBp: number): number => price + mulDiv(price, shockBp, 10000);
// ราคาไม่ต่ำกว่าศูนย์ แม้ผู้เล่นชดเชยเกินราคา
const playPrice = (sc: Scenario, base: number, rate: number, realRate: number): number => Math.max(0, base + mulDiv(rate - realRate, 10000 + sc.vatBp.v, 10000));

/** ราคา B7 วันอาทิตย์ของตา ถ้าใช้อัตรา ณ ต้นฉาก (สิ่งที่ผู้เล่นทาย) */
export function guessTarget(s: GameState, sc: Scenario, turn = s.turn): number {
  const day = sc.b7[(turn - 1) * 7 + 6];
  const shock = s.shocksBp[turn - 1];
  if (!day || shock === undefined) throw new Error(`ไม่มีตา ${turn}`);
  return playPrice(sc, withShock(day.retail.v, shock), sc.startRates.b7.v, day.rate.v);
}

export function scoreGuess(guess: number, target: number, p: GameParams): number {
  const diff = Math.abs(guess - target);
  for (const band of p.guessBands) if (diff <= band.withinSatang) return band.points;
  return 0;
}

function validate(s: GameState, sc: Scenario, input: TurnInput): void {
  if (isFinished(s, sc)) throw new Error('ฉากจบแล้ว');
  if (!Number.isSafeInteger(input.guessSatang) || input.guessSatang < 0) throw new Error('คำทายต้องเป็นจำนวนเต็มสตางค์ไม่ติดลบ');
  const segs = input.segments;
  if (segs.length === 0 || segs[0]?.fromDay !== 0) throw new Error('ต้องตั้งอัตราในการประชุมปกติวันจันทร์ (fromDay 0)');
  if (segs.length - 1 > maxSpecialMeetings(s)) throw new Error(`ประชุมพิเศษได้ไม่เกิน ${maxSpecialMeetings(s)} ครั้งในตานี้`);
  segs.forEach((g, i) => {
    if (!Number.isSafeInteger(g.fromDay) || g.fromDay < 0 || g.fromDay > 6) throw new Error('fromDay ต้องอยู่ระหว่าง 0–6');
    if (i > 0 && g.fromDay <= (segs[i - 1] as RateSegment).fromDay) throw new Error('การประชุมต้องเรียงวันและไม่ซ้ำวัน');
    for (const f of FUELS) {
      const r = g[f];
      if (!Number.isSafeInteger(r) || r < s.params.rateMinSatang || r > s.params.rateMaxSatang) throw new Error(`อัตรา ${f} อยู่นอกขอบเขต: ${r}`);
    }
  });
}

export function submitTurn(s: GameState, sc: Scenario, input: TurnInput): GameState {
  validate(s, sc, input);
  const p = s.params;
  const t = s.turn;
  const shock = s.shocksBp[t - 1] as number;
  const target = guessTarget(s, sc, t);
  const start = (t - 1) * 7;
  const days: Record<Fuel, DayTrace[]> = { b7: [], g95: [] };
  const flows: Record<Fuel, number> = { b7: 0, g95: 0 };
  let realFlowSum = 0;

  for (let i = 0; i < 7; i++) {
    const seg = [...input.segments].reverse().find((g) => g.fromDay <= i) as RateSegment;
    for (const f of FUELS) {
      const d = sc[f][start + i];
      if (!d) throw new Error(`ไม่มีข้อมูลวันที่ ${start + i}`);
      const realRate = d.rate.v;
      const realRetail = d.retail.v;
      const realVolume = d.volume.v;
      const rate = seg[f];
      const retail = playPrice(sc, withShock(realRetail, shock), rate, realRate);
      // ปริมาณ = ปริมาณจริง × (1 + e × (ราคาในเกม − ราคาจริง) ÷ ราคาจริง) · ประมาณเชิงเส้น ไม่ต่ำกว่าศูนย์
      const volume = Math.max(0, mulDiv(realVolume, 10000 * realRetail + p.elasticityBp * (retail - realRetail), 10000 * realRetail));
      const flow = mul(rate, volume);
      const realFlow = mul(realRate, realVolume);
      flows[f] += flow;
      realFlowSum += realFlow;
      days[f].push({ date: sc.days[start + i] as string, rate, realRate, retail, realRetail, volume, flow, realFlow });
    }
  }

  const sun = sc.sundays[t - 1];
  if (!sun) throw new Error(`ไม่มีค่าจริงของวันอาทิตย์ตา ${t}`);
  const prevOil = t === 1 ? sc.opening.fundOil.v : (sc.sundays[t - 2] as Scenario['sundays'][number]).fundOil.v;
  const prevLpg = t === 1 ? sc.opening.fundLpg.v : (sc.sundays[t - 2] as Scenario['sundays'][number]).fundLpg.v;
  const residualOil = sun.fundOil.v - prevOil - realFlowSum;
  const residualLpg = sun.fundLpg.v - prevLpg;

  const weekEntries: Entry[] = [
    signedEntry(t, 'traders', 'fund.oil', flows.b7, 'ดีเซล B7 (บวก = ส่งเข้ากองทุน · ลบ = ชดเชย)'),
    signedEntry(t, 'traders', 'fund.oil', flows.g95, 'แก๊สโซฮอล์ 95 (บวก = ส่งเข้ากองทุน · ลบ = ชดเชย)'),
    signedEntry(t, 'other', 'fund.oil', residualOil, 'บัญชีน้ำมัน: รายการอื่นตามงบจริง'),
    signedEntry(t, 'other', 'fund.lpg', residualLpg, 'บัญชี LPG: รายการอื่นตามงบจริง'),
  ];
  let balances = s.balances;
  for (const e of weekEntries) balances = post(balances, e);
  if (ledgerSum(balances) !== 0) throw new Error(`บัญชีไม่ลงตัวในตา ${t}`);

  const prevTotal = fundTotal(s.balances);
  const total = fundTotal(balances);
  const retailSunday = (days.b7[6] as DayTrace).retail;
  const authority = clamp(s.authority + (prevTotal - total > p.authorityDropFundSatang ? -1 : 1), 0, p.capitalMax);
  const trust = clamp(s.trust + (retailSunday - s.prevRetailB7 > p.trustDropRetailSatang ? -1 : 1), 0, p.capitalMax);
  const last = input.segments[input.segments.length - 1] as RateSegment;
  const forcedDoc = s.forcedDocNext;
  const sunDay = sc.b7[start + 6] as Scenario['b7'][number];

  const record: TurnRecord = {
    turn: t,
    input,
    shockBp: shock,
    guessTarget: target,
    guessPoints: scoreGuess(input.guessSatang, target, p),
    forcedDoc,
    timeUsed: (forcedDoc ? p.forcedDocCost : 0) + (input.segments.length - 1) * p.specialMeetingCost,
    days,
    flows,
    residualOil,
    residualLpg,
    fundOil: balances['fund.oil'],
    fundLpg: balances['fund.lpg'],
    realFundOil: sun.fundOil.v,
    realFundLpg: sun.fundLpg.v,
    retailB7Sunday: retailSunday,
    realRetailB7Sunday: sunDay.retail.v,
    rateB7Sunday: last.b7,
    realRateB7Sunday: sunDay.rate.v,
    authority,
    trust,
    money: moneyGauge(total, p),
  };

  return {
    ...s,
    turn: t + 1,
    balances,
    entries: [...s.entries, ...weekEntries],
    rates: { b7: last.b7, g95: last.g95 },
    authority,
    trust,
    forcedDocNext: authority === 0 || trust === 0,
    prevRetailB7: retailSunday,
    history: [...s.history, record],
  };
}

/** เล่นทั้งฉากด้วยชุดการตัดสินใจที่กำหนด · ใช้กับเส้นฐาน golden run และเทสต์ */
export function runPlan(sc: Scenario, seed: number, plan: (s: GameState) => TurnInput, params: GameParams = DEFAULT_PARAMS): GameState {
  let s = createGame(sc, seed, params);
  while (!isFinished(s, sc)) s = submitTurn(s, sc, plan(s));
  return s;
}

/** เส้นฐาน "ถ้าไม่ออกนโยบายใหม่": อัตรา ณ ต้นฉากทั้ง 10 ตา seed เดียวกัน */
export const runBaseline = (sc: Scenario, seed: number, params: GameParams = DEFAULT_PARAMS): GameState =>
  runPlan(sc, seed, () => ({ guessSatang: 0, segments: [{ fromDay: 0, b7: sc.startRates.b7.v, g95: sc.startRates.g95.v }] }), params);

/** เดินตามอัตราจริงทุกวัน (ประชุมพิเศษตามวันที่อัตราจริงเปลี่ยน ถ้าเวลาพอ) · ใช้ตรวจว่าเครื่องยนต์ยึดกับเส้นจริง */
export function realPathInput(s: GameState, sc: Scenario, maxSpecials = Number.MAX_SAFE_INTEGER): TurnInput {
  const start = (s.turn - 1) * 7;
  const segments: RateSegment[] = [];
  for (let i = 0; i < 7; i++) {
    const b7 = (sc.b7[start + i] as Scenario['b7'][number]).rate.v;
    const g95 = (sc.g95[start + i] as Scenario['g95'][number]).rate.v;
    const prev = segments[segments.length - 1];
    if (!prev || prev.b7 !== b7 || prev.g95 !== g95) segments.push({ fromDay: i, b7, g95 });
  }
  return { guessSatang: guessTarget(s, sc), segments: segments.slice(0, 1 + maxSpecials) };
}

export type Report = {
  outcome: {
    fund: { player: number; baseline: number; real: number };
    retailB7: { player: number; baseline: number; real: number; realIds: string[]; realKind: 'real' | 'computed' };
  };
  politics: { authority: number; trust: number; max: number };
  understanding: { points: number; max: number };
  pathVsReal: { turn: number; date: string; rateB7: number; realRateB7: number; fund: number; realFund: number }[];
};

export function report(s: GameState, baseline: GameState, sc: Scenario): Report {
  if (!isFinished(s, sc) || !isFinished(baseline, sc)) throw new Error('ต้องเล่นจบก่อนจึงสรุปได้');
  const last = s.history[s.history.length - 1] as TurnRecord;
  const bLast = baseline.history[baseline.history.length - 1] as TurnRecord;
  const lastDay = sc.b7[sc.b7.length - 1] as Scenario['b7'][number];
  const maxPoints = sc.weeks * Math.max(...s.params.guessBands.map((b) => b.points));
  return {
    outcome: {
      fund: { player: fundTotal(s.balances), baseline: fundTotal(baseline.balances), real: last.realFundOil + last.realFundLpg },
      retailB7: { player: last.retailB7Sunday, baseline: bLast.retailB7Sunday, real: lastDay.retail.v, realIds: lastDay.retail.ids, realKind: lastDay.retail.kind },
    },
    politics: { authority: s.authority, trust: s.trust, max: s.params.capitalMax },
    understanding: { points: s.history.reduce((a, h) => a + h.guessPoints, 0), max: maxPoints },
    pathVsReal: s.history.map((h, i) => ({
      turn: h.turn,
      date: (sc.sundays[i] as Scenario['sundays'][number]).date,
      rateB7: h.rateB7Sunday,
      realRateB7: h.realRateB7Sunday,
      fund: h.fundOil + h.fundLpg,
      realFund: h.realFundOil + h.realFundLpg,
    })),
  };
}
