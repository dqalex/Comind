'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useMilestoneStore, useProjectStore, useTaskStore, useDocumentStore } from '@/store';
import { Button, Input, Select, Card } from '@/components/ui';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import {
  Plus, Trash2, Edit2, X, Calendar,
  Milestone as MilestoneIcon,
  ChevronDown, ChevronRight, BookOpen,
} from 'lucide-react';
import clsx from 'clsx';
import type { Milestone, KnowledgeConfig } from '@/db/schema';

interface MilestoneManagerProps {
  projectId: string;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'open', labelKey: 'milestones.open', color: 'bg-slate-400' },
  { value: 'in_progress', labelKey: 'milestones.inProgress', color: 'bg-blue-500' },
  { value: 'completed', labelKey: 'milestones.completed', color: 'bg-emerald-500' },
  { value: 'cancelled', labelKey: 'milestones.cancelled', color: 'bg-slate-300' },
];

export default function MilestoneManager({ projectId, onClose }: MilestoneManagerProps) {
  const { t } = useTranslation();
  // 精确 selector 订阅
  const milestones = useMilestoneStore((s) => s.milestones);
  const createMilestone = useMilestoneStore((s) => s.createMilestone);
  const updateMilestoneAsync = useMilestoneStore((s) => s.updateMilestoneAsync);
  const deleteMilestoneAsync = useMilestoneStore((s) => s.deleteMilestoneAsync);

  const projects = useProjectStore((s) => s.projects);
  const documents = useDocumentStore((s) => s.documents);

  const tasks = useTaskStore((s) => s.tasks);
  const deleteAction = useConfirmAction<string>();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open' as string,
    dueDate: '',
    sortOrder: 0,
    knowledgeDocId: '',
    knowledgeLayers: ['L1'] as string[],
  });

  // 使用 useInlineEdit Hook 处理里程碑名称编辑的 Enter/Blur 双重提交问题
  const { handleKeyDown: handleTitleKeyDown, handleBlur: handleTitleBlur, isSaving: isTitleSaving } = useInlineEdit({
    onSave: async () => {
      if (editingId) {
        await handleUpdate();
      } else {
        await handleCreate();
      }
    },
  });

  // 过滤出 guide 类型的文档作为知识库候选
  const guideDocs = useMemo(() => {
    return documents.filter(d => d.type === 'guide' || d.type === 'reference');
  }, [documents]);

  const project = projects.find(p => p.id === projectId);
  const projectMilestones = useMemo(
    () => milestones
      .filter(m => m.projectId === projectId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [milestones, projectId]
  );

  // 每个里程碑的任务统计
  const milestoneStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {};
    for (const ms of projectMilestones) {
      const msTasks = tasks.filter(t => t.milestoneId === ms.id);
      stats[ms.id] = {
        total: msTasks.length,
        completed: msTasks.filter(t => t.status === 'completed').length,
      };
    }
    return stats;
  }, [projectMilestones, tasks]);

  const resetForm = useCallback(() => {
    setFormData({ title: '', description: '', status: 'open', dueDate: '', sortOrder: 0, knowledgeDocId: '', knowledgeLayers: ['L1'] });
    setShowCreateForm(false);
    setEditingId(null);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formData.title.trim()) return;
    const knowledgeConfig: KnowledgeConfig | undefined = formData.knowledgeDocId
      ? { documentId: formData.knowledgeDocId, layers: formData.knowledgeLayers }
      : undefined;
    await createMilestone({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      projectId,
      status: formData.status as Milestone['status'],
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      sortOrder: formData.sortOrder || projectMilestones.length,
      knowledgeConfig,
    });
    resetForm();
  }, [formData, projectId, projectMilestones.length, createMilestone, resetForm]);

  const handleUpdate = useCallback(async () => {
    if (!editingId || !formData.title.trim()) return;
    const knowledgeConfig: KnowledgeConfig | undefined = formData.knowledgeDocId
      ? { documentId: formData.knowledgeDocId, layers: formData.knowledgeLayers }
      : undefined;
    await updateMilestoneAsync(editingId, {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: formData.status as Milestone['status'],
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      sortOrder: formData.sortOrder,
      knowledgeConfig,
    });
    resetForm();
  }, [editingId, formData, updateMilestoneAsync, resetForm]);

  const startEdit = useCallback((ms: Milestone) => {
    setEditingId(ms.id);
    setShowCreateForm(false);
    setFormData({
      title: ms.title,
      description: ms.description || '',
      status: ms.status,
      dueDate: ms.dueDate ? new Date(ms.dueDate).toISOString().split('T')[0] : '',
      sortOrder: ms.sortOrder ?? 0,
      knowledgeDocId: ms.knowledgeConfig?.documentId || '',
      knowledgeLayers: ms.knowledgeConfig?.layers || ['L1'],
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteMilestoneAsync(id);
  }, [deleteMilestoneAsync]);

  // 里程碑表单
  const renderForm = (isEdit: boolean) => (
    <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.milestoneName')}</label>
        <Input
          value={formData.title}
          onChange={e => setFormData({ ...formData, title: e.target.value })}
          placeholder={t('milestones.milestoneNamePlaceholder')}
          onKeyDown={e => handleTitleKeyDown(e, formData.title)}
          onBlur={() => handleTitleBlur(formData.title)}
          autoFocus
          disabled={isTitleSaving.current}
        />
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.milestoneDesc')}</label>
        <Input
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder={t('milestones.milestoneDescPlaceholder')}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.status')}</label>
          <Select
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value })}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.dueDate')}</label>
          <Input
            type="date"
            value={formData.dueDate}
            onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.sortOrder')}</label>
        <Input
          type="number"
          value={formData.sortOrder.toString()}
          onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
          className="w-24"
        />
      </div>
      {/* 知识库配置 */}
      <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('projects.knowledgeBase') || '知识库'}</span>
        </div>
        <div className="space-y-2">
          <Select
            value={formData.knowledgeDocId}
            onChange={e => setFormData({ ...formData, knowledgeDocId: e.target.value })}
            className="text-sm"
          >
            <option value="">{t('common.none') || '无'}</option>
            {guideDocs.map(doc => (
              <option key={doc.id} value={doc.id}>{doc.title}</option>
            ))}
          </Select>
          {formData.knowledgeDocId && (
            <div className="flex flex-wrap gap-1.5">
              {['L1', 'L2', 'L3', 'L4', 'L5'].map(layer => (
                <label
                  key={layer}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer border',
                    formData.knowledgeLayers.includes(layer)
                      ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-950'
                      : 'border-slate-200'
                  )}
                  style={{ borderColor: formData.knowledgeLayers.includes(layer) ? undefined : 'var(--border)' }}
                >
                  <input
                    type="checkbox"
                    checked={formData.knowledgeLayers.includes(layer)}
                    onChange={e => {
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, knowledgeLayers: [...prev.knowledgeLayers, layer] }));
                      } else {
                        setFormData(prev => ({ ...prev, knowledgeLayers: prev.knowledgeLayers.filter(l => l !== layer) }));
                      }
                    }}
                    className="w-3 h-3 rounded"
                  />
                  {layer}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={resetForm}>{t('common.cancel')}</Button>
        <Button size="sm" onClick={isEdit ? handleUpdate : handleCreate}>
          {isEdit ? t('common.save') : t('common.create')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <Card className="p-6 w-[520px] max-h-[80vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MilestoneIcon className="w-5 h-5" style={{ color: 'var(--primary-500)' }} />
            <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('milestones.title')}
            </h3>
            {project && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
                {project.name}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* 里程碑列表 */}
        <div className="space-y-2 mb-4">
          {projectMilestones.length === 0 && !showCreateForm && (
            <div className="text-center py-8">
              <MilestoneIcon className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.noMilestones')}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.noMilestonesHint')}</p>
            </div>
          )}

          {projectMilestones.map(ms => {
            const stats = milestoneStats[ms.id] || { total: 0, completed: 0 };
            const statusOpt = STATUS_OPTIONS.find(s => s.value === ms.status);
            const isEditing = editingId === ms.id;

            if (isEditing) {
              return <div key={ms.id}>{renderForm(true)}</div>;
            }

            return (
              <div
                key={ms.id}
                className="group flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', statusOpt?.color || 'bg-slate-400')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ms.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
                      {t(statusOpt?.labelKey || 'milestones.open')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {stats.total > 0 && (
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {t('milestones.completedCount', { completed: stats.completed, total: stats.total })}
                      </span>
                    )}
                    {ms.dueDate && (
                      <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(ms.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {ms.description && (
                      <span className="text-[10px] truncate max-w-[200px]" style={{ color: 'var(--text-tertiary)' }}>
                        {ms.description}
                      </span>
                    )}
                  </div>
                </div>
                {/* 操作按钮 */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(ms)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                    title={t('common.edit')}
                  >
                    <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                  <button
                    onClick={() => deleteAction.requestConfirm(ms.id)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 创建表单 */}
        {showCreateForm && renderForm(false)}

        {/* 底部按钮 */}
        {!showCreateForm && !editingId && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" /> {t('milestones.createMilestone')}
          </Button>
        )}

        {/* 删除确认 */}
        <ConfirmDialog
          isOpen={deleteAction.isOpen}
          onClose={deleteAction.cancel}
          onConfirm={() => deleteAction.confirm(async (id) => { await handleDelete(id); })}
          title={t('common.confirm')}
          message={t('milestones.deleteConfirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          isLoading={deleteAction.isLoading}
        />
      </Card>
    </div>
  );
}
