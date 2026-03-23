/**
 * Gateway 结构化日志系统
 * 
 * 提供控制台输出 + 文件持久化的日志能力
 * 从 server-gateway-client.ts 提取
 */

import 'server-only';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// ==================== 类型 ====================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  module: string;
  action: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  message?: string;
};

export type RequestLogger = {
  debug: (action: string, metadata?: Record<string, unknown>) => void;
  info: (action: string, metadata?: Record<string, unknown>) => void;
  warn: (action: string, metadata?: Record<string, unknown>) => void;
  error: (action: string, metadata?: Record<string, unknown>, message?: string) => void;
};

// ==================== 日志类 ====================

export class GatewayLogger {
  private logDir: string;

  constructor() {
    // 日志目录：优先使用项目根目录的 logs/，否则使用当前工作目录
    // standalone 模式下工作目录可能不是项目根目录
    const cwd = process.cwd();
    const projectRoot = process.env.TEAMCLAW_DB_PATH 
      ? join(process.env.TEAMCLAW_DB_PATH, '..') 
      : cwd;
    this.logDir = join(projectRoot, 'logs');
    
    if (!existsSync(this.logDir)) {
      try {
        mkdirSync(this.logDir, { recursive: true });
      } catch (e) {
        // 创建失败时禁用文件日志
        console.warn('[Gateway] Failed to create log directory:', e);
      }
    }
  }

  log(entry: Omit<LogEntry, 'timestamp'>): void {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // 控制台输出
    const levelColors = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level] || '';
    
    console.log(
      `${color}[Gateway]${reset} ${fullEntry.timestamp} [${entry.level.toUpperCase()}] ${entry.action}`,
      entry.metadata ? JSON.stringify(entry.metadata) : '',
      entry.message || ''
    );

    // 文件写入
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(this.logDir, `gateway-${date}.log`);
      appendFileSync(logFile, JSON.stringify(fullEntry) + '\n', 'utf-8');
    } catch (e) {
      console.error('Failed to write gateway log:', e);
    }
  }

  debug(action: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      this.log({ level: 'debug', module: 'server-gateway', action, metadata });
    }
  }

  info(action: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'info', module: 'server-gateway', action, metadata });
  }

  warn(action: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'warn', module: 'server-gateway', action, metadata });
  }

  error(action: string, metadata?: Record<string, unknown>, message?: string): void {
    this.log({ level: 'error', module: 'server-gateway', action, metadata, message });
  }

  // 带请求 ID 的日志
  withRequestId(requestId: string): RequestLogger {
    return {
      debug: (action, metadata) => this.debug(action, { ...metadata, requestId }),
      info: (action, metadata) => this.info(action, { ...metadata, requestId }),
      warn: (action, metadata) => this.warn(action, { ...metadata, requestId }),
      error: (action, metadata, message) => this.error(action, { ...metadata, requestId }, message),
    };
  }
}

/** 模块级单例 logger */
export const logger = new GatewayLogger();
