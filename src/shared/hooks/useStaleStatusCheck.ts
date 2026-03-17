'use client';

import { useEffect, useRef } from 'react';
import { useOpenClawStatusStore } from '@/domains';
import { logger } from '@/lib/logger';

interface StaleStatusCheckOptions {
  /** 首次检查延迟（毫秒），默认 30000ms (30秒) */
  initialDelay?: number;
  /** 检查间隔（毫秒），默认 60000ms (60秒) */
  interval?: number;
  /** 是否启用检查 */
  enabled?: boolean;
}

/**
 * 状态检查 Hook
 * 
 * 职责：
 * - 定时检查超时的 working 状态
 * - 自动将断线 Agent 重置为 offline
 */
export function useStaleStatusCheck(options: StaleStatusCheckOptions = {}) {
  const { 
    initialDelay = 30000, 
    interval = 60000, 
    enabled = true 
  } = options;
  
  const checkStaleStatus = useOpenClawStatusStore((s) => s.checkStaleStatus);
  const staleCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    logger.info('[StaleStatusCheck] Starting stale status check', { initialDelay, interval });

    // 启动后 initialDelay 进行首次检查，之后每 interval 检查一次
    const initialTimer = setTimeout(() => {
      logger.debug('[StaleStatusCheck]', 'Running initial check');
      checkStaleStatus();
      
      staleCheckTimerRef.current = setInterval(() => {
        logger.debug('[StaleStatusCheck]', 'Running periodic check');
        checkStaleStatus();
      }, interval);
    }, initialDelay);

    return () => {
      clearTimeout(initialTimer);
      if (staleCheckTimerRef.current) {
        clearInterval(staleCheckTimerRef.current);
        staleCheckTimerRef.current = null;
      }
      logger.info('[StaleStatusCheck] Stopped');
    };
  }, [enabled, initialDelay, interval, checkStaleStatus]);

  return {
    isRunning: () => staleCheckTimerRef.current !== null,
  };
}
