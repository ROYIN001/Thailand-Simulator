// โฟลเดอร์ของ agent แผ่นที่มาของตัวเลข · ไฟล์นี้เป็นตัวแทนชั่วคราว
import type { SourceSheetProps } from '../contracts.ts';
import { Sheet } from '../kit.tsx';

export const SourceSheet = ({ item, onClose }: SourceSheetProps) => (
  <Sheet title="ที่มาของตัวเลข" onClose={onClose}>
    <p>{item.ev.label}</p>
  </Sheet>
);
