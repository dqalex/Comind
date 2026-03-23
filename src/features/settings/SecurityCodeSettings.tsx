'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/domains';
import { Button, Input } from '@/shared/ui';
import { Shield, Check, X, Loader2, AlertCircle } from 'lucide-react';

// 翻译配置
const translations = {
  en: {
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
  zh: {
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
};

function getLocale(): 'en' | 'zh' {
  if (typeof window === 'undefined') return 'zh';
  const stored = localStorage.getItem('teamclaw-language');
  if (stored === 'en' || stored === 'zh') return stored;
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

export function SecurityCodeSettings() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  
  const [locale, setLocale] = useState<'en' | 'zh'>('zh');
  const [hasSecurityCode, setHasSecurityCode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  
  // 设置安全码表单
  const [currentPassword, setCurrentPassword] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 清除安全码表单
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  
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
  
  // 检查是否已设置安全码
  useEffect(() => {
    if (!isAdmin) {
      setChecking(false);
      return;
    }
    
    fetch('/api/users/verify-security-code', { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        // API 返回 { required: true } 表示已设置安全码，需要验证
        // required: false 表示未设置，不需要验证
        setHasSecurityCode(data.required === true);
      })
      .catch(() => {
        setHasSecurityCode(false);
      })
      .finally(() => {
        setChecking(false);
      });
  }, [isAdmin]);
  
  const handleSetCode = async () => {
    setError('');
    setSuccess('');
    
    if (!currentPassword || !securityCode || !confirmCode) {
      setError(t.fillAllFields);
      return;
    }
    if (securityCode !== confirmCode) {
      setError(t.codesNotMatch);
      return;
    }
    if (securityCode.length < 4) {
      setError(t.tooShort);
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/users/security-code', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, securityCode }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      
      setSuccess(t.setSuccess);
      setHasSecurityCode(true);
      setCurrentPassword('');
      setSecurityCode('');
      setConfirmCode('');
    } catch (err) {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteCode = async () => {
    setDeleteError('');
    
    if (!deletePassword) {
      setDeleteError(t.enterPasswordToDelete);
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/users/security-code', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setDeleteError(data.error || t.networkError);
        return;
      }
      
      setHasSecurityCode(false);
      setDeletePassword('');
    } catch (err) {
      setDeleteError(t.networkError);
    } finally {
      setLoading(false);
    }
  };
  
  if (!isAdmin) {
    return null;
  }
  
  if (checking) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t.checking}
        </div>
      </div>
    );
  }
  
  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Shield className="w-4 h-4" /> {t.title}
      </h3>
      
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        {t.desc}
      </p>
      
      {hasSecurityCode ? (
        // 已设置安全码 - 显示清除选项
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t.isSet}</span>
          </div>
          
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              {t.enterPassword}
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={t.currentPasswordPlaceholder}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="flex-1"
              />
              <Button variant="danger" onClick={handleDeleteCode} disabled={loading}>
                {t.removeButton}
              </Button>
            </div>
            {deleteError && (
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{deleteError}</p>
            )}
          </div>
        </div>
      ) : (
        // 未设置安全码 - 显示设置表单
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              {t.currentPassword}
            </label>
            <Input
              type="password"
              placeholder={t.currentPasswordPlaceholder}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                {t.securityCode}
              </label>
              <Input
                type="password"
                placeholder={t.securityCodePlaceholder}
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                {t.confirmCode}
              </label>
              <Input
                type="password"
                placeholder={t.confirmCodePlaceholder}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
              />
            </div>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#ef4444' }}>
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#22c55e' }}>
              <Check className="w-3.5 h-3.5" />
              {success}
            </div>
          )}
          
          <Button onClick={handleSetCode} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.setting}
              </>
            ) : (
              t.setButton
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
