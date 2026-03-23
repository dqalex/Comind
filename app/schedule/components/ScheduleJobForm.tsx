'use client';

import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Textarea } from '@/shared/ui';
import { FileText } from 'lucide-react';
import type { GatewayAgentRow } from '@/types';
import type { ScheduleFormData, ScheduleKind, PayloadKind, DeliveryMode } from '../hooks/useSchedulePage';

interface ScheduleJobFormProps {
  form: ScheduleFormData;
  setForm: (form: ScheduleFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  title: string;
  submitLabel: string;
  agentsList: GatewayAgentRow[];
  documents: { id: string; title: string }[];
}

export default function ScheduleJobForm({
  form, setForm, onSubmit, onCancel,
  title, submitLabel, agentsList, documents,
}: ScheduleJobFormProps) {
  const { t } = useTranslation();

  const updateField = <K extends keyof ScheduleFormData>(key: K, value: ScheduleFormData[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="rounded-2xl p-6 w-full max-w-lg shadow-float max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
        <h3 className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <div className="space-y-4">
          {/* 名称 */}
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.taskName')} *</label>
            <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder={t('scheduler.taskNamePlaceholder')} autoFocus />
          </div>

          {/* Agent 选择 */}
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.execAgent')}</label>
            <Select value={form.agentId} onChange={e => updateField('agentId', e.target.value)}>
              <option value="">{t('scheduler.defaultAgent')}</option>
              {agentsList.map(a => (
                <option key={a.id} value={a.id}>
                  {a.identity?.emoji ? `${a.identity.emoji} ` : ''}{a.identity?.name || a.name || a.id}
                </option>
              ))}
            </Select>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.execAgentHint')}</p>
          </div>

          {/* 调度配置 */}
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.scheduleMode')}</label>
            <div className="flex gap-2 mb-2">
              {(['every', 'cron'] as const).map(kind => (
                <Button key={kind} size="sm" variant={form.scheduleKind === kind ? 'primary' : 'secondary'} className="flex-1"
                  onClick={() => updateField('scheduleKind', kind)}>
                  {kind === 'every' ? t('scheduler.intervalMode') : t('scheduler.cronMode')}
                </Button>
              ))}
            </div>
            {form.scheduleKind === 'every' && (
              <div className="flex items-center gap-2">
                <Input type="number" value={form.everySeconds} onChange={e => updateField('everySeconds', e.target.value)} className="flex-1" placeholder="60" />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.seconds')}</span>
              </div>
            )}
            {form.scheduleKind === 'cron' && (
              <div className="space-y-2">
                <Input value={form.expr} onChange={e => updateField('expr', e.target.value)} placeholder="0 8 * * *" />
                <Input value={form.tz} onChange={e => updateField('tz', e.target.value)} className="text-xs" placeholder={t('scheduler.timezonePlaceholder')} />
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.cronHelp')}</p>
              </div>
            )}
          </div>

          {/* Session 目标 & Wake 模式 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.sessionTarget')}</label>
              <Select value={form.sessionTarget} onChange={e => updateField('sessionTarget', e.target.value as 'main' | 'isolated')}>
                <option value="main">{t('scheduler.mainSession')}</option>
                <option value="isolated">{t('scheduler.isolatedSession')}</option>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.wakeMode')}</label>
              <Select value={form.wakeMode} onChange={e => updateField('wakeMode', e.target.value as 'now' | 'next-heartbeat')}>
                <option value="now">{t('scheduler.wakeModeNow')}</option>
                <option value="next-heartbeat">{t('scheduler.wakeModeHeartbeat')}</option>
              </Select>
            </div>
          </div>

          {/* Payload */}
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.payload')} {t('scheduler.status')}</label>
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant={form.payloadKind === 'agentTurn' ? 'primary' : 'secondary'} className="flex-1"
                onClick={() => updateField('payloadKind', 'agentTurn')}>
                {t('scheduler.agentTurn')}
              </Button>
              <Button size="sm" variant={form.payloadKind === 'systemEvent' ? 'primary' : 'secondary'} className="flex-1"
                onClick={() => updateField('payloadKind', 'systemEvent')}>
                {t('scheduler.systemEvent')}
              </Button>
            </div>
            {form.payloadKind === 'agentTurn' ? (
              <div className="space-y-2">
                <Textarea value={form.payloadMessage} onChange={e => updateField('payloadMessage', e.target.value)}
                  className="text-sm resize-none" rows={3} placeholder={t('scheduler.agentInstructions')} />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.insertDocRef')}</span>
                  {documents.slice(0, 8).map(doc => (
                    <button key={doc.id} type="button"
                      onClick={() => updateField('payloadMessage', form.payloadMessage + ` [[${doc.title}]]`)}
                      className="text-[10px] px-1.5 py-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 transition-colors truncate max-w-[120px]"
                      style={{ background: 'var(--surface-hover)' }}
                    >
                      <FileText className="w-2.5 h-2.5 inline mr-0.5" />{doc.title}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.thinking')}:</span>
                    <Select value={form.payloadThinking} onChange={e => updateField('payloadThinking', e.target.value)} className="w-24 text-xs py-0.5">
                      <option value="off">off</option>
                      <option value="minimal">minimal</option>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="xhigh">xhigh</option>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.timeout')}:</span>
                    <Input type="number" value={form.payloadTimeoutSeconds} onChange={e => updateField('payloadTimeoutSeconds', e.target.value)}
                      className="w-16 text-xs py-0.5" /> <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>s</span>
                  </div>
                </div>
              </div>
            ) : (
              <Textarea value={form.payloadText} onChange={e => updateField('payloadText', e.target.value)}
                className="text-sm resize-none" rows={3} placeholder={t('scheduler.systemContent')} />
            )}
          </div>

          {/* 投递模式 */}
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.deliveryMode')}</label>
            <Select value={form.deliveryMode} onChange={e => updateField('deliveryMode', e.target.value as DeliveryMode)}>
              <option value="announce">announce</option>
              <option value="webhook">webhook</option>
              <option value="none">none</option>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button size="sm" variant="secondary" onClick={onCancel}>{t('scheduler.cancel')}</Button>
          <Button size="sm" disabled={!form.name.trim()} className="disabled:opacity-50" onClick={onSubmit}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  );
}
