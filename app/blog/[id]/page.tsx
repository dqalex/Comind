'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Navbar } from '@/features/landing/Navbar';
import { Clock, ArrowLeft, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Document } from '@/db/schema';

// BlogPost 复用 Document 类型，content 在 Document 中已定义为 string | null
type BlogPost = Document;

export default function BlogPostPage() {
  const { t } = useTranslation();
  const params = useParams();
  const docId = params.id as string;
  
  const [locale, setLocale] = useState<'en' | 'zh'>('en');
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化语言
  useEffect(() => {
    const savedLocale = localStorage.getItem('teamclaw-language') || 'en';
    setLocale(savedLocale as 'en' | 'zh');
  }, []);

  // 加载博客文章详情（使用公共 API，无需登录）
  useEffect(() => {
    const loadBlogPost = async () => {
      if (!docId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // 使用公共博客 API 获取文章详情
        const response = await fetch(`/api/blog/${docId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(locale === 'en' ? 'Blog post not found' : '文章不存在');
          }
          throw new Error('Failed to fetch blog post');
        }
        
        const data = await response.json();
        setPost(data);
      } catch (err) {
        console.error('Failed to fetch blog post:', err);
        setError(err instanceof Error ? err.message : (locale === 'en' ? 'Failed to load blog post' : '加载文章失败'));
      } finally {
        setLoading(false);
      }
    };
    
    loadBlogPost();
  }, [docId, locale]);

  const handleLocaleChange = (newLocale: 'en' | 'zh') => {
    setLocale(newLocale);
    localStorage.setItem('teamclaw-language', newLocale);
  };

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* 导航栏 */}
      <Navbar locale={locale} onLocaleChange={handleLocaleChange} />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* 返回链接 */}
          <Link 
            href="/blog" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{locale === 'en' ? 'Back to Blog' : '返回博客'}</span>
          </Link>

          {error ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {locale === 'en' ? 'Error loading post' : '加载出错'}
              </h3>
              <p className="text-slate-500 mb-4">{error}</p>
              <Link 
                href="/blog"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0056ff] text-white rounded-lg hover:bg-[#0046cc] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {locale === 'en' ? 'Back to Blog' : '返回博客'}
              </Link>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0056ff]"></div>
            </div>
          ) : post ? (
            <article className="bg-[#0b1121] rounded-2xl border border-white/5 overflow-hidden">
              {/* 文章头部 */}
              <div className="p-8 border-b border-white/5">
                <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {format(new Date(post.updatedAt), locale === 'en' ? 'MMM d, yyyy' : 'yyyy年M月d日')}
                  </span>
                  {post.projectTags && post.projectTags.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#0056ff]/10 text-[#0056ff] text-xs font-medium">
                      {post.projectTags[0]}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  {post.title}
                </h1>
              </div>

              {/* 文章内容 */}
              <div className="p-8">
                <div className="md-preview blog-content max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {post.content || ''}
                  </ReactMarkdown>
                </div>
              </div>

              {/* 文章底部 */}
              <div className="px-8 py-6 border-t border-white/5 bg-[#0f172a]/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    {locale === 'en' ? 'Published on TeamClaw Blog' : '发布于 TeamClaw 博客'}
                  </span>
                  <Link 
                    href="/blog"
                    className="inline-flex items-center gap-2 text-[#0056ff] hover:text-[#0046cc] transition-colors"
                  >
                    <span>{locale === 'en' ? 'More articles' : '更多文章'}</span>
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </Link>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </div>
  );
}
