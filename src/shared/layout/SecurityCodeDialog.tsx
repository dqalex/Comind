'use client';

import { Button, Input } from '@/shared/ui';
import { Shield } from 'lucide-react';
import { useSecurityCode } from '@/shared/hooks/useSecurityCode';

interface SecurityCodeDialogProps {
  isOpen: boolean;
  securityCode: ReturnType<typeof useSecurityCode>;
  title?: string;
  description?: string;
}

/**
 * 可复用的安全码验证对话框
 * 配合 useSecurityCode hook 使用
 */
export function SecurityCodeDialog({ 
  isOpen, 
  securityCode,
  title = '安全验证',
  description = '请输入安全码以确认操作',
}: SecurityCodeDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="rounded-2xl p-6 w-80 shadow-float" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {description}
            </p>
          </div>
        </div>
        <div className="mb-4">
          <Input
            type="password"
            placeholder="安全码"
            value={securityCode.code}
            onChange={(e) => securityCode.setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && securityCode.submitCode()}
            autoFocus
          />
          {securityCode.error && (
            <p className="text-xs mt-2" style={{ color: '#ef4444' }}>
              {securityCode.error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={securityCode.cancel}>
            取消
          </Button>
          <Button 
            size="sm" 
            onClick={securityCode.submitCode} 
            disabled={securityCode.loading}
          >
            {securityCode.loading ? '验证中...' : '确认'}
          </Button>
        </div>
      </div>
    </div>
  );
}
