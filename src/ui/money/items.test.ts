// ห่วงโซ่ตามเงินของแท็บเงิน: ยอดแต่ละตาลงตัวกับเงินสี่ช่องทาง · ค่าไม่แน่นอนไม่แสดงเป็นตัวเลข · ไม่มีตาที่ยังไม่เล่น
import { describe, expect, it } from 'vitest';
import { fixtureSave } from '../../game/fixtures.ts';
import { baselineFor, makeGame, replay, scenario as sc } from '../../game/session.ts';
import type { SourceItem } from '../evidence.tsx';
import { fundChain } from './items.ts';

const gameAt = (turn: number, phase: 'guess' | 'end') => {
  const save = fixtureSave(turn, phase);
  return makeGame(sc, save, replay(save, sc), baselineFor(save, sc));
};

function walk(x: SourceItem, seen: Set<SourceItem>, visit: (x: SourceItem) => void): void {
  if (seen.has(x)) return;
  seen.add(x);
  visit(x);
  for (const y of x.ev.inputs ?? []) walk(y, seen, visit);
}

describe('ห่วงโซ่ตามเงิน', () => {
  it('ฐานะแต่ละตา = ตาก่อน + เงินสี่ช่องทาง (สตางค์)', () => {
    const c = fundChain(gameAt(10, 'end'));
    expect(c.weeks).toHaveLength(10);
    let prev = c.openingV;
    for (const w of c.weeks) {
      const r = w.rec;
      expect(r.fundOil + r.fundLpg).toBe(prev + r.flows.b7 + r.flows.g95 + r.residualOil + r.residualLpg);
      expect(w.fund.ev.inputs).toHaveLength(5);
      prev = r.fundOil + r.fundLpg;
    }
  });

  it('ค่าที่ยังไม่มีข้อมูลหรือไม่แน่นอนไม่แสดงเป็นตัวเลข และทุกค่าคำนวณมีส่วนประกอบหรือ id', () => {
    const c = fundChain(gameAt(10, 'end'));
    const seen = new Set<SourceItem>();
    let missing = 0;
    for (const w of c.weeks)
      for (const x of [w.fund, w.baseFund, w.real])
        walk(x, seen, (y) => {
          if (y.ev.kind === 'missing') {
            missing++;
            expect(y.text).not.toMatch(/\d/);
          }
          if (y.ev.kind === 'computed') expect((y.ev.inputs?.length ?? 0) + (y.ev.ids?.length ?? 0)).toBeGreaterThan(0);
          if (y.ev.kind === 'real') expect(y.ev.ids?.length).toBeGreaterThan(0);
        });
    expect(missing).toBeGreaterThan(0); // ฉากมีวันราคาไม่แน่นอน ห่วงโซ่ต้องเจอ
  });

  it('ก่อนเห็นผลของตา มีเฉพาะตาที่เล่นแล้ว', () => {
    const c = fundChain(gameAt(4, 'guess'));
    expect(c.weeks.map((w) => w.rec.turn)).toEqual([1, 2, 3]);
    const seen = new Set<SourceItem>();
    const dates = new Set<string>();
    for (const w of c.weeks) walk(w.fund, seen, (y) => dates.add(y.ev.label));
    // ไม่มีป้ายใดพูดถึงวันในตา 4 (23–29 มี.ค.)
    expect([...dates].some((l) => /2[3-9] มี\.ค\./.test(l))).toBe(false);
  });
});
