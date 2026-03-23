/**
 * 审计日志 API
 * 
 * GET /api/audit-logs - 查询审计日志
 * 
 * 查询参数：
 *   source    - 日志来源（mcp, mcp_external, chat_channel, gateway, system）
 *   memberId  - 成员 ID
 *   agentId   - Agent ID
 *   action    - 工具名称（模糊匹配）
 *   success   - 是否成功（true/false）
 *   startTime - 开始时间（ISO 8601）
 *   endTime   - 结束时间（ISO 8601）
 *   limit     - 每页数量（默认 50，最大 200）
 *   offset    - 偏移量
 */

import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';
import { queryAuditLogs, type AuditSource } from '@/lib/audit-log';
import { withAuth } from '@/lib/with-auth';

const VALID_SOURCES: AuditSource[] = ['mcp', 'mcp_external', 'chat_channel', 'gateway', 'system'];

// GET /api/audit-logs - 查询审计日志
// v0.9.8: 需要登录才能访问（审计日志包含敏感操作记录）
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    
    const filter: {
      source?: AuditSource;
      memberId?: string;
      agentId?: string;
      action?: string;
      success?: boolean;
      startTime?: Date;
      endTime?: Date;
      limit?: number;
      offset?: number;
    } = {};
    
    const source = searchParams.get('source');
    if (source && VALID_SOURCES.includes(source as AuditSource)) {
      filter.source = source as AuditSource;
    }
    
    const memberId = searchParams.get('memberId');
    if (memberId) filter.memberId = memberId;
    
    const agentId = searchParams.get('agentId');
    if (agentId) filter.agentId = agentId;
    
    const action = searchParams.get('action');
    if (action) filter.action = action;
    
    const success = searchParams.get('success');
    if (success === 'true') filter.success = true;
    if (success === 'false') filter.success = false;
    
    const startTime = searchParams.get('startTime');
    if (startTime) {
      const d = new Date(startTime);
      if (!isNaN(d.getTime())) filter.startTime = d;
    }
    
    const endTime = searchParams.get('endTime');
    if (endTime) {
      const d = new Date(endTime);
      if (!isNaN(d.getTime())) filter.endTime = d;
    }
    
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    filter.limit = Math.min(Math.max(1, limit), 200);
    
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    filter.offset = Math.max(0, offset);
    
    const { logs, total } = await queryAuditLogs(filter);
    
    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: filter.limit,
        offset: filter.offset,
      },
    });
  } catch (error) {
    console.error('[TeamClaw-v3] GET /api/audit-logs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
});
