'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Search, FileText, CheckSquare, Folder, User, Calendar, Milestone, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { Input } from '@/shared/ui';
import { useTaskStore, useProjectStore, useDocumentStore, useMemberStore, useMilestoneStore, useScheduledTaskStore } from '@/domains';
import { useClickOutside } from '@/shared/hooks/useClickOutside';

interface SearchResult {
  type: 'task' | 'project' | 'document' | 'member' | 'milestone' | 'scheduledTask';
  id: string;
  title: string;
  subtitle?: string;
  icon: typeof FileText;
  href: string;
}

export default function GlobalSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 从 Store 获取数据
  const tasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const documents = useDocumentStore((s) => s.documents);
  const members = useMemberStore((s) => s.members);
  const milestones = useMilestoneStore((s) => s.milestones);
  const scheduledTasks = useScheduledTaskStore((s) => s.tasks);

  // 点击外部关闭
  useClickOutside(containerRef, useCallback(() => setIsOpen(false), []));

  // 搜索逻辑
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase().trim();
    const res: SearchResult[] = [];

    // 搜索项目
    projects.forEach(p => {
      if (p.name.toLowerCase().includes(q)) {
        res.push({
          type: 'project',
          id: p.id,
          title: p.name,
          subtitle: t('projects.title'),
          icon: Folder,
          href: '/projects',
        });
      }
    });

    // 搜索任务
    tasks.slice(0, 100).forEach(task => {
      if (task.title.toLowerCase().includes(q)) {
        res.push({
          type: 'task',
          id: task.id,
          title: task.title,
          subtitle: task.status,
          icon: CheckSquare,
          href: '/tasks',
        });
      }
    });

    // 搜索文档
    documents.slice(0, 100).forEach(doc => {
      if (doc.title.toLowerCase().includes(q)) {
        res.push({
          type: 'document',
          id: doc.id,
          title: doc.title,
          subtitle: doc.type,
          icon: FileText,
          href: `/wiki?doc=${doc.id}`,
        });
      }
    });

    // 搜索成员
    members.forEach(m => {
      if (m.name.toLowerCase().includes(q)) {
        res.push({
          type: 'member',
          id: m.id,
          title: m.name,
          subtitle: m.type === 'ai' ? 'AI' : t('members.human'),
          icon: User,
          href: '/members',
        });
      }
    });

    // 搜索里程碑
    milestones.forEach(m => {
      if (m.title.toLowerCase().includes(q)) {
        res.push({
          type: 'milestone',
          id: m.id,
          title: m.title,
          subtitle: m.status,
          icon: Milestone,
          href: '/tasks',
        });
      }
    });

    // 搜索定时任务
    scheduledTasks.forEach(st => {
      if (st.title.toLowerCase().includes(q)) {
        res.push({
          type: 'scheduledTask',
          id: st.id,
          title: st.title,
          subtitle: st.enabled ? t('scheduler.enabled') : t('scheduler.disabled'),
          icon: Calendar,
          href: '/scheduler',
        });
      }
    });

    // 按类型排序，限制数量
    const typeOrder = ['project', 'task', 'document', 'member', 'milestone', 'scheduledTask'];
    res.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
    
    return res.slice(0, 15);
  }, [query, projects, tasks, documents, members, milestones, scheduledTasks, t]);

  // 按类型分组
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    return groups;
  }, [results]);

  const typeLabels: Record<string, string> = {
    project: t('projects.title'),
    task: t('tasks.title'),
    document: t('wiki.title'),
    member: t('members.title'),
    milestone: t('milestones.title'),
    scheduledTask: t('scheduler.title'),
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          icon={<Search className="w-3.5 h-3.5" />}
          placeholder={t('common.search') + '...'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="!py-2 text-[13px] w-44 lg:w-56 !bg-slate-50 dark:!bg-white/[0.04] !border-transparent focus:!bg-white dark:focus:!bg-white/[0.06] focus:!border-primary-300 dark:focus:!border-primary-500/30 !rounded-xl"
        />
      </div>

      {/* 搜索结果下拉 */}
      {isOpen && query.trim() && (
        <div 
          className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-lg border z-50 animate-fadeIn"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('common.noData')}
            </div>
          ) : (
            Object.entries(groupedResults).map(([type, items]) => (
              <div key={type}>
                <div 
                  className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border-b"
                  style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
                >
                  {typeLabels[type]}
                </div>
                {items.map((item) => (
                  <button
                    type="button"
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                  >
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--surface-hover)' }}
                    >
                      <item.icon className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 opacity-40" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                ))}
              </div>
            ))
          )}
          
          {results.length > 0 && (
            <div 
              className="px-3 py-2 text-[11px] border-t"
              style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
            >
              {results.length} {t('common.results') || '结果'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
