/**
 * 路由数据预加载 Hook
 * - 在 Link hover 时预加载页面数据
 * - 减少页面切换时的等待时间
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTaskStore, useProjectStore, useMemberStore, useDocumentStore } from '@/domains';
import { useScheduledTaskStore } from '@/domains/schedule';
import { useDeliveryStore } from '@/domains/delivery';
import { useMilestoneStore } from '@/domains/milestone';
import { useChatStore } from '@/domains/chat';
import { useSOPTemplateStore } from '@/domains/sop';
import { logger } from '@/shared/lib/logger';

// 预加载节流：同一路由 10 秒内不重复预加载
const PREFETCH_THROTTLE_MS = 10 * 1000;

interface PrefetchConfig {
  projects?: boolean;
  tasks?: boolean;
  members?: boolean;
  documents?: boolean;
  scheduledTasks?: boolean;
  deliveries?: boolean;
  milestones?: boolean;
  sessions?: boolean;
  sopTemplates?: boolean;
}

// 路由到预加载配置的映射
const ROUTE_PREFETCH_MAP: Record<string, PrefetchConfig> = {
  '/dashboard': { projects: true, tasks: true, members: true },
  '/projects': { projects: true },
  '/projects/[id]': { tasks: true, members: true, documents: true, milestones: true, deliveries: true },
  '/tasks': { tasks: true },
  '/documents': { documents: true },
  '/members': { members: true },
  '/schedule': { scheduledTasks: true },
  '/deliveries': { deliveries: true },
  '/milestones': { milestones: true },
  '/chat': { sessions: true },
  '/sop': { sopTemplates: true },
};

export function useRoutePrefetch() {
  const lastPrefetch = useRef<Record<string, number>>({});

  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);
  const fetchScheduledTasks = useScheduledTaskStore((s) => s.fetchTasks);
  const fetchDeliveries = useDeliveryStore((s) => s.fetchDeliveries);
  const fetchMilestones = useMilestoneStore((s) => s.fetchMilestones);
  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const fetchSOPTemplates = useSOPTemplateStore((s) => s.fetchTemplates);

  const prefetch = useCallback((route: string) => {
    const now = Date.now();
    const config = ROUTE_PREFETCH_MAP[route];

    if (!config) return;

    // 节流检查
    if (lastPrefetch.current[route] && now - lastPrefetch.current[route] < PREFETCH_THROTTLE_MS) {
      logger.debug('[useRoutePrefetch]', `throttled: ${route}`);
      return;
    }

    lastPrefetch.current[route] = now;
    logger.debug('[useRoutePrefetch]', `prefetching: ${route}`);

    // 并行预加载所需数据
    const promises: Promise<unknown>[] = [];

    if (config.projects) promises.push(fetchProjects().catch(err => logger.warn('[useRoutePrefetch] fetchProjects failed:', err)));
    if (config.tasks) promises.push(fetchTasks().catch(err => logger.warn('[useRoutePrefetch] fetchTasks failed:', err)));
    if (config.members) promises.push(fetchMembers().catch(err => logger.warn('[useRoutePrefetch] fetchMembers failed:', err)));
    if (config.documents) promises.push(fetchDocuments().catch(err => logger.warn('[useRoutePrefetch] fetchDocuments failed:', err)));
    if (config.scheduledTasks) promises.push(fetchScheduledTasks().catch(err => logger.warn('[useRoutePrefetch] fetchScheduledTasks failed:', err)));
    if (config.deliveries) promises.push(fetchDeliveries().catch(err => logger.warn('[useRoutePrefetch] fetchDeliveries failed:', err)));
    if (config.milestones) promises.push(fetchMilestones().catch(err => logger.warn('[useRoutePrefetch] fetchMilestones failed:', err)));
    if (config.sessions) promises.push(fetchSessions().catch(err => logger.warn('[useRoutePrefetch] fetchSessions failed:', err)));
    if (config.sopTemplates) promises.push(fetchSOPTemplates().catch(err => logger.warn('[useRoutePrefetch] fetchSOPTemplates failed:', err)));

    // 不等待结果，异步预加载
    Promise.allSettled(promises);
  }, [fetchProjects, fetchTasks, fetchMembers, fetchDocuments, fetchScheduledTasks, fetchDeliveries, fetchMilestones, fetchSessions, fetchSOPTemplates]);

  return { prefetch };
}

// 提取的组件：在 AppShell 或 Layout 中使用
export function RoutePrefetchProvider({ children }: { children: React.ReactNode }) {
  const { prefetch } = useRoutePrefetch();

  // 使用事件委托处理 Link hover
  const handleMouseOver = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-prefetch]');

    if (link) {
      const href = link.getAttribute('href');
      if (href) {
        // 规范化路由（移除动态参数部分用于匹配）
        const normalizedRoute = href.split('/').slice(0, 3).join('/');
        prefetch(normalizedRoute);
      }
    }
  }, [prefetch]);

  // 在 useEffect 中添加/移除监听器，避免内存泄漏
  useEffect(() => {
    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
    };
  }, [handleMouseOver]);

  return <>{children}</>;
}