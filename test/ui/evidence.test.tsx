// ทุกตัวเลขบนจอมีป้ายที่มา: เรนเดอร์ทุกขั้นของตาตัวอย่างและทุกแท็บ แล้วหาตัวเลขที่หลุดป้าย
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { FIXTURE_KEYS } from '../../src/game/fixtures.ts';
import { App } from '../../src/ui/App.tsx';
import { unlabeledDigits } from './evidence-check.ts';

describe('ตัวตรวจป้ายที่มา', () => {
  it('จับตัวเลขที่หลุดป้าย และยอมรับตัวเลขที่มีป้าย วันที่ ลำดับ ชื่อเฉพาะ', () => {
    expect(unlabeledDigits('<p>ราคา 55.80 บาท</p>')).toHaveLength(1);
    expect(unlabeledDigits('<p>ราคา <button data-ev="real"><span>55.80</span></button> ดีเซล B7 <time>23 มี.ค. 2569</time> <span data-ord="">ตา 4</span></p>')).toEqual([]);
    expect(unlabeledDigits('<svg><text data-axis="">30</text><text>40</text></svg>')).toHaveLength(1);
  });
});

describe('ทุกตัวเลขบนจอมีป้ายที่มา', () => {
  it('หน้าเริ่ม', () => {
    expect(unlabeledDigits(render(<App />))).toEqual([]);
  });
  for (const key of FIXTURE_KEYS)
    for (const tab of ['desk', 'money', 'calendar'])
      it(`${key} · ${tab}`, () => {
        expect(unlabeledDigits(render(<App fixture={key} initialTab={tab} />))).toEqual([]);
      });
});
