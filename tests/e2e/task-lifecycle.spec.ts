import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * 任务生命周期 E2E 测试
 *
 * 真实业务场景：
 * 1. 创建任务（待办状态）
 * 2. 开始执行任务（进行中状态）
 * 3. 更新任务进度和检查项
 * 4. 完成任务（已完成状态）
 * 5. 重新打开任务（如果需要）
 */
test.describe('任务生命周期', () => {
  const TEST_USER = {
    email: 'task-lifecycle@teamclaw.test',
    password: 'TestTask123!',
    name: '任务测试用户',
  };

  /**
   * 创建并登录用户
   */
  async function setupUser(context: BrowserContext) {
    const page = await context.newPage();
    const auth = new AuthHelper(page);

    // 先导航到首页，确保 window.location.origin 有效
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loginSuccess = await auth.login(TEST_USER.email, TEST_USER.password);
    if (!loginSuccess) {
      await auth.register(TEST_USER.email, TEST_USER.password, TEST_USER.name);
      await auth.login(TEST_USER.email, TEST_USER.password);
    }

    return { page, auth };
  }

  /**
   * 创建任务（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function createTask(page: Page, title: string, options: {
    description?: string;
    priority?: string;
    projectId?: string;
    checkItems?: Array<{ id: string; text: string; completed: boolean }>;
  } = {}) {
    const result = await page.evaluate(async ({ title, options }) => {
      const url = `${window.location.origin}/api/tasks`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: options.description || '任务描述',
          status: 'todo',
          priority: options.priority || 'medium',
          projectId: options.projectId,
          checkItems: options.checkItems,
        }),
      });

      if (!response.ok) {
        throw new Error(`创建任务失败: ${await response.text()}`);
      }

      return await response.json();
    }, { title, options });

    return result;
  }

  /**
   * 更新任务（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function updateTask(page: Page, taskId: string, updates: Record<string, unknown>) {
    const result = await page.evaluate(async ({ taskId, updates }) => {
      const url = `${window.location.origin}/api/tasks/${taskId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`更新任务失败: ${await response.text()}`);
      }

      return await response.json();
    }, { taskId, updates });

    return result;
  }

  /**
   * 删除任务（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function deleteTask(page: Page, taskId: string) {
    const result = await page.evaluate(async (taskId) => {
      const url = `${window.location.origin}/api/tasks/${taskId}`;
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`删除任务失败: ${await response.text()}`);
      }

      return true;
    }, taskId);

    return result;
  }

  test('完整任务生命周期', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // ============================================================
    // 阶段 1: 创建任务
    // ============================================================
    const task = await test.step('创建新任务', async () => {
      const newTask = await createTask(page, `生命周期测试任务-${Date.now()}`, {
        description: '这是一个测试任务生命周期的任务',
        priority: 'high',
        checkItems: [
          { id: '1', text: '步骤 1: 准备工作', completed: false },
          { id: '2', text: '步骤 2: 执行任务', completed: false },
          { id: '3', text: '步骤 3: 验证结果', completed: false },
        ],
      });

      expect(newTask.id).toBeDefined();
      expect(newTask.status).toBe('todo');
      expect(newTask.priority).toBe('high');
      expect(newTask.checkItems).toHaveLength(3);

      return newTask;
    });

    // ============================================================
    // 阶段 2: 开始执行任务
    // ============================================================
    await test.step('开始执行任务', async () => {
      const updatedTask = await updateTask(page, task.id, {
        status: 'in_progress',
        progress: 10,
      });

      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.progress).toBe(10);
    });

    // ============================================================
    // 阶段 3: 更新检查项进度
    // ============================================================
    await test.step('完成部分检查项', async () => {
      const updatedTask = await updateTask(page, task.id, {
        progress: 40,
        checkItems: [
          { id: '1', text: '步骤 1: 准备工作', completed: true },
          { id: '2', text: '步骤 2: 执行任务', completed: true },
          { id: '3', text: '步骤 3: 验证结果', completed: false },
        ],
      });

      expect(updatedTask.progress).toBe(40);
      expect(updatedTask.checkItems[0].completed).toBe(true);
      expect(updatedTask.checkItems[1].completed).toBe(true);
      expect(updatedTask.checkItems[2].completed).toBe(false);
    });

    // ============================================================
    // 阶段 4: 完成任务
    // ============================================================
    await test.step('完成任务', async () => {
      const completedTask = await updateTask(page, task.id, {
        status: 'completed',
        progress: 100,
        checkItems: [
          { id: '1', text: '步骤 1: 准备工作', completed: true },
          { id: '2', text: '步骤 2: 执行任务', completed: true },
          { id: '3', text: '步骤 3: 验证结果', completed: true },
        ],
      });

      expect(completedTask.status).toBe('completed');
      expect(completedTask.progress).toBe(100);
      expect(completedTask.checkItems.every((item: { completed: boolean }) => item.completed)).toBe(true);
    });

    // ============================================================
    // 阶段 5: 验证任务历史
    // ============================================================
    await test.step('验证任务最终状态', async () => {
      const response = await page.request.get(`/api/tasks/${task.id}`);
      expect(response.ok()).toBe(true);

      const finalTask = await response.json();
      expect(finalTask.status).toBe('completed');
      expect(finalTask.progress).toBe(100);
    });

    // ============================================================
    // 阶段 6: 清理 - 删除任务
    // ============================================================
    await test.step('删除测试任务', async () => {
      await deleteTask(page, task.id);

      // 验证任务已删除
      const response = await page.request.get(`/api/tasks/${task.id}`);
      expect(response.status()).toBe(404);
    });

    await context.close();
  });

  test('任务状态流转', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建任务
    const task = await createTask(page, `状态流转测试-${Date.now()}`);

    // 测试状态流转: todo -> in_progress -> completed
    const states = ['in_progress', 'completed'];
    for (const state of states) {
      const updated = await updateTask(page, task.id, { status: state });
      expect(updated.status).toBe(state);
    }

    // 测试重新打开: completed -> todo
    const reopened = await updateTask(page, task.id, { status: 'todo', progress: 0 });
    expect(reopened.status).toBe('todo');
    expect(reopened.progress).toBe(0);

    // 清理
    await deleteTask(page, task.id);
    await context.close();
  });

  test('任务优先级管理', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建不同优先级的任务（API 只接受 low/medium/high）
    const priorities = ['low', 'medium', 'high'];
    const tasks = [];

    for (const priority of priorities) {
      const task = await createTask(page, `优先级测试-${priority}-${Date.now()}`, { priority });
      expect(task.priority).toBe(priority);
      tasks.push(task);
    }

    // 验证可以更新优先级
    const updated = await updateTask(page, tasks[0].id, { priority: 'high' });
    expect(updated.priority).toBe('high');

    // 清理
    for (const task of tasks) {
      await deleteTask(page, task.id);
    }

    await context.close();
  });

  test('批量任务操作', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建多个任务
    const taskTitles = ['任务 A', '任务 B', '任务 C'];
    const tasks = [];

    for (const title of taskTitles) {
      const task = await createTask(page, `${title}-${Date.now()}`);
      tasks.push(task);
    }

    // 批量更新状态
    for (const task of tasks) {
      const updated = await updateTask(page, task.id, { status: 'in_progress' });
      expect(updated.status).toBe('in_progress');
    }

    // 验证所有任务状态已更新
    const response = await page.request.get('/api/tasks');
    const allTasks = await response.json();
    const taskArray = Array.isArray(allTasks) ? allTasks : allTasks.data;

    for (const task of tasks) {
      const found = taskArray.find((t: { id: string }) => t.id === task.id);
      if (found) {
        expect(found.status).toBe('in_progress');
      }
    }

    // 清理
    for (const task of tasks) {
      await deleteTask(page, task.id);
    }

    await context.close();
  });

  test('任务页面交互', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建测试任务
    const task = await createTask(page, `页面交互测试-${Date.now()}`);

    // 导航到任务页面
    await page.goto('/tasks');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 验证页面加载
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(1000);

    // 验证 URL
    await expect(page).toHaveURL(/\/tasks/);

    // 清理
    await deleteTask(page, task.id);
    await context.close();
  });
});
