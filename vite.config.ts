import { defineConfig } from 'vite';

// 相對路徑，GitHub Pages 的 /<repo>/ 子路徑也能用
export default defineConfig({
  base: './',
  test: { environment: 'node' },
} as any);
