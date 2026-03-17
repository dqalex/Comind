'use client';

/**
 * SkillHub 列表页面
 * 
 * 路径: /skillhub
 * 
 * 功能:
 * - 展示 Gateway Agent 的技能列表（与 /agents 页面一致）
 * - 内置技能 = 无风险
 * - 扩展技能 = 待审核（需要管理员审核）
 * - 技能开关
 * - 安装新技能
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import GatewayRequired from '@/components/GatewayRequired';
import { Button, Input, Badge } from '@/components/ui';
import { useGatewayStore, useAuthStore } from '@/domains';
import type { Skill } from '@/types';
import {
  Zap, Search, Plus, ToggleLeft, ToggleRight, 
  AlertTriangle, Loader2, RefreshCw, Settings2, CheckCircle, Shield,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

// 数据库中的 Skill 信任状态
interface DbSkillTrust {
  skillKey: string;
  trustStatus: 'trusted' | 'untrusted' | 'pending';
}

export default function SkillHubPage() {
  const { t } = useTranslation();
  const router = useRouter();
  
  // Gateway Store - 使用与 /agents 页面相同的数据源
  const skills = useGatewayStore((s) => s.skills);
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const toggleSkill = useGatewayStore((s) => s.toggleSkill);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);
  
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  
  // 本地状态
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [trusting, setTrusting] = useState<string | null>(null);
  
  // 数据库中的信任状态（仅扩展技能需要）
  const [trustMap, setTrustMap] = useState<Map<string, 'trusted' | 'untrusted' | 'pending'>>(new Map());
  
  // 刷新技能列表
  useEffect(() => {
    if (serverProxyConnected) {
      refreshSkills();
    }
  }, [serverProxyConnected, refreshSkills]);
  
  // 获取数据库中的信任状态（仅查询扩展技能）
  const fetchTrustStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/skills?limit=1000');
      if (res.ok) {
        const json = await res.json();
        const list: DbSkillTrust[] = Array.isArray(json.data) ? json.data : (json.data?.data || []);
        const map = new Map<string, 'trusted' | 'untrusted' | 'pending'>();
        list.forEach(s => map.set(s.skillKey, s.trustStatus));
        setTrustMap(map);
      }
    } catch (e) {
      console.error('Failed to fetch trust status:', e);
    }
  }, []);
  
  useEffect(() => {
    fetchTrustStatus();
  }, [fetchTrustStatus]);
  
  // 过滤后的技能列表
  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.skillKey.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  }, [skills, search]);
  
  // 分组：内置 vs 扩展
  const groupedSkills = useMemo(() => {
    const builtIn = filteredSkills.filter(s => s.bundled);
    const extensions = filteredSkills.filter(s => !s.bundled);
    return { builtIn, extensions };
  }, [filteredSkills]);
  
  // 统计信息
  const stats = useMemo(() => {
    const pendingCount = skills.filter(s => {
      if (s.bundled) return false; // 内置技能不计入待审核
      const status = trustMap.get(s.skillKey);
      return status !== 'trusted'; // 未信任的扩展技能
    }).length;
    
    return {
      total: skills.length,
      builtIn: skills.filter(s => s.bundled).length,
      extensions: skills.filter(s => !s.bundled).length,
      enabled: skills.filter(s => !s.disabled).length,
      unavailable: skills.filter(s => !s.eligible || s.missing.bins.length > 0).length,
      pending: pendingCount,
    };
  }, [skills, trustMap]);
  
  // 切换技能状态
  const handleToggle = async (skillKey: string, enabled: boolean) => {
    setToggling(skillKey);
    try {
      await toggleSkill(skillKey, enabled);
      toast.success(enabled ? t('agents.enabled', '已启用') : t('agents.disabled', '已禁用'));
    } catch {
      toast.error(t('agents.toggleFailed', '操作失败'));
    } finally {
      setToggling(null);
    }
  };
  
  // 安装技能（已移除内联安装对话框，统一使用 /skillhub/create 页面）
  
  // 审核技能（信任）
  const handleTrust = async (skill: Skill) => {
    if (!isAdmin) return;
    setTrusting(skill.skillKey);
    try {
      const res = await fetch('/api/skills/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillKey: skill.skillKey,
          name: skill.name,
          description: skill.description,
        }),
      });
      if (res.ok) {
        // 更新本地信任状态
        setTrustMap(prev => {
          const next = new Map(prev);
          next.set(skill.skillKey, 'trusted');
          return next;
        });
        toast.success(t('skillhub.trustSuccess', '已信任此技能'));
      } else {
        toast.error(t('skillhub.trustFailed', '信任操作失败'));
      }
    } catch {
      toast.error(t('skillhub.trustFailed', '信任操作失败'));
    } finally {
      setTrusting(null);
    }
  };
  
  // 获取扩展技能的信任状态
  const getTrustStatus = (skill: Skill): 'trusted' | 'pending' => {
    if (skill.bundled) return 'trusted'; // 内置技能始终信任
    const status = trustMap.get(skill.skillKey);
    return status === 'trusted' ? 'trusted' : 'pending';
  };
  
  // 渲染技能卡片
  const renderSkillCard = (skill: Skill) => {
    const isToggling = toggling === skill.skillKey;
    const isTrusting = trusting === skill.skillKey;
    const trustStatus = getTrustStatus(skill);
    const isTrusted = trustStatus === 'trusted';
    
    return (
      <div 
        key={skill.skillKey} 
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border mb-1.5"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* 图标 */}
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm flex-shrink-0">
          {skill.emoji || <Zap className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />}
        </div>
        
        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {skill.name}
            </span>
            {skill.blockedByAllowlist && (
              <Badge className="text-[10px] bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400">
                blocked
              </Badge>
            )}
            {!skill.eligible && !skill.blockedByAllowlist && (
              <Badge className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                {t('agents.unavailable')}
              </Badge>
            )}
          </div>
          <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
            {skill.description}
          </div>
          {skill.missing.bins.length > 0 && (
            <div className="text-[10px] text-red-400 mt-0.5">
              {t('agents.missing')}: {skill.missing.bins.join(', ')}
            </div>
          )}
        </div>
        
        {/* 操作区 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 来源标签 */}
          <Badge className={clsx(
            'text-[10px]',
            skill.bundled 
              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' 
              : 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
          )}>
            {skill.bundled ? t('agents.builtIn') : t('agents.extension')}
          </Badge>
          
          {/* 信任状态（仅扩展技能显示） */}
          {!skill.bundled && (
            isTrusted ? (
              // 已信任
              <Badge className="text-[10px] bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {t('skillhub.trust.trusted')}
              </Badge>
            ) : (
              // 待信任 + 信任按钮
              <div className="flex items-center gap-1">
                <Badge className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('skillhub.trust.pending')}
                </Badge>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTrust(skill)}
                    disabled={isTrusting}
                    className="h-5 px-1.5 text-[10px]"
                    title={t('skillhub.detail.trustSkill', 'Trust this skill')}
                  >
                    {isTrusting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Shield className="w-3 h-3" />
                    )}
                    {t('skillhub.detail.trust')}
                  </Button>
                )}
              </div>
            )
          )}
          
          {/* 开关按钮 */}
          <button
            onClick={() => handleToggle(skill.skillKey, skill.disabled)}
            className="p-1 disabled:opacity-50"
            title={skill.disabled ? t('agents.enable') : t('agents.disable')}
            disabled={isToggling}
          >
            {isToggling ? (
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            ) : !skill.disabled ? (
              <ToggleRight className="w-5 h-5 text-green-500" />
            ) : (
              <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            )}
          </button>
        </div>
      </div>
    );
  };
  
  // 渲染分组
  const renderGroup = (title: string, skillList: Skill[], icon: React.ReactNode) => {
    if (skillList.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
          {icon}
          {title} ({skillList.length})
        </h3>
        <div className="space-y-1.5">
          {skillList.map(renderSkillCard)}
        </div>
      </div>
    );
  };
  
  return (
    <AppShell>
      <GatewayRequired>
        <Header 
          title={t('skillhub.title')} 
          actions={
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push('/skillhub/settings')}
                  className="flex items-center gap-1.5"
                >
                  <Settings2 className="w-4 h-4" />
                  {t('common.settings')}
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => router.push('/skillhub/create')}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {t('skillhub.install.discover', '发现并安装')}
              </Button>
            </div>
          }
        />
        
        <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto">
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="p-4 rounded-lg border text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.total}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('skillhub.stats.total')}
              </div>
            </div>
            <div className="p-4 rounded-lg border text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('skillhub.stats.active')}
              </div>
            </div>
            <div className="p-4 rounded-lg border text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold text-slate-600">{stats.builtIn}</div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('agents.builtIn')}
              </div>
            </div>
            <div className="p-4 rounded-lg border text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold text-blue-600">{stats.extensions}</div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('agents.extension')}
              </div>
            </div>
            <div className="p-4 rounded-lg border text-center" style={{ borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('skillhub.trust.pending')}
              </div>
            </div>
          </div>
          
          {/* 搜索 */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 min-w-[200px]">
              <Input
                icon={<Search className="w-4 h-4" />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('skillhub.search')}
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refreshSkills()}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.refresh')}
            </Button>
          </div>
          
          {/* 技能列表 */}
          {filteredSkills.length === 0 ? (
            <div className="text-center py-12 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <Zap className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>{t('skillhub.noSkills')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('skillhub.install.noSkillsHint')}
              </p>
            </div>
          ) : (
            <>
              {/* 扩展技能（待审核，排在前面） */}
              {renderGroup(t('agents.extension'), groupedSkills.extensions, <Zap className="w-3.5 h-3.5 text-blue-500" />)}
              
              {/* 内置技能（无风险） */}
              {renderGroup(t('agents.builtIn'), groupedSkills.builtIn, <Zap className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />)}
            </>
          )}
        </main>
      </GatewayRequired>
    </AppShell>
  );
}
