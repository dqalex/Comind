import { useState, useCallback } from 'react';
import { useAuthStore } from '@/domains';

interface UseSecurityCodeOptions {
  onVerified: () => void | Promise<void>;
  onError?: (error: string) => void;
}

/**
 * 安全码验证 Hook
 * 用于敏感操作前的二次验证
 */
export function useSecurityCode(options: UseSecurityCodeOptions) {
  const [showDialog, setShowDialog] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const verify = useCallback(async () => {
    // 如果不是管理员或没有设置安全码，直接执行
    if (!isAdmin) {
      await options.onVerified();
      return;
    }
    
    // 检查是否需要安全码验证
    try {
      const res = await fetch('/api/users/verify-security-code', { method: 'GET' });
      const data = await res.json();
      
      if (!data.required) {
        // 没有设置安全码，直接执行
        await options.onVerified();
        return;
      }
      
      // 需要安全码验证，显示对话框
      setShowDialog(true);
    } catch (err) {
      console.error('[SecurityCode] Check failed:', err);
      options.onError?.('验证失败');
    }
  }, [isAdmin, options]);

  const submitCode = useCallback(async () => {
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/users/verify-security-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ securityCode: code }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.verified) {
        setError(data.error || '验证失败');
        return;
      }
      
      setShowDialog(false);
      setCode('');
      await options.onVerified();
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [code, options]);

  const cancel = useCallback(() => {
    setShowDialog(false);
    setCode('');
    setError('');
  }, []);

  return {
    showDialog,
    code,
    setCode,
    error,
    loading,
    verify,
    submitCode,
    cancel,
    isAdmin,
  };
}
