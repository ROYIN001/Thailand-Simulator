// ขั้นที่ 4 เห็นผล: แบบ ข (น้ำตกเงิน ราคา B7 ทั้งสัปดาห์ การ์ดทุน) ที่ Royin เลือก + ปุ่ม "ตามเงิน" และ "ทำไมคำตอบเป็น …" จากแบบ ก
// สัปดาห์นี้จบแล้วจึงแสดงค่าจริงของตานี้ได้ · ห้ามแสดงอะไรของตาถัดไป (ใช้แค่ g.played และข้อมูลฉากของสัปดาห์นี้)
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { moneyGauge, trustLoss, type Fuel, type TurnRecord } from '../../engine/game.ts';
import type { Scenario, Sourced } from '../../engine/scenario-types.ts';
import type { Game } from '../../game/session.ts';
import type { ResultStepProps } from '../contracts.ts';
import { computed, D, DR, fromSourced, game, Mark, Num, Ord, type SourceItem } from '../evidence.tsx';
import { baht, int, mbaht, thDate, WEEKDAYS, WEEKDAYS_FULL } from '../format.ts';
import { CAPITAL_LABEL, CAPITAL_RULE, Pips, Screen, Sheet, type CapitalKey } from '../kit.tsx';
import {
  answerSteps,
  dayBefore,
  dayItems,
  FUEL_NAME,
  fundOf,
  It,
  mbItem,
  openingFund,
  openingItem,
  Rate,
  realRateItem,
  realRetailItem,
  shockItem,
  spread,
  useWidth,
  vatItem,
} from './shared.tsx';

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const startRateItem = (sc: Scenario, f: Fuel): SourceItem => ({
  text: baht(sc.startRates[f].v),
  unit: 'บาท/ลิตร',
  ev: fromSourced(sc.startRates[f], `อัตราเงินกองทุน${FUEL_NAME[f]} ณ ต้นฉาก (ลบ = ชดเชย · บวก = เก็บเข้า)`),
});

// ---- เงินของสัปดาห์ ----
type Bar = { label: ComponentChildren; item: SourceItem; from: number; to: number; tone: 'base' | 'sub' | 'levy' | 'other' | 'end' | 'neg' };

function fundWeek(g: Game, rec: TurnRecord) {
  const { sc } = g;
  const p = g.state.params;
  const t = rec.turn;
  const prev = g.played[t - 2];
  const prevSun: { fundOil: Sourced; fundLpg: Sourced } = t === 1 ? sc.opening : (sc.sundays[t - 2] as Scenario['sundays'][number]);
  const sun = sc.sundays[t - 1] as Scenario['sundays'][number];
  const prevIso = t === 1 ? dayBefore(sc.days[0] as string) : (sc.sundays[t - 2] as Scenario['sundays'][number]).date;
  const start = prev ? fundOf(prev) : openingFund(sc);
  const startItem = prev ? mbItem(start, computed(`ฐานะกองทุนในเกม ณ ${thDate(prevIso)} (สิ้นตา ${t - 1})`, 'บัญชีน้ำมัน + บัญชี LPG ในเกม ยกมาจากผลตาก่อน')) : openingItem(sc);
  const flow = (f: Fuel): SourceItem =>
    mbItem(
      rec.flows[f],
      computed(`เงินกองทุนจาก${FUEL_NAME[f]} ในเกม ตา ${t} (บวก = เข้ากองทุน · ลบ = ชดเชย)`, 'รวม 7 วัน: อัตราของคุณ × ปริมาณในเกม (ส่วนประกอบคือเงินรายวัน)', DAYS.map((i) => dayItems(sc, rec, p, f, i).flow)),
      true,
    );
  const realFlow = [...rec.days.b7, ...rec.days.g95].reduce((a, d) => a + d.realFlow, 0);
  const sunWhen = `วันอาทิตย์ ${thDate(sun.date)}`;
  const prevWhen = `${t === 1 ? 'ต้นฉาก' : 'วันอาทิตย์'} ${thDate(prevIso)}`;
  const oil = mbItem(
    rec.residualOil,
    computed(
      `รายการอื่นตามงบจริง บัญชีน้ำมัน ตา ${t}`,
      'ฐานะบัญชีน้ำมันจริงวันอาทิตย์นี้ − ฐานะจริงวันอาทิตย์ก่อน − เงินดีเซล B7 และแก๊สโซฮอล์ 95 ตามอัตราจริงและปริมาณจริง · ส่วนนี้ (น้ำมันชนิดอื่น ค่าบริหาร จังหวะการจ่าย) เท่ากันทุกทางเลือกของผู้เล่น',
      [
        mbItem(sun.fundOil.v, fromSourced(sun.fundOil, `ฐานะบัญชีน้ำมันจริง ${sunWhen}`)),
        mbItem(prevSun.fundOil.v, fromSourced(prevSun.fundOil, `ฐานะบัญชีน้ำมันจริง ${prevWhen}`)),
        mbItem(realFlow, computed('เงินดีเซล B7 และแก๊สโซฮอล์ 95 ตามอัตราจริง ทั้งสัปดาห์', 'รวม 7 วันของทั้งสองชนิด: อัตราจริง × ปริมาณจริง')),
      ],
    ),
    true,
  );
  const lpg = mbItem(
    rec.residualLpg,
    computed(`บัญชี LPG ตามงบจริง ตา ${t}`, 'ฐานะบัญชี LPG จริงวันอาทิตย์นี้ − ฐานะจริงวันอาทิตย์ก่อน · เกมไม่ได้คิดเงินของ LPG ใหม่', [
      mbItem(sun.fundLpg.v, fromSourced(sun.fundLpg, `ฐานะบัญชี LPG จริง ${sunWhen}`)),
      mbItem(prevSun.fundLpg.v, fromSourced(prevSun.fundLpg, `ฐานะบัญชี LPG จริง ${prevWhen}`)),
    ]),
    true,
  );
  const b7 = flow('b7');
  const g95 = flow('g95');
  const end = fundOf(rec);
  const endItem = mbItem(end, computed(`ฐานะกองทุนในเกม ${sunWhen}`, 'ต้นสัปดาห์ + ดีเซล B7 + แก๊สโซฮอล์ 95 + รายการอื่นบัญชีน้ำมัน + บัญชี LPG', [startItem, b7, g95, oil, lpg]));
  const c1 = start + rec.flows.b7;
  const c2 = c1 + rec.flows.g95;
  const c3 = c2 + rec.residualOil;
  const flowLabel = (f: Fuel, v: number) => (v < 0 ? `ชดเชย${FUEL_NAME[f]}` : `${FUEL_NAME[f]} ส่งเข้ากองทุน`);
  const bars: Bar[] = [
    { label: <>ต้นสัปดาห์ · <D iso={prevIso} year={false} /></>, item: startItem, from: 0, to: start, tone: 'base' },
    { label: flowLabel('b7', rec.flows.b7), item: b7, from: start, to: c1, tone: rec.flows.b7 < 0 ? 'sub' : 'levy' },
    { label: flowLabel('g95', rec.flows.g95), item: g95, from: c1, to: c2, tone: rec.flows.g95 < 0 ? 'sub' : 'levy' },
    { label: 'รายการอื่นตามงบจริง · บัญชีน้ำมัน', item: oil, from: c2, to: c3, tone: 'other' },
    { label: 'บัญชี LPG ตามงบจริง', item: lpg, from: c3, to: end, tone: 'other' },
    { label: <>สิ้นสัปดาห์ · <D iso={sun.date} year={false} /></>, item: endItem, from: 0, to: end, tone: end < 0 ? 'neg' : 'end' },
  ];
  return { bars, start, end, startItem, endItem, sun };
}

function Waterfall({ bars }: { bars: Bar[] }) {
  const xs = bars.flatMap((b) => [b.from, b.to]);
  const lo = Math.min(0, ...xs);
  const hi = Math.max(0, ...xs);
  const pos = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  return (
    <ol class="rs-fall">
      {bars.map((b, i) => (
        <li class={`rs-fall__row${i === bars.length - 1 ? ' rs-fall__row--total' : ''}`}>
          <span class="rs-fall__label">{b.label}</span>
          <span class={`rs-fall__v rs-tone--${b.tone}`}>
            <It i={b.item} strong />
          </span>
          <span class="rs-fall__track" aria-hidden="true">
            <span class="rs-fall__zero" style={{ left: `${pos(0)}%` }} />
            <span class={`rs-fall__bar rs-bar--${b.tone}`} style={{ left: `${pos(Math.min(b.from, b.to))}%`, width: `${Math.abs(pos(b.to) - pos(b.from))}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

// ---- ราคา B7 ทั้งสัปดาห์ ----
const H = 210;
const PAD = { l: 30, r: 12, t: 22, b: 26 };

function WeekChart({ g, rec }: { g: Game; rec: TurnRecord }) {
  const [box, W] = useWidth();
  const { sc } = g;
  const p = g.state.params;
  const t = rec.turn;
  const src = DAYS.map((i) => sc.b7[(t - 1) * 7 + i] as Scenario['b7'][number]);
  const unc = src.map((d) => d.retail.kind === 'uncertain');
  const mine = rec.days.b7.map((d) => d.retail);
  const real = rec.days.b7.map((d) => d.realRetail);
  const level = p.trustB7LevelSatang;
  const vals = [...mine, ...real, level];
  const lo = Math.floor((Math.min(...vals) - 150) / 500) * 500;
  const hi = Math.ceil((Math.max(...vals) + 150) / 500) * 500;
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const x = (i: number) => PAD.l + 16 + (i * (W - PAD.l - PAD.r - 32)) / 6;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 500) ticks.push(v);
  // ป้ายราคาในเกมใช้วันที่ราคาสูงสุดที่แน่นอน (ราคาสูงสุดคือสิ่งที่กติกาความเชื่อใจวัด)
  const certain = DAYS.filter((i) => !unc[i]);
  const top = certain.reduce((a, i) => ((mine[i] as number) > (mine[a] as number) ? i : a), certain[0] ?? 0);
  const realSunKind = unc[6] ? 'missing' : src[6]?.retail.kind === 'real' ? 'real' : 'computed';
  const realBelow = (real[6] as number) <= (mine[6] as number);
  // ป้ายสามป้ายอาจซ้อนกันเมื่อราคาใกล้กัน (เช่น ราคาจริงใกล้เกณฑ์) · ดันให้ห่างกันในแนวตั้ง
  const [yTop, ySun, yLevel] = spread([y(mine[top] as number) - 9, y(real[6] as number) + (realBelow ? 17 : -9), y(level) + 14], 14, 12, H - PAD.b - 4);
  const items = DAYS.map((i) => dayItems(sc, rec, p, 'b7', i));
  const levelEv = game('ระดับราคาดีเซล B7 ที่ความเชื่อใจเริ่มลด', CAPITAL_RULE.trust);
  const line = (vs: number[], cls: string) =>
    DAYS.slice(1).map((i) => <line x1={x(i - 1)} y1={y(vs[i - 1] as number)} x2={x(i)} y2={y(vs[i] as number)} class={`${cls}${unc[i - 1] || unc[i] ? ' rs-chart__gap' : ''}`} />);
  const unk = (i: number, v: number) => <rect class="rs-chart__unk" x={x(i) - 6} y={y(v) - 6} width="12" height="12" rx="2" />;
  const realRecordDays = DAYS.filter((i) => src[i]?.retail.kind === 'real');
  return (
    <div class="panel">
      <h3 class="panel__title">ราคาดีเซล B7 ทั้งสัปดาห์ · บาท/ลิตร</h3>
      <div ref={box} class="rs-chart">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="กราฟราคาขายปลีกดีเซล B7 ในเกมเทียบราคาจริงรายวันของสัปดาห์นี้ และระดับที่ความเชื่อใจเริ่มลด · ค่ารายวันอยู่ในตารางใต้กราฟ">
          {ticks.map((v) => (
            <g>
              <line class="rs-chart__grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
              <text data-axis="" x={PAD.l - 5} y={y(v) + 4} text-anchor="end">
                {Math.trunc(v / 100)}
              </text>
            </g>
          ))}
          {DAYS.map((i) => (
            <text data-axis="" x={x(i)} y={H - 8} text-anchor="middle">
              {WEEKDAYS[i]}
            </text>
          ))}
          <line class="rs-chart__level" x1={PAD.l} x2={W - PAD.r} y1={y(level)} y2={y(level)} />
          <text data-ev="game" class="rs-chart__levellabel" x={W - PAD.r} y={yLevel} text-anchor="end">
            {baht(level)} บาท · เกณฑ์ความเชื่อใจ
          </text>
          <g class="rs-chart__real">
            {line(real, '')}
            {DAYS.map((i) => (unc[i] ? unk(i, real[i] as number) : src[i]?.retail.kind === 'real' ? <circle cx={x(i)} cy={y(real[i] as number)} r="3.4" /> : null))}
          </g>
          <g class="rs-chart__mine">
            {line(mine, '')}
            {DAYS.map((i) => (unc[i] ? unk(i, mine[i] as number) : <rect x={x(i) - 3.5} y={y(mine[i] as number) - 3.5} width="7" height="7" />))}
          </g>
          {certain.length > 0 && (
            <text data-ev="computed" class="rs-chart__label" x={x(top)} y={yTop} text-anchor={top >= 4 ? 'end' : 'start'}>
              ในเกม สูงสุด {baht(mine[top] as number)}
            </text>
          )}
          <text data-ev={realSunKind} class="rs-chart__label rs-chart__label--real" x={x(6)} y={ySun} text-anchor="end">
            {unc[6] ? 'จริง ไม่แน่นอน' : `จริง ${baht(real[6] as number)}`}
          </text>
        </svg>
      </div>
      <p class="caption">
        เส้นเข้มจุดสี่เหลี่ยม = ราคาในเกม <Mark kind="computed" /> · เส้นเทา = ราคาจริง: จุดกลมคือวันที่มีระเบียน <Mark kind="real" />
        {realRecordDays.length > 0 && <> ({realRecordDays.map((i, k) => <>{k > 0 && ' '}{WEEKDAYS[i]}</>)})</>} วันที่ไม่มีจุดยกค่าก่อนหน้า <Mark kind="computed" />
        {unc.some(Boolean) && <> · กรอบเส้นประ = <span class="missing-chip">ไม่แน่นอน</span> ไม่มีระเบียนและไม่รู้วันที่ราคาเปลี่ยน</>} · เส้นแดง = ราคา{' '}
        <Num v={baht(level)} unit="บาท/ลิตร" ev={levelEv} /> ที่เกินแล้วความเชื่อใจเริ่มลด · วันอาทิตย์ในเกม <It i={items[6]?.price as SourceItem} /> จริง <It i={items[6]?.realPrice as SourceItem} />
      </p>
      <details class="rs-days">
        <summary>ราคารายวัน</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">วัน</th>
              <th scope="col">ในเกม</th>
              <th scope="col">จริง</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr>
                <th scope="row">
                  {WEEKDAYS_FULL[i]} <D iso={rec.days.b7[i]?.date as string} year={false} />
                </th>
                <td>
                  <It i={it.price} />
                </td>
                <td>
                  <It i={it.realPrice} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// ---- ทุน ----
function CapCard({ k, before, after, max, children }: { k: CapitalKey; before: number; after: number; max: number; children: ComponentChildren }) {
  return (
    <div class="tile rs-cap">
      <div class="rs-cap__head">
        <span class="rs-cap__name">{CAPITAL_LABEL[k]}</span>
        <Pips value={after} max={max} label={CAPITAL_LABEL[k]} />
        <Num v={`${int(before)} → ${int(after)}`} ev={game(`${CAPITAL_LABEL[k]} ก่อนและหลังตานี้ (ทุน)`, CAPITAL_RULE[k])} strong />
      </div>
      <div class="rs-cap__why">{children}</div>
    </div>
  );
}

function Capitals({ g, rec, fw }: { g: Game; rec: TurnRecord; fw: ReturnType<typeof fundWeek> }) {
  const p = g.state.params;
  const t = rec.turn;
  const prev = g.played[t - 2];
  const last = t === g.sc.weeks;
  const gm = (label: string, k: CapitalKey) => game(label, CAPITAL_RULE[k]);
  const slots = (n: number, k: CapitalKey) => <Num v={int(n)} unit="ช่อง" ev={gm('จำนวนช่องที่เสียหรือฟื้นในตานี้', k)} />;
  const recover = (k: 'authority' | 'trust', before: number, after: number, loss: number, clean: number) => {
    if (loss > 0 && before - loss < 0) return <p>ทุนหมดที่ศูนย์ · ช่องที่เกินยังนับในบัตรรายงานตอนจบ</p>;
    if (loss === 0 && after > before)
      return (
        <p>
          ไม่เสียติดกัน <Num v={int(p.recoverAfterCleanWeeks)} unit="สัปดาห์" ev={gm('การฟื้นของทุน', k)} /> จึงฟื้น {slots(after - before, k)}
        </p>
      );
    if (after < p.capitalMax && !last)
      return (
        <p class="muted">
          ถ้าไม่เสียอีก <Num v={int(p.recoverAfterCleanWeeks - clean)} unit="สัปดาห์" ev={gm('สัปดาห์ที่ยังต้องไม่เสียติดกันก่อนฟื้น', k)} /> ติดกัน ฟื้น {slots(p.capitalStep, k)}
        </p>
      );
    return null;
  };

  // อำนาจ: ฐานะรวมลดในสัปดาห์
  const decline = fw.start - fw.end;
  const declineItem = mbItem(Math.abs(decline), computed(decline > 0 ? 'ฐานะรวมของกองทุนในเกมที่ลดในสัปดาห์นี้' : 'ฐานะรวมของกองทุนในเกมที่เพิ่มในสัปดาห์นี้', 'ต้นสัปดาห์ − สิ้นสัปดาห์', [fw.startItem, fw.endItem]));
  const aStep = <Num v={mbaht(p.authorityStepSatang)} unit="ล้านบาท" ev={gm('ขั้นของอำนาจ', 'authority')} />;
  const aBefore = prev?.authority ?? p.capitalMax;

  // ความเชื่อใจ: แยกส่วนของดีเซล B7 กับแก๊สโซฮอล์ 95 ด้วยฟังก์ชันเดียวกับเครื่องยนต์
  const b7Part = trustLoss(rec.maxRetailB7, p.trustG95OverBaseSatang, p);
  const g95Part = trustLoss(p.trustB7LevelSatang, rec.maxG95OverBase, p);
  const maxDays = DAYS.filter((i) => rec.days.b7[i]?.retail === rec.maxRetailB7);
  const maxUncertain = maxDays.every((i) => (g.sc.b7[(t - 1) * 7 + i] as Scenario['b7'][number]).retail.kind === 'uncertain');
  const maxLabel = 'ราคาดีเซล B7 ในเกมสูงสุดของสัปดาห์';
  const maxB7: SourceItem = maxUncertain
    ? {
        text: 'ไม่แน่นอน',
        ev: {
          kind: 'missing',
          label: maxLabel,
          formula: `ราคาสูงสุดอยู่ในวันที่ราคาจริงไม่แน่นอน · เครื่องยนต์นับด้วยค่าแทน ${baht(rec.maxRetailB7)} บาท/ลิตร ซึ่งไม่สูงกว่าราคาที่เป็นไปได้ จึงไม่ทำให้เสียเกินจริง`,
        },
      }
    : { text: baht(rec.maxRetailB7), unit: 'บาท/ลิตร', ev: computed(maxLabel, 'ค่าสูงสุดของราคาในเกมทั้ง 7 วัน', DAYS.map((i) => dayItems(g.sc, rec, p, 'b7', i).price)) };
  const over: SourceItem = {
    text: baht(Math.abs(rec.maxG95OverBase)),
    unit: 'บาท/ลิตร',
    ev: computed('ราคาแก๊สโซฮอล์ 95 ในเกมเทียบเส้นฐาน วันที่ห่างมากที่สุดของสัปดาห์', 'ราคาในเกม − ราคาเส้นฐานวันเดียวกัน (อัตรา ณ ต้นฉาก) · ราคาจริงและช็อกหักกันหมด จึงขึ้นกับอัตราของคุณอย่างเดียว'),
  };
  const tBefore = prev?.trust ?? p.capitalMax;
  const tLevel = <Num v={baht(p.trustB7LevelSatang)} unit="บาท" ev={gm('ระดับราคาดีเซล B7 ที่ความเชื่อใจเริ่มลด', 'trust')} />;
  const tStep = <Num v={baht(p.trustB7StepSatang)} unit="บาท" ev={gm('ขั้นของความเชื่อใจ (ดีเซล B7)', 'trust')} />;
  const gLevel = <Num v={baht(p.trustG95OverBaseSatang)} unit="บาท" ev={gm('ระดับแก๊สโซฮอล์ 95 เหนือเส้นฐานที่ความเชื่อใจเริ่มลด', 'trust')} />;
  const gStep = <Num v={baht(p.trustG95StepSatang)} unit="บาท" ev={gm('ขั้นของความเชื่อใจ (แก๊สโซฮอล์ 95)', 'trust')} />;

  // เงิน: มาตรจากฐานะรวม
  const mBefore = prev ? prev.money : moneyGauge(openingFund(g.sc), p);
  const zero = (['authority', 'trust', 'money'] as const).filter((k) => rec[k] === 0).map((k) => CAPITAL_LABEL[k]);

  return (
    <div class="panel">
      <h3 class="panel__title">ทุนของคุณหลังตานี้</h3>
      <div class="rs-caps">
        <CapCard k="authority" before={aBefore} after={rec.authority} max={p.capitalMax}>
          {decline > 0 ? (
            <p>
              ฐานะรวมลด <It i={declineItem} /> ในสัปดาห์ · ทุก {aStep} เสียหนึ่งช่อง{' '}
              {rec.authorityLoss > 0 ? <>→ เสีย {slots(rec.authorityLoss, 'authority')}</> : <>ยังไม่ถึง จึงไม่เสีย</>}
            </p>
          ) : (
            <p>
              ฐานะรวมไม่ลด (เพิ่ม <It i={declineItem} />) จึงไม่เสีย
            </p>
          )}
          {recover('authority', aBefore, rec.authority, rec.authorityLoss, g.state.authorityClean)}
        </CapCard>
        <CapCard k="trust" before={tBefore} after={rec.trust} max={p.capitalMax}>
          <p>
            ดีเซล B7 ในเกมสูงสุด <It i={maxB7} />{' '}
            {b7Part > 0 ? (
              <>
                เกิน {tLevel} ทุก {tStep} เสียหนึ่งช่อง ปัดขึ้น → {slots(b7Part, 'trust')}
              </>
            ) : (
              <>ไม่เกิน {tLevel} จึงไม่เสีย</>
            )}
          </p>
          <p>
            {rec.maxG95OverBase > 0 ? (
              <>
                แก๊สโซฮอล์ 95 สูงกว่าเส้นฐานมากสุด <It i={over} />{' '}
                {g95Part > 0 ? (
                  <>
                    เกิน {gLevel} ทุก {gStep} เสียหนึ่งช่อง ปัดขึ้น → {slots(g95Part, 'trust')}
                  </>
                ) : (
                  <>ไม่เกิน {gLevel} จึงไม่เสีย</>
                )}
              </>
            ) : (
              <>แก๊สโซฮอล์ 95 ไม่สูงกว่าเส้นฐาน จึงไม่เสีย</>
            )}
          </p>
          {recover('trust', tBefore, rec.trust, rec.trustLoss, g.state.trustClean)}
        </CapCard>
        <CapCard k="money" before={mBefore} after={rec.money} max={p.capitalMax}>
          <p>
            ฐานะรวมสิ้นสัปดาห์{fw.end < 0 ? 'ติดลบ' : ''} <It i={{ ...fw.endItem, text: mbaht(Math.abs(fw.end)) }} />{' '}
            {fw.end >= 0 ? (
              <>ไม่ติดลบ มาตรจึงเต็ม</>
            ) : (
              <>
                · ทุก <Num v={mbaht(p.moneyBandSatang)} unit="ล้านบาท" ev={gm('ช่วงของมาตรเงิน', 'money')} /> ที่ติดลบ ลดหนึ่งช่อง ปัดขึ้น
              </>
            )}
          </p>
          <p class="muted">มาตรเงินแสดงฐานะ ไม่ได้ถูกจ่าย</p>
        </CapCard>
      </div>
      {!last && g.state.forcedDocNext && (
        <p class="rs-forced" role="status">
          ตาหน้ามีเอกสารบังคับ ใช้เวลา <Num v={int(p.forcedDocCost)} unit="ช่อง" ev={gm('เวลาที่เอกสารบังคับใช้', 'time')} /> จาก{' '}
          <Num v={int(p.timePerWeek)} unit="ช่อง" ev={gm('เวลาต่อสัปดาห์', 'time')} /> เพราะ{zero.join(' และ ')}เหลือศูนย์ · ประชุมพิเศษได้น้อยลง
        </p>
      )}
    </div>
  );
}

// ---- การทาย ----
function guessParts(g: Game, rec: TurnRecord) {
  const { sc } = g;
  const p = g.state.params;
  const sunIso = sc.days[rec.turn * 7 - 1] as string;
  const guess: SourceItem = { text: baht(rec.input.guessSatang), unit: 'บาท/ลิตร', ev: game('คำทายของคุณ', 'ล็อกก่อนตั้งอัตรา แก้ไม่ได้') };
  const bands = p.guessBands.map((b) => `ห่างไม่เกิน ${baht(b.withinSatang)} บาท ได้ ${b.points} แต้ม`).join(' · ');
  if (rec.guessTarget === null || rec.guessPoints === null) return { sunIso, guess, scored: null };
  const answer: SourceItem = {
    text: baht(rec.guessTarget),
    unit: 'บาท/ลิตร',
    ev: computed(`คำตอบ: ราคาดีเซล B7 วันอาทิตย์ ${thDate(sunIso)} ถ้าใช้อัตรา ณ ต้นฉาก`, 'ราคาจริงวันอาทิตย์ × (1 + ช็อก) + (อัตรา ณ ต้นฉาก − อัตราจริงวันอาทิตย์) × 1.07 · ปัดเศษสตางค์ทิ้งทีละขั้น', [
      realRetailItem(sc, 'b7', rec.turn, 6),
      shockItem(rec, p),
      startRateItem(sc, 'b7'),
      realRateItem(sc, 'b7', rec.turn, 6),
      vatItem(sc),
    ]),
  };
  const dist: SourceItem = { text: baht(Math.abs(rec.input.guessSatang - rec.guessTarget)), unit: 'บาท', ev: computed('คำทายห่างจากคำตอบ', '|คำทาย − คำตอบ|', [guess, answer]) };
  const points: SourceItem = { text: int(rec.guessPoints), unit: 'แต้ม', ev: game('แต้มการทายของตานี้', bands) };
  return { sunIso, guess, scored: { answer, dist, points } };
}

function AnswerSteps({ g, rec, guess, parts }: { g: Game; rec: TurnRecord; guess: SourceItem; parts: NonNullable<ReturnType<typeof guessParts>['scored']> }) {
  const { sc } = g;
  const p = g.state.params;
  const st = answerSteps(sc, rec);
  const sunIso = st.sun.date;
  const real = realRetailItem(sc, 'b7', rec.turn, 6);
  const shocked: SourceItem = { text: baht(st.shocked), unit: 'บาท/ลิตร', ev: computed('ราคาจริงวันอาทิตย์ที่ปรับด้วยช็อก', 'ราคาจริง + ราคาจริง × ช็อก (ปัดเศษสตางค์ทิ้ง)', [real, shockItem(rec, p)]) };
  const startR = startRateItem(sc, 'b7');
  const realR = realRateItem(sc, 'b7', rec.turn, 6);
  const diff: SourceItem = { text: baht(st.diff, true), unit: 'บาท/ลิตร', ev: computed('อัตรา ณ ต้นฉาก − อัตราจริงวันอาทิตย์', 'อัตรา ณ ต้นฉาก − อัตราจริง (ลบ = ชดเชย จึงชดเชยน้อยกว่าทำให้ผลเป็นบวก)', [startR, realR]) };
  const vatPart: SourceItem = { text: baht(st.vatPart, true), unit: 'บาท/ลิตร', ev: computed('ส่วนต่างของอัตราที่ส่งถึงราคาขายปลีก', 'ส่วนต่างของอัตรา × 1.07 (ปัดเศษสตางค์ทิ้ง)', [diff, vatItem(sc)]) };
  return (
    <>
      <p>
        คำถามของตานี้: ราคาขายปลีกดีเซล B7 กรุงเทพฯ วันอาทิตย์ <D iso={sunIso} /> ถ้า กบน. ยังใช้อัตรา ณ ต้นฉากตลอดสัปดาห์ · คำตอบจึงไม่ขึ้นกับอัตราที่คุณตั้ง
      </p>
      <ol class="rs-steps">
        <li>
          ราคาจริงวันอาทิตย์ <It i={real} />
        </li>
        <li>
          ปรับด้วยช็อกของสัปดาห์ <It i={shockItem(rec, p)} /> ได้ <It i={shocked} />
        </li>
        <li>
          อัตรา ณ ต้นฉาก <Rate r={sc.startRates.b7.v} ev={startR.ev} /> แต่อัตราจริงวันนั้น <Rate r={st.sun.realRate} ev={realR.ev} /> · ส่วนต่าง <It i={diff} />
        </li>
        <li>
          ส่วนต่างส่งถึงราคาพร้อมภาษีมูลค่าเพิ่ม: <It i={diff} /> × <It i={vatItem(sc)} /> = <It i={vatPart} />
        </li>
        <li>
          คำตอบ = <It i={shocked} /> {st.vatPart < 0 ? '−' : '+'} <It i={{ ...vatPart, text: baht(Math.abs(st.vatPart)) }} /> = <It i={parts.answer} strong />
        </li>
      </ol>
      <p class="caption">
        ทุกขั้นปัดเศษสตางค์ทิ้งตามกติกาเดียวของเครื่องยนต์ · คำตอบนี้คือราคาวันอาทิตย์ของเส้นฐาน "ถ้าไม่ออกนโยบายใหม่" · คุณทาย <It i={guess} /> ห่าง <It i={parts.dist} /> ได้{' '}
        <It i={parts.points} />
      </p>
    </>
  );
}

export function ResultStep({ g, record: rec, baseline, onNext, onMoney }: ResultStepProps) {
  const [why, setWhy] = useState(false);
  const { sc } = g;
  const t = rec.turn;
  const last = t === sc.weeks;
  const days = sc.days.slice((t - 1) * 7, t * 7);
  const fw = fundWeek(g, rec);
  const gp = guessParts(g, rec);
  const s = gp.scored;
  const baseItem = mbItem(
    fundOf(baseline),
    computed(`ฐานะกองทุน วันอาทิตย์ ${thDate(fw.sun.date)} ของเส้นฐาน "ถ้าไม่ออกนโยบายใหม่"`, 'เครื่องยนต์และ seed เดียวกับเกมของคุณ แต่ใช้อัตรา ณ ต้นฉากทุกตา', [startRateItem(sc, 'b7'), startRateItem(sc, 'g95')]),
  );
  const realItem = mbItem(fw.sun.fundNet.v, fromSourced(fw.sun.fundNet, `ฐานะกองทุนสุทธิจริง วันอาทิตย์ ${thDate(fw.sun.date)}`));

  const main = (
    <>
      <header class="rs-head">
        <h2>
          <Ord>ผลตา {t}</Ord> · <DR a={days[0] as string} b={days[6] as string} />
        </h2>
        <span class="rs-pill">{s ? <>ได้ <It i={s.points} /></> : 'ตานี้ไม่นับการทาย'}</span>
      </header>
      <div class="panel rs-guess">
        {s ? (
          <p>
            คุณทาย <It i={gp.guess} strong /> · คำตอบ <It i={s.answer} strong /> · ห่าง <It i={s.dist} />
          </p>
        ) : (
          <p>
            คุณทาย <It i={gp.guess} strong /> แต่ราคาจริงวันอาทิตย์ <D iso={gp.sunIso} /> <It i={realRetailItem(sc, 'b7', t, 6)} /> จึงไม่มีคำตอบที่ตรวจได้ และตานี้ไม่นับแต้ม
          </p>
        )}
        <p class="caption">
          สิ่งที่ทาย: ราคาขายปลีกดีเซล B7 วันอาทิตย์ <D iso={gp.sunIso} /> ถ้าใช้อัตรา ณ ต้นฉาก
        </p>
      </div>
      <div class="panel">
        <h3 class="panel__title">ฐานะกองทุนเปลี่ยนเพราะอะไร · ล้านบาท</h3>
        <Waterfall bars={fw.bars} />
        <p class="caption">
          อ่านจากบนลงล่าง: แต่ละแท่งเริ่มจากจุดที่แท่งก่อนหน้าจบ · ขีดตั้งคือศูนย์ · ตัวเลขในกราฟเป็นค่าคำนวณ <Mark kind="computed" /> กดตัวเลขเพื่อตามเงินทีละวัน
        </p>
        <p class="rs-compare">
          <span>
            เส้นฐาน <It i={baseItem} />
          </span>
          <span>
            ค่าจริง <D iso={fw.sun.date} year={false} /> <It i={realItem} />
          </span>
        </p>
        <p class="caption">เส้นฐานและค่าจริงเป็นเส้นอ้างอิง ไม่ใช่เกณฑ์ให้คะแนน</p>
      </div>
      <WeekChart g={g} rec={rec} />
    </>
  );
  const aside = (
    <>
      <Capitals g={g} rec={rec} fw={fw} />
      <div class="rs-actions">
        <div class="rs-actions__row">
          <button type="button" class="btn btn--secondary" onClick={onMoney}>
            ตามเงิน
          </button>
          {s && (
            <button type="button" class="btn btn--secondary" onClick={() => setWhy(true)}>
              ทำไมคำตอบเป็น{' '}
              <span class="nowrap" data-ev="computed">
                {s.answer.text} <Mark kind="computed" />
              </span>
            </button>
          )}
        </div>
        <button type="button" class="btn btn--primary btn--block" onClick={onNext}>
          {last ? (
            'ดูบัตรรายงาน'
          ) : (
            <>
              <Ord>ไปตา {t + 1}</Ord> · <DR a={sc.days[t * 7] as string} b={sc.days[t * 7 + 6] as string} />
            </>
          )}
        </button>
      </div>
    </>
  );
  return (
    <>
      <Screen label={`ผลตา ${t}`} main={main} aside={aside} />
      {why && s && (
        <Sheet title="ทำไมคำตอบเป็นเท่านี้" onClose={() => setWhy(false)}>
          <AnswerSteps g={g} rec={rec} guess={gp.guess} parts={s} />
        </Sheet>
      )}
    </>
  );
}
