'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  Plus,
  LayoutGrid,
  List,
  Edit2,
  Home,
  FolderSync,
} from 'lucide-react';
import { Button, Input, Select } from '@/shared/ui';
import ConfirmDialog from '@/shared/layout/ConfirmDialog';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import MilestoneManager from '@/features/milestone-tracker/MilestoneManager';

// 懒加载大型抽屉组件（仅在打开任务详情时加载）
const TaskDrawer = dynamic(() => import('@/features/task-board/TaskDrawer'), { ssr: false });
import TaskCard from './components/TaskCard';
import TaskBoardView from './components/TaskBoardView';
import TaskListView from './components/TaskListView';
import TaskBatchBar from './components/TaskBatchBar';
import TaskCreateDialog from './components/TaskCreateDialog';
import TaskContextMenu from './components/TaskContextMenu';
import { useTasksPage } from './hooks/useTasksPage';

export default function TasksPage() {
  const tp = useTasksPage();
  const { t } = useTranslation();

  return (
    <AppShell>
      <Header
        title={t('tasks.title')}
        showProjectSelector
        actions={
          <div className="flex items-center gap-2">
            {tp.error && (
              <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg">{tp.error}</div>
            )}
            {/* source 过滤 */}
            <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              {([
                { key: 'all' as const, label: t('common.all'), icon: null },
                { key: 'local' as const, label: t('tasks.localTasks'), icon: Home },
                { key: 'openclaw' as const, label: t('tasks.syncedTasks'), icon: FolderSync },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => tp.setFilterSource(tab.key)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors',
                    tab.key === 'all' && 'rounded-l-lg',
                    tab.key === 'openclaw' && 'rounded-r-lg',
                    tp.filterSource === tab.key ? 'bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400' : ''
                  )}
                  style={tp.filterSource !== tab.key ? { color: 'var(--text-tertiary)' } : undefined}
                >
                  {tab.icon && <tab.icon className="w-3 h-3" />}
                  {tab.label}
                  <span className="text-[10px] opacity-60">{tp.sourceCounts[tab.key]}</span>
                </button>
              ))}
            </div>
            {/* 视图切换 */}
            <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => tp.setViewMode('board')}
                className={clsx('p-1.5 rounded-l-lg transition-colors', tp.viewMode === 'board' ? 'bg-primary-50 text-primary-600 dark:bg-primary-950' : '')}
                style={{ color: tp.viewMode === 'board' ? undefined : 'var(--text-tertiary)' }}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => tp.setViewMode('list')}
                className={clsx('p-1.5 rounded-r-lg transition-colors', tp.viewMode === 'list' ? 'bg-primary-50 text-primary-600 dark:bg-primary-950' : '')}
                style={{ color: tp.viewMode === 'list' ? undefined : 'var(--text-tertiary)' }}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            {/* 优先级过滤 */}
            <Select value={tp.filterPriority} onChange={e => tp.setFilterPriority(e.target.value)} className="py-1.5 text-xs w-24">
              <option value="all">{t('common.all')}</option>
              <option value="high">{t('tasks.high')}</option>
              <option value="medium">{t('tasks.medium')}</option>
              <option value="low">{t('tasks.low')}</option>
            </Select>
            <Button onClick={() => { tp.setShowQuickInput(true); setTimeout(() => tp.quickInputRef.current?.focus(), 50); }}>
              <Plus className="w-4 h-4" /> {t('tasks.newTask')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-6 overflow-auto">
        {/* 批量操作栏 */}
        {tp.selectionMode && (
          <TaskBatchBar
            selectedCount={tp.selectedTaskIds.size}
            pushing={tp.pushing}
            pushError={tp.pushError}
            gwConnected={tp.gwConnected}
            STATUS_COLUMNS={tp.STATUS_COLUMNS}
            showBatchStatusMenu={tp.showBatchStatusMenu}
            setShowBatchStatusMenu={tp.setShowBatchStatusMenu}
            onBatchStatusChange={tp.handleBatchStatusChange}
            onBatchDelete={() => tp.batchDeleteConfirm.requestConfirm(true)}
            onBatchPush={tp.handleBatchPush}
            onSelectAll={tp.selectAllVisible}
            onClearSelection={tp.clearSelection}
            onClearPushError={() => tp.setPushError(null)}
          />
        )}

        {/* 快速创建输入框 */}
        {tp.showQuickInput && (
          <div className="mb-4 flex items-center gap-2">
            <Input
              ref={tp.quickInputRef}
              value={tp.quickTitle}
              onChange={e => tp.setQuickTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && tp.quickTitle.trim()) tp.handleQuickCreate(tp.quickTitle);
                if (e.key === 'Escape') { tp.setShowQuickInput(false); tp.setQuickTitle(''); }
              }}
              onBlur={() => { setTimeout(() => { if (!tp.quickTitle.trim()) { tp.setShowQuickInput(false); tp.setQuickTitle(''); } }, 150); }}
              className="flex-1"
              placeholder={t('tasks.quickCreatePlaceholder')}
              autoFocus
            />
            <Button variant="secondary" onClick={() => { tp.setNewTask({ ...tp.newTask, projectId: tp.currentProjectId || '' }); tp.setShowNewTaskDialog(true); }} title={t('tasks.openDetailForm')}>
              <Edit2 className="w-3.5 h-3.5" /> {t('tasks.detail')}
            </Button>
            <Button variant="secondary" onClick={() => { tp.setShowQuickInput(false); tp.setQuickTitle(''); }}>{t('common.cancel')}</Button>
          </div>
        )}

        {/* 看板/列表视图 */}
        {tp.viewMode === 'board' ? (
          <TaskBoardView
            swimlaneData={tp.swimlaneData}
            tasksByStatus={tp.tasksByStatus}
            STATUS_COLUMNS={tp.STATUS_COLUMNS}
            PRIORITY_MAP={tp.PRIORITY_MAP}
            sopTemplates={tp.sopTemplates}
            selectedTaskIds={tp.selectedTaskIds}
            selectionMode={tp.selectionMode}
            currentProjectId={tp.currentProjectId}
            isSwimLaneView={tp.isSwimLaneView}
            collapsedLanes={tp.collapsedLanes}
            collapsedStatusColumns={tp.collapsedStatusColumns}
            dragTaskId={tp.dragTaskId}
            dragMilestoneId={tp.dragMilestoneId}
            dragOverTarget={tp.dragOverTarget}
            onDragStart={tp.handleDragStart}
            onDragOver={tp.handleDragOver}
            onDragLeave={tp.handleDragLeave}
            onDrop={tp.handleDrop}
            onMilestoneDragStart={tp.handleMilestoneDragStart}
            onMilestoneDrop={tp.handleMilestoneDrop}
            onToggleLane={tp.toggleLane}
            onToggleStatusColumn={tp.toggleStatusColumn}
            onToggleSelection={tp.toggleTaskSelection}
            onOpenDrawer={tp.setDrawerTaskId}
            onMenuToggle={(taskId, e) => {
              if (tp.menuTaskId === taskId) { tp.setMenuTaskId(null); tp.setMenuPosition(null); }
              else {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                tp.setMenuTaskId(taskId);
                tp.setMenuPosition({ top: rect.bottom + 4, left: rect.right - 128 });
              }
            }}
            onShowMilestoneManager={tp.setShowMilestoneManager}
            getMemberName={tp.getMemberName}
            t={t}
            syncedLabel={t('tasks.synced')}
            dragHereLabel={t('tasks.dragHere')}
            taskCountLabel={t('tasks.taskCount')}
            noTasksHint={t('tasks.noTasksHint')}
            milestoneTitle={t('milestones.title')}
          />
        ) : (
          <TaskListView
            filteredTasks={tp.filteredTasks}
            projects={tp.projects}
            STATUS_COLUMNS={tp.STATUS_COLUMNS}
            PRIORITY_MAP={tp.PRIORITY_MAP}
            getMemberName={tp.getMemberName}
            onOpenDrawer={tp.setDrawerTaskId}
            onRequestDelete={(id) => tp.deleteAction.requestConfirm(id)}
            t={t}
          />
        )}
      </main>

      {/* 详细新建任务对话框 */}
      {tp.showNewTaskDialog && (
        <TaskCreateDialog
          newTask={tp.newTask}
          setNewTask={tp.setNewTask}
          currentProjectId={tp.currentProjectId}
          projects={tp.projects}
          members={tp.members}
          milestones={tp.milestones}
          sopTemplates={tp.sopTemplates}
          onSubmit={tp.handleCreateTask}
          onClose={() => tp.setShowNewTaskDialog(false)}
          onShowMilestoneManager={tp.setShowMilestoneManager}
          t={t}
        />
      )}

      {/* 任务详情抽屉 */}
      {tp.drawerTask && (
        <TaskDrawer task={tp.drawerTask} onClose={() => tp.setDrawerTaskId(null)} onDelete={() => tp.setDrawerTaskId(null)} />
      )}

      {/* 里程碑管理 */}
      {tp.showMilestoneManager && (
        <MilestoneManager projectId={tp.showMilestoneManager} onClose={() => tp.setShowMilestoneManager(null)} />
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={tp.deleteAction.isOpen}
        onClose={tp.deleteAction.cancel}
        onConfirm={() => tp.deleteAction.confirm(async (id) => { await tp.deleteTaskAsync(id); })}
        title={t('common.confirm')} message={t('tasks.deleteConfirm')}
        confirmText={t('common.delete')} cancelText={t('common.cancel')}
        isLoading={tp.deleteAction.isLoading}
      />

      {/* 批量删除确认对话框 */}
      <ConfirmDialog
        isOpen={tp.batchDeleteConfirm.isOpen}
        onClose={tp.batchDeleteConfirm.cancel}
        onConfirm={() => tp.batchDeleteConfirm.confirm(tp.handleBatchDelete)}
        title={t('common.confirm')} message={`确定删除选中的 ${tp.selectedTaskIds.size} 个任务？此操作不可撤销。`}
        confirmText={t('common.delete')} cancelText={t('common.cancel')}
        isLoading={tp.batchDeleteConfirm.isLoading}
      />

      {/* 任务快捷菜单 */}
      {tp.menuTaskId && tp.menuPosition && (() => {
        const task = tp.tasks.find(t => t.id === tp.menuTaskId);
        if (!task) return null;
        return (
          <TaskContextMenu
            task={task}
            menuPosition={tp.menuPosition}
            menuRef={tp.menuRef as React.RefObject<HTMLDivElement>}
            STATUS_COLUMNS={tp.STATUS_COLUMNS}
            onStatusChange={tp.handleStatusChange}
            onDelete={async (taskId) => { await tp.deleteTaskAsync(taskId); }}
            onClose={() => { tp.setMenuTaskId(null); tp.setMenuPosition(null); }}
            deleteLabel={t('common.delete')}
          />
        );
      })()}
    </AppShell>
  );
}
