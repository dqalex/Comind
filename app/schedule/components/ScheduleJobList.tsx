'use client';

import { useTranslation } from 'react-i18next';
import {
  Clock, Trash2, Play, Power, ChevronDown,
  Timer, History, CheckCircle, XCircle,
  Bot, Pencil, FileText,
} from 'lucide-react';
import clsx from 'clsx';
import { Button, Badge } from '@/shared/ui';
import type { CronJob, CronRunLogEntry } from '@/types';
import { formatSchedule, formatPayload, formatTime, formatDate } from '../hooks/useSchedulePage';
import ScheduleRunHistory from './ScheduleRunHistory';

interface ScheduleJobListProps {
  cronJobs: CronJob[];
  cronRuns: Record<string, CronRunLogEntry[]>;
  agentsList: { id: string; name?: string; identity?: { name?: string; emoji?: string } }[];
  documents: { id: string; title: string }[];
  expandedJobId: string | null;
  showRunsJobId: string | null;
  onToggleExpand: (jobId: string) => void;
  onToggleRuns: (jobId: string) => void;
  onToggleJob: (jobId: string, enabled: boolean) => void;
  onRunJob: (jobId: string) => void;
  onEditJob: (job: CronJob) => void;
  onRequestDelete: (jobId: string) => void;
}

export default function ScheduleJobList({
  cronJobs, cronRuns, agentsList, documents,
  expandedJobId, showRunsJobId,
  onToggleExpand, onToggleRuns, onToggleJob, onRunJob, onEditJob, onRequestDelete,
}: ScheduleJobListProps) {
  const { t } = useTranslation();

  if (cronJobs.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Clock className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
        <p style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.noJobs')}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.noJobsHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cronJobs.map(job => {
        const isExpanded = expandedJobId === job.id;
        const runs = cronRuns[job.id] || [];
        const isShowingRuns = showRunsJobId === job.id;
        return (
          <div key={job.id} className={clsx('card overflow-hidden border-l-4', job.enabled ? 'border-l-blue-500' : 'border-l-slate-300 opacity-80')}>
            {/* 折叠头部 */}
            <div
              className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              onClick={() => onToggleExpand(job.id)}
            >
              <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', job.enabled ? 'bg-green-500' : 'bg-slate-300')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{job.name}</span>
                  {!job.enabled && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">{t('scheduler.disabledLabel')}</span>
                  )}
                  {job.agentId && (
                    <Badge className="text-[10px] bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center gap-0.5">
                      <Bot className="w-2.5 h-2.5" />
                      {agentsList.find(a => a.id === job.agentId)?.identity?.name || agentsList.find(a => a.id === job.agentId)?.name || job.agentId}
                    </Badge>
                  )}
                  <Badge className="text-[10px] bg-slate-100 dark:bg-slate-800" style={{ color: 'var(--text-tertiary)' }}>
                    <Timer className="w-2.5 h-2.5" />
                    {formatSchedule(job.schedule, t)}
                  </Badge>
                  <Badge className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    {job.sessionKey || job.sessionTarget}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{formatPayload(job.payload)}</span>
                  {job.state?.lastStatus && (
                    <span className={clsx(job.state.lastStatus === 'ok' ? 'text-green-500' : 'text-red-400')}>
                      {t('scheduler.lastRun')}: {job.state.lastStatus}
                    </span>
                  )}
                  {job.state?.nextRunAtMs != null && job.state.nextRunAtMs > 0 && (
                    <span>{t('scheduler.nextRun')}: {formatTime(job.state.nextRunAtMs)}</span>
                  )}
                </div>
              </div>
              <ChevronDown className={clsx('w-4 h-4 transition-transform flex-shrink-0', isExpanded && 'rotate-180')} style={{ color: 'var(--text-tertiary)' }} />
            </div>

            {/* 展开详情 */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-0 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
                {/* 详细信息 */}
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.wakeMode')}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{job.wakeMode || 'now'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.deliveryMode')}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{job.delivery?.mode || 'none'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.payload')} Type</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{job.payload.kind}</div>
                  </div>
                  {job.payload.timeoutSeconds && (
                    <div>
                      <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.timeout')}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{job.payload.timeoutSeconds}s</div>
                    </div>
                  )}
                  {job.payload.thinking && (
                    <div>
                      <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.thinking')}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{job.payload.thinking}</div>
                    </div>
                  )}
                  {job.createdAtMs && (
                    <div>
                      <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.createdAt')}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{formatDate(job.createdAtMs)}</div>
                    </div>
                  )}
                </div>

                {/* 关联文档引用 */}
                <LinkedDocRefs job={job} documents={documents} />

                {/* 状态信息 */}
                {job.state && <JobStateInfo job={job} />}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={job.enabled ? 'secondary' : 'primary'} className="flex items-center gap-1"
                    onClick={() => onToggleJob(job.id, !job.enabled)}>
                    <Power className="w-3.5 h-3.5" /> {job.enabled ? t('scheduler.disabled') : t('scheduler.enabled')}
                  </Button>
                  <Button size="sm" variant="secondary" className="flex items-center gap-1"
                    onClick={() => onEditJob(job)}>
                    <Pencil className="w-3.5 h-3.5" /> {t('common.edit')}
                  </Button>
                  <Button size="sm" variant="secondary" className="flex items-center gap-1"
                    onClick={() => onRunJob(job.id)}>
                    <Play className="w-3.5 h-3.5" /> {t('scheduler.runNow')}
                  </Button>
                  <Button size="sm" variant="secondary" className="flex items-center gap-1"
                    onClick={() => onToggleRuns(job.id)}>
                    <History className="w-3.5 h-3.5" /> {t('scheduler.runHistory')}
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="danger" className="flex items-center gap-1"
                    onClick={() => onRequestDelete(job.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                  </Button>
                </div>

                {/* 执行历史 */}
                {isShowingRuns && <ScheduleRunHistory runs={runs} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- 子组件：关联文档引用 ---
function LinkedDocRefs({ job, documents }: { job: CronJob; documents: { id: string; title: string }[] }) {
  const { t } = useTranslation();
  const msg = job.payload.message || job.payload.text || '';
  const refs = [...msg.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
  if (refs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.linkedDocs')}:</span>
      {refs.map((title, i) => {
        const doc = documents.find(d => d.title === title);
        return doc ? (
          <a key={i} href={`/wiki?doc=${doc.id}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
            style={{ background: 'var(--surface-hover)' }}>
            <FileText className="w-3 h-3" /> {title}
          </a>
        ) : (
          <span key={i} className="px-2 py-0.5 rounded" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
            {title}
          </span>
        );
      })}
    </div>
  );
}

// --- 子组件：任务状态信息 ---
function JobStateInfo({ job }: { job: CronJob }) {
  const { t } = useTranslation();
  if (!job.state) return null;

  return (
    <div className="flex items-center gap-4 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
      {job.state.lastStatus && (
        <span className="flex items-center gap-1">
          {job.state.lastStatus === 'ok' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
          {t('scheduler.lastRun')}: {job.state.lastStatus}
        </span>
      )}
      {job.state.lastDurationMs != null && (
        <span style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.duration')} {(job.state.lastDurationMs / 1000).toFixed(1)}s</span>
      )}
      {job.state.consecutiveErrors != null && job.state.consecutiveErrors > 0 && (
        <span className="text-red-400">{t('scheduler.consecutiveErrors', { count: job.state.consecutiveErrors })}</span>
      )}
      {job.state.lastError && (
        <span className="text-red-400 truncate flex-1">{job.state.lastError}</span>
      )}
    </div>
  );
}
