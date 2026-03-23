/**
 * Gateway Agent Slice
 */

import { getGatewayProxyClient } from '@/lib/gateway-proxy';
import type { StoreGet, StoreSet } from './utils';

export const agentActions = {
  createAgent: async (set: StoreSet, get: StoreGet, params: { name: string; workspace: string; emoji?: string }) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.createAgent(params);
      await get().refreshAgents();
      await get().refreshHealth();
    } catch (e) {
      console.error('createAgent:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to create agent' });
    }
  },

  deleteAgent: async (set: StoreSet, get: StoreGet, agentId: string) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.deleteAgent(agentId);
      await get().refreshAgents();
      await get().refreshHealth();
    } catch (e) {
      console.error('deleteAgent:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to delete agent' });
    }
  },
};

export const createAgentActions = (set: StoreSet, get: StoreGet) => ({
  createAgent: (params: { name: string; workspace: string; emoji?: string }) => agentActions.createAgent(set, get, params),
  deleteAgent: (agentId: string) => agentActions.deleteAgent(set, get, agentId),
});
