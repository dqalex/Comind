'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import clsx from 'clsx';
import { useClickOutside } from '@/hooks/useClickOutside';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, children, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, useCallback(() => setOpen(false), []));

  return (
    <div ref={ref} className="relative">
      <span onClick={() => setOpen(!open)}>{trigger}</span>
      {open && (
        <div
          className={clsx(
            'absolute top-full mt-1.5 min-w-[160px] rounded-2xl shadow-float border z-50 py-1.5 animate-fadeIn',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function DropdownItem({ children, onClick, danger, disabled, icon, className }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-all duration-200 rounded-lg mx-0',
        danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
      style={!danger ? { color: 'var(--text-secondary)' } : undefined}
    >
      {icon}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="h-px my-1 mx-2" style={{ background: 'var(--border)' }} />;
}
