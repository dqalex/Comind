'use client';

import { memo } from 'react';
import clsx from 'clsx';
import type { FrontmatterBadgesProps } from './types';

// 特殊字段样式映射
const fieldStyles: Record<string, string> = {
  title: 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 font-medium',
  type: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  project: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  tags: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  version: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  status: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  priority: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};
const defaultStyle = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

/**
 * Frontmatter 标签渲染组件
 * 将 YAML 元数据以标签（badge）样式展示
 */
function FrontmatterBadges({ meta }: FrontmatterBadgesProps) {
  // title 单独一行显示
  const title = meta.title;
  const restEntries = Object.entries(meta).filter(([k]) => k !== 'title');

  return (
    <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
      {title && (
        <div className="mb-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {restEntries.map(([key, value]) => {
          // tags 字段特殊处理：拆分为多个标签
          if (key === 'tags') {
            const tagValues = value.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
            return tagValues.map(tag => (
              <span
                key={`tag-${tag}`}
                className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]', fieldStyles.tags)}
              >
                <span className="opacity-60">#</span>
                {tag}
              </span>
            ));
          }
          return (
            <span
              key={key}
              className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]', fieldStyles[key] || defaultStyle)}
            >
              <span className="opacity-60">{key}:</span>
              {value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default memo(FrontmatterBadges);
