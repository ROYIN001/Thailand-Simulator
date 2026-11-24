// schema ของระเบียนในไฟล์ข้อมูลกลาง ตรงกับตารางใน data/README.md
import { z } from 'zod';

export const STATUSES = ['verified', 'secondary-only', 'conflict', 'computed', 'missing'] as const;

export const FactRecord = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+(?:[.-][a-z0-9_]+)+$/),
    label: z.string().min(1),
    value: z.number().finite().nullable(),
    unit: z.string(),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period: z.string().min(1).optional(),
    source: z.object({
      url: z.url(),
      publisher: z.string().min(1),
      title: z.string().min(1),
      kind: z.enum(['primary', 'secondary']),
    }),
    evidence: z.string().max(300),
    status: z.enum(STATUSES),
    checkedBy: z.string().min(1),
    notes: z.string(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.status === 'verified' && r.source.kind !== 'primary')
      ctx.addIssue({ code: 'custom', message: 'verified ต้องมาจากแหล่ง primary' });
    if (r.status === 'missing' && r.value !== null)
      ctx.addIssue({ code: 'custom', message: 'missing ต้องมี value เป็น null' });
    if (r.value !== null && r.unit === '')
      ctx.addIssue({ code: 'custom', message: 'ค่าตัวเลขต้องมีหน่วย' });
    // กติกาเครื่องหมายใน data/README.md: ส่งเข้ากองทุนเป็นบวก ชดเชยเป็นลบ
    if (r.id.startsWith('rate.') && r.value !== null) {
      if (r.id.includes('.compensation.') && r.value > 0)
        ctx.addIssue({ code: 'custom', message: 'อัตราชดเชยต้องเป็นค่าลบ' });
      if (r.id.includes('.levy.') && r.value < 0)
        ctx.addIssue({ code: 'custom', message: 'อัตราส่งเข้ากองทุนต้องไม่ติดลบ' });
    }
  });

export type FactRecord = z.infer<typeof FactRecord>;
export const FactFile = z.array(FactRecord);
