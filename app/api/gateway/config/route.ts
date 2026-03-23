/**
 * Gateway 配置 API
 * 
 * v0.9.8: Admin Only - 只有管理员可以管理 Gateway 配置
 * 
 * GET  - 获取当前 Gateway 配置
 * POST - 保存新的 Gateway 配置
 * DELETE - 删除 Gateway 配置
 */

import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import {
  getGatewayConfig,
  saveGatewayConfig,
  deleteGatewayConfig,
  initServerGatewayClient,
  getServerGatewayClient,
} from '@/lib/server-gateway-client';
import { db } from '@/db';
import { gatewayConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, withAdminAuth } from '@/lib/with-auth';

// GET - 获取配置（需要登录，但不限制角色）
export const GET = withAuth(async () => {
  try {
    const config = await getGatewayConfig();

    if (!config) {
      return NextResponse.json({
        data: null,
        error: null,
      });
    }

    // 不返回敏感信息
    return NextResponse.json({
      data: {
        id: config.id,
        url: config.url,
        mode: config.mode,
        status: config.status,
      },
      error: null,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('[API] Get gateway config error:', e);
    return NextResponse.json(
      { data: null, error: `Failed to get gateway config: ${errorMessage}` },
      { status: 500 }
    );
  }
});

// POST - 保存配置（Admin Only）
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    
    // 验证必填字段
    if (!body.url) {
      return NextResponse.json(
        { data: null, error: 'url is required' },
        { status: 400 }
      );
    }

    // 新建配置时 token 必填；更新已有配置时 token 可选（保留旧值）
    const existingConfigs = await db.select().from(gatewayConfigs);
    const hasExisting = existingConfigs.length > 0;
    if (!hasExisting && !body.token) {
      return NextResponse.json(
        { data: null, error: 'token is required for new configuration' },
        { status: 400 }
      );
    }

    // 验证 URL 格式
    try {
      const url = new URL(body.url);
      if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        return NextResponse.json(
          { data: null, error: 'URL must use ws:// or wss:// protocol' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { data: null, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // v0.9.8: 仅支持 server_proxy 模式（多用户安全要求）
    const mode = body.mode || 'server_proxy';
    if (mode !== 'server_proxy') {
      return NextResponse.json(
        { data: null, error: 'Only server_proxy mode is supported in v3.0 for multi-user security' },
        { status: 400 }
      );
    }

    // 获取旧配置的 token（更新时复用）
    let tokenToSave = body.token;
    if (!tokenToSave && hasExisting) {
      const oldConfig = existingConfigs[0];
      const { decryptToken } = await import('@/lib/security');
      tokenToSave = decryptToken(oldConfig.encryptedToken);
    }

    // 删除旧配置
    for (const config of existingConfigs) {
      await deleteGatewayConfig(config.id);
    }

    // 保存新配置
    const id = await saveGatewayConfig({
      url: body.url,
      token: tokenToSave,
      mode,
    });

    // 如果是服务端代理模式，立即尝试连接
    if (mode === 'server_proxy') {
      try {
        await initServerGatewayClient();
      } catch (e) {
        console.error('[API] Failed to connect to gateway:', e);
        // 连接失败不影响配置保存
      }
    }

    return NextResponse.json({
      data: {
        id,
        mode,
        url: body.url,
        // v0.9.8: 不再返回 token 给前端（安全考量）
      },
      error: null,
    }, { status: 201 });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('[API] Save gateway config error:', e);
    return NextResponse.json(
      { data: null, error: `Failed to save gateway config: ${errorMessage}` },
      { status: 500 }
    );
  }
});

// DELETE - 删除配置（Admin Only）
export const DELETE = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { data: null, error: 'id is required' },
        { status: 400 }
      );
    }

    // 校验资源存在性
    const existing = await db.select({ id: gatewayConfigs.id }).from(gatewayConfigs).where(eq(gatewayConfigs.id, id)).get();
    if (!existing) {
      return NextResponse.json(
        { data: null, error: 'Gateway config not found' },
        { status: 404 }
      );
    }

    // 断开当前连接
    const client = getServerGatewayClient();
    if (client.isConnected) {
      client.disconnect();
    }

    await deleteGatewayConfig(id);

    return NextResponse.json({
      data: { deleted: true },
      error: null,
    });
  } catch (e) {
    console.error('[API] Delete gateway config error:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to delete gateway config' },
      { status: 500 }
    );
  }
});
