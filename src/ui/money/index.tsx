// โฟลเดอร์ของ agent แท็บเงิน · ไฟล์นี้เป็นตัวแทนชั่วคราว
import type { ViewProps } from '../contracts.ts';

export const MoneyView = ({ g }: ViewProps) => <section class="panel" aria-label="เงิน">แท็บเงิน {g.played.length ? "" : ""}</section>;
