'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Textarea, Select, Card } from '@/shared/ui';
import { useConfirmAction } from '@/shared/hooks/useConfirmAction';
import ConfirmDialog from '@/shared/layout/ConfirmDialog';
import { X, Save, Users, Settings, Crown, Shield, User, Eye, Plus, Trash2, BookOpen, Wand2 } from 'lucide-react';
import { useDocumentStore } from '@/domains';
import type { KnowledgeConfig } from '@/db/schema';
import clsx from 'clsx';

interface ProjectMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
}

interface ProjectEditDialogProps {
  projectId: string | null;
  projectName: string;
  projectDesc: string;
  projectVisibility: 'private' | 'team' | 'public';
  knowledgeConfig?: KnowledgeConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, desc: string, visibility: 'private' | 'team' | 'public', knowledgeConfig?: KnowledgeConfig) => Promise<void>;
}

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5 text-amber-500" />,
  admin: <Shield className="w-3.5 h-3.5 text-blue-500" />,
  member: <User className="w-3.5 h-3.5 text-slate-500" />,
  viewer: <Eye className="w-3.5 h-3.5 text-slate-400" />,
};

type TabType = 'settings' | 'members' | 'knowledge';

export function ProjectEditDialog({
  projectId,
  projectName,
  projectDesc,
  projectVisibility,
  knowledgeConfig: initialKnowledgeConfig,
  isOpen,
  onClose,
  onSave,
}: ProjectEditDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [name, setName] = useState(projectName);
  const [desc, setDesc] = useState(projectDesc);
  const [visibility, setVisibility] = useState<'private' | 'team' | 'public'>(projectVisibility);
  const [saving, setSaving] = useState(false);

  // Members state
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [addingMember, setAddingMember] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // 移除成员确认
  const removeMemberConfirm = useConfirmAction<string>();

  // v3.1: 知识库配置状态
  const documents = useDocumentStore((s) => s.documents);
  const [knowledgeDocId, setKnowledgeDocId] = useState<string>(initialKnowledgeConfig?.documentId || '');
  const [knowledgeLayers, setKnowledgeLayers] = useState<string[]>(initialKnowledgeConfig?.layers || ['L1']);
  const [initializing, setInitializing] = useState(false);

  // 过滤出 guide 类型的文档作为知识库候选
  const guideDocs = useMemo(() => {
    return documents.filter(d => d.type === 'guide' || d.type === 'reference');
  }, [documents]);

  // 同步 props 到 state
  useEffect(() => {
    if (isOpen) {
      setName(projectName);
      setDesc(projectDesc);
      setVisibility(projectVisibility);
      setKnowledgeDocId(initialKnowledgeConfig?.documentId || '');
      setKnowledgeLayers(initialKnowledgeConfig?.layers || ['L1']);
      setActiveTab('settings');
    }
  }, [isOpen, projectName, projectDesc, projectVisibility, initialKnowledgeConfig]);

  // 加载成员
  useEffect(() => {
    if (isOpen && projectId) {
      fetchMembers();
      fetchUsers();
    }
  }, [isOpen, projectId]);

  const fetchMembers = async () => {
    if (!projectId) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        const userList = Array.isArray(data) ? data : (data.data || []);
        setUsers(userList);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const newKnowledgeConfig: KnowledgeConfig | undefined = knowledgeDocId
      ? { documentId: knowledgeDocId, layers: knowledgeLayers.length ? knowledgeLayers : ['L1'] }
      : undefined;
    await onSave(name.trim(), desc.trim() || '', visibility, newKnowledgeConfig);
    setSaving(false);
    onClose();
  };

  // 初始化知识库：使用现有 create_document 原子能力创建带 L1-L5 分层的文档
  const handleInitKnowledgeBase = async () => {
    if (!projectId) return;
    setInitializing(true);
    try {
      const content = `# ${name || '项目'} 知识库

## L1 核心概要
- **负责人**：
- **目标**：
- **关键规则**：

## L2 详细标准
### 编码规范
### 流程规范

## L3 案例模板

## L4 经验记录
### 踩坑记录
### 最佳实践

## L5 维护日志
`;

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${name || '项目'} 知识库`,
          content,
          projectId,
          source: 'internal',
          type: 'guide',
        }),
      });

      if (res.ok) {
        const doc = await res.json();
        setKnowledgeDocId(doc.id);
        setKnowledgeLayers(['L1', 'L2', 'L3', 'L4', 'L5']);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create knowledge base');
      }
    } catch (err) {
      console.error('Failed to init knowledge base:', err);
    } finally {
      setInitializing(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !projectId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });
      if (res.ok) {
        fetchMembers();
        setSelectedUserId('');
        setSelectedRole('member');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add member');
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = (memberId: string, role: string) => {
    if (role === 'owner') {
      alert('Cannot remove project owner');
      return;
    }
    removeMemberConfirm.requestConfirm(memberId);
  };

  const doRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const availableUsers = users.filter(
    u => !members.some(m => m.userId === u.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('projects.editProject')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setActiveTab('settings')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent hover:border-slate-200'
            )}
            style={{ color: activeTab === 'settings' ? undefined : 'var(--text-tertiary)' }}
          >
            <Settings className="w-3.5 h-3.5" />
            {t('projects.name')}
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'members'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent hover:border-slate-200'
            )}
            style={{ color: activeTab === 'members' ? undefined : 'var(--text-tertiary)' }}
          >
            <Users className="w-3.5 h-3.5" />
            {t('projects.manageMembers')}
            {members.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
                {members.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'knowledge'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent hover:border-slate-200'
            )}
            style={{ color: activeTab === 'knowledge' ? undefined : 'var(--text-tertiary)' }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {t('projects.knowledgeBase') || '知识库'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'settings' ? (
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('projects.projectName')}
                </label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('projects.projectNamePlaceholder')}
                  className="text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('projects.projectDesc')}
                </label>
                <Textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder={t('projects.projectDescPlaceholder')}
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('projects.visibility')}
                </label>
                <Select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value as 'private' | 'team' | 'public')}
                  className="text-sm"
                >
                  <option value="private">{t('projects.visPrivate')}</option>
                  <option value="team">{t('projects.visTeam')}</option>
                  <option value="public">{t('projects.visPublic')}</option>
                </Select>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  {visibility === 'private' && t('projects.visPrivateDesc')}
                  {visibility === 'team' && t('projects.visTeamDesc')}
                  {visibility === 'public' && t('projects.visPublicDesc')}
                </p>
              </div>
            </div>
          ) : activeTab === 'knowledge' ? (
            <div className="p-5 space-y-4">
              {/* 初始化按钮 */}
              {!knowledgeDocId && (
                <div className="p-4 rounded-lg border-2 border-dashed border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
                        {t('projects.initKnowledgeBase') || '初始化知识库'}
                      </p>
                      <p className="text-xs text-primary-600/70 dark:text-primary-400/70 mt-0.5">
                        {t('projects.initKnowledgeBaseHint') || '自动创建带 L1-L5 分层骨架的空白知识库文档'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleInitKnowledgeBase}
                      disabled={initializing || !projectId}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      {initializing ? t('common.loading') : t('projects.initKnowledgeBase')}
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('projects.knowledgeDoc') || '知识库文档'}
                </label>
                <Select
                  value={knowledgeDocId}
                  onChange={e => setKnowledgeDocId(e.target.value)}
                  className="text-sm"
                >
                  <option value="">{t('common.none') || '无'}</option>
                  {guideDocs.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  {t('projects.knowledgeDocHint') || '选择 Wiki 中的指南文档作为项目知识库，任务推送时将自动植入关键信息'}
                </p>
              </div>

              {knowledgeDocId && (
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t('projects.knowledgeLayers') || '读取层级'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['L1', 'L2', 'L3', 'L4', 'L5'].map(layer => (
                      <label
                        key={layer}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors',
                          knowledgeLayers.includes(layer)
                            ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-950'
                            : 'border-slate-200 hover:border-slate-300'
                        )}
                        style={{ borderColor: knowledgeLayers.includes(layer) ? undefined : 'var(--border)' }}
                      >
                        <input
                          type="checkbox"
                          checked={knowledgeLayers.includes(layer)}
                          onChange={e => {
                            if (e.target.checked) {
                              setKnowledgeLayers(prev => [...prev, layer]);
                            } else {
                              setKnowledgeLayers(prev => prev.filter(l => l !== layer));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded"
                        />
                        {layer}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    {t('projects.knowledgeLayersHint') || 'L1=核心规则(必读) L2=详细标准 L3=案例库 L4=经验记录 L5=维护日志'}
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>{t('common.tip') || '提示'}:</strong>{' '}
                  {t('projects.knowledgeTip') || '项目知识库中的 L1 层内容将在任务推送给 AI 时自动植入，作为关键上下文信息。建议使用 KnowHow 格式编写文档（## L1 / ## L2 等标题分层）。'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5">
              {/* Add member form */}
              <div className="flex gap-2 mb-4">
                <Select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="flex-1 text-sm"
                >
                  <option value="">{t('projects.selectUser')}</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
                <Select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  className="w-28 text-sm"
                >
                  <option value="admin">{t('projects.roleAdmin')}</option>
                  <option value="member">{t('projects.roleMember')}</option>
                  <option value="viewer">{t('projects.roleViewer')}</option>
                </Select>
                <Button
                  size="sm"
                  onClick={handleAddMember}
                  disabled={!selectedUserId || addingMember}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Member list */}
              {loadingMembers ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('common.loading')}
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('projects.noMembers')}
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {members.map(member => (
                    <li
                      key={member.id}
                      className="py-3 flex items-center gap-3"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
                      >
                        {member.userName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {member.userName || t('common.unnamed')}
                          </span>
                          <span className={clsx(
                            "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
                            member.role === 'owner' && "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300",
                            member.role === 'admin' && "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300",
                            member.role === 'member' && "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                            member.role === 'viewer' && "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500"
                          )}>
                            {roleIcons[member.role]}
                            {t(`projects.role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`)}
                          </span>
                        </div>
                        <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {member.userEmail}
                        </p>
                      </div>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.role)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 opacity-0 hover:opacity-100 transition-opacity"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? t('common.loading') : (
              <>
                <Save className="w-3.5 h-3.5" /> {t('common.save')}
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* 移除成员确认对话框 */}
      <ConfirmDialog
        isOpen={removeMemberConfirm.isOpen}
        onClose={removeMemberConfirm.cancel}
        onConfirm={() => removeMemberConfirm.confirm(async (memberId) => { await doRemoveMember(memberId); })}
        title={t('common.confirm')}
        message={t('projects.removeMemberConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={removeMemberConfirm.isLoading}
      />
    </div>
  );
}
