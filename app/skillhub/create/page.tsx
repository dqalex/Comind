'use client';

/**
 * SkillHub 创建/安装页面
 * 
 * 路径: /skillhub/create
 * 
 * 功能:
 * - 自动发现项目内的 Skill
 * - 显示可安装/可更新的 Skill 列表
 * - 一键安装/更新
 * - 手动输入路径安装
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Label, Badge } from '@/shared/ui';
import { useSkillStore, useAuthStore } from '@/domains';
import { skillsApi } from '@/lib/data-service';
import {
  ArrowLeft, Zap, AlertCircle, RefreshCw, Download, Upload, Check, X, Folder, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

// 发现的 Skill 类型
interface DiscoveredSkill {
  name: string;
  description: string;
  version: string;
  category?: string;
  skillPath: string;
  namespace: string;
  skillKey: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  // 本地记录状态
  localStatus?: 'not_recorded' | 'draft' | 'pending_approval' | 'active' | 'rejected';
  localVersion?: string;
  localId?: string;
  // 安装状态（对比版本）
  installStatus?: 'not_installed' | 'installed' | 'update_available';
  installedVersion?: string;
  installedId?: string;
  // Gateway 实际状态
  gatewayStatus?: 'installed' | 'not_installed' | 'unknown' | 'not_applicable' | 'error';
}

// 分类颜色映射
const CATEGORY_COLORS: Record<string, string> = {
  content: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  analysis: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  research: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  development: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  operations: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  media: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function CreateSkillPage() {
  const { t } = useTranslation();
  const router = useRouter();
  
  // Store
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  
  // 发现状态
  const [discovered, setDiscovered] = useState<DiscoveredSkill[]>([]);
  const [discovering, setDiscovering] = useState(true);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [skillsFolderPath, setSkillsFolderPath] = useState<string>('');
  
  // 安装状态
  const [installing, setInstalling] = useState<string | null>(null); // skillKey
  const [installResults, setInstallResults] = useState<Map<string, { success: boolean; message: string }>>(new Map());
  
  // 手动安装
  const [manualPath, setManualPath] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  
  // 发现 Skill
  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    setDiscoverError(null);
    
    try {
      const { data, error } = await skillsApi.discover();
      
      if (error) {
        setDiscoverError(error);
      } else if (data) {
        setDiscovered(data.skills || []);
        setSkillsFolderPath(data.skillsFolderPath || '');
      }
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'Failed to discover skills');
    } finally {
      setDiscovering(false);
    }
  }, []);
  
  // 初始化时发现
  useEffect(() => {
    handleDiscover();
  }, [handleDiscover]);
  
  // 安装/更新 Skill
  const handleInstall = async (skill: DiscoveredSkill, force = false) => {
    setInstalling(skill.skillKey);
    
    try {
      const { data, error } = await skillsApi.installFromPath(skill.skillPath, force);
      
      if (error) {
        setInstallResults(prev => new Map(prev).set(skill.skillKey, {
          success: false,
          message: error,
        }));
        toast.error(error);
      } else if (data) {
        const message = data.action === 'created' 
          ? t('skillhub.install.successCreated')
          : data.action === 'updated'
          ? t('skillhub.install.successUpdated', { from: data.previousVersion, to: data.newVersion })
          : t('skillhub.install.success');
        
        setInstallResults(prev => new Map(prev).set(skill.skillKey, {
          success: true,
          message,
        }));
        
        // 更新本地状态
        setDiscovered(prev => prev.map(s => 
          s.skillKey === skill.skillKey
            ? { ...s, installStatus: 'installed', installedVersion: data.newVersion || skill.version, installedId: data.id, localStatus: 'draft', localId: data.id }
            : s
        ));
        
        // 刷新 store
        await fetchSkills();
        
        // 安装成功后 toast 引导提交审批
        toast.success(message, {
          duration: 5000,
          action: {
            label: t('skillhub.install.goToDetail', '前往提交审批'),
            onClick: () => router.push(`/skillhub/${data.id}`),
          },
        });
      }
    } catch (err) {
      setInstallResults(prev => new Map(prev).set(skill.skillKey, {
        success: false,
        message: err instanceof Error ? err.message : 'Install failed',
      }));
    } finally {
      setInstalling(null);
    }
  };
  
  // 手动安装
  const handleManualInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualPath.trim()) {
      setManualError(t('skillhub.create.error'));
      return;
    }
    
    setInstalling('manual');
    setManualError(null);
    
    try {
      const { data, error } = await skillsApi.installFromPath(manualPath.trim());
      
      if (error) {
        setManualError(error);
      } else if (data) {
        await fetchSkills();
        router.push(`/skillhub/${data.id}`);
      }
    } catch (err) {
      setManualError(err instanceof Error ? err.message : t('skillhub.create.error'));
    } finally {
      setInstalling(null);
    }
  };
  
  // 渲染 Skill 卡片
  const renderSkillCard = (skill: DiscoveredSkill) => {
    const isInstalling = installing === skill.skillKey;
    const result = installResults.get(skill.skillKey);
    
    return (
      <Card key={skill.skillKey} className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{skill.name}</h3>
                {skill.category && (
                  <Badge className={CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.custom}>
                    {skill.category}
                  </Badge>
                )}
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                  v{skill.version}
                </span>
              </div>
              
              <p className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--text-secondary)' }}>
                {skill.description}
              </p>
              
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span className="flex items-center gap-1">
                  <Folder className="w-3 h-3" />
                  {skill.namespace}
                </span>
                
                {/* 显示本地记录状态和 Gateway 激活状态 */}
                {skill.localStatus === 'active' ? (
                  skill.gatewayStatus === 'not_installed' ? (
                    // 状态不一致：数据库标记为 active，但 Gateway 中未安装
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3 h-3" />
                      {t('skillhub.install.statusMismatch')} v{skill.localVersion}
                    </span>
                  ) : skill.installStatus === 'update_available' ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Upload className="w-3 h-3" />
                      {t('skillhub.install.updateAvailable')} v{skill.localVersion} → v{skill.version}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Check className="w-3 h-3" />
                      {t('skillhub.install.statusActive')} v{skill.localVersion}
                    </span>
                  )
                ) : skill.localStatus === 'draft' ? (
                  <span className="flex items-center gap-1 text-slate-500">
                    <AlertCircle className="w-3 h-3" />
                    {t('skillhub.install.statusDraft')} v{skill.localVersion}
                  </span>
                ) : skill.localStatus === 'pending_approval' ? (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="w-3 h-3" />
                    {t('skillhub.install.statusPendingApproval')} v{skill.localVersion}
                  </span>
                ) : skill.localStatus === 'rejected' ? (
                  <span className="flex items-center gap-1 text-red-500">
                    <X className="w-3 h-3" />
                    {t('skillhub.install.statusRejected')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                    <Download className="w-3 h-3" />
                    {t('skillhub.install.statusNotInstalled')}
                  </span>
                )}
              </div>
              
              {!skill.valid && (
                <div className="mt-2 text-xs text-red-500">
                  {skill.errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
              
              {result && (
                <div className={`mt-2 text-xs ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {result.message}
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              {/* 未记录或已拒绝：显示安装按钮 */}
              {(skill.localStatus === 'not_recorded' || skill.localStatus === 'rejected') && skill.valid && (
                <Button
                  size="sm"
                  onClick={() => handleInstall(skill)}
                  disabled={isInstalling}
                  className="flex items-center gap-1"
                >
                  {isInstalling ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  {t('skillhub.install.install')}
                </Button>
              )}
              
              {/* 草稿状态：显示查看详情按钮 */}
              {skill.localStatus === 'draft' && skill.localId && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/skillhub/${skill.localId}`)}
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('skillhub.install.viewDetail')}
                </Button>
              )}
              
              {/* 审批中：禁用按钮 */}
              {skill.localStatus === 'pending_approval' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  className="flex items-center gap-1"
                >
                  <AlertCircle className="w-3 h-3" />
                  {t('skillhub.install.statusPendingBtn')}
                </Button>
              )}
              
              {/* 已激活且有更新 */}
              {skill.localStatus === 'active' && skill.installStatus === 'update_available' && skill.gatewayStatus !== 'not_installed' && (
                <Button
                  size="sm"
                  onClick={() => handleInstall(skill)}
                  disabled={isInstalling}
                  className="flex items-center gap-1"
                >
                  {isInstalling ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  {t('skillhub.install.updateButton')}
                </Button>
              )}
              
              {/* 状态不一致：数据库 active 但 Gateway 未安装 - 重新安装 */}
              {skill.localStatus === 'active' && skill.gatewayStatus === 'not_installed' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleInstall(skill, true)}
                  disabled={isInstalling}
                  className="flex items-center gap-1"
                >
                  {isInstalling ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  {t('skillhub.install.reinstallButton')}
                </Button>
              )}
              
              {/* 已激活无更新：查看详情 */}
              {skill.localStatus === 'active' && skill.installStatus === 'installed' && skill.gatewayStatus !== 'not_installed' && skill.localId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push(`/skillhub/${skill.localId}`)}
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('skillhub.install.view')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  // 按状态分组
  const groupedSkills = {
    // 状态不一致（数据库 active 但 Gateway 未安装）
    gatewayMismatch: (discovered || []).filter(s => s.localStatus === 'active' && s.gatewayStatus === 'not_installed'),
    // 可更新（已激活但版本更高）
    updateAvailable: (discovered || []).filter(s => s.localStatus === 'active' && s.installStatus === 'update_available' && s.gatewayStatus !== 'not_installed'),
    // 未记录或已拒绝（需要安装）
    notInstalled: (discovered || []).filter(s => s.localStatus === 'not_recorded' || s.localStatus === 'rejected'),
    // 草稿和审批中（已记录但未激活）
    pending: (discovered || []).filter(s => s.localStatus === 'draft' || s.localStatus === 'pending_approval'),
    // 已激活且最新
    installed: (discovered || []).filter(s => s.localStatus === 'active' && s.installStatus === 'installed' && s.gatewayStatus !== 'not_installed'),
  };
  
  return (
    <AppShell>
      <Header 
        title={t('skillhub.create.title')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${discovering ? 'animate-spin' : ''}`} />
              {t('skillhub.install.refresh')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push('/skillhub')}
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Button>
          </div>
        }
      />
      
      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto">
        {/* Skill 文件夹路径 */}
        {skillsFolderPath && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'var(--surface-secondary)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('skillhub.install.skillsFolder')}:</span>{' '}
            <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--surface-tertiary)' }}>
              {skillsFolderPath}
            </code>
          </div>
        )}
        
        {/* 发现错误 */}
        {discoverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{discoverError}</p>
          </div>
        )}
        
        {/* 非管理员提示 */}
        {!isAdmin && discoverError?.includes('Admin permission required') && (
          <Card className="mb-4 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-sm mb-1">{t('skillhub.install.adminRequired')}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('skillhub.install.adminRequiredHint')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* 加载中 */}
        {discovering && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>{t('skillhub.install.discovering')}</span>
          </div>
        )}
        
        {/* Skill 列表 */}
        {!discovering && discovered.length > 0 && (
          <div className="space-y-6">
            {/* 状态不一致：需要重新安装 */}
            {groupedSkills.gatewayMismatch.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  {t('skillhub.install.groupGatewayMismatch')} ({groupedSkills.gatewayMismatch.length})
                </h2>
                <div className="p-3 mb-3 rounded-lg bg-red-50 dark:bg-red-950 text-sm">
                  <p className="text-red-600 dark:text-red-400">
                    {t('skillhub.install.gatewayMismatchHint')}
                  </p>
                </div>
                <div className="space-y-3">
                  {groupedSkills.gatewayMismatch.map(renderSkillCard)}
                </div>
              </div>
            )}
            
            {/* 可更新 */}
            {groupedSkills.updateAvailable.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-500" />
                  {t('skillhub.install.groupUpdateAvailable')} ({groupedSkills.updateAvailable.length})
                </h2>
                <div className="space-y-3">
                  {groupedSkills.updateAvailable.map(renderSkillCard)}
                </div>
              </div>
            )}
            
            {/* 未安装 */}
            {groupedSkills.notInstalled.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  {t('skillhub.install.groupNotInstalled')} ({groupedSkills.notInstalled.length})
                </h2>
                <div className="space-y-3">
                  {groupedSkills.notInstalled.map(renderSkillCard)}
                </div>
              </div>
            )}
            
            {/* 处理中（草稿/审批中） */}
            {groupedSkills.pending.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  {t('skillhub.install.groupPending')} ({groupedSkills.pending.length})
                </h2>
                <div className="space-y-3">
                  {groupedSkills.pending.map(renderSkillCard)}
                </div>
              </div>
            )}
            
            {/* 已安装 */}
            {groupedSkills.installed.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  {t('skillhub.install.groupInstalled')} ({groupedSkills.installed.length})
                </h2>
                <div className="space-y-3">
                  {groupedSkills.installed.map(renderSkillCard)}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* 无发现的 Skill */}
        {!discovering && discovered.length === 0 && (
          <div className="text-center py-12">
            <Folder className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>{t('skillhub.install.noSkillsFound')}</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('skillhub.install.noSkillsHint')}
            </p>
          </div>
        )}
        
        {/* 手动安装 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {t('skillhub.install.manualTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <form onSubmit={handleManualInstall} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manualPath">{t('skillhub.create.skillPath')}</Label>
                <Input
                  id="manualPath"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder={t('skillhub.create.skillPathPlaceholder')}
                />
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.create.skillPathHint')}
                </p>
              </div>
              
              {manualError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{manualError}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={installing === 'manual' || !manualPath.trim()}
                  className="flex items-center gap-1.5"
                >
                  {installing === 'manual' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {t('skillhub.create.submit')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
