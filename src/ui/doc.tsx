// แสดงเอกสารในแฟ้มจาก content/oil-fund-2569/docs.json · ตัวเลขทุกตัวในเอกสารกดดูที่มาได้
import type { Seg, TemplateDoc, WeeklyDoc } from '../data/content-schema.ts';
import { D, Num, Ref, type SourceItem } from './evidence.tsx';
import { Paper } from './kit.tsx';

export type Slots = Partial<Record<'shockPct' | 'fundNet', SourceItem>>;

function SegView({ s, doc, slots }: { s: Seg; doc: WeeklyDoc | TemplateDoc; slots: Slots }) {
  if (typeof s === 'string') return <>{s}</>;
  if ('n' in s)
    return (
      <Num
        v={s.n}
        {...(s.unit ? { unit: s.unit } : {})}
        size={8}
        strong
        ev={{ kind: s.ev, label: s.label ?? `ตัวเลขในเอกสาร "${doc.title}"`, ids: s.ids, ...(s.note ? { formula: s.note } : {}) }}
      />
    );
  if ('ref' in s) return <Ref>{s.ref}</Ref>;
  if ('date' in s) return <D iso={s.date} />;
  const v = slots[s.slot];
  if (!v) throw new Error(`เอกสาร ${doc.id} ต้องการค่า ${s.slot}`);
  return <Num v={v.text} {...(v.unit ? { unit: v.unit } : {})} ev={v.ev} size={8} strong />;
}

/** เอกสารหนึ่งฉบับ · date = วันที่บนเอกสาร (แม่แบบใช้วันจันทร์ของตา) */
export function DocView({ doc, date, slots = {} }: { doc: WeeklyDoc | TemplateDoc; date: string; slots?: Slots }) {
  return (
    <Paper
      sender={doc.sender}
      from={doc.from}
      meta={
        <>
          {doc.kindLabel} · <D iso={date} />
        </>
      }
    >
      <h3 class="paper__title">{doc.title}</h3>
      {doc.body.map((p) => (
        <p>
          {p.map((s) => (
            <SegView s={s} doc={doc} slots={slots} />
          ))}
        </p>
      ))}
    </Paper>
  );
}
