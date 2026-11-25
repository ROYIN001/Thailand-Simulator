// โฟลเดอร์ของ agent จอผลสัปดาห์และบัตรรายงานตอนจบ · ไฟล์นี้เป็นตัวแทนชั่วคราว
import type { EndReportProps, ResultStepProps } from '../contracts.ts';

export const ResultStep = ({ onNext }: ResultStepProps) => <button type="button" class="btn btn--primary" onClick={onNext}>ไปตาถัดไป</button>;
export const EndReport = ({ onNewGame }: EndReportProps) => <button type="button" class="btn btn--primary" onClick={onNewGame}>เล่นใหม่</button>;
