/**
 * Skill MCP Handler
 * 
 * invoke_skill - 调用 Skill 执行任务
 * list_skills - 获取 Skill 列表
 */

import { db, skills, tasks, projects, documents } from '@/db';
import { eq, and, or, like, desc } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import path from 'path';
import type { HandlerResult } from '@/core/mcp/handler-base';

/**
 * invoke_skill - 调用 Skill 执行任务
 */
export async function handleInvokeSkill(params: Record<string, unknown>): Promise<HandlerResult> {
  const skill_key = params.skill_key as string;
  const task_id = params.task_id as string | undefined;
  const parameters = params.parameters as Record<string, unknown> | undefined;
  const context = params.context as {
    project_id?: string;
    member_id?: string;
    auto_load_context?: boolean;
  } | undefined;
  
  if (!skill_key) {
    return { success: false, message: 'Missing required parameter: skill_key' };
  }
  
  try {
    // 1. 查询 Skill
    const [skill] = await db
      .select()
      .from(skills)
      .where(and(
        eq(skills.skillKey, skill_key),
        eq(skills.status, 'active')
      ))
      .limit(1);
    
    if (!skill) {
      return { success: false, message: `Skill not found or not active: ${skill_key}` };
    }
    
    // 2. 检查信任状态
    if (skill.trustStatus !== 'trusted') {
      return { success: false, message: `Skill is not trusted: ${skill_key}. Current trust status: ${skill.trustStatus}` };
    }
    
    // 3. 加载 SKILL.md 内容
    if (!skill.skillPath) {
      return { success: false, message: `Skill path not configured for: ${skill_key}` };
    }
    
    const skillMdPath = path.join(skill.skillPath, 'SKILL.md');
    let skillContent: string;
    
    try {
      skillContent = await readFile(skillMdPath, 'utf-8');
    } catch {
      return { success: false, message: `Failed to read SKILL.md: ${skillMdPath}` };
    }
    
    // 4. 加载前置上下文
    let contextData: Record<string, unknown> = {};
    const autoLoadContext = context?.auto_load_context !== false;
    
    if (autoLoadContext) {
      contextData = await loadSkillContext({
        projectId: context?.project_id,
        taskId: task_id,
        memberId: context?.member_id,
      });
    }
    
    // 5. 返回执行指令
    return {
      success: true,
      message: `Skill "${skill.name}" loaded successfully`,
      data: {
        skill: {
          key: skill.skillKey,
          name: skill.name,
          description: skill.description,
          category: skill.category,
          version: skill.version,
        },
        content: skillContent,
        parameters: parameters || {},
        context: contextData,
        metadata: {
          invokedAt: new Date().toISOString(),
          taskId: task_id,
          projectId: context?.project_id,
        },
        instructions: [
          'Load and understand the Skill workflow from SKILL.md',
          'Gather required context based on the skill requirements',
          'Execute the workflow step by step',
          'Validate outputs according to skill validation criteria',
          'Report progress and results',
        ],
      },
    };
    
  } catch (error) {
    return { success: false, message: `Failed to invoke skill: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * list_skills - 获取 Skill 列表
 */
export async function handleListSkills(params: Record<string, unknown>): Promise<HandlerResult> {
  const category = params.category as string | undefined;
  const search = params.search as string | undefined;
  const limit = (params.limit as number) || 20;
  
  try {
    const conditions = [eq(skills.status, 'active')];
    
    if (category) {
      conditions.push(eq(skills.category, category as any));
    }
    
    if (search) {
      conditions.push(
        or(
          like(skills.name, `%${search}%`),
          like(skills.description, `%${search}%`)
        )!
      );
    }
    
    const skillList = await db
      .select({
        id: skills.id,
        skillKey: skills.skillKey,
        name: skills.name,
        description: skills.description,
        category: skills.category,
        version: skills.version,
        trustStatus: skills.trustStatus,
      })
      .from(skills)
      .where(and(...conditions))
      .orderBy(desc(skills.createdAt))
      .limit(Math.min(limit, 50));
    
    return {
      success: true,
      message: 'Skills retrieved successfully',
      data: {
        skills: skillList,
        total: skillList.length,
      },
    };
    
  } catch (error) {
    return { success: false, message: `Failed to list skills: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * 加载 Skill 执行上下文
 */
async function loadSkillContext(options: {
  projectId?: string;
  taskId?: string;
  memberId?: string;
}): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};
  
  try {
    if (options.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, options.projectId))
        .limit(1);
      
      if (project) {
        context.project = project;
        
        const projectDocs = await db
          .select({
            id: documents.id,
            title: documents.title,
            type: documents.type,
          })
          .from(documents)
          .where(eq(documents.projectId, options.projectId))
          .limit(20);
        
        context.documents = projectDocs;
      }
    }
    
    if (options.taskId) {
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, options.taskId))
        .limit(1);
      
      if (task) {
        context.task = task;
        
        if (task.projectId && !options.projectId) {
          const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, task.projectId))
            .limit(1);
          
          if (project) {
            context.project = project;
          }
        }
      }
    }
    
    if (options.memberId) {
      context.member = { id: options.memberId };
    }
    
  } catch (error) {
    console.error('[Skill Handler] Error loading context:', error);
  }
  
  return context;
}
