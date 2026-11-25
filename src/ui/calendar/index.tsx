// แท็บปฏิทิน: ตาของฉากเรียงเป็นแถว (DESIGN.md "Calendar Rows และ Day Chips")
// ตาที่เล่นแล้ว: การประชุมของผู้เล่น วันที่อัตรา B7 จริงเปลี่ยน และผลการทาย · ตาปัจจุบัน: ชิปวันและเวลาที่เหลือ
// ตาที่ยังไม่เล่น: วันที่และการประชุมปกติวันจันทร์เท่านั้น ห้ามแสดงค่าจริงของวันที่ยังไม่ถึง
import { guessTarget, isFinished, maxSpecialMeetings, timeAvailable, type TurnRecord } from '../../engine/game.ts';
import type { Scenario } from '../../engine/scenario-types.ts';
import type { Game } from '../../game/session.ts';
import type { ViewProps } from '../contracts.ts';
import { computed, D, DR, fromSourced, game, MarkLegend, Num, Ord, type Evidence } from '../evidence.tsx';
import { baht, int, pct, thDate, WEEKDAYS, WEEKDAYS_FULL } from '../format.ts';
import { CAPITAL_RULE, Pips, Screen } from '../kit.tsx';
import { sourced } from '../money/items.ts';
import { N, Panel } from '../money/panel.tsx';
import './calendar.css';

const weekDays = (sc: Scenario, i: number): string[] => sc.days.slice(i * 7, i * 7 + 7);
const timeRule = (label: string): Evidence => game(label, CAPITAL_RULE.time);

/** อัตราเป็นคำกับค่าสัมบูรณ์ (ลบ = ชดเชย · บวก = เก็บเข้า) */
function Rate({ name = '', r, ev }: { name?: string; r: number; ev: Evidence }) {
  if (ev.kind === 'missing') return <Num v="ไม่แน่นอน" ev={ev} />;
  return (
    <span>
      {name && `${name} `}
      {r < 0 ? 'ชดเชย' : r > 0 ? 'เก็บเข้า' : 'ไม่ชดเชยไม่เก็บ'} <Num v={baht(Math.abs(r))} unit="บาท/ลิตร" ev={ev} />
    </span>
  );
}

function Played({ g, rec, days }: { g: Game; rec: TurnRecord; days: string[] }) {
  const p = g.state.params;
  const i = rec.turn - 1;
  const b7 = g.sc.b7.slice(i * 7, i * 7 + 7);
  const before = i === 0 ? g.sc.startRates.b7.v : (g.sc.b7[i * 7 - 1] as Scenario['b7'][number]).rate.v;
  const changes = b7.flatMap((d, j) => (d.rate.v !== (j === 0 ? before : (b7[j - 1] as Scenario['b7'][number]).rate.v) ? [j] : []));
  const sun = b7[6] as Scenario['b7'][number];
  const sunDate = days[6] as string;
  const rateEv = (j: number): Evidence => fromSourced((b7[j] as Scenario['b7'][number]).rate, `อัตราเงินกองทุนดีเซล B7 จริง มีผล ${thDate(days[j] as string)} (ประกาศ กบน.)`);
  const target =
    rec.guessTarget === null
      ? null
      : {
          text: baht(rec.guessTarget),
          unit: 'บาท/ลิตร',
          ev: computed(`คำตอบของการทาย ตา ${rec.turn}: ราคาดีเซล B7 วันอาทิตย์ ${thDate(sunDate)} ถ้าใช้อัตรา ณ ต้นฉาก`, 'ราคาจริงวันอาทิตย์ × (1 + ช็อกของสัปดาห์) + (อัตรา ณ ต้นฉาก − อัตราจริงวันอาทิตย์) × (1 + ภาษีมูลค่าเพิ่ม)', [
            sourced(sun.retail, `ราคาขายปลีกดีเซล B7 กรุงเทพฯ จริง ${thDate(sunDate)}`, baht(sun.retail.v), 'บาท/ลิตร'),
            { text: pct(rec.shockBp), ev: game(`ช็อกราคาของสัปดาห์ ตา ${rec.turn}`, 'แฟ้มบอกช็อกก่อนทาย · สุ่มด้วย seed แทนเหตุที่คาดไม่ได้') },
            sourced(g.sc.startRates.b7, 'อัตราเงินกองทุนดีเซล B7 ณ ต้นฉาก (ลบ = ชดเชย)', baht(g.sc.startRates.b7.v), 'บาท/ลิตร'),
            sourced(sun.rate, `อัตราเงินกองทุนดีเซล B7 จริง ${thDate(sunDate)} (ลบ = ชดเชย)`, baht(sun.rate.v), 'บาท/ลิตร'),
          ]),
        };
  const guessEv = game(`คำทายของคุณ ตา ${rec.turn}: ราคาดีเซล B7 วันอาทิตย์ ${thDate(sunDate)}`, 'ค่าที่ผู้เล่นเลือกก่อนตั้งอัตรา');
  const bands = p.guessBands.map((b) => `ห่างไม่เกิน ${baht(b.withinSatang)} บาท ได้ ${b.points} แต้ม`).join(' · ');
  return (
    <>
      <ul class="cal-list">
        {rec.input.segments.map((s) => {
          const meetEv = (fuel: string) => game(`อัตราเงินกองทุน${fuel} ที่คุณตั้ง ${s.fromDay === 0 ? 'ในประชุมปกติ' : 'ในประชุมพิเศษ'} มีผล ${thDate(days[s.fromDay] as string)}`, 'ค่าที่ผู้เล่นเลือก มีผลถึงสิ้นสัปดาห์หรือจนถึงการตั้งครั้งถัดไป');
          return (
            <li>
              <b>{s.fromDay === 0 ? 'ประชุมปกติ' : 'ประชุมพิเศษ'}</b> {WEEKDAYS[s.fromDay]} <D iso={days[s.fromDay] as string} year={false} /> · <Rate name="ดีเซล B7" r={s.b7} ev={meetEv('ดีเซล B7')} /> ·{' '}
              <Rate name="แก๊สโซฮอล์ 95" r={s.g95} ev={meetEv('แก๊สโซฮอล์ 95')} />
            </li>
          );
        })}
      </ul>
      <p class="cal-line">
        ใช้เวลา <Num v={int(rec.timeUsed)} unit="ช่อง" ev={timeRule(`เวลาที่ใช้ในตา ${rec.turn}`)} /> จาก <Num v={int(p.timePerWeek)} unit="ช่อง" ev={timeRule('เวลาต่อสัปดาห์')} />
        {rec.forcedDoc && ' · มีเอกสารบังคับ'}
      </p>
      <p class="cal-line">
        <span class="cal-line__k">อัตรา B7 จริง</span>{' '}
        {changes.length === 0 ? (
          <>
            ไม่เปลี่ยนทั้งสัปดาห์ · <Rate r={(b7[0] as Scenario['b7'][number]).rate.v} ev={rateEv(0)} />
          </>
        ) : (
          <>
            เปลี่ยน{' '}
            {changes.map((j, k) => (
              <span class="cal-change">
                {k > 0 && ' · '}
                {WEEKDAYS[j]} <D iso={days[j] as string} year={false} /> <Rate r={(b7[j] as Scenario['b7'][number]).rate.v} ev={rateEv(j)} />
              </span>
            ))}
          </>
        )}
      </p>
      <p class="cal-line">
        <span class="cal-line__k">การทาย</span>{' '}
        {target === null ? (
          <>
            ไม่นับตานี้ เพราะราคาจริงวันอาทิตย์ไม่แน่นอน · คุณทาย <Num v={baht(rec.input.guessSatang)} unit="บาท/ลิตร" ev={guessEv} />
          </>
        ) : (
          <>
            ทาย <Num v={baht(rec.input.guessSatang)} unit="บาท/ลิตร" ev={guessEv} /> · คำตอบ <N x={target} /> · ได้{' '}
            <Num v={int(rec.guessPoints ?? 0)} unit="แต้ม" ev={game(`แต้มการทาย ตา ${rec.turn}`, bands)} strong />
          </>
        )}
      </p>
    </>
  );
}

function Current({ g, days, deciding }: { g: Game; days: string[]; deciding: boolean }) {
  const s = g.state;
  const p = s.params;
  const avail = timeAvailable(s);
  return (
    <>
      <ol class="cal-days" aria-label="วันในสัปดาห์นี้">
        {days.map((iso, j) => {
          const tag = j === 0 ? 'ลงมติ' : j === 6 ? 'วันที่ทาย' : '';
          const what = j === 0 ? 'ประชุมปกติ เส้นตายลงมติอัตราของสัปดาห์' : `นัดประชุมพิเศษได้${j === 6 ? ' · ราคาวันนี้คือสิ่งที่ทาย' : ''}`;
          return (
            <li class={`cal-day${j === 0 ? ' cal-day--vote' : ''}`}>
              <span aria-hidden="true" class="cal-day__wd">
                {WEEKDAYS[j]}
              </span>
              <time aria-hidden="true" class="cal-day__n" dateTime={iso}>
                {String(Number(iso.slice(8)))}
              </time>
              {tag && (
                <span aria-hidden="true" class="cal-day__tag">
                  {j === 0 ? tag : 'ทาย'}
                </span>
              )}
              <span class="sr-only">
                {WEEKDAYS_FULL[j]} <D iso={iso} /> {what}
              </span>
            </li>
          );
        })}
      </ol>
      <p class="cal-line">
        <span class="cal-line__k">จันทร์</span> ประชุมปกติ ลงมติอัตราของสัปดาห์ (เส้นตาย) · <span class="cal-line__k">อังคาร–อาทิตย์</span> นัดประชุมพิเศษตั้งอัตราใหม่ได้ มีผลถึงสิ้นสัปดาห์ ครั้งละ{' '}
        <Num v={int(p.specialMeetingCost)} unit="ช่อง" ev={timeRule('เวลาที่ประชุมพิเศษหนึ่งครั้งใช้')} /> · <span class="cal-line__k">อาทิตย์</span> วันของราคาที่ทาย
      </p>
      <p class="cal-line cal-time">
        <span class="cal-line__k">เวลา{deciding ? 'สัปดาห์นี้' : 'สัปดาห์ถัดไป'}</span> <Pips value={Math.max(0, avail)} max={p.timePerWeek} label="เวลา" />{' '}
        <Num v={int(Math.max(0, avail))} unit="ช่อง" ev={timeRule('เวลาที่ใช้ได้ในสัปดาห์นี้')} strong /> จาก <Num v={int(p.timePerWeek)} unit="ช่อง" ev={timeRule('เวลาต่อสัปดาห์')} /> · ประชุมพิเศษได้อีกไม่เกิน{' '}
        <Num v={int(maxSpecialMeetings(s))} unit="ครั้ง" ev={timeRule('จำนวนประชุมพิเศษที่นัดได้ในสัปดาห์นี้ (เวลาที่เหลือ ÷ เวลาต่อครั้ง ปัดลง)')} strong />
      </p>
      {s.forcedDocNext && (
        <p class="cal-line cal-warn">
          มีเอกสารบังคับ ใช้เวลา <Num v={int(p.forcedDocCost)} unit="ช่อง" ev={timeRule('เวลาที่เอกสารบังคับใช้')} /> เพราะทุนอย่างใดอย่างหนึ่งเหลือศูนย์เมื่อจบตาก่อน
        </p>
      )}
      {guessTarget(s, g.sc) === null && <p class="cal-line cal-warn">ตานี้ไม่นับการทาย เพราะราคาจริงวันอาทิตย์ไม่แน่นอน</p>}
      {g.save.phase === 'rates' && g.save.guess !== null && (
        <p class="cal-line">
          คุณทายไว้ <Num v={baht(g.save.guess)} unit="บาท/ลิตร" ev={game('คำทายของคุณในตานี้: ราคาดีเซล B7 วันอาทิตย์ ถ้าใช้อัตรา ณ ต้นฉาก', 'ค่าที่ผู้เล่นเลือกและล็อกแล้ว')} />
        </p>
      )}
    </>
  );
}

export function CalendarView({ g }: ViewProps) {
  const deciding = g.save.phase === 'files' || g.save.phase === 'guess' || g.save.phase === 'rates';
  const current = isFinished(g.state, g.sc) ? -1 : g.state.turn - 1;
  const rows = Array.from({ length: g.sc.weeks }, (_, i) => i);
  return (
    <Screen
      label="ปฏิทิน"
      main={
        <>
          <header class="cal-head">
            <h2>ปฏิทินของฉาก</h2>
            <p class="muted">
              <Ord>{g.sc.weeks}</Ord> ตา ตาละหนึ่งสัปดาห์ · <DR a={g.sc.days[0] as string} b={g.sc.days[g.sc.days.length - 1] as string} /> · ข้อมูลจริงแสดงเฉพาะตาที่เล่นแล้ว
            </p>
          </header>
          <Panel id="cal-weeks" title="ตาละหนึ่งสัปดาห์" note="จันทร์ถึงอาทิตย์">
            <ol class="cal-rows">
              {rows.map((i) => {
                const days = weekDays(g.sc, i);
                const rec = g.played[i];
                const state = rec ? 'past' : i === current ? 'now' : 'future';
                return (
                  <li class={`cal-row cal-row--${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                    <span class={`cal-chip cal-chip--${state}`}>
                      <span class="cal-chip__top">{state === 'now' ? (deciding ? 'ตอนนี้' : 'ถัดไป') : <Ord>ตา {i + 1}</Ord>}</span>
                      <time class="cal-chip__d" dateTime={days[0]}>
                        {thDate(days[0] as string, false)}
                      </time>
                    </span>
                    <div class="cal-body">
                      <p class="cal-title">
                        <Ord>ตา {i + 1}</Ord> · <DR a={days[0] as string} b={days[6] as string} />
                        <span class="cal-state">{state === 'past' ? 'เล่นแล้ว' : state === 'now' ? (deciding ? 'กำลังเล่น' : 'ตาถัดไป') : 'ยังไม่ถึง'}</span>
                      </p>
                      {rec ? (
                        <Played g={g} rec={rec} days={days} />
                      ) : state === 'now' ? (
                        <Current g={g} days={days} deciding={deciding} />
                      ) : (
                        <p class="cal-line muted">
                          ประชุมปกติ วันจันทร์ <D iso={days[0] as string} />
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </>
      }
      aside={
        <Panel id="cal-read" title="อ่านปฏิทิน">
          <ul class="cal-legend">
            <li>
              <span class="cal-chip cal-chip--now cal-chip--sample">ตอนนี้</span> ตาที่กำลังเล่น หรือตาถัดไปเมื่อดูผลอยู่
            </li>
            <li>
              <span class="cal-chip cal-chip--past cal-chip--sample">เล่นแล้ว</span> แสดงอัตราที่คุณตั้ง วันที่อัตราจริงเปลี่ยน และผลการทาย
            </li>
            <li>
              <span class="cal-chip cal-chip--future cal-chip--sample">ยังไม่ถึง</span> แสดงแค่วันที่ เพราะข้อมูลจริงของวันที่ยังไม่ถึงคือคำตอบของเกม
            </li>
            <li>
              <span class="cal-day cal-day--vote cal-chip--sample">ลงมติ</span> วันจันทร์ ประชุมปกติ เส้นตายตั้งอัตราของสัปดาห์
            </li>
          </ul>
          <p class="caption">
            เวลา <Num v={int(g.state.params.timePerWeek)} unit="ช่อง" ev={timeRule('เวลาต่อสัปดาห์')} /> ต่อสัปดาห์ · ประชุมพิเศษใช้ <Num v={int(g.state.params.specialMeetingCost)} unit="ช่อง" ev={timeRule('เวลาที่ประชุมพิเศษหนึ่งครั้งใช้')} /> ·
            เอกสารบังคับใช้ <Num v={int(g.state.params.forcedDocCost)} unit="ช่อง" ev={timeRule('เวลาที่เอกสารบังคับใช้')} /> · อัตราจริงมาจากประกาศ กบน. ฉบับที่มีผลในวันนั้น
          </p>
          <MarkLegend />
        </Panel>
      }
    />
  );
}
