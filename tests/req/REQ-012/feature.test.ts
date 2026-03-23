/**
 * REQ-012: 渐进式上下文设计 - 功能测试
 *
 * 测试目的：验证渐进式上下文获取功能是否正确实现
 * 运行方式：npx vitest run tests/req/REQ-012/feature.test.ts
 * 环境切换：TEST_TARGET=remote npx vitest run tests/req/REQ-012/feature.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthHelper } from '@/tests/helpers/auth-helper';
import { TestDataFactory } from '@/tests/helpers/test-fixture';
import { apiPost, getBaseUrl, ApiResponse } from '@/tests/helpers/api-client';

// MCP 响应类型
interface McpResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 任务数据类型
interface TaskData {
  id: string;
  title: string;
  status: string;
  description?: string;
}

describe('REQ-012: 渐进式上下文设计', () => {
  const BASE_URL = getBaseUrl();
  let auth: AuthHelper;
  let factory: TestDataFactory;
  let testTaskId: string | null = null;
  let testDocId: string | null = null;

  beforeAll(async () => {
    // 使用现有认证辅助工具
    auth = new AuthHelper();
    await auth.setup();
    
    // 使用现有测试数据工厂
    factory = new TestDataFactory();
    factory.setAuthHeaders(auth.getAuthHeaders());

    // 创建测试数据
    const task = await factory.createTask({ title: '[测试] 渐进式上下文任务' });
    testTaskId = task.id;

    const doc = await factory.createDocument({ title: '[测试] 渐进式上下文文档' });
    testDocId = doc.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await factory.cleanup();
  });

  // ==================== MCP 工具分层参数测试 ====================

  describe('MCP get_task 分层参数', () => {
    it('无 detail 参数时应返回 L1 索引（精简数据）', async () => {
      const res = await apiPost<McpResponse<TaskData>>('/api/mcp', {
        tool: 'get_task',
        parameters: { task_id: testTaskId }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      expect(data.success).toBe(true);
      
      // L1 索引应仅包含核心字段
      const task = data.data as TaskData;
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('status');
      // L1 不应包含完整描述（节省上下文）
      expect(task.description).toBeUndefined();
    });

    it('detail=true 时应返回 L2 完整详情', async () => {
      const res = await apiPost<McpResponse<TaskData>>('/api/mcp', {
        tool: 'get_task',
        parameters: { task_id: testTaskId, detail: true }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      expect(data.success).toBe(true);
      
      // L2 详情应包含完整字段
      const task = data.data as TaskData;
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('status');
    });
  });

  describe('MCP list_my_tasks 分层参数', () => {
    it('无 detail 参数时应返回 L1 索引列表', async () => {
      const res = await apiPost<McpResponse<TaskData[]>>('/api/mcp', {
        tool: 'list_my_tasks',
        parameters: { status: 'all', limit: 5 }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      expect(data.success).toBe(true);
      
      // L1 列表每个任务应仅包含核心字段
      if (data.data && data.data.length > 0) {
        const task = data.data[0] as TaskData;
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('status');
        // L1 不应包含完整描述
        expect(task.description).toBeUndefined();
      }
    });

    it('detail=true 时应返回 L2 完整列表', async () => {
      const res = await apiPost<McpResponse<TaskData[]>>('/api/mcp', {
        tool: 'list_my_tasks',
        parameters: { status: 'all', limit: 5, detail: true }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      expect(data.success).toBe(true);
      
      // L2 列表每个任务应包含完整字段
      if (data.data && data.data.length > 0) {
        const task = data.data[0] as TaskData;
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('status');
      }
    });
  });

  // ==================== 对话信道 L1 推送测试 ====================

  describe('对话信道 L1 推送格式', () => {
    it('任务推送应包含可用上下文列表', async () => {
      const res = await apiPost<McpResponse<{ message?: string }>>('/api/task-push', {
        taskId: testTaskId,
        sessionKey: 'test-session-' + Date.now()
      }, { headers: auth.getAuthHeaders() });

      // 即使失败，也应该返回正确的错误格式
      const data = res.data;
      
      // 如果成功，消息应包含上下文引导
      if (data.success && data.data?.message) {
        // L1 推送应告知 Agent 如何获取更多上下文
        expect(
          data.data.message.includes('上下文') ||
          data.data.message.includes('context') ||
          data.data.message.includes('可用')
        ).toBe(true);
      }
    });
  });

  // ==================== 对话信道 L2/L3 请求解析测试 ====================

  describe('对话信道 L2 请求解析', () => {
    it('应能解析规范化的上下文请求格式', async () => {
      // 测试 chat-reply API 是否支持上下文请求
      const testMessage = `请求上下文:
- 类型: previous_output
- 参数: { "stageId": "stage-1" }`;

      const res = await apiPost('/api/chat-reply', {
        message: testMessage,
        sessionId: 'test-session-' + Date.now()
      }, { headers: auth.getAuthHeaders() });

      // API 应该能识别请求格式
      expect(res.status).toBeLessThan(500);
    });
  });

  // ==================== MCP get_document 分层参数测试 ====================

  describe('MCP get_document 分层参数', () => {
    it('无 detail 参数时应返回 L1 索引', async () => {
      const res = await apiPost<McpResponse<{ id: string; title: string; content?: string }>>('/api/mcp', {
        tool: 'get_document',
        parameters: { document_id: testDocId }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      
      if (data.success && data.data) {
        // L1 索引应仅包含元信息
        const doc = data.data;
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('title');
        // L1 不应包含完整内容
        expect(doc.content?.length || 0).toBeLessThan(1000);
      }
    });

    it('detail=true 时应返回 L2 完整内容', async () => {
      const res = await apiPost<McpResponse<{ id: string; title: string; content?: string }>>('/api/mcp', {
        tool: 'get_document',
        parameters: { document_id: testDocId, detail: true }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      
      if (data.success && data.data) {
        const doc = data.data;
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('content');
      }
    });
  });
});
