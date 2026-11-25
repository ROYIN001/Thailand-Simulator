// ตรวจ HTML ที่เรนเดอร์แล้วว่าตัวเลขทุกตัวในข้อความอยู่ใต้ป้ายที่มา (v2 หัวข้อ 9 เกณฑ์ 5 · CLAUDE.md หัวข้อข้อมูลและตัวเลข)
// ยกเว้นได้เฉพาะ: [data-ev] (ตัวเลขที่มีป้าย) · <time> (วันที่) · [data-ord] (ลำดับในเกม) · [data-ref] (ชื่อเฉพาะ) · [data-axis] (ขีดแกนกราฟ) · ชื่อชนิดน้ำมัน
import { hasLooseDigit } from '../../src/data/names.ts';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const EXEMPT_ATTR = /\sdata-(?:ev|ord|ref|axis)(?:=|\s|>|\/)/;

const decode = (s: string): string =>
  s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');

/** คืนข้อความที่มีตัวเลขหลุดป้าย พร้อมบริบทของแท็กรอบๆ */
export function unlabeledDigits(html: string): string[] {
  const bad: string[] = [];
  const stack: { tag: string; exempt: boolean }[] = [];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[3] !== undefined) {
      const text = decode(m[3]);
      const exempt = stack.some((f) => f.exempt);
      const inHidden = stack.some((f) => f.tag === 'style' || f.tag === 'script' || f.tag === 'title');
      if (!exempt && !inHidden && hasLooseDigit(text)) bad.push(`${stack.map((f) => f.tag).slice(-4).join('>')}: "${text.trim().slice(0, 80)}"`);
      continue;
    }
    const tag = (m[1] as string).toLowerCase();
    const attrs = m[2] ?? '';
    if (m[0].startsWith('</')) {
      const i = stack.map((f) => f.tag).lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      continue;
    }
    if (VOID.has(tag) || attrs.trimEnd().endsWith('/')) continue;
    stack.push({ tag, exempt: tag === 'time' || EXEMPT_ATTR.test(attrs + '>') });
  }
  return bad;
}
