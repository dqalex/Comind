'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserMcpTokenStore } from '@/core/mcp/user-mcp-token.store';
import { useAuthStore } from '@/domains/auth';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Button, Input, Badge } from '@/components/ui';
import {
  Key, Plus, Trash2, Copy, Check,
  AlertCircle, RefreshCw, Clock, Info,
} from 'lucide-react';
import clsx from 'clsx';

export default function McpTokenPanel() {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  
  const tokens = useUserMcpTokenStore((s) => s.tokens);
  const isLoading = useUserMcpTokenStore((s) => s.isLoading);
  const error = useUserMcpTokenStore((s) => s.error);
  const fetchTokens = useUserMcpTokenStore((s) => s.fetchTokens);
  const createToken = useUserMcpTokenStore((s) => s.createToken);
  const deleteToken = useUserMcpTokenStore((s) => s.deleteToken);
  const clearError = useUserMcpTokenStore((s) => s.clearError);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState('');
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  // Escape key support
  useEscapeKey(showCreateDialog, useCallback(() => {
    if (!newlyCreatedToken) setShowCreateDialog(false);
  }, [newlyCreatedToken]));
  useEscapeKey(!!showDeleteConfirm, useCallback(() => setShowDeleteConfirm(null), []));

  // 初始加载
  useEffect(() => {
    if (isAuthenticated) {
      fetchTokens();
    }
  }, [isAuthenticated, fetchTokens]);

  // 创建 Token
  const handleCreateToken = async () => {
    setCreating(true);
    const result = await createToken(newTokenName.trim() || undefined);
    setCreating(false);

    if (result) {
      setNewlyCreatedToken(result.token);
      setNewTokenName('');
    }
  };

  // 复制 Token
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 删除 Token
  const handleDeleteToken = async (id: string) => {
    await deleteToken(id);
    setShowDeleteConfirm(null);
  };

  // 关闭创建对话框
  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setNewlyCreatedToken(null);
    setNewTokenName('');
  };

  // 格式化时间
  const formatTime = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // 未登录提示
  if (!isAuthenticated || !user) {
    return (
      <div className="p-8 text-center">
        <Key className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('mcpToken.loginRequired')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和说明 */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Key className="w-5 h-5 text-primary-500" />
            {t('mcpToken.title')}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('mcpToken.description')}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" /> {t('mcpToken.createToken')}
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button onClick={clearError} className="ml-auto text-xs hover:underline">{t('common.close')}</button>
        </div>
      )}

      {/* Token 使用说明 */}
      <div className="rounded-lg p-4 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
          <div className="text-xs space-y-2 flex-1" style={{ color: 'var(--text-secondary)' }}>
            <p><strong>{t('mcpToken.usageTitle')}</strong></p>
            <p>{t('mcpToken.usageDesc')}</p>
            <div className="relative">
              <pre className="font-mono p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
{`{
  "mcpServers": {
    "teamclaw": {
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-teamclaw.com'}/api/mcp/external",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}`}
              </pre>
              <button
                onClick={() => {
                  const config = JSON.stringify({
                    mcpServers: {
                      teamclaw: {
                        url: `${window.location.origin}/api/mcp/external`,
                        headers: {
                          Authorization: "Bearer YOUR_TOKEN_HERE"
                        }
                      }
                    }
                  }, null, 2);
                  navigator.clipboard.writeText(config);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                style={{ color: copied ? 'var(--success)' : 'var(--text-secondary)', background: 'var(--surface)' }}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? t('mcpToken.copied') : t('mcpToken.copy')}
              </button>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {t('mcpToken.replaceTokenHint')}
            </p>
          </div>
        </div>
      </div>

      {/* Token 列表 */}
      <div className="space-y-3">
        {isLoading && tokens.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : tokens.length === 0 ? (
          <div className="p-8 text-center rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <Key className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('mcpToken.noTokens')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('mcpToken.noTokensHint')}</p>
          </div>
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between p-4 rounded-lg border group"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'w-9 h-9 rounded-lg flex items-center justify-center',
                  token.status === 'active' ? 'bg-green-50 dark:bg-green-950/30' : 'bg-slate-100 dark:bg-slate-900'
                )}>
                  <Key className={clsx(
                    'w-4 h-4',
                    token.status === 'active' ? 'text-green-500' : 'text-slate-400'
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {token.name || t('mcpToken.unnamed')}
                    </span>
                    <Badge className={clsx(
                      'text-[9px]',
                      token.status === 'active'
                        ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400'
                    )}>
                      {token.status === 'active' ? t('mcpToken.statusActive') : t('mcpToken.statusRevoked')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t('mcpToken.createdAt')} {formatTime(token.createdAt)}
                    </span>
                    {token.lastUsedAt && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        {t('mcpToken.lastUsed')} {formatTime(token.lastUsedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(token.id)}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 创建 Token 对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            {!newlyCreatedToken ? (
              <>
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Key className="w-5 h-5 text-primary-500" />
                  {t('mcpToken.createNewToken')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>
                      {t('mcpToken.tokenName')} ({t('common.optional')})
                    </label>
                    <Input
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      placeholder={t('mcpToken.tokenNamePlaceholder')}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs p-3 rounded-lg" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                    <AlertCircle className="w-4 h-4 inline-block mr-1 text-amber-500" />
                    {t('mcpToken.createWarning')}
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button size="sm" variant="secondary" onClick={handleCloseCreateDialog}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" onClick={handleCreateToken} disabled={creating}>
                    {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {t('mcpToken.create')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  {t('mcpToken.tokenCreated')}
                </h3>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 text-xs">
                    <AlertCircle className="w-4 h-4 inline-block mr-1" />
                    {t('mcpToken.copyNowWarning')}
                  </div>
                  <div className="relative">
                    <Input
                      value={newlyCreatedToken}
                      readOnly
                      className="font-mono !text-xs pr-20"
                    />
                    <button
                      onClick={() => handleCopyToken(newlyCreatedToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                      style={{ color: copied ? 'var(--success)' : 'var(--text-secondary)' }}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? t('mcpToken.copied') : t('mcpToken.copy')}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button size="sm" onClick={handleCloseCreateDialog}>
                    {t('common.close')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-float" style={{ background: 'var(--surface)' }}>
            <h3 className="font-display font-semibold mb-2 text-red-500 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {t('mcpToken.deleteToken')}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('mcpToken.deleteConfirm')}
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={() => handleDeleteToken(showDeleteConfirm)}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
