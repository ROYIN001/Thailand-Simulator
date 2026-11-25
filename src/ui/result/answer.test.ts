// ขั้นของคำตอบบนแผ่น "ทำไมคำตอบเป็น …" ต้องรวมได้เท่ากับคำตอบของเครื่องยนต์ทุกตาที่นับ
import { describe, expect, it } from 'vitest';
import { runPlan, runBaseline } from '../../engine/game.ts';
import { fixtureSave } from '../../game/fixtures.ts';
import { replay, scenario as sc } from '../../game/session.ts';
import { answerSteps } from './shared.tsx';

describe('answerSteps', () => {
  const games = [
    replay(fixtureSave(10, 'end')),
    runBaseline(sc, 1),
    runPlan(sc, 987654321, (s) => ({ guessSatang: 4000, segments: [{ fromDay: 0, b7: s.turn % 2 ? -2000 : 500, g95: 300 }] })),
  ];
  for (const s of games)
    it(`seed ${s.seed}`, () => {
      for (const rec of s.history) if (rec.guessTarget !== null) expect(answerSteps(sc, rec).answer).toBe(rec.guessTarget);
      expect(s.history.filter((r) => r.guessTarget !== null).length).toBeGreaterThan(0);
    });
});
