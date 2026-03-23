'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/shared/ui';
import type { ReferenceFile } from '@/db/schema';
import { Plus, Trash2, FileText, Edit2 } from 'lucide-react';
import ReferenceEditorModal from './ReferenceEditorModal';

interface ReferencesPanelProps {
  references: ReferenceFile[];
  onChange: (references: ReferenceFile[]) => void;
}

export default function ReferencesPanel({ references, onChange }: ReferencesPanelProps) {
  const { t } = useTranslation();
  
  // 编辑模态框状态
  const [editingRef, setEditingRef] = useState<ReferenceFile | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  
  // 打开新建模态框
  const handleAdd = useCallback(() => {
    setEditingRef(null);
    setShowEditor(true);
  }, []);
  
  // 打开编辑模态框
  const handleEdit = useCallback((ref: ReferenceFile) => {
    setEditingRef(ref);
    setShowEditor(true);
  }, []);
  
  // 保存（新建或更新）
  const handleSave = useCallback((savedRef: ReferenceFile) => {
    if (editingRef) {
      // 更新
      onChange(references.map(r => r.id === savedRef.id ? savedRef : r));
    } else {
      // 新建
      onChange([...references, savedRef]);
    }
  }, [editingRef, references, onChange]);
  
  // 删除
  const handleDelete = useCallback((id: string) => {
    onChange(references.filter(r => r.id !== id));
  }, [references, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          参考文档 ({references.length})
        </h3>
        <Button variant="secondary" size="sm" onClick={handleAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          添加参考文档
        </Button>
      </div>

      {/* 参考文档列表 */}
      {references.length > 0 ? (
        <div className="space-y-2">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="border rounded-lg p-3 flex items-center gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
              onClick={() => handleEdit(ref)}
            >
              <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {ref.title}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {ref.filename}
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" 
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {ref.type}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(ref.id); }}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
              <Edit2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div 
          className="p-4 text-center rounded-lg border-2 border-dashed cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
          style={{ borderColor: 'var(--border)' }}
          onClick={handleAdd}
        >
          <FileText className="w-6 h-6 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            点击添加参考文档
          </p>
        </div>
      )}

      {/* 编辑模态框 */}
      <ReferenceEditorModal
        reference={editingRef}
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleSave}
      />
    </div>
  );
}
