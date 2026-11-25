// ขั้นที่ 2 ทายผล (แบบ ค ที่ Royin เลือก): ลากจุดบนกราฟวันอาทิตย์ · ปุ่ม ±0.10 · ช่องพิมพ์
// ห้ามแสดงค่าของตานี้ก่อนเห็นผล: ใช้แค่ g.played / g.baselinePlayed · guessTarget ใช้ดูว่าเป็น null (ตาไม่นับแต้ม) เท่านั้น
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { guessTarget, type TurnRecord } from '../../engine/game.ts';
import type { Scenario } from '../../engine/scenario-types.ts';
import type { Game } from '../../game/session.ts';
import type { GuessStepProps } from '../contracts.ts';
import { computed, D, fromSourced, game, Mark, Num, Ord, type Evidence, type SourceItem } from '../evidence.tsx';
import { baht, DASH, int, pct, thDate } from '../format.ts';
import { Screen } from '../kit.tsx';
import { BahtInput, clamp, shockItem, shockWord, startRateEv, vatItem, weekDays } from './common.tsx';

const MAX_GUESS = 15000; // 150 บาท/ลิตร · กันพิมพ์ผิดหลัก ราคาจริงในฉากไม่เกิน 51 บาท
const UNCERTAIN_WHY = 'ราคาจริงวันอาทิตย์นี้ไม่แน่นอน: ไม่มีระเบียนของวันนั้น และราคาเปลี่ยนก่อนระเบียนถัดไปโดยไม่รู้วันที่เปลี่ยน · ราคาในเกมที่คิดจากราคานี้จึงไม่แน่นอนด้วย';
const FORMULA = 'ราคาจริงวันอาทิตย์ × (1 + ช็อกของสัปดาห์) + (อัตราวันนั้น − อัตราจริงวันนั้น) × 1.07';

type Point = { v: number; ev: Evidence };
type Row = { date: string; uncertain: boolean; base: Point; mine: Point; real: Point };

const sunday = (sc: Scenario, i: number) => sc.b7[i * 7 + 6] as Scenario['b7'][number];

/** วันอาทิตย์ของตาที่เล่นแล้ว · ค่าที่คิดจากราคาจริงที่ไม่แน่นอนเป็นกรอบเส้นประ */
function pastSundays(g: Game): Row[] {
  return g.played.map((rec, i) => {
    const day = sunday(g.sc, i);
    const date = g.sc.days[i * 7 + 6] as string;
    const uncertain = day.retail.kind === 'uncertain';
    const real: SourceItem = { text: baht(day.retail.v), unit: 'บาท/ลิตร', ev: fromSourced(day.retail, `ราคาขายปลีกดีเซล B7 กรุงเทพฯ จริง วันอาทิตย์ ${thDate(date)}`) };
    const inputs = (rate: SourceItem): SourceItem[] => [
      real,
      { text: pct(rec.shockBp), ev: game(`ช็อกราคาของตา ${rec.turn}`, 'เกมสุ่มด้วย seed แทนเหตุที่คาดไม่ได้') },
      rate,
      { text: baht(day.rate.v), unit: 'บาท/ลิตร', ev: fromSourced(day.rate, `อัตราเงินกองทุนดีเซล B7 จริง วันอาทิตย์ ${thDate(date)} (ลบ = ชดเชย)`) },
      vatItem(g.sc),
    ];
    const price = (v: number, label: string, rate: SourceItem): Point => ({
      v,
      ev: uncertain ? { kind: 'missing', label, formula: UNCERTAIN_WHY } : computed(label, FORMULA, inputs(rate)),
    });
    return {
      date,
      uncertain,
      base: price((g.baselinePlayed[i] as TurnRecord).retailB7Sunday, `ราคาดีเซล B7 ในเกม วันอาทิตย์ ${thDate(date)} เส้นฐาน (อัตรา ณ ต้นฉาก)`, {
        text: baht(g.sc.startRates.b7.v),
        unit: 'บาท/ลิตร',
        ev: startRateEv(g.sc, 'b7'),
      }),
      mine: price(rec.retailB7Sunday, `ราคาดีเซล B7 ในเกม วันอาทิตย์ ${thDate(date)} ของคุณ`, {
        text: baht(rec.rateB7Sunday),
        unit: 'บาท/ลิตร',
        ev: game(`อัตราดีเซล B7 ของคุณ วันอาทิตย์ ${thDate(date)} (ลบ = ชดเชย)`, 'อัตราที่คุณตั้งในการประชุมครั้งล่าสุดของสัปดาห์นั้น'),
      }),
      real: { v: day.retail.v, ev: real.ev },
    };
  });
}

/** คำทายเริ่มต้น: ราคาเส้นฐานวันอาทิตย์ล่าสุดที่แน่นอน · ตาแรกใช้ราคาจริงวันแรกของฉาก */
function defaultGuess(g: Game, rows: Row[]): number {
  for (let i = rows.length - 1; i >= 0; i--) if (!(rows[i] as Row).uncertain) return (rows[i] as Row).base.v;
  return g.sc.b7[0]?.retail.v ?? 0;
}

const Txt = ({ p, children }: { p: Point; children: string }) => (p.ev.kind === 'missing' ? <Num v="ไม่แน่นอน" ev={p.ev} /> : <Num v={children} ev={p.ev} />);

// ---- กราฟ ----
const H = 260;
const PAD = { l: 34, r: 14, t: 30, b: 30 };

function niceDomain(values: number[]): { lo: number; hi: number; step: number } {
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const step = hi0 - lo0 > 3000 ? 1000 : 500;
  const lo = Math.max(0, Math.floor((lo0 - 200) / step) * step);
  return { lo, hi: Math.max(lo + 1000, Math.ceil((hi0 + 200) / step) * step), step };
}

function GuessChart({ rows, date, guess, band, inner, base, onDrag }: { rows: Row[]; date: string; guess: number; band: number; inner: number; base: { lo: number; hi: number; step: number }; onDrag: (v: number) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(340);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // ขยายแกนเฉพาะเมื่อคำทายที่พิมพ์อยู่นอกช่วง · ระหว่างลาก แกนคงที่ จุดจึงอยู่ใต้นิ้วเสมอ
  const lo = guess - band < base.lo ? Math.floor((guess - band) / base.step) * base.step : base.lo;
  const hi = guess + band > base.hi ? Math.ceil((guess + band) / base.step) * base.step : base.hi;
  const plotH = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * plotH;
  const n = rows.length + 1;
  const span = W - PAD.l - PAD.r - 56;
  const x = (i: number) => (n === 1 ? PAD.l + (W - PAD.l - PAD.r) / 2 : PAD.l + 24 + (i * span) / (n - 1));
  const xc = x(n - 1);
  const sparse = n > 1 && span / (n - 1) < 48;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += base.step) ticks.push(v);

  const toValue = (clientY: number, el: Element) => {
    const r = (el.closest('svg') as SVGSVGElement).getBoundingClientRect();
    const py = ((clientY - r.top) * H) / r.height;
    const v = Math.round((base.hi - ((py - PAD.t) / plotH) * (base.hi - base.lo)) / 10) * 10;
    return clamp(v, base.lo + band, base.hi - band);
  };
  const series = (key: 'base' | 'mine', cls: string, square: boolean) => (
    <g class={cls}>
      {rows.slice(1).map((r, i) => {
        const a = rows[i] as Row;
        return <line x1={x(i)} y1={y(a[key].v)} x2={x(i + 1)} y2={y(r[key].v)} class={a.uncertain || r.uncertain ? 'turn-chart__gap' : ''} />;
      })}
      {rows.map((r, i) =>
        r.uncertain ? (
          <rect class="turn-chart__unk" x={x(i) - 6} y={y(r[key].v) - 6} width="12" height="12" rx="2" />
        ) : square ? (
          <rect x={x(i) - 3.5} y={y(r[key].v) - 3.5} width="7" height="7" />
        ) : (
          <circle cx={x(i)} cy={y(r[key].v)} r="3.8" />
        ),
      )}
    </g>
  );

  return (
    <div ref={box} class="turn-chart">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`กราฟราคาดีเซล B7 ในเกมวันอาทิตย์ของตาที่เล่นแล้ว และคำทายของวันอาทิตย์ ${thDate(date)} · ลากจุดส้มขึ้นลงเพื่อทาย หรือใช้ปุ่มและช่องพิมพ์ใต้กราฟ`}>
        <rect class="turn-chart__now" x={xc - 28} y={PAD.t - 6} width="56" height={plotH + 6} rx="6" />
        {ticks.map((v) => (
          <g>
            <line class="turn-chart__grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text data-axis="" x={PAD.l - 6} y={y(v) + 4} text-anchor="end">
              {Math.trunc(v / 100)}
            </text>
          </g>
        ))}
        {[...rows.map((r) => r.date), date].map((d, i) =>
          sparse && (n - 1 - i) % 2 === 1 ? null : (
            <text data-axis="" x={x(i)} y={H - 10} text-anchor="middle" class={i === n - 1 ? 'turn-chart__xnow' : ''}>
              {thDate(d, false)}
            </text>
          ),
        )}
        <rect class="turn-chart__band1" x={xc - 22} y={y(guess + band)} width="44" height={y(guess - band) - y(guess + band)} />
        <rect class="turn-chart__band3" x={xc - 22} y={y(guess + inner)} width="44" height={y(guess - inner) - y(guess + inner)} />
        {series('base', 'turn-chart__base', false)}
        {series('mine', 'turn-chart__mine', true)}
        <g class="turn-chart__real">
          {rows.map((r, i) =>
            r.uncertain ? (
              <g>
                <rect class="turn-chart__unk" x={x(i) - 8} y={y(r.real.v) - 8} width="16" height="16" rx="3" />
                <text x={x(i)} y={y(r.real.v) + 4} text-anchor="middle">
                  ?
                </text>
              </g>
            ) : (
              <circle cx={x(i)} cy={y(r.real.v)} r="3.5" />
            ),
          )}
        </g>
        <line class="turn-chart__stem" x1={xc} x2={xc} y1={y(guess + band)} y2={y(guess - band)} />
        <circle class="turn-chart__handle" cx={xc} cy={y(guess)} r="9" />
        <text data-ev="game" class="turn-chart__glabel" x={xc} y={Math.max(14, y(guess + band) - 6)} text-anchor="middle">
          {baht(guess)}
        </text>
        <rect
          class="turn-chart__lane"
          x={xc - 30}
          y={PAD.t - 6}
          width="60"
          height={plotH + 12}
          onPointerDown={(e) => {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            onDrag(toValue(e.clientY, e.currentTarget as Element));
          }}
          onPointerMove={(e) => {
            if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) onDrag(toValue(e.clientY, e.currentTarget as Element));
          }}
        />
      </svg>
    </div>
  );
}

export function GuessStep({ g, onLock, onBack }: GuessStepProps) {
  const rows = useMemo(() => pastSundays(g), [g.played.length, g.save.seed]);
  const start = useMemo(() => defaultGuess(g, rows), [rows]);
  const [guess, setGuess] = useState(start);
  const bands = g.state.params.guessBands;
  const inner = bands[0] ?? { withinSatang: 0, points: 0 };
  const outer = bands[bands.length - 1] ?? inner;
  const base = useMemo(
    () => niceDomain([...rows.flatMap((r) => [r.base.v, r.mine.v, r.real.v]), start - outer.withinSatang, start + outer.withinSatang]),
    [rows, start, outer.withinSatang],
  );
  const days = weekDays(g);
  const sun = days[6] as string;
  const isVoid = guessTarget(g.state, g.sc) === null;
  const set = (v: number): number => {
    const c = clamp(v, 0, MAX_GUESS);
    setGuess(c);
    return c;
  };
  const shock = shockItem(g);
  const last = rows[rows.length - 1];
  const bandEv = (b: { withinSatang: number; points: number }) => game('ช่วงที่ได้แต้มการทาย', `คำทายห่างจากคำตอบไม่เกิน ${baht(b.withinSatang)} บาท ได้ ${b.points} แต้ม (ค่าของเกม)`);

  const main = (
    <>
      <div class="turn-head">
        <h2 class="turn-question">
          ถ้าใช้อัตรา ณ ต้นฉาก ราคาดีเซล B7 วันอาทิตย์ <D iso={sun} /> จะเป็นเท่าไร
        </h2>
        <span class="turn-pill">
          ช็อกสัปดาห์นี้ <Num v={shock.text} ev={shock.ev} strong />
        </span>
      </div>
      {isVoid && (
        <p class="turn-note turn-note--warn" role="note">
          ตานี้ไม่นับแต้มการทาย เพราะราคาจริงวันอาทิตย์ <D iso={sun} /> ไม่แน่นอน (ไม่มีระเบียนของวันนั้น และราคาเปลี่ยนในวันที่ไม่รู้) · ยังทายและล็อกคำทายได้ตามปกติ
        </p>
      )}
      <div class="panel">
        <GuessChart rows={rows} date={sun} guess={guess} band={outer.withinSatang} inner={inner.withinSatang} base={base} onDrag={set} />
        <ul class="turn-legend" aria-label="วิธีอ่านกราฟ">
          <li>
            <span class="turn-sw turn-sw--base" /> เส้นฐาน (อัตรา ณ ต้นฉาก) <Mark kind="computed" />
          </li>
          <li>
            <span class="turn-sw turn-sw--mine" /> ของคุณ <Mark kind="computed" />
          </li>
          <li>
            <span class="turn-sw turn-sw--real" /> ราคาจริง <Mark kind="real" />
          </li>
          <li>
            <span class="turn-sw turn-sw--unk" /> กรอบประ = ไม่แน่นอน
          </li>
          <li>
            <span class="turn-sw turn-sw--band3" /> ห่างไม่เกิน <Num v={baht(inner.withinSatang)} unit="บาท" ev={bandEv(inner)} /> ได้ <Num v={int(inner.points)} unit="แต้ม" ev={bandEv(inner)} />
          </li>
          <li>
            <span class="turn-sw turn-sw--band1" /> ไม่เกิน <Num v={baht(outer.withinSatang)} unit="บาท" ev={bandEv(outer)} /> ได้ <Num v={int(outer.points)} unit="แต้ม" ev={bandEv(outer)} />
          </li>
        </ul>
        <p class="caption">
          {last ? (
            <>
              วันอาทิตย์ล่าสุด <D iso={last.date} /> (บาท/ลิตร): เส้นฐาน <Txt p={last.base}>{baht(last.base.v)}</Txt> · ของคุณ <Txt p={last.mine}>{baht(last.mine.v)}</Txt> · ราคาจริง{' '}
              <Txt p={last.real}>{baht(last.real.v)}</Txt> ·{' '}
            </>
          ) : (
            'ยังไม่มีวันอาทิตย์ที่เล่นแล้ว · '
          )}
          ลากจุดส้มในแถบ <D iso={sun} year={false} /> ขึ้นลงเพื่อทาย คำตอบจะเปิดหลังลงมติ
        </p>
      </div>
      <div class="turn-stepper">
        <button type="button" class="btn btn--quiet" aria-label="ลดคำทาย 0.10 บาท" onClick={() => set(guess - 10)}>
          <Ord>−0.10</Ord>
        </button>
        <label class="turn-stepper__mid" for="turn-guess">
          <span class="caption">คำทายของคุณ (บาท/ลิตร)</span>
          <span class="turn-stepper__val">
            <BahtInput id="turn-guess" satang={guess} label="คำทาย ราคาดีเซล B7 วันอาทิตย์ บาทต่อลิตร" onCommit={set} onStep={(d) => set(guess + d)} />
            <Mark kind="game" />
          </span>
        </label>
        <button type="button" class="btn btn--quiet" aria-label="เพิ่มคำทาย 0.10 บาท" onClick={() => set(guess + 10)}>
          <Ord>+0.10</Ord>
        </button>
      </div>
      <p class="caption turn-center">
        ได้ <Num v={int(inner.points)} unit="แต้ม" ev={bandEv(inner)} /> ถ้าคำตอบอยู่ในช่วง{' '}
        <Num v={`${baht(Math.max(0, guess - inner.withinSatang))}${DASH}${baht(guess + inner.withinSatang)}`} ev={game('ช่วงได้แต้มสูงสุดรอบคำทายของคุณ', 'คำทาย ± ระยะที่ได้แต้มสูงสุด (ค่าของเกม)')} /> · ได้{' '}
        <Num v={int(outer.points)} unit="แต้ม" ev={bandEv(outer)} /> ถ้าอยู่ในช่วง{' '}
        <Num v={`${baht(Math.max(0, guess - outer.withinSatang))}${DASH}${baht(guess + outer.withinSatang)}`} ev={game('ช่วงได้แต้มรอบคำทายของคุณ', 'คำทาย ± ระยะที่ได้แต้ม (ค่าของเกม)')} />
      </p>
    </>
  );

  const aside = (
    <>
      <article class="paper turn-memo">
        <span class="stamp">เอกสารจำลอง</span>
        <p class="turn-memo__from">บันทึก สกนช. · ช็อกของสัปดาห์</p>
        <p>
          ในเกม ราคาขายปลีกน้ำมันทุกวันของสัปดาห์นี้{shockWord(g)} <Num v={shockItem(g, false).text} ev={shock.ev} strong size={8} /> ทั้งดีเซล B7 และแก๊สโซฮอล์ 95
        </p>
      </article>
      <details class="panel turn-details">
        <summary>ราคาที่ทายคิดจากอะไร</summary>
        <p>
          ราคาที่ทาย = ราคาจริงวันอาทิตย์ที่บวกช็อกแล้ว + (อัตรา ณ ต้นฉาก − อัตราจริงวันนั้น) × <Num v={vatItem(g.sc).text} ev={vatItem(g.sc).ev} />
        </p>
        <ul class="turn-list">
          <li>
            ช็อกสัปดาห์นี้ <Num v={shock.text} ev={shock.ev} /> ตามบันทึก สกนช.
          </li>
          <li>
            อัตรา ณ ต้นฉากของดีเซล B7: ชดเชย <Num v={baht(Math.abs(g.sc.startRates.b7.v))} unit="บาท/ลิตร" ev={startRateEv(g.sc, 'b7')} /> (ในสูตรเป็นค่าติดลบ เพราะชดเชย)
          </li>
          <li>
            <Num v={vatItem(g.sc).text} ev={vatItem(g.sc).ev} /> คือตัวคูณที่รวมภาษีมูลค่าเพิ่มซึ่งคิดบนเงินกองทุน · อัตราต่างไปเท่าไร ราคาต่างไปเท่านั้นบวกภาษี
          </li>
          <li>ราคาจริงและอัตราจริงของสัปดาห์นี้ยังไม่เปิดเผยจนกว่าจะลงมติ · ราคาเส้นฐานวันอาทิตย์ก่อนหน้าในกราฟคิดด้วยสูตรเดียวกัน</li>
          <li>คำตอบไม่ขึ้นกับอัตราที่คุณตั้ง ทั้งตานี้และตาก่อน</li>
        </ul>
      </details>
      {rows.length > 0 && (
        <details class="panel turn-details">
          <summary>ตัวเลขทุกวันอาทิตย์ที่ผ่านมา</summary>
          <table class="turn-table">
            <thead>
              <tr>
                <th scope="col">วันอาทิตย์</th>
                <th scope="col">เส้นฐาน</th>
                <th scope="col">ของคุณ</th>
                <th scope="col">ราคาจริง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <th scope="row">
                    <D iso={r.date} year={false} />
                  </th>
                  <td>
                    <Txt p={r.base}>{baht(r.base.v)}</Txt>
                  </td>
                  <td>
                    <Txt p={r.mine}>{baht(r.mine.v)}</Txt>
                  </td>
                  <td>
                    <Txt p={r.real}>{baht(r.real.v)}</Txt>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="caption">หน่วย บาท/ลิตร · ราคาในเกมคิดจากราคาจริงที่ปรับด้วยช็อกของตานั้น · กดตัวเลขเพื่อตามที่มา</p>
        </details>
      )}
      <button type="button" class="btn btn--primary btn--block" onClick={() => onLock(guess)}>
        ล็อกคำทาย แล้วไปตั้งอัตรา
      </button>
      <p class="caption turn-center">ล็อกแล้วแก้คำทายของตานี้ไม่ได้</p>
      <button type="button" class="btn btn--secondary" onClick={onBack}>
        กลับไปอ่านแฟ้ม
      </button>
    </>
  );

  return <Screen label="ทายผล" main={main} aside={aside} />;
}
