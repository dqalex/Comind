/**
 * Agent MCP Token 能力测试
 * 
 * 测试范围：
 * - Token 服务
 * - MCP 工具定义
 * - Handler 注册
 */
import { describe, it, expect } from 'vitest';

describe('Agent MCP Token', () => {
  describe('Token Service', () => {
    it('should export token functions', async () => {
      const service = await import('@/lib/agent-token');
      
      expect(typeof service.getOrCreateAgentToken).toBe('function');
      expect(typeof service.validateAgentToken).toBe('function');
      expect(typeof service.getAgentTokenByMemberId).toBe('function');
    });
  });

  describe('MCP Tool Definitions', () => {
    it('should have new tools defined', async () => {
      const { TEAMCLAW_TOOLS } = await import('@/core/mcp/definitions');
      
      // Agent Token tools
      expect(TEAMCLAW_TOOLS.get_agent_mcp_token).toBeDefined();
      expect(TEAMCLAW_TOOLS.list_agent_mcp_tokens).toBeDefined();
      expect(TEAMCLAW_TOOLS.revoke_agent_mcp_token).toBeDefined();
      
      // Context tools
      expect(TEAMCLAW_TOOLS.get_task_detail).toBeDefined();
      expect(TEAMCLAW_TOOLS.get_project_detail).toBeDefined();
      expect(TEAMCLAW_TOOLS.get_document_detail).toBeDefined();
      expect(TEAMCLAW_TOOLS.get_sop_previous_output).toBeDefined();
      expect(TEAMCLAW_TOOLS.get_sop_knowledge_layer).toBeDefined();
    });

    it('should have correct descriptions', async () => {
      const { TEAMCLAW_TOOLS } = await import('@/core/mcp/definitions');
      
      expect(TEAMCLAW_TOOLS.get_agent_mcp_token.description).toContain('Agent');
      // get_task_detail is deprecated in v1.0.1, use get_task with detail=true
      expect(TEAMCLAW_TOOLS.get_task_detail.description).toContain('DEPRECATED');
    });

    it('should have correct parameter definitions', async () => {
      const { TEAMCLAW_TOOLS } = await import('@/core/mcp/definitions');
      
      // get_agent_mcp_token
      expect(TEAMCLAW_TOOLS.get_agent_mcp_token.parameters.properties.member_id).toBeDefined();
      
      // get_task_detail
      expect(TEAMCLAW_TOOLS.get_task_detail.parameters.properties.task_id).toBeDefined();
      expect(TEAMCLAW_TOOLS.get_task_detail.parameters.required).toContain('task_id');
    });
  });

  describe('Handler Registration', () => {
    it('should have handlers registered', async () => {
      const { TOOL_HANDLERS } = await import('@/app/api/mcp/handlers/tool-registry');
      
      // Agent Token handlers
      expect(typeof TOOL_HANDLERS.get_agent_mcp_token).toBe('function');
      expect(typeof TOOL_HANDLERS.list_agent_mcp_tokens).toBe('function');
      expect(typeof TOOL_HANDLERS.revoke_agent_mcp_token).toBe('function');
      
      // Context handlers
      expect(typeof TOOL_HANDLERS.get_task_detail).toBe('function');
      expect(typeof TOOL_HANDLERS.get_project_detail).toBe('function');
      expect(typeof TOOL_HANDLERS.get_document_detail).toBe('function');
      expect(typeof TOOL_HANDLERS.get_sop_previous_output).toBe('function');
      expect(typeof TOOL_HANDLERS.get_sop_knowledge_layer).toBe('function');
    });
  });

  describe('Chat MCP API', () => {
    it('should have chat-mcp route file', async () => {
      // 检查文件是否存在
      const fs = await import('fs/promises');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'app/api/chat-mcp/route.ts');
      
      const stat = await fs.stat(routePath);
      expect(stat.isFile()).toBe(true);
    });
  });

  describe('Database Schema', () => {
    it('should have agent_mcp_tokens table defined', async () => {
      const schema = await import('@/db/schema');
      
      expect(schema.agentMcpTokens).toBeDefined();
      expect(schema.agentMcpTokens.memberId).toBeDefined();
      expect(schema.agentMcpTokens.tokenHash).toBeDefined();
      expect(schema.agentMcpTokens.encryptedToken).toBeDefined();
    });
  });
});
