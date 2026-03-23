/**
 * Gateway 连接状态 Slice
 */

import type { GatewayState } from './types';
import type { StoreGet, StoreSet } from './utils';

export const connectionActions = {
  // 服务端代理模式状态同步
  syncServerProxyStatus: async (set: StoreSet, get: StoreGet) => {
    try {
      const res = await fetch('/api/gateway/config');
      const json = await res.json();
      if (json.data) {
        const status = json.data.status;
        set({
          connectionMode: json.data.mode,
          serverProxyConnected: json.data.mode === 'server_proxy' && status === 'connected',
          connectionStatus: status,
          ...(json.data.url ? { gwUrl: json.data.url } : {}),
        });
      } else {
        set({ connectionMode: null, serverProxyConnected: false, connectionStatus: null });
      }
    } catch (e) {
      console.error('syncServerProxyStatus:', e);
      set({ connectionMode: null, serverProxyConnected: false, connectionStatus: null });
    }
  },

  // 直接设置连接信息（避免重复 fetch）
  setConnectionInfo: (set: StoreSet, _get: StoreGet, mode: 'server_proxy' | null, status: 'connected' | 'disconnected' | 'connecting' | 'error_auth' | 'error_connection' | 'error' | null, url?: string) => {
    set({
      connectionMode: mode,
      serverProxyConnected: mode === 'server_proxy' && status === 'connected',
      connectionStatus: status,
      ...(url ? { gwUrl: url } : {}),
    });
  },
};

// 生成连接相关的 actions 对象（用于 Zustand store）
export const createConnectionActions = (set: StoreSet, get: StoreGet) => ({
  syncServerProxyStatus: () => connectionActions.syncServerProxyStatus(set, get),
  setConnectionInfo: (mode: 'server_proxy' | null, status: 'connected' | 'disconnected' | null, url?: string) =>
    connectionActions.setConnectionInfo(set, get, mode, status, url),
});
