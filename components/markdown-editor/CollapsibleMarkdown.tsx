/**
 * 可折叠 Markdown 渲染组件
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import MarkdownContent from './MarkdownContent';

interface CollapsibleMarkdownProps {
  content: string;
  className?: string;
}

export default function CollapsibleMarkdown({ content, className }: CollapsibleMarkdownProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={clsx('border rounded-lg overflow-hidden', className)} style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span>预览</span>
      </button>
      {isOpen && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <MarkdownContent content={content} />
        </div>
      )}
    </div>
  );
}
