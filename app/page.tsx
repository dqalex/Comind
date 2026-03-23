'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/features/landing/Navbar';

interface LandingData {
  document: { id: string; content: string };
  template: {
    id: string;
    htmlTemplate: string;
    cssTemplate: string | null;
    slots: Record<string, unknown>;
  };
  // 预渲染的 HTML（服务端直接返回，客户端只需显示）
  renderedHtml?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [locale, setLocale] = useState<'en' | 'zh'>('en');
  const [landingData, setLandingData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initChecked, setInitChecked] = useState(false);

  // 检查是否需要初始化
  useEffect(() => {
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data.needed) {
          router.push('/init');
        } else {
          setInitChecked(true);
        }
      })
      .catch(() => {
        setInitChecked(true);
      });
  }, [router]);

  // 获取 landing 数据（公开 API，无需登录）
  const fetchLandingData = async (loc: 'en' | 'zh') => {
    try {
      const res = await fetch(`/api/landing?locale=${loc}`);
      if (res.ok) {
        const data = await res.json();
        setLandingData(data);
      }
    } catch (err) {
      console.error('Failed to fetch landing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initChecked) return;
    const savedLocale = localStorage.getItem('teamclaw-language') || 'en';
    const loc = savedLocale as 'en' | 'zh';
    setLocale(loc);
    fetchLandingData(loc);
  }, [initChecked]);

  const handleLocaleChange = (newLocale: 'en' | 'zh') => {
    setLocale(newLocale);
    localStorage.setItem('teamclaw-language', newLocale);
    window.dispatchEvent(new CustomEvent('language-change', { detail: { locale: newLocale } }));
    setLoading(true);
    fetchLandingData(newLocale);
  };

  // 使用服务端预渲染的 HTML（服务端已调用 syncMdToHtml 渲染）
  const renderedHtml = landingData?.renderedHtml || '';

  // 初始化检查中，显示加载状态
  if (!initChecked) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-[#0056ff]/30">
      {/* 导航栏固定渲染 */}
      <Suspense fallback={<div className="h-20" />}>
        <Navbar locale={locale} onLocaleChange={handleLocaleChange} />
      </Suspense>

      {/* 主内容区：使用预渲染的 HTML */}
      <main>
        {loading ? (
          <div className="pt-32 pb-20 text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-slate-800 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-slate-800 rounded w-96 mx-auto"></div>
            </div>
          </div>
        ) : renderedHtml ? (
          <div
            className="landing-content"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <div className="pt-32 pb-20 text-center text-slate-500">
            <p>Landing page content not available.</p>
          </div>
        )}
      </main>
    </div>
  );
}
