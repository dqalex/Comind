'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskLogStore } from '@/domains';
import { Clock } from 'lucide-react';
import { formatRelativeTime } from '@/hooks/useRelativeTime';

interface TaskLogsProps {
  taskId: string;
}

export default function TaskLogs({ taskId }: TaskLogsProps) {
  const { t, i18n } = useTranslation();
  
  const logs = useTaskLogStore((s) => s.logs);
  
  // 当前任务的日志
  const taskLogs = useMemo(() =>
    logs.filter(l => l.taskId === taskId).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ), [logs, taskId]);
  
  return (
    <div className="space-y-2">
      {taskLogs.length === 0 && (
        <div className="text-center py-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('tasks.noLogs')}
        </div>
      )}
      
      {taskLogs.map(log => (
        <div key={log.id} className="flex items-start gap-2.5 text-xs">
          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <div className="flex-1">
            <span style={{ color: 'var(--text-secondary)' }}>{log.action}</span>
            {log.message && (
              <span className="ml-1" style={{ color: 'var(--text-tertiary)' }}>— {log.message}</span>
            )}
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {formatRelativeTime(log.timestamp, i18n.language)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
