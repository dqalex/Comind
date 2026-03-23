/**
 * 里程碑 Store 单元测试
 *
 * 测试覆盖：
 * 1. 同步操作 — setMilestones, addMilestone, updateMilestone, deleteMilestone
 * 2. 派生查询 — getMilestonesByProject
 * 3. 异步操作 — fetchMilestones, createMilestone, updateMilestoneAsync, deleteMilestoneAsync
 * 4. 错误处理 — API 失败时的状态管理
 *
 * 运行方式：
 * npx vitest run tests/unit/milestone-store.test.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================
// Mock fetch
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** 构造 mock Response */
function mockResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

// ============================================================
// 测试数据
// ============================================================

const MOCK_MILESTONE = {
  id: 'ms_test1',
  title: '测试里程碑',
  description: '测试描述',
  projectId: 'proj_1',
  status: 'open' as const,
  dueDate: new Date('2026-06-01'),
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const MOCK_MILESTONE_2 = {
  id: 'ms_test2',
  knowledgeConfig: null,
  title: '另一个里程碑',
  description: null,
  projectId: 'proj_2',
  status: 'in_progress' as const,
  dueDate: null,
  sortOrder: 1,
  createdAt: new Date('2026-02-01'),
  updatedAt: new Date('2026-02-01'),
};

// ============================================================
// 测试套件
// ============================================================

describe('useMilestoneStore', () => {
  let useMilestoneStore: typeof import('@/domains/milestone').useMilestoneStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    // 动态导入以确保 store 每次测试都是新的
    const mod = await import('@/domains/milestone');
    useMilestoneStore = mod.useMilestoneStore;
    // 重置 store 状态
    useMilestoneStore.setState({
      milestones: [],
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // 同步操作
  // ============================================================

  describe('同步操作', () => {
    it('setMilestones 应该设置里程碑列表', () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      expect(useMilestoneStore.getState().milestones).toEqual([MOCK_MILESTONE]);
    });

    it('addMilestone 应该追加里程碑', () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      useMilestoneStore.getState().addMilestone(MOCK_MILESTONE_2);
      expect(useMilestoneStore.getState().milestones).toHaveLength(2);
    });

    it('updateMilestone 应该不可变更新', () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      const original = useMilestoneStore.getState().milestones[0];
      useMilestoneStore.getState().updateMilestone('ms_test1', { title: '更新后' });

      const updated = useMilestoneStore.getState().milestones[0];
      expect(updated.title).toBe('更新后');
      // 原始引用不应被修改（不可变性）
      expect(original.title).toBe('测试里程碑');
    });

    it('deleteMilestone 应该移除指定里程碑', () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE, MOCK_MILESTONE_2]);
      useMilestoneStore.getState().deleteMilestone('ms_test1');
      const remaining = useMilestoneStore.getState().milestones;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('ms_test2');
    });

    it('deleteMilestone 不存在的 ID 不应影响列表', () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      useMilestoneStore.getState().deleteMilestone('not_exist');
      expect(useMilestoneStore.getState().milestones).toHaveLength(1);
    });
  });

  // ============================================================
  // 派生查询
  // ============================================================

  describe('getMilestonesByProject', () => {
    it('应该按项目 ID 过滤', () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE, MOCK_MILESTONE_2]);
      const result = useMilestoneStore.getState().getMilestonesByProject('proj_1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ms_test1');
    });

    it('无匹配时应返回空数组', () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      const result = useMilestoneStore.getState().getMilestonesByProject('proj_none');
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================
  // 异步操作
  // ============================================================

  describe('fetchMilestones', () => {
    it('成功获取应该更新 milestones 并清除 error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([MOCK_MILESTONE, MOCK_MILESTONE_2]));
      await useMilestoneStore.getState().fetchMilestones();

      const state = useMilestoneStore.getState();
      expect(state.milestones).toHaveLength(2);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('API 失败应该设置 error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Server error' }, 500));
      await useMilestoneStore.getState().fetchMilestones();

      const state = useMilestoneStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.loading).toBe(false);
    });

    it('相同数据不应触发重新设置', async () => {
      // 先设置初始数据
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      // 返回相同数据
      mockFetch.mockResolvedValueOnce(mockResponse([MOCK_MILESTONE]));
      await useMilestoneStore.getState().fetchMilestones();

      // loading 应该已关闭
      expect(useMilestoneStore.getState().loading).toBe(false);
    });
  });

  describe('createMilestone', () => {
    it('成功创建应该添加到列表并返回数据', async () => {
      const createData = { title: '新里程碑', projectId: 'proj_1', status: 'open' as const };
      mockFetch.mockResolvedValueOnce(mockResponse({ ...MOCK_MILESTONE, ...createData }));

      const result = await useMilestoneStore.getState().createMilestone(createData);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('新里程碑');
      expect(useMilestoneStore.getState().milestones).toHaveLength(1);
      expect(useMilestoneStore.getState().error).toBeNull();
    });

    it('API 失败应该返回 null 并设置 error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Create failed' }, 400));

      const result = await useMilestoneStore.getState().createMilestone({
        title: '失败', projectId: 'p1', status: 'open' as const,
      });
      expect(result).toBeNull();
      expect(useMilestoneStore.getState().error).toBeTruthy();
    });
  });

  describe('updateMilestoneAsync', () => {
    it('成功更新应该用 API 返回数据更新本地状态', async () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      const updatedData = { ...MOCK_MILESTONE, title: 'API 更新后的标题' };
      mockFetch.mockResolvedValueOnce(mockResponse(updatedData));

      const success = await useMilestoneStore.getState().updateMilestoneAsync('ms_test1', { title: 'API 更新后的标题' });
      expect(success).toBe(true);
      expect(useMilestoneStore.getState().milestones[0].title).toBe('API 更新后的标题');
      expect(useMilestoneStore.getState().error).toBeNull();
    });

    it('API 失败应该返回 false 并设置 error', async () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not found' }, 404));

      const success = await useMilestoneStore.getState().updateMilestoneAsync('ms_test1', { title: '失败' });
      expect(success).toBe(false);
      expect(useMilestoneStore.getState().error).toBeTruthy();
    });
  });

  describe('deleteMilestoneAsync', () => {
    it('成功删除应该从列表中移除', async () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE, MOCK_MILESTONE_2]);
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

      const success = await useMilestoneStore.getState().deleteMilestoneAsync('ms_test1');
      expect(success).toBe(true);
      expect(useMilestoneStore.getState().milestones).toHaveLength(1);
      expect(useMilestoneStore.getState().error).toBeNull();
    });

    it('API 失败应该保留本地数据', async () => {
      useMilestoneStore.getState().setMilestones([MOCK_MILESTONE]);
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Forbidden' }, 403));

      const success = await useMilestoneStore.getState().deleteMilestoneAsync('ms_test1');
      expect(success).toBe(false);
      expect(useMilestoneStore.getState().milestones).toHaveLength(1);
      expect(useMilestoneStore.getState().error).toBeTruthy();
    });
  });
});
