/**
 * 数据初始化 Hook
 * 统一加载所有领域数据，在应用启动时调用
 */

import { useProjectStore } from '@/domains/project';
import { useTaskStore } from '@/domains/task';
import { useMemberStore } from '@/domains/member';
import { useDocumentStore } from '@/domains/document';
import { useOpenClawStatusStore } from '@/core/gateway/openclaw.store';
import { useScheduledTaskStore } from '@/domains/schedule';
import { useDeliveryStore } from '@/domains/delivery';
import { useMilestoneStore } from '@/domains/milestone';
import { useUIStore } from '@/domains/ui';
import { useChatStore } from '@/domains/chat';
import { useSOPTemplateStore } from '@/domains/sop';
import { useRenderTemplateStore } from '@/domains/render-template';
import { useSkillStore } from '@/domains/skill';

export function useDataInitializer() {
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);
  const fetchOpenClawStatus = useOpenClawStatusStore((s) => s.fetchStatus);
  const fetchScheduledTasks = useScheduledTaskStore((s) => s.fetchTasks);
  const fetchDeliveries = useDeliveryStore((s) => s.fetchDeliveries);
  const fetchMilestones = useMilestoneStore((s) => s.fetchMilestones);
  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const fetchSOPTemplates = useSOPTemplateStore((s) => s.fetchTemplates);
  const fetchRenderTemplates = useRenderTemplateStore((s) => s.fetchTemplates);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const hydrated = useUIStore((s) => s.hydrated);

  const initialize = async () => {
    const results = await Promise.allSettled([
      fetchProjects(),
      fetchTasks(),
      fetchMembers(),
      fetchDocuments(),
      fetchOpenClawStatus(),
      fetchScheduledTasks(),
      fetchDeliveries(),
      fetchMilestones(),
      fetchSessions(),
      fetchSOPTemplates(),
      fetchRenderTemplates(),
      fetchSkills(),
    ]);

    // Log failed initializations without blocking others
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const names = ['projects', 'tasks', 'members', 'documents', 'openclawStatus', 'scheduledTasks', 'deliveries', 'milestones', 'sessions', 'sopTemplates', 'renderTemplates', 'skills'];
        console.error(`[DataInit] Failed to fetch ${names[idx]}:`, result.reason);
      }
    });
  };

  return { initialize, hydrated };
}
