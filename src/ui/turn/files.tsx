// ขั้นที่ 1 อ่านแฟ้ม: ปฏิทินของสัปดาห์ · บันทึกช็อก · เอกสารของตา · เอกสารบังคับ (ถ้าทุนใดหมด) · ทุน
import { guessTarget, maxSpecialMeetings, moneyGauge, timeAvailable } from '../../engine/game.ts';
import type { ContentFile, TemplateDoc } from '../../data/content-schema.ts';
import contentJson from '../../../content/oil-fund-2569/docs.json';
import type { Game } from '../../game/session.ts';
import type { FilesStepProps } from '../contracts.ts';
import { DocView } from '../doc.tsx';
import { computed, D, game, Num } from '../evidence.tsx';
import { int, mbaht, WEEKDAYS } from '../format.ts';
import { CAPITAL_LABEL, CapitalRow, Screen, type CapitalKey } from '../kit.tsx';
import { fundNow, shockItem, weekDays } from './common.tsx';

const content = contentJson as unknown as ContentFile;

/** เอกสารบังคับตามทุนที่หมด: อำนาจก่อน แล้วความเชื่อใจ แล้วมาตรเงิน */
function forcedBy(g: Game): { doc: TemplateDoc; k: CapitalKey } {
  if (g.state.authority === 0) return { doc: content.forced.authority, k: 'authority' };
  if (g.state.trust === 0) return { doc: content.forced.trust, k: 'trust' };
  return { doc: content.forced.money, k: 'money' };
}

/** แถบวันของสัปดาห์: จันทร์ = ประชุม กบน. ตามปกติ (ตั้งอัตรา) · อังคาร–อาทิตย์ นัดประชุมพิเศษได้ · อาทิตย์ = วันวัดผลที่ทาย */
export function WeekStrip({ g }: { g: Game }) {
  const days = weekDays(g);
  return (
    <div class="turn-week">
      <ol class="turn-days" aria-label="วันของสัปดาห์นี้">
        {days.map((iso, i) => (
          <li class={`turn-day${i === 0 ? ' turn-day--meet' : ''}${i === 6 ? ' turn-day--sun' : ''}`}>
            <span class="turn-day__wd">{i === 0 ? 'ลงมติ' : WEEKDAYS[i]}</span>
            <time dateTime={iso} class="turn-day__n">
              {Number(iso.slice(8))}
            </time>
            <span class="sr-only">{i === 0 ? 'ประชุม กบน. ตามปกติ ตั้งอัตรา' : i === 6 ? 'วันวัดผลที่ทาย' : 'นัดประชุมพิเศษได้'}</span>
          </li>
        ))}
      </ol>
      <p class="caption">
        ลงมติประชุม กบน. ตามปกติ <b class="nowrap">วันจันทร์</b> <D iso={days[0] as string} /> · นัดประชุมพิเศษให้มีผลวันอังคารถึงอาทิตย์ได้ · ราคาที่ทายคือของ
        <b class="nowrap"> วันอาทิตย์ </b>
        <D iso={days[6] as string} />
      </p>
    </div>
  );
}

export function FilesStep({ g, onNext }: FilesStepProps) {
  const p = g.state.params;
  const days = weekDays(g);
  const monday = days[0] as string;
  const weekly = content.weekly.filter((d) => d.turn === g.state.turn);
  const fund = fundNow(g);
  const fundItem = {
    text: mbaht(fund),
    ev: computed('ฐานะรวมของกองทุนในเกม ณ ต้นสัปดาห์ (บัญชีน้ำมัน + บัญชี LPG)', 'ยอดยกมาจริง ณ ต้นฉาก + เงินเข้าออกทุกตาตามบัญชีในเกม', undefined, [...g.sc.opening.fundOil.ids, ...g.sc.opening.fundLpg.ids]),
  };
  const forced = g.state.forcedDocNext ? forcedBy(g) : null;
  const docCount = 1 + weekly.length + (forced ? 1 : 0);
  const specials = maxSpecialMeetings(g.state);

  const main = (
    <>
      <div class="turn-head">
        <h2>แฟ้มบนโต๊ะ</h2>
        <span class="caption">
          <Num v={int(docCount)} unit="ฉบับ" ev={game('จำนวนเอกสารในแฟ้มตานี้', 'บันทึกช็อกของสัปดาห์ + เอกสารของตา + เอกสารบังคับ (ถ้ามี)')} /> · ทุกฉบับเป็นเอกสารจำลอง กดตัวเลขเพื่อดูที่มา
        </span>
      </div>
      <WeekStrip g={g} />
      <ul class="turn-tray" aria-label="เอกสารของตานี้">
        {forced && (
          <li class="turn-tray__item turn-tray__item--wide">
            <span class="turn-tag turn-tag--urgent">
              ใช้เวลา <Num v={int(p.forcedDocCost)} unit="ช่อง" ev={game('เวลาที่เอกสารบังคับใช้', 'ทุนใดลงถึง 0 (รวมมาตรเงิน) ตาถัดไปมีเอกสารบังคับที่ใช้เวลา 2 ช่อง (ค่าของเกม)')} />
            </span>
            <DocView doc={forced.doc} date={monday} slots={{ fundNet: fundItem }} />
            <p class="turn-note" role="note">
              เอกสารนี้มาเพราะ{forced.k === 'money' ? 'มาตรเงิน' : CAPITAL_LABEL[forced.k]}ของคุณลงถึง <Num v={int(0)} ev={game('ระดับทุนที่ทำให้เกิดเอกสารบังคับ', 'ทุนใดเหลือ 0 ช่อง ตาถัดไปมีเอกสารบังคับ (ค่าของเกม)')} /> ในตาที่แล้ว · การตอบใช้เวลาของสัปดาห์นี้{' '}
              <Num v={int(p.forcedDocCost)} unit="ช่อง" ev={game('เวลาที่เอกสารบังคับใช้', 'เอกสารบังคับใช้เวลา 2 ช่อง (ค่าของเกม)')} /> จึงนัดประชุมพิเศษได้ไม่เกิน{' '}
              <Num v={int(specials)} unit="ครั้ง" ev={game('จำนวนประชุมพิเศษที่นัดได้ตานี้', 'เวลาที่เหลือ ÷ เวลาต่อการประชุมพิเศษ ปัดลง (ค่าของเกม)')} />
            </p>
          </li>
        )}
        <li class="turn-tray__item">
          <DocView doc={content.shockMemo} date={monday} slots={{ shockPct: shockItem(g) }} />
        </li>
        {weekly.map((d) => (
          <li class="turn-tray__item">
            <DocView doc={d} date={d.date} />
          </li>
        ))}
      </ul>
    </>
  );

  const aside = (
    <>
      <div class="panel">
        <h3 class="panel__title">ทุนของคุณ</h3>
        <CapitalRow k="money" value={moneyGauge(fund, p)} max={p.capitalMax} />
        <CapitalRow k="authority" value={g.state.authority} max={p.capitalMax} />
        <CapitalRow k="trust" value={g.state.trust} max={p.capitalMax} />
        <CapitalRow k="time" value={timeAvailable(g.state)} max={p.timePerWeek} />
        <p class="caption">กดตัวเลขเพื่อดูกติกาของทุนแต่ละอย่าง · เวลาใช้กับการประชุมพิเศษในขั้นตั้งอัตรา</p>
      </div>
      <div class="panel turn-desktop">
        <h3 class="panel__title">สัปดาห์นี้</h3>
        <ul class="turn-list">
          <li>
            ช็อกราคา <Num v={shockItem(g).text} ev={shockItem(g).ev} strong /> จากบันทึก สกนช.
          </li>
          <li>
            ทายราคาดีเซล B7 วันอาทิตย์ <D iso={days[6] as string} /> ถ้าใช้อัตรา ณ ต้นฉาก
            {guessTarget(g.state, g.sc) === null && ' · ตานี้ไม่นับแต้ม เพราะราคาจริงวันนั้นไม่แน่นอน'}
          </li>
          <li>
            ตั้งอัตราในประชุมปกติวันจันทร์ <D iso={monday} /> · นัดประชุมพิเศษได้ไม่เกิน{' '}
            <Num v={int(specials)} unit="ครั้ง" ev={game('จำนวนประชุมพิเศษที่นัดได้ตานี้', 'เวลาที่เหลือ ÷ เวลาต่อการประชุมพิเศษ ปัดลง (ค่าของเกม)')} />
          </li>
        </ul>
      </div>
      <button type="button" class="btn btn--primary btn--block" onClick={onNext}>
        ไปทายผล
      </button>
    </>
  );

  return <Screen label="อ่านแฟ้ม" main={main} aside={aside} />;
}
