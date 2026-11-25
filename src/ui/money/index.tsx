// แท็บเงิน (มุมมองเงิน): เงินของกองทุนไหลไปทางไหน · ฐานะรายสัปดาห์ · เงินสะสมแยกช่องทาง · สมุดบัญชีสองด้าน
// เกณฑ์ความสนุกข้อ 5: ผู้เล่นต้องอธิบายได้ว่าเงินกองทุนไหลออกทางไหนโดยไม่ต้องเปิดเกม · แสดงเฉพาะตาที่เล่นแล้ว
import { ACCOUNTS, emptyBalances, ledgerSum, post, type Account, type Entry } from '../../engine/ledger.ts';
import type { Game } from '../../game/session.ts';
import type { ViewProps } from '../contracts.ts';
import { computed, D, DR, Mark, Ord, type SourceItem } from '../evidence.tsx';
import { int, mbaht, thDate } from '../format.ts';
import { Screen } from '../kit.tsx';
import { BASELINE_RULE, fundChain, mItem, openingDate, type Chain, type Week } from './items.ts';
import { N, Panel, Tile } from './panel.tsx';

const sumOf = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export function MoneyView({ g }: ViewProps) {
  const chain = fundChain(g);
  const last = chain.weeks[chain.weeks.length - 1];
  const head = (
    <header class="mv-head">
      <h2>มุมมองเงิน: เงินของกองทุนไปไหน</h2>
      <p class="muted">
        {last ? (
          <>
            ถึงวันอาทิตย์ <D iso={last.sunday} /> · เล่นแล้ว <Ord>{chain.weeks.length}</Ord> จาก <Ord>{g.sc.weeks}</Ord> ตา · แสดงเฉพาะตาที่เล่นแล้ว
          </>
        ) : (
          <>ยังไม่ได้เล่นตาใด · แสดงยอดยกมา ณ <D iso={openingDate(g.sc)} /></>
        )}
      </p>
    </header>
  );
  if (!last)
    return (
      <Screen
        label="มุมมองเงิน"
        main={
          <>
            {head}
            <Panel id="mv-open" title="ยอดยกมาของกองทุน" note={<D iso={openingDate(g.sc)} />}>
              <ul class="dk-tiles">
                <Tile label="บัญชีน้ำมัน" x={chain.openingOil} sub="ฐานะจริงจาก สกนช." />
                <Tile label="บัญชี LPG" x={chain.openingLpg} sub="ฐานะจริงจาก สกนช." />
                <Tile label="สองบัญชีรวมกัน" x={chain.opening} sub="จุดเริ่มของทั้งในเกมและเส้นฐาน" />
              </ul>
              <p>
                เมื่อจบตาแรก แท็บนี้จะแสดงฐานะกองทุนรายสัปดาห์เทียบเส้นฐานและค่าจริง เงินสะสมแยกตามช่องทาง (ดีเซล B7 แก๊สโซฮอล์ 95 และรายการอื่นตามงบจริง)
                และทุกรายการในสมุดบัญชี · ทุกตัวเลขกดดูที่มาและตามต่อได้จนถึงอัตรา ปริมาณ และราคาของแต่ละวัน
              </p>
            </Panel>
          </>
        }
        aside={<Ledger g={g} chain={chain} />}
      />
    );

  const diff = last.rec.fundOil + last.rec.fundLpg - (last.base.fundOil + last.base.fundLpg);
  const diffItem = mItem(diff, computed(`ฐานะในเกมต่างจากเส้นฐาน ณ ${thDate(last.sunday)} (บวก = ในเกมสูงกว่า)`, 'ฐานะรวมในเกม − ฐานะรวมตามเส้นฐาน · ส่วนต่างทั้งหมดมาจากอัตราดีเซล B7 และแก๊สโซฮอล์ 95 ที่คุณตั้ง เพราะช็อกและรายการอื่นเท่ากันทั้งสองเส้น', [last.fund, last.baseFund]), true);
  return (
    <Screen
      label="มุมมองเงิน"
      main={
        <>
          {head}
          <ul class="dk-tiles">
            <Tile label="ฐานะรวมในเกม" x={last.fund} sub={<D iso={last.sunday} />} />
            <Tile label="เส้นฐาน (อัตรา ณ ต้นฉาก)" x={last.baseFund} sub={<D iso={last.sunday} />} />
            <Tile label="ฐานะจริงของ สกนช." x={last.real} sub={<D iso={last.sunday} />} />
            <Tile label="ส่วนต่าง ในเกม − เส้นฐาน" x={diffItem} sub="ผลของอัตราที่คุณตั้ง" />
          </ul>
          <div class="mv-row">
            <FundChart g={g} chain={chain} />
            <Channels chain={chain} />
          </div>
        </>
      }
      aside={<Ledger g={g} chain={chain} />}
    />
  );
}

// ---- (ก) ฐานะกองทุนรายสัปดาห์ ----

const W = 400;
const H = 232;
const L = 58;
const R = 104; // ที่ว่างขวาสำหรับป้ายปลายเส้น ไม่ให้ป้ายทับเส้น
const T = 22;
const B = 26;
const STEPS = [500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000];

function FundChart({ g, chain }: { g: Game; chain: Chain }) {
  const n = chain.weeks.length;
  const last = chain.weeks[n - 1] as Week;
  const mil = (s: number): number => s / 100_000_000; // ใช้วาดเท่านั้น ตัวเลขที่แสดงมาจาก mbaht
  const series = {
    real: [chain.openingV, ...chain.weeks.map((w) => w.realV)],
    base: [chain.openingV, ...chain.weeks.map((w) => w.base.fundOil + w.base.fundLpg)],
    game: [chain.openingV, ...chain.weeks.map((w) => w.rec.fundOil + w.rec.fundLpg)],
  };
  const all = [...series.real, ...series.base, ...series.game].map(mil);
  const lo0 = Math.min(0, ...all);
  const hi0 = Math.max(0, ...all);
  const step = STEPS.find((s) => (hi0 - lo0) / s <= 5) ?? (STEPS[STEPS.length - 1] as number);
  const lo = Math.floor(lo0 / step) * step;
  const hi = Math.ceil(hi0 / step) * step || step;
  const x = (i: number): number => L + (i * (W - L - R)) / g.sc.weeks;
  const y = (s: number): number => T + ((hi - mil(s)) / (hi - lo)) * (H - T - B);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const path = (vs: number[]): string => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const dates = [openingDate(g.sc), ...chain.weeks.map((w) => w.sunday)];

  // ป้ายปลายเส้น: เรียงตามแนวตั้งแล้วดันให้ห่างกันอย่างน้อย 14 หน่วย
  const ends = (
    [
      ['game', 'ในเกม', last.fund, 'computed'],
      ['base', 'เส้นฐาน', last.baseFund, 'computed'],
      ['real', 'จริง', last.real, last.real.ev.kind],
    ] as const
  )
    .map(([k, name, item, ev]) => ({ k, name, item, ev, y: y(series[k][n] as number) }))
    .sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => {
    const prev = ends[i - 1];
    if (prev && e.y < prev.y + 14) e.y = prev.y + 14;
  });
  const overflow = (ends[ends.length - 1]?.y ?? 0) - (H - B - 4);
  if (overflow > 0) for (const e of ends) e.y -= overflow;
  const lx = x(n) + 8;

  const summary = `ฐานะรวมของกองทุนรายสัปดาห์ ${n} ตา: ล่าสุด ${thDate(last.sunday)} ในเกม ${mbaht(series.game[n] as number)} เส้นฐาน ${mbaht(series.base[n] as number)} จริง ${last.real.text} ล้านบาท`;
  return (
    <Panel id="mv-chart" title="ฐานะกองทุนรายสัปดาห์" note="ล้านบาท · วันอาทิตย์สิ้นตา" class="mv-row__item">
      <svg class="mv-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {n < g.sc.weeks && (
          <g>
            <rect class="mv-chart__future" x={x(n) + 6} y={T} width={x(g.sc.weeks) - x(n) - 6} height={H - T - B} rx="6" />
            {x(g.sc.weeks) - x(n) > 56 && (
              <text x={x(g.sc.weeks) - 4} y={H - B - 8} text-anchor="end">
                ยังไม่ถึง
              </text>
            )}
          </g>
        )}
        <text x={L} y="12" class="mv-chart__title">ฐานะรวม · ล้านบาท</text>
        {ticks.map((v) => (
          <g>
            <line x1={L} x2={x(g.sc.weeks)} y1={y(v * 100_000_000)} y2={y(v * 100_000_000)} class={v === 0 ? 'mv-grid mv-grid--zero' : 'mv-grid'} />
            <text x={L - 6} y={y(v * 100_000_000) + 4} text-anchor="end" data-axis="">
              {int(v)}
            </text>
          </g>
        ))}
        {dates.map((d, i) =>
          (n - i) % 2 === 0 ? (
            <text x={x(i)} y={H - 8} text-anchor="middle" data-axis="">
              {thDate(d, false)}
            </text>
          ) : null,
        )}
        <path d={path(series.base)} class="mv-line mv-line--base" />
        <path d={path(series.real)} class="mv-line mv-line--real" />
        <path d={path(series.game)} class="mv-line mv-line--game" />
        {series.real.map((v, i) => (
          <circle cx={x(i)} cy={y(v)} r="3" class="mv-dot--real" />
        ))}
        {series.game.map((v, i) => (
          <circle cx={x(i)} cy={y(v)} r={i === n ? 4.5 : 2.6} class={i === n ? 'mv-dot--now' : 'mv-dot--game'} />
        ))}
        <g class="mv-chart__labels">
          {ends.map((e) => (
            <text x={lx} y={e.y + 4} data-ev={e.ev === 'missing' ? 'missing' : e.ev}>
              <tspan class="mv-chart__lname">{e.name}</tspan> <tspan class={`mv-chart__lv mv-chart__lv--${e.k}`}>{e.item.text}</tspan>
            </text>
          ))}
        </g>
      </svg>
      <ul class="mv-key caption">
        <li>
          <svg width="26" height="10" aria-hidden="true">
            <line x1="1" x2="25" y1="5" y2="5" class="mv-line mv-line--game" />
          </svg>
          เส้นทึบหนา = ฐานะในเกม <Mark kind="computed" />
        </li>
        <li>
          <svg width="26" height="10" aria-hidden="true">
            <line x1="1" x2="25" y1="5" y2="5" class="mv-line mv-line--base" />
          </svg>
          เส้นประ = เส้นฐาน ถ้าใช้อัตรา ณ ต้นฉากทุกตา <Mark kind="computed" />
        </li>
        <li>
          <svg width="26" height="10" aria-hidden="true">
            <line x1="1" x2="25" y1="5" y2="5" class="mv-line mv-line--real" />
            <circle cx="13" cy="5" r="3" class="mv-dot--real" />
          </svg>
          เส้นบางจุดทึบ = ฐานะจริงจากรายงาน สกนช. <Mark kind="real" />
        </li>
      </ul>
      <p class="caption">
        จุดคือวันอาทิตย์สิ้นแต่ละตา เส้นที่ลากระหว่างจุดไม่ใช่ข้อมูลรายวัน · ล่าสุด <D iso={last.sunday} />: ในเกม <N x={last.fund} /> · เส้นฐาน <N x={last.baseFund} /> · จริง <N x={last.real} /> · กดตัวเลขเพื่อตามว่ามาจากเงินช่องทางใด
      </p>
      <details class="mv-details">
        <summary>ดูตัวเลขรายสัปดาห์</summary>
        <table class="mv-table">
          <caption class="sr-only">ฐานะรวมของกองทุน ณ วันอาทิตย์สิ้นแต่ละตา (ล้านบาท)</caption>
          <thead>
            <tr>
              <th scope="col">วันอาทิตย์</th>
              <th scope="col">ในเกม</th>
              <th scope="col">เส้นฐาน</th>
              <th scope="col">จริง</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <D iso={openingDate(g.sc)} year={false} /> <span class="muted">ยกมา</span>
              </th>
              <td colSpan={3}>
                <N x={chain.opening} />
              </td>
            </tr>
            {chain.weeks.map((w) => (
              <tr>
                <th scope="row">
                  <D iso={w.sunday} year={false} />
                </th>
                <td>
                  <Num0 x={w.fund} />
                </td>
                <td>
                  <Num0 x={w.baseFund} />
                </td>
                <td>
                  <Num0 x={w.real} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Panel>
  );
}

/** ตัวเลขในตาราง: หน่วยอยู่ที่หัวตาราง */
const Num0 = ({ x }: { x: SourceItem }) => <N x={{ text: x.text, ev: x.ev }} />;

// ---- (ข) เงินสะสมแยกช่องทาง ----

type Channel = { key: string; name: string; item: SourceItem; v: number; fuel: boolean; base?: SourceItem };

function Channels({ chain }: { chain: Chain }) {
  const ws = chain.weeks;
  const n = ws.length;
  const upTo = `ตั้งแต่ต้นฉากถึงตา ${n}`;
  const cum = (label: string, formula: string, items: SourceItem[], v: number): SourceItem => mItem(v, computed(`${label} ${upTo}`, formula, items));
  const fuelFormula = 'ผลรวมเงินสุทธิของทุกตาที่เล่นแล้ว · ลบ = กองทุนจ่ายชดเชยให้ผู้ค้า · บวก = ผู้ค้าส่งเงินเข้ากองทุน';
  const resFormula = 'ผลรวมของทุกตาที่เล่นแล้ว · เท่ากันทุกทางเลือกของผู้เล่น เพราะคิดจากการเปลี่ยนแปลงจริงของ สกนช.';
  const channels: Channel[] = [
    {
      key: 'b7',
      name: 'ดีเซล B7',
      fuel: true,
      v: sumOf(ws.map((w) => w.rec.flows.b7)),
      item: cum('เงินดีเซล B7 เข้ากองทุนสุทธิในเกม', fuelFormula, ws.map((w) => w.b7), sumOf(ws.map((w) => w.rec.flows.b7))),
      base: cum('เงินดีเซล B7 เข้ากองทุนสุทธิตามเส้นฐาน', `${BASELINE_RULE} · ${fuelFormula}`, ws.map((w) => w.baseB7), sumOf(ws.map((w) => w.base.flows.b7))),
    },
    {
      key: 'g95',
      name: 'แก๊สโซฮอล์ 95',
      fuel: true,
      v: sumOf(ws.map((w) => w.rec.flows.g95)),
      item: cum('เงินแก๊สโซฮอล์ 95 เข้ากองทุนสุทธิในเกม', fuelFormula, ws.map((w) => w.g95), sumOf(ws.map((w) => w.rec.flows.g95))),
      base: cum('เงินแก๊สโซฮอล์ 95 เข้ากองทุนสุทธิตามเส้นฐาน', `${BASELINE_RULE} · ${fuelFormula}`, ws.map((w) => w.baseG95), sumOf(ws.map((w) => w.base.flows.g95))),
    },
    { key: 'oil', name: 'รายการอื่น บัญชีน้ำมัน', fuel: false, v: sumOf(ws.map((w) => w.rec.residualOil)), item: cum('รายการอื่นตามงบจริง บัญชีน้ำมัน', resFormula, ws.map((w) => w.resOil), sumOf(ws.map((w) => w.rec.residualOil))) },
    { key: 'lpg', name: 'รายการอื่น บัญชี LPG', fuel: false, v: sumOf(ws.map((w) => w.rec.residualLpg)), item: cum('รายการอื่นตามงบจริง บัญชี LPG', resFormula, ws.map((w) => w.resLpg), sumOf(ws.map((w) => w.rec.residualLpg))) },
  ];
  const total = sumOf(channels.map((c) => c.v));
  const totalItem = mItem(total, computed(`ฐานะรวมเปลี่ยนจากยอดยกมา ${upTo}`, 'ผลรวมเงินสี่ช่องทาง = ฐานะในเกมตอนนี้ − ยอดยกมา · ตัวเลขแต่ละตัวปัดเศษทิ้งเป็นล้านบาท', channels.map((c) => c.item)), true);
  const scale = Math.max(1, ...channels.map((c) => Math.abs(c.v)));
  const worst = [...channels].sort((a, b) => a.v - b.v)[0] as Channel;
  const dir = (c: Channel): string => (c.v === 0 ? 'ไม่มีเงินเข้าหรือออก' : c.fuel ? (c.v < 0 ? 'กองทุนจ่ายชดเชยให้ผู้ค้า' : 'ผู้ค้าส่งเงินเข้ากองทุน') : c.v < 0 ? 'ออกจากกองทุน' : 'เข้ากองทุน');
  return (
    <Panel id="mv-flow" title="เงินเข้า–ออกสะสม แยกช่องทาง" note={<>ถึงตา <Ord>{n}</Ord></>} class="mv-row__item">
      <p class="mv-lead">
        {worst.v < 0 ? (
          <>
            เงินออกจากกองทุนมากที่สุดทาง <b>{worst.name}</b> <N x={worst.item} strong />
          </>
        ) : (
          'ยังไม่มีช่องทางใดที่เงินออกจากกองทุนสุทธิ'
        )}
      </p>
      <ul class="mv-bars">
        {channels.map((c) => {
          const w = `${((Math.abs(c.v) / scale) * 100).toFixed(1)}%`;
          const tone = c.fuel ? (c.v < 0 ? 'out' : 'in') : 'other';
          return (
            <li class="mv-bar">
              <div class="mv-bar__top">
                <span class="mv-bar__name">
                  <b>{c.name}</b>
                  <span class="caption">{dir(c)}</span>
                </span>
                <N x={c.item} strong />
              </div>
              <div class="mv-bar__track" aria-hidden="true">
                <span class="mv-bar__half mv-bar__half--neg">{c.v < 0 && <span class={`mv-bar__fill mv-bar__fill--${tone}`} style={{ width: w }} />}</span>
                <span class="mv-bar__half mv-bar__half--pos">{c.v > 0 && <span class={`mv-bar__fill mv-bar__fill--${tone}`} style={{ width: w }} />}</span>
              </div>
              {c.base ? (
                <p class="caption">
                  เส้นฐาน <N x={c.base} />
                </p>
              ) : (
                <p class="caption">เท่ากันทุกทางเลือก ทั้งในเกมและเส้นฐาน</p>
              )}
            </li>
          );
        })}
      </ul>
      <p class="mv-total">
        รวมสี่ช่องทาง = ฐานะเปลี่ยนจากยอดยกมา <N x={totalItem} strong />
      </p>
      <p class="caption">
        แท่งซ้ายของเส้นกลาง = เงินออกจากกองทุน แท่งขวา = เงินเข้ากองทุน ความยาวเทียบกับช่องทางที่ใหญ่ที่สุด · ส้ม = เงินชดเชย กรมท่า = เงินที่เก็บเข้า เทา = รายการอื่น ·
        ยอดยกมา <N x={chain.opening} /> · กดตัวเลขเพื่อดูรายตาและรายวัน
      </p>
    </Panel>
  );
}

// ---- (ค) สมุดบัญชีสองด้าน ----

const ACCOUNT_NAME: Record<Account, string> = {
  'fund.oil': 'กองทุน บัญชีน้ำมัน',
  'fund.lpg': 'กองทุน บัญชี LPG',
  traders: 'ผู้ค้าน้ำมัน',
  other: 'รายการอื่นตามงบจริง',
  opening: 'ยอดยกมา',
};
const ACCOUNT_NOTE: Record<Account, string> = {
  'fund.oil': 'ฐานะบัญชีน้ำมันของกองทุน · ติดลบ = ขาดทุนสะสม',
  'fund.lpg': 'ฐานะบัญชีก๊าซหุงต้ม (LPG) ของกองทุน',
  traders: 'ผู้ส่งเงินเข้ากองทุนและผู้รับเงินชดเชย · บวก = ได้รับจากกองทุนสุทธิ',
  other: 'ส่วนที่แบบจำลองไม่ได้แยก · บวก = ออกจากกองทุนสุทธิ',
  opening: 'คู่บัญชีของยอดยกมา ณ ต้นฉาก',
};

/** รายการหนึ่งรายการเป็นคำ · memo ของเครื่องยนต์บอกชนิดน้ำมันหรือบัญชี ส่วนทิศดูจาก from → to */
function entryText(e: Entry): string {
  const what = e.memo.split(' (')[0] as string;
  if (e.from === 'traders') return `${what}: ผู้ค้าส่งเงินเข้ากองทุน`;
  if (e.to === 'traders') return `${what}: กองทุนจ่ายชดเชยให้ผู้ค้า`;
  return what;
}

/** ค่าที่รายการนี้มาจาก เพื่อให้กดตามต่อได้ */
function entrySource(e: Entry, chain: Chain): SourceItem | undefined {
  if (e.week === 0) return e.from === 'fund.lpg' || e.to === 'fund.lpg' ? chain.openingLpg : chain.openingOil;
  const w = chain.weeks[e.week - 1];
  if (!w) return undefined;
  const pair = new Set([e.from, e.to]);
  if (pair.has('other')) return pair.has('fund.lpg') ? w.resLpg : w.resOil;
  return e.memo.includes('B7') ? w.b7 : e.memo.includes('95') ? w.g95 : undefined;
}

function Ledger({ g, chain }: { g: Game; chain: Chain }) {
  const entries = g.state.entries;
  let bal = emptyBalances();
  for (const e of entries) bal = post(bal, e);
  const sum = ledgerSum(bal);
  const matches = ACCOUNTS.every((a) => bal[a] === g.state.balances[a]);
  const lastWeek = entries.reduce((m, e) => Math.max(m, e.week), 0);
  const asOf = lastWeek === 0 ? openingDate(g.sc) : (chain.weeks[lastWeek - 1] as Week).sunday;
  const entryItem = (e: Entry, i: number): SourceItem => {
    const src = entrySource(e, chain);
    return mItem(e.amount, computed(`รายการบัญชีที่ ${i + 1}: ${entryText(e)} · จาก${ACCOUNT_NAME[e.from]} ไป${ACCOUNT_NAME[e.to]}`, 'จำนวนที่โอน (ไม่ติดลบ) = ขนาดของเงินรายการนี้ · ทิศจาก → ไป บอกว่าเงินเข้าหรือออกจากบัญชี', src ? [src] : undefined));
  };
  const items = entries.map(entryItem);
  const balItem = (a: Account): SourceItem =>
    mItem(
      bal[a],
      computed(
        `ยอดคงเหลือ ${ACCOUNT_NAME[a]} ณ ${thDate(asOf)}`,
        'เงินเข้าบัญชีนี้ทุกรายการ − เงินออกจากบัญชีนี้ทุกรายการ ในสมุดบัญชี',
        entries.flatMap((e, i) => (e.from === a || e.to === a ? [{ ...(items[i] as SourceItem), text: mbaht(e.to === a ? e.amount : -e.amount) }] : [])),
      ),
    );
  const balItems = ACCOUNTS.map(balItem);
  const sumItem: SourceItem = {
    text: int(sum),
    unit: 'สตางค์',
    ev: computed('ยอดรวมของทุกบัญชีในสมุดบัญชี คิดเป็นสตางค์', 'ผลรวมยอดคงเหลือของทั้งห้าบัญชี · ทุกรายการหักจากบัญชีหนึ่งและเพิ่มเข้าอีกบัญชีหนึ่งด้วยจำนวนเดียวกัน ผลรวมจึงต้องเป็นศูนย์ (ยอดแต่ละบัญชีที่แสดงปัดเป็นล้านบาท)', balItems),
  };
  const weeks = [...new Set(entries.map((e) => e.week))];
  return (
    <Panel id="mv-ledger" title="สมุดบัญชีสองด้าน" note={<>ณ <D iso={asOf} /></>}>
      <p class="caption">
        ทุกรายการโอนเงินจำนวนเดียวกันออกจากบัญชีหนึ่งเข้าอีกบัญชีหนึ่ง เงินจึงไม่เกิดขึ้นหรือหายไปเอง ยอดรวมทุกบัญชีต้องเป็นศูนย์ทุกงวด ถ้าไม่เป็นศูนย์แปลว่ามีเงินที่ลงไว้ด้านเดียว
      </p>
      <ul class="mv-accounts">
        {ACCOUNTS.map((a, i) => (
          <li>
            <span>
              <b>{ACCOUNT_NAME[a]}</b>
              <span class="caption">{ACCOUNT_NOTE[a]}</span>
            </span>
            <N x={balItems[i] as SourceItem} strong />
          </li>
        ))}
        <li class={`mv-zero${sum === 0 && matches ? '' : ' mv-zero--bad'}`} role={sum === 0 && matches ? undefined : 'alert'}>
          <span>
            <b>ยอดรวมทุกบัญชี</b>
            <span class="caption">{sum === 0 && matches ? 'ลงตัว: เงินทุกบาทมีทั้งด้านออกและด้านเข้า' : matches ? 'บัญชีไม่ลงตัว' : 'ยอดจากสมุดบัญชีไม่ตรงกับสถานะของเกม'}</span>
          </span>
          <N x={sumItem} strong />
        </li>
      </ul>
      <div class="mv-weeks">
        {weeks.map((wk) => {
          const list = entries.map((e, i) => ({ e, i })).filter((x) => x.e.week === wk);
          const w = chain.weeks[wk - 1];
          return (
            <details class="mv-details mv-week" open={wk === lastWeek}>
              <summary>
                {wk === 0 ? (
                  <>
                    ยอดยกมา · <D iso={openingDate(g.sc)} />
                  </>
                ) : (
                  <>
                    <Ord>ตา {wk}</Ord> · <DR a={g.sc.days[(wk - 1) * 7] as string} b={g.sc.days[(wk - 1) * 7 + 6] as string} />
                  </>
                )}
              </summary>
              <ol class="mv-entries">
                {list.map(({ e, i }) => (
                  <li>
                    <span class="mv-entry__what">{entryText(e)}</span>
                    <span class="mv-entry__flow caption">
                      {ACCOUNT_NAME[e.from]} <span aria-label="ไป">→</span> {ACCOUNT_NAME[e.to]}
                    </span>
                    <N x={items[i] as SourceItem} />
                  </li>
                ))}
              </ol>
              {w && (
                <p class="caption">
                  ฐานะรวมในเกมสิ้นตา <N x={w.fund} />
                </p>
              )}
            </details>
          );
        })}
      </div>
    </Panel>
  );
}
