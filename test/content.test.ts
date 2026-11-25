// เอกสารในแฟ้ม: ตรงตาม schema · อ้างเฉพาะระเบียนที่ตรวจแล้ว · ตัวเลขจริงตรงกับระเบียน · ไม่บอกสิ่งที่ยังไม่เกิด
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ContentFile, type Seg, type TemplateDoc, type WeeklyDoc } from '../src/data/content-schema.ts';
import type { FactRecord } from '../src/data/schema.ts';
import type { Scenario } from '../src/engine/scenario-types.ts';

const content = ContentFile.parse(JSON.parse(readFileSync('content/oil-fund-2569/docs.json', 'utf8')));
const sc = JSON.parse(readFileSync('src/engine/scenario.oil-fund-2569.json', 'utf8')) as Scenario;
const facts = new Map<string, FactRecord>();
for (const f of readdirSync('data/oil-fund-2569')) for (const r of JSON.parse(readFileSync(`data/oil-fund-2569/${f}`, 'utf8')) as FactRecord[]) facts.set(r.id, r);

const numOf = (n: string): number => Number(n.replace(/,/g, '').replace('−', '-').replace('%', ''));
const nums = (d: WeeklyDoc | TemplateDoc) => d.body.flat().filter((s): s is Extract<Seg, { n: string }> => typeof s === 'object' && 'n' in s);
const all: (WeeklyDoc | TemplateDoc)[] = [content.shockMemo, ...Object.values(content.forced), ...content.weekly];
const dayBefore = (iso: string): string => {
  const i = sc.days.indexOf(iso);
  return i > 0 ? (sc.days[i - 1] as string) : '2026-03-01';
};

describe('เอกสารในแฟ้ม', () => {
  it('id ไม่ซ้ำ', () => {
    const ids = all.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('อ้างเฉพาะระเบียนที่มีอยู่และตรวจแล้ว', () => {
    for (const d of all)
      for (const id of [...d.basis, ...nums(d).flatMap((s) => s.ids)]) {
        const r = facts.get(id);
        expect(r, `${d.id} อ้าง ${id} ที่ไม่มีในไฟล์ข้อมูล`).toBeDefined();
        expect(r?.status, `${d.id} อ้าง ${id} ที่สถานะ ${r?.status}`).toBe('verified');
      }
  });

  it('ตัวเลขจริงเท่ากับค่าในระเบียน', () => {
    for (const d of all)
      for (const s of nums(d).filter((x) => x.ev === 'real')) {
        const r = facts.get(s.ids[0] as string);
        expect(numOf(s.n), `${d.id}: ${s.n} ไม่ตรงกับ ${s.ids[0]} = ${r?.value}`).toBe(r?.value);
      }
  });

  it('ไม่บอกสิ่งที่เกิดหลังวันอาทิตย์ก่อนตา และลงวันที่ไม่เกินวันจันทร์ของตา', () => {
    for (const d of content.weekly) {
      const monday = sc.days[(d.turn - 1) * 7] as string;
      expect(d.date <= monday, `${d.id} ลงวันที่ ${d.date} หลังวันจันทร์ ${monday}`).toBe(true);
      for (const id of [...d.basis, ...nums(d).flatMap((s) => s.ids)]) {
        const asOf = facts.get(id)?.asOf ?? '9999';
        expect(asOf <= dayBefore(monday), `${d.id} อ้าง ${id} (${asOf}) ซึ่งผู้เล่นยังไม่ควรรู้ก่อนประชุม ${monday}`).toBe(true);
      }
    }
  });

  it('แต่ละตามีเอกสาร 1–2 ฉบับ (รวมบันทึกช็อกเป็น 2–3 ฉบับ และเอกสารบังคับอีกไม่เกิน 1)', () => {
    for (let t = 1; t <= sc.weeks; t++) {
      const n = content.weekly.filter((d) => d.turn === t).length;
      expect(n, `ตา ${t} มีเอกสาร ${n} ฉบับ`).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('แม่แบบมีช่องที่ต้องใช้', () => {
    expect(JSON.stringify(content.shockMemo.body)).toContain('"slot":"shockPct"');
  });
});
