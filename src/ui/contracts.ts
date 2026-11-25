// สัญญาระหว่างโครงแอป (src/ui/App.tsx) กับจอของแต่ละโฟลเดอร์ · เปลี่ยนต้องแก้ทั้งสองฝั่งพร้อมกัน
// กติกาเรื่องเวลา: จอทุกจอต้องไม่แสดงค่าจริงหรือค่าเส้นฐานของวันที่ยังไม่ถึง (ตาที่ยังไม่เล่น และวันในตาปัจจุบันก่อนเห็นผล)
// เพราะเส้นฐานวันอาทิตย์ของตาปัจจุบันคือคำตอบของการทาย · ใช้ g.played และ g.baselinePlayed ซึ่งตัดไว้แล้ว
import type { RateSegment, Report, TurnRecord } from '../engine/game.ts';
import type { Game } from '../game/session.ts';
import type { SourceItem } from './evidence.tsx';

export type FilesStepProps = { g: Game; onNext: () => void };
/** onLock: ล็อกคำทาย (สตางค์/ลิตร) แล้วไปตั้งอัตรา · ล็อกแล้วแก้ไม่ได้ */
export type GuessStepProps = { g: Game; onLock: (guessSatang: number) => void; onBack: () => void };
/** onSubmit: ลงมติ · segments[0].fromDay ต้องเป็น 0 (ประชุมปกติวันจันทร์) · ตรวจกับ rateFloor และ maxSpecialMeetings ก่อนส่ง */
export type RatesStepProps = { g: Game; guess: number; onSubmit: (segments: RateSegment[]) => void };
/** record = ตาที่เพิ่งเล่น · baseline = ตาเดียวกันของเส้นฐาน · onMoney = ไปแท็บเงิน */
export type ResultStepProps = { g: Game; record: TurnRecord; baseline: TurnRecord; onNext: () => void; onMoney: () => void };
export type EndReportProps = { g: Game; report: Report; onNewGame: () => void; onExport: () => void };
export type ViewProps = { g: Game };
export type SourceSheetProps = { item: SourceItem; onClose: () => void };
