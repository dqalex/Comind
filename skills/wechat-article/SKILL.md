---
name: teamclaw.sop.wechat-article
version: 1.0.0
description: 微信公众号内容创作工作流。支持选题、标题优化、正文写作、公众号排版、封面图生成。核心能力：按需搜索补充材料、阅读项目文档、渲染可直接复制的公众号文章。
category: content
source: sop
sopTemplateId: sop-wechat-article
---

# 微信公众号文章创作工作流

> 本 Skill 由 TeamClaw 自动生成，包含项目上下文加载能力
> **版本**: v0.9.8
> **项目地址**: https://github.com/dqalex/teamclaw

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

## 阶段 1: 需求确认

### 类型: `input`

### 输入项

| ID | 标签 | 类型 | 必填 | 说明 |
|----|------|------|------|------|
| `topic` | 文章主题 | text | ✅ | 例：AI 编程助手市场分析 |
| `target_reader` | 目标读者 | select | ✅ | 新手/从业者/泛用户 |
| `goal` | 文章目标 | select | ✅ | 涨粉/转化/品牌表达/观点输出 |
| `length` | 期望长度 | select | ✅ | 短文(800-1200)/中长文(1500-2500) |
| `style` | 写作风格 | select | ❌ | 口语化/专业/故事化 |
| `special_requirements` | 特殊要求 | textarea | ❌ | 是否需要数据、案例、金句等 |

---

## 阶段 2: 素材收集

### 类型: `ai_auto`

### AI 指令

```
你正在为微信公众号文章收集素材。请执行以下操作：

## 1. 搜索补充材料

使用 web_search 工具搜索以下内容：
- "{{inputs.topic}}" 最新动态
- "{{inputs.topic}}" 行业分析
- "{{inputs.topic}}" 案例/数据

## 2. 阅读项目文档

阅读项目「{{project_name}}」下的相关文档：
{{related_docs}}

提取与「{{inputs.topic}}」相关的：
- 关键数据和统计
- 案例和故事
- 专业观点
- 可引用的内容

## 3. 整理素材

输出结构化素材清单：

### 核心素材
- [列出关键数据、案例、观点]

### 补充素材
- [列出次要点、背景信息]

### 待确认点
- [列出需要用户确认的事实性问题]

注意：
- 数据需要标注来源
- 区分事实与观点
- 标注信息时效性
```

### 知识层级: L1, L2

### 预计时间: 10 分钟

---

## 阶段 3: 选题与标题

### 类型: `ai_with_confirm`

### AI 指令

```
基于收集的素材和项目背景，生成选题角度和标题候选。

## 选题角度（1-3个）

每个角度说明：
- 核心切入点
- 为什么这个角度有价值
- 预期读者反应

## 标题候选（5-8个）

按类型分类：

### 悬念型
- 留下信息缺口，引发好奇

### 利益型
- 明确读者收获

### 观点型
- 态度鲜明、可讨论

### 代入型
- 让读者产生"与我有关"的感觉

## 标题检查清单
- [ ] 是否有具体场景而非空话
- [ ] 是否有情绪张力但不夸张
- [ ] 是否让目标读者一眼知道"与我有关"
- [ ] 字数控制在 16-28 字

参考标题公式：
- 冲突型：【事件A】+【情绪词】+【读者损益】
- 反常识型：不是【常见认知】吗？为什么【相反结果】
- 结论先行型：【一句判断】，原因只有【X】个
```

### 确认提示: 请选择最佳选题角度和标题，或提供修改意见

### 知识层级: L1

### 预计时间: 5 分钟

---

## 阶段 4: 大纲生成

### 类型: `ai_with_confirm`

### AI 指令

```
根据选定的选题角度和标题，生成文章结构大纲。

## 大纲模板（默认结构）

1. **开场钩子** - 问题/冲突/反常识观点
2. **场景故事** - 真实案例，降低理解门槛
3. **核心观点** - 1-3 条关键论点
4. **数据/案例支撑** - 少量关键证据
5. **反方疑问与回应** - 增强可信度
6. **结尾行动** - 给读者可执行动作

## 大纲要求

- 每节给出：
  - 小标题（新闻感+情绪感）
  - 核心内容点（3-5个）
  - 预计字数
  - 使用的素材来源

- 开头 3 段内必须有"冲突/反差/损失感"钩子
- 每 4-6 段插入一个"划重点小标题"
- 至少给 1 组 if/then 判断
- 结尾必须有 CTA（关注/评论/进群）

## 输出格式

### 文章标题
[选定标题]

### 目标读者
{{inputs.target_reader}}

### 大纲结构
1. [开场钩子] - 小标题 + 内容点 + 预计字数
2. [场景故事] - ...
...
```

### 确认提示: 请确认大纲结构是否合理，是否需要调整

### 知识层级: L1, L2

### 预计时间: 5 分钟

---

## 阶段 5: 正文撰写

### 类型: `ai_auto`

### AI 指令

```
根据大纲撰写正文初稿。

## 写作风格要求

基于项目「{{project_name}}」的内容风格：
- 语气：{{inputs.style}}
- 节奏：短句密集，先抛结论/冲突，再补解释
- 结构：事件爆点 → 市场后果 → 反常识解释 → 历史复盘 → 条件判断 → 引导互动
- 观点：立场鲜明，敢下判断，但保留条件分支
- 表达：多用反问句、感叹句、对比句

## 硬规则

- 开头 3 段内必须出现"冲突/反差/损失感"其中至少 1 个钩子
- 每 4-6 段插入一个"划重点小标题"
- 至少给 1 组 if/then 判断
- 结尾必须有 CTA（关注/评论/进群）
- 禁用空泛词：赋能、抓手、闭环、矩阵化、全方位
- 禁用学术套话：综上所述、毋庸置疑、不难发现

## 数据处理

- 使用素材中的真实数据，标注来源
- 无可靠来源时，写"示例数据/估算"
- 不编造机构名、研究结论和具体百分比

## 输出

生成 Markdown 格式的正文初稿。
```

### 知识层级: L1, L2, L3

### 预计时间: 15 分钟

---

## 阶段 6: 公众号排版与推送

### 类型: `render`

### AI 指令

```
将正文转换为公众号格式，并创建可视化文档推送到 TeamClaw。

## 步骤 1: 获取渲染模板列表

调用 list_render_templates 获取可用模板：
```json
{"tool": "list_render_templates", "parameters": {"category": "report", "status": "active"}}
```

分析返回的模板列表，选择最适合公众号文章的模板：
- 优先选择名称包含"公众号"、"wechat"、"article"的模板
- 其次选择 category 为 report 或 content 的模板

## 步骤 2: 获取模板详情

选择模板后，调用 get_render_template 获取完整结构：
```json
{"tool": "get_render_template", "parameters": {"template_id": "选中的模板ID"}}
```

返回的 template 包含：
- htmlTemplate: HTML 结构（含 data-slot 属性）
- mdTemplate: Markdown 模板示例
- slots: 可编辑区域定义
- sections: 区块划分

## 步骤 3: 按模板语法填充内容

根据 slots 定义，使用 `<!-- @slot:slotName -->` 语法填充内容。

### 示例（假设选择 rt-wechat-article）：

```markdown
<!-- @slot:title -->
# 文章标题

<!-- @slot:author -->
作者名称

<!-- @slot:publishDate -->
2026-03-12

<!-- @slot:opening -->
开头段落，背景引入...

<!-- @slot:image1 -->

<!-- @slot:sectionTitle -->
<span style="color:#D0021B;"><strong><em>第一个小标题</em></strong></span>

<!-- @slot:sectionContent -->
正文内容...

<!-- @slot:sectionImage -->

... 重复填充更多段落 ...

<!-- @slot:cta -->
关注公众号，获取更多精彩内容！

<!-- @slot:coverPrompt -->
封面图提示词...
```

## 步骤 4: 创建渲染文档

调用 create_document 创建可视化文档：
```json
{
  "tool": "create_document",
  "parameters": {
    "title": "{{文章标题}}",
    "content": "{{填充后的 Markdown 内容}}",
    "doc_type": "report",
    "project_id": "{{project_id}}",
    "render_mode": "visual",
    "render_template_id": "{{选中的模板ID}}"
  }
}
```

## 公众号排版规范

- 结构：小标题 + 正文（禁止列表）
- 小标题样式：`<span style="color:#D0021B;"><strong><em>小标题</em></strong></span>`
- 重点样式：`<span style="color:#D0021B;"><strong><em>重点</em></strong></span>`

## 输出

1. 文档已创建并推送到 TeamClaw
2. 用户可在 TeamClaw 内容工作室查看渲染效果
3. 用户可直接复制内容粘贴到公众号编辑器
```

### 预计时间: 5 分钟

---

## 阶段 7: 封面图提示词

### 类型: `ai_auto`

### AI 指令

```
生成公众号文章封面图的 AI 绘图提示词。

## 提示词格式

```
文章封面：{标题}。风格：简洁、现代、公众号头图、强对比、高可读中文标题排版、16:9、2K。主视觉：{核心意象}。颜色：{主色+强调色}。避免：复杂背景、过多文字、水印。
```

## 输出

1. 封面图 Prompt（中文）
2. 3 个风格变体（不同主视觉）
3. 尺寸建议：900x500px 或 2K 16:9
```

### 预计时间: 2 分钟

---

## 阶段 8: 质量验证与交付（固定）

### 执行步骤

1. **验证操作结果**
   ```json
   {"tool": "get_task", "parameters": {"task_id": "{{task_id}}"}}
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

---

## 参考文件

执行时可按需读取：

- `references/style-fingerprint.md` - 风格指纹参考
- `references/title-patterns.md` - 标题公式库
- `references/opening-ending-library.md` - 开头结尾模板库
- `references/banned-phrases.md` - 禁用词句清单

---

## 最终交付物

1. **选题报告** - 选题角度 + 标题候选
2. **文章大纲** - 结构化大纲
3. **正文初稿** - Markdown 格式
4. **公众号排版** - 可直接复制的 HTML
5. **封面图 Prompt** - AI 绘图提示词
6. **100 字摘要** - 文章摘要
7. **朋友圈文案** - 3 条短文案
