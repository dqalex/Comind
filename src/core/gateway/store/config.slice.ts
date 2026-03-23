/**
 * Gateway Config Slice
 */

import { getGatewayProxyClient } from '@/lib/gateway-proxy';
import type { StoreGet, StoreSet } from './utils';

export const configActions = {
  loadConfig: async (set: StoreSet, get: StoreGet) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    set({ configLoading: true });
    try {
      const res = await activeClient.getConfig();
      const form = (res.config && typeof res.config === 'object') ? { ...res.config } : {};
      set({
        configForm: form,
        configFormOriginal: JSON.parse(JSON.stringify(form)),
        configHash: res.hash || null,
        configDirty: false,
        configLoading: false,
      });
    } catch (e) {
      console.error('loadConfig:', e);
      set({ configLoading: false, error: e instanceof Error ? e.message : 'Failed to load config' });
    }
  },

  saveConfig: async (set: StoreSet, get: StoreGet) => {
    const { configForm, configHash, serverProxyConnected } = get();
    if (!serverProxyConnected || !configForm || !configHash) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected || !configForm || !configHash) return;
    set({ configSaving: true });
    try {
      const raw = JSON.stringify(configForm, null, 2);
      await activeClient.setConfig(raw, configHash);
      set({ configSaving: false, configDirty: false });
      await get().loadConfig();
    } catch (e) {
      console.error('saveConfig:', e);
      set({ configSaving: false, error: e instanceof Error ? e.message : 'Failed to save config' });
    }
  },

  reloadConfig: async (_set: StoreSet, get: StoreGet) => {
    await get().loadConfig();
  },

  updateConfigForm: (set: StoreSet, get: StoreGet, updater: (form: Record<string, unknown>) => Record<string, unknown>) => {
    const { configForm } = get();
    const base = configForm ? JSON.parse(JSON.stringify(configForm)) : {};
    const next = updater(base);
    set({ configForm: next, configDirty: true });
  },
};

export const createConfigActions = (set: StoreSet, get: StoreGet) => ({
  loadConfig: () => configActions.loadConfig(set, get),
  saveConfig: () => configActions.saveConfig(set, get),
  reloadConfig: () => configActions.reloadConfig(set, get),
  updateConfigForm: (updater: (form: Record<string, unknown>) => Record<string, unknown>) =>
    configActions.updateConfigForm(set, get, updater),
});
