// ป้ายที่มาของตัวเลข (CLAUDE.md หัวข้อข้อมูลและตัวเลข · DESIGN.md "Evidence Marks" และ "The Mark-Rides-With-Number Rule")
// ทุกตัวเลขบนจอต้องผ่าน <Num> (หรือ data-ev บน <text> ของกราฟ) · วันที่ผ่าน <D>/<DR> · เลขลำดับและชื่อเฉพาะผ่าน <Ord>/<Ref>
// test/ui/evidence.test.tsx ตรวจว่าไม่มีตัวเลขหลุดนอกสี่แบบนี้
import { createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { Sourced } from '../engine/scenario-types.ts';
import { thDate, thRange } from './format.ts';

/** real = ข้อมูลจริง (วงกลมเต็ม) · computed = ค่าคำนวณ (ครึ่งวง) · game = ค่าของเกม (วงโปร่ง) · missing = ยังไม่มีข้อมูลหรือไม่แน่นอน (กรอบเส้นประ) */
export type EvKind = 'real' | 'computed' | 'game' | 'missing';

export const EV_LABEL: Record<EvKind, string> = {
  real: 'ข้อมูลจริง',
  computed: 'ค่าคำนวณ',
  game: 'ค่าของเกม',
  missing: 'ยังไม่มีข้อมูล',
};

export type Evidence = {
  kind: EvKind;
  label: string; // ตัวเลขนี้คืออะไร เช่น "ราคาขายปลีกดีเซล B7 กรุงเทพฯ ในเกม วันอาทิตย์ 29 มี.ค. 2569"
  ids?: string[]; // id ของระเบียนในไฟล์ข้อมูลกลาง (data/oil-fund-2569/*.json)
  formula?: string; // สูตรหรือเหตุผล (ค่าคำนวณ ค่าของเกม หรือเหตุที่ยังไม่มีข้อมูล)
  inputs?: SourceItem[]; // ส่วนประกอบของค่าคำนวณ แต่ละตัวตามต่อได้ ("ตามเงิน")
};

/** สิ่งที่ส่งให้แผ่นที่มาเมื่อผู้เล่นกดตัวเลข */
export type SourceItem = { text: string; unit?: string; ev: Evidence };

export const SourceContext = createContext<(item: SourceItem) => void>(() => {});
export const useOpenSource = () => useContext(SourceContext);

/** แปลงค่าจากไฟล์ฉาก: uncertain = ราคาจริงเปลี่ยนวันใดไม่รู้ → กรอบเส้นประ */
export function fromSourced(s: Sourced, label: string): Evidence {
  const kind: EvKind = s.kind === 'uncertain' ? 'missing' : s.kind;
  return { kind, label, ids: s.ids, ...(s.note ? { formula: s.note } : {}) };
}

export const game = (label: string, formula?: string): Evidence => ({ kind: 'game', label, ...(formula ? { formula } : {}) });
export const computed = (label: string, formula: string, inputs?: SourceItem[], ids?: string[]): Evidence => ({
  kind: 'computed',
  label,
  formula,
  ...(inputs ? { inputs } : {}),
  ...(ids ? { ids } : {}),
});

/** เครื่องหมาย SVG ตาม DESIGN.md · size 10 ในคำอธิบาย · 9 ต่อท้ายตัวเลข · 8 ในเอกสารและหัวตาราง */
export function Mark({ kind, size = 9 }: { kind: Exclude<EvKind, 'missing'>; size?: 8 | 9 | 10 }) {
  const label = EV_LABEL[kind];
  return (
    <svg class="mark" width={size} height={size} viewBox="0 0 10 10" role="img" aria-label={label}>
      {kind === 'real' && <circle cx="5" cy="5" r="4.4" fill="currentColor" />}
      {kind === 'computed' && (
        <>
          <circle cx="5" cy="5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3" />
          <path d="M5 1.2 A3.8 3.8 0 0 0 5 8.8 Z" fill="currentColor" />
        </>
      )}
      {kind === 'game' && <circle cx="5" cy="5" r="3.7" fill="none" stroke="currentColor" stroke-width="1.5" />}
    </svg>
  );
}

/** คำอธิบายเครื่องหมายทั้งสี่แบบ (ใช้บนแถบบนหรือท้ายจอ) */
export function MarkLegend() {
  return (
    <ul class="mark-legend" aria-label="ความหมายของเครื่องหมายที่มา">
      <li><Mark kind="real" size={10} /> {EV_LABEL.real}</li>
      <li><Mark kind="computed" size={10} /> {EV_LABEL.computed}</li>
      <li><Mark kind="game" size={10} /> {EV_LABEL.game}</li>
      <li><span class="missing-chip">ยังไม่มีข้อมูล</span></li>
    </ul>
  );
}

type NumProps = {
  v: string; // ข้อความตัวเลขที่จัดรูปแบบแล้ว (ใช้ format.ts)
  unit?: string;
  ev: Evidence;
  size?: 8 | 9 | 10;
  strong?: boolean;
  class?: string;
};

/** ตัวเลขหนึ่งตัว: ตัวเลข หน่วย และเครื่องหมายอยู่ใน nowrap เดียวกัน กดแล้วเปิดแผ่นที่มา */
export function Num({ v, unit, ev, size = 9, strong = false, class: cls = '' }: NumProps) {
  const open = useOpenSource();
  const text = unit ? `${v} ${unit}` : v;
  const aria = `${text} · ${EV_LABEL[ev.kind]} · ${ev.label} · กดดูที่มา`;
  return (
    <button
      type="button"
      class={`num num--${ev.kind}${strong ? ' num--strong' : ''} ${cls}`}
      data-ev={ev.kind}
      aria-label={aria}
      onClick={() => open(unit ? { text: v, unit, ev } : { text: v, ev })}
    >
      {ev.kind === 'missing' ? (
        <span class="missing-chip">{text}</span>
      ) : (
        <>
          <span class="num__v">{v}</span>
          {unit && <span class="num__u"> {unit}</span>}
          <Mark kind={ev.kind} size={size} />
        </>
      )}
    </button>
  );
}

/** ข้อความ "ยังไม่มีข้อมูล" แบบกรอบเส้นประที่กดดูเหตุผลได้ */
export const Missing = ({ label, why, text = 'ยังไม่มีข้อมูล' }: { label: string; why: string; text?: string }) => (
  <Num v={text} ev={{ kind: 'missing', label, formula: why }} />
);

/** วันที่ (ไม่ใช่ตัวเลขที่ต้องมีป้ายที่มา) */
export const D = ({ iso, year = true }: { iso: string; year?: boolean }) => (
  <time class="nowrap" dateTime={iso}>
    {thDate(iso, year)}
  </time>
);
export const DR = ({ a, b }: { a: string; b: string }) => (
  <time class="nowrap" dateTime={`${a}/${b}`}>
    {thRange(a, b)}
  </time>
);

/** เลขลำดับในเกม เช่น "ตา 4" "ขั้น 2" (ไม่ใช่ค่าที่มีแหล่ง) */
export const Ord = ({ children }: { children: ComponentChildren }) => <span data-ord="">{children}</span>;

/** ชื่อเฉพาะที่มีตัวเลข เช่น "ประกาศ กบน. ฉบับที่ 33/2569" "มาตรา 14" (ไม่ใช่ค่าที่มีแหล่ง) */
export const Ref = ({ children }: { children: ComponentChildren }) => <span data-ref="">{children}</span>;
