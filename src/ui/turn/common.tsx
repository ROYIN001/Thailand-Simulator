// ชิ้นที่สามขั้นก่อนเห็นผลใช้ร่วมกัน (แฟ้ม ทาย ตั้งอัตรา) · เฉพาะในโฟลเดอร์นี้
import { useState } from 'preact/hooks';
import { weekShockBp, type Fuel } from '../../engine/game.ts';
import type { Scenario } from '../../engine/scenario-types.ts';
import type { Game } from '../../game/session.ts';
import { fromSourced, game, type Evidence, type SourceItem } from '../evidence.tsx';
import { baht, pct } from '../format.ts';

export const FUEL_NAME: Record<Fuel, string> = { b7: 'ดีเซล B7', g95: 'แก๊สโซฮอล์ 95' };

/** วันที่ทั้ง 7 วันของตาที่กำลังเล่น (0 = จันทร์) */
export const weekDays = (g: Game): string[] => g.sc.days.slice((g.state.turn - 1) * 7, g.state.turn * 7);

export const fundNow = (g: Game): number => g.state.balances['fund.oil'] + g.state.balances['fund.lpg'];

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** ช็อกของสัปดาห์นี้ (แฟ้มบอกก่อนทาย · คำตัดสินของ Royin 25 พ.ย. 2569) */
export function shockItem(g: Game, signed = true): SourceItem {
  const bp = weekShockBp(g.state) ?? 0;
  return {
    text: signed ? pct(bp) : pct(Math.abs(bp), false),
    ev: game('ช็อกราคาของสัปดาห์นี้', `ราคาขายปลีกในเกมทุกวันของสัปดาห์ = ราคาจริง × (1 + ช็อก) · เกมสุ่มด้วย seed สม่ำเสมอในช่วง ±${pct(g.state.params.shockMaxBp, false)} แทนเหตุที่คาดไม่ได้`),
  };
}
export const shockWord = (g: Game): string => {
  const bp = weekShockBp(g.state) ?? 0;
  return bp > 0 ? 'สูงกว่าราคาจริง' : bp < 0 ? 'ต่ำกว่าราคาจริง' : 'เท่ากับราคาจริง';
};

/** ตัวคูณ 1.07 = 1 + ภาษีมูลค่าเพิ่มที่คิดบนเงินกองทุน */
export const vatItem = (sc: Scenario): SourceItem => ({
  text: baht(Math.trunc((10000 + sc.vatBp.v) / 100)),
  ev: { kind: 'computed', label: 'ตัวคูณภาษีมูลค่าเพิ่มบนเงินกองทุน (1 + อัตราภาษี)', formula: sc.vatBp.note ?? '', ids: sc.vatBp.ids },
});

export const startRateEv = (sc: Scenario, fuel: Fuel): Evidence => fromSourced(sc.startRates[fuel], `อัตราเงินกองทุน${FUEL_NAME[fuel]} ณ ต้นฉาก (ประกาศ กบน. ที่มีผลก่อนวันแรกของฉาก · ลบ = ชดเชย บวก = เก็บเข้า)`);

/** อัตราเป็นคำ: เครื่องหมายบอกทิศ (+ เก็บเข้า · − ชดเชย) · ตัวเลขบนจอใช้ค่าสัมบูรณ์คู่กับคำ */
export const rateWord = (r: number): string => (r < 0 ? 'ชดเชย' : r > 0 ? 'เก็บเข้ากองทุน' : 'ไม่ชดเชยและไม่เก็บ');
export const rateItem = (r: number, ev: Evidence): SourceItem => ({ text: baht(Math.abs(r)), unit: 'บาท/ลิตร', ev });

/** "55.80" หรือ "55.8" → สตางค์ · รับเฉพาะเลขบาทไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง */
export function parseBaht(text: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{0,2}))?$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** ช่องพิมพ์จำนวนบาท · ยืนยันเมื่อกด Enter หรือออกจากช่อง · ลูกศรขึ้นลงเพิ่มลดทีละ 0.10 · ระหว่างพิมพ์เก็บข้อความไว้ ไม่ทับด้วยค่าจริง */
export function BahtInput({ id, satang, label, onCommit, onStep }: { id: string; satang: number; label: string; onCommit: (v: number) => void; onStep: (delta: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const commit = () => {
    if (draft === null) return;
    const v = parseBaht(draft);
    setBad(v === null);
    if (v === null) return;
    onCommit(v);
    setDraft(null);
  };
  return (
    <span class="turn-input">
      <input
        id={id}
        inputMode="decimal"
        autocomplete="off"
        aria-label={label}
        aria-invalid={bad}
        aria-describedby={bad ? `${id}-err` : undefined}
        value={draft ?? baht(satang)}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            setDraft(null);
            setBad(false);
            onStep(e.key === 'ArrowUp' ? 10 : -10);
          }
        }}
      />
      {bad && (
        <span id={`${id}-err`} class="turn-input__err" role="alert">
          พิมพ์เป็นบาท ทศนิยมไม่เกินสองตำแหน่ง
        </span>
      )}
    </span>
  );
}
