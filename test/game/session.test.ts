import { describe, expect, it } from 'vitest';
import { createGame, guessTarget, submitTurn } from '../../src/engine/game.ts';
import { b7SundayFromGuess, g95OverBase, weekFlowEstimate } from '../../src/game/estimate.ts';
import { fixtureSave, FIXTURE_KEYS, parseFixture } from '../../src/game/fixtures.ts';
import { parseSave, replay, scenario as sc } from '../../src/game/session.ts';

const roundtrip = (x: unknown) => JSON.parse(JSON.stringify(x));

describe('เซฟ', () => {
  it('ทุกสถานะตัวอย่างผ่านการตรวจและเล่นซ้ำได้', () => {
    for (const k of FIXTURE_KEYS) {
      const r = parseSave(roundtrip(parseFixture(k)));
      expect(r.ok, k).toBe(true);
    }
    const r = parseSave(roundtrip(fixtureSave(4, 'rates')));
    expect(r.ok && r.state.turn).toBe(4);
  });

  it('ปฏิเสธไฟล์ที่ผิดรูปแบบ', () => {
    const s = roundtrip(fixtureSave(4, 'guess'));
    expect(parseSave({ ...s, seed: '1' }).ok).toBe(false);
    expect(parseSave({ ...s, extra: 1 }).ok).toBe(false);
    expect(parseSave({ ...s, inputs: [{ guessSatang: 1.5, segments: [{ fromDay: 0, b7: 0, g95: 0 }] }] }).ok).toBe(false);
    expect(parseSave(null).ok).toBe(false);
  });

  it('ปฏิเสธการตัดสินใจที่เครื่องยนต์ไม่รับ', () => {
    const s = roundtrip(fixtureSave(2, 'files'));
    s.inputs[0].segments = [{ fromDay: 0, b7: -5000, g95: 0 }]; // ชดเชยเกินราคา
    const r = parseSave(s);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('เล่นซ้ำไม่ได้');
  });

  it('ปฏิเสธขั้นที่ไม่ตรงกับสถานะ', () => {
    expect(parseSave({ ...roundtrip(fixtureSave(4, 'guess')), guess: 3000 }).ok).toBe(false);
    expect(parseSave({ ...roundtrip(fixtureSave(4, 'rates')), guess: null }).ok).toBe(false);
    expect(parseSave({ ...roundtrip(fixtureSave(4, 'guess')), phase: 'end' }).ok).toBe(false);
  });
});

describe('ค่าประมาณบนจอตั้งอัตรา', () => {
  it('ถ้าทายถูก ราคาประมาณวันอาทิตย์เท่ากับราคาในเกมจริง และแก๊สโซฮอล์ 95 เหนือเส้นฐานตรงกับเครื่องยนต์', () => {
    let s = createGame(sc, 7);
    for (let t = 1; t <= sc.weeks; t++) {
      const target = guessTarget(s, sc);
      const seg = { fromDay: 0, b7: -800 + 50 * t, g95: 100 * t };
      const est = weekFlowEstimate(s, sc, 'b7', [seg]);
      s = submitTurn(s, sc, { guessSatang: target ?? 0, segments: [seg] });
      const h = s.history[t - 1]!;
      // คลาดได้ 1 สตางค์จากการปัดเศษสองครั้งของเครื่องยนต์ (estimate.ts)
      if (target !== null) expect(Math.abs(b7SundayFromGuess(sc, target, seg.b7) - h.retailB7Sunday)).toBeLessThanOrEqual(1);
      expect(Math.abs(g95OverBase(sc, seg.g95) - h.maxG95OverBase)).toBeLessThanOrEqual(1);
      expect(Math.sign(est)).toBe(Math.sign(h.flows.b7) || Math.sign(est)); // ทิศเดียวกับเงินจริงในเกม
    }
  });
  it('replay ของสถานะตัวอย่างตรงกับจำนวนตา', () => {
    expect(replay(fixtureSave(10, 'end')).history).toHaveLength(10);
  });
});
