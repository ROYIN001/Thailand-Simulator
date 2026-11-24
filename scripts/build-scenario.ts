// สร้าง src/engine/scenario.oil-fund-2569.json จาก data/oil-fund-2569/*.json · ใช้ --check เพื่อตรวจว่าไฟล์ที่ commit ตรงกับข้อมูลล่าสุด
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FactFile } from '../src/data/schema.ts';
import { buildScenario } from '../src/data/build-scenario.ts';

const dir = 'data/oil-fund-2569';
const out = 'src/engine/scenario.oil-fund-2569.json';
const records = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().flatMap((f) => FactFile.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const text = `${JSON.stringify(buildScenario(records), null, 1)}\n`;
if (process.argv.includes('--check')) {
  const current = readFileSync(out, 'utf8');
  if (current !== text) { console.error(`${out} ไม่ตรงกับข้อมูล ให้รัน npm run build:scenario`); process.exit(1); }
  console.log(`${out} ตรงกับข้อมูล`);
} else {
  writeFileSync(out, text);
  console.log(`เขียน ${out}`);
}
