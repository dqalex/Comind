/**
 * P1/P2 渐进式上下文测试
 * 
 * 测试范围：
 * - Workspace 心跳机制
 * - Context Request API
 * - 推送模板渲染
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// 测试目录
const TEST_CONTEXT_DIR = join(process.cwd(), '.context-test');

// Mock 测试环境
beforeAll(() => {
  // 创建测试目录
  if (!existsSync(TEST_CONTEXT_DIR)) {
    mkdirSync(TEST_CONTEXT_DIR, { recursive: true });
  }
});

afterAll(() => {
  // 清理测试目录
  if (existsSync(TEST_CONTEXT_DIR)) {
    rmSync(TEST_CONTEXT_DIR, { recursive: true, force: true });
  }
});

describe('Workspace Service', () => {
  // 动态导入以使用 mock
  const importWorkspaceService = async () => {
    // Mock process.cwd() 返回测试目录
    const originalCwd = process.cwd;
    process.cwd = () => TEST_CONTEXT_DIR;
    
    const service = await import('@/lib/workspace/service');
    
    return {
      ...service,
      restore: () => { process.cwd = originalCwd; }
    };
  };
  
  it('should initialize context directory', async () => {
    const ws = await importWorkspaceService();
    
    await ws.initContextDir();
    
    expect(existsSync(join(TEST_CONTEXT_DIR, '.context'))).toBe(true);
    expect(existsSync(join(TEST_CONTEXT_DIR, '.context/sop'))).toBe(true);
    expect(existsSync(join(TEST_CONTEXT_DIR, '.context/tasks'))).toBe(true);
    
    ws.restore();
  });
  
  it('should write and check heartbeat', async () => {
    const ws = await importWorkspaceService();
    
    const sessionId = 'test-session-123';
    
    // 写入心跳
    await ws.writeHeartbeat(sessionId);
    
    // 检查心跳文件
    const heartbeatPath = join(TEST_CONTEXT_DIR, '.context/heartbeat.json');
    expect(existsSync(heartbeatPath)).toBe(true);
    
    // 检查心跳内容
    const heartbeat = JSON.parse(readFileSync(heartbeatPath, 'utf-8'));
    expect(heartbeat.sessionId).toBe(sessionId);
    expect(heartbeat.status).toBe('active');
    
    // 检查活跃状态
    const isActive = await ws.isWorkspaceActive(sessionId);
    expect(isActive).toBe(true);
    
    ws.restore();
  });
  
  it('should return false for inactive session', async () => {
    const ws = await importWorkspaceService();
    
    const isActive = await ws.isWorkspaceActive('non-existent-session');
    expect(isActive).toBe(false);
    
    ws.restore();
  });
  
  it('should generate task index file', async () => {
    const ws = await importWorkspaceService();
    
    const task = {
      id: 'task-123',
      title: 'Test Task',
      status: 'in_progress',
      priority: 'high',
    };
    
    const indexPath = await ws.generateTaskIndex(task);
    
    expect(existsSync(indexPath)).toBe(true);
    
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('task-123');
    expect(content).toContain('Test Task');
    expect(content).toContain('in_progress');
    
    ws.restore();
  });
  
  it('should generate task detail file', async () => {
    const ws = await importWorkspaceService();
    
    const task = {
      id: 'task-456',
      title: 'Detail Test Task',
      description: 'A task for testing detail generation',
      status: 'todo',
      priority: 'medium',
      deadline: null,
      assignees: ['member-1'],
      checkItems: [{ text: 'Item 1', completed: false }],
    };
    
    const comments = [
      { author: 'User', content: 'Please start', createdAt: '2026-01-01' },
    ];
    
    const detailPath = await ws.generateTaskDetail(task, comments);
    
    expect(existsSync(detailPath)).toBe(true);
    
    const content = readFileSync(detailPath, 'utf-8');
    expect(content).toContain('Detail Test Task');
    expect(content).toContain('A task for testing detail generation');
    expect(content).toContain('Item 1');
    expect(content).toContain('Please start');
    
    ws.restore();
  });
  
  it('should generate SOP stage index file', async () => {
    const ws = await importWorkspaceService();
    
    const task = { id: 'sop-task-1', title: 'SOP Task' };
    const stage = { id: 'stage-1', label: 'Planning', type: 'ai_auto' };
    
    const indexPath = await ws.generateSOPStageIndex(task, stage);
    
    expect(existsSync(indexPath)).toBe(true);
    
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('SOP Task');
    expect(content).toContain('Planning');
    expect(content).toContain('ai_auto');
    
    ws.restore();
  });
});

describe('Context Request Parser', () => {
  it('should parse single context request', async () => {
    const { parseContextRequest } = await import('@/lib/context-request-parser');
    
    const message = `好的，我来处理这个任务。

请求上下文:
- 类型: task_detail
- 参数: { "task_id": "task-123" }

请等待我获取更多信息。`;
    
    const requests = parseContextRequest(message);
    expect(requests).toHaveLength(1);
    expect(requests[0].type).toBe('task_detail');
    expect(requests[0].params).toEqual({ task_id: 'task-123' });
  });
  
  it('should parse multiple context requests', async () => {
    const { parseContextRequest } = await import('@/lib/context-request-parser');
    
    const message = `需要获取更多信息：

请求上下文:
- 类型: task_detail
- 参数: { "task_id": "task-1" }

请求上下文:
- 类型: project_detail
- 参数: { "project_id": "proj-1" }
`;
    const requests = parseContextRequest(message);
    expect(requests).toHaveLength(2);
    expect(requests[0].type).toBe('task_detail');
    expect(requests[1].type).toBe('project_detail');
  });
  
  it('should handle invalid format gracefully', async () => {
    const { parseContextRequest } = await import('@/lib/context-request-parser');
    
    const message = `这是一条普通消息，没有上下文请求格式。`;
    const requests = parseContextRequest(message);
    expect(requests).toHaveLength(0);
  });
});

describe('Template Rendering', () => {
  it('should render task-push template with workspace_active variable', async () => {
    const { renderTemplate } = await import('@/lib/template-engine');
    
    const template = `## 可用上下文

{{#workspace_active}}
- 本地文件: .context/tasks/{{task_id}}/detail.md
{{/workspace_active}}
{{^workspace_active}}
- MCP 工具: get_task(task_id="{{task_id}}", detail=true)
{{/workspace_active}}
`;
    
    // workspace_active = true
    const result1 = renderTemplate(template, {
      task_id: 'task-123',
      workspace_active: true,
    });
    expect(result1).toContain('.context/tasks/task-123/detail.md');
    expect(result1).not.toContain('get_task');
    
    // workspace_active = false
    const result2 = renderTemplate(template, {
      task_id: 'task-123',
      workspace_active: false,
    });
    expect(result2).toContain('get_task');
    expect(result2).not.toContain('.context/tasks');
  });
  
  it('should render sop-task-push template with workspace_active variable', async () => {
    const { renderTemplate } = await import('@/lib/template-engine');
    
    const template = `## 可用上下文

{{#workspace_active}}
- 当前阶段详情: .context/sop/current-stage.md
{{/workspace_active}}
{{^workspace_active}}
- MCP 工具: get_sop_context(task_id="{{task_id}}")
{{/workspace_active}}
`;
    
    const result = renderTemplate(template, {
      task_id: 'sop-task-1',
      workspace_active: true,
    });
    
    expect(result).toContain('.context/sop/current-stage.md');
  });
});
