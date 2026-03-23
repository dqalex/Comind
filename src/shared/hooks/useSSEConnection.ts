'use client';

import { useRef, useCallback, useEffect } from 'react';
import { SSE_EVENT_TYPES, sseHandlerRegistry, createSSEListener } from '@/lib/sse-events';
import type { SSEEventType } from '@/lib/sse-events';
import { logger } from '@/lib/logger';

interface SSEConnectionOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

/**
 * SSE 连接管理 Hook
 *
 * 职责：
 * - 建立和维护 SSE 长连接
 * - 自动重连（指数退避）
 * - 事件监听和分发
 * - 心跳检测避免断线
 */
export function useSSEConnection(options: SSEConnectionOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const lastHeartbeatRef = useRef<number>(0);
  // 存储 options 的 ref，避免依赖变化导致 reconnect
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const MAX_RECONNECT_DELAY = 60000; // 最大 60 秒
  const BASE_RECONNECT_DELAY = 1000; // 基础 1 秒
  // 心跳超时：45 秒没收到心跳则认为连接断开
  const HEARTBEAT_TIMEOUT_MS = 45 * 1000;

  // 断开连接函数
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      const es = eventSourceRef.current as EventSource & {
        _cleanup?: () => void;
        _heartbeatCheck?: ReturnType<typeof setInterval>;
      };
      if (es._heartbeatCheck) {
        clearInterval(es._heartbeatCheck);
      }
      if (es._cleanup) {
        es._cleanup();
      }
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // 不在这里清空处理器！处理器由 DataProvider 管理，重连时应该保留
    // sseHandlerRegistry.clear();
    logger.info('[SSE] Disconnected');
  }, []);

  // 连接函数 - 使用 useRef 模式避免循环依赖
  const connectRef = useRef<() => void>(() => {});
  
  const connect = useCallback(() => {
    // 如果已连接，先断开
    if (eventSourceRef.current) {
      disconnect();
    }

    try {
      const es = new EventSource('/api/sse');
      eventSourceRef.current = es;

      // 使用集中定义的 SSE 监听器
      const cleanup = createSSEListener(es, (type, data) => {
        sseHandlerRegistry.handle(type, data);
      });

      // 保存清理函数以便后续调用
      (es as EventSource & { _cleanup?: () => void })._cleanup = cleanup;

      // 监听心跳事件
      es.addEventListener('heartbeat', ((event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          lastHeartbeatRef.current = data.timestamp || Date.now();
          logger.debug('[SSE] Heartbeat received');
        } catch {
          lastHeartbeatRef.current = Date.now();
        }
      }) as EventListener);

      // 连接成功后重置重连计数
      es.onopen = () => {
        reconnectAttempts.current = 0;
        lastHeartbeatRef.current = Date.now();
        logger.info('[SSE] Connected');
        optionsRef.current.onConnect?.();
      };

      es.onerror = (error) => {
        es.close();
        eventSourceRef.current = null;

        logger.warn('[SSE] Connection error, will reconnect');
        optionsRef.current.onError?.(error);

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }

        // 指数退避重连：1s, 2s, 4s, 8s, ... 最大 60s
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
          MAX_RECONNECT_DELAY
        );
        reconnectAttempts.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          if (document.visibilityState === 'visible') {
            // 通过 ref 调用 connect，避免"变量在声明前被访问"问题
            connectRef.current();
          }
        }, delay);
      };

      // 启动心跳超时检测
      const heartbeatCheck = setInterval(() => {
        if (lastHeartbeatRef.current && Date.now() - lastHeartbeatRef.current > HEARTBEAT_TIMEOUT_MS) {
          logger.warn('[SSE] Heartbeat timeout, reconnecting...');
          es.close();
          eventSourceRef.current = null;
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }
          // 立即重连
          reconnectTimerRef.current = setTimeout(() => {
            // 通过 ref 调用 connect
            connectRef.current();
          }, 1000);
        }
      }, HEARTBEAT_TIMEOUT_MS);

      // 保存心跳检测定时器引用
      (es as EventSource & { _heartbeatCheck?: ReturnType<typeof setInterval> })._heartbeatCheck = heartbeatCheck;

      return () => disconnect();
    } catch (error) {
      logger.error('[SSE] Failed to connect:', error);
      optionsRef.current.onError?.(error as Event);
      return undefined;
    }
  }, [disconnect]); // 移除 options 依赖，使用 ref 替代

  // 更新 connectRef
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // 组件卸载时清理
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected: () => eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnectAttempts: () => reconnectAttempts.current,
  };
}

export type { SSEConnectionOptions };
