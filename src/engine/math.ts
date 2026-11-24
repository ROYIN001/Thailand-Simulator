// เลขจำนวนเต็มของเครื่องยนต์ · กฎการปัดเดียว: ตัดเศษเข้าหาศูนย์ (แบบ Math.trunc) ผ่านการหารของ BigInt

export function assertSafe(n: number, what = 'ค่า'): number {
  if (!Number.isSafeInteger(n)) throw new Error(`${what} ไม่ใช่จำนวนเต็มที่ปลอดภัย: ${n}`);
  return n;
}

/** trunc(a × b ÷ c) โดยไม่ล้นระหว่างทาง */
export function mulDiv(a: number, b: number, c: number): number {
  assertSafe(a, 'mulDiv a');
  assertSafe(b, 'mulDiv b');
  assertSafe(c, 'mulDiv c');
  if (c === 0) throw new Error('mulDiv หารด้วยศูนย์');
  return assertSafe(Number((BigInt(a) * BigInt(b)) / BigInt(c)), 'ผล mulDiv');
}

export function mul(a: number, b: number): number {
  return assertSafe(Number(BigInt(assertSafe(a)) * BigInt(assertSafe(b))), 'ผลคูณ');
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
