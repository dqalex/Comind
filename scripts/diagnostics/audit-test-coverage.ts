#!/usr/bin/env npx tsx
/**
 * 测试覆盖审计脚本
 * 扫描项目所有模块（API/Store/Lib/Hooks/MCP），对比 tests/ 目录现有测试，
 * 输出缺失覆盖矩阵报告。
 *
 * 用法：
 *   npx tsx scripts/audit-test-coverage.ts              # 输出到终端
 *   npx tsx scripts/audit-test-coverage.ts --json        # 输出 JSON
 *   npx tsx scripts/audit-test-coverage.ts --markdown    # 输出 Markdown 报告文件
 */

import fs from 'fs';
import path from 'path';

// 原生 glob 替代：递归查找匹配的文件
function globSync(pattern: string, options: { cwd: string }): string[] {
  const results: string[] = [];
  const cwd = options.cwd;
  
  // 将 glob pattern 转为正则
  // 支持 ** (任意深度) 和 * (文件名通配符)
  const parts = pattern.split('/');
  
  function walk(dir: string, patternParts: string[], depth: number): void {
    if (patternParts.length === 0) return;
    
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(cwd, dir), { withFileTypes: true });
    } catch {
      return;
    }
    
    const [current, ...rest] = patternParts;
    
    if (current === '**') {
      // ** 匹配零到任意层目录
      // 先尝试跳过 **（匹配零层）
      walk(dir, rest, depth);
      // 然后递归进入每个子目录
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.next') {
          const subdir = dir ? `${dir}/${entry.name}` : entry.name;
          walk(subdir, patternParts, depth + 1); // 保持 ** 模式继续递归
        }
      }
    } else {
      // 普通模式匹配
      const regex = new RegExp('^' + current.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$');
      
      for (const entry of entries) {
        if (!regex.test(entry.name)) continue;
        
        const fullRel = dir ? `${dir}/${entry.name}` : entry.name;
        
        if (rest.length === 0) {
          // 这是最后一段，直接加入结果
          results.push(fullRel);
        } else if (entry.isDirectory()) {
          walk(fullRel, rest, depth + 1);
        }
      }
    }
  }
  
  walk('', parts, 0);
  return results.sort();
}

// ============================================================
// 类型定义
// ============================================================

interface ModuleInfo {
  /** 模块路径（相对项目根目录） */
  path: string;
  /** 所属领域 */
  domain: string;
  /** 模块类型 */
  type: 'api' | 'store' | 'lib' | 'hook' | 'mcp' | 'page' | 'component' | 'db';
  /** 优先级：P0 核心 / P1 重要 / P2 一般 / P3 低 */
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** 是否有单元测试覆盖 */
  hasUnitTest: boolean;
  /** 是否有集成测试覆盖 */
  hasIntegrationTest: boolean;
  /** 是否有 E2E 测试覆盖 */
  hasE2ETest: boolean;
  /** 匹配到的测试文件 */
  matchedTests: string[];
}

interface AuditReport {
  timestamp: string;
  summary: {
    totalModules: number;
    coveredModules: number;
    coverageRate: string;
    byType: Record<string, { total: number; covered: number; rate: string }>;
    byPriority: Record<string, { total: number; covered: number; rate: string }>;
  };
  modules: ModuleInfo[];
  missingTests: ModuleInfo[];
  scriptAudit: ScriptAuditResult;
  problems: Problem[];
}

interface ScriptAuditResult {
  total: number;
  categories: Record<string, ScriptInfo[]>;
  duplicates: string[][];
  missingFromReadme: string[];
}

interface ScriptInfo {
  path: string;
  category: string;
  description: string;
}

interface Problem {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  message: string;
  files?: string[];
}

// ============================================================
// 配置
// ============================================================

const ROOT = path.resolve(process.cwd());

// 领域到关键词的映射
const DOMAIN_MAP: Record<string, string[]> = {
  auth: ['auth', 'login', 'register', 'logout', 'session', 'password', 'security-code', 'permission'],
  task: ['task', 'task-log', 'sop-advance'],
  project: ['project', 'milestone', 'member'],
  document: ['document', 'wiki', 'blog', 'template', 'render-template'],
  chat: ['chat', 'chat-session', 'chat-message', 'chat-action', 'chat-reply', 'chat-mcp', 'chat-context', 'chat-channel'],
  delivery: ['delivery', 'deliveries', 'approval'],
  sop: ['sop', 'sop-template', 'sop-stats'],
  skill: ['skill', 'skillhub', 'skill-snapshot', 'skill-package'],
  openclaw: ['openclaw', 'workspace', 'openclaw-file', 'openclaw-conflict', 'openclaw-status'],
  gateway: ['gateway', 'agent', 'session', 'schedule', 'cron'],
  mcp: ['mcp', 'mcp-token', 'user-mcp-token'],
  system: ['health', 'sse', 'init', 'debug', 'upload', 'landing', 'admin', 'heartbeat', 'context-request', 'task-push', 'scheduled-task'],
  user: ['user', 'users'],
};

// 优先级配置
const PRIORITY_MAP: Record<string, 'P0' | 'P1' | 'P2' | 'P3'> = {
  auth: 'P0',
  task: 'P0',
  project: 'P0',
  document: 'P1',
  chat: 'P1',
  delivery: 'P1',
  sop: 'P1',
  skill: 'P1',
  openclaw: 'P2',
  gateway: 'P2',
  mcp: 'P2',
  system: 'P2',
  user: 'P1',
};

// ============================================================
// 扫描模块
// ============================================================

function inferDomain(filePath: string): string {
  const normalized = filePath.toLowerCase().replace(/\\/g, '/');
  
  for (const [domain, keywords] of Object.entries(DOMAIN_MAP)) {
    for (const kw of keywords) {
      // 匹配路径段
      if (normalized.includes(`/${kw}/`) || normalized.includes(`/${kw}.`) || normalized.endsWith(`/${kw}`)) {
        return domain;
      }
      // 匹配文件名
      const basename = path.basename(normalized, path.extname(normalized));
      if (basename === kw || basename.startsWith(kw + '-') || basename.startsWith(kw + '.')) {
        return domain;
      }
    }
  }
  return 'other';
}

function scanApiRoutes(): ModuleInfo[] {
  const routes = globSync('app/api/**/route.ts', { cwd: ROOT });
  return routes.map(r => {
    const domain = inferDomain(r);
    return {
      path: r,
      domain,
      type: 'api' as const,
      priority: PRIORITY_MAP[domain] || 'P3',
      hasUnitTest: false,
      hasIntegrationTest: false,
      hasE2ETest: false,
      matchedTests: [],
    };
  });
}

function scanStores(): ModuleInfo[] {
  const stores = globSync('store/**/*.ts', { cwd: ROOT })
    .filter(f => !f.endsWith('index.ts') && !f.endsWith('types.ts') && !f.endsWith('utils.ts'));
  return stores.map(s => {
    const domain = inferDomain(s);
    return {
      path: s,
      domain,
      type: 'store' as const,
      priority: PRIORITY_MAP[domain] || 'P3',
      hasUnitTest: false,
      hasIntegrationTest: false,
      hasE2ETest: false,
      matchedTests: [],
    };
  });
}

function scanLibs(): ModuleInfo[] {
  const libs = globSync('lib/**/*.ts', { cwd: ROOT })
    .filter(f => !f.includes('locales/') && !f.endsWith('index.ts'));
  return libs.map(l => {
    const domain = inferDomain(l);
    return {
      path: l,
      domain,
      type: 'lib' as const,
      priority: PRIORITY_MAP[domain] || 'P3',
      hasUnitTest: false,
      hasIntegrationTest: false,
      hasE2ETest: false,
      matchedTests: [],
    };
  });
}

function scanHooks(): ModuleInfo[] {
  const hooks = globSync('hooks/*.ts', { cwd: ROOT });
  return hooks.map(h => {
    const domain = inferDomain(h);
    return {
      path: h,
      domain,
      type: 'hook' as const,
      priority: PRIORITY_MAP[domain] || 'P3',
      hasUnitTest: false,
      hasIntegrationTest: false,
      hasE2ETest: false,
      matchedTests: [],
    };
  });
}

function scanMCP(): ModuleInfo[] {
  const mcpFiles = globSync('core/mcp/**/*.ts', { cwd: ROOT })
    .filter(f => !f.endsWith('index.ts'));
  const handlers = globSync('app/api/mcp/handlers/**/*.ts', { cwd: ROOT });
  return [...mcpFiles, ...handlers].map(m => ({
    path: m,
    domain: 'mcp',
    type: 'mcp' as const,
    priority: 'P2',
    hasUnitTest: false,
    hasIntegrationTest: false,
    hasE2ETest: false,
    matchedTests: [],
  }));
}

// ============================================================
// 扫描现有测试
// ============================================================

interface TestFile {
  path: string;
  type: 'unit' | 'integration' | 'e2e' | 'security' | 'stress' | 'req';
  /** 测试中引用/提及的关键词 */
  keywords: string[];
}

function scanTestFiles(): TestFile[] {
  const result: TestFile[] = [];
  
  // 单元测试
  const unitTests = globSync('tests/unit/**/*.test.ts', { cwd: ROOT });
  for (const t of unitTests) {
    const content = fs.readFileSync(path.join(ROOT, t), 'utf-8');
    result.push({
      path: t,
      type: 'unit',
      keywords: extractTestKeywords(t, content),
    });
  }
  
  // 集成测试
  const integrationTests = globSync('tests/integration/**/*.test.ts', { cwd: ROOT });
  for (const t of integrationTests) {
    const content = fs.readFileSync(path.join(ROOT, t), 'utf-8');
    result.push({
      path: t,
      type: 'integration',
      keywords: extractTestKeywords(t, content),
    });
  }
  
  // E2E 测试
  const e2eTests = [
    ...globSync('tests/e2e/**/*.spec.ts', { cwd: ROOT }),
    ...globSync('tests/e2e/**/*.test.ts', { cwd: ROOT }),
  ].filter(f => !f.includes('/pages/'));
  for (const t of e2eTests) {
    const content = fs.readFileSync(path.join(ROOT, t), 'utf-8');
    result.push({
      path: t,
      type: 'e2e',
      keywords: extractTestKeywords(t, content),
    });
  }

  // 需求测试
  const reqTests = globSync('tests/req/**/*.test.ts', { cwd: ROOT });
  for (const t of reqTests) {
    const content = fs.readFileSync(path.join(ROOT, t), 'utf-8');
    result.push({
      path: t,
      type: 'req',
      keywords: extractTestKeywords(t, content),
    });
  }
  
  return result;
}

function extractTestKeywords(filePath: string, content: string): string[] {
  const keywords = new Set<string>();
  
  // 从文件名提取
  const basename = path.basename(filePath, path.extname(filePath))
    .replace('.test', '').replace('.spec', '');
  keywords.add(basename);
  
  // 从 import 语句提取
  const importRegex = /from\s+['"](@\/|\.\.\/|\.\/)(.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[2];
    const parts = importPath.split('/');
    parts.forEach(p => {
      if (p && !['index', 'types', 'utils'].includes(p)) {
        keywords.add(p.replace('.ts', '').replace('.tsx', ''));
      }
    });
  }
  
  // 从 API URL 提取
  const apiUrlRegex = /['"]\/api\/([\w-]+)/g;
  while ((match = apiUrlRegex.exec(content)) !== null) {
    keywords.add(match[1]);
  }
  
  // 从 describe/test 标题提取
  const describeRegex = /(?:describe|test|it)\s*\(\s*['"`]([^'"`]+)/g;
  while ((match = describeRegex.exec(content)) !== null) {
    const title = match[1].toLowerCase();
    // 提取有意义的关键词
    const words = title.split(/[\s-_/]+/).filter(w => w.length > 2);
    words.forEach(w => keywords.add(w));
  }
  
  return Array.from(keywords);
}

// ============================================================
// 匹配逻辑
// ============================================================

/**
 * 从模块路径提取"模块标识符"——用于精确匹配。
 * 例如:
 *   app/api/tasks/[id]/route.ts → "tasks"
 *   app/api/tasks/[id]/sop-advance/route.ts → "tasks/sop-advance" + "sop-advance"
 *   store/task.store.ts → "task"
 *   lib/chat-channel/parser.ts → "chat-channel/parser" + "chat-channel"
 *   hooks/useChatStream.ts → "chat-stream" (去掉 use 前缀)
 */
function extractModuleIdentifiers(mod: ModuleInfo): string[] {
  const ids = new Set<string>();
  const parts = mod.path.split('/');
  
  if (mod.type === 'api') {
    // API: 提取 /api/ 之后、route.ts 之前的路径段
    const apiIdx = parts.indexOf('api');
    if (apiIdx >= 0) {
      const apiParts = parts.slice(apiIdx + 1).filter(p => p !== 'route.ts' && !p.startsWith('['));
      if (apiParts.length > 0) {
        ids.add(apiParts.join('/'));          // "tasks/sop-advance"
        ids.add(apiParts[0]);                 // "tasks"
        if (apiParts.length > 1) {
          ids.add(apiParts[apiParts.length - 1]); // "sop-advance"
        }
      }
    }
  } else if (mod.type === 'store') {
    const basename = path.basename(mod.path, '.ts')
      .replace('.store', '').replace('.slice', '');
    ids.add(basename);
    // gateway/agent.slice.ts → "gateway-agent"
    if (mod.path.includes('gateway/')) {
      ids.add('gateway-' + basename);
    }
  } else if (mod.type === 'lib') {
    const basename = path.basename(mod.path, '.ts');
    ids.add(basename);
    // lib/chat-channel/parser.ts → "chat-channel"
    const libIdx = parts.indexOf('lib');
    if (libIdx >= 0 && parts.length > libIdx + 2) {
      ids.add(parts[libIdx + 1]); // 子目录名
    }
  } else if (mod.type === 'hook') {
    const basename = path.basename(mod.path, '.ts');
    ids.add(basename);
    // useXxx → xxx 
    const cleaned = basename.replace(/^use/, '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    ids.add(cleaned);
  } else if (mod.type === 'mcp') {
    const basename = path.basename(mod.path, '.ts');
    ids.add(basename);
    ids.add('mcp');
    // app/api/mcp/handlers/task.ts → "mcp-task"
    if (mod.path.includes('handlers/')) {
      ids.add('mcp-' + basename);
    }
  }
  
  return Array.from(ids).filter(Boolean).map(i => i.toLowerCase());
}

/**
 * 精确匹配：测试文件必须在 import 路径或 API URL 中直接引用模块。
 * 仅做文件名级别匹配，不走 domain 泛匹配。
 */
function matchModulesToTests(modules: ModuleInfo[], tests: TestFile[]): void {
  for (const mod of modules) {
    const modIds = extractModuleIdentifiers(mod);
    
    for (const test of tests) {
      let matched = false;
      
      // 策略 1：测试文件名直接匹配
      const testBasename = path.basename(test.path, path.extname(test.path))
        .replace('.test', '').replace('.spec', '').toLowerCase();
      for (const mid of modIds) {
        if (testBasename === mid || testBasename.includes(mid) && mid.length >= 4) {
          matched = true;
          break;
        }
      }
      
      // 策略 2：测试 import 了模块文件
      if (!matched) {
        for (const kw of test.keywords) {
          const kwLower = kw.toLowerCase();
          for (const mid of modIds) {
            // 精确匹配：import 路径的最后一段 === 模块标识符
            if (kwLower === mid) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }
      
      // 策略 3: API URL 匹配（仅对 API 模块）
      if (!matched && mod.type === 'api') {
        for (const kw of test.keywords) {
          const kwLower = kw.toLowerCase();
          for (const mid of modIds) {
            // /api/tasks → 匹配 tasks
            if (kwLower === mid && mid.length >= 4) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }
      
      if (matched) {
        mod.matchedTests.push(test.path);
        switch (test.type) {
          case 'unit': mod.hasUnitTest = true; break;
          case 'integration': mod.hasIntegrationTest = true; break;
          case 'e2e': mod.hasE2ETest = true; break;
          case 'req':
            // req 测试算作集成测试
            mod.hasIntegrationTest = true;
            break;
        }
      }
    }
  }
}

// ============================================================
// 脚本审计
// ============================================================

function auditScripts(): ScriptAuditResult {
  const scriptFiles = globSync('scripts/*', { cwd: ROOT })
    .filter(f => !f.endsWith('README.md'));
  
  const categories: Record<string, ScriptInfo[]> = {
    deployment: [],
    database: [],
    testing: [],
    generation: [],
    utility: [],
    i18n: [],
  };

  for (const sf of scriptFiles) {
    const basename = path.basename(sf);
    let cat = 'utility';
    let desc = '';
    
    try {
      const content = fs.readFileSync(path.join(ROOT, sf), 'utf-8');
      const firstComment = content.match(/\/\*\*[\s\S]*?\*\/|\/\/.*|#.*/);
      desc = firstComment?.[0]?.slice(0, 100) || '';
    } catch { /* ignore */ }
    
    if (basename.includes('deploy') || basename.includes('restart')) cat = 'deployment';
    else if (basename.includes('init-db') || basename.includes('seed') || basename.includes('add-indexes') 
      || basename.includes('reset-admin') || basename.includes('import-wiki') || basename.includes('update-init')) cat = 'database';
    else if (basename.includes('test') && !basename.includes('audit')) cat = 'testing';
    else if (basename.includes('audit')) cat = 'utility';
    else if (basename.includes('generate') || basename.includes('screenshot') || basename.includes('run-screenshot')) cat = 'generation';
    else if (basename.includes('i18n') || basename.includes('check-i18n')) cat = 'i18n';
    else if (basename.includes('diagnose') || basename.includes('fix-') || basename.includes('sync-') || basename.includes('update-landing')) cat = 'utility';
    
    categories[cat].push({ path: sf, category: cat, description: desc });
  }
  
  // 检查重复
  const duplicates: string[][] = [];
  // import-wiki-docs.js 和 import-wiki-docs.ts 是已知重复
  const jsTs = scriptFiles.filter(f => f.includes('import-wiki-docs'));
  if (jsTs.length > 1) {
    duplicates.push(jsTs);
  }
  
  // 检查 README 是否记录了所有脚本
  let missingFromReadme: string[] = [];
  try {
    const readme = fs.readFileSync(path.join(ROOT, 'scripts/README.md'), 'utf-8');
    for (const sf of scriptFiles) {
      const basename = path.basename(sf);
      if (!readme.includes(basename)) {
        missingFromReadme.push(sf);
      }
    }
  } catch { /* ignore */ }
  
  return {
    total: scriptFiles.length,
    categories,
    duplicates,
    missingFromReadme,
  };
}

// ============================================================
// 问题检测
// ============================================================

function detectProblems(modules: ModuleInfo[], scriptAudit: ScriptAuditResult): Problem[] {
  const problems: Problem[] = [];
  
  // P0 模块无任何测试
  const p0NoTest = modules.filter(m => 
    m.priority === 'P0' && !m.hasUnitTest && !m.hasIntegrationTest && !m.hasE2ETest
  );
  if (p0NoTest.length > 0) {
    problems.push({
      severity: 'CRITICAL',
      type: 'P0_NO_TEST',
      message: `${p0NoTest.length} 个 P0 核心模块完全没有测试覆盖`,
      files: p0NoTest.map(m => m.path),
    });
  }
  
  // P1 模块无集成/E2E测试
  const p1NoIntegration = modules.filter(m =>
    m.priority === 'P1' && !m.hasIntegrationTest && !m.hasE2ETest
  );
  if (p1NoIntegration.length > 0) {
    problems.push({
      severity: 'HIGH',
      type: 'P1_NO_INTEGRATION',
      message: `${p1NoIntegration.length} 个 P1 重要模块缺少集成/E2E 测试`,
      files: p1NoIntegration.map(m => m.path),
    });
  }
  
  // API 路由无任何测试
  const apiNoTest = modules.filter(m => 
    m.type === 'api' && !m.hasUnitTest && !m.hasIntegrationTest && !m.hasE2ETest
  );
  if (apiNoTest.length > 0) {
    problems.push({
      severity: 'HIGH',
      type: 'API_NO_TEST',
      message: `${apiNoTest.length} 个 API 路由完全没有测试覆盖`,
      files: apiNoTest.map(m => m.path),
    });
  }
  
  // Store 无测试
  const storeNoTest = modules.filter(m =>
    m.type === 'store' && !m.hasUnitTest && !m.hasIntegrationTest && !m.hasE2ETest
  );
  if (storeNoTest.length > 0) {
    problems.push({
      severity: 'MEDIUM',
      type: 'STORE_NO_TEST',
      message: `${storeNoTest.length} 个 Store 模块没有测试覆盖`,
      files: storeNoTest.map(m => m.path),
    });
  }
  
  // 重复脚本
  if (scriptAudit.duplicates.length > 0) {
    problems.push({
      severity: 'LOW',
      type: 'DUPLICATE_SCRIPT',
      message: `发现 ${scriptAudit.duplicates.length} 组重复脚本`,
      files: scriptAudit.duplicates.flat(),
    });
  }
  
  // 脚本未记录到 README
  if (scriptAudit.missingFromReadme.length > 0) {
    problems.push({
      severity: 'LOW',
      type: 'SCRIPT_NOT_DOCUMENTED',
      message: `${scriptAudit.missingFromReadme.length} 个脚本未记录到 scripts/README.md`,
      files: scriptAudit.missingFromReadme,
    });
  }
  
  // E2E 测试和集成测试中混用了 vitest/playwright
  const e2eDir = globSync('tests/e2e/*.test.ts', { cwd: ROOT });
  if (e2eDir.length > 0) {
    problems.push({
      severity: 'MEDIUM',
      type: 'FRAMEWORK_MIXED',
      message: `tests/e2e/ 目录混合了 Playwright (.spec.ts) 和 Vitest (.test.ts) 测试`,
      files: e2eDir,
    });
  }
  
  // scripts/ 中有测试脚本（应该在 tests/ 中）
  const testScripts = scriptAudit.categories['testing'] || [];
  if (testScripts.length > 0) {
    problems.push({
      severity: 'MEDIUM',
      type: 'TEST_MISPLACED',
      message: `${testScripts.length} 个测试脚本放在 scripts/ 而不是 tests/`,
      files: testScripts.map(s => s.path),
    });
  }
  
  return problems;
}

// ============================================================
// 报告生成
// ============================================================

function generateReport(modules: ModuleInfo[], scriptAudit: ScriptAuditResult, problems: Problem[]): AuditReport {
  const covered = modules.filter(m => m.hasUnitTest || m.hasIntegrationTest || m.hasE2ETest);
  
  // 按类型统计
  const byType: Record<string, { total: number; covered: number; rate: string }> = {};
  const types = ['api', 'store', 'lib', 'hook', 'mcp'];
  for (const t of types) {
    const total = modules.filter(m => m.type === t).length;
    const cov = modules.filter(m => m.type === t && (m.hasUnitTest || m.hasIntegrationTest || m.hasE2ETest)).length;
    byType[t] = { total, covered: cov, rate: total > 0 ? `${Math.round(cov / total * 100)}%` : 'N/A' };
  }
  
  // 按优先级统计
  const byPriority: Record<string, { total: number; covered: number; rate: string }> = {};
  for (const p of ['P0', 'P1', 'P2', 'P3']) {
    const total = modules.filter(m => m.priority === p).length;
    const cov = modules.filter(m => m.priority === p && (m.hasUnitTest || m.hasIntegrationTest || m.hasE2ETest)).length;
    byPriority[p] = { total, covered: cov, rate: total > 0 ? `${Math.round(cov / total * 100)}%` : 'N/A' };
  }
  
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalModules: modules.length,
      coveredModules: covered.length,
      coverageRate: `${Math.round(covered.length / modules.length * 100)}%`,
      byType,
      byPriority,
    },
    modules,
    missingTests: modules.filter(m => !m.hasUnitTest && !m.hasIntegrationTest && !m.hasE2ETest),
    scriptAudit,
    problems,
  };
}

function formatMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  
  lines.push('# 🧪 TeamClaw 测试覆盖审计报告');
  lines.push('');
  lines.push(`> 生成时间：${report.timestamp}`);
  lines.push('');
  
  // ---- 总览 ----
  lines.push('## 📊 总览');
  lines.push('');
  lines.push(`| 指标 | 数值 |`);
  lines.push(`|------|------|`);
  lines.push(`| 模块总数 | ${report.summary.totalModules} |`);
  lines.push(`| 有测试覆盖 | ${report.summary.coveredModules} |`);
  lines.push(`| 覆盖率 | **${report.summary.coverageRate}** |`);
  lines.push(`| 未覆盖 | ${report.missingTests.length} |`);
  lines.push('');
  
  // ---- 按类型 ----
  lines.push('### 按模块类型');
  lines.push('');
  lines.push('| 类型 | 总数 | 已覆盖 | 覆盖率 | 状态 |');
  lines.push('|------|------|--------|--------|------|');
  for (const [type, data] of Object.entries(report.summary.byType)) {
    const rate = parseInt(data.rate);
    const status = rate >= 80 ? '✅' : rate >= 50 ? '⚠️' : rate > 0 ? '🟡' : '❌';
    lines.push(`| ${type} | ${data.total} | ${data.covered} | ${data.rate} | ${status} |`);
  }
  lines.push('');
  
  // ---- 按优先级 ----
  lines.push('### 按优先级');
  lines.push('');
  lines.push('| 优先级 | 总数 | 已覆盖 | 覆盖率 | 状态 |');
  lines.push('|--------|------|--------|--------|------|');
  for (const [prio, data] of Object.entries(report.summary.byPriority)) {
    const rate = parseInt(data.rate);
    const status = rate >= 80 ? '✅' : rate >= 50 ? '⚠️' : rate > 0 ? '🟡' : '❌';
    lines.push(`| ${prio} | ${data.total} | ${data.covered} | ${data.rate} | ${status} |`);
  }
  lines.push('');
  
  // ---- 问题列表 ----
  lines.push('## 🚨 发现的问题');
  lines.push('');
  
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const severityEmoji: Record<string, string> = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🔵',
  };
  
  for (const sev of severityOrder) {
    const sevProblems = report.problems.filter(p => p.severity === sev);
    if (sevProblems.length === 0) continue;
    
    lines.push(`### ${severityEmoji[sev]} ${sev} (${sevProblems.length})`);
    lines.push('');
    for (const p of sevProblems) {
      lines.push(`#### ${p.type}`);
      lines.push(`${p.message}`);
      if (p.files && p.files.length > 0) {
        lines.push('');
        const showFiles = p.files.slice(0, 15);
        for (const f of showFiles) {
          lines.push(`- \`${f}\``);
        }
        if (p.files.length > 15) {
          lines.push(`- ... 还有 ${p.files.length - 15} 个`);
        }
      }
      lines.push('');
    }
  }
  
  // ---- 缺失测试详情 ----
  lines.push('## 📋 缺失测试的模块清单');
  lines.push('');
  
  // 按领域分组
  const domainGroups: Record<string, ModuleInfo[]> = {};
  for (const m of report.missingTests) {
    const key = m.domain;
    if (!domainGroups[key]) domainGroups[key] = [];
    domainGroups[key].push(m);
  }
  
  // 按优先级排序领域
  const sortedDomains = Object.entries(domainGroups).sort(([a], [b]) => {
    const pa = PRIORITY_MAP[a] || 'P3';
    const pb = PRIORITY_MAP[b] || 'P3';
    return pa.localeCompare(pb);
  });
  
  for (const [domain, mods] of sortedDomains) {
    const prio = PRIORITY_MAP[domain] || 'P3';
    lines.push(`### ${domain} (${prio})`);
    lines.push('');
    lines.push('| 模块 | 类型 | 需要的测试 |');
    lines.push('|------|------|-----------|');
    for (const m of mods) {
      const needed = [];
      if (m.type === 'api') needed.push('集成测试');
      if (m.type === 'lib') needed.push('单元测试');
      if (m.type === 'store') needed.push('单元测试');
      if (m.type === 'hook') needed.push('单元测试');
      if (m.priority === 'P0' || m.priority === 'P1') needed.push('E2E');
      if (needed.length === 0) needed.push('单元测试');
      lines.push(`| \`${m.path}\` | ${m.type} | ${needed.join(', ')} |`);
    }
    lines.push('');
  }
  
  // ---- 脚本审计 ----
  lines.push('## 🔧 脚本审计');
  lines.push('');
  lines.push(`脚本总数：${report.scriptAudit.total}`);
  lines.push('');
  
  lines.push('### 分类统计');
  lines.push('');
  lines.push('| 分类 | 数量 | 脚本 |');
  lines.push('|------|------|------|');
  for (const [cat, scripts] of Object.entries(report.scriptAudit.categories)) {
    if (scripts.length > 0) {
      lines.push(`| ${cat} | ${scripts.length} | ${scripts.map(s => '`' + path.basename(s.path) + '`').join(', ')} |`);
    }
  }
  lines.push('');
  
  if (report.scriptAudit.duplicates.length > 0) {
    lines.push('### ⚠️ 重复脚本');
    lines.push('');
    for (const group of report.scriptAudit.duplicates) {
      lines.push(`- ${group.map(f => '`' + f + '`').join(' ↔ ')}`);
    }
    lines.push('');
  }
  
  if (report.scriptAudit.missingFromReadme.length > 0) {
    lines.push('### ⚠️ 未记录到 README 的脚本');
    lines.push('');
    for (const f of report.scriptAudit.missingFromReadme) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }
  
  // ---- 建议的行动计划 ----
  lines.push('## 🎯 建议行动计划');
  lines.push('');
  lines.push('### Phase 1：补齐 P0 核心模块测试（1-2 周）');
  lines.push('');
  const p0Missing = report.missingTests.filter(m => m.priority === 'P0');
  if (p0Missing.length > 0) {
    for (const m of p0Missing) {
      lines.push(`- [ ] ${m.path} (${m.type})`);
    }
  } else {
    lines.push('✅ P0 模块已全部覆盖');
  }
  lines.push('');
  
  lines.push('### Phase 2：补齐 P1 重要模块测试（2-3 周）');
  lines.push('');
  const p1Missing = report.missingTests.filter(m => m.priority === 'P1');
  if (p1Missing.length > 0) {
    for (const m of p1Missing.slice(0, 20)) {
      lines.push(`- [ ] ${m.path} (${m.type})`);
    }
    if (p1Missing.length > 20) {
      lines.push(`- ... 还有 ${p1Missing.length - 20} 个`);
    }
  } else {
    lines.push('✅ P1 模块已全部覆盖');
  }
  lines.push('');
  
  lines.push('### Phase 3：规范化整理（1 周）');
  lines.push('');
  lines.push('- [ ] 将 `tests/e2e/*.test.ts` (Vitest) 迁移到 `tests/integration/` 或转为 `.spec.ts` (Playwright)');
  lines.push('- [ ] 将 `scripts/test-skillhub-api.ts` 迁移到 `tests/integration/`');
  lines.push('- [ ] 合并 `scripts/import-wiki-docs.js` 和 `scripts/import-wiki-docs.ts`，保留 TS 版');
  lines.push('- [ ] 更新 `tests/README.md` 和 `scripts/README.md` 使其与实际文件同步');
  lines.push('');
  
  lines.push('### Phase 4：P2/P3 模块逐步覆盖（持续）');
  lines.push('');
  lines.push('按需在功能变更时补充测试，目标 80% 覆盖率。');
  lines.push('');
  
  return lines.join('\n');
}

function formatTerminal(report: AuditReport): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push('║          🧪 TeamClaw 测试覆盖审计报告                    ║');
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');
  
  // 总览
  lines.push(`📊 总览: ${report.summary.coveredModules}/${report.summary.totalModules} 模块有测试 (${report.summary.coverageRate})`);
  lines.push('');
  
  // 按类型
  lines.push('  按类型:');
  for (const [type, data] of Object.entries(report.summary.byType)) {
    const bar = '█'.repeat(Math.round(parseInt(data.rate) / 5)) + '░'.repeat(20 - Math.round(parseInt(data.rate) / 5));
    lines.push(`    ${type.padEnd(8)} ${bar} ${data.rate.padStart(4)} (${data.covered}/${data.total})`);
  }
  lines.push('');
  
  // 按优先级
  lines.push('  按优先级:');
  for (const [prio, data] of Object.entries(report.summary.byPriority)) {
    const bar = '█'.repeat(Math.round(parseInt(data.rate) / 5)) + '░'.repeat(20 - Math.round(parseInt(data.rate) / 5));
    lines.push(`    ${prio.padEnd(8)} ${bar} ${data.rate.padStart(4)} (${data.covered}/${data.total})`);
  }
  lines.push('');
  
  // 问题
  const severityColor: Record<string, string> = {
    CRITICAL: '\x1b[31m',
    HIGH: '\x1b[33m',
    MEDIUM: '\x1b[36m',
    LOW: '\x1b[34m',
  };
  const RESET = '\x1b[0m';
  
  lines.push('🚨 问题列表:');
  for (const p of report.problems) {
    const color = severityColor[p.severity] || '';
    lines.push(`  ${color}[${p.severity}]${RESET} ${p.message}`);
    if (p.files) {
      for (const f of p.files.slice(0, 5)) {
        lines.push(`    → ${f}`);
      }
      if (p.files.length > 5) {
        lines.push(`    → ... 还有 ${p.files.length - 5} 个`);
      }
    }
  }
  lines.push('');
  
  // 脚本审计摘要
  lines.push(`🔧 脚本审计: ${report.scriptAudit.total} 个脚本`);
  if (report.scriptAudit.duplicates.length > 0) {
    lines.push(`  ⚠️  重复脚本: ${report.scriptAudit.duplicates.length} 组`);
  }
  if (report.scriptAudit.missingFromReadme.length > 0) {
    lines.push(`  ⚠️  未记录到 README: ${report.scriptAudit.missingFromReadme.length} 个`);
  }
  lines.push('');
  
  return lines.join('\n');
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const isMarkdown = args.includes('--markdown');
  
  console.log('🔍 扫描项目模块...');
  
  // 扫描所有模块
  const modules: ModuleInfo[] = [
    ...scanApiRoutes(),
    ...scanStores(),
    ...scanLibs(),
    ...scanHooks(),
    ...scanMCP(),
  ];
  console.log(`  找到 ${modules.length} 个模块`);
  
  // 扫描测试文件
  console.log('🔍 扫描测试文件...');
  const tests = scanTestFiles();
  console.log(`  找到 ${tests.length} 个测试文件`);
  
  // 匹配
  console.log('🔗 匹配模块与测试...');
  matchModulesToTests(modules, tests);
  
  // 审计脚本
  console.log('🔧 审计脚本...');
  const scriptAudit = auditScripts();
  
  // 检测问题
  console.log('🚨 检测问题...');
  const problems = detectProblems(modules, scriptAudit);
  
  // 生成报告
  const report = generateReport(modules, scriptAudit, problems);
  
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else if (isMarkdown) {
    const md = formatMarkdown(report);
    const outputPath = path.join(ROOT, 'docs', 'archive', 'historical-reports', 'test-coverage-audit.md');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, md, 'utf-8');
    console.log(`\n✅ 报告已生成: ${outputPath}`);
    // 同时输出终端摘要
    console.log(formatTerminal(report));
  } else {
    console.log(formatTerminal(report));
  }
}

main().catch(console.error);
