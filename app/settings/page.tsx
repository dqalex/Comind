'use client';

import { useUIStore } from '@/domains';
import { useOpenClawWorkspaceStore } from '@/core/gateway/openclaw-workspace.store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { Button, Switch } from '@/components/ui';
import { changeLanguage, initI18n } from '@/lib/i18n';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useSecurityCode } from '@/hooks/useSecurityCode';
import { SecurityCodeDialog } from '@/components/SecurityCodeDialog';
import { GatewayConfigPanel } from '@/components/settings/GatewayConfigPanel';
import { WorkspaceCard } from '@/components/openclaw/WorkspaceCard';
import { WorkspaceForm } from '@/components/openclaw/WorkspaceForm';
import {
  Sun, Moon, Palette, Info, Zap, Globe, Database,
  Shield, ShieldAlert, AlertTriangle, FolderSync, Plus, Folder, Bug, Key, Layout, Lock,
} from 'lucide-react';
import clsx from 'clsx';
import dynamic from 'next/dynamic';

const DebugPanel = dynamic(() => import('@/components/DebugPanel'), { ssr: false });
const McpTokenPanel = dynamic(() => import('@/components/settings/McpTokenPanel'), { ssr: false });
import { SecurityCodeSettings } from '@/components/settings/SecurityCodeSettings';
import { SystemInitSettings } from '@/components/settings/SystemInitSettings';
import { ChangePasswordDialog } from '@/components/settings/ChangePasswordDialog';
const LandingContentEditor = dynamic(
  () => import('@/components/landing/LandingContentEditor').then(mod => ({ default: mod.LandingContentEditor })),
  { ssr: false }
);

type SettingsTab = 'general' | 'openclaw' | 'mcp-token' | 'security' | 'landing' | 'debug' | 'about';

/** SSRF 安全配置存储 key */
const SSRF_CONFIG_KEY = 'teamclaw-ssrf-config';

interface SSRFConfig {
  allowExternalAccess: boolean;
  acknowledgedRisk: boolean;
}

function loadSsrfConfig(): SSRFConfig {
  try {
    const raw = localStorage.getItem(SSRF_CONFIG_KEY);
    return raw ? JSON.parse(raw) : { allowExternalAccess: false, acknowledgedRisk: false };
  } catch {
    return { allowExternalAccess: false, acknowledgedRisk: false };
  }
}

function saveSsrfConfig(config: SSRFConfig) {
  try {
    localStorage.setItem(SSRF_CONFIG_KEY, JSON.stringify(config));
    // 同步到 cookie 供后端 API 使用
    document.cookie = `${SSRF_CONFIG_KEY}=${encodeURIComponent(JSON.stringify(config))}; path=/; max-age=31536000; SameSite=Strict`;
  } catch (e) { console.warn('[Settings] Failed to save SSRF config:', e); }
}

// 翻译函数
const translations = {
  en: {
    title: 'Settings',
    tabs: { general: 'General', openclaw: 'OpenClaw Settings', mcpToken: 'MCP Token', security: 'Security', landing: 'Landing Page', debug: 'Debug', about: 'About' },
    theme: { title: 'Appearance', light: 'Light', dark: 'Dark' },
    language: { title: 'Language', note: 'Default Chinese interface. English is in development, some pages may still show Chinese after switching.' },
    data: { title: 'Data Management', desc: 'Data stored locally in SQLite database', refresh: 'Refresh Data' },
    openclaw: { title: 'OpenClaw Settings', desc: 'Configure OpenClaw Gateway connection mode' },
    workspace: { title: 'OpenClaw Workspace', desc: 'Manage workspace directories for file synchronization', addWorkspace: 'Add Workspace', noWorkspaces: 'No workspaces configured' },
    remoteGuide: {
      title: 'Remote Connection Guide',
      desc: 'If Gateway is running on a remote server, use SSH tunnel for secure connection:',
      tip1: 'After creating the tunnel locally, connect using',
      tip2: 'SSH tunnel encrypts transmission, safer than exposing ports directly',
      tip3: 'No need to open Gateway port on remote server',
    },
    connectionGuide: {
      title: 'Connection Guide',
      tip1: 'Ensure OpenClaw Gateway is running (default ws://localhost:18789)',
      tip2: 'Server proxy mode: connection maintained by server, browser close does not affect tasks',
      tip3: 'Browser direct mode: connection established by browser, suitable for real-time chat',
      tip4: 'Token is required for authentication',
    },
    security: {
      ssrfTitle: 'SSRF Protection',
      allowExternal: 'Allow External Access',
      allowExternalDesc: 'Allow connections to non-local API endpoints',
      warning: 'Security Warning',
      warningDesc: 'External access enabled. Only connect to trusted endpoints.',
      dnsProtection: 'DNS Rebinding Protection',
      blockZeroBind: 'Block 0.0.0.0 Binding',
      privateIpAccess: 'Private IP Access',
      enabled: 'Enabled',
      allowed: 'Allowed',
      blocked: 'Blocked',
      notesTitle: 'Security Notes',
      note1: 'Default Security: System only allows connections to local addresses (localhost/127.0.0.1) by default',
      note2: 'SSRF Protection: Prevents Server-Side Request Forgery attacks, blocks access to internal network resources',
      note3: 'DNS Rebinding: Validates IP addresses after domain resolution to prevent DNS rebinding attacks',
      note4: 'SSH Tunnel: When connecting to remote Gateway, SSH tunnel is recommended instead of opening ports directly',
    },
    securityCode: {
      title: 'Security Code (Admin)',
      desc: 'Set a security code for sensitive operations like deleting users or resetting passwords. This provides an extra layer of protection beyond your login password.',
      checking: 'Checking security code status...',
      isSet: 'Security code is set',
      enterPassword: 'Enter password to remove security code',
      currentPassword: 'Current Password',
      currentPasswordPlaceholder: 'Enter your login password',
      securityCode: 'Security Code',
      securityCodePlaceholder: 'At least 4 characters',
      confirmCode: 'Confirm Code',
      confirmCodePlaceholder: 'Re-enter code',
      setButton: 'Set Security Code',
      setting: 'Setting...',
      removeButton: 'Remove',
      fillAllFields: 'Please fill in all fields',
      codesNotMatch: 'Security codes do not match',
      tooShort: 'Security code must be at least 4 characters',
      setSuccess: 'Security code set successfully',
      networkError: 'Network error',
      enterPasswordToDelete: 'Please enter your password',
    },
    systemInit: {
      title: 'System Initialization',
      warning: 'Warning:',
      warningDesc: 'This will delete all user accounts and reset the system to initialization state. All data will be lost except landing page content. This action cannot be undone.',
      resetButton: 'Reset to Initialization State',
      enterCode: 'Please enter your security code to confirm:',
      codePlaceholder: 'Security code',
      cancelButton: 'Cancel',
      confirmButton: 'Confirm Reset',
      resetSuccess: 'System reset successfully! Redirecting to initialization page...',
      resetFailed: 'Reset failed',
    },
    riskDialog: {
      title: 'Security Risk Confirmation',
      desc: 'Please read the following risk information carefully',
      warning: 'Enabling external access allows connections to any network address with risks:',
      risk1: 'May be exploited for SSRF attacks',
      risk2: 'May expose internal network service information',
      risk3: 'Malicious servers may return dangerous content',
      suggestion: 'Recommendation: Only use this feature in development or trusted networks',
      cancel: 'Cancel',
      confirm: 'I understand the risks, continue',
    },
    about: {
      title: `TeamClaw v${process.env.NEXT_PUBLIC_APP_VERSION}`,
      desc: 'AI as teammate, not tool',
      tech: 'Based on Next.js 14 + OpenClaw Gateway Protocol v3',
      platform: 'AI Agent Management & Team Collaboration Platform',
      stack: 'SQLite + Drizzle ORM | Zustand | Tailwind CSS',
    },
  },
  zh: {
    title: '设置',
    tabs: { general: '通用', openclaw: 'OpenClaw 设置', mcpToken: 'MCP Token', security: '安全设置', landing: '首页内容', debug: '调试工具', about: '关于' },
    theme: { title: '外观', light: '浅色', dark: '深色' },
    language: { title: '语言', note: '当前默认中文界面。英文界面正在开发中，切换后部分页面仍显示中文。' },
    data: { title: '数据管理', desc: '本地数据存储在 SQLite 数据库中', refresh: '刷新数据' },
    openclaw: { title: 'OpenClaw 设置', desc: '配置 OpenClaw Gateway 连接模式' },
    workspace: { title: 'OpenClaw Workspace', desc: '管理工作区目录，用于文件同步', addWorkspace: '添加工作区', noWorkspaces: '暂无配置的工作区' },
    remoteGuide: {
      title: '远程连接指南',
      desc: '如果 Gateway 运行在远程服务器上，建议通过 SSH 隧道安全连接：',
      tip1: '在本地创建隧道后，使用',
      tip2: 'SSH 隧道加密传输，比直接暴露端口更安全',
      tip3: '无需在远程服务器上开放 Gateway 端口',
    },
    connectionGuide: {
      title: '连接说明',
      tip1: '确保 OpenClaw Gateway 已运行（默认 ws://localhost:18789）',
      tip2: '服务端代理模式：连接在服务端维护，浏览器关闭不影响任务执行',
      tip3: '浏览器直连模式：连接在浏览器建立，适合实时聊天场景',
      tip4: 'Token 用于身份认证，必须提供',
    },
    security: {
      ssrfTitle: 'SSRF 防护',
      allowExternal: '允许外网访问',
      allowExternalDesc: '允许连接到非本地的 API 端点',
      warning: '安全警告',
      warningDesc: '外网访问已启用。请仅连接到受信任的端点，避免连接到未知或不受信任的服务器。',
      dnsProtection: 'DNS 重绑定防护',
      blockZeroBind: '禁止 0.0.0.0 绑定',
      privateIpAccess: '私有 IP 访问',
      enabled: '已启用',
      allowed: '允许',
      blocked: '禁止',
      notesTitle: '安全说明',
      note1: '默认安全：系统默认仅允许连接到本地地址 (localhost/127.0.0.1)',
      note2: 'SSRF 防护：防止服务端请求伪造攻击，阻止访问内网资源',
      note3: 'DNS 重绑定：验证域名解析后的 IP 地址，防止 DNS 重绑定攻击',
      note4: 'SSH 隧道：连接远程 Gateway 时，推荐使用 SSH 隧道而非直接开放端口',
    },
    securityCode: {
      title: '安全码（管理员）',
      desc: '设置安全码用于敏感操作（如删除用户、重置密码）。这提供了登录密码之外的额外保护层。',
      checking: '检查安全码状态...',
      isSet: '安全码已设置',
      enterPassword: '输入密码以移除安全码',
      currentPassword: '当前密码',
      currentPasswordPlaceholder: '输入您的登录密码',
      securityCode: '安全码',
      securityCodePlaceholder: '至少 4 位字符',
      confirmCode: '确认安全码',
      confirmCodePlaceholder: '再次输入安全码',
      setButton: '设置安全码',
      setting: '设置中...',
      removeButton: '移除',
      fillAllFields: '请填写所有字段',
      codesNotMatch: '两次输入的安全码不一致',
      tooShort: '安全码至少需要 4 位字符',
      setSuccess: '安全码设置成功',
      networkError: '网络错误',
      enterPasswordToDelete: '请输入您的密码',
    },
    systemInit: {
      title: '系统初始化',
      warning: '警告：',
      warningDesc: '此操作将删除所有用户账户，重置系统到初始化状态。除首页内容外，所有数据将丢失。此操作无法撤销。',
      resetButton: '重置到初始化状态',
      enterCode: '请输入安全码确认：',
      codePlaceholder: '安全码',
      cancelButton: '取消',
      confirmButton: '确认重置',
      resetSuccess: '系统重置成功！正在跳转到初始化页面...',
      resetFailed: '重置失败',
    },
    riskDialog: {
      title: '安全风险确认',
      desc: '请仔细阅读以下风险说明',
      warning: '开启外网访问将允许连接到任意网络地址，存在以下风险：',
      risk1: '可能被利用发起 SSRF 攻击',
      risk2: '可能暴露内网服务信息',
      risk3: '恶意服务器可能返回危险内容',
      suggestion: '建议：仅在开发环境或可信网络中使用此功能',
      cancel: '取消',
      confirm: '我了解风险，继续开启',
    },
    about: {
      title: `TeamClaw v${process.env.NEXT_PUBLIC_APP_VERSION}`,
      desc: '把 AI 当队友，而不是工具',
      tech: '基于 Next.js 14 + OpenClaw Gateway Protocol v3',
      platform: 'AI Agent 管理 & 团队协作平台',
      stack: 'SQLite + Drizzle ORM | Zustand | Tailwind CSS',
    },
  },
};

export default function SettingsPage() {
  // 精确 selector 订阅
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  
  const workspaces = useOpenClawWorkspaceStore((s) => s.workspaces);
  const fetchWorkspaces = useOpenClawWorkspaceStore((s) => s.fetchWorkspaces);
  const createWorkspace = useOpenClawWorkspaceStore((s) => s.createWorkspace);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'general';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [lang, setLang] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('teamclaw-language') || 'zh' : 'zh');
  const [ssrfConfig, setSsrfConfig] = useState<SSRFConfig>(loadSsrfConfig);
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);

  // SSRF 外网访问安全码验证
  const ssrfSecurity = useSecurityCode({
    onVerified: () => {
      // 安全码验证通过，显示风险确认对话框
      setShowRiskDialog(true);
    },
  });

  // Escape key support for risk dialog
  useEscapeKey(showRiskDialog, useCallback(() => setShowRiskDialog(false), []));

  // 初始化 i18n
  useEffect(() => {
    initI18n();
  }, []);

  // 加载 workspaces
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // 获取当前语言的翻译
  const t = translations[lang as keyof typeof translations] || translations.zh;

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: 'general', label: t.tabs.general, icon: Palette },
    { key: 'openclaw', label: t.tabs.openclaw, icon: FolderSync },
    { key: 'mcp-token', label: t.tabs.mcpToken || 'MCP Token', icon: Key },
    { key: 'security', label: t.tabs.security, icon: Shield },
    { key: 'landing', label: t.tabs.landing || 'Landing Page', icon: Layout },
    { key: 'debug', label: t.tabs.debug, icon: Bug },
    { key: 'about', label: t.tabs.about, icon: Info },
  ];

  const handleLanguageChange = (newLang: string) => {
    setLang(newLang);
    changeLanguage(newLang);
  };

  const handleToggleExternalAccess = useCallback(() => {
    if (!ssrfConfig.allowExternalAccess) {
      // 开启外网访问需要安全码验证
      ssrfSecurity.verify();
    } else {
      // 关闭外网访问不需要验证
      const newConfig = { ...ssrfConfig, allowExternalAccess: false, acknowledgedRisk: false };
      setSsrfConfig(newConfig);
      saveSsrfConfig(newConfig);
    }
  }, [ssrfConfig, ssrfSecurity]);

  const handleConfirmRisk = useCallback(() => {
    const newConfig = { allowExternalAccess: true, acknowledgedRisk: true };
    setSsrfConfig(newConfig);
    saveSsrfConfig(newConfig);
    setShowRiskDialog(false);
  }, []);

  const handleCreateWorkspace = async (data: {
    name: string;
    path: string;
    memberId?: string | null;
    isDefault?: boolean;
    syncEnabled?: boolean;
    watchEnabled?: boolean;
    syncInterval?: number;
    excludePatterns?: string[];
  }) => {
    await createWorkspace({ ...data, memberId: data.memberId ?? undefined });
    setShowWorkspaceForm(false);
  };

  return (
    <AppShell>
      <Header title={t.title} />

      <main className="flex-1 p-6 overflow-auto mx-auto max-w-5xl">
        {/* Tab 切换 */}
        <div className="flex items-center gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                )}
                style={{ color: activeTab === tab.key ? undefined : 'var(--text-tertiary)' }}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* 通用设置 */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* 主题 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>{t.theme.title}</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={clsx('flex-1 p-4 rounded-xl border-2 transition-colors flex flex-col items-center gap-2',
                    theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-transparent')}
                  style={{ borderColor: theme === 'light' ? undefined : 'var(--border)' }}
                >
                  <Sun className={clsx('w-6 h-6', theme === 'light' ? 'text-primary-500' : '')} style={{ color: theme === 'light' ? undefined : 'var(--text-tertiary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.theme.light}</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={clsx('flex-1 p-4 rounded-xl border-2 transition-colors flex flex-col items-center gap-2',
                    theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-transparent')}
                  style={{ borderColor: theme === 'dark' ? undefined : 'var(--border)' }}
                >
                  <Moon className={clsx('w-6 h-6', theme === 'dark' ? 'text-primary-500' : '')} style={{ color: theme === 'dark' ? undefined : 'var(--text-tertiary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.theme.dark}</span>
                </button>
              </div>
            </div>

            {/* 语言 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
                <div className="flex items-center gap-2"><Globe className="w-4 h-4" /> {t.language.title}</div>
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => handleLanguageChange('zh')}
                  className={clsx('flex-1 p-3 rounded-xl border-2 transition-colors text-center',
                    lang === 'zh' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-transparent')}
                  style={{ borderColor: lang === 'zh' ? undefined : 'var(--border)' }}
                >
                  <span className="text-lg mb-1 block">🇨🇳</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>中文</span>
                </button>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={clsx('flex-1 p-3 rounded-xl border-2 transition-colors text-center',
                    lang === 'en' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-transparent')}
                  style={{ borderColor: lang === 'en' ? undefined : 'var(--border)' }}
                >
                  <span className="text-lg mb-1 block">🇺🇸</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>English</span>
                </button>
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
                {t.language.note}
              </p>
            </div>

            {/* 数据管理 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
                <div className="flex items-center gap-2"><Database className="w-4 h-4" /> {t.data.title}</div>
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{t.data.desc}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                  {t.data.refresh}
                </Button>
              </div>
            </div>

            {/* 修改密码 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
                <div className="flex items-center gap-2"><Lock className="w-4 h-4" /> {lang === 'zh' ? '修改密码' : 'Change Password'}</div>
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                {lang === 'zh' ? '定期修改密码可以提高账户安全性' : 'Change your password regularly for better security'}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowChangePasswordDialog(true)}>
                  {lang === 'zh' ? '修改密码' : 'Change Password'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* OpenClaw 设置 */}
        {activeTab === 'openclaw' && (
          <div className="space-y-4">
            {/* 1. Gateway 连接模式配置 */}
            <GatewayConfigPanel />

            {/* 连接说明 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{t.connectionGuide.title}</h3>
              <ul className="text-xs space-y-1.5 list-disc list-inside" style={{ color: 'var(--text-tertiary)' }}>
                <li>{t.connectionGuide.tip1}</li>
                <li>{t.connectionGuide.tip2}</li>
                <li>{t.connectionGuide.tip3}</li>
                <li>{t.connectionGuide.tip4}</li>
              </ul>
            </div>

            {/* SSH 隧道说明 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                {t.remoteGuide.title}
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                {t.remoteGuide.desc}
              </p>
              <div className="p-3 rounded-lg text-xs font-mono mb-3" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                <code>ssh -L 18789:localhost:18789 user@remote-server</code>
              </div>
              <ul className="text-xs space-y-1.5 list-disc list-inside" style={{ color: 'var(--text-tertiary)' }}>
                <li>{t.remoteGuide.tip1} <code className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-hover)' }}>ws://localhost:18789</code></li>
                <li>{t.remoteGuide.tip2}</li>
                <li>{t.remoteGuide.tip3}</li>
              </ul>
            </div>

            {/* 2. Agent Workspace 设置 */}
            <div id="agent-workspace" className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Folder className="w-4 h-4" /> {t.workspace.title}
                </h3>
                <Button size="sm" variant="secondary" onClick={() => setShowWorkspaceForm(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t.workspace.addWorkspace}
                </Button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>{t.workspace.desc}</p>

              {workspaces.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t.workspace.noWorkspaces}
                </div>
              ) : (
                <div className="space-y-3">
                  {workspaces.map((workspace) => (
                    <WorkspaceCard key={workspace.id} workspace={workspace} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MCP Token 管理 */}
        {activeTab === 'mcp-token' && (
          <div className="card p-5">
            <McpTokenPanel />
          </div>
        )}

        {/* 安全设置 */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            {/* SSRF 防护 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Shield className="w-4 h-4" /> {t.security.ssrfTitle}
              </h3>
              
              {/* 外网访问开关 */}
              <div className="flex items-center justify-between p-3 rounded-lg mb-3" style={{ background: 'var(--surface-hover)' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.security.allowExternal}</div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.security.allowExternalDesc}</div>
                </div>
                <Switch
                  checked={ssrfConfig.allowExternalAccess}
                  onChange={handleToggleExternalAccess}
                />
              </div>

              {/* 风险提示 */}
              {ssrfConfig.allowExternalAccess && (
                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <strong>{t.security.warning}：</strong>{t.security.warningDesc}
                    </div>
                  </div>
                </div>
              )}

              {/* 当前配置状态 */}
              <div className="text-xs space-y-2" style={{ color: 'var(--text-tertiary)' }}>
                <div className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--surface-hover)' }}>
                  <span>{t.security.dnsProtection}</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.security.enabled}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--surface-hover)' }}>
                  <span>{t.security.blockZeroBind}</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.security.enabled}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--surface-hover)' }}>
                  <span>{t.security.privateIpAccess}</span>
                  <span className={clsx('font-medium', ssrfConfig.allowExternalAccess ? 'text-amber-500' : '')} style={{ color: ssrfConfig.allowExternalAccess ? undefined : 'var(--text-primary)' }}>
                    {ssrfConfig.allowExternalAccess ? t.security.allowed : t.security.blocked}
                  </span>
                </div>
              </div>
            </div>

            {/* 安全码（管理员二次验证） */}
            <SecurityCodeSettings />

            {/* 系统初始化 */}
            <SystemInitSettings />

            {/* 安全说明 */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <ShieldAlert className="w-4 h-4" /> {t.security.notesTitle}
              </h3>
              <ul className="text-xs space-y-2 list-disc list-inside" style={{ color: 'var(--text-tertiary)' }}>
                <li><strong>{t.security.note1}</strong></li>
                <li><strong>{t.security.note2}</strong></li>
                <li><strong>{t.security.note3}</strong></li>
                <li><strong>{t.security.note4}</strong></li>
              </ul>
            </div>
          </div>
        )}

        {/* 首页内容管理 */}
        {activeTab === 'landing' && (
          <div className="card p-0 overflow-hidden h-[calc(100vh-280px)] min-h-[500px]">
            <LandingContentEditor />
          </div>
        )}

        {/* 调试工具 */}
        {activeTab === 'debug' && (
          <DebugPanel />
        )}

        {/* 关于 */}
        {activeTab === 'about' && (
          <div className="card p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-700 dark:bg-primary-600 flex items-center justify-center">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-display text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t.about.title}</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>{t.about.desc}</p>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)' }}>
              <p>{t.about.tech}</p>
              <p>{t.about.platform}</p>
              <p className="mt-2">{t.about.stack}</p>
            </div>
          </div>
        )}
      </main>

      {/* 风险确认对话框 */}
      {showRiskDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="risk-dialog-title">
          <div className="rounded-2xl p-6 w-full max-w-md shadow-float mx-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 id="risk-dialog-title" className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{t.riskDialog.title}</h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.riskDialog.desc}</p>
              </div>
            </div>

            <div className="text-sm space-y-3 mb-4" style={{ color: 'var(--text-secondary)' }}>
              <p>{t.riskDialog.warning}</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>{t.riskDialog.risk1}</li>
                <li>{t.riskDialog.risk2}</li>
                <li>{t.riskDialog.risk3}</li>
              </ul>
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {t.riskDialog.suggestion}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowRiskDialog(false)}>{t.riskDialog.cancel}</Button>
              <Button size="sm" className="bg-amber-500 text-white hover:bg-amber-600" onClick={handleConfirmRisk}>
                {t.riskDialog.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SSRF 外网访问安全码验证对话框 */}
      <SecurityCodeDialog
        isOpen={ssrfSecurity.showDialog}
        securityCode={ssrfSecurity}
        title="安全验证"
        description="开启外网访问需要验证安全码"
      />

      {/* 创建 Workspace 对话框 */}
      {showWorkspaceForm && (
        <WorkspaceForm
          onClose={() => setShowWorkspaceForm(false)}
          onSubmit={handleCreateWorkspace}
        />
      )}

      {/* 修改密码对话框 */}
      <ChangePasswordDialog
        open={showChangePasswordDialog}
        onOpenChange={setShowChangePasswordDialog}
      />
    </AppShell>
  );
}
