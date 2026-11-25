// สถานะตัวอย่างสำหรับตรวจหน้าจอ (?fixture=4-guess) และเทสต์ · ใช้แผนเดียวกับ golden run ใน test/engine/golden.test.ts
import type { TurnInput } from '../engine/game.ts';
import { newSave, replay, scenario as sc, PHASES, type Phase, type Save } from './session.ts';

export const FIXTURE_SEED = 20260302;
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

/** คำทายตัวอย่าง: ราคาวันอาทิตย์ก่อนหน้าบวก 1 บาท (ให้มีทั้งตาที่ได้แต้มและไม่ได้) */
const guessFor = (save: Save): number => {
  const s = replay(save);
  const prev = s.history[s.history.length - 1];
  return (prev ? prev.retailB7Sunday : (sc.b7[0]?.retail.v ?? 0)) + 100;
};

/** เกมที่เล่นตา 1 ถึง turn − 1 แล้ว และอยู่ที่ขั้น phase ของตา turn (phase result/end = เล่นตา turn แล้ว) */
export function fixtureSave(turn: number, phase: Phase): Save {
  if (turn < 1 || turn > sc.weeks) throw new Error(`ไม่มีตา ${turn}`);
  let save = newSave(FIXTURE_SEED);
  const playUntil = phase === 'result' || phase === 'end' ? turn : turn - 1;
  for (let t = 1; t <= playUntil; t++) {
    const p = PLAN[t - 1] as (typeof PLAN)[number];
    const input: TurnInput = { guessSatang: guessFor(save), segments: [{ fromDay: 0, b7: p.b7, g95: p.g95 }, ...(p.special ? [p.special] : [])] };
    save = { ...save, inputs: [...save.inputs, input] };
  }
  const guess = phase === 'rates' ? guessFor(save) : null;
  return { ...save, phase: phase === 'end' && turn !== sc.weeks ? 'result' : phase, guess };
}

/** "4-guess" → fixtureSave(4, 'guess') */
export function parseFixture(key: string): Save | null {
  const m = /^(\d{1,2})-([a-z]+)$/.exec(key);
  if (!m) return null;
  const phase = m[2] as Phase;
  if (!PHASES.includes(phase)) return null;
  return fixtureSave(Number(m[1]), phase);
}

/** ทุกจุดที่ควรตรวจหน้าจอ */
export const FIXTURE_KEYS: string[] = [
  '1-files', '1-guess', '1-rates', '1-result',
  '3-guess', '4-files', '4-guess', '4-rates', '4-result',
  '5-guess', '5-result', '7-rates', '10-result', '10-end',
];
