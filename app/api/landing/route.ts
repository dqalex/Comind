import { NextRequest, NextResponse } from 'next/server';
import { db, landingPages, renderTemplates, users } from '@/db';
import { eq, and } from 'drizzle-orm';
import { validateAuth, verifySecurityCode } from '@/lib/auth';
import { syncMdToHtml } from '@/shared/lib/slot-sync';
import type { SlotDef } from '@/shared/lib/slot-sync';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * 从完整 HTML 文档中提取 body 内容，并保留 head 中的 style 标签
 * syncMdToHtml 返回 <!DOCTYPE html><html><head>...</head><body>...</body></html>
 * 前端需要 body 内容 + 必要的 style 标签
 */
function extractBodyContent(fullHtml: string): string {
  // 提取 <head> 中的 <style> 标签（data-md-styles 和 data-studio-css）
  const stylePattern = /<style[^>]*data-(md-styles|studio-css)[^>]*>[\s\S]*?<\/style>/gi;
  const styles = fullHtml.match(stylePattern) || [];

  // 匹配 <body>...</body> 或 <body ...>...</body>
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyContent = '';
  if (bodyMatch) {
    bodyContent = bodyMatch[1].trim();
  } else {
    // 如果没有 body 标签，返回整个 HTML（减去 DOCTYPE 和 html 标签）
    bodyContent = fullHtml
      .replace(/<!DOCTYPE html>\s*/i, '')
      .replace(/<html[^>]*>\s*/i, '')
      .replace(/\s*<\/html>/i, '')
      .replace(/<head>[\s\S]*<\/head>/i, '')
      .trim();
  }

  // 如果有提取到的 style 标签，注入到 body 内容开头
  if (styles.length > 0) {
    return styles.join('\n') + '\n' + bodyContent;
  }

  return bodyContent;
}

/**
 * GET /api/landing - 获取首页数据（公开 API，无需认证）
 * 从独立的 landing_pages 表获取数据，确保安全隔离
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locale = searchParams.get('locale') || 'en';
    const validLocale = locale === 'zh' ? 'zh' : 'en';

    // 从独立的 landing_pages 表获取首页内容
    const [landingPage] = await db.select({
      id: landingPages.id,
      locale: landingPages.locale,
      title: landingPages.title,
      content: landingPages.content,
      renderedHtml: landingPages.renderedHtml,  // 预渲染的 HTML 缓存
      renderTemplateId: landingPages.renderTemplateId,
      metaTitle: landingPages.metaTitle,
      metaDescription: landingPages.metaDescription,
    }).from(landingPages).where(
      and(
        eq(landingPages.locale, validLocale),
        eq(landingPages.status, 'published')
      )
    );

    // 获取首页渲染模板
    const templateId = landingPage?.renderTemplateId || 'rt-builtin-landing-page';
    const [template] = await db.select({
      id: renderTemplates.id,
      htmlTemplate: renderTemplates.htmlTemplate,
      cssTemplate: renderTemplates.cssTemplate,
      slots: renderTemplates.slots,
    }).from(renderTemplates).where(eq(renderTemplates.id, templateId));

    if (!landingPage || !template) {
      return NextResponse.json({ error: 'Landing data not found' }, { status: 404 });
    }

    // 如果有预渲染的 HTML 缓存，直接返回（SEO 友好）
    // 否则使用 syncMdToHtml 渲染（服务端直接渲染，无需 DOMParser）
    // 注意：即使有缓存，也需要提取 body 部分供前端渲染
    let renderedHtml = landingPage.renderedHtml;
    if (!renderedHtml || (typeof renderedHtml === 'string' && renderedHtml.includes('@slot:'))) {
      if (landingPage.content) {
        try {
          const result = syncMdToHtml(
            landingPage.content,
            template.htmlTemplate,
            template.slots as Record<string, SlotDef>,
            template.cssTemplate || undefined
          );
          // syncMdToHtml 返回完整 HTML 文档，提取 body 内容供前端渲染
          renderedHtml = extractBodyContent(result.html);
        } catch (err) {
          console.error('[GET /api/landing] syncMdToHtml error:', err);
          // fallback to raw content wrapped
          renderedHtml = `<div class="landing-page"><pre>${landingPage.content}</pre></div>`;
        }
      }
    } else if (renderedHtml && typeof renderedHtml === 'string') {
      // 有缓存但不是通过 syncMdToHtml 生成的，需要提取 body
      if (renderedHtml.includes('<!DOCTYPE') || renderedHtml.includes('<html')) {
        renderedHtml = extractBodyContent(renderedHtml);
      }
    }

    return NextResponse.json({
      // 保持与原 API 兼容的响应格式
      document: {
        id: landingPage.id,
        content: landingPage.content,
      },
      template: template,
      // 直接返回缓存的预渲染 HTML（SEO 友好）
      renderedHtml,
      // 额外的 SEO 数据（可选）
      meta: {
        title: landingPage.metaTitle,
        description: landingPage.metaDescription,
      },
    });
  } catch (error) {
    console.error('[GET /api/landing] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch landing data' }, { status: 500 });
  }
}

/**
 * PUT /api/landing - 更新首页内容（需要认证，供 LandingContentEditor 使用）
 * Body: { locale, content, metaTitle?, metaDescription?, publish?: boolean, securityCode?: string }
 * - publish=false (默认): 仅保存为草稿
 * - publish=true: 发布到前台，需要安全码验证
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证认证
    const auth = await validateAuth(request);
    if (!auth.valid || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { locale, content, renderedHtml, metaTitle, metaDescription, publish, securityCode } = body;

    if (!locale || (locale !== 'en' && locale !== 'zh')) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    const landingId = locale === 'zh' ? 'landing-zh' : 'landing-en';

    // 如果是发布操作，需要验证安全码
    if (publish) {
      // 检查是否设置了安全码
      const [user] = await db.select({ securityCodeHash: users.securityCodeHash })
        .from(users)
        .where(eq(users.id, auth.user.id));

      if (user?.securityCodeHash) {
        if (!securityCode) {
          return NextResponse.json({ error: 'Security code required for publishing' }, { status: 401 });
        }
        const valid = await verifySecurityCode(securityCode, user.securityCodeHash, auth.user.id);
        if (!valid) {
          return NextResponse.json({ error: 'Invalid security code' }, { status: 401 });
        }
      }
    }

    // 更新 landing_pages 表
    const updateData: Record<string, unknown> = {
      content,
      metaTitle,
      metaDescription,
      updatedAt: new Date(),
    };

    // 如果是发布操作，设置状态为 published，并保存渲染后的 HTML 缓存
    if (publish) {
      updateData.status = 'published';
      updateData.renderedHtml = renderedHtml || null;  // 保存前端渲染好的 HTML
    }

    const result = await db.update(landingPages)
      .set(updateData)
      .where(eq(landingPages.id, landingId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('[PUT /api/landing] Error:', error);
    return NextResponse.json({ error: 'Failed to update landing data' }, { status: 500 });
  }
}
