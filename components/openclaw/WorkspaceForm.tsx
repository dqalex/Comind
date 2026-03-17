'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpenClawWorkspace } from '@/db/schema';
import { useMemberStore } from '@/domains';
import { Button, Input, Switch } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Bot } from 'lucide-react';
import clsx from 'clsx';

interface WorkspaceFormProps {
  workspace?: OpenClawWorkspace;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    path: string;
    memberId?: string | null;
    isDefault?: boolean;
    syncEnabled?: boolean;
    watchEnabled?: boolean;
    syncInterval?: number;
    excludePatterns?: string[];
  }) => void;
}

export function WorkspaceForm({ workspace, onClose, onSubmit }: WorkspaceFormProps) {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const members = useMemberStore((s) => s.members);

  // 筛选 AI 成员
  const aiMembers = useMemo(
    () => members.filter(m => m.type === 'ai'),
    [members]
  );

  const [form, setForm] = useState({
    name: workspace?.name ?? '',
    path: workspace?.path ?? '',
    memberId: workspace?.memberId ?? '',
    isDefault: workspace?.isDefault ?? false,
    syncEnabled: workspace?.syncEnabled ?? true,
    watchEnabled: workspace?.watchEnabled ?? true,
    syncInterval: workspace?.syncInterval ?? 30,
    excludePatterns: (workspace?.excludePatterns || ['node_modules/**', '.git/**', 'temp/**']).join('\n'),
  });

  const nameInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.path) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        path: form.path,
        memberId: form.memberId || null,
        isDefault: form.isDefault,
        syncEnabled: form.syncEnabled,
        watchEnabled: form.watchEnabled,
        syncInterval: form.syncInterval,
        excludePatterns: form.excludePatterns.split('\n').filter(Boolean),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {workspace ? t('openclaw.editWorkspace') : t('openclaw.createWorkspace')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('openclaw.nameLabel')} *
            </label>
            <Input
              ref={nameInputRef}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('openclaw.namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('openclaw.pathLabel')} *
            </label>
            <Input
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder={t('openclaw.pathPlaceholder')}
              required
            />
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('openclaw.pathHint')}
            </p>
          </div>

          {/* 绑定 AI 成员 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('openclaw.bindMember')}
            </label>
            <select
              value={form.memberId}
              onChange={(e) => setForm({ ...form, memberId: e.target.value })}
              className={clsx(
                'w-full px-3 py-2 text-sm rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-primary-500'
              )}
              style={{
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">{t('openclaw.noneSelected')}</option>
              {aiMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.openclawAgentId ? `(${m.openclawAgentId})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('openclaw.enableSync')}</span>
              <Switch
                checked={form.syncEnabled}
                onChange={(e) => setForm({ ...form, syncEnabled: e.target.checked })}
              />
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('openclaw.enableWatch')}</span>
              <Switch
                checked={form.watchEnabled}
                onChange={(e) => setForm({ ...form, watchEnabled: e.target.checked })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('openclaw.setDefault')}</span>
            <Switch
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('openclaw.syncInterval')}
            </label>
            <Input
              type="number"
              value={form.syncInterval}
              onChange={(e) => setForm({ ...form, syncInterval: parseInt(e.target.value) || 30 })}
              min={1}
              max={1440}
            />
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('openclaw.syncIntervalHint')} {t('openclaw.syncIntervalRange')}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('openclaw.excludePatterns')}
            </label>
            <textarea
              className={clsx(
                'w-full min-h-[80px] px-3 py-2 text-sm rounded-lg resize-y',
                'focus:outline-none focus:ring-2 focus:ring-primary-500'
              )}
              style={{
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
              value={form.excludePatterns}
              onChange={(e) => setForm({ ...form, excludePatterns: e.target.value })}
              placeholder={t('openclaw.excludePlaceholder')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('openclaw.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !form.name || !form.path}>
              {workspace ? t('openclaw.save') : t('openclaw.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
