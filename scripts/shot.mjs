// ถ่ายภาพจอและหาข้อความล้นหรือถูกตัด ที่ 390×844 และ 1440×900 ด้วยฟอนต์จริง (CLAUDE.md หัวข้อหน้าจอและเซฟ)
// ใช้: npm run build && node scripts/shot.mjs <โฟลเดอร์ผล> [4-guess 4-result@money start ...]
// ชื่อเป้า: <ตา>-<ขั้น>[@แท็บ] ตาม src/game/fixtures.ts หรือ start (หน้าเริ่ม) · ไม่ระบุ = ทุกจุดใน FIXTURE_KEYS กับแท็บโต๊ะ
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out = 'shots', ...targets] = process.argv.slice(2);
const DEFAULT = ['start', '1-files', '1-guess', '1-rates', '1-result', '4-files', '4-guess', '4-rates', '4-result', '5-guess', '10-end', '4-guess@money', '4-guess@calendar'];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 0, open: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
let problems = 0;
for (const t of targets.length ? targets : DEFAULT) {
  const [key, tab = 'desk'] = t.split('@');
  const url = key === 'start' ? base : `${base}?fixture=${key}&tab=${tab}`;
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const issues = [];
      const W = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > W + 1) issues.push(`page scrolls sideways ${document.documentElement.scrollWidth}>${W}`);
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('[data-scroll-x], .sr-only')) continue; // ส่วนที่ตั้งใจให้เลื่อนแนวนอน และข้อความสำหรับโปรแกรมอ่านจอ
        const rc = el.getBoundingClientRect();
        if (rc.width && rc.right > W + 0.5) issues.push(`outside viewport: <${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 40)}" right=${Math.round(rc.right)}`);
        const cs = getComputedStyle(el);
        if ((cs.overflowX !== 'visible' || cs.overflowY !== 'visible') && el.tagName !== 'HTML' && el.tagName !== 'BODY' && !el.classList.contains('sheet') && (el.scrollWidth > el.clientWidth + 1 || (cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 1)))
          issues.push(`clipped: <${el.tagName.toLowerCase()} class="${el.className}"> "${(el.textContent || '').trim().slice(0, 40)}"`);
        if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth && (el.textContent || '').trim()) issues.push(`ellipsis: "${(el.textContent || '').trim().slice(0, 40)}"`);
      }
      const fonts = [...new Set([...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family))];
      return { issues: [...new Set(issues)].slice(0, 12), fonts };
    });
    const file = `${out}/${key}@${tab}-${vp.width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const all = [...errors, ...r.issues];
    problems += all.length;
    console.log(`${all.length ? 'PROBLEM' : 'ok     '} ${file} fonts=${r.fonts.join('/')}${all.length ? '\n  ' + all.join('\n  ') : ''}`);
    await page.close();
  }
}
await browser.close();
await new Promise((res) => server.httpServer.close(res));
process.exit(problems ? 1 : 0);
