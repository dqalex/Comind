'use client';

import { useMemo } from 'react';
import type { ChatSession } from '@/domains/chat';
import { X, Plus, Trash2, Bot, MessageSquare, Wifi } from 'lucide-react';
import clsx from 'clsx';

interface Member {
  id: string;
  name: string;
  type: string;
}

interface ChatSessionListProps {
  sessions: ChatSession[];
  members: Member[];
  selectedMemberId: string | null;
  gwConnected: boolean;
  onSelectMember: (id: string | null) => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onNewSession: () => void;
  onClose: () => void;
}

/**
 * 会话列表视图
 * 
 * 从 ChatPanel 提取的独立视图组件：
 * - AI 成员筛选
 * - 会话列表
 * - 新建对话按钮
 */
export default function ChatSessionList({
  sessions,
  members,
  selectedMemberId,
  gwConnected,
  onSelectMember,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  onClose,
}: ChatSessionListProps) {
  const aiMembers = useMemo(() => members.filter(m => m.type === 'ai'), [members]);

  const filteredSessions = useMemo(() => {
    if (!selectedMemberId) return sessions;
    return sessions.filter(s => s.memberId === selectedMemberId);
  }, [sessions, selectedMemberId]);

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: 'var(--ai)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>AI 对话</span>
          {gwConnected && (
            <span className="tag text-[10px] bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400 flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5" /> Gateway
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
          <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      {/* AI 成员选择 */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onSelectMember(null)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              !selectedMemberId
                ? 'bg-primary-500 text-white'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            )}
            style={selectedMemberId ? { color: 'var(--text-secondary)' } : undefined}
          >
            全部
          </button>
          {aiMembers.map(m => (
            <button
              key={m.id}
              onClick={() => onSelectMember(m.id)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                selectedMemberId === m.id
                  ? 'bg-primary-500 text-white'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              )}
              style={selectedMemberId !== m.id ? { color: 'var(--text-secondary)' } : undefined}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <MessageSquare className="w-10 h-10 mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>暂无对话</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>点击下方按钮开始新对话</p>
          </div>
        ) : (
          <div className="py-2">
            {filteredSessions.map(session => {
              const member = members.find(m => m.id === session.memberId);
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className="mx-2 px-3 py-3 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 member-ai">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {session.title}
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {member?.name || '未知'} · {session.messages.length} 条消息
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => onDeleteSession(session.id, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                  {session.entity && (
                    <div className="mt-1.5 ml-10">
                      <span className="tag text-[10px] bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
                        {session.entity.type === 'task' ? '任务' : session.entity.type === 'project' ? '项目' : '定时任务'}: {session.entity.title}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 新建对话 */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onNewSession}
          disabled={aiMembers.length === 0}
          className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          style={{ background: 'var(--ai)', color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>
    </div>
  );
}
