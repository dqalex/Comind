'use client';

import { useState, memo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { CollapsibleSectionProps } from './types';

function CollapsibleSection({ title, level, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const headingSize = {
    1: 'text-2xl',
    2: 'text-xl',
    3: 'text-lg',
    4: 'text-base',
    5: 'text-sm',
    6: 'text-xs',
  }[level] || 'text-base';

  return (
    <div className="md-collapsible">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-1 font-semibold hover:text-primary-500 transition-colors w-full text-left group'
        )}
        type="button"
        aria-expanded={isOpen}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <span className={headingSize}>{title}</span>
      </button>
      {isOpen && (
        <div className="ml-5 mt-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default memo(CollapsibleSection);
