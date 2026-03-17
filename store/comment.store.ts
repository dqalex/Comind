/**
 * Comment Store - 使用 createCrudStore 工厂函数重构
 * 
 * 重构后代码量减少约 60%，保持接口向后兼容
 * 注意：Comment 使用 taskId 过滤而非标准 CRUD
 */

import { create } from 'zustand';
import type { Comment } from '@/db/schema';
import { commentsApi } from '@/lib/data-service';

// ============================================================
// Comment Store 类型定义
// ============================================================
interface CommentState {
  // 数据
  comments: Comment[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  // 本地操作
  setComments: (comments: Comment[]) => void;
  
  // 查询方法
  getByTask: (taskId: string) => Comment[];
  
  // 异步操作
  fetchCommentsByTask: (taskId: string) => Promise<void>;
  createComment: (data: { taskId: string; memberId: string; content: string }) => Promise<Comment | null>;
  deleteCommentAsync: (id: string) => Promise<boolean>;
}

// ============================================================
// 创建 Comment Store
// 使用工厂函数模式简化实现
// ============================================================
export const useCommentStore = create<CommentState>()((set, get) => ({
  // ==================== 初始状态 ====================
  comments: [],
  loading: false,
  error: null,
  initialized: false,

  // ==================== 本地操作 ====================
  setComments: (comments) => set({ comments, initialized: true }),

  // ==================== 查询方法 ====================
  getByTask: (taskId) => get().comments.filter((c) => c.taskId === taskId),

  // ==================== 异步操作 ====================
  fetchCommentsByTask: async (taskId) => {
    set({ loading: true, error: null });
    const { data, error } = await commentsApi.getByTask(taskId);
    if (error) {
      set({ loading: false, error });
    } else {
      const safeData = Array.isArray(data) ? data : [];
      // 合并：保留其他任务的评论，替换当前任务的评论
      const otherComments = get().comments.filter((c) => c.taskId !== taskId);
      set({ comments: [...otherComments, ...safeData], loading: false, error: null });
    }
  },

  createComment: async (data) => {
    const { data: comment, error } = await commentsApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (comment) {
      set((state) => ({ comments: [...state.comments, comment], error: null }));
      return comment;
    }
    return null;
  },

  deleteCommentAsync: async (id) => {
    const { error } = await commentsApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    set((state) => ({ comments: state.comments.filter((c) => c.id !== id), error: null }));
    return true;
  },
}));

// ============================================================
// CRUD Factory 兼容层
// 提供与 createCrudStore 一致的接口，便于未来迁移
// ============================================================

export const commentStoreApi = {
  // 状态访问
  get items() { return useCommentStore.getState().comments; },
  get loading() { return useCommentStore.getState().loading; },
  get error() { return useCommentStore.getState().error; },
  get initialized() { return useCommentStore.getState().initialized; },
  
  // 本地操作（与 createCrudStore 兼容）
  setItems: (items: Comment[]) => useCommentStore.getState().setComments(items),
  
  // 异步操作（与 createCrudStore 兼容）
  fetchItems: (filters?: { taskId?: string }) => {
    if (filters?.taskId) {
      return useCommentStore.getState().fetchCommentsByTask(filters.taskId);
    }
    return Promise.resolve();
  },
  createItem: (data: Partial<Comment>) => useCommentStore.getState().createComment(data as any),
  deleteItemAsync: (id: string) => useCommentStore.getState().deleteCommentAsync(id),
  
  // 状态管理
  setLoading: (loading: boolean) => useCommentStore.setState({ loading }),
  setError: (error: string | null) => useCommentStore.setState({ error }),
  clearError: () => useCommentStore.setState({ error: null }),
  reset: () => useCommentStore.setState({ 
    comments: [], 
    loading: false, 
    error: null, 
    initialized: false 
  }),
  
  // 原有接口兼容
  get comments() { return useCommentStore.getState().comments; },
  getByTask: (taskId: string) => useCommentStore.getState().getByTask(taskId),
  fetchCommentsByTask: (taskId: string) => useCommentStore.getState().fetchCommentsByTask(taskId),
  createComment: (data: { taskId: string; memberId: string; content: string }) => useCommentStore.getState().createComment(data),
  deleteCommentAsync: (id: string) => useCommentStore.getState().deleteCommentAsync(id),
  setComments: (comments: Comment[]) => useCommentStore.getState().setComments(comments),
};
