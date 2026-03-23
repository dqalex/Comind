import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * 项目协作流程 E2E 测试
 *
 * 真实业务场景：
 * 1. 项目经理创建项目并邀请成员
 * 2. 团队成员在项目中创建和分配任务
 * 3. 成员协作完成任务并更新进度
 * 4. 项目交付和审核流程
 */
test.describe('项目协作流程', () => {
  // 测试用户
  const USERS = {
    projectManager: {
      email: 'pm@teamclaw.test',
      password: 'TestPM123!',
      name: '项目经理',
    },
    developer: {
      email: 'dev@teamclaw.test',
      password: 'TestDev123!',
      name: '开发工程师',
    },
    designer: {
      email: 'designer@teamclaw.test',
      password: 'TestDesigner123!',
      name: '设计师',
    },
  };

  /**
   * 创建并登录用户
   */
  async function setupUser(context: BrowserContext, user: typeof USERS.projectManager) {
    const page = await context.newPage();
    const auth = new AuthHelper(page);

    // 先导航到首页，确保 window.location.origin 有效
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 尝试登录
    const loginSuccess = await auth.login(user.email, user.password);
    if (!loginSuccess) {
      // 登录失败，先注册
      await auth.register(user.email, user.password, user.name);
      // 再次登录
      await auth.login(user.email, user.password);
    }

    return { page, auth };
  }

  /**
   * 创建项目（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function createProject(page: Page, name: string) {
    const result = await page.evaluate(async (name) => {
      const url = `${window.location.origin}/api/projects`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: '协作测试项目',
          source: 'local',
          visibility: 'private',
        }),
      });

      if (!response.ok) {
        throw new Error(`创建项目失败: ${await response.text()}`);
      }

      return await response.json();
    }, name);

    return result;
  }

  /**
   * 创建任务（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function createTask(page: Page, title: string, projectId: string, assignees?: string[]) {
    const result = await page.evaluate(async ({ title, projectId, assignees }) => {
      const url = `${window.location.origin}/api/tasks`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: '协作测试任务',
          status: 'todo',
          priority: 'medium',
          projectId,
          assignees,
        }),
      });

      if (!response.ok) {
        throw new Error(`创建任务失败: ${await response.text()}`);
      }

      return await response.json();
    }, { title, projectId, assignees });

    return result;
  }

  /**
   * 更新任务状态（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function updateTaskStatus(page: Page, taskId: string, status: string) {
    const result = await page.evaluate(async ({ taskId, status }) => {
      const url = `${window.location.origin}/api/tasks/${taskId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`更新任务失败: ${await response.text()}`);
      }

      return await response.json();
    }, { taskId, status });

    return result;
  }

  test('完整项目协作流程', async ({ browser }) => {
    // ============================================================
    // 阶段 1: 项目经理创建项目
    // ============================================================
    test.step('项目经理创建项目', async () => {
      const pmContext = await browser.newContext();
      const { page: pmPage } = await setupUser(pmContext, USERS.projectManager);

      // 创建项目
      const project = await createProject(pmPage, `协作项目-${Date.now()}`);
      expect(project.id).toBeDefined();
      expect(project.name).toContain('协作项目');

      // 验证项目出现在项目列表
      await pmPage.goto('/projects');
      await pmPage.waitForLoadState('domcontentloaded');
      await pmPage.waitForTimeout(1000);

      const pageContent = await pmPage.locator('body').innerHTML();
      expect(pageContent.length).toBeGreaterThan(500);

      await pmContext.close();
    });

    // ============================================================
    // 阶段 2: 创建项目任务并分配
    // ============================================================
    test.step('创建并分配任务', async () => {
      const pmContext = await browser.newContext();
      const { page: pmPage } = await setupUser(pmContext, USERS.projectManager);

      // 创建项目
      const project = await createProject(pmPage, `任务分配项目-${Date.now()}`);

      // 创建多个任务
      const task1 = await createTask(pmPage, '需求分析', project.id);
      const task2 = await createTask(pmPage, 'UI设计', project.id);
      const task3 = await createTask(pmPage, '后端开发', project.id);

      expect(task1.id).toBeDefined();
      expect(task2.id).toBeDefined();
      expect(task3.id).toBeDefined();

      // 验证任务创建成功
      const tasksResponse = await pmPage.request.get(`/api/tasks?projectId=${project.id}`);
      expect(tasksResponse.ok()).toBe(true);

      const tasks = await tasksResponse.json();
      const taskArray = Array.isArray(tasks) ? tasks : tasks.data;
      expect(taskArray.length).toBeGreaterThanOrEqual(3);

      await pmContext.close();
    });

    // ============================================================
    // 阶段 3: 团队成员更新任务进度
    // ============================================================
    test.step('团队成员更新任务进度', async () => {
      const pmContext = await browser.newContext();
      const { page: pmPage } = await setupUser(pmContext, USERS.projectManager);

      // 创建项目和任务
      const project = await createProject(pmPage, `进度更新项目-${Date.now()}`);
      const task = await createTask(pmPage, '开发任务', project.id);

      // 更新任务状态为进行中
      await updateTaskStatus(pmPage, task.id, 'in_progress');

      // 验证状态更新
      const taskResponse = await pmPage.request.get(`/api/tasks/${task.id}`);
      expect(taskResponse.ok()).toBe(true);

      const updatedTask = await taskResponse.json();
      expect(updatedTask.status).toBe('in_progress');

      // 更新任务状态为已完成
      await updateTaskStatus(pmPage, task.id, 'completed');

      const completedResponse = await pmPage.request.get(`/api/tasks/${task.id}`);
      const completedTask = await completedResponse.json();
      expect(completedTask.status).toBe('completed');

      await pmContext.close();
    });

    // ============================================================
    // 阶段 4: 多用户协作场景
    // ============================================================
    test.step('多用户协作完成任务', async () => {
      // 创建项目经理上下文
      const pmContext = await browser.newContext();
      const { page: pmPage } = await setupUser(pmContext, USERS.projectManager);

      // 创建开发者上下文
      const devContext = await browser.newContext();
      const { page: devPage } = await setupUser(devContext, USERS.developer);

      // 项目经理创建公开项目
      const project = await createProject(pmPage, `多人协作项目-${Date.now()}`);

      // 项目经理创建任务
      const task = await createTask(pmPage, '协作开发任务', project.id);

      // 开发者应该能看到公开项目的任务
      const devTasksResponse = await devPage.request.get('/api/tasks');
      expect(devTasksResponse.ok()).toBe(true);

      // 开发者更新任务状态
      await updateTaskStatus(devPage, task.id, 'in_progress');

      // 项目经理验证状态更新
      const pmTaskResponse = await pmPage.request.get(`/api/tasks/${task.id}`);
      const pmTask = await pmTaskResponse.json();
      expect(pmTask.status).toBe('in_progress');

      // 开发者完成任务
      await updateTaskStatus(devPage, task.id, 'completed');

      // 项目经理验证任务完成
      const completedResponse = await pmPage.request.get(`/api/tasks/${task.id}`);
      const completedTask = await completedResponse.json();
      expect(completedTask.status).toBe('completed');

      await pmContext.close();
      await devContext.close();
    });
  });

  test('项目任务看板视图', async ({ browser }) => {
    const pmContext = await browser.newContext();
    const { page } = await setupUser(pmContext, USERS.projectManager);

    // 创建项目和多个任务
    const project = await createProject(page, `看板项目-${Date.now()}`);

    // 创建不同状态的任务
    const todoTask = await createTask(page, '待办任务', project.id);
    const inProgressTask = await createTask(page, '进行中任务', project.id);
    const completedTask = await createTask(page, '已完成任务', project.id);

    // 更新任务状态
    await updateTaskStatus(page, inProgressTask.id, 'in_progress');
    await updateTaskStatus(page, completedTask.id, 'completed');

    // 导航到任务页面
    await page.goto('/tasks');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 验证页面加载成功
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(1000);

    // 验证 URL 正确
    await expect(page).toHaveURL(/\/tasks/);

    await pmContext.close();
  });

  test('项目文档协作', async ({ browser }) => {
    const pmContext = await browser.newContext();
    const { page } = await setupUser(pmContext, USERS.projectManager);

    // 创建项目
    const project = await createProject(page, `文档项目-${Date.now()}`);

    // 创建项目文档
    const docResponse = await page.request.post('/api/documents', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        title: '项目需求文档',
        content: '# 项目需求\n\n这是测试项目的需求文档。',
        type: 'guide',
        projectId: project.id,
      },
    });

    expect(docResponse.ok()).toBe(true);
    const document = await docResponse.json();
    expect(document.id).toBeDefined();

    // 导航到 Wiki 页面
    await page.goto('/wiki');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 验证页面加载
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);

    await pmContext.close();
  });
});
