// โครงแอป: เก็บเซฟ เรียกเครื่องยนต์ สลับขั้นในตาและแท็บ · จอแต่ละจออยู่ในโฟลเดอร์ของตัวเอง (contracts.ts)
import { useMemo, useState } from 'preact/hooks';
import { isFinished, moneyGauge, report, submitTurn, timeAvailable, type RateSegment, type TurnRecord } from '../engine/game.ts';
import { parseFixture } from '../game/fixtures.ts';
import { baselineFor, makeGame, readStored, replay, scenario as sc, writeStored, type Phase, type Save } from '../game/session.ts';
import { CalendarView } from './calendar/index.tsx';
import { computed, DR, game, MarkLegend, Num, Ord, SourceContext, type SourceItem } from './evidence.tsx';
import { mbaht } from './format.ts';
import { CapitalRow, StepBar } from './kit.tsx';
import { MoneyView } from './money/index.tsx';
import { EndReport, ResultStep } from './result/index.tsx';
import { downloadSave, StartScreen } from './start.tsx';
import { SourceSheet } from './trace/index.tsx';
import { FilesStep, GuessStep, RatesStep } from './turn/index.tsx';

type Tab = 'desk' | 'money' | 'calendar';
const TABS: [Tab, string][] = [
  ['desk', 'โต๊ะ'],
  ['money', 'เงิน'],
  ['calendar', 'ปฏิทิน'],
];
const STEP_OF: Record<Phase, number> = { files: 0, guess: 1, rates: 2, result: 3, end: 4 };

function initial(fixture: string | null): { save: Save | null; error: string | null } {
  if (fixture) {
    const save = parseFixture(fixture);
    return save ? { save, error: null } : { save: null, error: `ไม่รู้จักสถานะตัวอย่าง ${fixture}` };
  }
  const stored = readStored();
  if (!stored) return { save: null, error: null };
  return stored.ok ? { save: stored.save, error: null } : { save: null, error: `โหลดเซฟในเครื่องไม่ได้: ${stored.error}` };
}

/** fixture = สถานะตัวอย่าง เช่น "4-guess" (ไม่แตะเซฟในเครื่อง ใช้ตรวจหน้าจอและเทสต์) · main.tsx ส่งมาจาก ?fixture= และ ?tab= */
export function App({ fixture = null, initialTab = 'desk' }: { fixture?: string | null; initialTab?: string }) {
  const [{ save, error }, setBoot] = useState(() => initial(fixture));
  const [tab, setTab] = useState<Tab>(TABS.find(([t]) => t === initialTab)?.[0] ?? 'desk');
  const [source, setSource] = useState<SourceItem | null>(null);
  const [notice, setNotice] = useState<string | null>(error);

  const state = useMemo(() => (save ? replay(save, sc) : null), [save?.seed, save?.inputs.length]);
  const baseline = useMemo(() => (save ? baselineFor(save, sc) : null), [save?.seed]);

  const update = (next: Save) => {
    if (!fixture && !writeStored(next)) setNotice('เบราว์เซอร์ไม่ให้บันทึกในเครื่อง ความคืบหน้าจะหายเมื่อปิดหน้า · ใช้ "ส่งออกไฟล์เซฟ" เก็บไว้เอง');
    setBoot({ save: next, error: null });
  };

  const body = (() => {
    if (!save || !state || !baseline)
      return (
        <StartScreen
          onStart={(s) => {
            update(s);
            setTab('desk');
          }}
        />
      );
    const g = makeGame(sc, save, state, baseline);
    if (tab === 'money') return <MoneyView g={g} />;
    if (tab === 'calendar') return <CalendarView g={g} />;
    const last = state.history[state.history.length - 1] as TurnRecord;
    const step = (() => {
      switch (save.phase) {
        case 'files':
          return <FilesStep g={g} onNext={() => update({ ...save, phase: 'guess' })} />;
        case 'guess':
          return <GuessStep g={g} onLock={(guess) => update({ ...save, phase: 'rates', guess })} onBack={() => update({ ...save, phase: 'files' })} />;
        case 'rates':
          return (
            <RatesStep
              g={g}
              guess={save.guess as number}
              onSubmit={(segments: RateSegment[]) => {
                const input = { guessSatang: save.guess as number, segments };
                try {
                  submitTurn(state, sc, input); // ตรวจก่อนบันทึก · เครื่องยนต์ปฏิเสธอัตราที่ผิดกติกา
                } catch (e) {
                  setNotice(`ลงมติไม่ได้: ${(e as Error).message}`);
                  return;
                }
                update({ ...save, inputs: [...save.inputs, input], phase: 'result', guess: null });
              }}
            />
          );
        case 'result':
          return (
            <ResultStep
              g={g}
              record={last}
              baseline={baseline.history[last.turn - 1] as TurnRecord}
              onNext={() => update({ ...save, phase: isFinished(state, sc) ? 'end' : 'files' })}
              onMoney={() => setTab('money')}
            />
          );
        case 'end':
          return <EndReport g={g} report={report(state, sc)} onNewGame={() => setBoot({ save: null, error: null })} onExport={() => downloadSave(save)} />;
      }
    })();
    return (
      <>
        {save.phase !== 'end' && <StepBar current={STEP_OF[save.phase]} />}
        {step}
      </>
    );
  })();

  return (
    <SourceContext.Provider value={setSource}>
      <div class="app">
        <TopBar save={save} onMenu={() => setBoot({ save: null, error: null })} />
        {save && (
          <nav class="tabs" role="tablist" aria-label="มุมมอง">
            {TABS.map(([t, name]) => (
              <button type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {name}
              </button>
            ))}
          </nav>
        )}
        <main class="main">
          {notice && (
            <div class="panel" role="alert" style={{ background: 'var(--subsidy-tint)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{notice}</span>
              <button type="button" class="btn btn--quiet" onClick={() => setNotice(null)}>
                รับทราบ
              </button>
            </div>
          )}
          {body}
        </main>
        {source && <SourceSheet item={source} onClose={() => setSource(null)} />}
      </div>
    </SourceContext.Provider>
  );
}

/** แถบบน: ตาและช่วงวันที่ · ทุน 4 อย่าง · ฐานะกองทุนในเกม · ปุ่มเมนู */
function TopBar({ save, onMenu }: { save: Save | null; onMenu: () => void }) {
  const state = save ? replay(save, sc) : null;
  if (!save || !state)
    return (
      <header class="topbar">
        <div class="topbar__in">
          <span class="wordmark">รัฐนาวา</span>
          <span class="muted">ที่นั่ง กบน. · ฉากกองทุนน้ำมัน</span>
        </div>
      </header>
    );
  const shown = save.phase === 'result' || save.phase === 'end' ? state.history.length : state.turn; // ตาที่จอกำลังพูดถึง
  const start = sc.days[(shown - 1) * 7] as string;
  const end = sc.days[(shown - 1) * 7 + 6] as string;
  const fund = state.balances['fund.oil'] + state.balances['fund.lpg'];
  const p = state.params;
  const deciding = save.phase === 'files' || save.phase === 'guess' || save.phase === 'rates';
  return (
    <header class="topbar">
      <div class="topbar__in">
        <span class="wordmark">รัฐนาวา</span>
        <span style={{ font: '600 15px/1.3 var(--f-display)' }}>
          <Ord>ตา {shown}</Ord> จาก <Ord>{sc.weeks}</Ord> · <DR a={start} b={end} />
        </span>
        <span>
          ฐานะกองทุนในเกม{' '}
          <Num
            v={mbaht(fund)}
            unit="ล้านบาท"
            strong
            ev={computed('ฐานะรวมของกองทุนในเกม (บัญชีน้ำมัน + บัญชี LPG)', 'ยอดยกมาจริง ณ 1 มี.ค. 2569 + เงินเข้าออกทุกตาตามบัญชีในเกม', undefined, ['fund.position.oil.2026-03-01', 'fund.position.lpg.2026-03-01'])}
          />
        </span>
        <details class="topbar__capitals" style={{ marginLeft: 'auto' }}>
          <summary class="btn btn--quiet" style={{ listStyle: 'none' }}>
            ทุน · เมนู
          </summary>
          <div class="panel" style={{ position: 'absolute', right: '16px', zIndex: 10, width: 'min(360px, calc(100vw - 32px))' }}>
            <CapitalRow k="money" value={moneyGauge(fund, p)} max={p.capitalMax} />
            <CapitalRow k="authority" value={state.authority} max={p.capitalMax} />
            <CapitalRow k="trust" value={state.trust} max={p.capitalMax} />
            {deciding && <CapitalRow k="time" value={timeAvailable(state)} max={p.timePerWeek} />}
            <p class="caption">
              seed ของเกมนี้ <Num v={String(save.seed)} ev={game('seed ของเกม', 'ตัวเลขตั้งต้นของช็อกราคาทุกตา · seed เดียวกันกับการตัดสินใจชุดเดียวกันให้ผลเหมือนเดิม')} />
            </p>
            <MarkLegend />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" class="btn btn--quiet" onClick={() => downloadSave(save)}>
                ส่งออกไฟล์เซฟ
              </button>
              <button type="button" class="btn btn--quiet" onClick={onMenu}>
                หน้าเริ่ม
              </button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
