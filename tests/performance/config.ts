/**
 * 性能测试配置
 */

export const PERFORMANCE_CONFIG = {
  // 基准测试配置
  baseline: {
    // 单次请求超时（毫秒）
    timeout: 5000,
    // 每个测试重复次数
    iterations: 100,
    // 预热次数（不计入统计）
    warmupIterations: 10,
    // 并发用户数
    concurrentUsers: [1, 5, 10, 20, 50],
  },

  // 压力测试配置
  stress: {
    // 持续时间（秒）
    duration: 60,
    // 并发用户数
    concurrentUsers: 100,
    // 请求间隔（毫秒）
    requestInterval: 100,
    // 最大响应时间阈值（毫秒）
    maxResponseTime: 5000,
    // 错误率阈值
    maxErrorRate: 0.05,
    // P95 响应时间阈值
    maxP95ResponseTime: 2000,
  },

  // 负载测试配置
  load: {
    // 逐步增加用户数
    rampUp: {
      startUsers: 1,
      targetUsers: 100,
      duration: 300, // 秒
    },
    // 持续时间（秒）
    sustainDuration: 120,
    // 降压时间（秒）
    rampDown: 60,
  },

  // 性能阈值
  thresholds: {
    // API 响应时间
    api: {
      // GET 请求
      get: {
        excellent: 100, // 优秀
        good: 300,      // 良好
        acceptable: 1000, // 可接受
      },
      // POST/PUT/DELETE 请求
      mutation: {
        excellent: 200,
        good: 500,
        acceptable: 1500,
      },
      // 批量操作
      batch: {
        excellent: 500,
        good: 1000,
        acceptable: 3000,
      },
    },
    // 数据库操作
    database: {
      // 单条查询
      singleQuery: {
        excellent: 10,
        good: 50,
        acceptable: 200,
      },
      // 批量查询
      batchQuery: {
        excellent: 100,
        good: 500,
        acceptable: 2000,
      },
      // 写入操作
      write: {
        excellent: 20,
        good: 100,
        acceptable: 500,
      },
    },
    // 前端渲染
    frontend: {
      // 首次内容绘制
      fcp: {
        excellent: 1000,
        good: 2000,
        acceptable: 3000,
      },
      // 最大内容绘制
      lcp: {
        excellent: 2000,
        good: 3000,
        acceptable: 4000,
      },
      // 首次输入延迟
      fid: {
        excellent: 50,
        good: 100,
        acceptable: 300,
      },
      // 累积布局偏移
      cls: {
        excellent: 0.05,
        good: 0.1,
        acceptable: 0.25,
      },
    },
  },

  // API 模块列表
  apiModules: [
    { name: 'tasks', path: '/api/tasks', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'projects', path: '/api/projects', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'documents', path: '/api/documents', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'members', path: '/api/members', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'chat-sessions', path: '/api/chat-sessions', methods: ['GET', 'POST'] },
    { name: 'chat-messages', path: '/api/chat-messages', methods: ['GET', 'POST'] },
    { name: 'milestones', path: '/api/milestones', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'templates', path: '/api/templates', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'sop-templates', path: '/api/sop-templates', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'skills', path: '/api/skills', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'agents', path: '/api/agents', methods: ['GET'] },
    { name: 'sessions', path: '/api/sessions', methods: ['GET'] },
    { name: 'scheduled-tasks', path: '/api/scheduled-tasks', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'deliveries', path: '/api/deliveries', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'approval-requests', path: '/api/approval-requests', methods: ['GET', 'POST', 'PUT'] },
    { name: 'blog', path: '/api/blog', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'comments', path: '/api/comments', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'health', path: '/api/health', methods: ['GET'] },
    { name: 'sse', path: '/api/sse', methods: ['GET'] },
    { name: 'mcp', path: '/api/mcp', methods: ['POST'] },
    { name: 'auth', path: '/api/auth', methods: ['POST'] },
  ],
} as const;

export type PerformanceConfig = typeof PERFORMANCE_CONFIG;
