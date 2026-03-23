'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RelativeTimeDisplayProps {
  timestamp: number | null | undefined;
  fallback?: string;
}

/**
 * 安全的相对时间显示组件
 * 
 * 解决 React Compiler 的 "Cannot call impure function during render" 错误
 * 使用 useEffect + useState 来避免在渲染中调用 Date.now()
 */
export function RelativeTimeDisplay({ timestamp, fallback = '--' }: RelativeTimeDisplayProps) {
  const { t, i18n } = useTranslation();
  const [display, setDisplay] = useState<string>(fallback);

  useEffect(() => {
    if (!timestamp) {
      setDisplay(fallback);
      return;
    }

    const formatRelativeTime = (ts: number): string => {
      const diff = Date.now() - ts;
      if (diff < 0) {
        const absDiff = Math.abs(diff);
        if (absDiff < 60_000) return t('dashboard.secondsLater', { count: Math.round(absDiff / 1000) });
        if (absDiff < 3600_000) return t('dashboard.minutesLater', { count: Math.round(absDiff / 60_000) });
        return t('dashboard.hoursLater', { count: Math.round(absDiff / 3600_000) });
      }
      if (diff < 10_000) return t('dashboard.justNow');
      if (diff < 60_000) return t('dashboard.secondsAgo', { count: Math.round(diff / 1000) });
      if (diff < 3600_000) return t('dashboard.minutesAgo', { count: Math.round(diff / 60_000) });
      if (diff < 86400_000) return t('dashboard.hoursAgo', { count: Math.round(diff / 3600_000) });
      return t('dashboard.daysAgo', { count: Math.round(diff / 86400_000) });
    };

    setDisplay(formatRelativeTime(timestamp));

    // 每分钟更新一次
    const interval = setInterval(() => {
      setDisplay(formatRelativeTime(timestamp));
    }, 60000);

    return () => clearInterval(interval);
  }, [timestamp, fallback, t, i18n.language]);

  return <>{display}</>;
}
