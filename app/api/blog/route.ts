import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/with-auth';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { generateId } from '@/lib/id';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 分页配置
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * 获取分页参数
 */
function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10))
  );
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * GET /api/blog - 获取公开的博客文章列表（支持分页）
 * 无需认证，返回所有类型为 blog 且 projectId 为 null（公开）的文档
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, offset } = getPaginationParams(searchParams);

    const conditions = [
      eq(documents.type, 'blog'),
      isNull(documents.projectId), // 只返回公开博客
    ];

    // 获取总数量
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(...conditions));

    // 分页查询
    const data = await db
      .select({
        id: documents.id,
        title: documents.title,
        type: documents.type,
        projectTags: documents.projectTags,
        links: documents.links,
        backlinks: documents.backlinks,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasMore: offset + data.length < count,
      },
    });
  } catch (error) {
    console.error('[GET /api/blog] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog posts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/blog - 创建博客文章
 * 仅管理员可用
 */
export const POST = withAuth(async (request, _auth) => {
  try {
    const body = await request.json();
    const { title, content, projectTags } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const now = new Date();
    const id = generateId();

    const result = await db.insert(documents).values({
      id,
      title,
      content: content || '',
      type: 'blog',
      source: 'local',
      projectTags: projectTags || [],
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create blog post:', error);
    return NextResponse.json(
      { error: 'Failed to create blog post' },
      { status: 500 }
    );
  }
}, { requireAdmin: true });
