/**
 * Gateway Session Slice
 */

import { getGatewayProxyClient } from '@/lib/gateway-proxy';
import type { StoreGet, StoreSet } from './utils';

export const sessionActions = {
  patchSession: async (set: StoreSet, get: StoreGet, sessionKey: string, updates: Record<string, unknown>) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.patchSession(sessionKey, updates);
      await get().refreshSessions();
    } catch (e) {
      console.error('patchSession:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to patch session' });
    }
  },

  deleteSession: async (set: StoreSet, get: StoreGet, sessionKey: string) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.deleteSession(sessionKey);
      set((s) => ({ sessions: s.sessions.filter(ss => ss.key !== sessionKey), error: null }));
    } catch (e) {
      console.error('deleteSession:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to delete session' });
    }
  },
};

export const createSessionActions = (set: StoreSet, get: StoreGet) => ({
  patchSession: (sessionKey: string, updates: Record<string, unknown>) => sessionActions.patchSession(set, get, sessionKey, updates),
  deleteSession: (sessionKey: string) => sessionActions.deleteSession(set, get, sessionKey),
});
