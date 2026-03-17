'use client';

import { useUIStore } from '@/domains/ui';
import ChatPanel from './ChatPanel';
import clsx from 'clsx';

export default function ChatDrawer() {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const setChatOpen = useUIStore((s) => s.setChatOpen);

  return (
    <>
      {chatOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setChatOpen(false)}
        />
      )}
      <div
        className={clsx(
          'fixed right-0 top-0 h-full z-50 transition-transform duration-300 ease-out shadow-float',
          chatOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{
          width: '480px',
          maxWidth: '100vw',
          background: 'var(--surface)',
        }}
      >
        {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      </div>
    </>
  );
}
