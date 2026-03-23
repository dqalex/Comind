'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/shared/ui';
import type { ScriptFile } from '@/db/schema';
import { Plus, Trash2, Code, Edit2, Play } from 'lucide-react';
import ScriptEditorModal from './ScriptEditorModal';

interface ScriptsPanelProps {
  scripts: ScriptFile[];
  onChange: (scripts: ScriptFile[]) => void;
}

export default function ScriptsPanel({ scripts, onChange }: ScriptsPanelProps) {
  const { t } = useTranslation();
  
  // 编辑模态框状态
  const [editingScript, setEditingScript] = useState<ScriptFile | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  
  // 打开新建模态框
  const handleAdd = useCallback(() => {
    setEditingScript(null);
    setShowEditor(true);
  }, []);
  
  // 打开编辑模态框
  const handleEdit = useCallback((script: ScriptFile) => {
    setEditingScript(script);
    setShowEditor(true);
  }, []);
  
  // 保存（新建或更新）
  const handleSave = useCallback((savedScript: ScriptFile) => {
    if (editingScript) {
      // 更新
      onChange(scripts.map(s => s.id === savedScript.id ? savedScript : s));
    } else {
      // 新建
      onChange([...scripts, savedScript]);
    }
  }, [editingScript, scripts, onChange]);
  
  // 删除
  const handleDelete = useCallback((id: string) => {
    onChange(scripts.filter(s => s.id !== id));
  }, [scripts, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          脚本文件 ({scripts.length})
        </h3>
        <Button variant="secondary" size="sm" onClick={handleAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          添加脚本
        </Button>
      </div>

      {/* 脚本列表 */}
      {scripts.length > 0 ? (
        <div className="space-y-2">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="border rounded-lg p-3 flex items-center gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
              onClick={() => handleEdit(script)}
            >
              <Code className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {script.filename}
                </div>
                {script.description && (
                  <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {script.description}
                  </div>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" 
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {script.type}
              </span>
              {script.executable && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 flex items-center gap-1 flex-shrink-0">
                  <Play className="w-3 h-3" />
                  可执行
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(script.id); }}
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
          <Code className="w-6 h-6 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            点击添加脚本文件
          </p>
        </div>
      )}

      {/* 编辑模态框 */}
      <ScriptEditorModal
        script={editingScript}
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleSave}
      />
    </div>
  );
}
