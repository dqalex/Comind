'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useGatewayStore } from '@/core/gateway/store';
import { logger } from '@/lib/logger';

interface GatewayConfig {
  mode: 'server_proxy' | null;
  status: 'connected' | 'disconnected' | null;
  url: string;
}

interface GatewaySyncResult {
  success: boolean;
  error?: string;
  data?: GatewayConfig;
}

// 轮询配置
const POLL_INTERVAL = 3000; // 3秒轮询一次
const MAX_POLL_ATTEMPTS = 20; // 最多轮询20次（60秒）

/**
 * Gateway 数据同步 Hook
 * 
 * 职责：
 * - 获取 Gateway 配置
 * - 同步 Gateway 状态（server_proxy 模式）
 * - 加载 Gateway 数据（agents, health, cronJobs, sessions, skills, config）
 * - 未连接时自动轮询直到连接成功
 */
export function useGatewaySync() {
  const setConnectionInfo = useGatewayStore((s) => s.setConnectionInfo);
  const refreshAgents = useGatewayStore((s) => s.refreshAgents);
  const refreshSessions = useGatewayStore((s) => s.refreshSessions);
  const refreshCronJobs = useGatewayStore((s) => s.refreshCronJobs);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);
  const loadConfig = useGatewayStore((s) => s.loadConfig);
  
  // 轮询状态
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptsRef = useRef(0);
  const isPollingRef = useRef(false);

  /**
   * 获取 Gateway 配置
   */
  const fetchConfig = useCallback(async (): Promise<GatewaySyncResult> => {
    try {
      const res = await fetch('/api/gateway/config');
      const json = await res.json();
      const data = json.data as GatewayConfig | undefined;
      
      if (!data) {
        return { success: false, error: 'No config data' };
      }

      return { success: true, data };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[GatewaySync] Failed to fetch config:', error);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
    pollAttemptsRef.current = 0;
  }, []);

  /**
   * 检查状态是否为不可恢复的错误
   */
  const isFatalError = (status: string): boolean => {
    return status === 'error_auth' || status === 'error_connection' || status.startsWith('error_');
  };

  /**
   * 开始轮询 Gateway 连接状态
   */
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return; // 已在轮询中
    
    isPollingRef.current = true;
    pollAttemptsRef.current = 0;
    
    const poll = async () => {
      if (!isPollingRef.current) return;
      
      pollAttemptsRef.current++;
      logger.info(`[GatewaySync] Polling attempt ${pollAttemptsRef.current}/${MAX_POLL_ATTEMPTS}`);
      
      const result = await fetchConfig();
      
      if (!result.success || !result.data) {
        logger.warn('[GatewaySync] Polling failed, will retry...');
      } else {
        const { mode, status, url } = result.data;
        setConnectionInfo(mode, status, url);
        
        // 已连接，加载数据并停止轮询
        if (mode === 'server_proxy' && status === 'connected') {
          logger.info('[GatewaySync] Gateway connected! Loading data...');
          
          const results = await Promise.allSettled([
            refreshAgents(),
            refreshHealth(),
            refreshCronJobs(),
            refreshSessions(),
            refreshSkills(),
            loadConfig(),
          ]);

          const names = ['agents', 'health', 'cronJobs', 'sessions', 'skills', 'config'];
          results.forEach((r, i) => {
            if (r.status === 'rejected') {
              logger.warn(`[GatewaySync] ${names[i]} refresh failed:`, r.reason);
            }
          });

          stopPolling();
          return;
        }
        
        // 配置错误（token 错误或连接失败），停止轮询并显示错误
        if (mode === 'server_proxy' && status && isFatalError(status)) {
          logger.error(`[GatewaySync] Fatal error detected: ${status}, stopping poll`);
          stopPolling();
          return;
        }
      }
      
      // 未连接且未超过最大尝试次数，继续轮询
      if (pollAttemptsRef.current < MAX_POLL_ATTEMPTS) {
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL);
      } else {
        logger.warn('[GatewaySync] Max polling attempts reached, giving up');
        isPollingRef.current = false;
      }
    };
    
    // 立即执行第一次
    poll();
  }, [fetchConfig, setConnectionInfo, refreshAgents, refreshHealth, refreshCronJobs, refreshSessions, refreshSkills, loadConfig, stopPolling]);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  /**
   * 同步 Gateway 状态并加载数据
   * 仅在 server_proxy 模式下且已连接时加载数据
   * 未连接时会启动轮询直到连接成功
   */
  const syncGateway = useCallback(async (): Promise<GatewaySyncResult> => {
    const configResult = await fetchConfig();
    
    if (!configResult.success || !configResult.data) {
      return configResult;
    }

    const { mode, status, url } = configResult.data;
    
    // 设置连接信息
    setConnectionInfo(mode, status, url);
    
    logger.info(`[GatewaySync] Mode: ${mode}, Status: ${status}`);

    // server_proxy 模式下主动加载所有 Gateway 数据
    if (mode === 'server_proxy' && status === 'connected') {
      logger.info('[GatewaySync] Loading Gateway data...');
      
      const results = await Promise.allSettled([
        refreshAgents(),
        refreshHealth(),
        refreshCronJobs(),
        refreshSessions(),
        refreshSkills(),
        loadConfig(),
      ]);

      const names = ['agents', 'health', 'cronJobs', 'sessions', 'skills', 'config'];
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          logger.warn(`[GatewaySync] ${names[i]} refresh failed:`, r.reason);
        }
      });

      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        logger.warn(`[GatewaySync] ${failedCount} operations failed`);
      }
    } else if (mode === 'server_proxy' && status === 'disconnected') {
      // 配置了 server_proxy 但未连接，启动轮询
      logger.info('[GatewaySync] Gateway not connected yet, starting polling...');
      startPolling();
    }

    return configResult;
  }, [fetchConfig, setConnectionInfo, refreshAgents, refreshHealth, refreshCronJobs, refreshSessions, refreshSkills, loadConfig, startPolling]);

  /**
   * 仅刷新 Gateway 数据（不重新获取配置）
   */
  const refreshGatewayData = useCallback(async (): Promise<void> => {
    const state = useGatewayStore.getState();
    const { connectionMode, serverProxyConnected } = state;

    if (connectionMode !== 'server_proxy' || !serverProxyConnected) {
      logger.debug('[GatewaySync]', 'Skipping refresh - not in server_proxy mode or not connected');
      return;
    }

    const results = await Promise.allSettled([
      refreshAgents(),
      refreshHealth(),
      refreshCronJobs(),
      refreshSessions(),
      refreshSkills(),
    ]);

    const names = ['agents', 'health', 'cronJobs', 'sessions', 'skills'];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.warn(`[GatewaySync] ${names[i]} refresh failed:`, r.reason);
      }
    });
  }, [refreshAgents, refreshHealth, refreshCronJobs, refreshSessions, refreshSkills]);

  return {
    fetchConfig,
    syncGateway,
    refreshGatewayData,
  };
}

export type { GatewayConfig, GatewaySyncResult };
