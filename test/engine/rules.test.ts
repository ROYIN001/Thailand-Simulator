// กฎของเครื่องยนต์ที่ CLAUDE.md บังคับ และไฟล์ฉากต้องตรงกับไฟล์ข้อมูลกลาง
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FactFile } from '../../src/data/schema.ts';
import { buildScenario } from '../../src/data/build-scenario.ts';
import { scenario } from './helpers.ts';

describe('กฎของเครื่องยนต์', () => {
  const dir = 'src/engine';
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts'));
  // อนุญาตเฉพาะเมธอดของ Math ที่ให้ผลแน่นอนทุกเบราว์เซอร์ · ห้ามนามแฝงของ Math และห้าม Date crypto performance และ **
  const ALLOWED_MATH = new Set(['trunc', 'max', 'min', 'abs', 'imul']);
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "''");
  it.each(files)('%s ไม่ใช้ API ที่ไม่ deterministic', (f) => {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    for (const m of code.matchAll(/\bMath\s*(?:\.\s*([A-Za-z0-9_$]+)|\[)?/g)) {
      expect(m[1] !== undefined && ALLOWED_MATH.has(m[1]), `ใช้ Math แบบไม่อนุญาตใน ${f}: ${m[0]}`).toBe(true);
    }
    expect(code).not.toMatch(/\bDate\b|\bcrypto\b|\bperformance\b|\*\*/);
  });
  it('ตัวตรวจจับสิ่งที่ห้ามได้จริง', () => {
    const bad = ['const M = Math; M.random()', 'const { sinh } = Math', 'Math.atan(1)', "Math['random']()", 'new Date', 'crypto.getRandomValues(a)', 'performance.now()', 'x ** 2'];
    for (const b of bad) {
      const code = strip(b);
      const mathBad = [...code.matchAll(/\bMath\s*(?:\.\s*([A-Za-z0-9_$]+)|\[)?/g)].some((m) => !(m[1] !== undefined && ALLOWED_MATH.has(m[1])));
      expect(mathBad || /\bDate\b|\bcrypto\b|\bperformance\b|\*\*/.test(code), b).toBe(true);
    }
  });
});

describe('ไฟล์ฉาก', () => {
  it('ตรงกับที่สร้างจากไฟล์ข้อมูลกลางปัจจุบัน', () => {
    const d = 'data/oil-fund-2569';
    const records = readdirSync(d).filter((f) => f.endsWith('.json')).flatMap((f) => FactFile.parse(JSON.parse(readFileSync(join(d, f), 'utf8'))));
    expect(buildScenario(records)).toEqual(scenario);
  });
  it('ค่าจริงทุกค่าอ้าง id ที่มีอยู่และ verified', () => {
    const d = 'data/oil-fund-2569';
    const byId = new Map(readdirSync(d).filter((f) => f.endsWith('.json')).flatMap((f) => FactFile.parse(JSON.parse(readFileSync(join(d, f), 'utf8')))).map((r) => [r.id, r]));
    const ids = JSON.stringify(scenario).match(/"ids":\[[^\]]*\]/g)!.flatMap((m) => JSON.parse(m.slice(6)) as string[]);
    expect(ids.length).toBeGreaterThan(400);
    for (const id of new Set(ids)) expect(byId.get(id)?.status, id).toBe('verified');
  });
});
