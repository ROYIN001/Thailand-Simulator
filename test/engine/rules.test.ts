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
  // ตัดคอมเมนต์และข้อความในสตริงในรอบเดียว แต่เก็บโค้ดใน ${...} ของ template ไว้ตรวจ
  const strip = (src: string): string => {
    let out = '';
    let i = 0;
    while (i < src.length) {
      const c = src[i] as string, d = src[i + 1];
      if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; out += ' '; continue; }
      if (c === "'" || c === '"') { i++; while (i < src.length && src[i] !== c) i += src[i] === '\\' ? 2 : 1; i++; out += "''"; continue; }
      if (c === '`') {
        i++;
        while (i < src.length && src[i] !== '`') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '$' && src[i + 1] === '{') {
            i += 2;
            let depth = 1, expr = '';
            while (i < src.length) { if (src[i] === '{') depth++; if (src[i] === '}' && --depth === 0) break; expr += src[i]; i++; }
            i++;
            out += ` ${strip(expr)} `;
            continue;
          }
          i++;
        }
        i++;
        out += "''";
        continue;
      }
      out += c;
      i++;
    }
    return out;
  };
  it.each(files)('%s ไม่ใช้ API ที่ไม่ deterministic', (f) => {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    for (const m of code.matchAll(/\bMath\s*(?:\.\s*([A-Za-z0-9_$]+)|\[)?/g)) {
      expect(m[1] !== undefined && ALLOWED_MATH.has(m[1]), `ใช้ Math แบบไม่อนุญาตใน ${f}: ${m[0]}`).toBe(true);
    }
    expect(code).not.toMatch(/\bDate\b|\bcrypto\b|\bperformance\b|\*\*/);
  });
  it('ตัวตรวจจับสิ่งที่ห้ามได้จริง', () => {
    const bad = ['const M = Math; M.random()', 'const { sinh } = Math', 'Math.atan(1)', "Math['random']()", 'new Date', 'crypto.getRandomValues(a)', 'performance.now()', 'x ** 2',
      '`${x ** 2}`', "const u = 'a//b'; const M2 = Math; M2.random()", '`${(0, Math).random()}`', '`${globalThis.Date.now()}`', '/* c */ Math.log(2)'];
    expect(strip("const s = 'Math.random()'; // Math.random()")).not.toMatch(/Math/);
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
  it('ค่าแทนของวัน uncertain ของ B7 ไม่สูงกว่าราคาที่บันทึกไว้ถัดไป (เครื่องยนต์นับวันเหล่านี้ในความเชื่อใจได้)', () => {
    scenario.b7.forEach((d, i) => {
      if (d.retail.kind !== 'uncertain') return;
      const next = scenario.b7.slice(i + 1).find((x) => x.retail.kind !== 'uncertain')!;
      expect(d.retail.v, scenario.days[i]).toBeLessThanOrEqual(next.retail.v);
    });
  });
  it('ค่าจริงทุกค่าอ้าง id ที่มีอยู่และ verified', () => {
    const d = 'data/oil-fund-2569';
    const byId = new Map(readdirSync(d).filter((f) => f.endsWith('.json')).flatMap((f) => FactFile.parse(JSON.parse(readFileSync(join(d, f), 'utf8')))).map((r) => [r.id, r]));
    const ids = JSON.stringify(scenario).match(/"ids":\[[^\]]*\]/g)!.flatMap((m) => JSON.parse(m.slice(6)) as string[]);
    expect(ids.length).toBeGreaterThan(400);
    for (const id of new Set(ids)) expect(byId.get(id)?.status, id).toBe('verified');
  });
});
