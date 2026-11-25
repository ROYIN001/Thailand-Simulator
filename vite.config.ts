import { defineConfig } from 'vitest/config';

// base './' ให้เปิดจากโฟลเดอร์ย่อยได้ (GitHub Pages ของ repo และหน้าทดสอบ)
export default defineConfig({
  base: './',
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: { target: 'es2022' },
  test: { environment: 'node' },
});
