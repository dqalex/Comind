/**
 * Skill 生成器
 * 
 * 从 SOP 模板生成符合 TEAMCLAW_SKILL_DESIGN.md 规范的 SKILL.md
 * 
 * @module lib/skill-generator
 */

import type { 
  SOPTemplate, 
  SOPStage, 
  ReferenceFile, 
  ScriptFile 
} from '@/db/schema';

// ============================================================================
// 类型定义
// ============================================================================

/** Skill Frontmatter */
export interface SkillFrontmatter {
  name: string;              // Skill 唯一标识，如 teamclaw.sop.weekly-report
  version: string;           // 版本号
  description: string;       // 描述
  category: string;          // 分类
  source: 'sop';             // 来源固定为 sop
  sopTemplateId: string;     // 关联的 SOP 模板 ID
}

/** Skill 安装包结构 */
export interface SkillPackage {
  skillMd: string;                       // SKILL.md 内容
  references: ReferenceFile[];           // 参考文档列表
  scripts: ScriptFile[];                 // 脚本列表
  manifest: SkillManifest;               // 元数据
}

/** Skill 安装包 manifest */
export interface SkillManifest {
  version: string;
  format: 'teamclaw-skill-package';
  sopTemplateId: string;
  createdAt: string;
  checksum: string;
}

// ============================================================================
// Skill 生成器
// ============================================================================

/**
 * 从 SOP 模板生成完整 Skill 内容
 */
export function generateSkillFromSOP(template: SOPTemplate): string {
  const frontmatter: SkillFrontmatter = {
    name: `teamclaw.sop.${template.id}`,
    version: template.version || '1.0.0',
    description: template.description || '',
    category: template.category || 'custom',
    source: 'sop',
    sopTemplateId: template.id,
  };

  const sections: string[] = [
    generateFrontmatter(frontmatter),
    '',
    `# ${template.name}`,
    '',
    ...(template.description ? [template.description, ''] : []),
    '> 本 Skill 由 TeamClaw 自动生成，包含项目上下文加载能力',
    `> **版本**: ${template.version || '1.0.0'}`,
    `> **项目地址**: https://github.com/dqalex/teamclaw`,
    '',
    generateStage0(),
    '',
    generateUserStages(template.stages || []),
    '',
    generateStageN1(),
  ];

  // 添加参考文档索引（如果有）
  const references = template.references || [];
  if (references.length > 0) {
    sections.push('');
    sections.push(generateReferencesIndex(references));
  }

  // 添加脚本索引（如果有）
  const scripts = template.scripts || [];
  if (scripts.length > 0) {
    sections.push('');
    sections.push(generateScriptsIndex(scripts));
  }

  return sections.join('\n');
}

/**
 * 生成完整 Skill 安装包
 */
export function generateSkillPackage(template: SOPTemplate): SkillPackage {
  const skillMd = generateSkillFromSOP(template);
  const references = template.references || [];
  const scripts = template.scripts || [];
  
  // 计算 checksum（基于 SKILL.md 内容）
  const checksum = simpleChecksum(skillMd);
  
  const manifest: SkillManifest = {
    version: template.version || '1.0.0',
    format: 'teamclaw-skill-package',
    sopTemplateId: template.id,
    createdAt: new Date().toISOString(),
    checksum,
  };

  return {
    skillMd,
    references,
    scripts,
    manifest,
  };
}

// ============================================================================
// 内部生成函数
// ============================================================================

/**
 * 生成 YAML Frontmatter
 */
function generateFrontmatter(fm: SkillFrontmatter): string {
  const lines = [
    '---',
    `name: ${fm.name}`,
    `version: ${fm.version}`,
    `description: ${escapeYamlString(fm.description)}`,
    `category: ${fm.category}`,
    `source: ${fm.source}`,
    `sopTemplateId: ${fm.sopTemplateId}`,
    '---',
  ];
  return lines.join('\n');
}

/**
 * 阶段 0: 项目上下文加载（固定）
 */
function generateStage0(): string {
  return `## 阶段 0: 项目上下文加载

### 执行步骤

1. **获取项目信息**
   \`\`\`json
   {"tool": "get_project", "parameters": {"project_id": "{{project_id}}"}}
   \`\`\`

2. **查询相关文档**
   \`\`\`json
   {"tool": "search_documents", "parameters": {"project_id": "{{project_id}}", "query": "{{task_keyword}}"}}
   \`\`\`

3. **加载团队成员**
   \`\`\`json
   {"tool": "get_project_members", "parameters": {"project_id": "{{project_id}}"}}
   \`\`\`

4. **获取当前任务**
   \`\`\`json
   {"tool": "list_my_tasks", "parameters": {"project_id": "{{project_id}}", "status": "in_progress"}}
   \`\`\`

### 输出变量

| 变量名 | 说明 |
|--------|------|
| \`{{project_name}}\` | 项目名称 |
| \`{{project_description}}\` | 项目描述 |
| \`{{related_docs}}\` | 相关文档摘要 |
| \`{{team_members}}\` | 团队成员列表 |
| \`{{current_tasks}}\` | 当前进行中任务 |`;
}

/**
 * 用户定义阶段
 */
function generateUserStages(stages: SOPStage[]): string {
  if (stages.length === 0) {
    return `## 阶段 1-N: 用户定义工作流

（暂无自定义阶段）`;
  }

  return stages.map((stage, i) => {
    const lines: string[] = [
      `## 阶段 ${i + 1}: ${stage.label}`,
      '',
      `- **类型**: ${stage.type}`,
    ];

    if (stage.description) {
      lines.push(`- **说明**: ${stage.description}`);
    }

    if (stage.estimatedMinutes) {
      lines.push(`- **预估耗时**: ${stage.estimatedMinutes} 分钟`);
    }

    lines.push('');

    // AI 指令
    if (stage.promptTemplate) {
      lines.push('### AI 指令');
      lines.push('');
      lines.push('```');
      lines.push(stage.promptTemplate);
      lines.push('```');
      lines.push('');
    }

    // 需要输入
    if (stage.requiredInputs && stage.requiredInputs.length > 0) {
      lines.push('### 需要输入');
      lines.push('');
      stage.requiredInputs.forEach(input => {
        const required = input.required ? '（必填）' : '';
        lines.push(`- **${input.label}** (${input.type})${required}`);
      });
      lines.push('');
    }

    // 确认消息
    if (stage.confirmMessage) {
      lines.push('### 确认消息');
      lines.push('');
      lines.push(stage.confirmMessage);
      lines.push('');
    }

    // 输出定义
    if (stage.outputType) {
      lines.push('### 输出');
      lines.push('');
      lines.push(`- **类型**: ${stage.outputType}`);
      if (stage.outputLabel) {
        lines.push(`- **标签**: ${stage.outputLabel}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }).join('\n');
}

/**
 * 阶段 N+1: 质量验证与交付（固定）
 */
function generateStageN1(): string {
  return `## 阶段 N+1: 质量验证与交付

### 执行步骤

1. **验证操作结果**
   \`\`\`bash
   curl -X POST "\${TEAMCLAW_BASE_URL}/api/mcp/external" \\
     -H "Authorization: Bearer \${MCP_TOKEN}" \\
     -d '{"tool": "get_task", "parameters": {"task_id": "{{task_id}}"}}'
   \`\`\`

2. **更新任务状态**
   \`\`\`json
   {"tool": "update_task", "parameters": {"task_id": "{{task_id}}", "status": "completed"}}
   \`\`\`

3. **推送交付物**
   \`\`\`json
   {"tool": "deliver_document", "parameters": {"task_id": "{{task_id}}", "document_id": "{{output_doc_id}}"}}
   \`\`\`

### 输出

- ✅ 验证报告
- 📊 任务进度更新
- 📦 交付物链接`;
}

/**
 * 生成参考文档索引
 */
function generateReferencesIndex(references: ReferenceFile[]): string {
  const lines: string[] = [
    '## 参考文档',
    '',
    '| 文件名 | 标题 | 类型 | 说明 |',
    '|--------|------|------|------|',
  ];

  references.forEach(ref => {
    const desc = ref.description ? ref.description : '-';
    lines.push(`| [\`${ref.filename}\`](references/${ref.filename}) | ${ref.title} | ${ref.type} | ${desc} |`);
  });

  return lines.join('\n');
}

/**
 * 生成脚本索引
 */
function generateScriptsIndex(scripts: ScriptFile[]): string {
  const lines: string[] = [
    '## 脚本文件',
    '',
    '| 文件名 | 类型 | 可执行 | 说明 |',
    '|--------|------|--------|------|',
  ];

  scripts.forEach(script => {
    const desc = script.description ? script.description : '-';
    const exec = script.executable ? '✅' : '❌';
    lines.push(`| [\`${script.filename}\`](scripts/${script.filename}) | ${script.type} | ${exec} | ${desc} |`);
  });

  return lines.join('\n');
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 转义 YAML 字符串
 */
function escapeYamlString(str: string): string {
  if (!str) return '';
  // 如果包含特殊字符，用引号包裹
  if (str.includes(':') || str.includes('#') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return str;
}

/**
 * 简单校验和（用于版本比对）
 * 使用 DJB2 哈希算法
 */
function simpleChecksum(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ============================================================================
// 导出
// ============================================================================

export default {
  generateSkillFromSOP,
  generateSkillPackage,
};
