'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { RotateCcw, AlertTriangle, Loader2, CheckCircle2, Database, Settings, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

// 重置模式
type ResetMode = 'settings' | 'full';

// 翻译配置
const translations = {
  en: {
    title: 'System Initialization',
    modeTitle: 'Select Reset Mode',
    modeSettings: 'Reset Settings Only',
    modeSettingsDesc: 'Delete user accounts and reset configuration, but keep database (tasks, projects, wiki, etc.)',
    modeFull: 'Complete Reset (Delete Database)',
    modeFullDesc: 'Delete entire database including all data. System will re-initialize with default data.',
    warning: 'Warning:',
    warningSettings: 'This will delete all user accounts and reset system configuration. Existing data (tasks, projects, wiki) will be preserved.',
    warningFull: 'This will DELETE THE ENTIRE DATABASE. All tasks, projects, wiki, and other data will be permanently lost. This action cannot be undone.',
    resetButton: 'Reset to Initialization State',
    enterCode: 'Please enter your security code to confirm:',
    codePlaceholder: 'Security code',
    cancelButton: 'Cancel',
    confirmButton: 'Confirm Reset',
    resetSuccess: 'System reset successfully! Redirecting to initialization page...',
    resetSuccessFull: 'Database deleted! Redirecting to initialization page...',
    resetFailed: 'Reset failed',
  },
  zh: {
    title: '系统初始化',
    modeTitle: '选择重置模式',
    modeSettings: '仅重置设置',
    modeSettingsDesc: '删除用户账户并重置配置，但保留数据库（任务、项目、Wiki 等）',
    modeFull: '完全重置（删除数据库）',
    modeFullDesc: '删除整个数据库包括所有数据，系统将使用默认数据重新初始化',
    warning: '警告：',
    warningSettings: '此操作将删除所有用户账户并重置系统配置。现有数据（任务、项目、Wiki）将被保留。',
    warningFull: '此操作将删除整个数据库。所有任务、项目、Wiki 等数据将永久丢失。此操作无法撤销。',
    resetButton: '重置到初始化状态',
    enterCode: '请输入安全码确认：',
    codePlaceholder: '安全码',
    cancelButton: '取消',
    confirmButton: '确认重置',
    resetSuccess: '系统重置成功！正在跳转到初始化页面...',
    resetSuccessFull: '数据库已删除！正在跳转到初始化页面...',
    resetFailed: '重置失败',
  },
};

function getLocale(): 'en' | 'zh' {
  if (typeof window === 'undefined') return 'zh';
  const stored = localStorage.getItem('teamclaw-language');
  if (stored === 'en' || stored === 'zh') return stored;
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

export function SystemInitSettings() {
  const router = useRouter();
  const [locale, setLocale] = useState<'en' | 'zh'>('zh');
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetMode, setResetMode] = useState<ResetMode>('settings');
  const [securityCode, setSecurityCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const t = translations[locale];

  // 初始化语言
  useEffect(() => {
    setLocale(getLocale());
    
    const handleLanguageChange = () => {
      setLocale(getLocale());
    };
    
    window.addEventListener('language-change', handleLanguageChange);
    return () => window.removeEventListener('language-change', handleLanguageChange);
  }, []);

  const handleReset = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/reset-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ securityCode, mode: resetMode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t.resetFailed);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setSuccessMessage(resetMode === 'full' ? t.resetSuccessFull : t.resetSuccess);
      setTimeout(() => {
        router.push('/init');
      }, 2000);
    } catch (err) {
      setError(t.resetFailed);
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 border-red-200 dark:border-red-900/30">
      <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <RotateCcw className="w-4 h-4" /> {t.title}
      </h3>

      {!showConfirm ? (
        <>
          {/* 模式选择 */}
          <div className="space-y-3 mb-4">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.modeTitle}</p>
            
            {/* 仅重置设置 */}
            <button
              onClick={() => setResetMode('settings')}
              className={clsx(
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                resetMode === 'settings' 
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' 
                  : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
              )}
              style={{ borderColor: resetMode === 'settings' ? undefined : 'var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  resetMode === 'settings' ? 'bg-primary-100 dark:bg-primary-900' : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  <Settings className={clsx('w-5 h-5', resetMode === 'settings' ? 'text-primary-600' : '')} style={{ color: resetMode === 'settings' ? undefined : 'var(--text-tertiary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t.modeSettings}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t.modeSettingsDesc}</div>
                </div>
              </div>
            </button>

            {/* 完全重置 */}
            <button
              onClick={() => setResetMode('full')}
              className={clsx(
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                resetMode === 'full' 
                  ? 'border-red-500 bg-red-50 dark:bg-red-950' 
                  : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
              )}
              style={{ borderColor: resetMode === 'full' ? undefined : 'var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  resetMode === 'full' ? 'bg-red-100 dark:bg-red-900' : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  <Trash2 className={clsx('w-5 h-5', resetMode === 'full' ? 'text-red-600' : '')} style={{ color: resetMode === 'full' ? undefined : 'var(--text-tertiary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-red-600 dark:text-red-400">{t.modeFull}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t.modeFullDesc}</div>
                </div>
              </div>
            </button>
          </div>

          {/* 警告信息 */}
          <div className={clsx(
            'p-3 rounded-lg border mb-4',
            resetMode === 'full' 
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
              : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
          )}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', resetMode === 'full' ? 'text-red-500' : 'text-amber-500')} />
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <strong>{t.warning}</strong> {resetMode === 'full' ? t.warningFull : t.warningSettings}
              </div>
            </div>
          </div>

          <Button 
            variant="danger" 
            onClick={() => setShowConfirm(true)}
            className={clsx('w-full', resetMode === 'full' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700')}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {t.resetButton}
          </Button>
        </>
      ) : success ? (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-green-700 dark:text-green-400">
            {successMessage}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={clsx(
            'p-3 rounded-lg border',
            resetMode === 'full' 
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
              : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
          )}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', resetMode === 'full' ? 'text-red-500' : 'text-amber-500')} />
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {resetMode === 'full' ? t.warningFull : t.warningSettings}
              </div>
            </div>
          </div>
          
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t.enterCode}
          </p>
          <Input
            type="password"
            value={securityCode}
            onChange={(e) => setSecurityCode(e.target.value)}
            placeholder={t.codePlaceholder}
            className="bg-white/5"
          />
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={() => { setShowConfirm(false); setSecurityCode(''); setError(''); }}
              className="flex-1"
            >
              {t.cancelButton}
            </Button>
            <Button 
              onClick={handleReset}
              disabled={loading || !securityCode}
              className={clsx('flex-1', resetMode === 'full' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700')}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              {t.confirmButton}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
