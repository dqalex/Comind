# TeamClaw Skill 设计规范

## 概述

TeamClaw Skill 是连接用户 SOP 工作流程与 OpenClaw Agent 的桥梁。每个 Skill 都包含：
1. **固定前置阶段**：加载项目上下文（TeamClaw 核心能力）
2. **用户定义阶段**：具体工作流程（SOP Template）
3. **固定后置阶段**：质量验证与交付

**注意**：Skill 注册、审批、安装、快照监控等功能由 **TeamClaw SkillHub** 提供，详见 [`TEAMCLAW_SKILLHUB_DESIGN.md`](./TEAMCLAW_SKILLHUB_DESIGN.md)。

---

## 一、Skill 结构

### 目录结构

```
skills/
├── teamclaw/                    # 内置 TeamClaw 核心能力
│   └── SKILL.md               # 核心 Skill 文档
├── sop-weekly-report/         # 用户创建的 Skill
│   ├── SKILL.md               # 主文档
│   ├── references/            # 详细参考（可选）
│   └── scripts/               # 脚本（可选）
└── sop-competitor-analysis/
    └── SKILL.md
```

### SKILL.md 结构

```markdown
---
name: teamclaw.sop.weekly-report
version: 1.0.0
description: 生成周报的标准化工作流程
category: content
source: sop
sopTemplateId: sop_xxx
---

# 周报生成工作流

> 📌 本 Skill 由 TeamClaw 自动生成，包含项目上下文加载能力

## 阶段 0: 项目上下文加载（固定）

### 执行步骤

1. **获取项目信息**
   ```json
   {"tool": "get_project", "parameters": {"project_id": "{{project_id}}"}}
   ```

2. **查询相关文档**
   ```json
   {"tool": "search_documents", "parameters": {"project_id": "{{project_id}}", "query": "{{task_keyword}}"}}
   ```

3. **加载团队成员**
   ```json
   {"tool": "get_project_members", "parameters": {"project_id": "{{project_id}}"}}
   ```

4. **获取当前任务**
   ```json
   {"tool": "list_my_tasks", "parameters": {"project_id": "{{project_id}}", "status": "in_progress"}}
   ```

### 输出变量

| 变量名 | 说明 |
|--------|------|
| `{{project_name}}` | 项目名称 |
| `{{project_description}}` | 项目描述 |
| `{{related_docs}}` | 相关文档摘要 |
| `{{team_members}}` | 团队成员列表 |
| `{{current_tasks}}` | 当前进行中任务 |

---

## 阶段 1-N: 用户定义工作流

（来自 SOP Template 的 stages）

---

## 阶段 N+1: 质量验证与交付（固定）

### 执行步骤

1. **验证操作结果**
   ```bash
   curl -X POST "${TEAMCLAW_BASE_URL}/api/mcp/external" \
     -H "Authorization: Bearer ${MCP_TOKEN}" \
     -d '{"tool": "get_task", "parameters": {"task_id": "{{task_id}}"}}'
   ```

2. **更新任务状态**
   ```json
   {"tool": "update_task", "parameters": {"task_id": "{{task_id}}", "status": "completed"}}
   ```

3. **推送交付物**
   ```json
   {"tool": "deliver_document", "parameters": {"task_id": "{{task_id}}", "document_id": "{{output_doc_id}}"}}
   ```

### 输出

- ✅ 验证报告
- 📊 任务进度更新
- 📦 交付物链接
```

---

## 二、固定阶段详解

### 阶段 0: 项目上下文加载

**目的**：让 Agent 了解当前项目的完整背景

| 步骤 | MCP 工具 | 参数 | 输出 |
|------|---------|------|------|
| 1. 获取项目信息 | `get_project` | `project_id` | 项目名称、描述、目标 |
| 2. 查询相关文档 | `search_documents` | `project_id`, `query` | 相关 Wiki 文档摘要 |
| 3. 加载团队成员 | `get_project_members` | `project_id` | 成员角色与职责 |
| 4. 获取当前任务 | `list_my_tasks` | `project_id`, `status` | 进行中任务列表 |

**注入时机**：Skill 加载时自动执行，无需用户干预

### 阶段 N+1: 质量验证与交付

**目的**：确保工作结果符合标准并正确交付

| 步骤 | MCP 工具 | 参数 | 输出 |
|------|---------|------|------|
| 1. 验证操作结果 | MCP API 调用 | `task_id` | 验证通过/失败 |
| 2. 更新任务状态 | `update_task` | `task_id`, `status` | 任务完成 |
| 3. 推送交付物 | `deliver_document` | `task_id`, `document_id` | 交付物链接 |

**注入时机**：用户工作流完成后自动执行

---

## 三、Skill 生成流程

### 从 SOP Template 生成 Skill

```
用户创建 SOP Template
        ↓
验证 SOP 结构（skill-creator 规范）
        ↓
生成 SKILL.md：
  - 注入阶段 0（项目上下文）
  - 添加用户定义阶段
  - 注入阶段 N+1（质量验证）
        ↓
注册到 SkillHub（详见 TEAMCLAW_SKILLHUB_DESIGN.md）
        ↓
提交审批 → 管理员审批
        ↓
激活 Skill（status: active）
        ↓
安装到 Agent
```

### 代码实现

```typescript
// lib/skill-generator.ts

/**
 * 从 SOP Template 生成完整 Skill 内容
 */
export function generateSkillFromSOP(template: SOPTemplate): string {
  const frontmatter = {
    name: `teamclaw.sop.${template.id}`,
    version: '1.0.0',
    description: template.description,
    category: template.category,
    source: 'sop',
    sopTemplateId: template.id,
  };

  return `---
${yaml.dump(frontmatter)}---

# ${template.name}

${template.description}

> 📌 本 Skill 由 TeamClaw 自动生成，包含项目上下文加载能力

${generateStage0()}

${generateUserStages(template.stages)}

${generateStageN1()}
`;
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
| \`{{current_tasks}}\` | 当前进行中任务 |
`;
}

/**
 * 用户定义阶段
 */
function generateUserStages(stages: SOPStage[]): string {
  return stages.map((stage, i) => `## 阶段 ${i + 1}: ${stage.label}

- **类型**: ${stage.type}
${stage.description ? `- **说明**: ${stage.description}` : ''}

${stage.promptTemplate ? `### AI 指令\n\n\`\`\`\n${stage.promptTemplate}\n\`\`\`` : ''}

${stage.requiredInputs?.length ? `### 需要输入\n\n${stage.requiredInputs.map(input => `- **${input.label}** (${input.type}${input.required ? ', 必填' : ''})`).join('\n')}` : ''}
`).join('\n\n');
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
- 📦 交付物链接
`;
}
```

---

## 四、任务调用 Skill

### 问题背景

任务系统需要能够调用已安装的 Skill，实现任务自动化执行。

### 解决方案

#### 1. MCP 工具定义

```typescript
// core/mcp/definitions.ts

{
  name: "execute_skill",
  description: "执行指定的 Skill，完成任务自动化工作流",
  parameters: {
    type: "object",
    properties: {
      skill_key: {
        type: "string",
        description: "Skill 唯一标识，如 teamclaw.sop.weekly-report"
      },
      task_id: {
        type: "string",
        description: "任务 ID"
      },
      inputs: {
        type: "object",
        description: "Skill 输入参数",
        additionalProperties: true
      }
    },
    required: ["skill_key", "task_id"]
  }
}
```

#### 2. MCP 执行器

```typescript
// core/mcp/handlers/skill.ts

/**
 * 执行 Skill
 */
export async function handleExecuteSkill(
  params: { skill_key: string; task_id: string; inputs?: Record<string, any> },
  userId: string
): Promise<ExecutionResult> {
  const { skill_key, task_id, inputs = {} } = params;
  
  // 1. 验证 Skill 存在
  const [skill] = await db.select().from(skills).where(eq(skills.skillKey, skill_key));
  if (!skill) {
    return { success: false, error: `Skill not found: ${skill_key}` };
  }
  
  // 2. 验证 Skill 状态
  if (skill.trustStatus !== 'trusted') {
    return { success: false, error: `Skill not trusted: ${skill_key}` };
  }
  
  // 3. 验证任务存在
  const [task] = await db.select().from(tasks).where(eq(tasks.id, task_id));
  if (!task) {
    return { success: false, error: `Task not found: ${task_id}` };
  }
  
  // 4. 获取项目信息
  const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
  if (!project) {
    return { success: false, error: `Project not found for task ${task_id}` };
  }
  
  // 5. 查找可用的 Agent
  const availableAgents = await db.select()
    .from(members)
    .where(and(
      eq(members.type, 'ai'),
      eq(members.projectId, task.projectId)
    ));
  
  if (availableAgents.length === 0) {
    return { success: false, error: 'No AI agent available for this task' };
  }
  
  // 6. 选择 Agent（优先选择已安装该 Skill 的）
  const agent = availableAgents.find(a => 
    skill.installedAgents?.includes(a.id)
  ) || availableAgents[0];
  
  // 7. 通过 Gateway 触发 Skill 执行
  const gatewayClient = getGatewayClient();
  
  try {
    const result = await gatewayClient.executeSkill({
      agentId: agent.openclawAgentId,
      skillKey: skill_key,
      taskId: task_id,
      inputs: {
        ...inputs,
        project_id: task.projectId,
        task_keyword: task.title,
      },
    });
    
    // 8. 更新任务状态
    await db.update(tasks)
      .set({
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task_id));
    
    // 9. 记录执行日志
    await db.insert(activityLogs).values({
      id: generateId(),
      action: 'skill_execute',
      resourceId: task_id,
      userId,
      details: `Executed skill ${skill_key} on agent ${agent.name}`,
      createdAt: new Date(),
    });
    
    return {
      success: true,
      message: `Skill ${skill.name} execution started on agent ${agent.name}`,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        skillName: skill.name,
        taskId: task_id,
      },
    };
    
  } catch (error) {
    console.error('[Skill Execute] Failed:', error);
    return {
      success: false,
      error: `Failed to execute skill: ${String(error)}`,
    };
  }
}
```

#### 3. Gateway 客户端方法

```typescript
// lib/gateway-client.ts

/**
 * 执行 Skill
 */
async executeSkill(params: {
  agentId: string;
  skillKey: string;
  taskId: string;
  inputs: Record<string, any>;
}): Promise<{ success: boolean; sessionId?: string }> {
  const requestId = generateRequestId();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(requestId);
      reject(new Error('Skill execution timeout'));
    }, 60000); // 60s 超时
    
    this.pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    
    this.ws?.send(JSON.stringify({
      type: 'request',
      id: requestId,
      method: 'skill.execute',
      params: {
        agent_id: params.agentId,
        skill_key: params.skillKey,
        task_id: params.taskId,
        inputs: params.inputs,
      },
    }));
  });
}
```

#### 4. 前端调用示例

```tsx
// components/tasks/TaskActions.tsx

export function TaskActions({ task }: { task: Task }) {
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  
  useEffect(() => {
    // 获取可用 Skill 列表
    fetch('/api/skills?status=active&projectId=' + task.projectId)
      .then(res => res.json())
      .then(data => setAvailableSkills(data.skills || []));
  }, [task.projectId]);
  
  const executeSkill = async (skillKey: string) => {
    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'execute_skill',
          parameters: {
            skill_key: skillKey,
            task_id: task.id,
          },
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Skill execution started: ${result.message}`);
      } else {
        toast.error(`Skill execution failed: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Failed to execute skill: ${String(error)}`);
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Play className="h-4 w-4 mr-2" />
          Execute Skill
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {availableSkills.length === 0 ? (
          <DropdownMenuItem disabled>No skills available</DropdownMenuItem>
        ) : (
          availableSkills.map(skill => (
            <DropdownMenuItem key={skill.id} onClick={() => executeSkill(skill.skillKey)}>
              {skill.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 五、总结

### 核心设计

1. **固定前置阶段**：所有 TeamClaw Skill 自动注入项目上下文加载能力
2. **固定后置阶段**：自动执行质量验证与交付
3. **任务集成**：通过 MCP 工具实现任务与 Skill 的无缝对接

### 相关文档

- **Skill 管理**：[`TEAMCLAW_SKILLHUB_DESIGN.md`](./TEAMCLAW_SKILLHUB_DESIGN.md)
- **审批系统**：[`APPROVAL_SYSTEM_DESIGN.md`](./APPROVAL_SYSTEM_DESIGN.md)
- **MCP 工具**：[`core/mcp/definitions.ts`](../../core/mcp/definitions.ts)

### 技术实现

- **Skill 生成器**：`lib/skill-generator.ts`
- **MCP 工具**：`execute_skill` 定义与处理器
- **Gateway 集成**：`gatewayClient.executeSkill()`
- **前端组件**：任务执行 Skill 按钮
