'use client';

/**
 * 消息气泡组件
 * 
 * 从 ChatPanel.tsx 提取的 memo 组件：
 * - MessageBubble: 本地会话消息气泡
 * - GwMessageBubble: Gateway 会话消息气泡
 */

import { memo } from 'react';
import { Bot, User, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import type { ChatMessage } from '@/domains/chat';
import ChatMarkdown, { extractThinking } from './ChatMarkdownLazy';
import { normalizeContent } from './chat-utils';

export const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const content = typeof message.content === 'string' ? message.content : normalizeContent(message.content);

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
          {content || JSON.stringify(message.content)}
        </span>
      </div>
    );
  }

  // For AI messages, extract thinking content
  const { thinking, body } = isUser ? { thinking: null, body: content } : extractThinking(content);

  return (
    <div className={clsx('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
        isUser ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' : 'member-ai'
      )}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser ? 'rounded-tr-md' : 'rounded-tl-md'
        )}
        style={{
          background: isUser ? 'var(--user-bubble)' : 'var(--surface-hover)',
          color: isUser ? 'var(--user-bubble-text)' : 'var(--text-primary)',
        }}
      >
        {message.status === 'sending' && !message.content ? (
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : isUser ? (
          <div className="whitespace-pre-wrap break-words">{body}</div>
        ) : (
          <ChatMarkdown content={body} />
        )}
        {message.status === 'error' && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" /> 发送失败
          </div>
        )}
      </div>
    </div>
  );
});

export const GwMessageBubble = memo(function GwMessageBubble({ role, content }: { role: string; content: unknown }) {
  const isUser = role === 'user';
  const normalizedContent = typeof content === 'string' ? content : normalizeContent(content);
  const { thinking, body } = isUser ? { thinking: null, body: normalizedContent } : extractThinking(normalizedContent);
  
  return (
    <div className={clsx('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
        isUser ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' : 'member-ai'
      )}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser ? 'rounded-tr-md' : 'rounded-tl-md'
        )}
        style={{
          background: isUser ? 'var(--user-bubble)' : 'var(--surface-hover)',
          color: isUser ? 'var(--user-bubble-text)' : 'var(--text-primary)',
        }}
      >
        {!content ? (
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : isUser ? (
          <div className="whitespace-pre-wrap break-words">{body}</div>
        ) : (
          <ChatMarkdown content={body} />
        )}
      </div>
    </div>
  );
});
