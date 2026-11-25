// ชิ้นส่วนที่ทุกจอใช้ร่วมกัน · จอแต่ละจออยู่ในโฟลเดอร์ของตัวเองและใช้ชิ้นส่วนจากที่นี่
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { game, Num, Ord } from './evidence.tsx';
import { int } from './format.ts';

/** โครงจอ: main อย่างเดียว หรือ main + aside (ข้างกันเมื่อกว้าง ≥ 1024px ซ้อนกันบนมือถือ) */
export function Screen({ main, aside, label }: { main: ComponentChildren; aside?: ComponentChildren; label: string }) {
  return (
    <section class={`screen${aside ? ' screen--split' : ''}`} aria-label={label}>
      <div class="screen__main">{main}</div>
      {aside && <aside class="screen__aside">{aside}</aside>}
    </section>
  );
}

/** แถว pip 5 เม็ด · lose = จำนวนเม็ดที่จะเสีย (ลายทแยง) */
export function Pips({ value, max, lose = 0, label }: { value: number; max: number; lose?: number; label: string }) {
  return (
    <span class="pips" role="img" aria-label={`${label} มี ${value} จาก ${max}${lose ? ` จะเสีย ${lose}` : ''}`}>
      {Array.from({ length: max }, (_, i) => (
        <span class={`pip${i < value - lose ? ' pip--on' : i < value ? ' pip--lose' : ''}`} />
      ))}
    </span>
  );
}

export type CapitalKey = 'money' | 'authority' | 'time' | 'trust';
export const CAPITAL_LABEL: Record<CapitalKey, string> = { money: 'เงิน', authority: 'อำนาจ', time: 'เวลา', trust: 'ความเชื่อใจ' };
export const CAPITAL_RULE: Record<CapitalKey, string> = {
  money: 'มาตรแสดงฐานะรวมของกองทุนในเกม: เต็ม 5 ช่องเมื่อฐานะไม่ติดลบ ติดลบทุก 20,000 ล้านบาท ลด 1 ช่อง (ค่าของเกม)',
  authority: 'ฐานะรวมของกองทุนลดในสัปดาห์ทุก 8,000 ล้านบาท เสีย 1 ช่อง · ไม่เสียติดกัน 2 สัปดาห์ ฟื้น 1 ช่อง (ค่าของเกม)',
  time: '5 ช่องต่อสัปดาห์ · ประชุมพิเศษใช้ 2 ช่อง · เอกสารบังคับใช้ 2 ช่อง (ค่าของเกม)',
  trust: 'ราคาดีเซล B7 ในเกมวันใดเกิน 30 บาท ทุก 5 บาทเสีย 1 ช่อง (ปัดขึ้น) · แก๊สโซฮอล์ 95 สูงกว่าเส้นฐานเกิน 2 บาท ทุก 5 บาทเสีย 1 ช่อง · ไม่เสียติดกัน 2 สัปดาห์ ฟื้น 1 ช่อง (ค่าของเกม)',
};

/** ทุนหนึ่งแถว: ชื่อ · pip · ตัวเลข (ค่าของเกม กดดูกติกาได้) */
export function CapitalRow({ k, value, max, lose = 0 }: { k: CapitalKey; value: number; max: number; lose?: number }) {
  return (
    <div class="capital-row" style={{ display: 'grid', gridTemplateColumns: '88px auto 1fr', alignItems: 'center', gap: '8px', minHeight: '28px' }}>
      <span style={{ font: '600 14px/1.2 var(--f-display)' }}>{CAPITAL_LABEL[k]}</span>
      <Pips value={value} max={max} lose={lose} label={CAPITAL_LABEL[k]} />
      <span style={{ justifySelf: 'end' }}>
        <Num v={lose ? `${int(value)} → ${int(Math.max(0, value - lose))}` : int(value)} ev={game(`${CAPITAL_LABEL[k]} (ทุน)`, CAPITAL_RULE[k])} strong />
      </span>
    </div>
  );
}

export const STEP_NAMES = ['อ่านแฟ้ม', 'ทายผล', 'ตั้งอัตรา', 'เห็นผล', 'ตามเงิน'] as const;

/** ลำดับขั้นในหนึ่งตา (DESIGN.md "Step Indicator") · current = index ของขั้นปัจจุบัน */
export function StepBar({ current }: { current: number }) {
  return (
    <ol class="steps" aria-label="ลำดับในหนึ่งตา">
      {STEP_NAMES.map((name, i) => (
        <li class={i < current ? 'done' : ''} aria-current={i === current ? 'step' : undefined}>
          <span class="dot" aria-hidden="true">
            {i < current ? '✓' : <Ord>{i + 1}</Ord>}
          </span>
          {name}
        </li>
      ))}
    </ol>
  );
}

export type Sender = 'office' | 'committee' | 'cabinet' | 'ministry' | 'association' | 'news';
/** สีแถบหัวตามผู้ส่ง (DESIGN.md "Document Cards") */
export const SENDER_COLOR: Record<Sender, string> = {
  office: 'var(--subsidy-deep)',
  committee: 'var(--levy)',
  cabinet: 'var(--band-tile)',
  ministry: 'var(--prior-deep)',
  association: 'var(--prior)',
  news: 'var(--series-neutral)',
};

/** กระดาษเอกสารในเกม · ติดตรา "เอกสารจำลอง" ทุกฉบับ (CLAUDE.md หัวข้อความเป็นกลาง) */
export function Paper({ sender, from, meta, children, foot }: { sender: Sender; from: string; meta: ComponentChildren; children: ComponentChildren; foot?: ComponentChildren }) {
  return (
    <article class="paper">
      <header class="paper__head" style={{ background: SENDER_COLOR[sender] }}>
        <b>{from}</b>
        <span>{meta}</span>
      </header>
      <span class="stamp">เอกสารจำลอง</span>
      <div class="paper__body">{children}</div>
      {foot && <footer class="paper__foot">{foot}</footer>}
    </article>
  );
}

/** แผ่นซ้อนแบบ dialog: Esc ปิด · โฟกัสเข้าแผ่นเมื่อเปิด และคืนโฟกัสเมื่อปิด */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, []);
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '18px' }}>{title}</h2>
          <button type="button" class="btn btn--quiet" onClick={onClose}>
            ปิด
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
