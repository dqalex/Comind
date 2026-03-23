'use client';

import { memo } from 'react';
import type { ChatMessage } from '@/domains/chat';
import { MessageBubble, GwMessageBubble } from './MessageBubble';
import { Loader2, MessageSquare, Bot, ArrowDown } from 'lucide-react';

interface ChatMessageListProps {
  /** 本地会话消息（与 gwMessages 二选一） */
  messages?: ChatMessage[];
  /** Gateway 会话消息（与 messages 二选一） */
  gwMessages?: { role: string; content: unknown }[];
  /** 是否正在加载历史 */
  loading?: boolean;
  /** 空状态文本 */
  emptyText?: string;
  /** 空状态副文本 */
  emptySubText?: string;
  /** 滚动事件回调 */
  onScroll?: () => void;
  /** 滚动容器 ref */
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  /** 消息末尾占位 ref（用于 scrollIntoView） */
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  /** 是否显示"滚到底部"按钮 */
  showScrollBtn?: boolean;
  /** 滚到底部回调 */
  onScrollToBottom?: () => void;
}

/**
 * 统一的消息列表组件
 * 
 * 支持两种消息格式：
 * - 本地会话（ChatMessage[]）→ 使用 MessageBubble
 * - Gateway 会话（{role, content}[]）→ 使用 GwMessageBubble
 * 
 * 使用 React.memo 优化渲染性能，避免父组件状态变更导致不必要的重渲染
 */
function ChatMessageListInner({
  messages,
  gwMessages,
  loading,
  emptyText = '暂无对话记录',
  emptySubText,
  onScroll,
  scrollContainerRef,
  messagesEndRef,
  showScrollBtn,
  onScrollToBottom,
}: ChatMessageListProps) {
  const hasMessages = messages ? messages.length > 0 : (gwMessages?.length ?? 0) > 0;

  return (
    <>
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            <span className="ml-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>加载对话历史...</span>
          </div>
        ) : !hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            {messages ? (
              <Bot className="w-10 h-10 mb-3" style={{ color: 'var(--ai)' }} />
            ) : (
              <MessageSquare className="w-10 h-10 mb-3" style={{ color: 'var(--text-tertiary)' }} />
            )}
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</p>
            {emptySubText && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{emptySubText}</p>
            )}
          </div>
        ) : (
          <>
            {messages?.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {gwMessages?.map((msg, idx) => (
              <GwMessageBubble key={idx} role={msg.role} content={msg.content} />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 滚到底部按钮 */}
      {showScrollBtn && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-24 right-6 w-8 h-8 rounded-full shadow-float flex items-center justify-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <ArrowDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      )}
    </>
  );
}

// 使用 memo 包装，避免父组件状态变更导致不必要的重渲染
const ChatMessageList = memo(ChatMessageListInner);

export default ChatMessageList;
