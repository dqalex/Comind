/**
 * 里程碑同步 单元测试
 *
 * 测试覆盖：
 * 1. parseMilestonesFromMarkdown — Markdown 解析为里程碑数据
 * 2. serializeMilestones — 里程碑数据序列化为 Markdown
 * 3. 边界情况 — 空文档、缺失字段、特殊字符
 *
 * 运行方式：
 * npx vitest run tests/unit/milestone-sync.test.ts
 */

import { describe, it, expect } from 'vitest';
import { parseMilestonesFromMarkdown, serializeMilestones } from '@/lib/sync/milestone-sync';
import type { Milestone } from '@/db/schema';

// ============================================================
// parseMilestonesFromMarkdown
// ============================================================

describe('parseMilestonesFromMarkdown', () => {
  it('应该解析基础里程碑列表', () => {
    const md = `
## 进行中

- 里程碑A | 2026-06-01 | 第一阶段
- 里程碑B | 2026-07-01 | 第二阶段

## 待开始

- 里程碑C
`.trim();

    const result = parseMilestonesFromMarkdown(md);
    expect(result).toHaveLength(3);

    expect(result[0].title).toBe('里程碑A');
    expect(result[0].status).toBe('in_progress');
    expect(result[0].dueDate).toBe('2026-06-01');
    expect(result[0].description).toBe('第一阶段');

    expect(result[1].title).toBe('里程碑B');
    expect(result[1].status).toBe('in_progress');
    expect(result[1].dueDate).toBe('2026-07-01');

    expect(result[2].title).toBe('里程碑C');
    expect(result[2].status).toBe('open');
    expect(result[2].dueDate).toBeUndefined();
    expect(result[2].description).toBeUndefined();
  });

  it('应该支持英文状态头', () => {
    const md = `
## in progress

- Task Alpha

## completed

- Task Beta

## cancelled

- Task Gamma
`.trim();

    const result = parseMilestonesFromMarkdown(md);
    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('in_progress');
    expect(result[1].status).toBe('completed');
    expect(result[2].status).toBe('cancelled');
  });

  it('应该支持带 emoji 的标题', () => {
    const md = `
## 🚀 进行中

- 功能开发

## ✅ 已完成

- 设计完成
`.trim();

    const result = parseMilestonesFromMarkdown(md);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('in_progress');
    expect(result[1].status).toBe('completed');
  });

  it('应该解析引用行作为描述', () => {
    const md = `
## 待开始

- 优化性能
> 主要优化数据库查询和前端渲染
`.trim();

    const result = parseMilestonesFromMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('主要优化数据库查询和前端渲染');
  });

  it('应该忽略无效的截止日期格式', () => {
    const md = `
## 待开始

- 里程碑 | invalid-date | 描述
- 里程碑2 | 2026/01/01 | 描述
`.trim();

    const result = parseMilestonesFromMarkdown(md);
    expect(result).toHaveLength(2);
    expect(result[0].dueDate).toBeUndefined();
    expect(result[1].dueDate).toBeUndefined();
  });

  it('空文档应该返回空数组', () => {
    expect(parseMilestonesFromMarkdown('')).toEqual([]);
    expect(parseMilestonesFromMarkdown('# 标题\n\n一些文字')).toEqual([]);
  });

  it('只有标题没有列表项应该返回空数组', () => {
    const md = `
## 进行中

没有列表项
`.trim();

    const result = parseMilestonesFromMarkdown(md);
    expect(result).toEqual([]);
  });

  it('默认状态应为 open（无 ## 标题时）', () => {
    const md = `- 无状态的里程碑`;
    const result = parseMilestonesFromMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('open');
  });

  it('管道分隔和引用行描述应该合并', () => {
    const md = `
## open

- 里程碑 | 2026-03-01 | 初始描述
> 补充描述
`.trim();

    const result = parseMilestonesFromMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].description).toContain('初始描述');
    expect(result[0].description).toContain('补充描述');
  });
});

// ============================================================
// serializeMilestones
// ============================================================

describe('serializeMilestones', () => {
  const makeMilestone = (overrides: Partial<Milestone>): Milestone => ({
    id: 'ms_default',
    title: '默认里程碑',
    description: null,
    projectId: 'proj_1',
    status: 'open',
    dueDate: null,
    sortOrder: 0,
    knowledgeConfig: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });

  it('应该生成包含 frontmatter 的 Markdown', () => {
    const ms = [makeMilestone({ title: '里程碑1', status: 'open' })];
    const md = serializeMilestones(ms, 'proj_1');

    expect(md).toContain('---');
    expect(md).toContain('type: teamclaw:milestones');
    expect(md).toContain('project: proj_1');
    expect(md).toContain('里程碑1');
  });

  it('应该按状态分组输出', () => {
    const ms = [
      makeMilestone({ id: 'ms1', title: 'A', status: 'in_progress' }),
      makeMilestone({ id: 'ms2', title: 'B', status: 'open' }),
      makeMilestone({ id: 'ms3', title: 'C', status: 'completed' }),
    ];
    const md = serializeMilestones(ms);

    const lines = md.split('\n');
    const inProgressIdx = lines.findIndex(l => l.includes('进行中'));
    const openIdx = lines.findIndex(l => l.includes('待开始'));
    const completedIdx = lines.findIndex(l => l.includes('已完成'));

    // 进行中 > 待开始 > 已完成
    expect(inProgressIdx).toBeLessThan(openIdx);
    expect(openIdx).toBeLessThan(completedIdx);
  });

  it('空数组应该只生成 frontmatter', () => {
    const md = serializeMilestones([], 'proj_1');
    expect(md).toContain('type: teamclaw:milestones');
    expect(md).not.toContain('## ');
  });

  it('应该包含截止日期和描述', () => {
    const ms = [makeMilestone({
      title: '有日期的',
      status: 'open',
      dueDate: new Date('2026-12-31'),
      description: '带描述',
    })];
    const md = serializeMilestones(ms);
    expect(md).toContain('2026-12-31');
    expect(md).toContain('带描述');
  });

  it('跳过空状态分组', () => {
    const ms = [makeMilestone({ status: 'open' })];
    const md = serializeMilestones(ms);
    expect(md).not.toContain('进行中');
    expect(md).not.toContain('已完成');
    expect(md).not.toContain('已取消');
    expect(md).toContain('待开始');
  });
});
