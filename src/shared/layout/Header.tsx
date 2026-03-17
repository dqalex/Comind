'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/domains';
import { ChevronDown, Check, Folder, Bell } from 'lucide-react';
import clsx from 'clsx';
import { useClickOutside } from '@/hooks/useClickOutside';
import UserMenu from '@/components/UserMenu';
import GlobalSearch from '@/components/GlobalSearch';

interface HeaderProps {
  title?: string;
  actions?: React.ReactNode;
  showProjectSelector?: boolean;
}

export default function Header({ title, actions, showProjectSelector = false }: HeaderProps) {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentProject = projects.find(p => p.id === currentProjectId);

  useClickOutside(dropdownRef, useCallback(() => setShowDropdown(false), []));

  const handleSelectProject = (projectId: string | null) => {
    setCurrentProject(projectId);
    setShowDropdown(false);
  };

  return (
    <header className="h-16 px-8 border-b sticky top-0 z-[5] backdrop-blur-xl" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between h-full">
        {/* 左侧：项目选择器/标题 → 搜索框 */}
        <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
          {title && !showProjectSelector && (
            <h1 className="font-display text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h1>
          )}
          {showProjectSelector && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-transparent hover:border-border"
                aria-label={t('projects.selectProject')}
              >
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center shadow-sm',
                  currentProject ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-white/10'
                )}>
                  <Folder className={clsx('w-4 h-4', currentProject ? 'text-white' : 'text-slate-400')} />
                </div>
                <span className="font-display text-[15px] font-bold truncate max-w-[240px]" style={{ color: 'var(--text-primary)' }}>
                  {currentProject ? currentProject.name : t('projects.allProjects')}
                </span>
                <ChevronDown className={clsx('w-4 h-4 transition-transform duration-200', showDropdown && 'rotate-180')} style={{ color: 'var(--text-tertiary)' }} />
              </button>

              {showDropdown && (
                <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl shadow-float border z-50 py-1.5 max-h-72 overflow-y-auto animate-fadeIn" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectProject(null)}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-200 text-[13px] mx-0',
                      !currentProjectId ? 'bg-primary-50/60 dark:bg-primary-500/[0.06]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                    )}
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                      <Folder className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                    <span className="flex-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('projects.allProjects')}</span>
                    {!currentProjectId && <Check className="w-3.5 h-3.5 text-primary-500" />}
                  </button>

                  <div className="h-px mx-3 my-1" style={{ background: 'var(--border)' }} />

                  {projects.map((project) => (
                    <button
                      type="button"
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-200 text-[13px] mx-0',
                        currentProjectId === project.id ? 'bg-primary-50/60 dark:bg-primary-500/[0.06]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                      )}
                    >
                      <div className="w-6 h-6 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
                        <Folder className="w-3 h-3 text-primary-500" />
                      </div>
                      <span className="flex-1 truncate font-medium" style={{ color: 'var(--text-secondary)' }}>{project.name}</span>
                      {currentProjectId === project.id && <Check className="w-3.5 h-3.5 text-primary-500" />}
                    </button>
                  ))}

                  {projects.length === 0 && (
                    <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>{t('projects.noProjects')}</div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="hidden md:block">
            <GlobalSearch />
          </div>
        </div>

        {/* 右侧：actions → 通知 → 用户菜单 */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {actions && <div className="flex items-center">{actions}</div>}

          <button
            type="button"
            className="relative p-2 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={t('notifications.title')}
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
          </button>

          {/* 用户菜单始终在最右边 */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
