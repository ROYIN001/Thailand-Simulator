// เล่นครบ 10 ตาผ่านหน้าจอจริงจากหน้าเริ่ม (ไม่ใช้สถานะตัวอย่าง) ที่ 390×844 และ 1440×900
// ตรวจทุกจอ: ไม่มีข้อผิดพลาด · ไม่มีหน้าเลื่อนแนวนอน · ตัวเลขทุกตัวมีป้ายที่มา · เซฟคงอยู่หลังโหลดหน้าใหม่ · ส่งออกแล้วนำเข้าเซฟได้
// ใช้: npm run build && node scripts/playthrough.mjs [โฟลเดอร์ภาพ]   (DIST=<dir> เลือกโฟลเดอร์ build)
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] ?? 'shots-play';
mkdirSync(out, { recursive: true });
const NAMES = readFileSync('src/data/names.ts', 'utf8').match(/NAMES_WITH_DIGITS = (\/.*\/g);/)[1];
const server = await preview({ build: { outDir: process.env.DIST ?? 'dist' }, preview: { port: 0, open: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const fails = [];
const seen = (loc) => loc.first().waitFor({ timeout: 5000 }).then(() => true, () => false);
const fail = (m) => {
  fails.push(m);
  console.log('FAIL', m);
};

async function audit(page, where) {
  const r = await page.evaluate((namesSrc) => {
    const names = new Function(`return ${namesSrc}`)();
    const bad = [];
    const walker = document.createTreeWalker(document.querySelector('.app'), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('[data-ev], time, [data-ord], [data-ref], [data-axis], .sheet, style, script')) continue;
      if (/[0-9๐-๙]/.test(n.textContent.replace(names, ''))) bad.push(n.textContent.trim().slice(0, 60));
    }
    const W = document.documentElement.clientWidth;
    return { bad, sideways: document.documentElement.scrollWidth > W + 1 };
  }, NAMES);
  if (r.bad.length) fail(`${where}: ตัวเลขไม่มีป้าย ${JSON.stringify(r.bad.slice(0, 3))}`);
  if (r.sideways) fail(`${where}: หน้าเลื่อนแนวนอน`);
}

for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`${vp.width} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && fail(`${vp.width} console: ${m.text()}`));
  await page.goto(base);
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('rattanava:')).forEach((k) => localStorage.removeItem(k)));
  await page.goto(`${base}?seed-check`);
  await page.getByRole('button', { name: 'เริ่มด้วย seed นี้' }).isDisabled();
  await page.fill('#seed', '424242');
  await page.getByRole('button', { name: 'เริ่มด้วย seed นี้' }).click();
  const primary = () => page.locator('main .btn--primary').last();
  for (let turn = 1; turn <= 10; turn++) {
    const tag = `${vp.width} ตา ${turn}`;
    await audit(page, `${tag} แฟ้ม`);
    await primary().click(); // ไปทายผล
    await audit(page, `${tag} ทาย`);
    if (turn % 3 === 0) await page.getByRole('button', { name: /เพิ่ม|\+0\.10/ }).first().click();
    await primary().click(); // ล็อกคำทาย
    if (turn === 2) {
      // โหลดหน้าใหม่หลังล็อก: ต้องกลับมาที่จอตั้งอัตราโดยคำทายยังล็อกอยู่
      await page.reload();
      if (!(await seen(page.getByText('ลงมติ')))) fail(`${tag}: โหลดใหม่แล้วไม่กลับมาที่จอตั้งอัตรา`);
    }
    await audit(page, `${tag} ตั้งอัตรา`);
    if (turn === 2 || turn === 6) {
      await page.getByRole('button', { name: /นัดประชุมพิเศษ/ }).first().click();
      await page.getByRole('button', { name: 'ไปทางชดเชย 1.00 บาท' }).first().click();
    }
    if (turn <= 4) for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'ไปทางชดเชย 1.00 บาท' }).first().click();
    if (turn >= 7) for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'ไปทางเก็บเข้า 1.00 บาท' }).first().click();
    await page.locator('main .btn--primary.btn--block').last().click(); // ลงมติ
    await page.locator('.sheet .btn--primary').last().click(); // ยืนยัน
    const alert = page.locator('[role=alert]');
    if (await alert.count()) fail(`${tag}: ${await alert.first().innerText()}`);
    await audit(page, `${tag} ผล`);
    if (turn === 4 || turn === 10) await page.screenshot({ path: `${out}/result-${turn}-${vp.width}.png`, fullPage: true });
    for (const tab of ['เงิน', 'ปฏิทิน']) {
      await page.getByRole('tab', { name: tab }).click();
      await audit(page, `${tag} แท็บ${tab}`);
    }
    await page.getByRole('tab', { name: 'โต๊ะ' }).click();
    await primary().click(); // ไปตาถัดไป หรือดูบัตรรายงาน
  }
  await audit(page, `${vp.width} บัตรรายงาน`);
  await page.screenshot({ path: `${out}/end-${vp.width}.png`, fullPage: true });
  if (!(await seen(page.getByText(/บัตรรายงาน|ทางของคุณ/)))) fail(`${vp.width}: ไม่ถึงบัตรรายงาน`);
  // ส่งออกเซฟ แล้วนำเข้าในหน้าใหม่ที่ล้างเครื่องแล้ว
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ส่งออกไฟล์เซฟ' }).first().click()]);
  const file = `${out}/save-${vp.width}.json`;
  await dl.saveAs(file);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  if (saved.inputs.length !== 10 || saved.seed !== 424242) fail(`${vp.width}: ไฟล์เซฟไม่ครบ`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.setInputFiles('input[type=file]', file);
  if (!(await seen(page.getByText(/บัตรรายงาน|ทางของคุณ/)))) fail(`${vp.width}: นำเข้าเซฟแล้วไม่กลับมาที่บัตรรายงาน`);
  // ไฟล์เสีย: ต้องปฏิเสธพร้อมข้อความ
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.setInputFiles('input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...saved, seed: -1 })) });
  if (!(await seen(page.getByRole('alert')))) fail(`${vp.width}: ไฟล์เซฟเสียไม่ถูกปฏิเสธ`);
  console.log(`${vp.width}: เล่นครบ 10 ตา`);
  await ctx.close();
}
await browser.close();
await new Promise((res) => server.httpServer.close(res));
console.log(fails.length ? `FAILED ${fails.length}` : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
