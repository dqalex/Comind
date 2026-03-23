'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@/lib/i18n';
import { Button, Input } from '@/shared/ui';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
import ConfirmDialog from '@/shared/layout/ConfirmDialog';
import clsx from 'clsx';
import { useAuthStore } from '@/domains';
import { useSecurityCode } from '@/shared/hooks/useSecurityCode';
import { SecurityCodeDialog } from '@/shared/layout/SecurityCodeDialog';
import { Wifi, Server, AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react';

type ConnectionMode = 'server_proxy';
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

interface GatewayConfig {
  id: string;
  url: string;
  mode: ConnectionMode;
  status: ConnectionStatus;
}

export function GatewayConfigPanel() {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 表单状态
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [mode, setMode] = useState<ConnectionMode>('server_proxy');

  // 删除确认
  const deleteConfirm = useConfirmAction<boolean>();

  // Gateway 配置更改安全码验证（仅连通后需要）
  const gatewaySecurity = useSecurityCode({
    onVerified: async () => {
      // 安全码验证通过，执行保存
      await doSave();
    },
  });

  // 初始化 i18n
  useEffect(() => {
    initI18n();
  }, []);

  // 加载配置
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/gateway/config');
      const data = await res.json();
      
      if (data.data) {
        setConfig(data.data);
        setUrl(data.data.url);
        setMode(data.data.mode);
      }
    } catch (e) {
      console.error('Failed to fetch gateway config:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // 执行保存（在安全码验证后调用，或首次配置时直接调用）
  const doSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          token: token || undefined, 
          mode,
          securityCode: gatewaySecurity.code || undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Gateway configuration saved');
        setToken(''); // 清除 token 显示
        await fetchConfig();
      }
    } catch (e) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
      gatewaySecurity.setCode('');
    }
  };

  // 保存配置
  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!url) {
      setError('URL is required');
      return;
    }

    // 验证 URL 格式
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') {
        setError('URL must use ws:// or wss:// protocol');
        return;
      }
    } catch {
      setError('Invalid URL format');
      return;
    }

    // 如果是新配置或修改了 token，要求输入 token
    if (!config && !token) {
      setError('Token is required for new configuration');
      return;
    }

    // 检查是否已连通 - 如果已连通，需要安全码验证
    if (config && config.status === 'connected') {
      gatewaySecurity.verify();
      return;
    }

    // 首次配置或未连通状态，直接保存
    await doSave();
  };

  // 删除配置
  const handleDelete = () => {
    if (!config) return;
    deleteConfirm.requestConfirm(true);
  };

  // 执行删除
  const doDelete = async () => {
    if (!config) return;

    try {
      const res = await fetch(`/api/gateway/config?id=${config.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setConfig(null);
        setUrl('');
        setToken('');
        setSuccess('Gateway configuration deleted');
      }
    } catch (e) {
      setError('Failed to delete configuration');
    }
  };

  // 获取状态显示
  const getStatusDisplay = () => {
    if (!config) return null;

    const statusConfig: Record<ConnectionStatus, { color: string; icon: typeof Wifi; text: string }> = {
      connected: { color: 'text-green-500', icon: CheckCircle2, text: 'Connected' },
      disconnected: { color: 'text-gray-400', icon: Wifi, text: 'Disconnected' },
      connecting: { color: 'text-yellow-500', icon: Loader2, text: 'Connecting...' },
      error: { color: 'text-red-500', icon: AlertCircle, text: 'Error' },
    };

    const { color, icon: Icon, text } = statusConfig[config.status] || statusConfig.disconnected;

    return (
      <div className={clsx('flex items-center gap-1.5 text-xs', color)}>
        <Icon className={clsx('w-3.5 h-3.5', config.status === 'connecting' && 'animate-spin')} />
        <span>{text}</span>
      </div>
    );
  };

  return (
    <>
    <div className="card p-4">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
            Gateway 连接
          </span>
        </div>
        {getStatusDisplay()}
      </div>

      {/* 说明 */}
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        服务端代理模式：WebSocket 连接在服务端维护，浏览器关闭不影响任务执行。
      </p>

      {!isAdmin && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">仅管理员可配置</p>
            <p className="text-amber-600 dark:text-amber-500 mt-0.5">当前为普通用户，无权修改系统级 Gateway 配置。</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <>
          {/* Gateway URL */}
          <div className="mb-3">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Gateway URL
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://localhost:18789"
              className="text-xs"
              disabled={!isAdmin}
            />
          </div>

          {/* Token */}
          <div className="mb-4">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Token {config && <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>(留空保持不变)</span>}
            </label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={config ? '••••••••' : 'Enter token'}
                className="text-xs pr-16"
                disabled={!isAdmin}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {showToken ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {/* 错误/成功提示 */}
          {error && (
            <div className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          {/* 操作按钮 */}
          {isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {config ? '更新配置' : '保存配置'}
              </Button>
              {config && (
                <Button size="sm" variant="secondary" onClick={handleDelete}>
                  删除
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>

      {/* Gateway 配置更改安全码验证对话框 */}
      <SecurityCodeDialog
        isOpen={gatewaySecurity.showDialog}
        securityCode={gatewaySecurity}
        title="配置验证"
        description="修改已连接的 Gateway 配置需要验证安全码"
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.cancel}
        onConfirm={() => deleteConfirm.confirm(async () => { await doDelete(); })}
        title={t('common.confirm')}
        message="Are you sure you want to delete this gateway configuration?"
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteConfirm.isLoading}
      />
    </>
  );
}
