'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/shared/ui';
import type { ReferenceFile, ReferenceType } from '@/db/schema';
import { X, Save, FileText } from 'lucide-react';

interface ReferenceEditorModalProps {
  reference: ReferenceFile | null;  // null = 新建
  isOpen: boolean;
  onClose: () => void;
  onSave: (reference: ReferenceFile) => void;
}

const referenceTypeOptions: { value: ReferenceType; label: string }[] = [
  { value: 'template', label: '模板' },
  { value: 'guide', label: '指南' },
  { value: 'example', label: '示例' },
  { value: 'doc', label: '文档' },
];

const generateId = () => Math.random().toString(36).slice(2, 10);

export default function ReferenceEditorModal({
  reference,
  isOpen,
  onClose,
  onSave,
}: ReferenceEditorModalProps) {
  const { t } = useTranslation();
  const isNew = reference === null;
  
  // 表单状态
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ReferenceType>('doc');
  const [content, setContent] = useState('');
  
  // 初始化表单
  useEffect(() => {
    if (reference) {
      setFilename(reference.filename);
      setTitle(reference.title);
      setDescription(reference.description || '');
      setType(reference.type);
      setContent(reference.content);
    } else {
      setFilename('');
      setTitle('');
      setDescription('');
      setType('doc');
      setContent('');
    }
  }, [reference, isOpen]);
  
  // 保存
  const handleSave = () => {
    if (!filename.trim() || !title.trim()) return;
    
    const now = new Date().toISOString();
    const savedRef: ReferenceFile = {
      id: reference?.id || generateId(),
      filename: filename.trim(),
      title: title.trim(),
      description: description.trim(),
      type,
      content,
      createdAt: reference?.createdAt || now,
      updatedAt: now,
    };
    
    onSave(savedRef);
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
            <FileText className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isNew ? '添加参考文档' : '编辑参考文档'}
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
                onChange={(e) => setFilename(e.target.value)}
                placeholder="example.md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                标题 *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="文档标题"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                类型
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReferenceType)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {referenceTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              描述
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短描述（可选）"
            />
          </div>
          
          {/* 内容编辑器 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              文档内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此输入文档内容，支持 Markdown 格式..."
              rows={18}
              className="w-full px-4 py-3 rounded-lg border text-sm font-mono resize-none leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
              支持 Markdown 格式，可包含代码块、表格、列表等
            </p>
          </div>
        </div>
        
        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!filename.trim() || !title.trim()}>
            <Save className="w-4 h-4 mr-1.5" />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
