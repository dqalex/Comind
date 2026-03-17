'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useDocumentStore, useProjectStore } from '@/domains';
import type { Document } from '@/db/schema';
import { FileText, Search, X, ExternalLink, FolderOpen } from 'lucide-react';
import clsx from 'clsx';

interface DocumentPickerProps {
  selectedIds: string[];
  onToggle: (docId: string) => void;
  projectId?: string | null;
  open: boolean;
  onClose: () => void;
  title?: string;
  mode?: 'modal' | 'dropdown';
}

export default function DocumentPicker({
  selectedIds,
  onToggle,
  projectId,
  open,
  onClose,
  title = '关联文档',
  mode = 'modal',
}: DocumentPickerProps) {
  // 精确 selector 订阅
  const documents = useDocumentStore((s) => s.documents);
  const projects = useProjectStore((s) => s.projects);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'dropdown') return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, mode, onClose]);

  const { projectDocs, otherDocs } = useMemo(() => {
    const lowerQuery = query.toLowerCase();
    const filtered = documents.filter(d =>
      d.title.toLowerCase().includes(lowerQuery)
    );

    if (!projectId) {
      return { projectDocs: [], otherDocs: filtered };
    }

    const currentProject = projects.find(p => p.id === projectId);
    const projectName = currentProject?.name;

    const proj: Document[] = [];
    const other: Document[] = [];

    filtered.forEach(doc => {
      const isProjectDoc =
        doc.projectId === projectId ||
        (doc.projectTags && (doc.projectTags.includes(projectId) || (projectName && doc.projectTags.includes(projectName))));
      if (isProjectDoc) {
        proj.push(doc);
      } else {
        other.push(doc);
      }
    });

    return { projectDocs: proj, otherDocs: other };
  }, [documents, query, projectId, projects]);

  const getProjectLabel = (doc: Document) => {
    if (doc.projectId) {
      const p = projects.find(pr => pr.id === doc.projectId);
      if (p) return p.name;
    }
    if (doc.projectTags && doc.projectTags.length > 0) {
      return doc.projectTags[0];
    }
    return null;
  };

  if (!open) return null;

  const renderDocItem = (doc: Document) => {
    const isSelected = selectedIds.includes(doc.id);
    const projectLabel = getProjectLabel(doc);

    return (
      <button
        key={doc.id}
        onClick={() => onToggle(doc.id)}
        className={clsx(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
          isSelected
            ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
        )}
      >
        <div className={clsx(
          'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          isSelected
            ? 'bg-primary-500 border-primary-500'
            : 'border-slate-300 dark:border-slate-600'
        )}>
          {isSelected && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {doc.source === 'external' ? (
              <ExternalLink className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            )}
            <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</span>
          </div>
          {projectLabel && (
            <span className="text-[10px] ml-5" style={{ color: 'var(--text-tertiary)' }}>{projectLabel}</span>
          )}
        </div>
      </button>
    );
  };

  const content = (
    <div ref={containerRef} className={clsx(
      'flex flex-col',
      mode === 'modal'
        ? 'rounded-xl p-5 w-full max-w-md shadow-float max-h-[70vh]'
        : 'rounded-lg shadow-lg border w-80 max-h-80'
    )} style={{ background: 'var(--surface)', borderColor: mode === 'dropdown' ? 'var(--border)' : undefined }}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 id="doc-picker-title" className={clsx(mode === 'modal' ? 'text-lg font-semibold' : 'text-sm font-medium')} style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
          <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文档..."
          className="input pl-9 text-sm"
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="text-xs text-primary-600 dark:text-primary-400 mb-2 px-1">
          已选 {selectedIds.length} 篇文档
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {projectDocs.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider px-1 py-1.5 sticky top-0" style={{ color: 'var(--text-tertiary)', background: 'var(--surface)' }}>
              本项目文档 ({projectDocs.length})
            </div>
            {projectDocs.map(renderDocItem)}
          </div>
        )}

        {otherDocs.length > 0 && (
          <div>
            {projectDocs.length > 0 && (
              <div className="text-[10px] font-semibold uppercase tracking-wider px-1 py-1.5 sticky top-0 mt-2" style={{ color: 'var(--text-tertiary)', background: 'var(--surface)' }}>
                {projectId ? '其他文档' : '全部文档'} ({otherDocs.length})
              </div>
            )}
            {otherDocs.map(renderDocItem)}
          </div>
        )}

        {projectDocs.length === 0 && otherDocs.length === 0 && (
          <div className="text-center py-8">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{query ? '未找到匹配的文档' : '暂无文档'}</p>
          </div>
        )}
      </div>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-[60]" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="doc-picker-title">
        <div onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
