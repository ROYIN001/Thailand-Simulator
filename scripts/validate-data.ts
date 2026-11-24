// ตรวจไฟล์ข้อมูลทุกไฟล์ใน data/ ด้วย schema และตรวจว่า id ไม่ซ้ำข้ามไฟล์
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FactFile } from '../src/data/schema.ts';

const root = 'data';
const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.json')).sort();
const seen = new Map<string, string>();
let errors = 0;
let count = 0;
for (const f of files) {
  const parsed = FactFile.safeParse(JSON.parse(readFileSync(join(root, f), 'utf8')));
  if (!parsed.success) {
    errors += parsed.error.issues.length;
    for (const i of parsed.error.issues.slice(0, 20)) console.error(`${f}: [${i.path.join('.')}] ${i.message}`);
    continue;
  }
  for (const r of parsed.data) {
    const prev = seen.get(r.id);
    if (prev) { errors++; console.error(`${f}: id ซ้ำกับ ${prev}: ${r.id}`); }
    seen.set(r.id, f);
    count++;
  }
}
if (files.length === 0) { console.error('ไม่พบไฟล์ข้อมูล'); process.exit(1); }
console.log(`${files.length} ไฟล์ · ${count} ระเบียน · ข้อผิดพลาด ${errors}`);
process.exit(errors ? 1 : 0);
