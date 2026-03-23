/**
 * 可复用的确认对话框组件
 * 用于删除、危险操作等需要二次确认的场景
 */
'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/shared/ui';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // 自动聚焦确认按钮，支持键盘导航
  useEffect(() => {
    if (isOpen) {
      // 延迟聚焦，确保 DOM 已渲染
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // 处理 ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const iconMap = {
    danger: <Trash2 className="w-6 h-6 text-red-500" />,
    warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
    info: <AlertTriangle className="w-6 h-6 text-blue-500" />,
  };

  const buttonColorMap = {
    danger: 'bg-red-500 hover:bg-red-600 focus:ring-red-500',
    warning: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500',
    info: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
        aria-hidden="true"
      />
      
      {/* 对话框内容 */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          aria-label="关闭"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 内容区域 */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* 图标 */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              {iconMap[variant]}
            </div>
            
            {/* 文字内容 */}
            <div className="flex-1 min-w-0">
              <h3 
                id="confirm-dialog-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {title}
              </h3>
              <p 
                id="confirm-dialog-message"
                className="mt-2 text-sm text-slate-600 dark:text-slate-400"
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* 按钮区域 */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                处理中...
              </span>
            ) : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
