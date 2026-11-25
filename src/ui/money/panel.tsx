// แผงแบบหัวหมึก (DESIGN.md "Panels") และช่องตัวเลข (DESIGN.md "Stat Tiles") · ใช้ในแท็บเงินและแท็บปฏิทิน
import type { ComponentChildren } from 'preact';
import { Num, type SourceItem } from '../evidence.tsx';
import './money.css';

export function Panel({ id, title, note, children, class: cls = '' }: { id: string; title: string; note?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={`dk-panel ${cls}`} aria-labelledby={id}>
      <header class="dk-panel__head">
        <h3 id={id}>{title}</h3>
        {note && <span class="dk-panel__note">{note}</span>}
      </header>
      <div class="dk-panel__body">{children}</div>
    </section>
  );
}

export const N = ({ x, strong = false, class: cls }: { x: SourceItem; strong?: boolean; class?: string }) => (
  <Num v={x.text} {...(x.unit ? { unit: x.unit } : {})} ev={x.ev} strong={strong} {...(cls ? { class: cls } : {})} />
);

export function Tile({ label, x, sub }: { label: string; x: SourceItem; sub?: ComponentChildren }) {
  return (
    <li class="dk-tile">
      <p class="caption">{label}</p>
      <p class="dk-tile__v">
        <N x={x} strong />
      </p>
      {sub && <p class="caption">{sub}</p>}
    </li>
  );
}
