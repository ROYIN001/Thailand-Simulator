// โฟลเดอร์ของ agent แท็บปฏิทิน · ไฟล์นี้เป็นตัวแทนชั่วคราว
import type { ViewProps } from '../contracts.ts';

export const CalendarView = ({ g }: ViewProps) => <section class="panel" aria-label="ปฏิทิน">แท็บปฏิทิน {g.played.length ? "" : ""}</section>;
