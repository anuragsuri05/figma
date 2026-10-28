import { defineConfig } from '@playwright/test';

// Tests the packaged desktop app (run after `npm run dist:mac`).
export default defineConfig({
  testDir: './tests/desktop',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
});
