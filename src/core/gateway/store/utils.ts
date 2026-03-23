/**
 * Gateway Store 工具类型和函数
 */

import type { GatewayState } from './types';

export type StoreSet = (
  partial: Partial<GatewayState> | ((state: GatewayState) => Partial<GatewayState>),
  replace?: boolean
) => void;

export type StoreGet = () => GatewayState;

// 节流检查函数
export function shouldThrottle(lastRefresh: number, throttleMs: number = 2000): boolean {
  return Date.now() - lastRefresh < throttleMs;
}

// 更新 lastRefresh 时间戳
export function updateLastRefresh(
  get: StoreGet,
  set: StoreSet,
  key: keyof GatewayState['lastRefresh']
): void {
  const { lastRefresh } = get();
  set({ lastRefresh: { ...lastRefresh, [key]: Date.now() } });
}
