'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { format } from 'date-fns';
import { Navbar } from '@/features/landing/Navbar';
import { Clock, ArrowRight, BookOpen } from 'lucide-react';
import type { Document } from '@/db/schema';

interface BlogPost extends Document {
  summary?: string;
}

export default function BlogPage() {
  const { t } = useTranslation();
  const [locale, setLocale] = useState<'en' | 'zh'>('en');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化语言
  useEffect(() => {
    const savedLocale = localStorage.getItem('teamclaw-language') || 'en';
    setLocale(savedLocale as 'en' | 'zh');
  }, []);

  // 加载博客文章（使用公共 API，无需登录）
  useEffect(() => {
    const loadBlogPosts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/blog');
        if (!response.ok) {
          throw new Error('Failed to fetch blog posts');
        }
        
        const result = await response.json();
        
        // API 返回 { data: [...], pagination: {...} } 格式
        const postsArray = result.data || result;
        
        // 按时间降序排序
        const sortedPosts = postsArray
          .sort((a: BlogPost, b: BlogPost) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          .map((doc: BlogPost) => ({
            ...doc,
            // 由于没有返回 content，摘要留空或显示描述
            summary: '',
          }));
        
        setPosts(sortedPosts);
      } catch (err) {
        console.error('Failed to fetch blog posts:', err);
        setError(locale === 'en' ? 'Failed to load blog posts' : '加载博客文章失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadBlogPosts();
  }, [locale]);

  const handleLocaleChange = (newLocale: 'en' | 'zh') => {
    setLocale(newLocale);
    localStorage.setItem('teamclaw-language', newLocale);
  };

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* 导航栏 */}
      <Navbar locale={locale} onLocaleChange={handleLocaleChange} />

      {/* Hero 区域 */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0056ff]/10 border border-[#0056ff]/20 mb-6">
            <BookOpen className="w-4 h-4 text-[#0056ff]" />
            <span className="text-sm text-[#0056ff] font-medium">
              {locale === 'en' ? 'TeamClaw Blog' : 'TeamClaw 博客'}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            {locale === 'en' ? 'Latest Updates' : '最新动态'}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {locale === 'en'
              ? 'Product updates, technical insights, and best practices for AI agent collaboration.'
              : '产品更新、技术洞察和 AI Agent 协作的最佳实践。'}
          </p>
        </div>
      </section>

      {/* 博客列表 */}
      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          {error ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {locale === 'en' ? 'Error loading posts' : '加载出错'}
              </h3>
              <p className="text-slate-500 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#0056ff] text-white rounded-lg hover:bg-[#0046cc] transition-colors"
              >
                {locale === 'en' ? 'Retry' : '重试'}
              </button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0056ff]"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {locale === 'en' ? 'No posts yet' : '暂无文章'}
              </h3>
              <p className="text-slate-500">
                {locale === 'en'
                  ? 'Blog posts will appear here when created in Wiki with type "blog".'
                  : '在 Wiki 中创建类型为 "blog" 的文档，文章将显示在这里。'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="group bg-[#0b1121] rounded-2xl border border-white/5 overflow-hidden hover:border-[#0056ff]/30 transition-all duration-300"
                >
                  <Link href={`/blog/${post.id}`} className="block p-8">
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
                    <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-[#0056ff] transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-slate-400 leading-relaxed mb-4">{post.summary}</p>
                    <div className="flex items-center text-[#0056ff] font-medium">
                      <span>{locale === 'en' ? 'Read more' : '阅读全文'}</span>
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 创建博客提示 */}
      <section className="border-t border-white/5 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            {locale === 'en'
              ? 'Administrators can create blog posts in Wiki by setting document type to "blog".'
              : '管理员可以在 Wiki 中创建博客文章，只需将文档类型设置为 "blog"。'}
          </p>
        </div>
      </section>
    </div>
  );
}
