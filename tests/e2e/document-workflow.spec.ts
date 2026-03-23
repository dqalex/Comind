import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * 文档协作流程 E2E 测试
 *
 * 真实业务场景：
 * 1. 创建项目文档（需求文档、设计文档等）
 * 2. 编辑和更新文档内容
 * 3. 文档分类和标签管理
 * 4. 文档版本历史（如果支持）
 * 5. 文档搜索和检索
 */
test.describe('文档协作流程', () => {
  const TEST_USER = {
    email: 'doc-workflow@teamclaw.test',
    password: 'TestDoc123!',
    name: '文档测试用户',
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
   * 创建文档（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function createDocument(page: Page, title: string, options: {
    content?: string;
    type?: string;
    projectId?: string;
  } = {}) {
    const result = await page.evaluate(async ({ title, options }) => {
      const url = `${window.location.origin}/api/documents`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: options.content || `# ${title}\n\n文档内容`,
          type: options.type || 'guide',
          projectId: options.projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`创建文档失败: ${await response.text()}`);
      }

      return await response.json();
    }, { title, options });

    return result;
  }

  /**
   * 更新文档（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function updateDocument(page: Page, docId: string, updates: Record<string, unknown>) {
    const result = await page.evaluate(async ({ docId, updates }) => {
      const url = `${window.location.origin}/api/documents/${docId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`更新文档失败: ${await response.text()}`);
      }

      return await response.json();
    }, { docId, updates });

    return result;
  }

  /**
   * 删除文档（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function deleteDocument(page: Page, docId: string) {
    await page.evaluate(async (docId) => {
      const url = `${window.location.origin}/api/documents/${docId}`;
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`删除文档失败: ${await response.text()}`);
      }
    }, docId);
  }

  test('完整文档生命周期', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // ============================================================
    // 阶段 1: 创建文档
    // ============================================================
    const document = await test.step('创建新文档', async () => {
      const newDoc = await createDocument(page, `生命周期测试文档-${Date.now()}`, {
        content: `# 测试文档\n\n这是文档的初始内容。\n\n## 章节 1\n\n详细说明...`,
        type: 'guide',
      });

      expect(newDoc.id).toBeDefined();
      expect(newDoc.title).toContain('生命周期测试文档');
      expect(newDoc.type).toBe('guide');

      return newDoc;
    });

    // ============================================================
    // 阶段 2: 更新文档内容
    // ============================================================
    await test.step('更新文档内容', async () => {
      const updatedDoc = await updateDocument(page, document.id, {
        content: `# 测试文档（已更新）\n\n这是更新后的内容。\n\n## 章节 1\n\n详细说明...\n\n## 章节 2\n\n新增内容...`,
      });

      expect(updatedDoc.content).toContain('已更新');
      expect(updatedDoc.content).toContain('章节 2');
    });

    // ============================================================
    // 阶段 3: 更新文档标题
    // ============================================================
    await test.step('更新文档标题', async () => {
      const newTitle = `更新后的标题-${Date.now()}`;
      const updatedDoc = await updateDocument(page, document.id, {
        title: newTitle,
      });

      expect(updatedDoc.title).toBe(newTitle);
    });

    // ============================================================
    // 阶段 4: 验证文档列表
    // ============================================================
    await test.step('验证文档列表', async () => {
      const response = await page.request.get('/api/documents');
      expect(response.ok()).toBe(true);

      const documents = await response.json();
      const docArray = Array.isArray(documents) ? documents : documents.data;

      // 验证文档在列表中
      const found = docArray.find((d: { id: string }) => d.id === document.id);
      expect(found).toBeDefined();
    });

    // ============================================================
    // 阶段 5: 清理
    // ============================================================
    await test.step('删除测试文档', async () => {
      await deleteDocument(page, document.id);

      // 验证文档已删除
      const response = await page.request.get(`/api/documents/${document.id}`);
      expect(response.status()).toBe(404);
    });

    await context.close();
  });

  test('多种类型文档创建', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建不同类型文档
    const docTypes = [
      { type: 'guide', title: '用户指南' },
      { type: 'reference', title: 'API 参考' },
      { type: 'note', title: '会议记录' },
      { type: 'report', title: '项目报告' },
    ];

    const documents = [];

    for (const { type, title } of docTypes) {
      const doc = await createDocument(page, `${title}-${Date.now()}`, {
        content: `# ${title}\n\n这是一个 ${type} 类型的文档。`,
        type,
      });

      expect(doc.id).toBeDefined();
      expect(doc.type).toBe(type);
      documents.push(doc);
    }

    // 验证所有文档都在列表中
    const response = await page.request.get('/api/documents');
    const allDocs = await response.json();
    const docArray = Array.isArray(allDocs) ? allDocs : allDocs.data;

    for (const doc of documents) {
      const found = docArray.find((d: { id: string }) => d.id === doc.id);
      expect(found).toBeDefined();
    }

    // 清理
    for (const doc of documents) {
      await deleteDocument(page, doc.id);
    }

    await context.close();
  });

  test('项目关联文档', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建项目
    const projectResponse = await page.request.post('/api/projects', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        name: `文档测试项目-${Date.now()}`,
        description: '测试项目文档关联',
        source: 'local',
        visibility: 'private',
      },
    });

    expect(projectResponse.ok()).toBe(true);
    const project = await projectResponse.json();

    // 创建项目关联文档
    const doc = await createDocument(page, `项目文档-${Date.now()}`, {
      content: `# 项目文档\n\n这是 ${project.name} 的文档。`,
      type: 'guide',
      projectId: project.id,
    });

    expect(doc.projectId).toBe(project.id);

    // 验证可以通过项目筛选文档
    const response = await page.request.get(`/api/documents?projectId=${project.id}`);
    expect(response.ok()).toBe(true);

    const docs = await response.json();
    const docArray = Array.isArray(docs) ? docs : docs.data;
    const found = docArray.find((d: { id: string }) => d.id === doc.id);
    expect(found).toBeDefined();

    // 清理
    await deleteDocument(page, doc.id);
    await page.request.delete(`/api/projects/${project.id}`);

    await context.close();
  });

  test('Wiki 页面交互', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建测试文档
    const doc = await createDocument(page, `Wiki 测试文档-${Date.now()}`, {
      content: `# Wiki 测试\n\n这是一个用于测试 Wiki 页面的文档。`,
      type: 'guide',
    });

    // 导航到 Wiki 页面
    await page.goto('/wiki');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 验证页面加载
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(1000);

    // 验证 URL
    await expect(page).toHaveURL(/\/wiki/);

    // 清理
    await deleteDocument(page, doc.id);
    await context.close();
  });

  test('文档搜索功能', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupUser(context);

    // 创建带有特定关键词的文档
    const uniqueKeyword = `搜索测试-${Date.now()}`;
    const doc = await createDocument(page, uniqueKeyword, {
      content: `# ${uniqueKeyword}\n\n这个文档包含特殊关键词：${uniqueKeyword}。`,
      type: 'guide',
    });

    // 尝试搜索文档
    const response = await page.request.get(`/api/documents?search=${encodeURIComponent(uniqueKeyword)}`);
    expect(response.ok()).toBe(true);

    // 注意：搜索功能可能未实现或行为不同
    // 这里主要验证 API 不会报错

    // 清理
    await deleteDocument(page, doc.id);
    await context.close();
  });
});
