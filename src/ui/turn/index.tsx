// โฟลเดอร์ของ agent จอในตา (แฟ้ม ทาย ตั้งอัตรา) · ไฟล์นี้เป็นตัวแทนชั่วคราวจนกว่าจอจริงจะเสร็จ
import type { FilesStepProps, GuessStepProps, RatesStepProps } from '../contracts.ts';

export const FilesStep = ({ onNext }: FilesStepProps) => <button type="button" class="btn btn--primary" onClick={onNext}>ไปทายผล</button>;
export const GuessStep = ({ onLock, g }: GuessStepProps) => <button type="button" class="btn btn--primary" onClick={() => onLock(g.sc.b7[0]?.retail.v ?? 0)}>ล็อกคำทาย</button>;
export const RatesStep = ({ onSubmit, g }: RatesStepProps) => (
  <button type="button" class="btn btn--primary" onClick={() => onSubmit([{ fromDay: 0, b7: g.state.rates.b7, g95: g.state.rates.g95 }])}>ลงมติ</button>
);
