'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, ...props }, ref) => {
    return (
      <label className={clsx('relative inline-flex items-center cursor-pointer', className)}>
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          {...props}
        />
        <div className="w-11 h-6 rounded-full transition-colors duration-200 peer-checked:bg-primary-500 peer-focus:ring-2 peer-focus:ring-primary-500/30"
          style={{ background: checked ? 'var(--brand)' : 'var(--border)' }}
        />
        <span
          className={clsx(
            'absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
            checked && 'translate-x-5'
          )}
        />
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
