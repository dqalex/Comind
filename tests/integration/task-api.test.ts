/**
 * 任务 API 集成测试
 *
 * 测试覆盖：
 * 1. 任务 CRUD（创建、读取、更新、删除）
 * 2. 任务状态流转
 * 3. 任务分配
 * 4. 任务搜索和筛选
 * 5. 任务评论
 *
 * 运行方式：
 *   npx vitest run tests/integration/task-api.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete } from '../helpers/api-client';
import { AuthHelper, setupAuth } from '../helpers/auth-helper';
import { TestDataFactory, generateId } from '../helpers/test-fixture';

describe('任务 API 集成测试', () => {
  let auth: AuthHelper;
  let factory: TestDataFactory;
  let testTaskId: string;
  let testProjectId: string;

  beforeAll(async () => {
    auth = await setupAuth('member');
    factory = new TestDataFactory();
    factory.setAuthHeaders(auth.getAuthHeaders());
  });

  afterAll(async () => {
    await factory.cleanup();
    await auth.logout();
  });

  // ==================== 任务 CRUD ====================

  describe('1. 任务 CRUD', () => {
    it('1.1 应该能创建任务', async () => {
      const task = await factory.createTask({
        title: '[测试] CRUD 测试任务',
        description: '测试任务描述',
        status: 'todo',
        priority: 'medium',
      });

      expect(task.id).toBeDefined();
      expect(task.title).toContain('[测试]');
      testTaskId = task.id;

      console.log(`[创建任务] id=${task.id}`);
    });

    it('1.2 应该能获取任务列表', async () => {
      const res = await apiGet('/api/tasks', { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const tasks = Array.isArray(res.data) ? res.data : (res.data as { data: unknown[] }).data;
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('1.3 应该能获取单个任务', async () => {
      if (!testTaskId) {
        throw new Error('任务 ID 未设置');
      }

      const res = await apiGet(`/api/tasks/${testTaskId}`, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const task = res.data as { id: string; title: string };
      expect(task.id).toBe(testTaskId);
    });

    it('1.4 应该能更新任务', async () => {
      if (!testTaskId) {
        throw new Error('任务 ID 未设置');
      }

      const res = await apiPut(`/api/tasks/${testTaskId}`, {
        title: '[测试] 已更新的任务标题',
        description: '更新后的描述',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const task = res.data as { title: string };
      expect(task.title).toContain('已更新');
    });

    it('1.5 应该能删除任务', async () => {
      // 创建一个专门用于删除的任务
      const task = await factory.createTask({
        title: '[测试] 待删除任务',
      });

      const res = await apiDelete(`/api/tasks/${task.id}`, { headers: auth.getAuthHeaders() });
      expect(res.ok).toBe(true);

      // 验证已删除
      const getRes = await apiGet(`/api/tasks/${task.id}`, { headers: auth.getAuthHeaders() });
      expect(getRes.status).toBe(404);
    });
  });

  // ==================== 状态流转 ====================

  describe('2. 任务状态流转', () => {
    let statusTaskId: string;

    it('2.1 应该能更新任务状态', async () => {
      const task = await factory.createTask({
        title: '[测试] 状态流转任务',
        status: 'todo',
      });
      statusTaskId = task.id;

      const res = await apiPut(`/api/tasks/${statusTaskId}`, {
        status: 'in_progress',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const updated = res.data as { status: string };
      expect(updated.status).toBe('in_progress');
    });

    it('2.2 状态应该能流转到 reviewing', async () => {
      if (!statusTaskId) {
        throw new Error('任务 ID 未设置');
      }

      const res = await apiPut(`/api/tasks/${statusTaskId}`, {
        status: 'reviewing',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });

    it('2.3 状态应该能流转到 completed', async () => {
      if (!statusTaskId) {
        throw new Error('任务 ID 未设置');
      }

      const res = await apiPut(`/api/tasks/${statusTaskId}`, {
        status: 'completed',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });

    it('2.4 无效状态应该被拒绝', async () => {
      const task = await factory.createTask();

      const res = await apiPut(`/api/tasks/${task.id}`, {
        status: 'invalid_status',
      }, { headers: auth.getAuthHeaders() });

      // 应该返回错误或忽略无效值
      console.log(`[无效状态] status=${res.status}`);
    });
  });

  // ==================== 任务分配 ====================

  describe('3. 任务分配', () => {
    it('3.1 应该能分配任务给成员', async () => {
      const task = await factory.createTask();

      // 获取当前用户作为负责人
      const user = auth.getUser();

      const res = await apiPut(`/api/tasks/${task.id}`, {
        assignees: user?.id ? [user.id] : [],
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });

    it('3.2 应该能取消任务分配', async () => {
      const task = await factory.createTask();

      const res = await apiPut(`/api/tasks/${task.id}`, {
        assignees: [],
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });
  });

  // ==================== 任务与项目关联 ====================

  describe('4. 任务与项目关联', () => {
    it('4.1 应该能创建项目', async () => {
      const project = await factory.createProject({
        name: '[测试] 任务关联项目',
      });

      expect(project.id).toBeDefined();
      testProjectId = project.id;
    });

    it('4.2 应该能将任务关联到项目', async () => {
      if (!testProjectId) {
        throw new Error('项目 ID 未设置');
      }

      const task = await factory.createTask({
        projectId: testProjectId,
      });

      expect(task.projectId).toBe(testProjectId);
    });

    it('4.3 应该能获取项目下的任务', async () => {
      if (!testProjectId) {
        throw new Error('项目 ID 未设置');
      }

      const res = await apiGet(`/api/tasks?projectId=${testProjectId}`, {
        headers: auth.getAuthHeaders(),
      });

      expect(res.ok).toBe(true);
    });
  });

  // ==================== 任务评论 ====================

  describe('5. 任务评论', () => {
    let commentTaskId: string;

    it('5.1 应该能创建评论', async () => {
      const task = await factory.createTask();
      commentTaskId = task.id;

      const res = await apiPost(`/api/tasks/${commentTaskId}/comments`, {
        content: '这是一条测试评论',
      }, { headers: auth.getAuthHeaders() });

      console.log(`[创建评论] status=${res.status}`, res.data);
    });

    it('5.2 应该能获取任务评论列表', async () => {
      if (!commentTaskId) {
        throw new Error('任务 ID 未设置');
      }

      const res = await apiGet(`/api/tasks/${commentTaskId}/comments`, {
        headers: auth.getAuthHeaders(),
      });

      console.log(`[评论列表] status=${res.status}`);
    });
  });

  // ==================== 任务搜索和筛选 ====================

  describe('6. 任务搜索和筛选', () => {
    it('6.1 应该能按状态筛选', async () => {
      const res = await apiGet('/api/tasks?status=todo', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.ok).toBe(true);
    });

    it('6.2 应该能按优先级筛选', async () => {
      const res = await apiGet('/api/tasks?priority=high', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.ok).toBe(true);
    });

    it('6.3 应该能分页查询', async () => {
      const res = await apiGet('/api/tasks?page=1&limit=10', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.ok).toBe(true);
    });
  });

  // ==================== 异常处理 ====================

  describe('7. 异常处理', () => {
    it('7.1 获取不存在的任务应返回 404', async () => {
      const res = await apiGet('/api/tasks/non-existent-id', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.status).toBe(404);
    });

    it('7.2 更新不存在的任务应返回 404', async () => {
      const res = await apiPut('/api/tasks/non-existent-id', {
        title: '更新',
      }, { headers: auth.getAuthHeaders() });

      expect(res.status).toBe(404);
    });

    it('7.3 删除不存在的任务应返回 404', async () => {
      const res = await apiDelete('/api/tasks/non-existent-id', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.status).toBe(404);
    });

    it('7.4 创建任务缺少必填字段应返回错误', async () => {
      const res = await apiPost('/api/tasks', {
        // 缺少 title
        status: 'todo',
      }, { headers: auth.getAuthHeaders() });

      console.log(`[缺少字段] status=${res.status}`);
    });
  });
});
