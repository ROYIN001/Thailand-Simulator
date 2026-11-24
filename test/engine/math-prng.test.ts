import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mulDiv, mul } from '../../src/engine/math.ts';
import { createRng, intInRange } from '../../src/engine/prng.ts';

describe('mulDiv', () => {
  it('ตัดเศษเข้าหาศูนย์ทั้งค่าบวกและลบ', () => {
    expect(mulDiv(7, 1, 2)).toBe(3);
    expect(mulDiv(-7, 1, 2)).toBe(-3);
    expect(mulDiv(7, -1, 2)).toBe(-3);
  });
  it('ไม่ล้นระหว่างทางกับค่าขนาดใหญ่', () => {
    expect(mulDiv(80_249_229, 50_000_000, 29_940_000)).toBe(Math.trunc(Number((80_249_229n * 50_000_000n) / 29_940_000n)));
  });
  it('ปฏิเสธค่าที่ไม่ใช่จำนวนเต็มหรือหารศูนย์', () => {
    expect(() => mulDiv(1.5, 1, 1)).toThrow();
    expect(() => mulDiv(1, 1, 0)).toThrow();
    expect(() => mul(2 ** 52, 4)).toThrow();
  });
  it('ตรงกับการหาร BigInt ทุกค่า (property)', () => {
    fc.assert(fc.property(fc.integer({ min: -1e7, max: 1e7 }), fc.integer({ min: -1e7, max: 1e7 }), fc.integer({ min: 1, max: 1e7 }), (a, b, c) =>
      mulDiv(a, b, c) === Number((BigInt(a) * BigInt(b)) / BigInt(c))));
  });
});

describe('PRNG', () => {
  it('seed เดียวกันให้ลำดับเดิม', () => {
    const a = createRng(42), b = createRng(42);
    const xs = Array.from({ length: 50 }, () => a.nextU32());
    expect(Array.from({ length: 50 }, () => b.nextU32())).toEqual(xs);
  });
  it('ค่าแรกของ seed 20260302 คงที่ (golden)', () => {
    const r = createRng(20260302);
    expect(Array.from({ length: 4 }, () => r.nextU32())).toMatchInlineSnapshot(`
      [
        1817133565,
        3768169903,
        4106467042,
        86017981,
      ]
    `);
  });
  it('intInRange อยู่ในช่วงเสมอ (property)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 0, max: 2000 }), (seed, lo, w) => {
      const r = createRng(seed);
      for (let i = 0; i < 20; i++) { const x = intInRange(r, lo, lo + w); if (x < lo || x > lo + w || !Number.isInteger(x)) return false; }
      return true;
    }));
  });
  it('ปฏิเสธ seed ที่ไม่ถูกต้อง', () => {
    expect(() => createRng(-1)).toThrow();
    expect(() => createRng(1.5)).toThrow();
  });
});
