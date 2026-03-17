'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDataInitializer } from '@/domains';
import {
  useOpenClawStatusStore,
  useTaskStore,
  useDeliveryStore,
  useScheduledTaskStore,
  useDocumentStore,
  useMemberStore,
  useProjectStore,
  useMilestoneStore,
  useSOPTemplateStore,
  useRenderTemplateStore,
  useSkillStore,
  useCommentStore,
} from '@/domains';
import { useGatewayStore } from '@/core/gateway/store';
import { useChatStore } from '@/domains/chat';
import { sseHandlerRegistry, dataLogger } from '@/lib';
import type { ChatEventPayload } from '@/types';
import { useSSEConnection } from '@/hooks/useSSEConnection';
import { useGatewaySync } from '@/hooks/useGatewaySync';
import { useStaleStatusCheck } from '@/hooks/useStaleStatusCheck';

/**
 * 数据初始化 Provider
 * - 首次加载时从 API 加载所有数据
 * - 建立 SSE 长连接，实时接收服务端事件并刷新对应 Store
 * - 标签页重新可见时自动重新同步
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { initialize, hydrated } = useDataInitializer();
  const initialized = useRef(false);
  const lastSyncAt = useRef(0);

  // 使用提取的 hooks
  const { connect: connectSSE, disconnect: disconnectSSE } = useSSEConnection();
  const { syncGateway } = useGatewaySync();
  useStaleStatusCheck({ enabled: hydrated });

  const fetchOpenClawStatus = useOpenClawStatusStore((s) => s.fetchStatus);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchCommentsByTask = useCommentStore((s) => s.fetchCommentsByTask);
  const fetchDeliveries = useDeliveryStore((s) => s.fetchDeliveries);
  const fetchScheduledTasks = useScheduledTaskStore((s) => s.fetchTasks);
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const fetchChatSessions = useChatStore((s) => s.fetchSessions);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchMilestones = useMilestoneStore((s) => s.fetchMilestones);
  const fetchSOPTemplates = useSOPTemplateStore((s) => s.fetchTemplates);
  const fetchRenderTemplates = useRenderTemplateStore((s) => s.fetchTemplates);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);

  // Gateway Store 刷新方法（server_proxy 模式下使用）
  const refreshAgents = useGatewayStore((s) => s.refreshAgents);
  const refreshSessions = useGatewayStore((s) => s.refreshSessions);
  const refreshCronJobs = useGatewayStore((s) => s.refreshCronJobs);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);
  const loadConfig = useGatewayStore((s) => s.loadConfig);
  const syncServerProxyStatus = useGatewayStore((s) => s.syncServerProxyStatus);
  const dispatchChatEvent = useGatewayStore((s) => s.dispatchChatEvent);

  // 注册 SSE 事件处理器（使用集中管理）
  useEffect(() => {
    sseHandlerRegistry.registerAll({
      // 基础模块事件
      openclaw_status: () => fetchOpenClawStatus(),
      task_update: () => { fetchTasks(); fetchProjects(); },
      comment_update: (data?: unknown) => {
        // data 包含 taskId，用于刷新特定任务的评论
        const eventData = data as { taskId?: string } | undefined;
        if (eventData?.taskId) {
          fetchCommentsByTask(eventData.taskId);
        }
      },
      delivery_update: () => fetchDeliveries(),
      schedule_update: () => fetchScheduledTasks(),
      document_update: () => fetchDocuments(),
      member_update: () => fetchMembers(),
      project_update: () => fetchProjects(),
      chat_session_update: () => fetchChatSessions(),
      milestone_update: () => fetchMilestones(),
      
      // Gateway 服务端代理事件
      gateway_event: () => {
        refreshAgents();
        refreshSessions();
        refreshCronJobs();
        refreshSkills();
      },
      gateway_agent_update: () => refreshAgents(),
      gateway_session_update: () => refreshSessions(),
      gateway_chat_event: (data?: unknown) => {
        console.log('[DataProvider] gateway_chat_event received:', data);
        if (data) {
          const eventData = data as { gatewayEvent?: string; payload?: ChatEventPayload };
          if (eventData.payload) {
            console.log('[DataProvider] Dispatching chat event:', eventData.payload.state, eventData.payload.sessionKey);
            dispatchChatEvent(eventData.payload);
            if (eventData.payload.state === 'final') {
              refreshSessions();
            }
          } else {
            console.log('[DataProvider] No payload in chat event');
          }
        }
      },
      gateway_cron_update: () => refreshCronJobs(),
      gateway_config_update: () => loadConfig(),
      gateway_status_update: () => {
        syncServerProxyStatus();
        refreshHealth();
      },
      
      // SOP 和渲染模板事件
      sop_template_update: () => fetchSOPTemplates(),
      render_template_update: () => fetchRenderTemplates(),
      sop_confirm_request: () => { fetchTasks(); },
      skill_update: () => fetchSkills(),
      
      // v3.0: 增量更新事件（触发全量刷新作为兜底，后续优化为增量合并）
      'task:incremental': (data?: unknown) => {
        // TODO: 实现增量合并到 Store
        // 当前：触发全量刷新作为兜底
        fetchTasks();
        dataLogger.debug('DataProvider', 'task:incremental', data);
      },
      'document:incremental': (data?: unknown) => {
        fetchDocuments();
        dataLogger.debug('DataProvider', 'document:incremental', data);
      },
      'delivery:incremental': (data?: unknown) => {
        fetchDeliveries();
        dataLogger.debug('DataProvider', 'delivery:incremental', data);
      },
    });

    return () => sseHandlerRegistry.clear();
  }, [fetchOpenClawStatus, fetchTasks, fetchProjects, fetchDeliveries, fetchScheduledTasks, fetchDocuments, fetchMembers, fetchMilestones, fetchChatSessions, refreshAgents, refreshSessions, refreshCronJobs, refreshSkills, refreshHealth, loadConfig, syncServerProxyStatus, dispatchChatEvent, fetchSOPTemplates, fetchRenderTemplates, fetchSkills, fetchCommentsByTask]);

  const sync = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncAt.current < 3000) return;
    lastSyncAt.current = now;
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (hydrated && !initialized.current) {
      initialized.current = true;
      lastSyncAt.current = Date.now();
      initialize();
      connectSSE();
      
      // Gateway 状态同步 (v3.0: 仅支持 server_proxy 模式)
      syncGateway().catch(() => {
        // 配置获取失败，跳过
      });
      
      // 启动 .teamclaw-index 心跳（服务端幂等，仅首次生效）
      fetch('/api/heartbeat/start', { method: 'POST' }).catch(() => {});
    }
  }, [hydrated, initialize, connectSSE, syncGateway]);

  // 状态检查已迁移到 useStaleStatusCheck hook

  useEffect(() => {
    if (!hydrated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && initialized.current) {
        sync();
        connectSSE();
      }
    };

    const handleFocus = () => {
      if (initialized.current) {
        sync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [hydrated, sync, connectSSE]);

  // 组件卸载时统一清理所有资源
  useEffect(() => {
    return () => {
      disconnectSSE();
      sseHandlerRegistry.clear();
    };
  }, [disconnectSSE]);


  return <>{children}</>;
}
