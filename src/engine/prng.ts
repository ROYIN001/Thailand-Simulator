// PRNG ของ repo: splitmix32 ขยาย seed แล้วใช้ sfc32 · ใช้แต่การดำเนินการ 32 บิตที่ผลเหมือนกันทุกเบราว์เซอร์

export type Rng = { nextU32: () => number };

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function createRng(seed: number): Rng {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error(`seed ต้องเป็นจำนวนเต็ม 0–4294967295: ${seed}`);
  const sm = splitmix32(seed);
  let a = sm(), b = sm(), c = sm(), d = sm();
  const nextU32 = (): number => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t;
  };
  for (let i = 0; i < 12; i++) nextU32();
  return { nextU32 };
}

/** จำนวนเต็มสุ่มสม่ำเสมอในช่วง [lo, hi] ด้วยการปฏิเสธค่าที่ทำให้เอียง */
export function intInRange(rng: Rng, lo: number, hi: number): number {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || hi < lo || hi - lo >= 0xffffffff) throw new Error('ช่วงสุ่มไม่ถูกต้อง');
  const span = hi - lo + 1;
  const limit = 0x100000000 - (0x100000000 % span);
  let x = rng.nextU32();
  while (x >= limit) x = rng.nextU32();
  return lo + (x % span);
}
