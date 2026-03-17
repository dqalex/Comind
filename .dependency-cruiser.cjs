/**
 * Dependency Cruiser 配置 v2.0
 * 适配新的 src/ 层级架构
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ========== 循环依赖规则 ==========
    {
      name: 'no-circular',
      severity: 'error',
      comment: '禁止模块间循环依赖',
      from: {
        pathNot: '^(app/api/mcp/handlers/delivery\.handler|lib/server-gateway-client|lib/chat-channel/executor|src/shared/lib/chat-channel/executor)'
      },
      to: { circular: true }
    },

    // ========== 架构分层规则 ==========
    // Layer 5 (Pages) 禁止直接访问 Layer 1-2 (Core/Domains 内部)
    {
      name: 'no-app-imports-src-internal',
      severity: 'error',
      comment: 'app 页面只能通过领域 index 导入，禁止访问领域内部',
      from: { path: '^app' },
      to: {
        path: '^src/domains/[^/]+/',
        pathNot: '^src/domains/[^/]+/index'
      }
    },

    // Layer 4 (Features) 禁止直接访问 Layer 1-2 (Core/Domains 内部)
    {
      name: 'no-feature-imports-domain-internal',
      severity: 'error',
      comment: 'features 只能通过领域 index 导入，禁止访问领域内部',
      from: { path: '^src/features' },
      to: {
        path: '^src/domains/[^/]+/',
        pathNot: '^src/domains/[^/]+/index'
      }
    },

    // Layer 3 (Shared) 禁止访问 Layer 4 (Features)
    {
      name: 'no-shared-imports-features',
      severity: 'error',
      comment: 'shared 层不能依赖 features 层',
      from: { path: '^src/shared' },
      to: { path: '^src/features' }
    },

    // 领域之间禁止直接导入（通过 shared/services 通信）
    {
      name: 'no-domain-cross-import',
      severity: 'error',
      comment: '领域之间禁止直接导入，通过 shared/services 通信',
      from: { path: '^src/domains/([^/]+)/' },
      to: { path: '^src/domains/(?!$1)/' }
    },

    // ========== 遗留代码规则 ==========
    // 旧 store 目录访问限制（逐步迁移中）
    {
      name: 'no-store-to-db-direct',
      severity: 'warn',
      comment: 'store 应该通过 lib/data-service 访问数据',
      from: { path: '^(store|src/domains)' },
      to: { path: '^(db|src/core/db)', pathNot: '^(db|src/core/db)/schema' }
    },

    // 旧 components 直接访问 lib 内部（必须通过 lib/index 或 src/shared）
    {
      name: 'no-direct-lib-internal',
      severity: 'error',
      comment: '禁止直接访问 lib 内部模块，请通过 lib/index 或 src/shared 导入',
      from: { path: '^(components|src/features|src/shared/layout)' },
      to: {
        path: '^lib/(slot-sync|icon-render|sop-config|sse-events|logger|tool-policy|gateway-client|chat-channel)',
        pathNot: '^lib/index'
      }
    },

    // 禁止层间跳跃
    {
      name: 'no-layer-skip',
      severity: 'error',
      comment: '禁止跳过层级访问',
      from: { path: '^(components|src/features|src/shared/layout)' },
      to: { path: '^(db|src/core/db)' }
    },

    // 禁止反向依赖
    {
      name: 'no-reverse-dependency',
      severity: 'error',
      comment: '禁止反向依赖（低层依赖高层）',
      from: { path: '^(lib|src/shared|src/core)' },
      to: { path: '^(components|src/features)' }
    },

    // ========== 代码质量规则 ==========
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: '孤立文件 - 未被任何模块引用',
      from: { orphan: true },
      to: {}
    },

    // 信息级：访问模式建议
    {
      name: 'components-access-pattern',
      severity: 'info',
      comment: '建议通过统一入口访问工具函数',
      from: { path: '^(components|src/features)' },
      to: {
        path: '^lib/.*',
        pathNot: '^lib/(auth|i18n|data-service|gateway-proxy|id|sanitize|event-bus|index)'
      }
    }
  ],

  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    exclude: {
      path: [
        '\\.d\\.ts$',
        'tests/',
        '__mocks__/',
        'scripts/',
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
