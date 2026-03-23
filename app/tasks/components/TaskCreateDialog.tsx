'use client';

import { Plus } from 'lucide-react';
import { Button, Input, Select, Card } from '@/shared/ui';
import type { Project, Member, Milestone } from '@/db/schema';

interface NewTaskForm {
  title: string;
  projectId: string;
  priority: 'high' | 'medium' | 'low';
  assigneeId: string;
  milestoneId: string;
  sopTemplateId: string;
}

interface TaskCreateDialogProps {
  newTask: NewTaskForm;
  setNewTask: (task: NewTaskForm) => void;
  currentProjectId: string | null;
  projects: Project[];
  members: Member[];
  milestones: Milestone[];
  sopTemplates: { id: string; name: string; status: string; stages: any[] }[];
  onSubmit: () => void;
  onClose: () => void;
  onShowMilestoneManager: (projectId: string | null) => void;
  t: (key: string) => string;
}

export default function TaskCreateDialog({
  newTask, setNewTask, currentProjectId,
  projects, members, milestones, sopTemplates,
  onSubmit, onClose, onShowMilestoneManager, t,
}: TaskCreateDialogProps) {
  const selectedProjectId = newTask.projectId || currentProjectId || '';
  const projectMs = selectedProjectId
    ? milestones.filter(m => m.projectId === selectedProjectId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
      <Card className="p-6 w-96">
        <h3 id="create-task-title" className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('tasks.newTask')}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.title')}</label>
            <Input
              value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && onSubmit()}
              placeholder={t('tasks.titlePlaceholder')}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.project')}</label>
            <Select
              value={newTask.projectId || currentProjectId || ''}
              onChange={e => setNewTask({ ...newTask, projectId: e.target.value, milestoneId: '' })}
            >
              <option value="">{t('tasks.uncategorized')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          {/* 里程碑选择 */}
          {selectedProjectId && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.milestone')}</label>
              <div className="flex items-center gap-2">
                <Select
                  value={newTask.milestoneId}
                  onChange={e => setNewTask({ ...newTask, milestoneId: e.target.value })}
                  className="flex-1"
                >
                  <option value="">{t('milestones.unassigned')}</option>
                  {projectMs.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </Select>
                <button
                  type="button"
                  onClick={() => onShowMilestoneManager(selectedProjectId)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                  title={t('milestones.createMilestone')}
                >
                  <Plus className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.priority')}</label>
              <Select
                value={newTask.priority}
                onChange={e => setNewTask({ ...newTask, priority: e.target.value as 'high' | 'medium' | 'low' })}
              >
                <option value="high">{t('tasks.high')}</option>
                <option value="medium">{t('tasks.medium')}</option>
                <option value="low">{t('tasks.low')}</option>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.assignee')}</label>
              <Select
                value={newTask.assigneeId}
                onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })}
              >
                <option value="">{t('tasks.unassigned')}</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
          </div>
          {/* SOP 模板选择 */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('sop.title')}</label>
            <Select
              value={newTask.sopTemplateId}
              onChange={e => setNewTask({ ...newTask, sopTemplateId: e.target.value })}
            >
              <option value="">{t('tasks.unassigned')}</option>
              {sopTemplates.filter(tpl => tpl.status === 'active').map(tpl => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={onSubmit}>{t('common.create')}</Button>
        </div>
      </Card>
    </div>
  );
}
