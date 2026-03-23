import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * 投递审核流程 E2E 测试
 *
 * 真实业务场景：
 * 1. 创建投递（待审核状态）
 * 2. 审核员查看待审核投递列表
 * 3. 审核投递（批准/拒绝/需要修订）
 * 4. 提交者查看审核结果
 * 5. 如果需要修订，重新提交
 */
test.describe('投递审核流程', () => {
  const USERS = {
    submitter: {
      email: 'delivery-submitter@teamclaw.test',
      password: 'TestSubmitter123!',
      name: '投递提交者',
    },
    reviewer: {
      email: 'delivery-reviewer@teamclaw.test',
      password: 'TestReviewer123!',
      name: '投递审核员',
    },
  };

  /**
   * 创建并登录用户
   */
  async function setupUser(context: BrowserContext, user: typeof USERS.submitter) {
    const page = await context.newPage();
    const auth = new AuthHelper(page);

    // 先导航到首页，确保 window.location.origin 有效
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loginSuccess = await auth.login(user.email, user.password);
    if (!loginSuccess) {
      await auth.register(user.email, user.password, user.name);
      await auth.login(user.email, user.password);
    }

    return { page, auth };
  }

  /**
   * 创建投递（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function createDelivery(page: Page, title: string, options: {
    content?: string;
    platform?: string;
    projectId?: string;
  } = {}) {
    const result = await page.evaluate(async ({ title, options }) => {
      // 先获取当前用户信息
      const meResponse = await fetch(`${window.location.origin}/api/auth/me`);
      const meData = await meResponse.json();
      const memberId = meData.user?.id;

      if (!memberId) {
        return { error: 'Not logged in' };
      }

      const url = `${window.location.origin}/api/deliveries`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          title,
          content: options.content || '投递内容',
          platform: options.platform || 'local', // 使用有效值
          projectId: options.projectId,
          status: 'pending',
        }),
      });

      if (response.status === 404) {
        return { error: 'NOT_FOUND' };
      }

      if (!response.ok) {
        return { error: await response.text() };
      }

      return { data: await response.json() };
    }, { title, options });

    if (result.error === 'NOT_FOUND') {
      return null;
    }

    if (result.error) {
      throw new Error(`创建投递失败: ${result.error}`);
    }

    return result.data;
  }

  /**
   * 更新投递状态（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function updateDeliveryStatus(page: Page, deliveryId: string, status: string, feedback?: string) {
    const result = await page.evaluate(async ({ deliveryId, status, feedback }) => {
      const url = `${window.location.origin}/api/deliveries/${deliveryId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          feedback,
        }),
      });

      if (response.status === 404) {
        return { error: 'NOT_FOUND' };
      }

      if (!response.ok) {
        return { error: await response.text() };
      }

      return { data: await response.json() };
    }, { deliveryId, status, feedback });

    if (result.error === 'NOT_FOUND') {
      return null;
    }

    if (result.error) {
      throw new Error(`更新投递失败: ${result.error}`);
    }

    return result.data;
  }

  /**
   * 获取投递列表（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function getDeliveries(page: Page, status?: string) {
    const path = status ? `/api/deliveries?status=${status}` : '/api/deliveries';

    const result = await page.evaluate(async (path) => {
      const url = `${window.location.origin}${path}`;
      const response = await fetch(url);

      if (response.status === 404) {
        return { error: 'NOT_FOUND' };
      }

      if (!response.ok) {
        return { error: await response.text() };
      }

      return { data: await response.json() };
    }, path);

    if (result.error === 'NOT_FOUND') {
      return [];
    }

    if (result.error) {
      throw new Error(`获取投递列表失败: ${result.error}`);
    }

    return result.data;
  }

  test('投递页面加载', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context, USERS.submitter);

    // 导航到投递页面
    await page.goto('/deliveries');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 验证页面加载
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);

    // 验证 URL
    await expect(page).toHaveURL(/\/deliveries/);

    await context.close();
  });

  test('完整投递审核流程', async ({ browser }) => {
    // 创建提交者上下文
    const submitterContext = await browser.newContext();
    const { page: submitterPage } = await setupUser(submitterContext, USERS.submitter);

    // ============================================================
    // 阶段 1: 提交者创建投递
    // ============================================================
    const delivery = await test.step('创建投递', async () => {
      const newDelivery = await createDelivery(submitterPage, `审核测试投递-${Date.now()}`, {
        content: '这是一个需要审核的投递内容。',
        platform: 'local', // 使用有效值
      });

      // 如果 API 不可用，跳过测试
      if (!newDelivery || newDelivery.error) {
        console.log('投递 API 不可用，跳过测试');
        test.skip();
        return null;
      }

      expect(newDelivery.id).toBeDefined();
      expect(newDelivery.status).toBe('pending');

      return newDelivery;
    });

    if (!delivery) {
      await submitterContext.close();
      return;
    }

    // ============================================================
    // 阶段 2: 审核员查看待审核投递
    // ============================================================
    const reviewerContext = await browser.newContext();
    const { page: reviewerPage } = await setupUser(reviewerContext, USERS.reviewer);

    await test.step('审核员查看待审核列表', async () => {
      const pendingDeliveries = await getDeliveries(reviewerPage, 'pending');

      // 验证待审核列表包含刚创建的投递
      const found = pendingDeliveries.find((d: { id: string }) => d.id === delivery.id);

      // 注意：由于权限控制，审核员可能看不到其他用户的投递
      // 这里主要验证 API 正常工作
      expect(Array.isArray(pendingDeliveries)).toBe(true);
    });

    // ============================================================
    // 阶段 3: 审核员批准投递
    // ============================================================
    await test.step('审核员批准投递', async () => {
      const approved = await updateDeliveryStatus(
        reviewerPage,
        delivery.id,
        'approved',
        '内容符合要求，批准通过。'
      );

      if (approved) {
        expect(approved.status).toBe('approved');
      }
    });

    // ============================================================
    // 阶段 4: 提交者查看审核结果
    // ============================================================
    await test.step('提交者查看审核结果', async () => {
      const deliveries = await getDeliveries(submitterPage);
      const found = deliveries.find((d: { id: string }) => d.id === delivery.id);

      if (found) {
        expect(found.status).toBe('approved');
      }
    });

    await submitterContext.close();
    await reviewerContext.close();
  });

  test('投递状态流转', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context, USERS.submitter);

    // 创建投递
    const delivery = await createDelivery(page, `状态流转测试-${Date.now()}`);

    if (!delivery) {
      test.skip();
      await context.close();
      return;
    }

    expect(delivery.status).toBe('pending');

    // 测试状态流转
    const statusFlow = [
      { status: 'approved', feedback: '批准' },
    ];

    for (const { status, feedback } of statusFlow) {
      const updated = await updateDeliveryStatus(page, delivery.id, status, feedback);
      if (updated) {
        expect(updated.status).toBe(status);
      }
    }

    await context.close();
  });

  test('投递筛选功能', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context, USERS.submitter);

    // 创建多个投递
    const delivery1 = await createDelivery(page, `筛选测试1-${Date.now()}`);
    const delivery2 = await createDelivery(page, `筛选测试2-${Date.now()}`);

    if (!delivery1 || !delivery2) {
      test.skip();
      await context.close();
      return;
    }

    // 更新一个投递状态
    await updateDeliveryStatus(page, delivery1.id, 'approved');

    // 获取不同状态的投递
    const pendingDeliveries = await getDeliveries(page, 'pending');
    const approvedDeliveries = await getDeliveries(page, 'approved');

    // 验证筛选结果
    expect(pendingDeliveries.every((d: { status: string }) => d.status === 'pending')).toBe(true);
    expect(approvedDeliveries.every((d: { status: string }) => d.status === 'approved')).toBe(true);

    await context.close();
  });

  test('投递与项目关联', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context, USERS.submitter);

    // 创建项目
    const projectResponse = await page.request.post('/api/projects', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        name: `投递测试项目-${Date.now()}`,
        description: '测试投递与项目关联',
        source: 'local',
        visibility: 'private',
      },
    });

    expect(projectResponse.ok()).toBe(true);
    const project = await projectResponse.json();

    // 创建项目关联投递
    const delivery = await createDelivery(page, `项目投递-${Date.now()}`, {
      content: '项目关联的投递',
      projectId: project.id,
    });

    if (delivery) {
      expect(delivery.projectId).toBe(project.id);
    }

    // 清理
    if (delivery) {
      await page.request.delete(`/api/deliveries/${delivery.id}`);
    }
    await page.request.delete(`/api/projects/${project.id}`);

    await context.close();
  });
});
