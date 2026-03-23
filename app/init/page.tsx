'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/shared/ui';
import { Database, Shield, AlertTriangle, Loader2 } from 'lucide-react';

// i18n 翻译
const translations = {
  en: {
    welcomeTitle: 'Welcome to TeamClaw',
    welcomeSubtitle: 'AI Team Collaboration Platform',
    databaseConfig: 'Database Configuration',
    databaseDesc: 'This instance uses SQLite by default. To use PostgreSQL, set the DATABASE_URL environment variable.',
    initializeNow: 'Initialize Now',
    initializeDesc: 'Creating an admin account will initialize the database with default settings.',
    getStarted: 'Get Started',
    createAdminTitle: 'Create Admin Account',
    createAdminSubtitle: 'This account will have full administrative privileges',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'admin@example.com',
    password: 'Password',
    passwordPlaceholder: 'At least 8 chars with letters and numbers',
    confirmPassword: 'Confirm Password',
    confirmPasswordPlaceholder: 'Re-enter password',
    createAdminButton: 'Create Admin Account',
    creating: 'Creating...',
    setupComplete: 'Setup Complete!',
    setupCompleteDesc: 'Your TeamClaw instance is ready to use',
    goToLogin: 'Go to Login',
    fillAllFields: 'Please fill in all fields',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 8 characters with letters and numbers',
    createFailed: 'Failed to create admin account',
    networkError: 'Network error',
  },
  zh: {
    welcomeTitle: '欢迎使用 TeamClaw',
    welcomeSubtitle: 'AI 团队协作平台',
    databaseConfig: '数据库配置',
    databaseDesc: '本实例默认使用 SQLite。如需使用 PostgreSQL，请设置 DATABASE_URL 环境变量。',
    initializeNow: '立即初始化',
    initializeDesc: '创建管理员账户将使用默认设置初始化数据库。',
    getStarted: '开始配置',
    createAdminTitle: '创建管理员账户',
    createAdminSubtitle: '此账户将拥有完整的管理权限',
    name: '姓名',
    namePlaceholder: '您的姓名',
    email: '邮箱',
    emailPlaceholder: 'admin@example.com',
    password: '密码',
    passwordPlaceholder: '至少 8 位，包含字母和数字',
    confirmPassword: '确认密码',
    confirmPasswordPlaceholder: '再次输入密码',
    createAdminButton: '创建管理员账户',
    creating: '创建中...',
    setupComplete: '设置完成！',
    setupCompleteDesc: '您的 TeamClaw 实例已准备就绪',
    goToLogin: '前往登录',
    fillAllFields: '请填写所有字段',
    passwordMismatch: '两次输入的密码不一致',
    passwordTooShort: '密码至少 8 位，需包含字母和数字',
    createFailed: '创建管理员账户失败',
    networkError: '网络错误',
  },
};

export default function InitPage() {
  const router = useRouter();
  const [step, setStep] = useState<'welcome' | 'admin' | 'complete'>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locale, setLocale] = useState<'en' | 'zh'>('en');
  
  // 表单数据
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 从浏览器获取语言偏好
  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) {
      setLocale('zh');
    }
  }, []);

  const t = translations[locale];

  // 检查是否需要初始化
  useEffect(() => {
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (!data.needed) {
          // 已经初始化过，跳转到首页
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const handleCreateAdmin = async () => {
    setError('');
    
    // 验证
    if (!adminEmail || !adminName || !adminPassword) {
      setError(t.fillAllFields);
      return;
    }
    if (adminPassword !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    // 密码强度要求：至少 8 位，包含数字和字母（与后端一致）
    const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!PASSWORD_REGEX.test(adminPassword)) {
      setError(t.passwordTooShort);
      return;
    }

    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          name: adminName,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || t.createFailed);
        return;
      }
      
      setStep('complete');
    } catch (err) {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToApp = () => {
    router.push('/');
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--primary)' }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
              {t.welcomeTitle}
            </h1>
            <p className="mt-2" style={{ color: 'var(--text-tertiary)' }}>
              {t.welcomeSubtitle}
            </p>
          </div>
          
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start gap-3 mb-4">
              <Database className="w-5 h-5 mt-0.5" style={{ color: 'var(--primary)' }} />
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.databaseConfig}
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t.databaseDesc}
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 mb-6">
              <AlertTriangle className="w-5 h-5 mt-0.5" style={{ color: 'var(--warning)' }} />
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.initializeNow}
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t.initializeDesc}
                </p>
              </div>
            </div>
            
            <Button className="w-full" onClick={() => setStep('admin')}>
              {t.getStarted}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
              {t.createAdminTitle}
            </h1>
            <p className="mt-2" style={{ color: 'var(--text-tertiary)' }}>
              {t.createAdminSubtitle}
            </p>
          </div>
          
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  {t.name}
                </label>
                <Input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder={t.namePlaceholder}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  {t.email}
                </label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  {t.password}
                </label>
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  {t.confirmPassword}
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.confirmPasswordPlaceholder}
                />
              </div>
              
              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  {error}
                </div>
              )}
            </div>
            
            <Button 
              className="w-full mt-6" 
              onClick={handleCreateAdmin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.creating}
                </>
              ) : (
                t.createAdminButton
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // step === 'complete'
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
          <Shield className="w-8 h-8" style={{ color: '#22c55e' }} />
        </div>
        
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          {t.setupComplete}
        </h1>
        <p className="mt-2 mb-6" style={{ color: 'var(--text-tertiary)' }}>
          {t.setupCompleteDesc}
        </p>
        
        <Button onClick={handleGoToApp}>
          {t.goToLogin}
        </Button>
      </div>
    </div>
  );
}
