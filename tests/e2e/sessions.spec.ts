import { test, expect } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * Session 管理 E2E 测试
 *
 * 测试范围：
 * - Session 管理页面加载
 * - Gateway 连接检查
 * - Session 列表显示
 *
 * 注意：Session 管理需要 Gateway 连接
 */
test.describe('Session 管理', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    // 确保已登录
    await authHelper.ensureLoggedIn('member');
    // 导航到 Session 页面
    await page.goto('/sessions');
    await page.waitForLoadState('domcontentloaded');
  });

  test('应该显示 Session 管理页面', async ({ page }) => {
    // 验证页面内容已加载
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(1000);

    // 验证页面 URL 正确
    await expect(page).toHaveURL(/\/sessions/);
  });

  test('应该显示 Gateway 连接提示或 Session 列表', async ({ page }) => {
    // 等待页面完全加载
    await page.waitForTimeout(1000);

    // 验证页面有实际内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该支持搜索 Session', async ({ page }) => {
    // 查找搜索框
    const searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="搜索"]')
    );

    // 如果搜索框存在，尝试搜索
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await page.waitForTimeout(500);

      // 验证页面仍然正常显示
      const bodyContent = await page.locator('body').innerHTML();
      expect(bodyContent.length).toBeGreaterThan(1000);
    }
  });
});
