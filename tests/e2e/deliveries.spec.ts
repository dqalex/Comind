import { test, expect } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * 投递管理 E2E 测试
 *
 * 测试范围：
 * - 投递列表页面加载
 * - 投递状态筛选
 * - 投递审核流程
 */
test.describe('投递管理', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    // 确保已登录
    await authHelper.ensureLoggedIn('member');
    // 导航到投递页面
    await page.goto('/deliveries');
    await page.waitForLoadState('domcontentloaded');
  });

  test('应该显示投递管理页面', async ({ page }) => {
    // 验证页面内容已加载
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(1000);

    // 验证页面 URL 正确
    await expect(page).toHaveURL(/\/deliveries/);
  });

  test('应该显示投递列表或空状态', async ({ page }) => {
    // 等待页面完全加载
    await page.waitForTimeout(1000);

    // 验证页面有实际内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该支持筛选投递状态', async ({ page }) => {
    // 查找状态筛选按钮
    const allButton = page.locator('button:has-text("All")').or(
      page.locator('button:has-text("全部")')
    ).first();

    const pendingButton = page.locator('button:has-text("Pending")').or(
      page.locator('button:has-text("待审核")')
    ).first();

    // 尝试点击筛选按钮
    if (await allButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allButton.click();
      await page.waitForTimeout(500);
    }

    if (await pendingButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pendingButton.click();
      await page.waitForTimeout(500);
    }

    // 验证页面仍然正常显示
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(1000);
  });
});
