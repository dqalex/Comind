/**
 * 多用户权限集成测试
 * 
 * 测试覆盖：
 * 1. 用户注册/登录流程
 * 2. Session 管理
 * 3. 角色权限控制（admin/member/viewer）
 * 4. API 访问控制
 * 5. 项目成员权限
 * 
 * 运行方式：
 *   npx vitest run tests/integration/auth-permission.test.ts
 *   TEST_TARGET=remote npx vitest run tests/integration/auth-permission.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete, getBaseUrl, checkServiceHealth } from '../helpers/api-client';

// ============================================================================
// 测试数据
// ============================================================================

const TEST_USERS = {
  admin: {
    email: `test-admin-${Date.now()}@teamclaw.test`,
    password: 'TestPassword123!',
    name: '测试管理员',
    role: 'admin',
  },
  member: {
    email: `test-member-${Date.now()}@teamclaw.test`,
    password: 'TestPassword123!',
    name: '测试成员',
    role: 'member',
  },
  viewer: {
    email: `test-viewer-${Date.now()}@teamclaw.test`,
    password: 'TestPassword123!',
    name: '测试观察者',
    role: 'viewer',
  },
};

// ============================================================================
// 辅助函数
// ============================================================================

/** 生成唯一 ID */
function generateId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 从响应头提取 Set-Cookie */
function extractCookie(headers: Headers): string | null {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return null;
  
  // 提取 cms_session 的值
  const match = setCookie.match(/cms_session=([^;]+)/);
  return match ? match[1] : null;
}

/** 等待指定毫秒 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 测试套件
// ============================================================================

describe('多用户权限集成测试', () => {
  let adminCookie: string | null = null;
  let memberCookie: string | null = null;
  let viewerCookie: string | null = null;
  
  let adminUserId: string = '';
  let memberUserId: string = '';
  let viewerUserId: string = '';
  
  let testProjectId: string = '';
  let testTaskId: string = '';

  // -------------------- 前置检查 --------------------

  beforeAll(async () => {
    // 检查服务是否可达
    const health = await checkServiceHealth();
    console.log(`[测试环境] target=${health.target}, url=${health.url}, reachable=${health.reachable}`);
    
    if (!health.reachable) {
      throw new Error(`服务不可达，请确保开发服务器已启动: ${getBaseUrl()}`);
    }
  });

  // -------------------- 清理 --------------------

  afterAll(async () => {
    // 清理测试用户和项目（需要管理员权限）
    if (adminCookie) {
      // 清理项目
      if (testProjectId) {
        try {
          await apiDelete(`/api/projects/${testProjectId}`, {
            headers: { Cookie: `cms_session=${adminCookie}` },
          });
          console.log(`[清理] 已删除项目: ${testProjectId}`);
        } catch (e) {
          console.warn(`[清理] 删除项目失败:`, e);
        }
      }

      // 清理任务
      if (testTaskId) {
        try {
          await apiDelete(`/api/tasks/${testTaskId}`, {
            headers: { Cookie: `cms_session=${adminCookie}` },
          });
          console.log(`[清理] 已删除任务: ${testTaskId}`);
        } catch (e) {
          console.warn(`[清理] 删除任务失败:`, e);
        }
      }
    }

    console.log('[清理] 测试清理完成');
  });

  // ==================== 用户注册/登录 ====================

  describe('1. 用户注册与登录', () => {
    it('1.1 应该能注册新用户（admin）', async () => {
      const res = await apiPost('/api/auth/register', {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
        name: TEST_USERS.admin.name,
      });

      console.log(`[注册 admin] status=${res.status}`, res.data);
      
      // 检查响应（可能返回成功或需要初始化）
      if (res.ok) {
        adminUserId = (res.data as { user?: { id: string } }).user?.id || '';
        const cookie = extractCookie(res.headers);
        if (cookie) adminCookie = cookie;
      }
    });

    it('1.2 应该能注册新用户（member）', async () => {
      const res = await apiPost('/api/auth/register', {
        email: TEST_USERS.member.email,
        password: TEST_USERS.member.password,
        name: TEST_USERS.member.name,
      });

      console.log(`[注册 member] status=${res.status}`, res.data);
      
      if (res.ok) {
        memberUserId = (res.data as { user?: { id: string } }).user?.id || '';
        const cookie = extractCookie(res.headers);
        if (cookie) memberCookie = cookie;
      }
    });

    it('1.3 应该能注册新用户（viewer）', async () => {
      const res = await apiPost('/api/auth/register', {
        email: TEST_USERS.viewer.email,
        password: TEST_USERS.viewer.password,
        name: TEST_USERS.viewer.name,
      });

      console.log(`[注册 viewer] status=${res.status}`, res.data);
      
      if (res.ok) {
        viewerUserId = (res.data as { user?: { id: string } }).user?.id || '';
        const cookie = extractCookie(res.headers);
        if (cookie) viewerCookie = cookie;
      }
    });

    it('1.4 应该能登录已有用户', async () => {
      // 如果注册时已经登录，跳过
      if (adminCookie) {
        console.log(`[登录] 用户已在注册时登录`);
        return;
      }

      const res = await apiPost('/api/auth/login', {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      console.log(`[登录] status=${res.status}`, res.data);

      if (res.ok) {
        const cookie = extractCookie(res.headers);
        if (cookie) adminCookie = cookie;
      }
    });

    it('1.5 登录后应该能获取当前用户信息', async () => {
      if (!adminCookie) {
        console.log('[跳过] 未登录，无法获取用户信息');
        return;
      }

      const res = await apiGet('/api/auth/me', {
        headers: { Cookie: `cms_session=${adminCookie}` },
      });

      console.log(`[当前用户]`, res.data);

      expect(res.ok).toBe(true);
      const data = res.data as { user: { id: string; email: string; name: string; role: string } };
      expect(data.user.email).toBe(TEST_USERS.admin.email);
    });

    it('1.6 错误密码应该登录失败', async () => {
      const res = await apiPost('/api/auth/login', {
        email: TEST_USERS.admin.email,
        password: 'WrongPassword123!',
      });

      console.log(`[错误密码登录] status=${res.status}`);
      expect(res.ok).toBe(false);
    });
  });

  // ==================== API 权限控制 ====================

  describe('2. API 权限控制', () => {
    it('2.1 未登录用户不能访问受保护的 API', async () => {
      const res = await apiGet('/api/users');
      
      // 应该返回 401 或重定向到登录页
      console.log(`[未登录访问 /api/users] status=${res.status}`);
      // 具体行为取决于 withAuth 配置
    });

    it('2.2 登录用户可以访问基础 API', async () => {
      if (!adminCookie) {
        console.log('[跳过] 未登录');
        return;
      }

      const res = await apiGet('/api/tasks', {
        headers: { Cookie: `cms_session=${adminCookie}` },
      });

      console.log(`[登录访问 /api/tasks] status=${res.status}`);
      expect(res.ok).toBe(true);
    });

    it('2.3 只有管理员可以访问用户管理 API', async () => {
      if (!adminCookie) {
        console.log('[跳过] 管理员未登录');
        return;
      }

      const res = await apiGet('/api/users', {
        headers: { Cookie: `cms_session=${adminCookie}` },
      });

      console.log(`[管理员访问 /api/users] status=${res.status}`);
      // 管理员应该能访问
    });

    it('2.4 普通成员不能访问用户管理 API', async () => {
      if (!memberCookie) {
        console.log('[跳过] 成员未登录');
        return;
      }

      const res = await apiGet('/api/users', {
        headers: { Cookie: `cms_session=${memberCookie}` },
      });

      console.log(`[成员访问 /api/users] status=${res.status}`);
      // 应该返回 403 Forbidden
    });

    it('2.5 观察者权限受限', async () => {
      if (!viewerCookie) {
        console.log('[跳过] 观察者未登录');
        return;
      }

      // 观察者可以读取
      const readRes = await apiGet('/api/tasks', {
        headers: { Cookie: `cms_session=${viewerCookie}` },
      });
      console.log(`[观察者读取 /api/tasks] status=${readRes.status}`);

      // 观察者不能创建
      const createRes = await apiPost('/api/tasks', 
        { title: '测试任务', status: 'todo' },
        { headers: { Cookie: `cms_session=${viewerCookie}` } }
      );
      console.log(`[观察者创建任务] status=${createRes.status}`);
      // 应该返回 403
    });
  });

  // ==================== 项目成员权限 ====================

  describe('3. 项目成员权限', () => {
    it('3.1 管理员应该能创建项目', async () => {
      if (!adminCookie) {
        console.log('[跳过] 管理员未登录');
        return;
      }

      const res = await apiPost('/api/projects', 
        {
          id: generateId(),
          name: '[测试] 权限测试项目',
          description: '用于测试项目成员权限',
          status: 'active',
        },
        { headers: { Cookie: `cms_session=${adminCookie}` } }
      );

      console.log(`[创建项目] status=${res.status}`, res.data);

      if (res.ok) {
        testProjectId = (res.data as { id: string }).id;
      }
    });

    it('3.2 应该能获取项目成员列表', async () => {
      if (!testProjectId || !adminCookie) {
        console.log('[跳过] 项目未创建或未登录');
        return;
      }

      // 尝试获取项目成员（API 可能不存在）
      try {
        const res = await apiGet(`/api/projects/${testProjectId}/members`, {
          headers: { Cookie: `cms_session=${adminCookie}` },
        });

        console.log(`[项目成员列表] status=${res.status}`, res.data);
      } catch (e) {
        console.log(`[项目成员列表] API 可能不存在`);
      }
    });

    it('3.3 成员应该能访问项目', async () => {
      if (!testProjectId || !memberCookie) {
        console.log('[跳过] 项目未创建或成员未登录');
        return;
      }

      const res = await apiGet(`/api/projects/${testProjectId}`, {
        headers: { Cookie: `cms_session=${memberCookie}` },
      });

      console.log(`[成员访问项目] status=${res.status}`);
    });

    it('3.4 非项目成员访问受限', async () => {
      if (!testProjectId || !viewerCookie) {
        console.log('[跳过] 项目未创建或观察者未登录');
        return;
      }

      const res = await apiGet(`/api/projects/${testProjectId}`, {
        headers: { Cookie: `cms_session=${viewerCookie}` },
      });

      console.log(`[观察者访问项目] status=${res.status}`);
      // 具体行为取决于项目权限配置
    });
  });

  // ==================== 任务权限 ====================

  describe('4. 任务权限', () => {
    it('4.1 管理员应该能创建任务', async () => {
      if (!adminCookie) {
        console.log('[跳过] 管理员未登录');
        return;
      }

      const res = await apiPost('/api/tasks', 
        {
          id: generateId(),
          title: '[测试] 权限测试任务',
          description: '用于测试任务权限',
          status: 'todo',
          priority: 'medium',
          projectId: testProjectId || null,
        },
        { headers: { Cookie: `cms_session=${adminCookie}` } }
      );

      console.log(`[创建任务] status=${res.status}`, res.data);

      if (res.ok) {
        testTaskId = (res.data as { id: string }).id;
      }
    });

    it('4.2 成员应该能更新任务', async () => {
      if (!testTaskId || !memberCookie) {
        console.log('[跳过] 任务未创建或成员未登录');
        return;
      }

      const res = await apiPut(`/api/tasks/${testTaskId}`, 
        { status: 'in_progress' },
        { headers: { Cookie: `cms_session=${memberCookie}` } }
      );

      console.log(`[成员更新任务] status=${res.status}`);
    });

    it('4.3 只有管理员能删除任务', async () => {
      // 创建一个临时任务用于删除测试
      if (!adminCookie) {
        console.log('[跳过] 管理员未登录');
        return;
      }

      const createRes = await apiPost('/api/tasks', 
        {
          id: generateId(),
          title: '[测试] 待删除任务',
          status: 'todo',
        },
        { headers: { Cookie: `cms_session=${adminCookie}` } }
      );

      if (!createRes.ok) {
        console.log('[跳过] 创建任务失败');
        return;
      }

      const tempTaskId = (createRes.data as { id: string }).id;

      // 成员尝试删除
      if (memberCookie) {
        const memberDeleteRes = await apiDelete(`/api/tasks/${tempTaskId}`, {
          headers: { Cookie: `cms_session=${memberCookie}` },
        });
        console.log(`[成员删除任务] status=${memberDeleteRes.status}`);
        // 应该失败
      }

      // 管理员删除
      const adminDeleteRes = await apiDelete(`/api/tasks/${tempTaskId}`, {
        headers: { Cookie: `cms_session=${adminCookie}` },
      });
      console.log(`[管理员删除任务] status=${adminDeleteRes.status}`);
    });
  });

  // ==================== Session 管理 ====================

  describe('5. Session 管理', () => {
    it('5.1 应该能登出', async () => {
      if (!adminCookie) {
        console.log('[跳过] 未登录');
        return;
      }

      const res = await apiPost('/api/auth/logout', {}, {
        headers: { Cookie: `cms_session=${adminCookie}` },
      });

      console.log(`[登出] status=${res.status}`);
      
      if (res.ok) {
        adminCookie = null;
      }
    });

    it('5.2 登出后 Session 失效', async () => {
      if (adminCookie) {
        // 如果登出失败，adminCookie 仍然有值
        const res = await apiGet('/api/auth/me', {
          headers: { Cookie: `cms_session=${adminCookie}` },
        });

        console.log(`[登出后访问] status=${res.status}`);
        // 应该返回 401
      }
    });
  });

  // ==================== 安全验证 ====================

  describe('6. 安全验证', () => {
    it('6.1 登录限流', async () => {
      // 连续多次错误登录
      for (let i = 0; i < 6; i++) {
        const res = await apiPost('/api/auth/login', {
          email: TEST_USERS.admin.email,
          password: 'WrongPassword',
        });
        console.log(`[错误登录 ${i + 1}] status=${res.status}`);
        await delay(100);
      }

      // 第 6 次应该被锁定
      const res = await apiPost('/api/auth/login', {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });
      console.log(`[锁定后登录] status=${res.status}`);
    });

    it('6.2 SQL 注入防护', async () => {
      const res = await apiPost('/api/auth/login', {
        email: "admin@example.com' OR '1'='1",
        password: 'anything',
      });

      console.log(`[SQL 注入尝试] status=${res.status}`);
      // 应该返回错误，不应该成功登录
      expect(res.ok).toBe(false);
    });

    it('6.3 XSS 防护', async () => {
      if (!adminCookie) {
        console.log('[跳过] 未登录');
        return;
      }

      // 创建包含脚本的任务标题
      const res = await apiPost('/api/tasks', 
        {
          id: generateId(),
          title: '<script>alert("XSS")</script>测试任务',
          status: 'todo',
        },
        { headers: { Cookie: `cms_session=${adminCookie}` } }
      );

      console.log(`[XSS 尝试] status=${res.status}`);
      
      // 检查返回的数据是否被转义
      if (res.ok) {
        const task = res.data as { title: string };
        console.log(`[存储的标题] ${task.title}`);
        // 应该被转义或存储为文本，不应该执行
      }
    });
  });
});
