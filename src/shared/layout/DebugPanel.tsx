'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  useProjectStore, useTaskStore, useMemberStore,
  useDocumentStore, useDeliveryStore, useScheduledTaskStore,
  useOpenClawStatusStore, useUIStore,
} from '@/domains';
import { useDataInitializer } from '@/shared/hooks';
import { useGatewayStore } from '@/core/gateway/store';
import { useChatStore } from '@/domains/chat';
import { Card } from '@/shared/ui';
import { Badge } from '@/shared/ui/badge';
import { Bug, ChevronDown, ChevronUp, Trash2, Play, RefreshCw, Wifi, Database, Server, Settings, AlertCircle, CheckCircle, XCircle, Wrench, ClipboardList } from 'lucide-react';

interface DiagnosticsData {
  status: string;
  diagnostics: {
    database?: {
      status: string;
      tables?: string[];
      tableCount?: number;
      error?: string;
    };
    tableStructure?: Record<string, {
      exists: boolean;
      columns?: string[];
      error?: string;
    }>;
    missingTables?: string[];
    missingColumns?: Record<string, string[]>;
    hasMissingColumns?: boolean;
    gateway?: {
      configCount?: number;
      configs?: any[];
      status?: string;
      error?: string;
    };
    environment?: Record<string, string>;
    members?: {
      count?: number;
      list?: any[];
      status?: string;
      error?: string;
    };
    workspaces?: {
      count?: number;
      list?: any[];
      status?: string;
      error?: string;
    };
    runtime?: {
      nodeVersion: string;
      platform: string;
      uptime: number;
      memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
      };
      timestamp: string;
    };
  };
}

/**
 * 系统调试面板
 * 用于诊断 Store 状态、API 连通性、SSE 推送等问题
 * 入口在 设置 → 通用 → 调试工具
 */
export default function DebugPanel() {
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [manualFetchResult, setManualFetchResult] = useState<string>('');
  const [sseTestResult, setSseTestResult] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    store: true, diagnostics: true, sop: false, api: false, sse: false, localStorage: false,
  });

  // Store 数据
  const hydrated = useUIStore((s) => s.hydrated);
  const projects = useProjectStore((s) => s.projects);
  const projectError = useProjectStore((s) => s.error);
  const tasks = useTaskStore((s) => s.tasks);
  const taskError = useTaskStore((s) => s.error);
  const members = useMemberStore((s) => s.members);
  const documents = useDocumentStore((s) => s.documents);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const scheduledTasks = useScheduledTaskStore((s) => s.tasks);
  const chatSessions = useChatStore((s) => s.sessions);
  const gwConnected = useGatewayStore((s) => s.connected);
  const gwServerProxy = useGatewayStore((s) => s.serverProxyConnected);
  const gwMode = useGatewayStore((s) => s.connectionMode);
  const gwError = useGatewayStore((s) => s.error);

  const { initialize } = useDataInitializer();

  const addLog = useCallback((msg: string) => {
    console.log('[DebugPanel]', msg);
    setDebugLog(prev => [...prev, `${new Date().toISOString().substring(11, 23)} ${msg}`]);
  }, []);

  const clearLog = useCallback(() => setDebugLog([]), []);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 手动 fetch 所有 API
  const handleApiFetchTest = async () => {
    setManualFetchResult('');
    const apis = [
      '/api/projects', '/api/tasks', '/api/members', '/api/documents',
      '/api/gateway/config', '/api/openclaw-status', '/api/deliveries',
      '/api/scheduled-tasks',
    ];
    const results: string[] = [];
    for (const url of apis) {
      try {
        const start = Date.now();
        const res = await fetch(url);
        const ms = Date.now() - start;
        const text = await res.text();
        let count = '?';
        try {
          const json = JSON.parse(text);
          count = Array.isArray(json) ? String(json.length) : 'obj';
        } catch { /* ignore */ }
        const status = res.ok ? '✅' : '❌';
        results.push(`${status} ${url} => ${res.status} (${ms}ms) items=${count}`);
      } catch (e) {
        results.push(`❌ ${url} => ERROR: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setManualFetchResult(results.join('\n'));
  };

  // 手动 fetch /api/projects 并写入 store
  const handleManualFetchProjects = async () => {
    addLog('Fetching /api/projects...');
    try {
      const res = await fetch('/api/projects');
      addLog(`status: ${res.status}, ok: ${res.ok}`);
      const text = await res.text();
      const data = JSON.parse(text);
      addLog(`parsed: isArray=${Array.isArray(data)}, length=${data.length}`);
      useProjectStore.getState().setProjects(data);
      addLog(`Store updated: ${useProjectStore.getState().projects.length} projects`);
    } catch (e) {
      addLog(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 调用 initialize()
  const handleInitialize = async () => {
    addLog('Calling initialize()...');
    try {
      await initialize();
      addLog('initialize() completed');
      addLog(`projects: ${useProjectStore.getState().projects.length}, error: ${useProjectStore.getState().error}`);
      addLog(`tasks: ${useTaskStore.getState().tasks.length}, error: ${useTaskStore.getState().error}`);
      addLog(`members: ${useMemberStore.getState().members.length}`);
      addLog(`documents: ${useDocumentStore.getState().documents.length}`);
    } catch (e) {
      addLog(`initialize() ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // CSRF POST 测试
  const handleCsrfTest = async () => {
    addLog('Testing POST CSRF...');
    try {
      const res = await fetch('/api/heartbeat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      addLog(`POST /api/heartbeat/start => ${res.status} ${text}`);
    } catch (e) {
      addLog(`POST ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // SSE 测试
  const handleSseTest = async () => {
    setSseTestResult('Testing SSE (3s)...');
    addLog('Starting SSE test...');
    try {
      const es = new EventSource('/api/sse');
      const msgs: string[] = [];
      let connected = false;
      es.onopen = () => { connected = true; msgs.push('✅ connected'); };
      es.onerror = () => { if (!connected) msgs.push('❌ connection failed'); };
      es.addEventListener('connected', (e: MessageEvent) => { msgs.push(`connected event: ${e.data}`); });
      es.onmessage = (e: MessageEvent) => { msgs.push(`message: ${e.data}`); };
      await new Promise(r => setTimeout(r, 3000));
      es.close();
      const result = msgs.length > 0 ? msgs.join('\n') : '⚠️ No events in 3s';
      setSseTestResult(result);
      addLog(`SSE test done: ${msgs.length} events`);
    } catch (e) {
      const errMsg = `❌ SSE ERROR: ${e instanceof Error ? e.message : String(e)}`;
      setSseTestResult(errMsg);
      addLog(errMsg);
    }
  };

  // 系统诊断
  const handleDiagnostics = async () => {
    setDiagnosticsLoading(true);
    addLog('Fetching system diagnostics...');
    try {
      const res = await fetch('/api/debug');
      const data = await res.json();
      setDiagnostics(data);
      addLog(`Diagnostics loaded: ${data.status}`);
    } catch (e) {
      addLog(`Diagnostics ERROR: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  // 一键修复缺失表
  const handleRepairTables = async () => {
    setRepairLoading(true);
    setRepairResult(null);
    addLog('Repairing missing tables...');
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repair_tables' }),
      });
      const data = await res.json();
      const msg = `${data.message}${data.created?.length ? `\n创建: ${data.created.join(', ')}` : ''}${data.failed?.length ? `\n失败: ${data.failed.map((f: any) => `${f.table}(${f.error})`).join(', ')}` : ''}`;
      setRepairResult(msg);
      addLog(`Repair result: ${data.status} - ${data.message}`);
      // 修复后自动刷新诊断
      await handleDiagnostics();
    } catch (e) {
      const errMsg = `修复失败: ${e instanceof Error ? e.message : String(e)}`;
      setRepairResult(errMsg);
      addLog(`Repair ERROR: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRepairLoading(false);
    }
  };

  // v3.0: 已废弃创建默认用户功能
  // 用户通过 /login 页面注册，第一个注册的用户自动成为 admin

  // 修复缺失列
  const handleRepairColumns = async () => {
    setRepairLoading(true);
    setRepairResult(null);
    addLog('Repairing missing columns...');
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repair_columns' }),
      });
      const data = await res.json();
      const msg = `${data.message}${data.added?.length ? `\n添加: ${data.added.map((a: any) => `${a.table}.${a.column}`).join(', ')}` : ''}${data.failed?.length ? `\n失败: ${data.failed.map((f: any) => `${f.table}.${f.column}(${f.error})`).join(', ')}` : ''}`;
      setRepairResult(msg);
      addLog(`Repair columns result: ${data.status} - ${data.message}`);
      await handleDiagnostics();
    } catch (e) {
      const errMsg = `修复失败: ${e instanceof Error ? e.message : String(e)}`;
      setRepairResult(errMsg);
      addLog(`Repair columns ERROR: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRepairLoading(false);
    }
  };

  // 测试数据库查询
  const [queryTestResult, setQueryTestResult] = useState<string | null>(null);
  const handleTestQuery = async () => {
    setRepairLoading(true);
    setQueryTestResult(null);
    addLog('Testing database queries...');
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_query' }),
      });
      const data = await res.json();
      const lines = Object.entries(data.results || {}).map(([table, info]: [string, any]) =>
        `${info.ok ? '✅' : '❌'} ${table}: ${info.ok ? `${info.count} rows` : info.error}`
      );
      setQueryTestResult(lines.join('\n'));
      addLog(`Query test done: ${lines.length} tables tested`);
    } catch (e) {
      setQueryTestResult(`测试失败: ${e instanceof Error ? e.message : String(e)}`);
      addLog(`Query test ERROR: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRepairLoading(false);
    }
  };

  // 初始加载诊断信息
  useEffect(() => {
    handleDiagnostics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 读取 localStorage
  const getLocalStorageInfo = (): string[] => {
    const keys = ['teamclaw-ui', 'teamclaw-project-selection', 'teamclaw-chat'];
    return keys.map(key => {
      const val = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (!val) return `${key}: NOT SET`;
      try {
        const parsed = JSON.parse(val);
        return `${key}: ${val.length} bytes\n${JSON.stringify(parsed, null, 2)}`;
      } catch {
        return `${key}: ${val.length} bytes (parse error)`;
      }
    });
  };

  const isGwConnected = gwMode === 'server_proxy' ? gwServerProxy : gwConnected;

  // Store 状态行
  const storeRows = [
    { label: 'hydrated', value: hydrated, isFlag: true },
    { label: 'projects', count: projects.length, error: projectError },
    { label: 'tasks', count: tasks.length, error: taskError },
    { label: 'members', count: members.length },
    { label: 'documents', count: documents.length },
    { label: 'deliveries', count: deliveries.length },
    { label: 'scheduledTasks', count: scheduledTasks.length },
    { label: 'chatSessions', count: chatSessions.length },
  ];

  // 诊断状态徽章
  const renderStatusBadge = (status?: string, error?: string) => {
    if (error) {
      return <Badge variant="danger" className="text-xs gap-1"><XCircle className="w-3 h-3" />错误</Badge>;
    }
    if (status === 'ok') {
      return <Badge className="text-xs gap-1 bg-green-500"><CheckCircle className="w-3 h-3" />正常</Badge>;
    }
    return <Badge variant="default" className="text-xs gap-1"><AlertCircle className="w-3 h-3" />未知</Badge>;
  };

  // 格式化运行时间
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (mins > 0) parts.push(`${mins}分钟`);
    parts.push(`${secs}秒`);
    return parts.join(' ');
  };

  return (
    <div className="space-y-3">
      {/* 系统诊断 */}
      <SectionHeader
        title="系统诊断"
        icon={<Server className="w-3.5 h-3.5" />}
        expanded={expandedSections.diagnostics}
        onToggle={() => toggleSection('diagnostics')}
      />
      {expandedSections.diagnostics && (
        <Card className="p-3">
          {diagnosticsLoading && !diagnostics ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <RefreshCw className="w-4 h-4 animate-spin" />
              正在收集诊断信息...
            </div>
          ) : diagnostics ? (
            <div className="space-y-4">
              {/* 快速状态概览 */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>数据库</div>
                  <div className="mt-1">{renderStatusBadge(diagnostics.diagnostics?.database?.status, diagnostics.diagnostics?.database?.error)}</div>
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Gateway</div>
                  <div className="mt-1">
                    {diagnostics.diagnostics?.gateway?.error ? (
                      renderStatusBadge(undefined, diagnostics.diagnostics.gateway.error)
                    ) : (
                      <Badge variant="default" className="text-xs">
                        {diagnostics.diagnostics?.gateway?.configCount || 0} 配置
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>成员</div>
                  <div className="mt-1">
                    <Badge variant="default" className="text-xs">{diagnostics.diagnostics?.members?.count || 0}</Badge>
                  </div>
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>工作区</div>
                  <div className="mt-1">
                    <Badge variant="default" className="text-xs">{diagnostics.diagnostics?.workspaces?.count || 0}</Badge>
                  </div>
                </div>
              </div>

              {/* 数据库表检查 */}
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  数据库表 ({diagnostics.diagnostics?.database?.tableCount || 0} 个)
                </div>
                {diagnostics.diagnostics?.database?.error ? (
                  <div className="text-xs text-red-500">{diagnostics.diagnostics.database.error}</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {diagnostics.diagnostics?.database?.tables?.map(table => {
                      const isCritical = ['gateway_configs', 'audit_logs', 'members', 'tasks', 'documents', 'openclaw_workspaces'].includes(table);
                      return (
                        <Badge 
                          key={table} 
                          variant="default"
                          className="text-xs"
                        >
                          {table}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 关键表结构检查 */}
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>关键表结构检查</div>
                <div className="space-y-1">
                  {Object.entries(diagnostics.diagnostics?.tableStructure || {}).map(([table, info]) => (
                    <div key={table} className="flex items-center justify-between text-xs py-1 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-mono">{table}</span>
                      {info.exists ? (
                        <Badge className="bg-green-500 text-xs">存在 ({info.columns?.length} 列)</Badge>
                      ) : (
                        <Badge variant="danger" className="text-xs">不存在</Badge>
                      )}
                    </div>
                  ))}
                </div>
                {/* 缺失表修复按钮 */}
                {(diagnostics.diagnostics?.missingTables?.length ?? 0) > 0 && (
                  <div className="mt-3 p-2 rounded-lg border border-red-500/30" style={{ background: 'var(--surface-hover)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs font-semibold text-red-500">
                        发现 {diagnostics.diagnostics?.missingTables?.length || 0} 个缺失表
                      </span>
                    </div>
                    <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      缺失: {diagnostics.diagnostics?.missingTables?.join(', ') || ''}
                    </div>
                    <ActionButton
                      icon={<Wrench className={`w-3 h-3 ${repairLoading ? 'animate-spin' : ''}`} />}
                      label={repairLoading ? '修复中...' : '一键修复缺失表'}
                      onClick={handleRepairTables}
                      color="red"
                    />
                    {repairResult && (
                      <pre className="mt-2 text-xs p-2 rounded whitespace-pre-wrap" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                        {repairResult}
                      </pre>
                    )}
                  </div>
                )}
                {/* 缺失列修复按钮 */}
                {diagnostics.diagnostics?.hasMissingColumns && (
                  <div className="mt-3 p-2 rounded-lg border border-orange-500/30" style={{ background: 'var(--surface-hover)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-500">
                        发现缺失列
                      </span>
                    </div>
                    <div className="text-xs mb-2 space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                      {Object.entries(diagnostics.diagnostics?.missingColumns || {}).map(([table, cols]) => (
                        <div key={table}>
                          <span className="font-mono text-orange-400">{table}</span>: {(cols as string[]).join(', ')}
                        </div>
                      ))}
                    </div>
                    <ActionButton
                      icon={<Wrench className={`w-3 h-3 ${repairLoading ? 'animate-spin' : ''}`} />}
                      label={repairLoading ? '修复中...' : '一键修复缺失列'}
                      onClick={handleRepairColumns}
                      color="red"
                    />
                    {repairResult && (
                      <pre className="mt-2 text-xs p-2 rounded whitespace-pre-wrap" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                        {repairResult}
                      </pre>
                    )}
                  </div>
                )}
                {/* 成员为空时显示初始化按钮 */}
                {diagnostics.diagnostics?.members?.count === 0 && !(diagnostics.diagnostics?.missingTables?.includes('members')) && (
                  <div className="mt-2">
                    {/* v3.0: 已废弃，用户通过 /login 注册 */}
                    <span className="text-xs text-slate-400">v3.0 多用户系统：用户通过 /login 注册</span>
                  </div>
                )}
                {/* 数据库查询测试 */}
                <div className="mt-3 p-2 rounded-lg border border-blue-500/30" style={{ background: 'var(--surface-hover)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-500">数据库查询测试</span>
                  </div>
                  <ActionButton
                    icon={<Play className={`w-3 h-3 ${repairLoading ? 'animate-spin' : ''}`} />}
                    label={repairLoading ? '测试中...' : '测试 Drizzle ORM 查询'}
                    onClick={handleTestQuery}
                    color="blue"
                  />
                  {queryTestResult && (
                    <pre className="mt-2 text-xs p-2 rounded whitespace-pre-wrap" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                      {queryTestResult}
                    </pre>
                  )}
                </div>
              </div>

              {/* Gateway 配置 */}
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Gateway 配置</div>
                {diagnostics.diagnostics?.gateway?.error ? (
                  <div className="text-xs text-red-500">{diagnostics.diagnostics.gateway.error}</div>
                ) : diagnostics.diagnostics?.gateway?.configCount === 0 ? (
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>暂无 Gateway 配置</div>
                ) : (
                  <div className="space-y-2">
                    {diagnostics.diagnostics?.gateway?.configs?.map((config: any) => (
                      <div key={config.id} className="p-2 rounded-lg text-xs" style={{ background: 'var(--surface-hover)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{config.name}</span>
                          <Badge variant={config.status === 'connected' ? 'success' : 'default'} className="text-xs">
                            {config.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          <div>URL: {config.url}</div>
                          <div>模式: {config.mode}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 环境变量 */}
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>环境变量</div>
                <div className="font-mono text-xs space-y-0.5 max-h-40 overflow-auto">
                  {Object.entries(diagnostics.diagnostics?.environment || {}).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-blue-500 min-w-[180px]">{key}</span>
                      <span className={value.includes('未设置') ? 'italic' : 'text-green-500'} style={{ color: value.includes('未设置') ? 'var(--text-tertiary)' : undefined }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 运行时信息 */}
              {diagnostics.diagnostics?.runtime && (
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>运行时信息</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Node:</span> {diagnostics.diagnostics.runtime.nodeVersion}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>平台:</span> {diagnostics.diagnostics.runtime.platform}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>运行时间:</span> {formatUptime(diagnostics.diagnostics.runtime.uptime)}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>内存:</span> {diagnostics.diagnostics.runtime.memoryUsage.heapUsed}MB / {diagnostics.diagnostics.runtime.memoryUsage.heapTotal}MB</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <ActionButton 
                  icon={<RefreshCw className={`w-3 h-3 ${diagnosticsLoading ? 'animate-spin' : ''}`} />} 
                  label="刷新诊断" 
                  onClick={handleDiagnostics} 
                  color="blue" 
                />
              </div>
            </div>
          ) : (
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>无法加载诊断信息</div>
          )}
        </Card>
      )}

      {/* Store 状态 */}
      <SectionHeader
        title="Store 状态"
        icon={<Database className="w-3.5 h-3.5" />}
        expanded={expandedSections.store}
        onToggle={() => toggleSection('store')}
      />
      {expandedSections.store && (
        <Card className="p-3">
          <div className="text-xs space-y-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
            {storeRows.map(row => (
              <div key={row.label} className="flex items-center gap-2">
                {'isFlag' in row ? (
                  <>
                    <span className={row.value ? 'text-green-500' : 'text-red-500'}>
                      {row.value ? '✅' : '❌'}
                    </span>
                    <span>{row.label}: {String(row.value)}</span>
                  </>
                ) : (
                  <>
                    <span className={(row.count ?? 0) > 0 ? 'text-green-500' : 'text-red-500'}>
                      {(row.count ?? 0) > 0 ? '✅' : '❌'}
                    </span>
                    <span>{row.label}: {row.count} items</span>
                    {'error' in row && row.error && (
                      <span className="text-red-400 ml-2">error: {row.error}</span>
                    )}
                  </>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className={isGwConnected ? 'text-green-500' : 'text-red-500'}>
                {isGwConnected ? '✅' : '❌'}
              </span>
              <span>gateway: {isGwConnected ? 'connected' : 'disconnected'} | mode: {gwMode || 'none'}</span>
              {gwError && <span className="text-red-400 ml-2">error: {gwError}</span>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton icon={<Play className="w-3 h-3" />} label="Manual Fetch Projects" onClick={handleManualFetchProjects} color="yellow" />
            <ActionButton icon={<RefreshCw className="w-3 h-3" />} label="Call initialize()" onClick={handleInitialize} color="blue" />
            <ActionButton icon={<Wifi className="w-3 h-3" />} label="CSRF POST Test" onClick={handleCsrfTest} color="green" />
          </div>
        </Card>
      )}

      {/* SOP 调试 */}
      <SectionHeader
        title="SOP 调试"
        icon={<ClipboardList className="w-3.5 h-3.5" />}
        expanded={expandedSections.sop}
        onToggle={() => toggleSection('sop')}
      />
      {expandedSections.sop && (
        <Card className="p-3">
          <p className="text-sm text-gray-500">SOP Debug Panel temporarily unavailable</p>
        </Card>
      )}

      {/* API 测试 */}
      <SectionHeader
        title="API 连通性"
        icon={<Database className="w-3.5 h-3.5" />}
        expanded={expandedSections.api}
        onToggle={() => toggleSection('api')}
      />
      {expandedSections.api && (
        <Card className="p-3">
          <ActionButton icon={<Play className="w-3 h-3" />} label="Fetch All APIs" onClick={handleApiFetchTest} color="blue" />
          {manualFetchResult && (
            <pre className="mt-2 text-xs bg-black text-green-400 p-2 rounded max-h-48 overflow-auto whitespace-pre-wrap">
              {manualFetchResult}
            </pre>
          )}
        </Card>
      )}

      {/* SSE 测试 */}
      <SectionHeader
        title="SSE 实时推送"
        icon={<Wifi className="w-3.5 h-3.5" />}
        expanded={expandedSections.sse}
        onToggle={() => toggleSection('sse')}
      />
      {expandedSections.sse && (
        <Card className="p-3">
          <ActionButton icon={<Play className="w-3 h-3" />} label="Test SSE (3s)" onClick={handleSseTest} color="purple" />
          {sseTestResult && (
            <pre className="mt-2 text-xs bg-black text-green-400 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">
              {sseTestResult}
            </pre>
          )}
        </Card>
      )}

      {/* LocalStorage */}
      <SectionHeader
        title="LocalStorage (Zustand Persist)"
        icon={<Database className="w-3.5 h-3.5" />}
        expanded={expandedSections.localStorage}
        onToggle={() => toggleSection('localStorage')}
      />
      {expandedSections.localStorage && (
        <Card className="p-3">
          <pre className="text-xs bg-black text-gray-300 p-2 rounded max-h-48 overflow-auto whitespace-pre-wrap">
            {getLocalStorageInfo().join('\n\n')}
          </pre>
        </Card>
      )}

      {/* 操作日志 */}
      {debugLog.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>操作日志</span>
            <button onClick={clearLog} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--text-tertiary)' }}>
              <Trash2 className="w-3 h-3" /> 清除
            </button>
          </div>
          <pre className="text-xs bg-black text-green-400 p-2 rounded max-h-48 overflow-auto whitespace-pre-wrap">
            {debugLog.join('\n')}
          </pre>
        </Card>
      )}
    </div>
  );
}

// 可折叠的 Section 头
function SectionHeader({ title, icon, expanded, onToggle }: {
  title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
      style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)' }}
    >
      <span className="flex items-center gap-2">{icon} {title}</span>
      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
    </button>
  );
}

// 操作按钮
function ActionButton({ icon, label, onClick, color }: {
  icon: React.ReactNode; label: string; onClick: () => void; color: 'yellow' | 'blue' | 'green' | 'purple' | 'red';
}) {
  const colorMap = {
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    red: 'bg-red-600 hover:bg-red-700',
  };
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-white text-xs rounded flex items-center gap-1.5 ${colorMap[color]}`}
    >
      {icon} {label}
    </button>
  );
}
