import { describe, expect, it } from 'vitest';
import { baht, mbaht, pct, thDate, thRange, int } from '../../src/ui/format.ts';

describe('format', () => {
  it('บาท', () => {
    expect(baht(5580)).toBe('55.80');
    expect(baht(-74)).toBe('−0.74');
    expect(baht(61, true)).toBe('+0.61');
    expect(baht(0, true)).toBe('0.00');
    expect(baht(123456789)).toBe('1,234,567.89');
  });
  it('ล้านบาท ตัดเศษเข้าหาศูนย์', () => {
    expect(mbaht(-2556100000000)).toBe('−25,561');
    expect(mbaht(6100000000, true)).toBe('+61');
    expect(mbaht(-99_999_999)).toBe('0');
    expect(mbaht(245900000000)).toBe('2,459');
  });
  it('ร้อยละและจำนวนเต็ม', () => {
    expect(pct(73)).toBe('+0.73%');
    expect(pct(-29)).toBe('−0.29%');
    expect(int(80249229)).toBe('80,249,229');
  });
  it('วันที่ พ.ศ.', () => {
    expect(thDate('2026-03-23')).toBe('23 มี.ค. 2569');
    expect(thDate('2026-03-23', false)).toBe('23 มี.ค.');
    expect(thRange('2026-03-23', '2026-03-29')).toBe('23–29 มี.ค. 2569');
    expect(thRange('2026-03-30', '2026-04-05')).toBe('30 มี.ค.–5 เม.ย. 2569');
  });
});
