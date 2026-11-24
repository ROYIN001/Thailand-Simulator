import { describe, expect, it } from 'vitest';
import { FactRecord } from '../src/data/schema.ts';

const ok = {
  id: 'rate.diesel_b7.compensation.2026-03-25',
  label: 'อัตรากองทุนฯ ดีเซล B7',
  value: -26.99,
  unit: 'บาท/ลิตร',
  asOf: '2026-03-25',
  source: { url: 'https://www.offo.or.th/x.pdf', publisher: 'สกนช.', title: 'ประกาศ', kind: 'primary' },
  evidence: 'น้ำมันดีเซลหมุนเร็วธรรมดา',
  status: 'verified',
  checkedBy: 'test',
  notes: '',
};

describe('FactRecord', () => {
  it('รับระเบียนที่ถูกต้อง', () => expect(FactRecord.safeParse(ok).success).toBe(true));
  it.each([
    ['verified จากแหล่ง secondary', { source: { ...ok.source, kind: 'secondary' } }],
    ['missing ที่มีค่า', { status: 'missing' }],
    ['อัตราชดเชยเป็นบวก', { value: 26.99 }],
    ['อัตราส่งเข้าเป็นลบ', { id: 'rate.diesel_b7.levy.2026-05-07', value: -0.54 }],
    ['evidence ยาวเกิน 300', { evidence: 'ก'.repeat(301) }],
    ['ค่าตัวเลขไม่มีหน่วย', { unit: '' }],
    ['ฟิลด์เกิน', { extra: 1 }],
    ['id ตัวใหญ่', { id: 'Rate.X' }],
    ['วันที่ผิดรูป', { asOf: '25/03/2026' }],
  ])('ปฏิเสธ: %s', (_name, patch) => {
    expect(FactRecord.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
});
