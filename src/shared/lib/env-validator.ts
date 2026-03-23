/**
 * 环境变量验证工具
 * 
 * 在应用启动时检查必要的环境变量，确保配置完整
 * 使用方式：在 instrumentation.ts 或 app 启动文件中调用 validateEnv()
 */

/**
 * 环境变量配置定义
 */
interface EnvVarConfig {
  name: string;
  required: boolean;
  description: string;
  defaultValue?: string;
  validate?: (value: string) => boolean;
}

// 环境变量配置列表
const ENV_CONFIGS: EnvVarConfig[] = [
  // === 数据库配置 ===
  {
    name: 'DATABASE_URL',
    required: false,  // SQLite 默认不需要
    description: 'PostgreSQL 数据库连接字符串（可选，默认使用 SQLite）',
    validate: (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
  },
  {
    name: 'TEAMCLAW_DB_PATH',
    required: false,
    description: 'SQLite 数据库路径（可选，默认 data/teamclaw.db）',
  },
  
  // === 认证配置 ===
  {
    name: 'TEAMCLAW_API_TOKEN',
    required: false,  // 开发环境可不设置
    description: 'API 认证 Token（生产环境必须）',
  },
  {
    name: 'JWT_SECRET',
    required: false,  // 开发环境可不设置
    description: 'JWT 签名密钥（生产环境必须）',
    validate: (value) => value.length >= 32,
  },
  {
    name: 'MCP_TOKEN_KEY',
    required: false,  // 开发环境可自动派生
    description: 'MCP Token 加密密钥（生产环境必须，至少 32 字符。生成命令: openssl rand -hex 32）',
    validate: (value) => value.length >= 32,
  },
  
  // === CORS 配置 ===
  {
    name: 'ALLOWED_ORIGINS',
    required: false,
    description: '允许的 CORS 来源（逗号分隔，生产环境推荐设置）',
  },
  
  // === OpenClaw Gateway 配置 ===
  {
    name: 'OPENCLAW_GATEWAY_URL',
    required: false,
    description: 'OpenClaw Gateway WebSocket URL',
  },
  
  // === 环境标识 ===
  {
    name: 'NODE_ENV',
    required: false,
    description: '运行环境（development/production/test）',
    defaultValue: 'development',
    validate: (value) => ['development', 'production', 'test'].includes(value),
  },
  
  // === 测试环境 ===
  {
    name: 'PLAYWRIGHT_TEST',
    required: false,
    description: '标识是否为 Playwright 测试环境',
    validate: (value) => ['true', 'false'].includes(value),
  },
];

/**
 * 验证环境变量
 * @param strict 是否严格模式（生产环境推荐）
 * @returns 验证结果
 */
export function validateEnv(strict: boolean = false): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, string | undefined>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Record<string, string | undefined> = {};
  const isProduction = process.env.NODE_ENV === 'production';
  
  for (const envVar of ENV_CONFIGS) {
    const value = process.env[envVar.name];
    
    // 检查必填变量
    if (envVar.required && !value) {
      errors.push(`缺少必填环境变量: ${envVar.name} - ${envVar.description}`);
      continue;
    }
    
    // 记录配置值
    config[envVar.name] = value || envVar.defaultValue;
    
    // 检查生产环境必需变量
    if (isProduction && !value && envVar.name === 'TEAMCLAW_API_TOKEN') {
      errors.push(`Production required: ${envVar.name} - ${envVar.description}`);
    }
    
    if (isProduction && !value && envVar.name === 'JWT_SECRET') {
      errors.push(`Production required: ${envVar.name} - ${envVar.description}`);
    }
    
    if (isProduction && !value && envVar.name === 'MCP_TOKEN_KEY') {
      errors.push(`Production required: ${envVar.name} - ${envVar.description}`);
    }
    
    // 验证格式
    if (value && envVar.validate && !envVar.validate(value)) {
      errors.push(`环境变量格式错误: ${envVar.name} - ${envVar.description}`);
    }
  }
  
  // 打印环境信息（开发环境）
  if (!isProduction && errors.length === 0) {
    console.log('[Env Validator] 环境变量验证通过');
    if (warnings.length > 0) {
      console.warn('[Env Validator] 警告:', warnings.join('; '));
    }
  }
  
  // 严格模式：有警告也报错
  if (strict && warnings.length > 0) {
    errors.push(...warnings);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

/**
 * 启动时验证环境变量
 * 如果验证失败，抛出错误阻止应用启动
 */
export function validateEnvOnStartup(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const result = validateEnv(false); // 不使用严格模式，警告不转为错误
  
  // 只有真正的错误才阻止启动
  if (result.errors.length > 0) {
    console.error('\n========================================');
    console.error('环境变量验证失败！');
    console.error('========================================');
    result.errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    console.error('\n请检查 .env 文件或环境变量配置');
    console.error('========================================\n');
    
    // 生产环境强制退出
    if (isProduction) {
      process.exit(1);
    }
    
    // 开发环境抛出警告但不阻止启动
    console.warn('[Env Validator] 开发环境允许继续启动，但请尽快修复上述问题');
  } else if (result.warnings.length > 0) {
    // 只有警告，不阻止启动
    console.warn('\n========================================');
    console.warn('环境变量验证警告！');
    console.warn('========================================');
    result.warnings.forEach((warning, index) => {
      console.warn(`${index + 1}. ${warning}`);
    });
    console.warn('\n建议检查 .env 文件或环境变量配置');
    console.warn('========================================\n');
  }
}

/**
 * 获取环境变量（带默认值）
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * 获取必需的环境变量
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`缺少必需的环境变量: ${key}`);
  }
  return value;
}

/**
 * 检查是否为生产环境
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * 检查是否为测试环境
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === 'true';
}
