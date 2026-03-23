/**
 * OpenClaw 同步管理器
 * 
 * 处理文件同步逻辑，包括：
 * - 文件扫描与索引
 * - 增量同步
 * - 冲突检测
 * - 版本管理
 */

import { db } from '@/db';
import { openclawWorkspaces, openclawFiles, openclawVersions, openclawConflicts, documents, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { OPENCLAW_CONFIG, SYNC_DIRS, SYNC_ROOT_FILES } from './config';
import { eventBus } from '@/lib/event-bus';
import { syncMarkdownToDatabase } from '@/lib/markdown-sync';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { createHash } from 'crypto';

export class SyncManager {
  
  /**
   * 全量同步
   */
  async syncFull(workspaceId: string): Promise<{
    synced: number;
    created: number;
    updated: number;
    conflicts: number;
    errors: Array<{ file: string; error: string }>;
  }> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // 扫描所有文件
    const files = await this.scanFiles(workspace.path, workspace.excludePatterns || []);

    const results = {
      synced: 0,
      created: 0,
      updated: 0,
      conflicts: 0,
      errors: [] as Array<{ file: string; error: string }>,
    };

    for (const file of files) {
      try {
        const result = await this.syncFile(workspace, file);
        results.synced++;
        if (result.created) results.created++;
        if (result.updated) results.updated++;
        if (result.conflict) results.conflicts++;
      } catch (error) {
        results.errors.push({
          file: file.relativePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 更新 workspace 同步时间
    await db.update(openclawWorkspaces)
      .set({ lastSyncAt: new Date(), syncStatus: 'idle', updatedAt: new Date() })
      .where(eq(openclawWorkspaces.id, workspaceId));

    // 通知前端刷新（有文档变更时）
    if (results.created > 0 || results.updated > 0) {
      eventBus.emit({ type: 'document_update' });
    }

    return results;
  }

  /**
   * 增量同步（单文件）
   * 
   * 当文件是 teamclaw:* 类型时，除了更新 openclawFiles 索引，
   * 还会创建/更新 documents 记录并调用 syncMarkdownToDatabase() 解析任务
   */
  async syncSingleFile(workspaceId: string, filePath: string, eventType: 'add' | 'change' | 'unlink'): Promise<{
    created: boolean;
    updated: boolean;
    conflict: boolean;
  }> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const relativePath = relative(workspace.path, filePath);

    if (eventType === 'unlink') {
      // 文件删除
      await this.handleFileDelete(workspaceId, relativePath);
      eventBus.emit({ type: 'document_update' });
      return { created: false, updated: true, conflict: false };
    }

    // 读取文件
    if (!existsSync(filePath)) {
      throw new Error('File not found');
    }

    const content = readFileSync(filePath, 'utf-8');
    const hash = this.calculateHash(content);
    const frontMatter = this.parseFrontMatter(content);
    const stat = statSync(filePath);

    const fileInfo = {
      relativePath,
      content,
      hash,
      frontMatter,
      modifiedAt: new Date(stat.mtime),
    };

    const result = await this.syncFile(workspace, fileInfo);

    // 有变更时更新 workspace 同步时间并通知前端刷新
    if (result.created || result.updated) {
      await db.update(openclawWorkspaces)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(openclawWorkspaces.id, workspaceId));
      eventBus.emit({ type: 'document_update' });

      // 检测 teamclaw:* 类型文件，触发 Markdown → 任务看板解析
      const teamclawType = this.detectTeamclawType(frontMatter?.type);
      if (teamclawType) {
        await this.syncTeamclawFile(workspace, relativePath, content, frontMatter, hash);
      } else {
        // 非 teamclaw:* 类型文件：同步更新关联的 documents 表内容
        await this.syncNonTeamclawDocument(workspace, relativePath, content, frontMatter);
      }
    }

    return result;
  }

  /**
   * 处理 teamclaw:* 类型文件的同步
   * 创建/更新 documents 记录 + 调用 syncMarkdownToDatabase 解析任务
   */
  private async syncTeamclawFile(
    workspace: typeof openclawWorkspaces.$inferSelect,
    relativePath: string,
    content: string,
    frontMatter: Record<string, unknown> | undefined,
    _hash: string,
  ): Promise<void> {
    try {
      const title = typeof frontMatter?.title === 'string'
        ? frontMatter.title
        : relativePath.replace(/\.md$/, '').split('/').pop() || relativePath;

      const teamclawType = this.detectTeamclawType(frontMatter?.type);
      const docType = this.mapTeamclawTypeToDocType(teamclawType || 'note');

      // 提取项目信息
      // projects/ 目录下的文件允许自动创建项目，frontMatter.project 只做关联
      let projectId: string | undefined;
      const projectMatch = relativePath.match(/^projects\/([^/]+)/);
      if (projectMatch) {
        projectId = await this.getOrCreateProject(projectMatch[1], true);
      }
      // frontMatter.project 只关联已有项目，不自动创建（防止已删除项目"复活"）
      if (!projectId && typeof frontMatter?.project === 'string') {
        projectId = await this.getOrCreateProject(frontMatter.project);
      }

      // 查找已有的 openclawFiles 记录（获取 documentId）
      const fileRecord = await db.query.openclawFiles.findFirst({
        where: and(
          eq(openclawFiles.workspaceId, workspace.id),
          eq(openclawFiles.relativePath, relativePath)
        ),
      });

      if (fileRecord?.documentId) {
        // 已有 document 记录 → 更新内容 + 触发解析
        await db.update(documents)
          .set({
            title,
            content,
            type: docType,
            projectId: projectId || null,
            lastSync: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(documents.id, fileRecord.documentId));

        const syncResult = await syncMarkdownToDatabase(fileRecord.documentId, content);
        if (syncResult.synced) {
          console.log(`[SyncManager] teamclaw:* 文件解析完成: ${relativePath}`, syncResult.counts);
          eventBus.emit({ type: 'task_update' });
        }
      } else {
        // 无 document 记录 → 创建 document + 关联 + 触发解析
        const docId = generateId();
        await db.insert(documents).values({
          id: docId,
          title,
          content,
          source: 'openclaw',
          type: docType,
          projectId: projectId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 更新 openclawFiles 记录关联 documentId
        if (fileRecord) {
          await db.update(openclawFiles)
            .set({ documentId: docId, updatedAt: new Date() })
            .where(eq(openclawFiles.id, fileRecord.id));
        }

        const syncResult = await syncMarkdownToDatabase(docId, content);
        if (syncResult.synced) {
          console.log(`[SyncManager] teamclaw:* 新文件解析完成: ${relativePath}`, syncResult.counts);
          eventBus.emit({ type: 'task_update' });
        }
      }
    } catch (error) {
      console.error(`[SyncManager] teamclaw:* 文件同步失败: ${relativePath}`, error);
    }
  }

  /**
   * 非 teamclaw:* 类型文件变更时，同步更新关联的 documents 表内容
   * 同时检查 delivery_status 等 frontmatter 字段，触发交付自动识别
   */
  private async syncNonTeamclawDocument(
    workspace: typeof openclawWorkspaces.$inferSelect,
    relativePath: string,
    content: string,
    frontMatter: Record<string, unknown> | undefined,
  ): Promise<void> {
    try {
      const fileRecord = await db.query.openclawFiles.findFirst({
        where: and(
          eq(openclawFiles.workspaceId, workspace.id),
          eq(openclawFiles.relativePath, relativePath)
        ),
      });

      if (!fileRecord) return;

      const title = typeof frontMatter?.title === 'string'
        ? frontMatter.title
        : relativePath.replace(/\.md$/, '').split('/').pop() || relativePath;

      // 提取项目信息
      // projects/ 目录下的文件允许自动创建项目，frontMatter.project 只做关联
      let projectId: string | undefined;
      const projectMatch = relativePath.match(/^projects\/([^/]+)/);
      if (projectMatch) {
        projectId = await this.getOrCreateProject(projectMatch[1], true);
      }
      // frontMatter.project 只关联已有项目，不自动创建
      if (!projectId && typeof frontMatter?.project === 'string') {
        projectId = await this.getOrCreateProject(frontMatter.project);
      }

      const fileType = this.detectFileType(relativePath);
      const docType = this.mapTeamclawTypeToDocType(fileType);

      let documentId: string | undefined;

      if (fileRecord.documentId) {
        // 已有 document → 更新内容
        documentId = fileRecord.documentId;
        await db.update(documents)
          .set({
            title,
            content,
            type: docType,
            projectId: projectId || null,
            lastSync: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(documents.id, fileRecord.documentId));
        console.log(`[SyncManager] 非 teamclaw 文件 document 更新: ${relativePath}`);
      } else {
        // 无 document → 创建并关联
        const docId = generateId();
        documentId = docId;
        await db.insert(documents).values({
          id: docId,
          title,
          content,
          source: 'openclaw',
          type: docType,
          projectId: projectId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.update(openclawFiles)
          .set({ documentId: docId, updatedAt: new Date() })
          .where(eq(openclawFiles.id, fileRecord.id));
        console.log(`[SyncManager] 非 teamclaw 文件 document 创建: ${relativePath} → ${docId}`);
      }

      // 调用 syncMarkdownToDatabase 处理 delivery_status 等 frontmatter 字段
      // 即使不是 teamclaw:* 类型，只要有 delivery_status 就会自动创建交付记录
      if (documentId) {
        const syncResult = await syncMarkdownToDatabase(documentId, content);
        if (syncResult.synced) {
          console.log(`[SyncManager] 非 teamclaw 文件交付同步: ${relativePath}`, syncResult.type || 'delivery_status');
          eventBus.emit({ type: 'delivery_update' });
        }
      }
    } catch (error) {
      console.error(`[SyncManager] 非 teamclaw 文件同步失败: ${relativePath}`, error);
    }
  }

  /**
   * 检测 teamclaw:* frontmatter 类型
   */
  private detectTeamclawType(type: unknown): string | null {
    if (typeof type !== 'string') return null;
    if (type.startsWith('teamclaw:')) return type;
    if (type === 'task_list') return 'teamclaw:tasks';
    return null;
  }

  /**
   * teamclaw 类型映射到文档类型（与 schema enum 严格匹配）
   */
  private mapTeamclawTypeToDocType(teamclawType: string): 'guide' | 'reference' | 'report' | 'note' | 'decision' | 'scheduled_task' | 'task_list' | 'other' {
    switch (teamclawType) {
      case 'teamclaw:tasks': return 'task_list';
      case 'teamclaw:schedules': return 'scheduled_task';
      case 'teamclaw:deliveries': return 'report';
      case 'teamclaw:milestones': return 'note';
      default: return 'note';
    }
  }

  /**
   * 获取或创建项目（按名称）
   * @param autoCreate 是否允许自动创建（仅 projects/ 目录下的路径允许，front matter 只做关联）
   */
  private async getOrCreateProject(projectName: string, autoCreate: boolean = false): Promise<string | undefined> {
    // 先查找已有项目
    const existing = await db.query.projects.findFirst({
      where: eq(projects.name, projectName),
    });
    if (existing) return existing.id;

    // 只有 projects/ 目录下的文件才允许自动创建项目
    // front matter 中的 project 字段只做关联，不自动创建（防止已删除项目被同步"复活"）
    if (!autoCreate) {
      console.log(`[SyncManager] 项目不存在，跳过关联: ${projectName}`);
      return undefined;
    }

    // 创建新项目
    const projectId = generateId();
    await db.insert(projects).values({
      id: projectId,
      name: projectName,
      source: 'openclaw',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[SyncManager] 自动创建项目: ${projectName} (${projectId})`);
    return projectId;
  }

  /**
   * 同步单个文件
   */
  private async syncFile(
    workspace: typeof openclawWorkspaces.$inferSelect,
    fileInfo: {
      relativePath: string;
      content: string;
      hash: string;
      frontMatter?: Record<string, unknown>;
      modifiedAt: Date;
    }
  ): Promise<{ created: boolean; updated: boolean; conflict: boolean }> {
    const { relativePath, content, hash, frontMatter, modifiedAt } = fileInfo;

    // 查找现有文件记录
    const existing = await db.query.openclawFiles.findFirst({
      where: and(
        eq(openclawFiles.workspaceId, workspace.id),
        eq(openclawFiles.relativePath, relativePath)
      ),
    });

    if (existing) {
      // 检查是否有变化
      if (existing.hash === hash) {
        return { created: false, updated: false, conflict: false };
      }

      // 检查冲突（基于版本和基础哈希）
      if ((existing.version || 0) > 1 && existing.baseHash && existing.baseHash !== this.calculateBaseHash(content)) {
        // 创建冲突记录
        await this.createConflict(existing, content);
        return { created: false, updated: false, conflict: true };
      }

      // 保存旧版本
      await this.saveVersion(existing, content);

      // 更新文件
      await db.update(openclawFiles)
        .set({
          hash,
          version: (existing.version || 0) + 1,
          title: frontMatter?.title as string || existing.title,
          tags: frontMatter?.tags as string[] || existing.tags,
          syncStatus: 'synced',
          syncedAt: new Date(),
          fileModifiedAt: modifiedAt,
          updatedAt: new Date(),
        })
        .where(eq(openclawFiles.id, existing.id));

      return { created: false, updated: true, conflict: false };
    } else {
      // 创建新文件记录
      const now = new Date();
      await db.insert(openclawFiles).values({
        id: generateId(),
        workspaceId: workspace.id,
        relativePath,
        fileType: this.detectFileType(relativePath),
        hash,
        version: 1,
        title: frontMatter?.title as string || null,
        tags: frontMatter?.tags as string[] || null,
        syncStatus: 'synced',
        syncedAt: now,
        fileModifiedAt: modifiedAt,
        createdAt: now,
        updatedAt: now,
      });

      return { created: true, updated: false, conflict: false };
    }
  }

  /**
   * 处理文件删除（级联清理 versions/conflicts/document）
   */
  private async handleFileDelete(workspaceId: string, relativePath: string): Promise<void> {
    const existing = await db.query.openclawFiles.findFirst({
      where: and(
        eq(openclawFiles.workspaceId, workspaceId),
        eq(openclawFiles.relativePath, relativePath)
      ),
    });

    if (existing) {
      // 先删子表
      await db.delete(openclawConflicts).where(eq(openclawConflicts.fileId, existing.id));
      await db.delete(openclawVersions).where(eq(openclawVersions.fileId, existing.id));
      // 删除关联 document
      if (existing.documentId) {
        await db.delete(documents).where(eq(documents.id, existing.documentId));
      }
      // 最后删 openclawFiles
      await db.delete(openclawFiles).where(eq(openclawFiles.id, existing.id));
    }
  }

  /**
   * 保存版本历史
   */
  private async saveVersion(
    file: typeof openclawFiles.$inferSelect,
    content: string
  ): Promise<void> {
    // 检查版本数量限制
    const versions = await db.select()
      .from(openclawVersions)
      .where(eq(openclawVersions.fileId, file.id))
      .orderBy(openclawVersions.version);

    // 删除超出限制的旧版本
    if (versions.length >= OPENCLAW_CONFIG.version.maxVersions) {
      const toDelete = versions.slice(0, versions.length - OPENCLAW_CONFIG.version.maxVersions + 1);
      for (const v of toDelete) {
        await db.delete(openclawVersions).where(eq(openclawVersions.id, v.id));
      }
    }

    // 保存新版本
    await db.insert(openclawVersions).values({
      id: generateId(),
      fileId: file.id,
      version: file.version || 1,
      hash: file.hash,
      storageType: 'full',
      content: (file.version || 1) <= OPENCLAW_CONFIG.version.fullCopyVersions ? content : null,
      changedBy: 'openclaw',
      createdAt: new Date(),
    });
  }

  /**
   * 创建冲突记录
   */
  private async createConflict(
    file: typeof openclawFiles.$inferSelect,
    newContent: string
  ): Promise<void> {
    // 读取本地内容
    let localContent = '';
    try {
      const workspace = await this.getWorkspace(file.workspaceId);
      if (workspace?.path) {
        localContent = readFileSync(join(workspace.path, file.relativePath), 'utf-8');
      }
    } catch {
      localContent = '';
    }

    await db.insert(openclawConflicts).values({
      id: generateId(),
      fileId: file.id,
      localVersion: file.version || 1,
      remoteVersion: (file.version || 1) + 1,
      localHash: file.hash,
      remoteHash: this.calculateHash(newContent),
      localContent,
      remoteContent: newContent,
      status: 'pending',
      detectedAt: new Date(),
    });

    // 更新文件状态
    await db.update(openclawFiles)
      .set({ syncStatus: 'conflict', updatedAt: new Date() })
      .where(eq(openclawFiles.id, file.id));
  }

  /**
   * 推送到 OpenClaw
   */
  async pushToOpenClaw(fileId: string, content: string, expectedVersion: number): Promise<{
    success: boolean;
    version?: number;
    conflict?: {
      localVersion: number;
      serverVersion: number;
      serverContent: string;
    };
  }> {
    const file = await db.query.openclawFiles.findFirst({
      where: eq(openclawFiles.id, fileId),
    });

    if (!file) {
      throw new Error('File not found');
    }

    // 乐观锁检查
    if (file.version !== expectedVersion) {
      const workspace = await this.getWorkspace(file.workspaceId);
      let serverContent = '';
      if (workspace?.path) {
        try {
          serverContent = readFileSync(join(workspace.path, file.relativePath), 'utf-8');
        } catch {
          // 文件可能不存在
        }
      }

      return {
        success: false,
        conflict: {
          localVersion: expectedVersion,
          serverVersion: file.version || 1,
          serverContent,
        },
      };
    }

    const workspace = await this.getWorkspace(file.workspaceId);
    if (!workspace?.path) {
      throw new Error('Workspace path not found');
    }

    // 确保目录存在
    const filePath = join(workspace.path, file.relativePath);
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 写入文件（先读取旧内容用于版本保存）
    const oldContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
    writeFileSync(filePath, content, 'utf-8');

    // 保存旧版本
    await db.insert(openclawVersions).values({
      id: generateId(),
      fileId: file.id,
      version: file.version || 1,
      hash: file.hash,
      storageType: 'full',
      content: oldContent,
      changedBy: 'teamclaw',
      createdAt: new Date(),
    });

    // 更新记录
    const newVersion = expectedVersion + 1;
    await db.update(openclawFiles)
      .set({
        hash: this.calculateHash(content),
        version: newVersion,
        syncStatus: 'synced',
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(openclawFiles.id, fileId));

    return { success: true, version: newVersion };
  }

  /**
   * 从 OpenClaw 拉取
   */
  async pullFromOpenClaw(fileId: string): Promise<{
    content: string;
    version: number;
    hash: string;
  }> {
    const file = await db.query.openclawFiles.findFirst({
      where: eq(openclawFiles.id, fileId),
    });

    if (!file) {
      throw new Error('File not found');
    }

    const workspace = await this.getWorkspace(file.workspaceId);
    if (!workspace?.path) {
      throw new Error('Workspace path not found');
    }

    const filePath = join(workspace.path, file.relativePath);
    const content = readFileSync(filePath, 'utf-8');

    // 更新同步时间
    await db.update(openclawFiles)
      .set({
        syncStatus: 'synced',
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(openclawFiles.id, fileId));

    return {
      content,
      version: file.version || 1,
      hash: file.hash,
    };
  }

  /**
   * 获取 workspace
   */
  private async getWorkspace(workspaceId: string): Promise<typeof openclawWorkspaces.$inferSelect | null> {
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, workspaceId));
    return workspace || null;
  }

  /**
   * 扫描文件（仅限白名单目录）
   */
  private async scanFiles(
    dir: string,
    excludePatterns: string[]
  ): Promise<Array<{
    relativePath: string;
    content: string;
    hash: string;
    frontMatter?: Record<string, unknown>;
    modifiedAt: Date;
  }>> {
    const results: Array<{
      relativePath: string;
      content: string;
      hash: string;
      frontMatter?: Record<string, unknown>;
      modifiedAt: Date;
    }> = [];

    const scanRecursive = (currentDir: string) => {
      if (!existsSync(currentDir)) return;
      const entries = readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (this.shouldExclude(fullPath, excludePatterns)) continue;

        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          scanRecursive(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = readFileSync(fullPath, 'utf-8');
          const stat = statSync(fullPath);
          results.push({
            relativePath: relative(dir, fullPath),
            content,
            hash: this.calculateHash(content),
            frontMatter: this.parseFrontMatter(content),
            modifiedAt: new Date(stat.mtime),
          });
        }
      }
    };

    // 1. 扫描根目录白名单文件
    for (const fileName of SYNC_ROOT_FILES) {
      const fullPath = join(dir, fileName);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const stat = statSync(fullPath);
          results.push({
            relativePath: fileName,
            content,
            hash: this.calculateHash(content),
            frontMatter: this.parseFrontMatter(content),
            modifiedAt: new Date(stat.mtime),
          });
        } catch {
          // 跳过读取失败的文件
        }
      }
    }

    // 2. 只扫描白名单子目录
    for (const subDir of SYNC_DIRS) {
      scanRecursive(join(dir, subDir));
    }

    return results;
  }

  /**
   * 检查路径是否应该被排除
   */
  private shouldExclude(path: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern.includes('**')) {
        const basePattern = pattern.replace('/**', '').replace('**/', '');
        if (path.includes(basePattern)) return true;
      } else if (path.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 计算内容哈希
   */
  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * 计算基础哈希（用于冲突检测）
   */
  private calculateBaseHash(content: string): string {
    // 移除 front matter 后计算
    const body = content.replace(/^---[\s\S]*?---\n?/, '');
    return createHash('sha256').update(body).digest('hex').slice(0, 16);
  }

  /**
   * 解析 Front Matter
   */
  private parseFrontMatter(content: string): Record<string, unknown> | undefined {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return undefined;

    const fm: Record<string, unknown> = {};
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          fm[key] = JSON.parse(val);
        } catch {
          fm[key] = val;
        }
      } else {
        fm[key] = val;
      }
    }

    return fm;
  }

  /**
   * 检测文件类型
   */
  private detectFileType(path: string): string {
    const lower = path.toLowerCase();
    if (lower.includes('report')) return 'report';
    if (lower.includes('opportunity')) return 'opportunity';
    if (lower.includes('daily')) return 'daily';
    if (lower.includes('analysis')) return 'analysis';
    if (lower.includes('task')) return 'task_output';
    return 'note';
  }
}

// 单例实例
let syncManagerInstance: SyncManager | null = null;

/**
 * 获取全局同步管理器实例
 */
export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}
