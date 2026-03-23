/**
 * Dependency Cruiser 配置 v2.0
 * 原子化架构依赖规则
 * 
 * 架构层级（从高到低）：
 * Layer 5: app/ - 页面层 (Next.js App Router)
 * Layer 4: src/features/ - 功能层
 * Layer 3: src/shared/ - 共享层
 * Layer 2: src/domains/ - 领域层
 * Layer 1: src/core/, app/api/ - 核心层/基础设施
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ========== 架构分层规则 ==========
    // features 只能通过领域 index 导入
    {
      name: 'no-feature-imports-domain-internal',
      severity: 'error',
      comment: 'feature 只能通过领域 index 导入，禁止访问领域内部',
      from: { path: '^src/features' },
      to: {
        path: '^src/domains/[^/]+/',
        pathNot: '^src/domains/[^/]+/index'
      }
    },
    // 领域之间禁止直接导入（通过 shared/services 通信）
    {
      name: 'no-domain-cross-import',
      severity: 'error',
      comment: '领域之间禁止直接导入，通过 shared/services 通信',
      from: { path: '^src/domains/([^/]+)/' },
      to: { path: '^src/domains/(?!$1)/' }
    },
    // shared 层（除 layout/hooks 外）不能依赖 domain/feature 层
    {
      name: 'no-shared-imports-domain',
      severity: 'error',
      comment: 'shared 层不能依赖 domain 层',
      from: { 
        path: '^src/shared',
        pathNot: '^(src/shared/layout|src/shared/hooks)'
      },
      to: { path: '^src/domains' }
    },
    {
      name: 'no-shared-imports-features',
      severity: 'error',
      comment: 'shared 层不能依赖 features 层',
      from: { path: '^src/shared' },
      to: { path: '^src/features' }
    },

    // ========== 循环依赖规则 ==========
    // 排除已知循环依赖路径（待后续重构解决）
    {
      name: 'no-circular',
      severity: 'error',
      comment: '禁止模块间循环依赖',
      from: {
        pathNot: '^(src/core/gateway/store)'
      },
      to: { circular: true }
    },

    // ========== 代码质量规则 ==========
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: '孤立文件 - 未被任何模块引用',
      from: { 
        orphan: true,
        pathNot: '^(tailwind|postcss|[.]dependency-cruiser|app/loading|core/mcp/definitions|src/shared/lib/.*|lib/(login-rate-limit|api-errors)|src/domains/.*/api/logout/route|app/api/auth/logout/route)'
      },
      to: {}
    }
  ],

  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    exclude: {
      path: [
        '[.]d[.]ts$',
        'tests/',
        '__mocks__/',
        'scripts/',
        '[.]next/',
        'src/shared/lib/chat-channel/',
        'lib/chat-channel/'
      ]
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    }
  }
};
