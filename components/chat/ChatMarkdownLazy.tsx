'use client';

import dynamic from 'next/dynamic';

/**
 * ChatMarkdown 懒加载包装器
 * react-markdown + rehype-highlight + remark-gfm 约 200KB，
 * 使用 dynamic import 避免阻塞首屏渲染
 */
const ChatMarkdown = dynamic(
  () => import('./ChatMarkdown'),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse text-sm" style={{ color: 'var(--text-secondary)' }}>
        …
      </div>
    ),
  }
);

export default ChatMarkdown;

// 重新导出工具函数（这些是轻量的，不需要懒加载）
export { extractThinking } from './ChatMarkdown';
