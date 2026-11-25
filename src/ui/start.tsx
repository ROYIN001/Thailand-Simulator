// หน้าเริ่ม: เกมใหม่ · เล่นต่อ · เล่นซ้ำด้วย seed เดิม · นำเข้าไฟล์เซฟ · การ์ดแบบจำลอง (สมมติฐานและสิ่งที่ตัดออก)
import { useState } from 'preact/hooks';
import { DEFAULT_PARAMS } from '../engine/params.ts';
import { newSave, parseSave, randomSeed, readStored, replay, scenario as sc, type Save } from '../game/session.ts';
import { DR, game, MarkLegend, Num, Ord } from './evidence.tsx';
import { baht, int, mbaht, pct } from './format.ts';

export function downloadSave(save: Save): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rattanava-save-${save.seed}-turn${save.inputs.length}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const P = DEFAULT_PARAMS;
const g = (label: string, why: string) => game(label, why);

export function StartScreen({ onStart }: { onStart: (s: Save) => void }) {
  const stored = readStored();
  const [seedText, setSeedText] = useState('');
  const [err, setErr] = useState<string | null>(stored && !stored.ok ? stored.error : null);
  const existing = stored?.ok ? stored.save : null;
  const playedTurns = existing ? replay(existing, sc).history.length : 0;

  const startNew = (seed: number) => {
    if (existing && !confirm('เริ่มเกมใหม่จะทับเซฟเดิมในเครื่อง ต้องการต่อหรือไม่ (ส่งออกไฟล์เซฟเก็บไว้ก่อนได้)')) return;
    onStart(newSave(seed));
  };
  const seedOk = /^\d{1,10}$/.test(seedText) && Number(seedText) <= 0xffffffff;

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_000_000) return setErr('ไฟล์เซฟใหญ่เกินไป');
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return setErr('ไฟล์นี้ไม่ใช่ JSON');
    }
    const r = parseSave(raw, sc);
    if (!r.ok) return setErr(r.error);
    if (existing && !confirm('นำเข้าไฟล์นี้จะทับเซฟเดิมในเครื่อง ต้องการต่อหรือไม่')) return;
    onStart(r.save);
  };

  return (
    <section class="screen" aria-label="หน้าเริ่ม" style={{ maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <div class="screen__main">
        <div class="panel">
          <h1 style={{ fontSize: '24px' }}>ที่นั่ง กบน. · วิกฤตกองทุนน้ำมัน</h1>
          <p>
            คุณเป็นคณะกรรมการบริหารกองทุนน้ำมันเชื้อเพลิง (กบน.) ช่วง <DR a={sc.days[0] as string} b={sc.days[sc.days.length - 1] as string} /> ซึ่งราคาน้ำมันโลกพุ่งขึ้นหลังความขัดแย้งในตะวันออกกลาง
            ทุกสัปดาห์คุณตั้งอัตราเงินกองทุนของดีเซล B7 และแก๊สโซฮอล์ 95 ว่าจะชดเชยหรือเก็บเข้ากองทุนเท่าไร แล้วดูว่าราคาหน้าปั๊มและฐานะกองทุนเป็นอย่างไร
          </p>
          <p>
            เล่น <Num v={int(sc.weeks)} unit="ตา" ev={g('จำนวนตาของฉาก', 'ตาละหนึ่งสัปดาห์ จันทร์ถึงอาทิตย์ (กติกาของเกม)')} /> ราว{' '}
            <Num v="15–25" unit="นาที" ev={g('เวลาเล่นโดยประมาณ', 'ประมาณการของเกม ยังไม่ได้วัดกับผู้เล่น')} /> · ทุกตา: อ่านแฟ้ม → ทายราคา → ตั้งอัตรา → ดูผล → ตามเงิน
          </p>
          <p class="caption">
            เกมนี้เป็นการจำลองเพื่อการเรียนรู้ เอกสารในเกมทุกฉบับเป็นเอกสารจำลอง · ค่าจริงแสดงคู่กันเป็นเส้นอ้างอิง ไม่ใช่เกณฑ์ให้คะแนน · การชดเชยและการปล่อยราคามีราคาทั้งสองทาง เกมไม่ตัดสินว่าทางใดถูก
          </p>
          <MarkLegend />
          {err && (
            <p role="alert" style={{ color: 'var(--negative)' }}>
              {err}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {existing && (
              <button type="button" class="btn btn--primary" onClick={() => onStart(existing)}>
                เล่นต่อ · <Ord>เล่นแล้ว {playedTurns} ตา</Ord>
              </button>
            )}
            <button type="button" class={`btn ${existing ? 'btn--secondary' : 'btn--primary'}`} onClick={() => startNew(randomSeed())}>
              เริ่มเกมใหม่
            </button>
          </div>
          <form
            style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (seedOk) startNew(Number(seedText));
            }}
          >
            <label for="seed">เล่นด้วย seed ที่กำหนด (ช็อกราคาเหมือนเดิมทุกครั้ง)</label>
            <input
              id="seed"
              inputMode="numeric"
              autocomplete="off"
              value={seedText}
              onInput={(e) => setSeedText((e.target as HTMLInputElement).value.trim())}
              style={{ width: '150px', minHeight: '44px', border: '1.5px solid var(--ink)', borderRadius: '10px', padding: '0 10px' }}
            />
            <button type="submit" class="btn btn--quiet" disabled={!seedOk}>
              เริ่มด้วย seed นี้
            </button>
          </form>
          <label class="btn btn--quiet" style={{ alignSelf: 'flex-start' }}>
            นำเข้าไฟล์เซฟ
            <input type="file" accept="application/json,.json" class="sr-only" onChange={(e) => onImport((e.target as HTMLInputElement).files?.[0])} />
          </label>
        </div>
        <ModelCard />
      </div>
    </section>
  );
}

/** การ์ดแบบจำลอง: สมมติฐานที่เป็นค่าของเกม และสิ่งที่ตัดออกโดยตั้งใจ (docs/rattanava-engine-a.md หัวข้อ 6–7) */
function ModelCard() {
  return (
    <details class="panel">
      <summary style={{ font: '600 16px/1.3 var(--f-display)', minHeight: '32px', cursor: 'pointer' }}>การ์ดแบบจำลอง: เกมคิดอย่างไร และตัดอะไรออก</summary>
      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <li>ฐานะกองทุนเริ่มจากค่าจริง ณ ต้นฉากและเดินตามการเปลี่ยนแปลงจริงรายสัปดาห์ เกมคิดใหม่เฉพาะเงินของดีเซล B7 และแก๊สโซฮอล์ 95 จากอัตราที่คุณตั้ง × ปริมาณ ส่วนที่เหลือลงเป็น "รายการอื่นตามงบจริง"</li>
        <li>
          ราคาในเกม = ราคาจริงที่ปรับด้วยช็อกของสัปดาห์ + (อัตราของคุณ − อัตราจริง) ×{' '}
          <Num v="1.07" ev={{ kind: 'computed', label: 'ตัวคูณภาษีมูลค่าเพิ่มบนเงินกองทุน', formula: sc.vatBp.note ?? '', ids: sc.vatBp.ids }} /> · ช็อกสุ่มไม่เกิน{' '}
          <Num v={pct(P.shockMaxBp, false)} ev={g('ขอบของช็อกราคาต่อสัปดาห์', 'สุ่มสม่ำเสมอด้วย seed ของเกม')} />
        </li>
        <li>
          ปริมาณการใช้ลดเมื่อราคาสูงขึ้น ด้วยความยืดหยุ่น <Num v={baht(P.elasticityBp / 100)} ev={g('ความยืดหยุ่นของปริมาณต่อราคา', 'ยังไม่มีค่าที่ตรวจแล้ว ใช้ค่ากลางของสามชุดที่ทดลองได้ (−0.10 · −0.20 · −0.30)')} /> แบบเส้นตรง
        </li>
        <li>
          อำนาจเสียหนึ่งช่องทุก <Num v={mbaht(P.authorityStepSatang)} unit="ล้านบาท" ev={g('ขั้นของอำนาจ', 'ฐานะรวมของกองทุนลดในสัปดาห์ (ราคาของการชดเชย)')} /> ที่ฐานะกองทุนลดในสัปดาห์ · ความเชื่อใจเสียเมื่อราคาดีเซล B7 ในเกมเกิน{' '}
          <Num v={baht(P.trustB7LevelSatang)} unit="บาท/ลิตร" ev={{ kind: 'game', label: 'ระดับที่ความเชื่อใจเริ่มลด', formula: 'ใช้ระดับเดียวกับเงื่อนไขการใช้กองทุนในกรอบนโยบาย กพช. 2562 แต่การใช้เป็นเกณฑ์ความเชื่อใจเป็นการตีความของเกม', ids: ['policy.nepc_framework_2562.diesel_crisis_threshold'] }} /> หรือแก๊สโซฮอล์ 95 สูงกว่าเส้นฐานเกิน{' '}
          <Num v={baht(P.trustG95OverBaseSatang)} unit="บาท/ลิตร" ev={g('ระดับแก๊สโซฮอล์ 95 ที่ความเชื่อใจเริ่มลด', 'ราคาของการเก็บเงินผู้ใช้เบนซินเพื่อจ่ายชดเชย')} /> · ทั้งสองฟื้นเมื่อไม่เสียติดกัน{' '}
          <Num v={int(P.recoverAfterCleanWeeks)} unit="สัปดาห์" ev={g('การฟื้นของทุน', 'ฟื้นครั้งละ 1 ช่อง')} />
        </li>
        <li>ทั้งการชดเชยมากและการปล่อยราคาขึ้นมีราคาต่อทุน เพื่อไม่ให้กติกาเอียงไปทางนโยบายใด · ระดับทั้งหมดเป็นค่าของเกม ยังไม่มีหลักฐานรองรับ</li>
      </ul>
      <p style={{ font: '600 15px/1.3 var(--f-display)' }}>ตัดออกโดยตั้งใจ</p>
      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <li>ไม่มีกลไกรัฐประหาร และไม่มีฉากจบที่บอกว่าอุดมการณ์ใดถูก</li>
        <li>ไม่มีที่นั่งอื่น: มติ ครม. กบง. และคลังมาเป็นเอกสารตามลำดับเหตุการณ์จริงเท่านั้น</li>
        <li>ไม่มีเงินกู้ เงินสด หรือยอดค้างจ่าย · ไม่จำลองน้ำมันชนิดอื่น · ไม่มีผลต่อเงินเฟ้อหรือผลรายจังหวัด · ไม่มีการซื้อตุนก่อนราคาขึ้น</li>
      </ul>
    </details>
  );
}
