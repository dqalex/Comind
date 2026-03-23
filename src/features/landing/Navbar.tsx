'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { TeamClawLogo } from '@/shared/layout/Logo';
import { Button } from '@/shared/ui/button';
import { useAuthStore } from '@/domains';
import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { LoginModal } from './LoginModal';

interface NavbarProps {
  locale?: 'en' | 'zh';
  onLocaleChange?: (locale: 'en' | 'zh') => void;
}

export function Navbar({ locale = 'en', onLocaleChange }: NavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [scrolled, setScrolled] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLocaleMenu, setShowLocaleMenu] = useState(false);
  // 从 URL 获取 redirect 参数
  const redirectPath = searchParams.get('redirect');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 检测 URL 参数，自动打开登录弹窗
  useEffect(() => {
    if (searchParams.get('login') === 'true' && !isAuthenticated) {
      setShowLoginModal(true);
      // 清理 URL 参数
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('login');
        router.replace(url.pathname + url.search, { scroll: false });
      }
    }
  }, [searchParams, isAuthenticated, router]);

  // 登录成功后的回调
  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    // 跳转到原来的页面或 dashboard
    router.push(redirectPath || '/dashboard');
  };

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#020817]/80 backdrop-blur-md border-b border-white/5' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-white/5 p-1.5 rounded-lg border border-white/10 group-hover:bg-white/10 transition-colors">
              <TeamClawLogo className="w-6 h-6" />
            </div>
            <span className="font-display font-bold text-xl text-white tracking-tight">TeamClaw</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link href="/#features" className="hover:text-white transition-colors">
              {locale === 'en' ? 'Features' : '功能'}
            </Link>
            <Link href="/wiki" className="hover:text-white transition-colors">
              {locale === 'en' ? 'Docs' : '文档'}
            </Link>
            <Link href="/blog" className="hover:text-white transition-colors">
              {locale === 'en' ? 'Blog' : '博客'}
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* 语言切换 */}
            <div className="relative">
              <button
                onClick={() => setShowLocaleMenu(!showLocaleMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
              >
                <Globe className="w-4 h-4" />
                <span>{locale === 'en' ? 'EN' : '中文'}</span>
              </button>
              {showLocaleMenu && (
                <div className="absolute top-full right-0 mt-2 py-1 rounded-lg bg-[#0B1121] border border-white/10 shadow-xl min-w-[100px]">
                  <button
                    onClick={() => { onLocaleChange?.('en'); setShowLocaleMenu(false); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors ${
                      locale === 'en' ? 'text-[#0056ff]' : 'text-slate-300'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => { onLocaleChange?.('zh'); setShowLocaleMenu(false); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors ${
                      locale === 'zh' ? 'text-[#0056ff]' : 'text-slate-300'
                    }`}
                  >
                    中文
                  </button>
                </div>
              )}
            </div>

            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-[#0056ff] hover:bg-[#0046cc] text-white font-medium px-6">
                  {locale === 'en' ? 'Go to Dashboard' : '进入控制台'}
                </Button>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
                >
                  {locale === 'en' ? 'Login' : '登录'}
                </button>
                <Button 
                  onClick={() => setShowLoginModal(true)}
                  className="bg-[#0056ff] hover:bg-[#0046cc] text-white font-medium px-6 shadow-[0_0_20px_rgba(0,86,255,0.3)] hover:shadow-[0_0_25px_rgba(0,86,255,0.5)] transition-all"
                >
                  {locale === 'en' ? 'Get Early Access' : '抢先体验'}
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        locale={locale}
      />
    </>
  );
}
