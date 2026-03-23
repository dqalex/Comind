'use client';

/**
 * SkillHub 设置页面
 * 
 * 路径: /skillhub/settings
 * 
 * 功能:
 * - 外部 SkillHub 发布配置
 * - Skill 自动发现设置
 * - 其他全局配置
 * 
 * 权限：仅管理员
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Label, Badge, Select } from '@/shared/ui';
import { useAuthStore } from '@/domains';
import {
  ArrowLeft, Settings, Globe, Shield, Zap, Save, AlertTriangle,
  Loader2, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react';
import clsx from 'clsx';

// 发布模式类型
type PublishMode = 'disabled' | 'admin_only' | 'auto';

// 设置数据结构
interface SkillHubSettings {
  publishMode: PublishMode;
  externalHubUrl: string;
  externalHubApiKey: string;
  autoDiscoverEnabled: boolean;
  autoDiscoverInterval: number;
  autoSnapshotEnabled: boolean;
  autoSnapshotInterval: number;
}

// 默认设置
const DEFAULT_SETTINGS: SkillHubSettings = {
  publishMode: 'disabled',
  externalHubUrl: '',
  externalHubApiKey: '',
  autoDiscoverEnabled: true,
  autoDiscoverInterval: 24,
  autoSnapshotEnabled: true,
  autoSnapshotInterval: 6,
};

export default function SkillHubSettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  
  // 权限
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  
  // 状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SkillHubSettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // 权限检查
  useEffect(() => {
    if (!isAdmin && !loading) {
      router.push('/skillhub');
    }
  }, [isAdmin, loading, router]);
  
  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/skillhub-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // 更新设置字段
  const updateSetting = <K extends keyof SkillHubSettings>(key: K, value: SkillHubSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
    
    // 清除错误
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };
  
  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (settings.publishMode !== 'disabled') {
      if (!settings.externalHubUrl.trim()) {
        newErrors.externalHubUrl = t('skillhub.settings.urlRequired');
      } else {
        try {
          new URL(settings.externalHubUrl);
        } catch {
          newErrors.externalHubUrl = t('skillhub.settings.invalidUrl');
        }
      }
      
      if (!settings.externalHubApiKey.trim()) {
        newErrors.externalHubApiKey = t('skillhub.settings.apiKeyRequired');
      }
    }
    
    if (settings.autoDiscoverInterval < 1 || settings.autoDiscoverInterval > 168) {
      newErrors.autoDiscoverInterval = t('skillhub.settings.intervalRange');
    }
    
    if (settings.autoSnapshotInterval < 1 || settings.autoSnapshotInterval > 72) {
      newErrors.autoSnapshotInterval = t('skillhub.settings.intervalRange');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // 保存设置
  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/skillhub-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        setErrors({ submit: err.error || t('common.error') });
      }
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setSaving(false);
    }
  };
  
  // 测试外部连接
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  
  const handleTestConnection = async () => {
    if (!settings.externalHubUrl || !settings.externalHubApiKey) {
      setErrors({ externalHubUrl: t('skillhub.settings.urlRequired'), externalHubApiKey: t('skillhub.settings.apiKeyRequired') });
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/skillhub-settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.externalHubUrl,
          apiKey: settings.externalHubApiKey,
        }),
      });
      
      setTestResult(res.ok ? 'success' : 'failed');
    } catch {
      setTestResult('failed');
    } finally {
      setTesting(false);
    }
  };
  
  if (!isAdmin) {
    return null;
  }
  
  return (
    <AppShell>
      <Header 
        title={t('skillhub.settings.title')}
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push('/skillhub')}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
        }
      />
      
      <main className="flex-1 p-6 overflow-auto max-w-3xl mx-auto">
        {/* 外部 SkillHub 配置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t('skillhub.settings.externalHub')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* 发布模式 */}
            <div className="space-y-2">
              <Label htmlFor="publishMode">{t('skillhub.settings.publishMode')}</Label>
              <Select
                value={settings.publishMode}
                onChange={(e) => updateSetting('publishMode', e.target.value as PublishMode)}
                options={[
                  { value: 'disabled', label: t('skillhub.settings.publishDisabled') },
                  { value: 'admin_only', label: t('skillhub.settings.publishAdminOnly') },
                  { value: 'auto', label: t('skillhub.settings.publishAuto') },
                ]}
              />
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('skillhub.settings.publishModeHint')}
              </p>
            </div>
            
            {/* 外部 URL */}
            {settings.publishMode !== 'disabled' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="externalHubUrl">{t('skillhub.settings.hubUrl')}</Label>
                  <Input
                    id="externalHubUrl"
                    value={settings.externalHubUrl}
                    onChange={(e) => updateSetting('externalHubUrl', e.target.value)}
                    placeholder="https://skillhub.example.com/api"
                    className={errors.externalHubUrl ? 'border-red-500' : ''}
                  />
                  {errors.externalHubUrl && (
                    <p className="text-xs text-red-500">{errors.externalHubUrl}</p>
                  )}
                </div>
                
                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="externalHubApiKey">{t('skillhub.settings.apiKey')}</Label>
                  <Input
                    id="externalHubApiKey"
                    type="password"
                    value={settings.externalHubApiKey}
                    onChange={(e) => updateSetting('externalHubApiKey', e.target.value)}
                    placeholder="sk_..."
                    className={errors.externalHubApiKey ? 'border-red-500' : ''}
                  />
                  {errors.externalHubApiKey && (
                    <p className="text-xs text-red-500">{errors.externalHubApiKey}</p>
                  )}
                </div>
                
                {/* 测试连接 */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="flex items-center gap-1.5"
                  >
                    {testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Shield className="w-3.5 h-3.5" />
                    )}
                    {t('skillhub.settings.testConnection')}
                  </Button>
                  
                  {testResult === 'success' && (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs">{t('skillhub.settings.connectionSuccess')}</span>
                    </div>
                  )}
                  
                  {testResult === 'failed' && (
                    <div className="flex items-center gap-1.5 text-red-500">
                      <XCircle className="w-4 h-4" />
                      <span className="text-xs">{t('skillhub.settings.connectionFailed')}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* 自动化设置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {t('skillhub.settings.automation')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* 自动发现 */}
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('skillhub.settings.autoDiscover')}</Label>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.settings.autoDiscoverHint')}
                </p>
              </div>
              <button
                onClick={() => updateSetting('autoDiscoverEnabled', !settings.autoDiscoverEnabled)}
                className={clsx(
                  'relative w-11 h-6 rounded-full transition-colors',
                  settings.autoDiscoverEnabled ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
                    settings.autoDiscoverEnabled && 'translate-x-5'
                  )}
                />
              </button>
            </div>
            
            {settings.autoDiscoverEnabled && (
              <div className="space-y-2 pl-4 border-l-2" style={{ borderColor: 'var(--border)' }}>
                <Label htmlFor="autoDiscoverInterval">{t('skillhub.settings.discoverInterval')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="autoDiscoverInterval"
                    type="number"
                    min={1}
                    max={168}
                    value={settings.autoDiscoverInterval}
                    onChange={(e) => updateSetting('autoDiscoverInterval', parseInt(e.target.value) || 24)}
                    className={clsx('w-20', errors.autoDiscoverInterval && 'border-red-500')}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('skillhub.settings.hours')}
                  </span>
                </div>
                {errors.autoDiscoverInterval && (
                  <p className="text-xs text-red-500">{errors.autoDiscoverInterval}</p>
                )}
              </div>
            )}
            
            {/* 自动快照 */}
            <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div>
                <Label>{t('skillhub.settings.autoSnapshot')}</Label>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.settings.autoSnapshotHint')}
                </p>
              </div>
              <button
                onClick={() => updateSetting('autoSnapshotEnabled', !settings.autoSnapshotEnabled)}
                className={clsx(
                  'relative w-11 h-6 rounded-full transition-colors',
                  settings.autoSnapshotEnabled ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
                    settings.autoSnapshotEnabled && 'translate-x-5'
                  )}
                />
              </button>
            </div>
            
            {settings.autoSnapshotEnabled && (
              <div className="space-y-2 pl-4 border-l-2" style={{ borderColor: 'var(--border)' }}>
                <Label htmlFor="autoSnapshotInterval">{t('skillhub.settings.snapshotInterval')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="autoSnapshotInterval"
                    type="number"
                    min={1}
                    max={72}
                    value={settings.autoSnapshotInterval}
                    onChange={(e) => updateSetting('autoSnapshotInterval', parseInt(e.target.value) || 6)}
                    className={clsx('w-20', errors.autoSnapshotInterval && 'border-red-500')}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('skillhub.settings.hours')}
                  </span>
                </div>
                {errors.autoSnapshotInterval && (
                  <p className="text-xs text-red-500">{errors.autoSnapshotInterval}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* 错误提示 */}
        {errors.submit && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
            {errors.submit}
          </div>
        )}
        
        {/* 保存成功提示 */}
        {saveSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 text-sm">
            {t('skillhub.settings.saveSuccess')}
          </div>
        )}
        
        {/* 保存按钮 */}
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push('/skillhub')}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('common.save')}
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
