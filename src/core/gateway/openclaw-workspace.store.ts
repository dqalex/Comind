/**
 * OpenClaw Workspace Store
 * 
 * 管理 OpenClaw workspace 的状态
 */

import { create } from 'zustand';
import type { OpenClawWorkspace, OpenClawFile } from '@/db/schema';
import { openclawWorkspacesApi, openclawFilesApi } from '@/lib/data-service';
import { storeEvents } from '@/shared/lib/store-events';

interface WorkspaceState {
  workspaces: OpenClawWorkspace[];
  files: OpenClawFile[];
  loading: boolean;
  syncing: boolean;
  scanning: boolean;
  error: string | null;
  currentWorkspace: OpenClawWorkspace | null;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchFiles: (workspaceId?: string) => Promise<void>;
  createWorkspace: (data: {
    name: string;
    path: string;
    memberId?: string;
    isDefault?: boolean;
    syncEnabled?: boolean;
    watchEnabled?: boolean;
    syncInterval?: number;
    excludePatterns?: string[];
  }) => Promise<OpenClawWorkspace | null>;
  updateWorkspace: (id: string, data: Partial<OpenClawWorkspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: OpenClawWorkspace | null) => void;
  syncWorkspace: (id: string, mode?: 'full' | 'incremental') => Promise<{
    synced: number;
    created: number;
    updated: number;
    conflicts: number;
    errors: Array<{ file: string; error: string }>;
  } | null>;
  scanWorkspace: (id: string) => Promise<{
    total: number;
    byType: Record<string, number>;
    files: Array<{
      path: string;
      type: string;
      size: number;
      modifiedAt: Date;
      status: 'new' | 'modified' | 'synced' | 'conflict';
    }>;
  } | null>;
  getWorkspaceStatus: (id: string) => Promise<{
    status: string;
    lastSyncAt: Date | null;
    totalFiles: number;
    syncedFiles: number;
    pendingFiles: number;
    conflictFiles: number;
  } | null>;
}

export const useOpenClawWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  files: [],
  loading: false,
  syncing: false,
  scanning: false,
  error: null,
  currentWorkspace: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    const response = await openclawWorkspacesApi.getAll();
    if (response.error) {
      set({ error: response.error, loading: false });
    } else {
      set({ workspaces: response.data || [], loading: false, error: null });
    }
  },

  fetchFiles: async (workspaceId?: string) => {
    set({ loading: true, error: null });
    const response = await openclawFilesApi.getAll(workspaceId);
    if (response.error) {
      set({ error: response.error, loading: false });
    } else {
      set({ files: response.data || [], loading: false, error: null });
    }
  },

  createWorkspace: async (data) => {
    set({ loading: true, error: null });
    const response = await openclawWorkspacesApi.create(data);
    if (response.error || !response.data) {
      set({ error: response.error || 'Failed to create workspace', loading: false });
      return null;
    }
    set((state) => ({
      workspaces: [...state.workspaces, response.data!],
      loading: false,
      error: null,
    }));
    return response.data;
  },

  updateWorkspace: async (id, data) => {
    set({ loading: true, error: null });
    const response = await openclawWorkspacesApi.update(id, data);
    if (response.error) {
      set({ error: response.error, loading: false });
      return;
    }
    if (response.data) {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? response.data! : w
        ),
        currentWorkspace: state.currentWorkspace?.id === id 
          ? response.data! 
          : state.currentWorkspace,
        loading: false,
        error: null,
      }));
    } else {
      set({ loading: false, error: null });
    }
  },

  deleteWorkspace: async (id) => {
    set({ loading: true, error: null });
    const response = await openclawWorkspacesApi.delete(id);
    if (response.error) {
      set({ error: response.error, loading: false });
      return;
    }
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      currentWorkspace: state.currentWorkspace?.id === id 
        ? null 
        : state.currentWorkspace,
      loading: false,
      error: null,
    }));
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
  },

  syncWorkspace: async (id, mode = 'incremental') => {
    set({ syncing: true, error: null });
    const response = await openclawWorkspacesApi.sync(id, mode);
    if (response.error) {
      set({ error: response.error, syncing: false });
      return null;
    }
    
    // 重新获取 workspace 列表以更新 lastSyncAt
    const wsResponse = await openclawWorkspacesApi.getAll();
    if (wsResponse.data) {
      set({ workspaces: wsResponse.data, syncing: false, error: null });
    } else {
      set({ syncing: false, error: null });
    }
    
    // 同步完成后通过 storeEvents 通知刷新文档 Store（解耦）
    storeEvents.emit('data:refresh', { type: 'documents', reason: 'workspace-synced' });
    
    return response.data || null;
  },

  scanWorkspace: async (id) => {
    set({ scanning: true, error: null });
    const response = await openclawWorkspacesApi.scan(id);
    if (response.error) {
      set({ error: response.error, scanning: false });
      return null;
    }
    set({ scanning: false, error: null });
    
    // 转换日期格式
    if (response.data) {
      return {
        ...response.data,
        files: response.data.files.map(f => ({
          ...f,
          modifiedAt: new Date(f.modifiedAt),
        })),
      };
    }
    return null;
  },

  getWorkspaceStatus: async (id) => {
    const response = await openclawWorkspacesApi.getStatus(id);
    if (response.error || !response.data) {
      return null;
    }
    return {
      ...response.data,
      lastSyncAt: response.data.lastSyncAt ? new Date(response.data.lastSyncAt) : null,
    };
  },
}));
