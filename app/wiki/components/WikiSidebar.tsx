'use client';

import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/shared/ui';
import {
  FileText, Plus, Search, ExternalLink, Globe,
  ChevronDown, ChevronRight,
  BookOpen, FileQuestion, Calendar, CheckSquare, ClipboardList,
} from 'lucide-react';
import clsx from 'clsx';
import type { Document } from '@/db/schema';
import { typeColors, typeOrder } from '../hooks/useWikiPage';

const typeIcons: Record<string, typeof FileText> = {
  guide: BookOpen, reference: FileText, report: ClipboardList, note: BookOpen,
  decision: FileText, scheduled_task: Calendar, task_list: CheckSquare, other: FileQuestion,
};

interface WikiSidebarProps {
  documents: Document[];
  filteredDocs: Document[];
  docsByType: Record<string, Document[]>;
  searchInput: string;
  onSearchInput: (value: string) => void;
  filterType: string;
  onFilterType: (type: string) => void;
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  collapsedTypes: Set<string>;
  onToggleCollapse: (type: string) => void;
  onNewDoc: () => void;
  typeLabels: Record<string, string>;
}

export default function WikiSidebar({
  documents, filteredDocs, docsByType,
  searchInput, onSearchInput,
  filterType, onFilterType,
  selectedDocId, onSelectDoc,
  collapsedTypes, onToggleCollapse,
  onNewDoc, typeLabels,
}: WikiSidebarProps) {
  const { t } = useTranslation();

  const renderDocItem = (doc: Document) => {
    const Icon = typeIcons[doc.type] || FileQuestion;
    return (
      <button
        key={doc.id}
        onClick={() => onSelectDoc(doc.id)}
        className={clsx(
          'w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-2',
          selectedDocId === doc.id
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 font-medium'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        )}
        style={{ color: selectedDocId === doc.id ? undefined : 'var(--text-secondary)' }}
      >
        {doc.source === 'external'
          ? <ExternalLink className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          : doc.source === 'openclaw'
            ? <Globe className="w-3 h-3 flex-shrink-0 text-blue-500" />
            : <Icon className={clsx('w-3 h-3 flex-shrink-0', typeColors[doc.type])} />}
        <span className="truncate flex-1">{doc.title}</span>
        {doc.source === 'openclaw' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
            {t('wiki.openclaw')}
          </span>
        )}
        {Array.isArray(doc.projectTags) && doc.projectTags.length > 0 && (
          <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800" style={{ color: 'var(--text-tertiary)' }}>
            {doc.projectTags.length}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-60 min-w-[240px] max-w-[240px] border-r flex flex-col flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="p-3 border-b space-y-2" style={{ borderColor: 'var(--border)' }}>
        <Input
          icon={<Search className="w-3.5 h-3.5" />}
          value={searchInput}
          onChange={e => onSearchInput(e.target.value)}
          placeholder={t('wiki.search')}
          className="py-1.5 text-[13px]"
        />
        <div className="flex flex-wrap gap-1">
          <button onClick={() => onFilterType('all')}
            className={clsx('text-[10px] px-1.5 py-0.5 rounded-full transition-colors',
              filterType === 'all' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            )} style={filterType !== 'all' ? { color: 'var(--text-tertiary)' } : undefined}>
            {t('wiki.all')} ({filteredDocs.length})
          </button>
          {typeOrder.map(tp => {
            const count = documents.filter(d => d.type === tp).length;
            if (count === 0 && tp !== 'scheduled_task') return null;
            return (
              <button key={tp} onClick={() => onFilterType(filterType === tp ? 'all' : tp)}
                className={clsx('text-[10px] px-1.5 py-0.5 rounded-full transition-colors',
                  filterType === tp ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                )} style={filterType !== tp ? { color: 'var(--text-tertiary)' } : undefined}>
                {typeLabels[tp]} ({count})
              </button>
            );
          })}
        </div>
        <Button size="sm" className="w-full" onClick={onNewDoc}>
          <Plus className="w-3.5 h-3.5" /> {t('wiki.newDoc')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filterType !== 'all' ? (
          filteredDocs.map(renderDocItem)
        ) : (
          Object.entries(docsByType).map(([type, docs]) => (
            <div key={type}>
              <button onClick={() => onToggleCollapse(type)}
                className="flex items-center gap-1.5 px-2 py-1 w-full text-left">
                {collapsedTypes.has(type)
                  ? <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  : <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />}
                {(() => { const I = typeIcons[type] || FileQuestion; return <I className={clsx('w-3 h-3', typeColors[type])} />; })()}
                <span className="section-title text-[10px]">{typeLabels[type]} ({docs.length})</span>
              </button>
              {!collapsedTypes.has(type) && docs.map(renderDocItem)}
            </div>
          ))
        )}
        {filteredDocs.length === 0 && (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noDocs')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
