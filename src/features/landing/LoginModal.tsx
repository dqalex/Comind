'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TeamClawLogo } from '@/components/Logo';
import { useAuthStore } from '@/domains';
import { useRouter } from 'next/navigation';

// i18n 翻译
const translations = {
  en: {
    welcomeBack: 'Welcome Back',
    createAccount: 'Create Account',
    signInSubtitle: 'Sign in to access your AI team',
    registerSubtitle: 'Join TeamClaw to build your AI workforce',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    signIn: 'Sign In',
    signUp: 'Sign up',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    loginFailed: 'Login failed',
    registerFailed: 'Registration failed',
    errorOccurred: 'An error occurred',
  },
  zh: {
    welcomeBack: '欢迎回来',
    createAccount: '创建账户',
    signInSubtitle: '登录以访问您的 AI 团队',
    registerSubtitle: '加入 TeamClaw，构建您的 AI 工作团队',
    name: '姓名',
    namePlaceholder: '您的姓名',
    email: '邮箱',
    emailPlaceholder: 'you@example.com',
    password: '密码',
    passwordPlaceholder: '••••••••',
    signIn: '登录',
    signUp: '注册',
    noAccount: '还没有账户？',
    hasAccount: '已有账户？',
    loginFailed: '登录失败',
    registerFailed: '注册失败',
    errorOccurred: '发生错误',
  },
};

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  locale?: 'en' | 'zh';
}

export function LoginModal({ isOpen, onClose, onSuccess, locale = 'en' }: LoginModalProps) {
  const t = translations[locale];
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);

  // 登录成功后关闭弹窗并回调
  // 注意：只应在用户完成登录操作后触发，不应在已登录用户访问页面时触发
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  useEffect(() => {
    if (isAuthenticated && justLoggedIn) {
      onClose();
      onSuccess?.();
      setJustLoggedIn(false);
    }
  }, [isAuthenticated, justLoggedIn, onClose, onSuccess]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t.loginFailed);
          setLoading(false);
          return;
        }
        await fetchCurrentUser();
        setJustLoggedIn(true);
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t.registerFailed);
          setLoading(false);
          return;
        }
        await fetchCurrentUser();
        setJustLoggedIn(true);
      }
    } catch (err) {
      setError(t.errorOccurred);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景虚化遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* 弹窗主体 */}
      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        <div className="rounded-2xl border border-white/10 bg-[#0B1121]/95 backdrop-blur-xl shadow-2xl p-8">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <TeamClawLogo className="w-10 h-10" />
            </div>
          </div>

          {/* 标题 */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              {mode === 'login' ? t.welcomeBack : t.createAccount}
            </h2>
            <p className="text-sm text-slate-400">
              {mode === 'login' ? t.signInSubtitle : t.registerSubtitle}
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.name}</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-[#0056ff] focus:ring-[#0056ff]/20"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.email}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-[#0056ff] focus:ring-[#0056ff]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.password}</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  required
                  minLength={6}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-[#0056ff] focus:ring-[#0056ff]/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0056ff] hover:bg-[#0046cc] text-white font-medium h-11 rounded-lg shadow-[0_0_20px_rgba(0,86,255,0.3)]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'login' ? (
                t.signIn
              ) : (
                t.createAccount
              )}
            </Button>
          </form>

          {/* 切换登录/注册 */}
          <div className="mt-6 text-center text-sm text-slate-400">
            {mode === 'login' ? (
              <>
                {t.noAccount}{' '}
                <button
                  onClick={() => { setMode('register'); setError(''); }}
                  className="text-[#0056ff] hover:underline font-medium"
                >
                  {t.signUp}
                </button>
              </>
            ) : (
              <>
                {t.hasAccount}{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); }}
                  className="text-[#0056ff] hover:underline font-medium"
                >
                  {t.signIn}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
