// ระเบียนในไฟล์ข้อมูลกลาง สำหรับแผ่นที่มา · โหลดเมื่อเปิดแผ่นครั้งแรกเท่านั้น (แยกไฟล์ตอน build)
import type { FactRecord } from '../data/schema.ts';

export type Fact = FactRecord;
let cache: Promise<Map<string, Fact>> | null = null;

export function loadFacts(): Promise<Map<string, Fact>> {
  cache ??= (async () => {
    const files = import.meta.glob<{ default: Fact[] }>('../../data/oil-fund-2569/*.json');
    const map = new Map<string, Fact>();
    for (const load of Object.values(files)) for (const r of (await load()).default) map.set(r.id, r);
    return map;
  })();
  return cache;
}
