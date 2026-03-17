'use client';

import { useUIStore } from '@/domains';
import Sidebar from './Sidebar';
import AuthGuard from './AuthGuard';
import clsx from 'clsx';

/**
 * 应用外壳：Sidebar + 主内容区
 * 
 * v3.0: 所有使用 AppShell 的页面都需要登录才能访问
 * 
 * 根据 sidebar 展开/收起状态动态调整左边距
 * - 展开态：w-[248px] / lg:w-[264px]
 * - 收起态：w-[60px]
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  // 精确 selector 订阅
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const hydrated = useUIStore((s) => s.hydrated);
  const isOpen = hydrated ? sidebarOpen : true;

  return (
    <AuthGuard>
      <Sidebar />
      <main
        className={clsx(
          'min-h-screen transition-all duration-300 ease-out',
          isOpen ? 'ml-[248px] lg:ml-[264px]' : 'ml-[60px]'
        )}
      >
        {children}
      </main>
    </AuthGuard>
  );
}
