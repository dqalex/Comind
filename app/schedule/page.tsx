'use client';

import { useTranslation } from 'react-i18next';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import GatewayRequired from '@/shared/layout/GatewayRequired';
import ConfirmDialog from '@/shared/layout/ConfirmDialog';
import { Button } from '@/shared/ui';
import { Plus, RefreshCw } from 'lucide-react';
import { useSchedulePage, defaultForm } from './hooks/useSchedulePage';
import ScheduleStats from './components/ScheduleStats';
import ScheduleTimeline from './components/ScheduleTimeline';
import ScheduleJobList from './components/ScheduleJobList';
import ScheduleJobForm from './components/ScheduleJobForm';

export default function SchedulePage() {
  const { t } = useTranslation();
  const {
    cronJobs, cronRuns, agentsList, documents,
    enabledJobs, disabledJobs, nextWakeJob,
    showCreate, setShowCreate,
    expandedJobId, toggleExpand,
    showRunsJobId, handleToggleRuns,
    deleteAction,
    form, setForm,
    editingJob, setEditingJob,
    editForm, setEditForm,
    handleCreate, handleDelete, handleEditOpen, handleEditSave,
    toggleCronJob, runCronJob, refreshCronJobs,
  } = useSchedulePage();

  return (
    <AppShell>
      <GatewayRequired feature={t('scheduler.title')}>
      <Header
        title={t('scheduler.title')}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="flex items-center gap-1 text-xs" onClick={() => refreshCronJobs()}>
              <RefreshCw className="w-3.5 h-3.5" /> {t('agents.refresh')}
            </Button>
            <Button size="sm" className="flex items-center gap-1 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5" /> {t('scheduler.newJob')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto space-y-6">
        <ScheduleStats
          totalJobs={cronJobs.length}
          enabledCount={enabledJobs.length}
          disabledCount={disabledJobs.length}
          nextWakeJob={nextWakeJob}
        />

        <ScheduleTimeline enabledJobs={enabledJobs} />

        <ScheduleJobList
          cronJobs={cronJobs}
          cronRuns={cronRuns}
          agentsList={agentsList}
          documents={documents}
          expandedJobId={expandedJobId}
          showRunsJobId={showRunsJobId}
          onToggleExpand={toggleExpand}
          onToggleRuns={handleToggleRuns}
          onToggleJob={toggleCronJob}
          onRunJob={runCronJob}
          onEditJob={handleEditOpen}
          onRequestDelete={deleteAction.requestConfirm}
        />
      </main>

      {/* 新建定时任务 */}
      {showCreate && (
        <ScheduleJobForm
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setForm(defaultForm); }}
          title={t('scheduler.newJob')}
          submitLabel={t('scheduler.create')}
          agentsList={agentsList}
          documents={documents}
        />
      )}

      {/* 编辑定时任务 */}
      {editingJob && (
        <ScheduleJobForm
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleEditSave}
          onCancel={() => setEditingJob(null)}
          title={t('scheduler.editTask')}
          submitLabel={t('common.save')}
          agentsList={agentsList}
          documents={documents}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteAction.isOpen}
        onClose={deleteAction.cancel}
        onConfirm={() => deleteAction.confirm(handleDelete)}
        title={t('scheduler.deleteTask')}
        message={t('scheduler.irreversible')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteAction.isLoading}
      />
      </GatewayRequired>
    </AppShell>
  );
}
