'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/shared/ui';
import { Loader2 } from 'lucide-react';

interface CreateAgentDialogProps {
  onCreate: (params: { name: string; workspace: string; emoji?: string }) => Promise<void>;
  onClose: () => void;
}

export default function CreateAgentDialog({ onCreate, onClose }: CreateAgentDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [emoji, setEmoji] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !workspace.trim()) return;
    setCreating(true);
    try {
      await onCreate({ name: name.trim(), workspace: workspace.trim(), emoji: emoji || undefined });
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-agent-title">
      <div className="rounded-2xl p-6 w-full max-w-md shadow-float" style={{ background: 'var(--surface)' }}>
        <h3 id="create-agent-title" className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('agents.createAgentTitle')}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('agents.name')} *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('agents.namePlaceholder')} autoFocus />
          </div>
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('agents.workspacePath')} *</label>
            <Input value={workspace} onChange={e => setWorkspace(e.target.value)} placeholder={t('agents.workspacePathPlaceholder')} />
          </div>
          <div>
            <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('agents.emojiOptional')}</label>
            <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder={t('agents.emojiPlaceholder')} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button size="sm" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="sm"
            disabled={!name.trim() || !workspace.trim() || creating}
            className="flex items-center gap-1.5 disabled:opacity-50"
            onClick={handleSubmit}
          >
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('common.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
