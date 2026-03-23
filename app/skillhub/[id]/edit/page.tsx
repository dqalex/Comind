'use client';

/**
 * SkillHub 编辑页面
 * 
 * 路径: /skillhub/[id]/edit
 * 
 * 功能:
 * - 编辑技能基本信息
 * - 修改分类、描述等
 * - 仅创建者和管理员可访问
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { Button, Input, Badge, Card, CardContent, CardHeader, CardTitle, Label, Textarea, Select } from '@/shared/ui';
import { useSkillStore, useAuthStore } from '@/domains';
import { skillsApi } from '@/lib/data-service';
import type { Skill } from '@/db/schema';
import {
  ArrowLeft, Save, Zap, AlertTriangle, Loader2,
} from 'lucide-react';
import clsx from 'clsx';

// 分类选项
const CATEGORY_OPTIONS = [
  { value: 'content', labelKey: 'skillhub.category.content' },
  { value: 'analysis', labelKey: 'skillhub.category.analysis' },
  { value: 'research', labelKey: 'skillhub.category.research' },
  { value: 'development', labelKey: 'skillhub.category.development' },
  { value: 'operations', labelKey: 'skillhub.category.operations' },
  { value: 'media', labelKey: 'skillhub.category.media' },
  { value: 'custom', labelKey: 'skillhub.category.custom' },
];

export default function EditSkillPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const skillId = params?.id as string;
  
  // Store
  const skills = useSkillStore((s) => s.skills);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  
  // 表单状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'custom',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 防抖
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // 加载技能
  useEffect(() => {
    const loadSkill = async () => {
      if (!skillId) return;
      
      // 先从本地查找
      const localSkill = skills.find(s => s.id === skillId);
      if (localSkill) {
        setSkill(localSkill);
        setFormData({
          name: localSkill.name,
          description: localSkill.description || '',
          category: localSkill.category || 'custom',
        });
        setLoading(false);
        return;
      }
      
      // 从 API 加载
      try {
        const { data, error } = await skillsApi.getById(skillId);
        if (data) {
          setSkill(data);
          setFormData({
            name: data.name,
            description: data.description || '',
            category: data.category || 'custom',
          });
        } else {
          console.error('Failed to load skill:', error);
        }
      } catch (err) {
        console.error('Error loading skill:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadSkill();
  }, [skillId, skills]);
  
  // 权限检查
  const canEdit = useMemo(() => {
    if (!skill || !user) return false;
    return skill.createdBy === user.id || isAdmin;
  }, [skill, user, isAdmin]);
  
  // 权限重定向
  useEffect(() => {
    if (!loading && skill && !canEdit) {
      router.push(`/skillhub/${skillId}`);
    }
  }, [loading, skill, canEdit, router, skillId]);
  
  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('common.required');
    } else if (formData.name.length > 100) {
      newErrors.name = t('skillhub.edit.nameTooLong');
    }
    
    if (formData.description && formData.description.length > 500) {
      newErrors.description = t('skillhub.edit.descriptionTooLong');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!skill || !validateForm()) return;
    
    setSaving(true);
    try {
      const { data, error } = await skillsApi.update(skill.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category as 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media' | 'custom',
      });
      
      if (error) {
        setErrors({ submit: error });
      } else if (data) {
        await fetchSkills();
        router.push(`/skillhub/${skill.id}`);
      }
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };
  
  // 更新字段
  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 清除该字段错误
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };
  
  // 防抖更新（用于输入框）
  const debouncedUpdate = (field: keyof typeof formData, value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateField(field, value);
    }, 500);
  };
  
  if (loading) {
    return (
      <AppShell>
        <Header title={t('skillhub.edit.title')} />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        </main>
      </AppShell>
    );
  }
  
  if (!skill) {
    return (
      <AppShell>
        <Header title={t('skillhub.edit.title')} />
        <main className="flex-1 p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <p style={{ color: 'var(--text-tertiary)' }}>{t('common.notFound')}</p>
              <Button onClick={() => router.push('/skillhub')} className="mt-4">
                {t('common.back')}
              </Button>
            </CardContent>
          </Card>
        </main>
      </AppShell>
    );
  }
  
  if (!canEdit) {
    return null; // 正在重定向
  }
  
  return (
    <AppShell>
      <Header 
        title={t('skillhub.edit.title')}
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/skillhub/${skillId}`)}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
        }
      />
      
      <main className="flex-1 p-6 overflow-auto max-w-2xl mx-auto">
        <form onSubmit={handleSubmit}>
          {/* 基本信息卡片 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {t('skillhub.detail.basicInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* 名称 */}
              <div className="space-y-2">
                <Label htmlFor="name">{t('skillhub.create.name')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                    debouncedUpdate('name', e.target.value);
                  }}
                  placeholder={t('skillhub.create.namePlaceholder')}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name}</p>
                )}
              </div>
              
              {/* 描述 */}
              <div className="space-y-2">
                <Label htmlFor="description">{t('skillhub.detail.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, description: e.target.value }));
                    debouncedUpdate('description', e.target.value);
                  }}
                  placeholder={t('skillhub.create.descriptionPlaceholder')}
                  rows={3}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                  <p className="text-xs text-red-500">{errors.description}</p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {formData.description.length}/500
                </p>
              </div>
              
              {/* 分类 */}
              <div className="space-y-2">
                <Label htmlFor="category">{t('skillhub.detail.category')}</Label>
                <Select
                  id="category"
                  value={formData.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  options={CATEGORY_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }))}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* 只读信息卡片 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">{t('skillhub.edit.readOnlyInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('skillhub.detail.skillKey')}
                  </label>
                  <p className="font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                    {skill.skillKey}
                  </p>
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('skillhub.detail.version')}
                  </label>
                  <p className="mt-1" style={{ color: 'var(--text-primary)' }}>
                    v{skill.version}
                  </p>
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('skillhub.detail.status')}
                  </label>
                  <div className="mt-1">
                    <Badge className="text-xs">
                      {t(`skillhub.status.${skill.status}`)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('skillhub.detail.source')}
                  </label>
                  <p className="mt-1" style={{ color: 'var(--text-primary)' }}>
                    {skill.source}
                  </p>
                </div>
              </div>
              
              {skill.isSensitive && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">{t('skillhub.detail.sensitive')}</span>
                  </div>
                  {skill.sensitivityNote && (
                    <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">
                      {skill.sensitivityNote}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* 错误提示 */}
          {errors.submit && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
              {errors.submit}
            </div>
          )}
          
          {/* 提交按钮 */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/skillhub/${skillId}`)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
