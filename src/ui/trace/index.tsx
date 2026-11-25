// แผ่นที่มาของตัวเลข ("ตามเงิน"): ตัวเลข สถานะ สูตร ส่วนประกอบที่ตามต่อได้ และระเบียนในไฟล์ข้อมูลกลาง
// ตัวเลขทุกตัวในแผ่นนี้ติดเครื่องหมายด้วย data-ev เหมือนบนจอ (CLAUDE.md หัวข้อข้อมูลและตัวเลข)
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Fact } from '../../game/facts.ts';
import { loadFacts } from '../../game/facts.ts';
import type { SourceSheetProps } from '../contracts.ts';
import { D, EV_LABEL, Mark, Ref, SourceContext, type EvKind, type SourceItem } from '../evidence.tsx';
import { group, MINUS, thDate } from '../format.ts';
import { Sheet } from '../kit.tsx';
import './trace.css';

const KIND_MEANING: Record<EvKind, string> = {
  real: 'ค่าจากระเบียนในไฟล์ข้อมูลกลาง ซึ่งบอกแหล่ง วันที่ และผู้ตรวจไว้ข้างล่าง',
  computed: 'คิดจากค่าอื่นตามสูตรข้างล่าง · กดส่วนประกอบเพื่อตามต่อจนถึงข้อมูลจริง',
  game: 'กติกาหรือสมมติฐานของเกม หรือค่าที่ผู้เล่นเลือกเอง ไม่ใช่ข้อมูลจริง',
  missing: 'ยังไม่มีค่าที่ตรวจแล้ว หรือค่าจริงไม่แน่นอน เกมจึงไม่แสดงเป็นตัวเลข',
};
const FORMULA_HEAD: Record<EvKind, string> = { real: 'หมายเหตุ', computed: 'สูตร', game: 'กติกาหรือที่มา', missing: 'เหตุที่ยังไม่มีข้อมูล' };

/** ตัวเลขพร้อมเครื่องหมายแบบอ่านอย่างเดียว (ในแผ่นนี้ตัวเลขไม่ต้องเปิดแผ่นซ้ำ) */
function Value({ text, unit, kind }: { text: string; unit?: string | undefined; kind: EvKind }) {
  const t = unit ? `${text} ${unit}` : text;
  if (kind === 'missing')
    return (
      <span class="missing-chip" data-ev="missing">
        {t}
      </span>
    );
  return (
    <span class="tr-value" data-ev={kind}>
      {t} <Mark kind={kind} />
    </span>
  );
}

/** ค่าในระเบียนเป็นทศนิยมตามแหล่ง · ตัดเศษของเลขทศนิยมฐานสองออก (เช่น 18110.300000000003) แล้วคั่นหลักพัน */
function factNumber(v: number): string {
  const [i = '0', f] = String(Number(v.toPrecision(12))).replace('-', '').split('.');
  return `${v < 0 ? MINUS : ''}${group(Number(i))}${f ? `.${f}` : ''}`;
}

/** ช่วงเวลาของระเบียน ("2026-03", "2026-03-02/2026-03-08", "2020-2024") เป็น พ.ศ. · รูปแบบอื่นแสดงตามเดิม */
function periodText(p: string): string {
  const one = (s: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return thDate(s);
    if (/^\d{4}-\d{2}$/.test(s)) return thDate(`${s}-01`).replace(/^1 /, '');
    if (/^\d{4}$/.test(s)) return String(Number(s) + 543);
    const y = /^(\d{4})-(\d{4})$/.exec(s);
    return y ? `${Number(y[1]) + 543}–${Number(y[2]) + 543}` : s;
  };
  return p.split(/\/|\.\./).map(one).join('–');
}

const STATUS_TEXT: Record<Fact['status'], string> = {
  verified: 'ตรวจกับแหล่งต้นทางแล้ว',
  'secondary-only': 'ยังต้องตรวจ: มีแต่แหล่งรอง ยังไม่ได้เทียบแหล่งต้นทาง',
  conflict: 'ยังต้องตรวจ: แหล่งให้ค่าไม่ตรงกัน',
  computed: 'ค่าคำนวณจากระเบียนอื่น',
  missing: 'ยังไม่มีข้อมูล',
};
const needsCheck = (f: Fact): boolean => f.status === 'secondary-only' || f.status === 'conflict';

function FactCard({ f }: { f: Fact }) {
  const flagged = needsCheck(f);
  const value =
    f.value === null || f.status === 'missing' ? (
      <Value text="ยังไม่มีข้อมูล" kind="missing" />
    ) : flagged ? (
      <Value text={`${factNumber(f.value)} ${f.unit} · ยังต้องตรวจ`} kind="missing" />
    ) : (
      <Value text={factNumber(f.value)} unit={f.unit} kind={f.status === 'verified' ? 'real' : 'computed'} />
    );
  let host = f.source.url;
  try {
    host = new URL(f.source.url).host;
  } catch {
    /* แสดง URL เต็มแทน */
  }
  return (
    <article class={`tr-fact${flagged ? ' tr-fact--check' : ''}`}>
      <h4 class="tr-fact__label">{f.label}</h4>
      <p class="tr-fact__value">{value}</p>
      {flagged && <p class="tr-flag">{STATUS_TEXT[f.status]} · ห้ามใช้ตัดสินใจจนกว่าจะตรวจ</p>}
      <dl class="tr-dl">
        <dt>ณ วันที่</dt>
        <dd>
          <D iso={f.asOf} />
        </dd>
        {f.period && (
          <>
            <dt>ช่วง</dt>
            <dd>
              <time>{periodText(f.period)}</time>
            </dd>
          </>
        )}
        <dt>ผู้เผยแพร่</dt>
        <dd>
          <Ref>{f.source.publisher}</Ref>
        </dd>
        <dt>เอกสาร</dt>
        <dd>
          <Ref>{f.source.title}</Ref> · {f.source.kind === 'primary' ? 'แหล่งต้นทาง' : 'แหล่งรอง (ข่าวหรือผู้อ้างต่อ)'}
        </dd>
        <dt>ลิงก์</dt>
        <dd>
          <a class="tr-link" href={f.source.url} target="_blank" rel="noopener noreferrer">
            เปิดแหล่ง <Ref>{host}</Ref>
            <span class="sr-only"> (เปิดในแท็บใหม่)</span>
          </a>
        </dd>
        <dt>สถานะ</dt>
        <dd>{STATUS_TEXT[f.status]}</dd>
        <dt>ผู้ตรวจ</dt>
        <dd>
          <Ref>{f.checkedBy}</Ref>
        </dd>
        <dt>รหัสระเบียน</dt>
        <dd>
          <Ref>{f.id}</Ref>
        </dd>
      </dl>
      {f.evidence && (
        <figure class="tr-quote">
          <figcaption>ข้อความในแหล่ง</figcaption>
          <blockquote>{f.evidence}</blockquote>
        </figure>
      )}
    </article>
  );
}

function Facts({ ids }: { ids: string[] }) {
  const [facts, setFacts] = useState<Map<string, Fact> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadFacts().then(setFacts, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error) return <p role="alert">โหลดระเบียนไม่ได้: {error}</p>;
  if (!facts)
    return (
      <p class="muted" role="status">
        กำลังโหลดระเบียน…
      </p>
    );
  return (
    <div class="tr-facts">
      {ids.map((id) => {
        const f = facts.get(id);
        return f ? (
          <FactCard f={f} />
        ) : (
          <p class="tr-flag">
            ไม่พบระเบียน <Ref>{id}</Ref> ในไฟล์ข้อมูลกลาง
          </p>
        );
      })}
    </div>
  );
}

export function SourceSheet({ item, onClose }: SourceSheetProps) {
  const [stack, setStack] = useState<SourceItem[]>([item]);
  const head = useRef<HTMLHeadingElement | null>(null);
  const moved = useRef(false);
  const cur = stack[stack.length - 1] as SourceItem;
  const parent = stack[stack.length - 2];
  const { ev } = cur;
  const push = (next: SourceItem) => {
    moved.current = true;
    setStack((s) => [...s, next]);
  };

  // เปลี่ยนชั้นแล้วเลื่อนแผ่นขึ้นบนสุดและย้ายโฟกัสไปหัวเรื่อง ให้โปรแกรมอ่านจออ่านตัวเลขใหม่ · ตอนเปิดแผ่น Sheet จัดโฟกัสเอง
  useEffect(() => {
    if (!moved.current) return;
    head.current?.closest('.sheet')?.scrollTo({ top: 0 });
    head.current?.focus({ preventScroll: true });
  }, [stack]);

  return (
    <Sheet title="ที่มาของตัวเลข" onClose={onClose}>
      {/* ตัวเลขที่อยู่ในแผ่น (ถ้ามี) เปิดเป็นชั้นถัดไปของแผ่นนี้ ไม่ปิดแผ่นเดิม */}
      <SourceContext.Provider value={push}>
        <div class="tr">
          {parent && (
            <button
              type="button"
              class="btn btn--quiet tr-back"
              onClick={() => {
                moved.current = true;
                setStack((s) => s.slice(0, -1));
              }}
            >
              <span aria-hidden="true">←</span> ย้อนกลับ
              <span class="tr-back__to">{parent.ev.label}</span>
            </button>
          )}
          <div class="tr-hero">
            <Value text={cur.text} unit={cur.unit} kind={ev.kind} />
          </div>
          <p class="tr-kind">
            {ev.kind === 'missing' ? (
              <span class="missing-chip">{EV_LABEL.missing}</span>
            ) : (
              <b class="nowrap">
                <Mark kind={ev.kind} size={10} /> {EV_LABEL[ev.kind]}
              </b>
            )}{' '}
            {KIND_MEANING[ev.kind]}
          </p>
          <h3 class="tr-label" tabIndex={-1} ref={head}>
            {ev.label}
          </h3>
          {ev.formula && (
            <section class="tr-sec">
              <h4>{FORMULA_HEAD[ev.kind]}</h4>
              <p>{ev.formula}</p>
            </section>
          )}
          {ev.inputs && ev.inputs.length > 0 && (
            <section class="tr-sec">
              <h4>ส่วนประกอบ · กดเพื่อตามต่อ</h4>
              <ul class="tr-inputs">
                {ev.inputs.map((x) => (
                  <li>
                    <button type="button" class="tr-input" onClick={() => push(x)}>
                      <span class="tr-input__label">{x.ev.label}</span>
                      <Value text={x.text} unit={x.unit} kind={x.ev.kind} />
                      <span class="tr-input__go" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {ev.ids && ev.ids.length > 0 && (
            <section class="tr-sec">
              <h4>ระเบียนในไฟล์ข้อมูลกลาง</h4>
              <Facts ids={ev.ids} />
            </section>
          )}
        </div>
      </SourceContext.Provider>
    </Sheet>
  );
}
