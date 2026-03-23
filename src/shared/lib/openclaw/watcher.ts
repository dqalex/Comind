/**
 * OpenClaw 文件监听器
 * 
 * 监听 workspace 目录变化，触发同步
 * 注意：此模块仅在 Node.js 环境运行
 */

import type { OpenClawWorkspace } from '@/db/schema';
import { OPENCLAW_CONFIG } from './config';
// chokidar v3 是 CommonJS，使用 require 导入
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chokidar = require('chokidar');

export type FileChangeCallback = (workspaceId: string, filePath: string, eventType: 'add' | 'change' | 'unlink') => void;

export class WorkspaceWatcher {
  private watchers: Map<string, import('chokidar').FSWatcher> = new Map();
  private syncQueue: Map<string, NodeJS.Timeout> = new Map();
  private onFileChange: FileChangeCallback;

  constructor(onFileChange: FileChangeCallback) {
    this.onFileChange = onFileChange;
  }

  /**
   * 启动 workspace 监听
   */
  start(workspace: OpenClawWorkspace): boolean {
    // 浏览器环境跳过
    if (typeof window !== 'undefined' || !workspace.watchEnabled) {
      return false;
    }

    // 如果已存在，先停止
    if (this.watchers.has(workspace.id)) {
      this.stop(workspace.id);
    }

    try {
      // chokidar v3 使用正则表达式组合
      // 注意：不能匹配包含 . 目录的路径，只能匹配文件名以 . 开头的
      const watcher = chokidar.watch(workspace.path, {
        ignored: /node_modules|\.git(\/|$)|\.teamclaw-index|\.teamclaw-pending|tasks\/TODO\.md|tasks\/DONE\.md|\/\.(git|obsidian|clawhub)/,
        persistent: true,
        ignoreInitial: true,
        usePolling: true,
        interval: 100,
      });

      console.log(`[Watcher] 创建 watcher: ${workspace.path}`);

      watcher.on('add', (filePath: string) => {
        console.log(`[Watcher] 检测到新增文件: ${filePath}`);
        this.scheduleSync(workspace.id, filePath, 'add');
      });

      watcher.on('change', (filePath: string) => {
        console.log(`[Watcher] 检测到文件变更: ${filePath}`);
        this.scheduleSync(workspace.id, filePath, 'change');
      });

      watcher.on('unlink', (filePath: string) => {
        console.log(`[Watcher] 检测到文件删除: ${filePath}`);
        this.scheduleSync(workspace.id, filePath, 'unlink');
      });

      watcher.on('error', (error: unknown) => {
        console.error(`[Watcher] 错误:`, error);
      });

      watcher.on('ready', () => {
        console.log(`[Watcher] 已就绪，开始监听: ${workspace.path}`);
      });

      this.watchers.set(workspace.id, watcher);
      return true;
    } catch (error) {
      console.error(`[OpenClaw] Failed to start watcher for ${workspace.id}:`, error);
      return false;
    }
  }

  /**
   * 停止 workspace 监听
   */
  stop(workspaceId: string): void {
    const watcher = this.watchers.get(workspaceId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(workspaceId);
    }

    // 清除待处理的同步任务
    for (const [key, timeout] of this.syncQueue) {
      if (key.startsWith(workspaceId)) {
        clearTimeout(timeout);
        this.syncQueue.delete(key);
      }
    }
  }

  /**
   * 停止所有监听
   */
  stopAll(): void {
    for (const [workspaceId] of this.watchers) {
      this.stop(workspaceId);
    }
  }

  /**
   * 检查是否正在监听
   */
  isWatching(workspaceId: string): boolean {
    return this.watchers.has(workspaceId);
  }

  /**
   * 获取所有监听中的 workspace ID
   */
  getActiveWorkspaceIds(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * 调度同步任务（防抖）
   */
  private scheduleSync(workspaceId: string, filePath: string, eventType: 'add' | 'change' | 'unlink'): void {
    const key = `${workspaceId}:${filePath}`;

    // 清除之前的定时器
    const existing = this.syncQueue.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // 设置新的定时器
    const timeout = setTimeout(() => {
      this.syncQueue.delete(key);
      this.onFileChange(workspaceId, filePath, eventType);
    }, OPENCLAW_CONFIG.sync.debounce);

    this.syncQueue.set(key, timeout);
  }

  /**
   * 构建忽略模式
   */
  private buildIgnorePatterns(patterns: string[]): (string | RegExp)[] {
    const defaultPatterns: (string | RegExp)[] = [
      /(^|[/\\])\.[^/\\]/,     // 隐藏文件（以 . 开头的文件名部分）
      /node_modules/,
      /\.git/,
      /temp/,
      /\.teamclaw-index/,
      /\.teamclaw-pending/,
      /tasks\/TODO\.md/,         // TeamClaw 自动生成的任务列表
      /tasks\/DONE\.md/,         // TeamClaw 自动生成的完成列表
    ];

    const customPatterns = patterns.map(p => {
      if (p.includes('*')) {
        return this.globToRegex(p);
      }
      return p;
    });

    return [...defaultPatterns, ...customPatterns];
  }

  /**
   * 将 glob 模式转换为正则
   */
  private globToRegex(glob: string): RegExp {
    const regex = glob
      .replace(/\*\*/g, '<<DOUBLESTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<DOUBLESTAR>>/g, '.*')
      .replace(/\?/g, '[^/]');
    return new RegExp(regex);
  }
}

// 单例实例
let watcherInstance: WorkspaceWatcher | null = null;

/**
 * 获取全局监听器实例
 */
export function getWatcher(onFileChange?: FileChangeCallback): WorkspaceWatcher | null {
  if (typeof window !== 'undefined') {
    return null; // 不在浏览器环境运行
  }

  if (!watcherInstance && onFileChange) {
    watcherInstance = new WorkspaceWatcher(onFileChange);
  }

  return watcherInstance;
}
