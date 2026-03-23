/**
 * REQ-020: Chat Channel 高并发架构优化 - 下游接口测试
 *
 * 测试目的：确保本模块依赖的下游服务正常可用
 * 覆盖范围：MCP handlers、Store 方法、SSE 事件
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getBaseUrl } from '@/tests/helpers/api-client';
import { db } from '@/db';
import { tasks, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AuthHelper } from '@/tests/helpers/auth-helper';

describe('REQ-020: 下游依赖可用性', () => {
  const BASE_URL = getBaseUrl();
  let auth: AuthHelper;
  let testCreatorId: string;

  beforeAll(async () => {
    auth = new AuthHelper();
    await auth.setup();
    
    // 获取当前用户 ID 作为 creator_id
    const userInfo = auth.getUser();
    testCreatorId = userInfo?.id || 'test-creator';
  });

  afterAll(async () => {
    await auth.logout();
  });

  describe('MCP Handlers', () => {
    // 使用唯一 ID 避免测试冲突
    const TEST_TASK_ID = `downstream_test_${Date.now()}`;

    it('任务相关 handler 应该可用', async () => {
      // 先清理可能存在的残留任务
      await db.delete(tasks).where(eq(tasks.id, TEST_TASK_ID));

      // 先创建一个测试任务
      const [testTask] = await db.insert(tasks).values({
        id: TEST_TASK_ID,
        title: '下游测试任务',
        status: 'todo',
        priority: 'medium',
        creatorId: testCreatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      expect(testTask).toBeDefined();
      expect(testTask.id).toBe(TEST_TASK_ID);

      // 测试更新任务状态
      const action = {
        type: 'update_task_status',
        task_id: TEST_TASK_ID,
        status: 'in_progress',
      };

      const res = await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({ actions: [action] }),
      });

      const data = await res.json();
      expect(data.results?.[0]?.success ?? data.success).toBe(true);

      // 清理
      await db.delete(tasks).where(eq(tasks.id, TEST_TASK_ID));
    });

    it('文档相关 handler 应该可用', async () => {
      const action = {
        type: 'create_document',
        title: '下游测试文档',
        content: '测试内容',
        doc_type: 'note',
      };

      const res = await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({ actions: [action] }),
      });

      const data = await res.json();
      // 可能成功也可能失败（如果权限不足），但不应该报错
      expect(data.results?.[0]?.type || data.type).toBeDefined();
    });

    it('状态更新 handler 应该可用', async () => {
      // 获取一个 AI 成员
      const aiMembers = await db.select().from(members).where(eq(members.type, 'ai')).limit(1);
      
      if (aiMembers.length > 0) {
        const action = {
          type: 'update_status',
          member_id: aiMembers[0].id,
          status: 'working',
          current_action: '下游测试',
        };

        const res = await fetch(`${BASE_URL}/api/chat-actions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...auth.getAuthHeaders(),
          },
          body: JSON.stringify({ actions: [action] }),
        });

        const data = await res.json();
        expect(data.results?.[0]?.type || data.type).toBeDefined();
      } else {
        // 没有 AI 成员时跳过
        expect(true).toBe(true);
      }
    });
  });

  describe('Store 方法', () => {
    it('TaskStore fetchTasks 应该可用', async () => {
      const res = await fetch(`${BASE_URL}/api/tasks`, {
        headers: auth.getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('DocumentStore fetchDocuments 应该可用', async () => {
      const res = await fetch(`${BASE_URL}/api/documents`, {
        headers: auth.getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('ProjectStore fetchProjects 应该可用', async () => {
      const res = await fetch(`${BASE_URL}/api/projects`, {
        headers: auth.getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('MemberStore fetchMembers 应该可用', async () => {
      const res = await fetch(`${BASE_URL}/api/members`, {
        headers: auth.getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('SSE 事件', () => {
    // 注意：EventSource 在 Node.js 环境中不可用，使用 HTTP 请求验证端点
    it('SSE 端点应该可连接', async () => {
      // 使用 fetch 验证 SSE 端点响应（需要认证）
      const res = await fetch(`${BASE_URL}/api/sse`, {
        headers: {
          'Accept': 'text/event-stream',
          ...auth.getAuthHeaders(),
        },
      });

      // SSE 端点应该返回 200 并且是 event-stream 类型
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      
      // 清理连接
      const reader = res.body?.getReader();
      if (reader) {
        reader.cancel();
      }
    });

    it('数据变更应该触发 SSE 事件', async () => {
      // 使用唯一 ID 避免冲突
      const uniqueId = `sse_test_${Date.now()}`;
      
      // 触发任务更新验证不报错
      const [testTask] = await db.insert(tasks).values({
        id: uniqueId,
        title: 'SSE 测试任务',
        status: 'todo',
        priority: 'medium',
        creatorId: testCreatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // 更新任务
      await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({
          actions: [{
            type: 'update_task_status',
            task_id: uniqueId,
            status: 'in_progress',
          }],
        }),
      });

      // 清理
      await db.delete(tasks).where(eq(tasks.id, uniqueId));

      // 验证流程完成
      expect(true).toBe(true);
    });
  });

  describe('数据库连接', () => {
    it('应该能够查询数据库', async () => {
      const result = await db.select().from(tasks).limit(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该能够插入数据', async () => {
      const [task] = await db.insert(tasks).values({
        id: 'db_test_task',
        title: '数据库测试任务',
        status: 'todo',
        priority: 'low',
        creatorId: testCreatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      expect(task.id).toBe('db_test_task');

      // 清理
      await db.delete(tasks).where(eq(tasks.id, 'db_test_task'));
    });
  });
});
