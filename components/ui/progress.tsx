import { forwardRef, type HTMLAttributes } from 'react';
import clsx from 'clsx';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, showLabel = false, size = 'sm', ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div className={clsx('w-full', className)} {...props}>
        <div
          ref={ref}
          className={clsx('w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden', {
            'h-1.5': size === 'sm',
            'h-2.5': size === 'md',
          })}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ background: 'var(--gradient-brand)', width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <div className="text-xs mt-1 text-right" style={{ color: 'var(--text-tertiary)' }}>
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };
