/**
 * Gateway 数据刷新 Slice
 * 包含 snapshot, health, agents, cron, sessions, skills 的刷新逻辑
 */

import { getGatewayProxyClient } from '@/lib/gateway-proxy';
import { membersApi } from '@/lib/data-service';
import { storeEvents } from '@/shared/lib/store-events';
import type { AgentListEntry } from '@/lib/gateway-types';
import type { GatewayState } from './types';
import type { StoreGet, StoreSet } from './utils';

// 辅助函数：检查是否应该节流
function shouldThrottle(lastRefresh: number, throttleMs: number = 2000): boolean {
  return Date.now() - lastRefresh < throttleMs;
}

export const dataActions = {
  refreshSnapshot: async (set: StoreSet, get: StoreGet) => {
    const now = Date.now();
    const { lastRefresh } = get();
    if (shouldThrottle(lastRefresh.snapshot)) return;
    set({ lastRefresh: { ...lastRefresh, snapshot: now } });
    const { helloPayload, serverProxyConnected } = get();

    if (helloPayload?.snapshot) {
      set({ snapshot: helloPayload.snapshot });
      return;
    }

    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;

    try {
      const snapshot = await activeClient.getSnapshot();
      set({ snapshot });
    } catch (e) {
      console.warn('[GW] snapshot.get unavailable, using hello-ok snapshot');
    }
  },

  refreshHealth: async (set: StoreSet, get: StoreGet) => {
    const now = Date.now();
    const { serverProxyConnected, lastRefresh } = get();
    if (shouldThrottle(lastRefresh.health)) return;
    set({ lastRefresh: { ...lastRefresh, health: now } });

    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;

    try {
      const health = await activeClient.getHealth();
      const hasChannels = health.channels && Object.keys(health.channels).length > 0;
      set({
        health,
        agentHealthList: health.agents || [],
        ...(hasChannels ? { lastChannelsRefresh: Date.now() } : {}),
      });
    } catch (e) {
      console.error('refreshHealth:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh health' });
    }
  },

  refreshAgents: async (set: StoreSet, get: StoreGet) => {
    const now = Date.now();
    const { gwUrl, serverProxyConnected, lastRefresh } = get();
    if (shouldThrottle(lastRefresh.agents)) return;
    set({ lastRefresh: { ...lastRefresh, agents: now } });

    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;

    try {
      const result = await activeClient.listAgents();
      const agents: AgentListEntry[] = (result.agents || []).map(a => ({
        id: a.id,
        name: a.name,
        identity: a.identity,
        isDefault: a.id === result.defaultId,
      }));
      set({ agentsList: agents, agentsDefaultId: result.defaultId || null, agentsMainKey: result.mainKey || null });

      // 自动同步 Agent 与本地 AI 成员（通过 API 直接调用，解耦 Store）
      const { data: allMembers, error: membersError } = await membersApi.getAll();
      if (membersError) {
        console.error('[GW] refreshAgents: failed to fetch members:', membersError);
        return;
      }

      const aiMembers = (allMembers || []).filter(m => m.type === 'ai');

      for (const agent of agents) {
        const allMatching = aiMembers.filter(m => m.openclawGatewayUrl === gwUrl && m.openclawAgentId === agent.id);

        // 处理重复成员：保留最新创建的，删除其他的
        if (allMatching.length > 1) {
          const sorted = [...allMatching].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          for (let i = 1; i < sorted.length; i++) {
            await membersApi.delete(sorted[i].id);
          }
        }

        const existing = allMatching.length > 0
          ? [...allMatching].sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return timeB - timeA;
            })[0]
          : undefined;

        // 获取智能体自我认知名称
        let selfIdentityName: string | null = null;
        try {
          const identity = await activeClient.getAgentIdentity(agent.id);
          selfIdentityName = identity.name;
        } catch (e) {
          console.warn('[GW] refreshAgents: failed to get identity for', agent.id);
        }

        const displayName = selfIdentityName || agent.identity?.name || agent.name || agent.id;

        if (existing) {
          // 更新已有成员名称
          if (existing.name !== displayName && displayName !== agent.id) {
            await membersApi.update(existing.id, { name: displayName });
          }
          continue;
        }

        // 新 Agent，自动创建本地 AI 成员
        try {
          await membersApi.create({
            name: displayName,
            type: 'ai',
            openclawGatewayUrl: gwUrl,
            openclawAgentId: agent.id,
          });
        } catch (e) {
          console.error('[GW] Failed to create AI member:', e);
        }
      }

      // 同步完成，通知刷新成员数据（解耦：通过 storeEvents）
      storeEvents.emit('data:refresh', { type: 'members', reason: 'gateway-agents-synced' });
    } catch (e) {
      console.error('refreshAgents:', e);
    }
  },

  refreshCronJobs: async (set: StoreSet, get: StoreGet) => {
    const now = Date.now();
    const { serverProxyConnected, lastRefresh } = get();
    if (shouldThrottle(lastRefresh.cronJobs)) return;
    set({ lastRefresh: { ...lastRefresh, cronJobs: now } });

    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;

    try {
      const result = await activeClient.listCronJobs();
      set({ cronJobs: result.jobs || [] });
    } catch (e) {
      console.error('refreshCronJobs:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh cron jobs' });
    }
  },

  refreshSessions: async (set: StoreSet, get: StoreGet) => {
    const now = Date.now();
    const { serverProxyConnected, lastRefresh } = get();
    if (shouldThrottle(lastRefresh.sessions)) return;
    set({ lastRefresh: { ...lastRefresh, sessions: now } });

    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;

    try {
      const result = await activeClient.listSessions();
      set({ sessions: result.sessions || [], sessionsCount: result.count || 0 });
    } catch (e) {
      console.error('refreshSessions:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh sessions' });
    }
  },

  refreshSkills: async (set: StoreSet, get: StoreGet) => {
    const now = Date.now();
    const { serverProxyConnected, lastRefresh } = get();
    if (shouldThrottle(lastRefresh.skills)) return;
    set({ lastRefresh: { ...lastRefresh, skills: now } });

    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;

    try {
      const result = await activeClient.listSkills();
      set({ skills: result.skills || [] });
    } catch (e) {
      console.error('refreshSkills:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh skills' });
    }
  },
};

export const createDataActions = (set: StoreSet, get: StoreGet) => ({
  refreshSnapshot: () => dataActions.refreshSnapshot(set, get),
  refreshHealth: () => dataActions.refreshHealth(set, get),
  refreshAgents: () => dataActions.refreshAgents(set, get),
  refreshCronJobs: () => dataActions.refreshCronJobs(set, get),
  refreshSessions: () => dataActions.refreshSessions(set, get),
  refreshSkills: () => dataActions.refreshSkills(set, get),
});
