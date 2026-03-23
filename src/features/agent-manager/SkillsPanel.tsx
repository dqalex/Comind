'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/shared/ui';
import type { Skill } from '@/types';
import clsx from 'clsx';
import { Zap, Loader2, Download, ToggleLeft, ToggleRight } from 'lucide-react';

interface SkillsPanelProps {
  skills: Skill[];
  onToggle: (skillKey: string, enabled: boolean) => Promise<void>;
  onInstall: (name: string, installId: string, timeoutMs?: number) => Promise<void>;
}

export default function SkillsPanel({ skills, onToggle, onInstall }: SkillsPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [showInstall, setShowInstall] = useState(false);
  const [installName, setInstallName] = useState('');
  const [installId, setInstallId] = useState('');
  const [installing, setInstalling] = useState(false);
  
  const filtered = useMemo(() => {
    if (!search) return skills;
    const q = search.toLowerCase();
    return skills.filter(s => s.name.toLowerCase().includes(q) || s.skillKey.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [skills, search]);

  const handleInstall = async () => {
    if (!installName.trim() || !installId.trim()) return;
    setInstalling(true);
    try {
      await onInstall(installName.trim(), installId.trim());
      setShowInstall(false);
      setInstallName('');
      setInstallId('');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title text-[11px]">{t('agents.skillCount', { count: skills.length })}</h3>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('agents.searchSkills')}
            className="text-xs py-1.5 w-48"
          />
          <Button
            size="sm"
            className="flex items-center gap-1 text-xs"
            onClick={() => setShowInstall(true)}
          >
            <Download className="w-3.5 h-3.5" /> {t('agents.install')}
          </Button>
        </div>
      </div>

      {/* 安装对话框 */}
      {showInstall && (
        <div className="mb-4 rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('agents.installNewSkill')}</div>
          <div>
            <label className="text-[11px] mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>{t('agents.skillName')}</label>
            <Input value={installName} onChange={e => setInstallName(e.target.value)} className="text-xs" placeholder={t('agents.skillNamePlaceholder')} autoFocus />
          </div>
          <div>
            <label className="text-[11px] mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>{t('agents.installId')}</label>
            <Input value={installId} onChange={e => setInstallId(e.target.value)} className="text-xs" placeholder={t('agents.installIdPlaceholder')} />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!installName.trim() || !installId.trim() || installing}
              className="disabled:opacity-50 flex items-center gap-1 text-xs" onClick={handleInstall}>
              {installing && <Loader2 className="w-3 h-3 animate-spin" />}
              {t('agents.install')}
            </Button>
            <Button size="sm" variant="secondary" className="text-xs" onClick={() => { setShowInstall(false); setInstallName(''); setInstallId(''); }}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('agents.noMatchingSkills')}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(skill => (
            <div key={skill.skillKey} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm flex-shrink-0">
                {skill.emoji || <Zap className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{skill.name}</span>
                  {skill.blockedByAllowlist && (
                    <span className="tag text-[10px] bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400">blocked</span>
                  )}
                  {!skill.eligible && !skill.blockedByAllowlist && (
                    <span className="tag text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">{t('agents.unavailable')}</span>
                  )}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{skill.description}</div>
                {skill.missing.bins.length > 0 && (
                  <div className="text-[10px] text-red-400 mt-0.5">
                    {t('agents.missing')}: {skill.missing.bins.join(', ')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={clsx(
                  'tag text-[10px]',
                  skill.bundled ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                )}>
                  {skill.bundled ? t('agents.builtIn') : t('agents.extension')}
                </span>
                <button
                  onClick={() => onToggle(skill.skillKey, skill.disabled)}
                  className="p-1"
                  title={skill.disabled ? t('agents.enable') : t('agents.disable')}
                >
                  {!skill.disabled ? (
                    <ToggleRight className="w-5 h-5 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
