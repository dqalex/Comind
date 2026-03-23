'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/domains/auth';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { LogOut, Key, User, Settings, ChevronDown, Shield } from 'lucide-react';
import clsx from 'clsx';

export default function UserMenu() {
  const router = useRouter();
  const { t } = useTranslation();
  // 精确 selector 订阅
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, useCallback(() => setIsOpen(false), []));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 未登录时显示登录按钮
  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => router.push('/')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <User className="w-4 h-4" />
        <span>{t('auth.login')}</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200',
          'hover:bg-slate-100 dark:hover:bg-white/[0.05]',
          isOpen && 'bg-slate-100 dark:bg-white/[0.05]'
        )}
        aria-label={t('user.menu')}
      >
        {/* 头像 */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
          {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || 'U'}
        </div>
        {/* 用户名（桌面端显示） */}
        <span className="hidden md:block text-sm font-medium max-w-[100px] truncate" style={{ color: 'var(--text-primary)' }}>
          {user.name || user.email.split('@')[0]}
        </span>
        {/* 管理员标记 */}
        {user.role === 'admin' && (
          <Shield className="w-3.5 h-3.5 text-amber-500" />
        )}
        <ChevronDown className={clsx(
          'w-3.5 h-3.5 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} style={{ color: 'var(--text-tertiary)' }} />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-float border z-50 py-2 animate-fadeIn" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {/* 用户信息区域 */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {user.name || t('common.unnamed')}
                  </span>
                  {user.role === 'admin' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                      {t('auth.admin')}
                    </span>
                  )}
                </div>
                <span className="text-xs truncate block" style={{ color: 'var(--text-tertiary)' }}>
                  {user.email}
                </span>
              </div>
            </div>
          </div>

          {/* 菜单项 */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => { setIsOpen(false); router.push('/settings?tab=mcp-token'); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
            >
              <Key className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('auth.mcpToken')}</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsOpen(false); router.push('/settings'); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
            >
              <Settings className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('nav.settings')}</span>
            </button>
          </div>

          {/* 退出登录 */}
          <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-500">
                {isLoggingOut ? t('auth.loggingOut') : t('auth.logout')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
