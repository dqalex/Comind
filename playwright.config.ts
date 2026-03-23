import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 
 * 运行命令：
 * - npx playwright test          # 运行所有测试
 * - npx playwright test --headed # 有头模式
 * - npx playwright test --debug  # 调试模式
 * - npx playwright show-report   # 查看报告
 */
export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['teamclaw-e2e.spec.ts', 'e2e-flow.spec.ts'], // 排除非标准 Playwright 测试脚本
  fullyParallel: false, // 禁用完全并行，避免 rate limit
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // 失败后重试
  workers: 2, // 限制并发数为 2，避免触发限流
  reporter: [
    ['html', { open: 'never', outputFolder: 'tests/reports/e2e' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'PLAYWRIGHT_TEST=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
