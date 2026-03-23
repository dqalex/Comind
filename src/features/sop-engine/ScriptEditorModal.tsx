'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/shared/ui';
import type { ScriptFile, ScriptType } from '@/db/schema';
import { X, Save, Code, Play } from 'lucide-react';

interface ScriptEditorModalProps {
  script: ScriptFile | null;  // null = 新建
  isOpen: boolean;
  onClose: () => void;
  onSave: (script: ScriptFile) => void;
}

const scriptTypeOptions: { value: ScriptType; label: string }[] = [
  { value: 'bash', label: 'Bash' },
  { value: 'python', label: 'Python' },
  { value: 'node', label: 'Node.js' },
  { value: 'other', label: '其他' },
];

const generateId = () => Math.random().toString(36).slice(2, 10);

export default function ScriptEditorModal({
  script,
  isOpen,
  onClose,
  onSave,
}: ScriptEditorModalProps) {
  const { t } = useTranslation();
  const isNew = script === null;
  
  // 表单状态
  const [filename, setFilename] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ScriptType>('bash');
  const [executable, setExecutable] = useState(true);
  const [content, setContent] = useState('');
  
  // 初始化表单
  useEffect(() => {
    if (script) {
      setFilename(script.filename);
      setDescription(script.description || '');
      setType(script.type);
      setExecutable(script.executable);
      setContent(script.content);
    } else {
      setFilename('');
      setDescription('');
      setType('bash');
      setExecutable(true);
      setContent('');
    }
  }, [script, isOpen]);
  
  // 根据文件名自动检测类型
  const handleFilenameChange = (value: string) => {
    setFilename(value);
    const ext = value.split('.').pop()?.toLowerCase() || '';
    if (ext === 'sh') setType('bash');
    else if (ext === 'py') setType('python');
    else if (ext === 'js' || ext === 'ts') setType('node');
  };
  
  // 保存
  const handleSave = () => {
    if (!filename.trim()) return;
    
    const now = new Date().toISOString();
    const savedScript: ScriptFile = {
      id: script?.id || generateId(),
      filename: filename.trim(),
      description: description.trim(),
      type,
      executable,
      content,
      createdAt: script?.createdAt || now,
      updatedAt: now,
    };
    
    onSave(savedScript);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 模态框 */}
      <div 
        className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isNew ? '添加脚本文件' : '编辑脚本文件'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                文件名 *
              </label>
              <Input
                value={filename}
                onChange={(e) => handleFilenameChange(e.target.value)}
                placeholder="script.sh"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                类型
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ScriptType)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {scriptTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={executable}
                  onChange={(e) => setExecutable(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    可执行
                  </span>
                </div>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              描述
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="脚本用途说明（可选）"
            />
          </div>
          
          {/* 脚本编辑器 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              脚本内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`#!/bin/bash\n# 在此输入脚本内容...`}
              rows={18}
              className="w-full px-4 py-3 rounded-lg border text-sm font-mono resize-none leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
              {type === 'bash' && 'Bash 脚本，建议添加 shebang: #!/bin/bash'}
              {type === 'python' && 'Python 脚本，建议添加 shebang: #!/usr/bin/env python3'}
              {type === 'node' && 'Node.js 脚本，可通过 node script.js 执行'}
              {type === 'other' && '自定义脚本类型'}
            </p>
          </div>
        </div>
        
        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!filename.trim()}>
            <Save className="w-4 h-4 mr-1.5" />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
