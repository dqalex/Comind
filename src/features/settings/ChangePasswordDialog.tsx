'use client';

import { useState } from 'react';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 密码强度验证：至少8位，包含字母和数字
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    // 验证
    if (newPassword !== confirmPassword) {
      setError(t('changePassword.passwordMismatch'));
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setError(t('changePassword.passwordTooShort'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 成功，关闭弹窗并重置表单
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onOpenChange(false);
      } else {
        setError(data.error || t('changePassword.error'));
      }
    } catch {
      setError(t('changePassword.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary-500" />
            <DialogTitle>{t('changePassword.title')}</DialogTitle>
          </div>
          <DialogDescription>{t('changePassword.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 当前密码 */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              {t('changePassword.currentPassword')}
            </label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('changePassword.currentPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showCurrent ? t('changePassword.hidePassword') : t('changePassword.showPassword')}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              {t('changePassword.newPassword')}
            </label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('changePassword.newPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showNew ? t('changePassword.hidePassword') : t('changePassword.showPassword')}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 确认新密码 */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              {t('changePassword.confirmPassword')}
            </label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('changePassword.confirmPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showConfirm ? t('changePassword.hidePassword') : t('changePassword.showPassword')}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          >
            {loading ? t('changePassword.changing') : t('changePassword.changeButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
