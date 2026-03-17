'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/domains';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 精确 selector 订阅
  const theme = useUIStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, mounted]);

  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
