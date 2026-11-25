// schema ของเอกสารในแฟ้ม (content/oil-fund-2569/docs.json) · ตรวจใน CI ด้วย test/content.test.ts
// กติกา: ข้อความธรรมดาห้ามมีตัวเลข · ตัวเลขทุกตัวเป็นส่วน n ที่มีป้ายที่มา · วันที่เป็นส่วน date · ชื่อเฉพาะที่มีตัวเลขเป็นส่วน ref
import { z } from 'zod';
import { hasLooseDigit } from './names.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const factId = z.string().regex(/^[a-z0-9_]+(?:[.-][a-z0-9_]+)+$/);

export const SENDERS = ['office', 'committee', 'cabinet', 'ministry', 'association', 'news'] as const;
/** ช่องที่จอเติมค่าของเกมตอนแสดง · shockPct = ช็อกของสัปดาห์ (ค่าของเกม) · fundNet = ฐานะรวมของกองทุนในเกม ณ ต้นสัปดาห์ (ค่าคำนวณ) */
export const SLOTS = ['shockPct', 'fundNet'] as const;

export const TextSeg = z.string().min(1).refine((s) => !hasLooseDigit(s), 'ข้อความธรรมดาห้ามมีตัวเลข: ใช้ส่วน n (ตัวเลขที่มีที่มา) ref (ชื่อเฉพาะ เช่น ฉบับที่ 33/2569) หรือ date');
export const NumSeg = z
  .strictObject({
    n: z.string().regex(/^[+−]?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?$/, 'ตัวเลขใช้จุลภาคคั่นหลักพัน และ U+2212 สำหรับค่าลบ'),
    unit: z.string().min(1).optional(),
    ev: z.enum(['real', 'computed', 'game']),
    ids: z.array(factId).default([]),
    label: z.string().min(1).optional(), // ตัวเลขนี้คืออะไร (ถ้าไม่ใส่ จอใช้ "ตัวเลขในเอกสาร <หัวเรื่อง>")
    note: z.string().min(1).optional(), // สูตรของค่าคำนวณ หรือเหตุผลของค่าของเกม
  })
  .superRefine((s, ctx) => {
    if (s.ev === 'real' && s.ids.length !== 1) ctx.addIssue({ code: 'custom', message: 'ข้อมูลจริงต้องอ้างระเบียนเดียว' });
    if (s.ev === 'computed' && (s.ids.length === 0 || !s.note)) ctx.addIssue({ code: 'custom', message: 'ค่าคำนวณต้องมี ids ของตัวตั้งและ note บอกสูตร' });
    if (s.ev === 'game' && !s.note) ctx.addIssue({ code: 'custom', message: 'ค่าของเกมต้องมี note บอกเหตุผล' });
  });
export const RefSeg = z.strictObject({ ref: z.string().min(1) });
export const DateSeg = z.strictObject({ date: isoDate });
export const SlotSeg = z.strictObject({ slot: z.enum(SLOTS) });
export const Seg = z.union([TextSeg, NumSeg, RefSeg, DateSeg, SlotSeg]);
export const Paragraph = z.array(Seg).min(1);

const docCore = {
  sender: z.enum(SENDERS), // สีแถบหัว
  from: z.string().min(1), // ผู้ส่ง: หน่วยงานรัฐใช้ชื่อจริง · สื่อและสมาคมเป็นชื่อสมมติ
  fictional: z.boolean(), // ผู้ส่งเป็นชื่อสมมติ
  kindLabel: z.string().min(1), // ชนิดเอกสาร เช่น "บันทึกข้อความ" "หนังสือ" "ข่าว"
  title: z.string().min(1).refine((s) => !hasLooseDigit(s), 'หัวเรื่องห้ามมีตัวเลข'),
  body: z.array(Paragraph).min(1).max(6),
};

/** เอกสารของตา: อิงข้อเท็จจริงที่ตรวจแล้วซึ่งรู้ได้ก่อนการประชุมวันจันทร์ของตานั้น */
export const WeeklyDoc = z.strictObject({
  id: z.string().regex(/^doc\.[a-z0-9_.-]+$/),
  turn: z.int().min(1).max(10),
  date: isoDate, // วันที่บนเอกสาร ไม่เกินวันจันทร์ของตา
  basis: z.array(factId).min(1), // ระเบียนที่เอกสารอิง ทุกตัวต้อง verified และ asOf ไม่เกินวันอาทิตย์ก่อนตา
  ...docCore,
});

/** แม่แบบที่จอเติมค่าตอนเล่น (บันทึกช็อก เอกสารบังคับ) · basis ว่างได้ เพราะเนื้อหาเป็นของเกม */
export const TemplateDoc = z.strictObject({ id: z.string().regex(/^doc\.[a-z0-9_.-]+$/), basis: z.array(factId).default([]), ...docCore });

export const ContentFile = z.strictObject({
  scenarioId: z.literal('oil-fund-2569'),
  shockMemo: TemplateDoc,
  forced: z.strictObject({ authority: TemplateDoc, trust: TemplateDoc, money: TemplateDoc }),
  weekly: z.array(WeeklyDoc),
});

export type ContentFile = z.infer<typeof ContentFile>;
export type WeeklyDoc = z.infer<typeof WeeklyDoc>;
export type TemplateDoc = z.infer<typeof TemplateDoc>;
export type Seg = z.infer<typeof Seg>;
