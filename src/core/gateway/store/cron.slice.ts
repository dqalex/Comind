/**
 * Gateway Cron 任务 Slice
 */

import { getGatewayProxyClient } from '@/lib/gateway-proxy';
import type { StoreGet, StoreSet } from './utils';

export const cronActions = {
  toggleCronJob: async (set: StoreSet, get: StoreGet, jobId: string, enabled: boolean) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      const updated = await activeClient.toggleCronJob(jobId, enabled);
      set((s) => ({ cronJobs: s.cronJobs.map(j => j.id === jobId ? updated : j), error: null }));
    } catch (e) {
      console.error('toggleCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to toggle cron job' });
    }
  },

  runCronJob: async (set: StoreSet, get: StoreGet, jobId: string) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.runCronJob(jobId);
    } catch (e) {
      console.error('runCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to run cron job' });
    }
  },

  deleteCronJob: async (set: StoreSet, get: StoreGet, jobId: string) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.deleteCronJob(jobId);
      set((s) => ({ cronJobs: s.cronJobs.filter(j => j.id !== jobId), error: null }));
    } catch (e) {
      console.error('deleteCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to delete cron job' });
    }
  },

  createCronJob: async (set: StoreSet, get: StoreGet, job: Record<string, unknown>) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.createCronJob(job);
      await get().refreshCronJobs();
    } catch (e) {
      console.error('createCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to create cron job' });
    }
  },

  updateCronJob: async (set: StoreSet, get: StoreGet, jobId: string, patch: Record<string, unknown>) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      const updated = await activeClient.updateCronJob(jobId, patch);
      set((s) => ({ cronJobs: s.cronJobs.map(j => j.id === jobId ? updated : j), error: null }));
    } catch (e) {
      console.error('updateCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to update cron job' });
    }
  },

  fetchCronRuns: async (set: StoreSet, get: StoreGet, jobId: string) => {
    const { serverProxyConnected } = get();
    if (!serverProxyConnected) return;
    const activeClient = getGatewayProxyClient();
    if (!activeClient?.isConnected) return;
    try {
      const runs = await activeClient.getCronRuns(jobId);
      set((s) => ({ cronRuns: { ...s.cronRuns, [jobId]: runs } }));
    } catch (e) {
      console.error('fetchCronRuns:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to fetch cron runs' });
    }
  },
};

export const createCronActions = (set: StoreSet, get: StoreGet) => ({
  toggleCronJob: (jobId: string, enabled: boolean) => cronActions.toggleCronJob(set, get, jobId, enabled),
  runCronJob: (jobId: string) => cronActions.runCronJob(set, get, jobId),
  deleteCronJob: (jobId: string) => cronActions.deleteCronJob(set, get, jobId),
  createCronJob: (job: Record<string, unknown>) => cronActions.createCronJob(set, get, job),
  updateCronJob: (jobId: string, patch: Record<string, unknown>) => cronActions.updateCronJob(set, get, jobId, patch),
  fetchCronRuns: (jobId: string) => cronActions.fetchCronRuns(set, get, jobId),
});
