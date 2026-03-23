/**
 * 审批系统 API 集成测试
 * 
 * 测试覆盖：
 * 1. 创建审批请求
 * 2. 获取审批请求
 * 3. 批准审批请求
 * 4. 拒绝审批请求
 * 5. 取消审批请求
 * 6. 权限验证
 * 
 * 运行方式：
 * npx vitest run tests/integration/approval-api.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, checkServiceHealth, getBaseUrl } from '../helpers/api-client';
import { AuthHelper, setupAuth } from '../helpers/auth-helper';
import { execSync } from 'child_process';

describe('Approval System E2E Tests', () => {
  let adminAuth: AuthHelper;
  let memberAuth: AuthHelper;
  let createdRequestId: string;

  beforeAll(async () => {
    // 检查服务是否可达
    const health = await checkServiceHealth();
    console.log(`[测试环境] target=${health.target}, url=${health.url}, reachable=${health.reachable}`);
    
    if (!health.reachable) {
      throw new Error(`服务不可达，请确保开发服务器已启动: ${getBaseUrl()}`);
    }

    // 设置管理员和普通用户认证
    adminAuth = await setupAuth('admin');
    memberAuth = await setupAuth('member');

    // 确保管理员用户具有 admin 角色
    // 注册 API 只会将第一个用户设为 admin，所以需要手动更新
    const adminUser = adminAuth.getUser();
    if (adminUser && adminUser.role !== 'admin') {
      // 使用 sqlite3 命令行工具更新数据库
      const dbPath = process.cwd() + '/data/teamclaw.db';
      try {
        execSync(`sqlite3 "${dbPath}" "UPDATE users SET role = 'admin' WHERE id = '${adminUser.id}';"`);
        console.log(`[测试] 已将用户 ${adminUser.email} 设为 admin`);
      } catch (err) {
        console.warn('[测试] 更新用户角色失败:', err);
      }
    }
  });

  afterAll(async () => {
    // 清理测试数据
    if (adminAuth) {
      await adminAuth.logout();
    }
    if (memberAuth) {
      await memberAuth.logout();
    }
    console.log('[清理] 测试清理完成');
  });

  describe('1. 创建审批请求', () => {
    it('should create a new approval request', async () => {
      const res = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-id-' + Date.now(),
        requestNote: 'Please approve my skill',
      }, { headers: memberAuth.getAuthHeaders() });

      console.log(`[创建审批] status=${res.status}`, res.data);
      
      expect(res.ok).toBe(true);
      const data = res.data as { request: { id: string; type: string; status: string } };
      expect(data.request).toBeDefined();
      expect(data.request.type).toBe('skill_publish');
      expect(data.request.status).toBe('pending');
      
      createdRequestId = data.request.id;
    });

    it('should prevent duplicate pending requests', async () => {
      const resourceId = 'test-skill-dupe-' + Date.now();
      
      // 第一次创建
      await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId,
        requestNote: 'First request',
      }, { headers: memberAuth.getAuthHeaders() });

      // 第二次创建相同 resource 的请求
      const res = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId,
        requestNote: 'Duplicate request',
      }, { headers: memberAuth.getAuthHeaders() });

      console.log(`[重复请求] status=${res.status}`, res.data);
      expect(res.status).toBe(400);
      const data = res.data as { error: string };
      expect(data.error).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const res = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        // missing resourceType and resourceId
      }, { headers: memberAuth.getAuthHeaders() });

      console.log(`[缺少字段] status=${res.status}`);
      expect(res.status).toBe(400);
    });
  });

  describe('2. 获取审批请求', () => {
    it('should get approval request list', async () => {
      const res = await apiGet('/api/approval-requests', { headers: adminAuth.getAuthHeaders() });

      console.log(`[获取列表] status=${res.status}`);
      expect(res.ok).toBe(true);
      const data = res.data as { requests: Array<{ id: string; status: string }> };
      expect(Array.isArray(data.requests)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await apiGet('/api/approval-requests?status=pending', { headers: adminAuth.getAuthHeaders() });

      console.log(`[筛选状态] status=${res.status}`);
      expect(res.ok).toBe(true);
      const data = res.data as { requests: Array<{ status: string }> };
      expect(data.requests.every((r) => r.status === 'pending')).toBe(true);
    });

    it('should get approval request detail', async () => {
      if (!createdRequestId) {
        console.log('[跳过] 没有创建的请求 ID');
        return;
      }

      const res = await apiGet(`/api/approval-requests/${createdRequestId}`, { headers: memberAuth.getAuthHeaders() });

      console.log(`[获取详情] status=${res.status}`);
      expect(res.ok).toBe(true);
      const data = res.data as { request: { id: string }; histories: unknown[] };
      expect(data.request.id).toBe(createdRequestId);
      expect(data.histories).toBeDefined();
    });
  });

  describe('3. 批准审批请求', () => {
    it('should allow admin to approve request', async () => {
      // 创建新请求
      const createRes = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-approve-' + Date.now(),
        requestNote: 'Please approve',
      }, { headers: memberAuth.getAuthHeaders() });

      const createData = createRes.data as { request: { id: string } };
      const requestId = createData.request.id;

      // 管理员批准
      const res = await apiPost(`/api/approval-requests/${requestId}/approve`, { note: 'Approved' }, { headers: adminAuth.getAuthHeaders() });

      console.log(`[批准请求] status=${res.status}`);
      expect(res.ok).toBe(true);
      const data = res.data as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('should prevent non-admin from approving', async () => {
      // 创建新请求
      const createRes = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-non-admin-' + Date.now(),
        requestNote: 'Please approve',
      }, { headers: memberAuth.getAuthHeaders() });

      const createData = createRes.data as { request: { id: string } };
      const requestId = createData.request.id;

      // 普通用户尝试批准
      const res = await apiPost(`/api/approval-requests/${requestId}/approve`, { note: 'Trying to approve' }, { headers: memberAuth.getAuthHeaders() });

      console.log(`[非管理员批准] status=${res.status}`);
      expect(res.status).toBe(403);

      // 清理
      await apiPost(`/api/approval-requests/${requestId}/cancel`, {}, { headers: memberAuth.getAuthHeaders() });
    });
  });

  describe('4. 拒绝审批请求', () => {
    it('should allow admin to reject request', async () => {
      // 创建新请求
      const createRes = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-reject-' + Date.now(),
        requestNote: 'Please approve',
      }, { headers: memberAuth.getAuthHeaders() });

      const createData = createRes.data as { request: { id: string } };
      const requestId = createData.request.id;

      // 管理员拒绝
      const res = await apiPost(`/api/approval-requests/${requestId}/reject`, { note: 'Does not meet requirements' }, { headers: adminAuth.getAuthHeaders() });

      console.log(`[拒绝请求] status=${res.status}`);
      expect(res.ok).toBe(true);
    });

    it('should prevent non-admin from rejecting', async () => {
      // 创建新请求
      const createRes = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-reject-non-admin-' + Date.now(),
        requestNote: 'Please approve',
      }, { headers: memberAuth.getAuthHeaders() });

      const createData = createRes.data as { request: { id: string } };
      const requestId = createData.request.id;

      // 普通用户尝试拒绝
      const res = await apiPost(`/api/approval-requests/${requestId}/reject`, { note: 'Rejecting' }, { headers: memberAuth.getAuthHeaders() });

      console.log(`[非管理员拒绝] status=${res.status}`);
      expect(res.status).toBe(403);

      // 清理
      await apiPost(`/api/approval-requests/${requestId}/cancel`, {}, { headers: memberAuth.getAuthHeaders() });
    });
  });

  describe('5. 取消审批请求', () => {
    it('should allow requester to cancel own request', async () => {
      // 创建新请求
      const createRes = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-cancel-owner-' + Date.now(),
        requestNote: 'Please approve',
      }, { headers: memberAuth.getAuthHeaders() });

      const createData = createRes.data as { request: { id: string } };
      const requestId = createData.request.id;

      // 请求者取消
      const res = await apiPost(`/api/approval-requests/${requestId}/cancel`, { note: 'Changed my mind' }, { headers: memberAuth.getAuthHeaders() });

      console.log(`[取消自己请求] status=${res.status}`);
      expect(res.ok).toBe(true);
    });

    it('should allow admin to cancel any request', async () => {
      // 创建新请求
      const createRes = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-cancel-admin-' + Date.now(),
        requestNote: 'Please approve',
      }, { headers: memberAuth.getAuthHeaders() });

      const createData = createRes.data as { request: { id: string } };
      const requestId = createData.request.id;

      // 管理员取消
      const res = await apiPost(`/api/approval-requests/${requestId}/cancel`, { note: 'Admin cancelling' }, { headers: adminAuth.getAuthHeaders() });

      console.log(`[管理员取消] status=${res.status}`);
      expect(res.ok).toBe(true);
    });

    it('should prevent canceling processed request', async () => {
      // 创建新请求并批准
      const createRes = await apiPost('/api/approval-requests', {
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: 'test-skill-cancel-processed-' + Date.now(),
        requestNote: 'Please approve',
      }, { headers: memberAuth.getAuthHeaders() });

      const createData = createRes.data as { request: { id: string } };
      const requestId = createData.request.id;

      // 先批准
      await apiPost(`/api/approval-requests/${requestId}/approve`, { note: 'Approved' }, { headers: adminAuth.getAuthHeaders() });

      // 尝试取消已处理的请求
      const res = await apiPost(`/api/approval-requests/${requestId}/cancel`, { note: 'Trying to cancel' }, { headers: memberAuth.getAuthHeaders() });

      console.log(`[取消已处理请求] status=${res.status}`);
      expect(res.status).toBe(400);
    });
  });
});
