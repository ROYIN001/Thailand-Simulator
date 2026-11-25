// ขั้นที่ 3 ตั้งอัตราและลงมติ (แบบ ก "แป้นอัตรา"): ประชุมปกติวันจันทร์ + ประชุมพิเศษตามเวลาที่เหลือ · ค่าประมาณจาก src/game/estimate.ts
// ห้ามแสดงอัตราจริงหรือราคาจริงของสัปดาห์นี้ · ค่าประมาณต่อจากคำทายของผู้เล่นเอง
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { maxSpecialMeetings, rateFloor, timeAvailable, type Fuel, type RateSegment } from '../../engine/game.ts';
import { b7SundayFromGuess, g95OverBase, rateOnDay, trustLossEstimate, weekFlowEstimate } from '../../game/estimate.ts';
import type { RatesStepProps } from '../contracts.ts';
import { computed, D, DR, fromSourced, game, Mark, Num, Ord, type Evidence, type SourceItem } from '../evidence.tsx';
import { baht, int, mbaht, thDate, WEEKDAYS, WEEKDAYS_FULL } from '../format.ts';
import { CapitalRow, Pips, Screen, Sheet } from '../kit.tsx';
import { BahtInput, clamp, FUEL_NAME, rateItem, rateWord, startRateEv, vatItem, weekDays } from './common.tsx';

type Seg = RateSegment & { key: number };
const FUELS: Fuel[] = ['b7', 'g95'];
const plain = (segs: Seg[]): RateSegment[] => segs.map(({ fromDay, b7, g95 }) => ({ fromDay, b7, g95 }));
const meetingName = (i: number) => (i === 0 ? 'ประชุมปกติ' : `ประชุมพิเศษครั้งที่ ${i}`);
const yourRate = (fuel: Fuel, i: number): Evidence => game(`อัตรา${FUEL_NAME[fuel]}ที่คุณตั้ง (${meetingName(i)})`, 'ทางเลือกของคุณ · บวก = เก็บเข้ากองทุน ลบ = ชดเชย');

/** แป้นอัตราหนึ่งชนิด: ทิศ (ชดเชย/เก็บเข้า) · ช่องพิมพ์จำนวนบาท · แถบเลื่อน · ปุ่ม ±1.00 ±0.10 */
function RateDial({ id, fuel, value, floor, max, minRule, ev, onChange, hint }: { id: string; fuel: Fuel; value: number; floor: number; max: number; minRule: number; ev: Evidence; onChange: (v: number) => void; hint?: ComponentChildren }) {
  const [negPref, setNegPref] = useState(value < 0);
  const neg = value < 0 || (value === 0 && negPref);
  const abs = Math.abs(value);
  const set = (v: number): number => {
    const c = clamp(v, floor, max);
    onChange(c);
    return c;
  };
  const dir = neg ? -1 : 1;
  const name = FUEL_NAME[fuel];
  return (
    <fieldset class="turn-dial">
      <legend>{name}</legend>
      {hint && <p class="caption">{hint}</p>}
      <div class="turn-dial__row">
        <div class="turn-seg" role="group" aria-label={`ทิศของอัตรา${name}`}>
          <button
            type="button"
            aria-pressed={neg}
            onClick={() => {
              setNegPref(true);
              set(-abs);
            }}
          >
            ชดเชย
          </button>
          <button
            type="button"
            aria-pressed={!neg}
            onClick={() => {
              setNegPref(false);
              set(abs);
            }}
          >
            เก็บเข้า
          </button>
        </div>
        <span class="turn-dial__val">
          <BahtInput id={id} satang={abs} label={`${name} ${neg ? 'ชดเชย' : 'เก็บเข้ากองทุน'} บาทต่อลิตร`} onCommit={(m) => set(dir * m)} onStep={(d) => set(dir * Math.max(0, abs + d))} />
          <span class="caption">บาท/ลิตร</span>
          <Mark kind="game" />
        </span>
      </div>
      <input
        class="turn-range"
        type="range"
        min={floor}
        max={max}
        step={1}
        value={value}
        aria-label={`เลื่อนอัตรา${name} ซ้ายไปทางชดเชย ขวาไปทางเก็บเข้ากองทุน`}
        aria-valuetext={`${rateWord(value)} ${baht(abs)} บาทต่อลิตร`}
        onInput={(e) => {
          // ลากแล้วปัดเป็น 0.10 · ปุ่มลูกศรขยับทีละ 1 สตางค์ จึงขยายเป็นทีละ 0.10 ไม่ให้ปัดกลับที่เดิม
          const raw = Number((e.target as HTMLInputElement).value);
          const d = raw - value;
          set(raw === floor || raw === max ? raw : Math.abs(d) < 10 ? value + Math.sign(d) * 10 : Math.round(raw / 10) * 10);
        }}
      />
      <div class="turn-range__ends caption" aria-hidden="true">
        <span>← ชดเชยมากขึ้น</span>
        <span>เก็บเข้ามากขึ้น →</span>
      </div>
      <div class="turn-steps">
        {[-100, -10, 10, 100].map((d) => (
          <button type="button" class="btn btn--quiet" aria-label={`${d < 0 ? 'ไปทางชดเชย' : 'ไปทางเก็บเข้า'} ${baht(Math.abs(d))} บาท`} onClick={() => set(value + d)}>
            <Ord>{baht(d, true)}</Ord>
          </button>
        ))}
      </div>
      <p class="turn-dial__sum">
        {rateWord(value)} <Num v={baht(abs)} unit="บาท/ลิตร" ev={ev} strong />
        {value === max && (
          <span class="caption">
            {' '}
            · เก็บเข้าได้ไม่เกินนี้ (ค่าของเกม)
          </span>
        )}
        {value === floor && (
          <span class="caption">
            {' '}
            · {floor === minRule ? 'ชดเชยได้ไม่เกินนี้ (ค่าของเกม)' : 'ชดเชยมากกว่านี้ไม่ได้ เพราะราคาในเกมบางวันจะติดลบ'}
          </span>
        )}
      </p>
    </fieldset>
  );
}

export function RatesStep({ g, guess, onSubmit }: RatesStepProps) {
  const p = g.state.params;
  const sc = g.sc;
  const days = weekDays(g);
  const floor = (fuel: Fuel, fromDay: number) => rateFloor(g.state, sc, fuel, fromDay, 6);
  const fit = (s: Seg): Seg => ({ ...s, b7: clamp(s.b7, floor('b7', s.fromDay), p.rateMaxSatang), g95: clamp(s.g95, floor('g95', s.fromDay), p.rateMaxSatang) });
  const [segs, setSegs] = useState<Seg[]>(() => [fit({ key: 0, fromDay: 0, ...g.state.rates })]);
  const [confirming, setConfirming] = useState(false);
  const raised = FUELS.filter((f) => g.state.rates[f] < floor(f, 0));
  const maxSp = maxSpecialMeetings(g.state);
  const last = segs[segs.length - 1] as Seg;
  const specials = segs.length - 1;
  const avail = timeAvailable(g.state);
  const used = specials * p.specialMeetingCost;
  const addBlock = specials >= maxSp ? 'เวลาของสัปดาห์นี้ไม่พอสำหรับประชุมพิเศษอีกครั้ง' : last.fromDay >= 6 ? 'ไม่มีวันเหลือหลังการประชุมครั้งล่าสุด' : null;
  const update = (key: number, patch: Partial<RateSegment>) => setSegs(segs.map((s) => (s.key === key ? fit({ ...s, ...patch }) : s)));
  const end = (i: number) => ((segs[i + 1]?.fromDay ?? 7) - 1);
  /** ช่วงวันที่การประชุมครั้งหนึ่งมีผล */
  const Span = ({ a, b }: { a: number; b: number }) =>
    a === b ? (
      <>
        เฉพาะวัน{WEEKDAYS_FULL[a]} <D iso={days[a] as string} />
      </>
    ) : (
      <>
        วัน{WEEKDAYS_FULL[a]}–{WEEKDAYS_FULL[b]} <DR a={days[a] as string} b={days[b] as string} />
      </>
    );

  // ---- ค่าประมาณ (ค่าคำนวณ · ไม่ใช้ค่าจริงของสัปดาห์นี้) ----
  const segments = plain(segs);
  const vat = vatItem(sc);
  const guessItem: SourceItem = { text: baht(guess), unit: 'บาท/ลิตร', ev: game('คำทายที่คุณล็อกไว้', 'ราคาดีเซล B7 วันอาทิตย์ ถ้าใช้อัตรา ณ ต้นฉาก ตามที่คุณทาย') };
  const sunRate = rateOnDay(segments, 'b7', 6);
  const b7Sun = b7SundayFromGuess(sc, guess, sunRate);
  const b7SunItem: SourceItem = {
    text: baht(b7Sun),
    unit: 'บาท/ลิตร',
    ev: computed('ราคาดีเซล B7 ในเกมวันอาทิตย์โดยประมาณ', 'คำทายของคุณ + (อัตราของคุณวันอาทิตย์ − อัตรา ณ ต้นฉาก) × 1.07 · ถ้าคำทายคลาด ค่านี้คลาดเท่ากัน', [
      guessItem,
      { text: baht(sunRate), unit: 'บาท/ลิตร', ev: game('อัตราดีเซล B7 ของคุณที่มีผลวันอาทิตย์ (ลบ = ชดเชย)', 'อัตราจากการประชุมครั้งล่าสุดของสัปดาห์') },
      { text: baht(sc.startRates.b7.v), unit: 'บาท/ลิตร', ev: startRateEv(sc, 'b7') },
      vat,
    ]),
  };
  const g95Top = segments.reduce((a, s) => (s.g95 > a ? s.g95 : a), (segments[0] as RateSegment).g95);
  const g95Over = g95OverBase(sc, g95Top);
  const g95Item: SourceItem = {
    text: baht(Math.abs(g95Over)),
    unit: 'บาท/ลิตร',
    ev: computed('ราคาแก๊สโซฮอล์ 95 ในเกมต่างจากเส้นฐานมากที่สุดในสัปดาห์', '(อัตราสูงสุดของคุณในสัปดาห์ − อัตรา ณ ต้นฉาก) × 1.07 · ราคาจริงและช็อกเหมือนกันทั้งสองทางจึงหักกันหมด', [
      { text: baht(g95Top), unit: 'บาท/ลิตร', ev: game('อัตราแก๊สโซฮอล์ 95 สูงสุดที่คุณตั้งในสัปดาห์นี้ (ลบ = ชดเชย)', 'ทางเลือกของคุณ') },
      { text: baht(sc.startRates.g95.v), unit: 'บาท/ลิตร', ev: startRateEv(sc, 'g95') },
      vat,
    ]),
  };
  const flows: Record<Fuel, number> = { b7: weekFlowEstimate(g.state, sc, 'b7', segments), g95: weekFlowEstimate(g.state, sc, 'g95', segments) };
  const flowItem = (fuel: Fuel): SourceItem => {
    const v = flows[fuel];
    const vols = new Map<string, SourceItem>();
    days.forEach((iso, i) => {
      const vol = (sc[fuel][(g.state.turn - 1) * 7 + i] as (typeof sc.b7)[number]).volume;
      vols.set(vol.ids.join(), { text: int(vol.v), unit: 'ลิตร/วัน', ev: fromSourced(vol, `ปริมาณจำหน่าย${FUEL_NAME[fuel]}ต่อวัน (เฉลี่ยของเดือน) ที่ใช้กับวันที่ ${iso}`) });
    });
    return {
      text: mbaht(Math.abs(v)),
      unit: 'ล้านบาท',
      ev: computed(`เงินกองทุนจาก${FUEL_NAME[fuel]}สัปดาห์นี้โดยประมาณ (${v < 0 ? 'ชดเชยออก' : 'เก็บเข้า'})`, 'อัตราของคุณแต่ละวัน × ปริมาณจริงเฉลี่ยต่อวันของเดือน รวม 7 วัน · ไม่รวมปริมาณที่เปลี่ยนตามราคา', [
        ...segs.map((s, i) => rateItem(s[fuel], yourRate(fuel, i))),
        ...vols.values(),
      ]),
    };
  };
  const flowWord = (fuel: Fuel) => (flows[fuel] < 0 ? 'ชดเชยออกราว' : flows[fuel] > 0 ? 'เก็บเข้าราว' : 'ราว');
  const trustN = trustLossEstimate(sc, p, guess, segments);
  const trustEv = computed(
    'ช่องความเชื่อใจที่อาจเสียสัปดาห์นี้',
    `ราคาดีเซล B7 เกิน ${baht(p.trustB7LevelSatang)} บาท ทุก ${baht(p.trustB7StepSatang)} บาทเสีย 1 ช่อง + แก๊สโซฮอล์ 95 สูงกว่าเส้นฐานเกิน ${baht(p.trustG95OverBaseSatang)} บาท ทุก ${baht(p.trustG95StepSatang)} บาทเสีย 1 ช่อง (ปัดขึ้น) · กติกาจริงดูราคาสูงสุดของทุกวัน ค่านี้ดูราคา B7 วันอาทิตย์วันเดียว`,
    [b7SunItem, g95Item],
  );
  const N = ({ it, strong = false }: { it: SourceItem; strong?: boolean }) => <Num v={it.text} {...(it.unit ? { unit: it.unit } : {})} ev={it.ev} strong={strong} />;

  const dials = (s: Seg, i: number) =>
    FUELS.map((fuel) => (
      <RateDial
        key={`${s.key}-${fuel}`}
        id={`turn-rate-${s.key}-${fuel}`}
        fuel={fuel}
        value={s[fuel]}
        floor={floor(fuel, s.fromDay)}
        max={p.rateMaxSatang}
        minRule={p.rateMinSatang}
        ev={yourRate(fuel, i)}
        onChange={(v) => update(s.key, { [fuel]: v })}
        hint={
          i === 0 && (
                <>
                  ต้นฉาก: {rateWord(sc.startRates[fuel].v)} <N it={rateItem(sc.startRates[fuel].v, startRateEv(sc, fuel))} />
                  {g.state.turn > 1 && (
                    <>
                      {' '}
                      · สัปดาห์ก่อนของคุณ: {rateWord(g.state.rates[fuel])}{' '}
                      <N it={rateItem(g.state.rates[fuel], game(`อัตรา${FUEL_NAME[fuel]}ของคุณเมื่อจบสัปดาห์ก่อน`, 'อัตราจากการประชุมครั้งล่าสุดของสัปดาห์ก่อน'))} />
                    </>
                  )}
                </>
          )
        }
      />
    ));

  const main = (
    <>
      <div class="turn-head">
        <h2>ตั้งอัตราเงินกองทุน</h2>
        <span class="caption">กบน. กำหนดอัตราเงินส่งเข้ากองทุนและอัตราชดเชย ไม่ได้กำหนดราคาขายปลีก · ราคาหน้าปั๊มในเกมเป็นผลที่ตามมา</span>
      </div>
      <section class="panel" aria-labelledby="turn-meet-0">
        <h3 id="turn-meet-0" class="panel__title">
          ประชุม กบน. ตามปกติ · วันจันทร์ <D iso={days[0] as string} />
        </h3>
        <p class="caption">
          มีผล<Span a={0} b={end(0)} /> · เริ่มจาก{g.state.turn > 1 ? 'อัตราของคุณเมื่อจบสัปดาห์ก่อน' : 'อัตรา ณ ต้นฉาก'}
        </p>
        {raised.length > 0 && (
          <p class="turn-note" role="note">
            อัตรา{raised.map((f) => FUEL_NAME[f]).join(' และ ')}ของสัปดาห์ก่อนชดเชยมากกว่าที่สัปดาห์นี้รับได้ (ราคาในเกมบางวันจะติดลบ) จึงปรับให้อยู่ในขอบแล้ว
          </p>
        )}
        <div class="turn-dials">{dials(segs[0] as Seg, 0)}</div>
      </section>
      {segs.slice(1).map((s, j) => {
        const i = j + 1;
        const prev = segs[i - 1] as Seg;
        const options = Array.from({ length: (segs[i + 1]?.fromDay ?? 7) - prev.fromDay - 1 }, (_, k) => prev.fromDay + 1 + k);
        return (
          <section class="panel" aria-labelledby={`turn-meet-${s.key}`} key={s.key}>
            <div class="turn-meet__head">
              <h3 id={`turn-meet-${s.key}`} class="panel__title">
                ประชุมพิเศษ <Ord>ครั้งที่ {i}</Ord>
              </h3>
              <button type="button" class="btn btn--quiet" onClick={() => setSegs(segs.filter((x) => x.key !== s.key))}>
                ยกเลิกนัดนี้
              </button>
            </div>
            <fieldset class="turn-dayset">
              <legend>มีผลตั้งแต่วัน</legend>
              <div class="turn-daypick">
                {options.map((d) => (
                  <button type="button" class="turn-daybtn" aria-pressed={s.fromDay === d} aria-label={`วัน${WEEKDAYS_FULL[d]} ${thDate(days[d] as string)}`} onClick={() => update(s.key, { fromDay: d })}>
                    <span>{WEEKDAYS[d]}</span>
                    <time dateTime={days[d]}>{Number((days[d] as string).slice(8))}</time>
                  </button>
                ))}
              </div>
            </fieldset>
            <p class="caption">
              มีผล<Span a={s.fromDay} b={end(i)} /> · ตั้งให้มีผลวันเสาร์หรืออาทิตย์ได้
            </p>
            <div class="turn-dials">{dials(s, i)}</div>
          </section>
        );
      })}
      <div class="turn-add">
        <button
          type="button"
          class="btn btn--secondary"
          disabled={addBlock !== null}
          aria-describedby="turn-add-why"
          onClick={() => setSegs([...segs, fit({ ...last, key: Math.max(...segs.map((s) => s.key)) + 1, fromDay: last.fromDay + 1 })])}
        >
          นัดประชุมพิเศษ
        </button>
        <span id="turn-add-why" class="caption">
          {addBlock ?? (
            <>
              ใช้เวลา <Num v={int(p.specialMeetingCost)} unit="ช่อง" ev={game('เวลาที่ประชุมพิเศษใช้', 'ประชุมพิเศษใช้เวลา 2 ช่องต่อครั้ง (ค่าของเกม)')} /> ต่อครั้ง · ตั้งอัตราใหม่ตั้งแต่วันที่เลือก · นัดได้อีก{' '}
              <Num v={int(maxSp - specials)} unit="ครั้ง" ev={game('จำนวนประชุมพิเศษที่ยังนัดได้', 'เวลาที่เหลือ ÷ เวลาต่อการประชุมพิเศษ ปัดลง (ค่าของเกม)')} />
            </>
          )}
        </span>
      </div>
    </>
  );

  const aside = (
    <>
      <div class="panel">
        <CapitalRow k="time" value={avail} max={p.timePerWeek} lose={used} />
        <p class="caption">แถบลาย = เวลาที่ประชุมพิเศษจะใช้</p>
      </div>
      <div class="panel" aria-labelledby="turn-preview">
        <h3 id="turn-preview" class="panel__title">
          ประมาณผลของมตินี้
        </h3>
        <ul class="turn-list">
          <li>
            ราคาดีเซล B7 วันอาทิตย์ ราว <N it={b7SunItem} strong /> · คิดต่อจากคำทายของคุณ <N it={guessItem} />
          </li>
          <li>
            แก๊สโซฮอล์ 95 {g95Over < 0 ? 'ต่ำกว่า' : g95Over > 0 ? 'สูงกว่า' : 'ต่างจาก'}เส้นฐานมากที่สุดราว <N it={g95Item} strong />
          </li>
          <li>
            เงินกองทุนสัปดาห์นี้: ดีเซล B7 {flowWord('b7')} <N it={flowItem('b7')} strong /> · แก๊สโซฮอล์ 95 {flowWord('g95')} <N it={flowItem('g95')} strong />
          </li>
          <li class="turn-pipline">
            <span>ความเชื่อใจ</span>
            <Pips value={g.state.trust} max={p.capitalMax} lose={Math.min(trustN, g.state.trust)} label="ความเชื่อใจ" />
            <span>
              อาจเสียราว <Num v={int(trustN)} unit="ช่อง" ev={trustEv} strong />
            </span>
          </li>
          <li>
            อำนาจ: ฐานะรวมของกองทุนลดในสัปดาห์ทุก <Num v={mbaht(p.authorityStepSatang)} unit="ล้านบาท" ev={game('ขั้นของอำนาจ', 'ฐานะรวมของกองทุนลดในสัปดาห์ทุก 8,000 ล้านบาท เสีย 1 ช่อง (ค่าของเกม)')} /> เสียหนึ่งช่อง ·
            รายการอื่นตามงบจริงที่คุณคุมไม่ได้ก็ขยับฐานะกองทุนด้วย จึงประมาณล่วงหน้าไม่ได้
          </li>
        </ul>
        <p class="caption">
          ทุกค่าเป็นค่าคำนวณโดยประมาณ <Mark kind="computed" /> ไม่ใช้ราคาหรืออัตราจริงของสัปดาห์นี้ · ราคาประมาณคลาดเท่าที่คำทายคลาด · เงินกองทุนไม่รวมปริมาณที่เปลี่ยนตามราคา · ความเชื่อใจของจริงดูราคาสูงสุดทุกวัน
          ค่านี้ดูแค่วันอาทิตย์ · ชดเชยมากกดราคาได้แต่ฐานะกองทุนลด เก็บเข้ามากช่วยฐานะแต่ราคาสูงขึ้น ทั้งสองทางมีราคา
        </p>
      </div>
      <button type="button" class="btn btn--primary btn--block" onClick={() => setConfirming(true)}>
        ลงมติ
      </button>
      {confirming && (
        <Sheet title="ยืนยันมติ กบน." onClose={() => setConfirming(false)}>
          <ol class="turn-summary">
            {segs.map((s, i) => (
              <li>
                <b>
                  {i === 0 ? 'ประชุมปกติ' : <Ord>ประชุมพิเศษครั้งที่ {i}</Ord>} · มีผล<Span a={s.fromDay} b={end(i)} />
                </b>
                {FUELS.map((f) => (
                  <span class="turn-summary__rate">
                    {FUEL_NAME[f]}: {rateWord(s[f])} <N it={rateItem(s[f], yourRate(f, i))} />
                  </span>
                ))}
              </li>
            ))}
          </ol>
          <p>
            ใช้เวลา <Num v={int(used)} unit="ช่อง" ev={game('เวลาที่ใช้กับประชุมพิเศษตานี้', 'จำนวนประชุมพิเศษ × 2 ช่อง (ค่าของเกม)')} /> · คำทายที่ล็อกไว้ <N it={guessItem} />
          </p>
          <p class="caption">ลงมติแล้วแก้ไม่ได้ ผลของสัปดาห์จะเปิดทันที</p>
          <div class="turn-actions">
            <button type="button" class="btn btn--secondary" onClick={() => setConfirming(false)}>
              กลับไปแก้
            </button>
            <button type="button" class="btn btn--primary" onClick={() => onSubmit(segments)}>
              ยืนยันลงมติ
            </button>
          </div>
        </Sheet>
      )}
    </>
  );

  return <Screen label="ตั้งอัตราและลงมติ" main={main} aside={aside} />;
}
