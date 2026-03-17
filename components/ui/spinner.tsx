import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader2
      className={clsx(
        'animate-spin',
        {
          'w-4 h-4': size === 'sm',
          'w-5 h-5': size === 'md',
          'w-8 h-8': size === 'lg',
        },
        className
      )}
      style={{ color: 'var(--text-tertiary)' }}
    />
  );
}

export interface LoadingProps {
  text?: string;
  className?: string;
}

export function Loading({ text = '加载中...', className }: LoadingProps) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-8', className)}>
      <Spinner />
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{text}</span>
    </div>
  );
}

export function LoadingOverlay({ text }: LoadingProps) {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card p-6 flex items-center gap-3">
        <Spinner />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text || '加载中...'}</span>
      </div>
    </div>
  );
}
