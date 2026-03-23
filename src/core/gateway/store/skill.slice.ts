/**
 * Gateway Skill Slice
 */

import { getGatewayProxyClient } from '@/lib/gateway-proxy';
import type { StoreGet, StoreSet } from './utils';

export const skillActions = {
  toggleSkill: async (set: StoreSet, get: StoreGet, skillKey: string, enabled: boolean) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.updateSkill(skillKey, { enabled });
      await get().refreshSkills();
    } catch (e) {
      console.error('toggleSkill:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to toggle skill' });
    }
  },

  installSkill: async (set: StoreSet, get: StoreGet, name: string, installId: string, timeoutMs?: number) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.installSkill(name, installId, timeoutMs);
      await get().refreshSkills();
    } catch (e) {
      console.error('installSkill:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to install skill' });
    }
  },
};

export const createSkillActions = (set: StoreSet, get: StoreGet) => ({
  toggleSkill: (skillKey: string, enabled: boolean) => skillActions.toggleSkill(set, get, skillKey, enabled),
  installSkill: (name: string, installId: string, timeoutMs?: number) => skillActions.installSkill(set, get, name, installId, timeoutMs),
});
