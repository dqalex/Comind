import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * GET /api/blog/[id]
 * 获取单个博客文章详情（公开访问，无需登录）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 查询博客类型的文档
    const doc = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, id),
        eq(documents.type, 'blog')
      ),
    });

    if (!doc) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    // 返回文档内容（公开信息）
    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      type: doc.type,
      projectTags: doc.projectTags,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
    });
  } catch (error) {
    console.error('Failed to fetch blog post:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog post' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/blog/[id] - 更新博客文章
 * 仅管理员可用
 */
export const PUT = withAuth(async (
  request: NextRequest,
  _auth: AuthResult,
  context?: RouteContext<{ id: string }>
) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const { title, content, projectTags } = body;

    // 检查文档是否存在且是 blog 类型
    const [existing] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.type, 'blog')));

    if (!existing) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    const updateData: Partial<typeof documents.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (projectTags !== undefined) updateData.projectTags = projectTags;

    const result = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, id))
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Failed to update blog post:', error);
    return NextResponse.json(
      { error: 'Failed to update blog post' },
      { status: 500 }
    );
  }
}, { requireAdmin: true });

/**
 * DELETE /api/blog/[id] - 删除博客文章
 * 仅管理员可用
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  _auth: AuthResult,
  context?: RouteContext<{ id: string }>
) => {
  try {
    const { id } = await context!.params;

    // 检查文档是否存在且是 blog 类型
    const [existing] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.type, 'blog')));

    if (!existing) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    await db.delete(documents).where(eq(documents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete blog post:', error);
    return NextResponse.json(
      { error: 'Failed to delete blog post' },
      { status: 500 }
    );
  }
}, { requireAdmin: true });
