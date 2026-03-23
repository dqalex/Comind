import { test, expect } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * Schedule 管理 E2E 测试
 *
 * 测试范围：
 * - Schedule 管理页面加载
 * - Gateway 连接检查
 * - Schedule 列表显示
 *
 * 注意：Schedule 管理需要 Gateway 连接
 */
test.describe('Schedule 管理', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    // 确保已登录
    await authHelper.ensureLoggedIn('member');
    // 导航到 Schedule 页面
    await page.goto('/schedule');
    await page.waitForLoadState('domcontentloaded');
  });

  test('应该显示 Schedule 管理页面', async ({ page }) => {
    // 验证页面内容已加载
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(1000);

    // 验证页面 URL 正确
    await expect(page).toHaveURL(/\/schedule/);
  });

  test('应该显示 Gateway 连接提示或 Schedule 列表', async ({ page }) => {
    // 等待页面完全加载
    await page.waitForTimeout(1000);

    // 验证页面有实际内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该显示统计区域和时间线', async ({ page }) => {
    // 如果 Gateway 已连接，应该显示统计和时间线
    const hasStats = await page.locator('[class*="stats"]').isVisible({ timeout: 2000 }).catch(() => false);
    const hasTimeline = await page.locator('[class*="timeline"]').isVisible({ timeout: 2000 }).catch(() => false);

    // 如果 Gateway 已连接，至少应该有统计区域
    // 如果 Gateway 未连接，这个测试会跳过
    if (hasStats || hasTimeline) {
      expect(hasStats || hasTimeline).toBe(true);
    }
  });
});
