'use client';

import { ChatFab, ChatDrawer } from '@/features/chat-panel';
import { useAuthStore } from '@/domains';

export default function ChatOverlay() {
  const user = useAuthStore((s) => s.user);
  
  // 未登录时不显示聊天浮层
  if (!user) {
    return null;
  }

  return (
    <>
      <ChatFab />
      <ChatDrawer />
    </>
  );
}
