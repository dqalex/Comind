'use client';

/**
 * AuthGuard - 页面认证保护组件
 * 
 * 优化点：
 * 1. 使用骨架屏代替 Loading 文字，减少视觉闪烁
 * 2. 利用 localStorage 缓存的 auth 状态先渲染，后台静默验证
 * 3. 仅在必要时显示加载状态
 * 
 * 用法：
 * 1. 包裹需要登录才能访问的页面内容
 * 2. 未登录用户会被重定向到 /login
 * 3. 支持 admin 角色限制
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/domains';

interface AuthGuardProps {
  children: React.ReactNode;
  /** 是否需要 admin 角色 */
  requireAdmin?: boolean;
  /** 自定义加载状态组件 */
  loadingComponent?: React.ReactNode;
  /** 是否使用骨架屏加载（推荐） */
  useSkeleton?: boolean;
}

// 骨架屏组件 - 模拟 AppShell 布局
function AuthSkeleton() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 侧边栏骨架 */}
      <div className="w-64 flex-shrink-0 border-r hidden lg:block" style={{ borderColor: 'var(--border)' }}>
        <div className="h-14 border-b flex items-center px-4" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
          <div className="ml-3 w-24 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        </div>
        <div className="p-3 space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
          ))}
        </div>
      </div>
      
      {/* 主内容区骨架 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏骨架 */}
        <div className="h-14 border-b flex items-center justify-between px-4" style={{ borderColor: 'var(--border)' }}>
          <div className="w-32 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            <div className="w-9 h-9 rounded-full animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
          </div>
        </div>
        
        {/* 内容骨架 */}
        <div className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* 标题区 */}
            <div className="flex items-center justify-between">
              <div className="w-48 h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
              <div className="w-24 h-9 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            </div>
            {/* 内容卡片 */}
            <div className="rounded-xl border p-6 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <div className="w-full h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
              <div className="w-3/4 h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
              <div className="w-1/2 h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthGuard({ 
  children, 
  requireAdmin = false,
  loadingComponent,
  useSkeleton = true,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // 精确 selector 订阅 - 减少不必要的重渲染
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  
  // 使用缓存状态减少闪烁
  const [showLoading, setShowLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // 计算是否应该显示骨架屏
  const shouldShowSkeleton = useMemo(() => {
    // 如果已经有认证状态，直接显示内容
    if (isAuthenticated && user) return false;
    // 如果明确未认证且验证完成，也不显示（会跳转）
    if (!isAuthenticated && !isLoading) return false;
    // 否则根据 showLoading 决定
    return showLoading;
  }, [isAuthenticated, user, isLoading, showLoading]);

  useEffect(() => {
    // 延迟显示 loading，避免快速切换时的闪烁
    const timer = setTimeout(() => {
      setShowLoading(true);
    }, 150); // 150ms 内完成验证则不显示 loading
    
    // 首次加载时检查登录状态
    const checkAuth = async () => {
      await fetchCurrentUser();
      setIsReady(true);
      clearTimeout(timer);
    };
    
    checkAuth();
    
    return () => clearTimeout(timer);
  }, [fetchCurrentUser]);

  useEffect(() => {
    // 检查完成后，根据状态决定是否跳转
    if (!isReady) return;

    if (!isAuthenticated) {
      // 未登录，跳转到首页并弹出登录窗口
      const redirectUrl = encodeURIComponent(pathname);
      router.replace(`/?login=true&redirect=${redirectUrl}`);
      return;
    }

    if (requireAdmin && user?.role !== 'admin') {
      // 需要 admin 但不是 admin，跳转到首页
      router.replace('/dashboard');
      return;
    }
  }, [isReady, isAuthenticated, user, requireAdmin, router, pathname]);

  // 显示骨架屏或自定义加载状态
  if (shouldShowSkeleton) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    if (useSkeleton) {
      return <AuthSkeleton />;
    }
  }

  // 未登录时返回 null（等待跳转）
  if (!isAuthenticated) {
    return null;
  }

  // 需要 admin 但不是 admin 时返回 null（等待跳转）
  if (requireAdmin && user?.role !== 'admin') {
    return null;
  }

  // 认证通过，渲染子组件
  return <>{children}</>;
}
