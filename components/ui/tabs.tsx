'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within Tabs');
  return ctx;
}

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const currentValue = value ?? uncontrolledValue;
  const handleChange = onValueChange ?? setUncontrolledValue;

  return (
    <TabsContext.Provider value={{ value: currentValue, onChange: handleChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div className={clsx('flex gap-1 p-1 rounded-xl', className)} style={{ background: 'var(--surface-hover)' }}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: selectedValue, onChange } = useTabs();
  const isSelected = selectedValue === value;

  return (
    <button
      onClick={() => onChange(value)}
      className={clsx(
        'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200',
        isSelected
          ? 'bg-white dark:bg-slate-700/80 shadow-sm'
          : 'hover:bg-white/50 dark:hover:bg-slate-700/40',
        className
      )}
      style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selectedValue } = useTabs();
  if (selectedValue !== value) return null;
  return <div className={clsx('animate-fadeIn', className)}>{children}</div>;
}
