// บัญชีสองด้าน: ทุกรายการโอนจำนวนเดียวกันจากบัญชีหนึ่งไปอีกบัญชีหนึ่ง ยอดรวมทุกบัญชีจึงเป็นศูนย์เสมอ
import { assertSafe } from './math.ts';

export const ACCOUNTS = ['fund.oil', 'fund.lpg', 'traders', 'other', 'opening'] as const;
export type Account = (typeof ACCOUNTS)[number];
export type Balances = Record<Account, number>;

export type Entry = {
  week: number; // 0 = ยอดยกมา
  from: Account;
  to: Account;
  amount: number; // สตางค์ ไม่ติดลบ
  memo: string;
};

export const emptyBalances = (): Balances => ({ 'fund.oil': 0, 'fund.lpg': 0, traders: 0, other: 0, opening: 0 });

/** โอนเงินแบบมีเครื่องหมาย: ค่าบวกไหลจาก source ไป sink ค่าลบไหลกลับ */
export function signedEntry(week: number, source: Account, sink: Account, signedAmount: number, memo: string): Entry {
  assertSafe(signedAmount, memo);
  return signedAmount >= 0
    ? { week, from: source, to: sink, amount: signedAmount, memo }
    : { week, from: sink, to: source, amount: -signedAmount, memo };
}

export function post(balances: Balances, e: Entry): Balances {
  if (e.from === e.to) throw new Error(`รายการโอนเข้าบัญชีตัวเอง: ${e.memo}`);
  assertSafe(e.amount, e.memo);
  if (e.amount < 0) throw new Error(`จำนวนติดลบ: ${e.memo}`);
  return {
    ...balances,
    [e.from]: assertSafe(balances[e.from] - e.amount, e.from),
    [e.to]: assertSafe(balances[e.to] + e.amount, e.to),
  };
}

export const ledgerSum = (b: Balances): number => ACCOUNTS.reduce((s, a) => s + b[a], 0);
