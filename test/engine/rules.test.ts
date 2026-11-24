// กฎของเครื่องยนต์ที่ CLAUDE.md บังคับ และไฟล์ฉากต้องตรงกับไฟล์ข้อมูลกลาง
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FactFile } from '../../src/data/schema.ts';
import { buildScenario } from '../../src/data/build-scenario.ts';
import { scenario } from './helpers.ts';

describe('กฎของเครื่องยนต์', () => {
  const dir = 'src/engine';
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  it.each(files)('%s ไม่ใช้ API ที่ไม่ deterministic', (f) => {
    const code = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/Math\.(random|pow|exp|expm1|log|log1p|log2|log10|sin|cos|tan|atan2|cbrt|hypot)\b|Date\.now|new Date\(|performance\.now|\*\*/);
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
