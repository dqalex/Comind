'use client';

import { useTranslation } from 'react-i18next';
import type { Session } from '@/types';
import { useChatStore } from '@/domains/chat';
import { ExternalLink } from 'lucide-react';

interface SessionsPanelProps {
  sessions: Session[];
  allSessions: Session[];
  agentId: string;
}

export default function SessionsPanel({ sessions, allSessions }: SessionsPanelProps) {
  const { t } = useTranslation();
  const displaySessions = sessions.length > 0 ? sessions : allSessions;
  // 精确 selector 订阅
  const openChatWithSession = useChatStore((s) => s.openChatWithSession);

  return (
    <div className="max-w-2xl">
      <h3 className="section-title text-[11px] mb-3">
        {sessions.length > 0 ? t('agents.agentSessions', { count: sessions.length }) : t('agents.allSessions', { count: allSessions.length })}
      </h3>
      {displaySessions.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('agents.noSessions')}</div>
      ) : (
        <div className="space-y-1.5">
          {displaySessions.slice(0, 30).map(session => (
            <div
              key={session.key}
              onClick={() => openChatWithSession(session.key)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {session.displayName || session.derivedTitle || session.key}
                  </span>
                  {session.kind && (
                    <span className="tag text-[10px] bg-slate-100 dark:bg-slate-800" style={{ color: 'var(--text-tertiary)' }}>
                      {session.kind}
                    </span>
                  )}
                </div>
                <div className="text-[11px] flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="font-mono">{session.key}</span>
                  {session.channel && <span>· {session.channel}</span>}
                  {session.updatedAt && (
                    <span>· {new Date(session.updatedAt).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
                {session.lastMessagePreview && (
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {session.lastMessagePreview}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {session.totalTokens != null && (
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {(session.totalTokens / 1000).toFixed(1)}k tokens
                  </div>
                )}
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
