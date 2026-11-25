// บัตรรายงานตอนจบ: สามแกนแยกกัน ไม่รวมเป็นคะแนนเดียว (docs/rattanava-engine-a.md หัวข้อ 5)
// ต่อด้วยหน้าวางทางของผู้เล่นคู่ทางจริงที่ยืมจากแบบ ข · ทางจริงเป็นเส้นอ้างอิง ไม่ใช่ไม้บรรทัดวัดผู้เล่น · ไม่ตัดสินว่าทางใดถูก
// เกมจบแล้วจึงแสดงเส้นฐานและค่าจริงได้ทุกตา
import type { ComponentChildren } from 'preact';
import type { Report, TurnRecord } from '../../engine/game.ts';
import type { Game } from '../../game/session.ts';
import type { EndReportProps } from '../contracts.ts';
import { computed, D, DR, fromSourced, game, Mark, Num, Ord, type Evidence, type SourceItem } from '../evidence.tsx';
import { baht, int, mbaht, thDate, WEEKDAYS } from '../format.ts';
import { CAPITAL_RULE, Pips, Screen } from '../kit.tsx';
import { dayBefore, dayItems, fundOf, It, mbItem, openingFund, openingItem, Rate, spread, UNCERTAIN_WHY, useWidth } from './shared.tsx';

type Real = Report['outcome']['fund']['real'];

/** ค่าจริงจากบัตรรายงาน · ไม่แน่นอน = กรอบเส้นประ (approx = แสดงค่าประมาณในกรอบ) */
function realItem(r: Real, text: string, unit: string, label: string, why = UNCERTAIN_WHY, approx = false): SourceItem {
  if (r.kind === 'uncertain') return { text: approx ? `ราว ${text}` : 'ไม่แน่นอน', ev: { kind: 'missing', label, formula: why, ids: r.ids } };
  return { text, unit, ev: fromSourced(r, label) };
}

// ---- แกนที่ 1 ผลลัพธ์ ----
function Outcome({ g, report }: { g: Game; report: Report }) {
  const { sc } = g;
  const o = report.outcome;
  const lastIso = sc.days[sc.days.length - 1] as string;
  const avgWhy = `ค่าเฉลี่ยรายวันทั้งฉาก (ตัดเศษ) รวมวันที่ราคาจริงไม่แน่นอน ${o.retailB7Average.uncertainDays.map((d) => thDate(d)).join(' · ')} ซึ่งเครื่องยนต์ใช้ค่าแทน ค่าเฉลี่ยทั้งของคุณ เส้นฐาน และค่าจริงจึงไม่แน่นอน`;
  const avgUnc = o.retailB7Average.uncertainDays.length > 0;
  const sunUnc = o.retailB7LastSunday.real.kind === 'uncertain';
  const mine = (v: number, label: string, formula: string, unit: string, text: string, unc: boolean, why = UNCERTAIN_WHY): SourceItem =>
    unc ? { text: `ราว ${text}`, ev: { kind: 'missing', label, formula: why } } : { text, unit, ev: computed(label, formula) };
  const rows: { name: ComponentChildren; cells: SourceItem[] }[] = [
    {
      name: (
        <>
          ฐานะกองทุน <D iso={lastIso} /> · ล้านบาท
        </>
      ),
      cells: [
        mbItem(o.fund.player, computed('ฐานะกองทุนในเกมของคุณ ณ วันสุดท้าย', 'ยอดยกมาจริง + เงินเข้าออกทุกตาตามบัญชีในเกม')),
        mbItem(o.fund.baseline, computed('ฐานะกองทุน ณ วันสุดท้าย ของเส้นฐาน "ถ้าไม่ออกนโยบายใหม่"', 'เครื่องยนต์และ seed เดียวกัน ใช้อัตรา ณ ต้นฉากทุกตา')),
        realItem(o.fund.real, mbaht(o.fund.real.v), 'ล้านบาท', 'ฐานะกองทุนสุทธิจริง ณ วันสุดท้ายของฉาก'),
      ],
    },
    {
      name: 'ราคาดีเซล B7 วันอาทิตย์สุดท้าย · บาท/ลิตร',
      cells: [
        mine(o.retailB7LastSunday.player, 'ราคาดีเซล B7 ในเกมของคุณ วันอาทิตย์สุดท้าย', 'ราคาจริง × (1 + ช็อก) + (อัตราของคุณ − อัตราจริง) × 1.07', 'บาท/ลิตร', baht(o.retailB7LastSunday.player), sunUnc),
        mine(o.retailB7LastSunday.baseline, 'ราคาดีเซล B7 วันอาทิตย์สุดท้าย ของเส้นฐาน', 'ราคาจริง × (1 + ช็อก) + (อัตรา ณ ต้นฉาก − อัตราจริง) × 1.07', 'บาท/ลิตร', baht(o.retailB7LastSunday.baseline), sunUnc),
        realItem(o.retailB7LastSunday.real, baht(o.retailB7LastSunday.real.v), 'บาท/ลิตร', 'ราคาขายปลีกดีเซล B7 กรุงเทพฯ จริง วันอาทิตย์สุดท้าย'),
      ],
    },
    {
      name: 'ราคาดีเซล B7 เฉลี่ยทั้งฉาก · บาท/ลิตร',
      cells: [
        mine(o.retailB7Average.player, 'ราคาดีเซล B7 ในเกมของคุณ เฉลี่ยทั้งฉาก', 'ค่าเฉลี่ยรายวันทั้งฉาก (ตัดเศษ)', 'บาท/ลิตร', baht(o.retailB7Average.player), avgUnc, avgWhy),
        mine(o.retailB7Average.baseline, 'ราคาดีเซล B7 เฉลี่ยทั้งฉาก ของเส้นฐาน', 'ค่าเฉลี่ยรายวันทั้งฉาก (ตัดเศษ)', 'บาท/ลิตร', baht(o.retailB7Average.baseline), avgUnc, avgWhy),
        realItem(o.retailB7Average.real, baht(o.retailB7Average.real.v), 'บาท/ลิตร', 'ราคาขายปลีกดีเซล B7 กรุงเทพฯ จริง เฉลี่ยทั้งฉาก', avgWhy, true),
      ],
    },
  ];
  const cols = ['คุณ', 'เส้นฐาน', 'จริง'];
  return (
    <section class="panel rs-axis">
      <h3 class="panel__title"><Ord>แกนที่ 1</Ord> · ผลลัพธ์</h3>
      <p class="caption">เทียบกับเส้นฐาน "ถ้าไม่ออกนโยบายใหม่" (อัตรา ณ ต้นฉากทุกตา seed เดียวกัน) และค่าจริงซึ่งเป็นเส้นอ้างอิง</p>
      <table class="rs-table rs-table--outcome">
        <thead>
          <tr>
            <th scope="col">ตัววัด</th>
            {cols.map((c) => (
              <th scope="col">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr>
              <th scope="row">{r.name}</th>
              {r.cells.map((c, i) => (
                <td data-label={cols[i]}>
                  <Num v={c.text} ev={c.ev} strong={i === 0} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---- แกนที่ 2 การเมือง ----
function Politics({ report }: { report: Report }) {
  const p = report.politics;
  const a = (label: string) => game(label, CAPITAL_RULE.authority);
  const t = (label: string) => game(label, CAPITAL_RULE.trust);
  const rows: [string, ComponentChildren, ComponentChildren][] = [
    [
      'เหลือตอนจบ',
      <>
        <Pips value={p.authority} max={p.max} label="อำนาจตอนจบ" /> <Num v={int(p.authority)} ev={a('อำนาจตอนจบ (ทุน)')} strong />
      </>,
      <>
        <Pips value={p.trust} max={p.max} label="ความเชื่อใจตอนจบ" /> <Num v={int(p.trust)} ev={t('ความเชื่อใจตอนจบ (ทุน)')} strong />
      </>,
    ],
    ['ต่ำสุดระหว่างเกม', <Num v={int(p.authorityMin)} ev={a('อำนาจต่ำสุดระหว่างเกม')} />, <Num v={int(p.trustMin)} ev={t('ความเชื่อใจต่ำสุดระหว่างเกม')} />],
    ['สัปดาห์ที่เสีย', <Num v={int(p.authorityBreaches)} unit="สัปดาห์" ev={a('จำนวนสัปดาห์ที่เสียอำนาจ')} />, <Num v={int(p.trustBreaches)} unit="สัปดาห์" ev={t('จำนวนสัปดาห์ที่เสียความเชื่อใจ')} />],
    [
      'ช่องที่เสียรวม ก่อนตัดที่ศูนย์',
      <Num v={int(p.authorityLost)} unit="ช่อง" ev={a('ช่องอำนาจที่เสียรวมทั้งเกม นับก่อนตัดที่ศูนย์')} />,
      <Num v={int(p.trustLost)} unit="ช่อง" ev={t('ช่องความเชื่อใจที่เสียรวมทั้งเกม นับก่อนตัดที่ศูนย์')} />,
    ],
  ];
  return (
    <section class="panel rs-axis">
      <h3 class="panel__title"><Ord>แกนที่ 2</Ord> · การเมือง</h3>
      <table class="rs-table rs-table--pol">
        <thead>
          <tr>
            <th scope="col">
              <span class="sr-only">ตัววัด</span>
            </th>
            <th scope="col">อำนาจ</th>
            <th scope="col">ความเชื่อใจ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, x, y]) => (
            <tr>
              <th scope="row">{name}</th>
              <td data-label="อำนาจ">{x}</td>
              <td data-label="ความเชื่อใจ">{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        เอกสารบังคับ <Num v={int(p.forcedDocs)} unit="ตา" ev={game('จำนวนตาที่มีเอกสารบังคับ', CAPITAL_RULE.time)} strong />
      </p>
      <p class="caption">
        อำนาจเสียเมื่อฐานะกองทุนลดมาก (ราคาของการชดเชย) ความเชื่อใจเสียเมื่อราคาหน้าปั๊มสูง (ราคาของการปล่อยราคา) · สองค่านี้คิดคนละหน่วย จำนวนช่องที่เสียจึงเทียบกันตรงๆ ไม่ได้ · ทุนฟื้นได้
        ค่าตอนจบอย่างเดียวจึงซ่อนราคาที่จ่ายไปกลางเกม
      </p>
    </section>
  );
}

// ---- แกนที่ 3 ความเข้าใจ ----
function Understanding({ g, report }: { g: Game; report: Report }) {
  const u = report.understanding;
  const bands = g.state.params.guessBands.map((b) => `ห่างไม่เกิน ${baht(b.withinSatang)} บาท ได้ ${b.points} แต้ม`).join(' · ');
  return (
    <section class="panel rs-axis">
      <h3 class="panel__title"><Ord>แกนที่ 3</Ord> · ความเข้าใจ</h3>
      <p class="rs-big">
        แต้มการทาย <Num v={int(u.points)} ev={game('แต้มการทายรวม', bands)} strong /> จาก <Num v={int(u.max)} ev={game('แต้มเต็มของตาที่นับ', `ตาที่นับ × แต้มสูงสุดต่อตา · ${bands}`)} />
      </p>
      <ul class="rs-turns">
        {g.played.map((h) => (
          <li>
            <b>
              <Ord>ตา {h.turn}</Ord>
            </b>{' '}
            {h.guessPoints === null ? <span class="muted">ไม่นับ</span> : <Num v={int(h.guessPoints)} unit="แต้ม" ev={game(`แต้มการทายตา ${h.turn}`, bands)} />}
          </li>
        ))}
      </ul>
      {u.voidTurns.length > 0 && (
        <p class="caption">
          {u.voidTurns.map((t, i) => (
            <>
              {i > 0 && ' และ '}
              <Ord>ตา {t}</Ord>
            </>
          ))}{' '}
          ไม่นับการทาย เพราะราคาจริงวันอาทิตย์ไม่แน่นอน จึงไม่มีคำตอบที่ตรวจได้
        </p>
      )}
      <p class="caption">ทุกตาทายราคาดีเซล B7 วันอาทิตย์ในกรณี "ถ้าใช้อัตรา ณ ต้นฉาก" ซึ่งไม่ขึ้นกับอัตราที่คุณตั้ง แต้มจึงวัดความเข้าใจการส่งผ่านราคา ไม่ใช่ผลของนโยบาย</p>
    </section>
  );
}

// ---- ทางของคุณคู่ทางจริง ----
function PathTable({ g, report }: { g: Game; report: Report }) {
  const { sc } = g;
  const p = g.state.params;
  const cols = ['การประชุมของคุณ', 'อัตรา B7 จริงที่เปลี่ยน', 'อัตรา B7 วันอาทิตย์', 'ราคา B7 วันอาทิตย์', 'ฐานะกองทุน · ล้านบาท'];
  return (
    <table class="rs-table rs-table--path">
      <thead>
        <tr>
          <th scope="col">ตา</th>
          {cols.map((c) => (
            <th scope="col">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.pathVsReal.map((w, i) => {
          const rec = g.played[i] as TurnRecord;
          const start = i * 7;
          const yours = (label: string) => game(label, 'อัตราที่คุณตั้ง (ลบ = ชดเชย · บวก = เก็บเข้า)');
          const sunPrice = dayItems(sc, rec, p, 'b7', 6);
          const realRate = realItem(w.realRateB7Sunday, baht(w.realRateB7Sunday.v), 'บาท/ลิตร', `อัตราเงินกองทุนดีเซล B7 จริง วันอาทิตย์ ${thDate(w.date)}`);
          return (
            <tr>
              <th scope="row">
                <Ord>ตา {w.turn}</Ord> <DR a={sc.days[start] as string} b={w.date} />
              </th>
              <td data-label={cols[0]}>
                <ul class="rs-list">
                  {w.playerSegments.map((s, k) => {
                    const iso = sc.days[start + s.fromDay] as string;
                    return (
                      <li>
                        <span class="nowrap">
                          {k === 0 ? 'ปกติ' : 'พิเศษ'} {WEEKDAYS[s.fromDay]} <D iso={iso} year={false} />
                        </span>{' '}
                        · B7 <Rate r={s.b7} unit={false} ev={yours(`อัตราดีเซล B7 ของคุณ ตั้งแต่ ${thDate(iso)} (บาท/ลิตร)`)} /> · แก๊สโซฮอล์ 95{' '}
                        <Rate r={s.g95} unit={false} ev={yours(`อัตราแก๊สโซฮอล์ 95 ของคุณ ตั้งแต่ ${thDate(iso)} (บาท/ลิตร)`)} />
                      </li>
                    );
                  })}
                </ul>
              </td>
              <td data-label={cols[1]}>
                {w.realChangesB7.length === 0 ? (
                  <span class="muted">ไม่เปลี่ยน</span>
                ) : (
                  <ul class="rs-list">
                    {w.realChangesB7.map((c) => (
                      <li>
                        <D iso={c.date} year={false} /> <Rate r={c.rate} unit={false} ev={{ kind: 'real', label: `อัตราเงินกองทุนดีเซล B7 จริง มีผล ${thDate(c.date)} (บาท/ลิตร)`, ids: [c.id] }} />
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td data-label={cols[2]}>
                <span class="rs-pair">
                  <span>
                    คุณ <Rate r={w.rateB7Sunday} unit={false} ev={yours(`อัตราดีเซล B7 ของคุณ วันอาทิตย์ ${thDate(w.date)} (บาท/ลิตร)`)} />
                  </span>
                  <span>
                    จริง <Rate r={w.realRateB7Sunday.v} unit={false} ev={realRate.ev} />
                  </span>
                </span>
              </td>
              <td data-label={cols[3]}>
                <span class="rs-pair">
                  <span>
                    คุณ <Num v={sunPrice.price.text} ev={sunPrice.price.ev} />
                  </span>
                  <span>
                    จริง <Num v={sunPrice.realPrice.text} ev={sunPrice.realPrice.ev} />
                  </span>
                </span>
              </td>
              <td data-label={cols[4]}>
                <span class="rs-pair">
                  <span>
                    คุณ <Num v={mbaht(w.fund)} ev={computed(`ฐานะกองทุนในเกมของคุณ วันอาทิตย์ ${thDate(w.date)} (ล้านบาท)`, 'ยอดยกมาจริง + เงินเข้าออกทุกตาตามบัญชีในเกม')} />
                  </span>
                  <span>
                    จริง <Num v={mbaht(w.realFund.v)} ev={fromSourced(w.realFund, `ฐานะกองทุนสุทธิจริง วันอาทิตย์ ${thDate(w.date)} (ล้านบาท)`)} />
                  </span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---- กราฟฐานะกองทุนรายสัปดาห์ ----
const H = 240;
const PAD = { l: 54, r: 14, t: 18, b: 28 };

function FundChart({ g, report }: { g: Game; report: Report }) {
  const [box, W] = useWidth();
  const { sc } = g;
  const open = openingFund(sc);
  const dates = [dayBefore(sc.days[0] as string), ...report.pathVsReal.map((w) => w.date)];
  const series: { key: string; name: string; vs: number[]; ev: Evidence['kind'] }[] = [
    { key: 'real', name: 'จริง', vs: [open, ...report.pathVsReal.map((w) => w.realFund.v)], ev: 'real' },
    { key: 'base', name: 'เส้นฐาน', vs: [open, ...g.baselinePlayed.map(fundOf)], ev: 'computed' },
    { key: 'mine', name: 'คุณ', vs: [open, ...report.pathVsReal.map((w) => w.fund)], ev: 'computed' },
  ];
  const all = series.flatMap((s) => s.vs);
  const M = 100_000_000; // สตางค์ต่อล้านบาท
  const step = (Math.max(...all) - Math.min(...all)) / M > 40_000 ? 20_000 * M : 10_000 * M;
  const lo = Math.floor(Math.min(0, ...all) / step) * step;
  const hi = Math.ceil(Math.max(0, ...all) / step) * step;
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const n = dates.length - 1;
  const x = (i: number) => PAD.l + 8 + (i * (W - PAD.l - PAD.r - 16)) / n;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const labelY = spread(
    series.map((s) => y(s.vs[n] as number) - 8),
    15,
    12,
    H - PAD.b - 4,
  );
  const shownX = [0, Math.trunc(n / 2), n];
  return (
    <div ref={box} class="rs-chart">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="กราฟฐานะกองทุนรายสัปดาห์ ของคุณ เส้นฐาน และค่าจริง · ค่ารายตาอยู่ในตารางข้างบน">
        {ticks.map((v) => (
          <g>
            <line class={`rs-chart__grid${v === 0 ? ' rs-chart__grid--zero' : ''}`} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text data-axis="" x={PAD.l - 5} y={y(v) + 4} text-anchor="end">
              {mbaht(v)}
            </text>
          </g>
        ))}
        {shownX.map((i) => (
          <text data-axis="" x={x(i)} y={H - 8} text-anchor={i === 0 ? 'start' : i === n ? 'end' : 'middle'}>
            {thDate(dates[i] as string, false)}
          </text>
        ))}
        {series.map((s) => (
          <g class={`rs-fund rs-fund--${s.key}`}>
            <polyline points={s.vs.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.key === 'real' && s.vs.slice(1).map((v, i) => <circle cx={x(i + 1)} cy={y(v)} r="3" />)}
          </g>
        ))}
        {series.map((s, k) => (
          <text data-ev={s.ev} class={`rs-chart__label rs-fund__label--${s.key}`} x={x(n) - 6} y={labelY[k]} text-anchor="end">
            {s.name} {mbaht(s.vs[n] as number)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function EndReport({ g, report, onNewGame, onExport }: EndReportProps) {
  const { sc } = g;
  const o = report.outcome;
  const seedEv = game('seed ของเกม', 'ตัวเลขตั้งต้นของช็อกราคาทุกตา · seed เดียวกันกับการตัดสินใจชุดเดียวกันให้ผลเหมือนเดิม');
  const realEnd = o.fund.real;
  const main = (
    <>
      <header class="rs-head">
        <h2>
          บัตรรายงาน · <DR a={sc.days[0] as string} b={sc.days[sc.days.length - 1] as string} />
        </h2>
      </header>
      <p class="rs-lead">สามแกนแยกกัน ไม่รวมเป็นคะแนนเดียว เพราะผลลัพธ์ การเมือง และความเข้าใจวัดคนละเรื่อง และทางนโยบายหนึ่งได้แกนหนึ่งด้วยราคาของอีกแกน</p>
      <div class="rs-axes">
        <Outcome g={g} report={report} />
        <Politics report={report} />
        <Understanding g={g} report={report} />
      </div>
      <section class="panel">
        <h3 class="panel__title">ทางของคุณคู่ทางจริง</h3>
        <p class="caption">
          ทางจริงเป็นเส้นอ้างอิง ไม่ใช่ไม้บรรทัดวัดคุณ · ในเกมตั้งอัตราได้ไม่เกิน <Num v={int(1 + Math.trunc(g.state.params.timePerWeek / g.state.params.specialMeetingCost))} unit="ครั้ง" ev={game('จำนวนครั้งที่ตั้งอัตราได้ต่อสัปดาห์', `ประชุมปกติ 1 ครั้ง + ประชุมพิเศษตามเวลาที่มี (${CAPITAL_RULE.time})`)} /> ต่อสัปดาห์
          ขณะที่อัตราจริงเปลี่ยนได้เกือบทุกวัน · อัตราเป็นบาท/ลิตร (ชดเชย = กองทุนจ่าย · เก็บเข้า = ผู้ใช้จ่ายเข้ากองทุน)
        </p>
        <div class="rs-scroll" data-scroll-x="">
          <PathTable g={g} report={report} />
        </div>
        <h4 class="rs-sub">ฐานะกองทุนรายสัปดาห์ · ล้านบาท</h4>
        <FundChart g={g} report={report} />
        <p class="caption">
          เส้นเข้ม = ของคุณ <Mark kind="computed" /> · เส้นน้ำเงิน = เส้นฐาน <Mark kind="computed" /> · เส้นเทาจุดกลม = ฐานะจริงวันอาทิตย์ <Mark kind="real" /> · ทุกเส้นเริ่มจากยอดยกมาจริง <It i={openingItem(sc)} /> · วันสุดท้าย
          คุณ <Num v={mbaht(o.fund.player)} unit="ล้านบาท" ev={computed('ฐานะกองทุนในเกมของคุณ ณ วันสุดท้าย', 'ยอดยกมาจริง + เงินเข้าออกทุกตาตามบัญชีในเกม')} /> · เส้นฐาน{' '}
          <Num v={mbaht(o.fund.baseline)} unit="ล้านบาท" ev={computed('ฐานะกองทุน ณ วันสุดท้าย ของเส้นฐาน', 'เครื่องยนต์และ seed เดียวกัน ใช้อัตรา ณ ต้นฉากทุกตา')} /> · จริง{' '}
          <Num v={mbaht(realEnd.v)} unit="ล้านบาท" ev={fromSourced(realEnd, 'ฐานะกองทุนสุทธิจริง ณ วันสุดท้ายของฉาก')} />
        </p>
      </section>
      <section class="panel rs-close">
        <h3 class="panel__title">ลองอีกทาง</h3>
        <p>
          ทางที่คุณเลือกเป็นหนึ่งในหลายทาง: ชดเชยมากช่วยราคาหน้าปั๊มแต่ฐานะกองทุนติดลบและเสียอำนาจ ปล่อยราคาขึ้นรักษาฐานะกองทุนแต่เสียความเชื่อใจ เกมไม่ตัดสินว่าทางใดถูก
        </p>
        <p>ลองถามตัวเอง: ส่วนไหนในเกมไม่ตรงกับของจริง</p>
        <p>
          seed ของเกมนี้ <Num v={String(g.save.seed)} ev={seedEv} strong /> · เริ่มด้วย seed นี้ที่หน้าเริ่ม ช็อกราคาทุกตาจะเหมือนเดิม แล้วลองทางอื่นเทียบกัน
        </p>
        <div class="rs-actions__row">
          <button type="button" class="btn btn--secondary" onClick={onExport}>
            ส่งออกไฟล์เซฟ
          </button>
          <button type="button" class="btn btn--primary" onClick={onNewGame}>
            เล่นใหม่
          </button>
        </div>
      </section>
    </>
  );
  return <Screen label="บัตรรายงานตอนจบ" main={main} />;
}

