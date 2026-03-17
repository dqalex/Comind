'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGatewayStore } from '@/store/gateway.store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import GatewayRequired from '@/components/GatewayRequired';
import { Button, Input, Badge } from '@/components/ui';
import type { Skill } from '@/types';
import { useFilteredList } from '@/hooks/useFilteredList';
import {
  Zap, ToggleLeft, ToggleRight, Search, Download, AlertTriangle,
  CheckCircle2, XCircle, Wifi, ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

type SourceFilter = 'all' | 'bundled' | 'external';

export default function SkillsPage() {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const skills = useGatewayStore((s) => s.skills);
  const toggleSkill = useGatewayStore((s) => s.toggleSkill);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);
  const installSkill = useGatewayStore((s) => s.installSkill);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  // 使用 useFilteredList 替代手动筛选
  const {
    filteredItems: filteredSkills,
    searchQuery,
    setSearchQuery,
    activeFilters,
    toggleFilter,
  } = useFilteredList<Skill>({
    items: skills,
    config: {
      searchFields: ['name', 'description', 'skillKey'],
      filters: {
        bundled: (s) => s.bundled,
        external: (s) => !s.bundled,
      },
    },
  });

  // 计算当前 sourceFilter 用于 UI 显示
  const sourceFilter: SourceFilter = activeFilters.includes('bundled')
    ? 'bundled'
    : activeFilters.includes('external')
      ? 'external'
      : 'all';

  // 设置 sourceFilter（兼容原有 UI）
  const setSourceFilter = (filter: SourceFilter) => {
    // 清除现有筛选
    if (activeFilters.includes('bundled')) toggleFilter('bundled');
    if (activeFilters.includes('external')) toggleFilter('external');
    // 添加新筛选
    if (filter !== 'all') toggleFilter(filter);
  };

  const grouped = useMemo(() => {
    const external = filteredSkills.filter(s => !s.bundled);
    const bundled = filteredSkills.filter(s => s.bundled);
    return { external, bundled };
  }, [filteredSkills]);

  const handleToggle = async (skillKey: string, currentDisabled: boolean) => {
    await toggleSkill(skillKey, currentDisabled);
  };

  const handleInstall = async (skillName: string, installId: string) => {
    setInstalling(`${skillName}:${installId}`);
    try {
      await installSkill(skillName, installId);
      await refreshSkills();
    } catch (e) {
      console.error('installSkill error:', e);
    }
    setInstalling(null);
  };

  const renderSkillGroup = (title: string, skillList: Skill[]) => {
    if (skillList.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
          {title} ({skillList.length})
        </h3>
        <div className="space-y-2">
          {skillList.map(skill => {
            const isExpanded = expandedSkill === skill.skillKey;
            const hasMissing = skill.missing.bins.length > 0 || skill.missing.anyBins.length > 0 || skill.missing.env.length > 0;

            return (
              <div key={skill.skillKey} className="card overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedSkill(isExpanded ? null : skill.skillKey)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={clsx(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg',
                      !skill.disabled ? 'bg-amber-50 dark:bg-amber-950' : 'bg-slate-100 dark:bg-slate-800'
                    )}>
                      {skill.emoji || <Zap className={clsx('w-4 h-4', !skill.disabled ? 'text-amber-500' : 'text-slate-400')} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {skill.name}
                        </span>
                        {hasMissing && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                        {skill.blockedByAllowlist && (
                          <Badge className="text-[9px] bg-red-50 text-red-500 dark:bg-red-950">blocked</Badge>
                        )}
                        {!skill.eligible && !skill.blockedByAllowlist && (
                          <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950">{t('skillsPage.unavailable')}</Badge>
                        )}
                      </div>
                      {skill.description && (
                        <div className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {skill.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(skill.skillKey, skill.disabled); }}
                      className="transition-colors"
                    >
                      {!skill.disabled ? (
                        <ToggleRight className="w-7 h-7 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
                      )}
                    </button>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    {/* 缺失依赖 */}
                    {hasMissing && (
                      <div className="mt-3">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('skillsPage.missingDeps')}</h4>
                        <div className="space-y-1.5">
                          {skill.missing.bins.map(bin => (
                            <div key={bin} className="flex items-center gap-2 text-xs">
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {bin} <span className="tag text-[9px]">bin</span>
                              </span>
                            </div>
                          ))}
                          {skill.missing.env.map(env => (
                            <div key={env} className="flex items-center gap-2 text-xs">
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {env} <span className="tag text-[9px]">env</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 需求 */}
                    {(skill.requirements.bins.length > 0 || skill.requirements.env.length > 0) && (
                      <div>
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('skillsPage.requirements')}</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {skill.requirements.bins.map(bin => (
                            <span key={bin} className="tag text-[10px]" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                              {bin}
                              {!skill.missing.bins.includes(bin) && <CheckCircle2 className="w-3 h-3 text-green-500 ml-1" />}
                            </span>
                          ))}
                          {skill.requirements.env.map(env => (
                            <span key={env} className="tag text-[10px]" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                              {env}
                              {!skill.missing.env.includes(env) && <CheckCircle2 className="w-3 h-3 text-green-500 ml-1" />}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 安装选项 */}
                    {skill.install.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('skillsPage.installOptions')}</h4>
                        <div className="space-y-1.5">
                          {skill.install.map(opt => (
                            <div key={opt.id} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                              <div className="flex items-center gap-2">
                                <Download className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {opt.label}
                                  <span className="tag text-[9px] ml-1">{opt.kind}</span>
                                </span>
                              </div>
                              <Button
                                size="sm"
                                className="text-[11px] px-2 py-0.5 flex items-center gap-1 disabled:opacity-50"
                                disabled={installing === `${skill.name}:${opt.id}`}
                                onClick={() => handleInstall(skill.name, opt.id)}
                              >
                                <Download className="w-3 h-3" />
                                {installing === `${skill.name}:${opt.id}` ? t('skillsPage.installing') : t('skillsPage.install')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 基本信息 */}
                    <div className="text-[11px] space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
                      <div>{t('skillsPage.skillKey')}: <span className="font-mono">{skill.skillKey}</span></div>
                      <div>{t('skillsPage.source')}: {skill.bundled ? t('skillsPage.builtIn') : skill.source || 'external'}</div>
                      <div>Eligible: {skill.eligible ? '✓' : '✗'}</div>
                      {skill.filePath && <div>{t('skillsPage.path')}: <span className="font-mono">{skill.filePath}</span></div>}
                      {skill.homepage && (
                        <div>
                          <a href={skill.homepage} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                            {skill.homepage}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <Header title={t('skillsPage.title')} />

      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto">
        <GatewayRequired feature={t('skillsPage.title')}>
            {/* 搜索和筛选 */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  icon={<Search className="w-4 h-4" />}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('skillsPage.search')}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'bundled', 'external'] as const).map(source => (
                  <Button
                    key={source}
                    size="sm"
                    variant={sourceFilter === source ? 'primary' : 'ghost'}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    onClick={() => setSourceFilter(source)}
                  >
                    {source === 'all' ? t('skillsPage.all') : source === 'bundled' ? t('skillsPage.bundled') : t('skillsPage.external')}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="flex items-center gap-1.5"
                onClick={() => refreshSkills()}
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('skillsPage.refresh')}
              </Button>
            </div>

            {/* 技能列表 */}
            {filteredSkills.length === 0 ? (
              <div className="card p-12 text-center">
                <Zap className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ color: 'var(--text-tertiary)' }}>{t('skillsPage.noMatchingSkills')}</p>
              </div>
            ) : sourceFilter === 'all' ? (
              <>
                {renderSkillGroup(t('skillsPage.externalSkills'), grouped.external)}
                {renderSkillGroup(t('skillsPage.bundledSkills'), grouped.bundled)}
              </>
            ) : (
              renderSkillGroup(sourceFilter === 'bundled' ? t('skillsPage.bundledSkills') : t('skillsPage.externalSkills'), filteredSkills)
            )}
        </GatewayRequired>
      </main>
    </AppShell>
  );
}
