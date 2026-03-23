import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 截图专用配置
 * 
 * 用途：为产品文档生成高质量截图
 * 运行：npx tsx scripts/generate-screenshots.ts
 */
export default defineConfig({
  testDir: './tests/screenshots',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // 单线程，确保截图顺序
  reporter: [
    ['html', { open: 'never', outputFolder: 'tests/reports/screenshots' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    screenshot: 'on', // 每个测试都截图
    video: 'off',
    // 截图质量设置
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // 高 DPI 截图
  },
  projects: [
    {
      name: 'chromium-screenshot',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: 'PLAYWRIGHT_TEST=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
