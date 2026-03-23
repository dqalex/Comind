'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRenderTemplateStore } from '@/domains';
import { Button } from '@/shared/ui/button';
import { Loader2, Save, Globe, Upload } from 'lucide-react';
import { useSecurityCode } from '@/shared/hooks/useSecurityCode';
import { SecurityCodeDialog } from '@/shared/layout/SecurityCodeDialog';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { syncMdToHtml } from '@/shared/lib/slot-sync';
import type { SlotDef } from '@/shared/lib/slot-sync';

const MarkdownEditor = dynamic(() => import('@/shared/editor/MarkdownEditor').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  ),
});

// 首页内容渲染模板 ID
const LANDING_TEMPLATE_ID = 'rt-builtin-landing-page';

interface LandingPage {
  id: string;
  locale: string;
  title: string;
  content: string | null;
}

export function LandingContentEditor() {
  const { templates: renderTemplates, fetchTemplates } = useRenderTemplateStore();
  const [activeLocale, setActiveLocale] = useState<'en' | 'zh'>('zh');
  const [editContent, setEditContent] = useState('');
  const [landingPages, setLandingPages] = useState<Record<'en' | 'zh', LandingPage | null>>({ en: null, zh: null });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 发布安全码验证
  const publishSecurity = useSecurityCode({
    onVerified: async () => {
      // 安全码验证通过，执行发布
      await doPublish();
    },
  });

  // 从独立的 /api/landing 获取首页数据
  const fetchLandingPage = useCallback(async (locale: 'en' | 'zh') => {
    try {
      const res = await fetch(`/api/landing?locale=${locale}`);
      if (res.ok) {
        const data = await res.json();
        // API 返回 { document: { id, content }, template: {...}, meta: {...} }
        return {
          id: data.document?.id || `landing-${locale}`,
          locale,
          title: locale === 'zh' ? '首页内容（中文）' : 'Landing Page (English)',
          content: data.document?.content || null,
        };
      }
    } catch (err) {
      console.error(`Failed to fetch landing page (${locale}):`, err);
    }
    return null;
  }, []);

  useEffect(() => {
    const init = async () => {
      const [enPage, zhPage] = await Promise.all([
        fetchLandingPage('en'),
        fetchLandingPage('zh'),
      ]);
      setLandingPages({ en: enPage, zh: zhPage });
      await fetchTemplates();
      setLoading(false);
    };
    init();
  }, [fetchLandingPage, fetchTemplates]);

  const landingTemplate = renderTemplates.find(t => t.id === LANDING_TEMPLATE_ID);

  useEffect(() => {
    const page = landingPages[activeLocale];
    if (page?.content) {
      setEditContent(page.content);
    } else if (landingTemplate?.mdTemplate) {
      setEditContent(landingTemplate.mdTemplate);
    }
  }, [landingPages, activeLocale, landingTemplate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/landing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: activeLocale, content: editContent, publish: false }),
      });
      if (res.ok) {
        // 更新本地状态
        setLandingPages(prev => ({
          ...prev,
          [activeLocale]: { ...prev[activeLocale]!, content: editContent },
        }));
      } else {
        console.error('Failed to save landing page');
      }
    } catch (err) {
      console.error('Failed to save landing page:', err);
    } finally {
      setSaving(false);
    }
  };

  // 执行发布（在安全码验证后调用）
  const doPublish = async () => {
    setPublishing(true);
    try {
      // 发布时先渲染 HTML 供缓存
      let renderedHtml = '';
      if (landingTemplate) {
        try {
          const result = syncMdToHtml(
            editContent,
            landingTemplate.htmlTemplate,
            landingTemplate.slots as Record<string, SlotDef>,
            landingTemplate.cssTemplate || undefined
          );
          renderedHtml = result.html;
        } catch (err) {
          console.error('[doPublish] syncMdToHtml error:', err);
        }
      }

      const res = await fetch('/api/landing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: activeLocale,
          content: editContent,
          renderedHtml,  // 渲染后的 HTML（供服务端缓存）
          publish: true,
          securityCode: publishSecurity.code,
        }),
      });
      if (res.ok) {
        // 更新本地状态
        setLandingPages(prev => ({
          ...prev,
          [activeLocale]: { ...prev[activeLocale]!, content: editContent },
        }));
      } else {
        const data = await res.json();
        console.error('Failed to publish landing page:', data.error);
      }
    } catch (err) {
      console.error('Failed to publish landing page:', err);
    } finally {
      setPublishing(false);
      publishSecurity.setCode('');
    }
  };

  // 发布按钮点击
  const handlePublish = () => {
    publishSecurity.verify();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 精简工具栏：语言切换 + 保存/发布 */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          {/* 语言切换 */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setActiveLocale('en')}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5',
                activeLocale === 'en'
                  ? 'bg-primary-500 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
              style={{ color: activeLocale === 'en' ? undefined : 'var(--text-secondary)' }}
            >
              <Globe className="w-3.5 h-3.5" />
              EN
            </button>
            <button
              onClick={() => setActiveLocale('zh')}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5',
                activeLocale === 'zh'
                  ? 'bg-primary-500 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
              style={{ color: activeLocale === 'zh' ? undefined : 'var(--text-secondary)' }}
            >
              <Globe className="w-3.5 h-3.5" />
              中文
            </button>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {landingPages[activeLocale]?.title || `Landing Page (${activeLocale.toUpperCase()})`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 保存按钮 */}
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            variant="secondary"
            className="text-xs px-3 py-1.5 h-auto"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            {activeLocale === 'en' ? 'Save' : '保存'}
          </Button>
          {/* 发布按钮 */}
          <Button
            onClick={handlePublish}
            disabled={publishing || loading}
            className="bg-primary-500 hover:bg-primary-600 text-white text-xs px-3 py-1.5 h-auto"
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
            {activeLocale === 'en' ? 'Publish' : '发布'}
          </Button>
        </div>
      </div>

      {/* 直接复用 MarkdownEditor 全套能力（编辑/预览/分屏/HTML模板可视化） */}
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor
          key={activeLocale}
          value={editContent}
          onChange={setEditContent}
          renderHtml={landingTemplate?.htmlTemplate}
          renderCss={landingTemplate?.cssTemplate ?? undefined}
          slotDefs={landingTemplate?.slots as Record<string, import('@/lib/slot-sync').SlotDef>}
        />
      </div>

      {/* 发布安全码验证对话框 */}
      <SecurityCodeDialog
        isOpen={publishSecurity.showDialog}
        securityCode={publishSecurity}
        title="发布验证"
        description="发布首页内容需要验证安全码"
      />
    </div>
  );
}
