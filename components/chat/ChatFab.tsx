'use client';

import { MessageSquare } from 'lucide-react';
import { useUIStore } from '@/domains/ui';
import { useMemberStore } from '@/domains/member';
import { useOpenClawStatusStore } from '@/core/gateway/openclaw.store';

export default function ChatFab() {
  const toggleChat = useUIStore((s) => s.toggleChat);
  const chatOpen = useUIStore((s) => s.chatOpen);
  const members = useMemberStore((s) => s.members);
  const statusList = useOpenClawStatusStore((s) => s.statusList);

  const aiMembers = members.filter((m) => m.type === 'ai');
  const onlineCount = statusList.filter(
    (s) => s.status === 'working' || s.status === 'idle'
  ).length;

  if (chatOpen) return null;

  return (
    <button
      onClick={toggleChat}
      className="fixed right-6 bottom-6 z-30 w-12 h-12 rounded-full flex items-center justify-center shadow-float transition-all duration-200 hover:scale-105 active:scale-95"
      style={{ background: 'var(--ai)' }}
      title="与 AI 对话"
    >
      <MessageSquare className="w-5 h-5 text-white" />
      {onlineCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2"
          style={{ borderColor: 'var(--surface)' }}
        >
          {onlineCount}
        </span>
      )}
    </button>
  );
}
