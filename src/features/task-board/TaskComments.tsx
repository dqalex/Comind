'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMemberStore, useCommentStore } from '@/domains';
import { Textarea, Button } from '@/shared/ui';
import { Bot, User, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { formatRelativeTime } from '@/shared/hooks/useRelativeTime';

interface TaskCommentsProps {
  taskId: string;
  projectId?: string | null;
}

export default function TaskComments({ taskId, projectId }: TaskCommentsProps) {
  const { t, i18n } = useTranslation();
  
  const members = useMemberStore((s) => s.members);
  const comments = useCommentStore((s) => s.comments);
  const fetchCommentsByTask = useCommentStore((s) => s.fetchCommentsByTask);
  
  const [newComment, setNewComment] = useState('');
  const submitByEnterRef = useRef(false);
  
  // 组件挂载时加载评论
  useEffect(() => {
    fetchCommentsByTask(taskId);
  }, [taskId, fetchCommentsByTask]);
  
  // 当前任务的评论
  const taskComments = useMemo(() =>
    comments.filter(c => c.taskId === taskId).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ), [comments, taskId]);
  
  // 当前人类用户
  const currentUser = useMemo(() =>
    members.find(m => m.type === 'human'),
    [members]
  );
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    submitByEnterRef.current = true;
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          authorId: currentUser?.id || 'system',
          content: newComment.trim()
        }),
      });
      fetchCommentsByTask(taskId);
      setNewComment('');
    } catch {
      // ignore
    }
    submitByEnterRef.current = false;
  };
  
  return (
    <div className="space-y-3">
      {taskComments.length === 0 && (
        <div className="text-center py-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('tasks.noComments')}
        </div>
      )}
      
      {taskComments.map(comment => {
        const member = members.find(m => m.id === comment.memberId);
        return (
          <div key={comment.id} className="flex gap-2.5">
            <div className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
              member?.type === 'ai' ? 'member-ai' : 'bg-primary-100 text-primary-600 dark:bg-primary-900'
            )}>
              {member?.type === 'ai' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {member?.name || t('tasks.unknown')}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {formatRelativeTime(comment.createdAt, i18n.language)}
                </span>
              </div>
              <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {comment.content}
              </p>
            </div>
          </div>
        );
      })}
      
      {/* 新增评论 */}
      <div className="flex items-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <Textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddComment();
            }
          }}
          placeholder={t('tasks.writeComment')}
          rows={2}
          className="text-sm flex-1 resize-none"
        />
        <button
          onClick={handleAddComment}
          disabled={!newComment.trim()}
          className="p-2 rounded-lg transition-colors disabled:opacity-30"
          style={{ background: 'var(--ai)' }}
        >
          <MessageSquare className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
