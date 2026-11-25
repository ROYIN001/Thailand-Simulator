// เซฟของเกม = seed + ค่าของเกม + การตัดสินใจทุกตา · โหลดด้วยการเล่นซ้ำผ่านเครื่องยนต์ (deterministic) จึงไม่ต้องเก็บสถานะ
// ไฟล์เซฟที่นำเข้าต้องผ่าน schema ก่อน แล้วต้องเล่นซ้ำผ่านการตรวจของเครื่องยนต์ทุกตา (CLAUDE.md หัวข้อหน้าจอและเซฟ)
import * as z from 'zod/mini';
import { createGame, isFinished, runBaseline, submitTurn, type GameState, type TurnInput, type TurnRecord } from '../engine/game.ts';
import { DEFAULT_PARAMS, type GameParams } from '../engine/params.ts';
import type { Scenario } from '../engine/scenario-types.ts';
import scenarioJson from '../engine/scenario.oil-fund-2569.json';

export const scenario = scenarioJson as Scenario;

/** ขั้นในหนึ่งตา · files/guess/rates เป็นของตาที่กำลังเล่น (state.turn) · result คือผลของตาที่เพิ่งเล่น · end = บัตรรายงานตอนจบ */
export const PHASES = ['files', 'guess', 'rates', 'result', 'end'] as const;
export type Phase = (typeof PHASES)[number];

export type Save = {
  v: 1;
  scenarioId: 'oil-fund-2569';
  seed: number;
  params: GameParams;
  inputs: TurnInput[];
  phase: Phase;
  guess: number | null; // คำทายที่ล็อกแล้วของตาที่กำลังเล่น (สตางค์/ลิตร)
};

const int = z.int();
const SaveSchema = z.strictObject({
  v: z.literal(1),
  scenarioId: z.literal('oil-fund-2569'),
  seed: z.int().check(z.minimum(0), z.maximum(0xffffffff)),
  params: z.strictObject({
    elasticityBp: int,
    shockMaxBp: z.int().check(z.minimum(0), z.maximum(5000)),
    authorityStepSatang: z.int().check(z.minimum(1)),
    trustB7LevelSatang: int,
    trustB7StepSatang: z.int().check(z.minimum(1)),
    trustG95OverBaseSatang: int,
    trustG95StepSatang: z.int().check(z.minimum(1)),
    recoverAfterCleanWeeks: z.int().check(z.minimum(1)),
    capitalStep: z.int().check(z.minimum(0)),
    capitalMax: z.int().check(z.minimum(1), z.maximum(20)),
    timePerWeek: z.int().check(z.minimum(0), z.maximum(20)),
    specialMeetingCost: z.int().check(z.minimum(1)),
    forcedDocCost: z.int().check(z.minimum(0)),
    rateMinSatang: int,
    rateMaxSatang: int,
    guessBands: z.array(z.strictObject({ withinSatang: z.int().check(z.minimum(0)), points: z.int().check(z.minimum(0)) })).check(z.maxLength(5)),
    moneyBandSatang: z.int().check(z.minimum(1)),
  }),
  inputs: z
    .array(
      z.strictObject({
        guessSatang: z.int().check(z.minimum(0)),
        segments: z.array(z.strictObject({ fromDay: z.int().check(z.minimum(0), z.maximum(6)), b7: int, g95: int })).check(z.minLength(1), z.maxLength(7)),
      }),
    )
    .check(z.maxLength(52)),
  phase: z.enum(PHASES),
  guess: z.nullable(z.int().check(z.minimum(0))),
});

export function newSave(seed: number, params: GameParams = DEFAULT_PARAMS): Save {
  return { v: 1, scenarioId: 'oil-fund-2569', seed, params: structuredClone(params), inputs: [], phase: 'files', guess: null };
}

/** สถานะจากการเล่นซ้ำ · โยนข้อผิดพลาดถ้าการตัดสินใจใดไม่ผ่านการตรวจของเครื่องยนต์ */
export function replay(save: Save, sc: Scenario = scenario): GameState {
  let s = createGame(sc, save.seed, save.params);
  for (const input of save.inputs) s = submitTurn(s, sc, input);
  return s;
}

export type Loaded = { ok: true; save: Save; state: GameState } | { ok: false; error: string };

/** ตรวจไฟล์เซฟ (schema → เล่นซ้ำ → ขั้นตรงกับสถานะ) ก่อนโหลด */
export function parseSave(raw: unknown, sc: Scenario = scenario): Loaded {
  const r = SaveSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: `ไฟล์เซฟไม่ตรงรูปแบบ: ${z.prettifyError(r.error)}` };
  const save = r.data as Save;
  let state: GameState;
  try {
    state = replay(save, sc);
  } catch (e) {
    return { ok: false, error: `การตัดสินใจในไฟล์เซฟเล่นซ้ำไม่ได้: ${(e as Error).message}` };
  }
  const done = isFinished(state, sc);
  const played = save.inputs.length;
  if ((save.phase === 'result' && played === 0) || (save.phase === 'end' && !done) || (done && save.phase !== 'result' && save.phase !== 'end'))
    return { ok: false, error: 'ขั้นของตาในไฟล์เซฟไม่ตรงกับจำนวนตาที่เล่น' };
  if ((save.phase === 'rates') !== (save.guess !== null)) return { ok: false, error: 'คำทายในไฟล์เซฟไม่ตรงกับขั้นของตา' };
  return { ok: true, save, state };
}

// ---- การเก็บในเครื่อง · คีย์ขึ้นต้นด้วย rattanava: เสมอ (origin ร่วมกับ repo อื่นบน GitHub Pages) ----
export const SAVE_KEY = 'rattanava:save:oil-fund-2569';

export function readStored(sc: Scenario = scenario): Loaded | null {
  let text: string | null = null;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;
  try {
    return parseSave(JSON.parse(text), sc);
  } catch {
    return { ok: false, error: 'เซฟในเครื่องอ่านไม่ได้ (ไม่ใช่ JSON)' };
  }
}

/** คืน false ถ้าเบราว์เซอร์ไม่ให้เขียน (เช่น โหมดส่วนตัว) */
export function writeStored(save: Save): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearStored(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ไม่มีอะไรให้ลบ */
  }
}

/** seed ใหม่สำหรับเกมใหม่ (อยู่นอกเครื่องยนต์ จึงใช้ crypto ได้) */
export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] as number;
}

/** ข้อมูลที่จอทุกจอได้รับ · baselinePlayed ตัดเฉพาะตาที่เล่นแล้ว เพราะเส้นฐานของตาที่ยังไม่เล่นคือคำตอบของการทาย */
export type Game = {
  sc: Scenario;
  save: Save;
  state: GameState;
  played: TurnRecord[];
  baselinePlayed: TurnRecord[];
};

export function makeGame(sc: Scenario, save: Save, state: GameState, baseline: GameState): Game {
  return { sc, save, state, played: state.history, baselinePlayed: baseline.history.slice(0, state.history.length) };
}

export const baselineFor = (save: Save, sc: Scenario = scenario): GameState => runBaseline(sc, save.seed, save.params);
