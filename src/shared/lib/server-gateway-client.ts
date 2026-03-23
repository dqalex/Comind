/**
 * 服务端 Gateway 客户端
 * 
 * 用于服务端代理模式（REQ-003），提供：
 * - WebSocket 连接管理（使用 Node.js ws 库）
 * - 事件转发到 SSE（通过 eventBus）
 * - 数据库配置读取（加密 Token）
 * - 结构化日志记录
 * 
 * 注意：此模块只能在服务端运行
 */

import 'server-only';
import WebSocket from 'ws';
import { db } from '@/db';
import { gatewayConfigs, members } from '@/db/schema';
import { decryptToken } from '@/lib/security';
import { eventBus, SSEEventType } from '@/lib/event-bus';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { APP_VERSION, APP_VERSION_DISPLAY } from '@/lib/version';
import { parseChatActions, hasChatActions } from '@/lib/chat-channel/parser';
import type { ExecutorOptions, UnrecognizedAction } from '@/lib/chat-channel/types';
import { ACTION_DEFINITIONS } from '@/lib/chat-channel/actions';
import { logger } from '@/lib/gateway-logger';
import { RPC_METHODS } from './rpc-methods';

// re-export 配置 CRUD（向后兼容）
export { saveGatewayConfig, getGatewayConfig, deleteGatewayConfig } from '@/lib/gateway-config-db';

// ==================== 类型定义 ====================

import type { GatewayMessage, GatewayEventHandler, ConnectionStatus } from './gateway-types';
export type { GatewayMessage, GatewayEventHandler, ConnectionStatus } from './gateway-types';

export type ServerGatewayConfig = {
  id: string;
  url: string;
  token: string;
  mode: 'server_proxy' | 'browser_direct';
};

// ==================== 服务端 Gateway 客户端 ====================

export class ServerGatewayClient {
  private ws: WebSocket | null = null;
  private config: ServerGatewayConfig | null = null;
  private pendingRequests = new Map<string, { 
    resolve: (v: unknown) => void; 
    reject: (e: Error) => void;
    startTime: number;
  }>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageId = 0;
  private connected = false;
  private eventHandlers: GatewayEventHandler[] = [];
  private reconnectAttempts = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  // 常量配置
  static readonly MAX_RECONNECT_ATTEMPTS = 10;
  static readonly BASE_RECONNECT_DELAY = 1000;    // 1秒
  static readonly MAX_RECONNECT_DELAY = 60000;    // 60秒
  static readonly HANDSHAKE_TIMEOUT = 10_000;     // 10秒握手超时
  static readonly REQUEST_TIMEOUT = 30_000;       // 30秒请求超时
  static readonly HEARTBEAT_INTERVAL = 30_000;    // 30秒心跳

  constructor() {}

  /**
   * 从数据库加载配置并连接
   */
  async connectFromConfig(): Promise<void> {
    // 从数据库读取默认配置
    const configs = await db.select()
      .from(gatewayConfigs)
      .where(eq(gatewayConfigs.isDefault, true))
      .limit(1);

    if (configs.length === 0) {
      throw new Error('No default gateway config found in database');
    }

    const config = configs[0];

    // browser_direct 模式下服务端不建立 WebSocket 连接
    // 避免与浏览器端连接竞争 chat events
    if (config.mode === 'browser_direct') {
      logger.info('skip_connect_browser_direct', { mode: config.mode });
      return;
    }
    
    // 解密 Token
    const token = decryptToken(config.encryptedToken);
    
    this.config = {
      id: config.id,
      url: config.url,
      token,
      mode: config.mode as 'server_proxy' | 'browser_direct',
    };

    // 更新状态为连接中
    await db.update(gatewayConfigs)
      .set({ status: 'connecting', updatedAt: new Date() })
      .where(eq(gatewayConfigs.id, config.id));

    await this.connect();
  }

  /**
   * 使用指定配置连接
   */
  async connectWithConfig(config: ServerGatewayConfig): Promise<void> {
    this.config = config;
    await this.connect();
  }

  /**
   * 建立 WebSocket 连接
   */
  private async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('No gateway config set');
    }

    const requestId = this.generateRequestId();
    const log = logger.withRequestId(requestId);
    const startTime = Date.now();

    log.info('connect_start', { url: this.config.url.replace(/token=.*/, 'token=***') });

    return new Promise((resolve, reject) => {
      let settled = false;
      let connectSent = false;

      const settle = (ok: boolean, err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimer);
        
        const duration = Date.now() - startTime;
        if (ok) {
          log.info('connect_success', { duration });
          resolve();
        } else {
          log.error('connect_failed', { duration }, err?.message);
          reject(err || new Error('Connection failed'));
        }
      };

      // 握手超时
      const handshakeTimer = setTimeout(() => {
        log.warn('handshake_timeout', { timeout: ServerGatewayClient.HANDSHAKE_TIMEOUT });
        settle(false, new Error('Gateway handshake timeout'));
        this.ws?.close();
      }, ServerGatewayClient.HANDSHAKE_TIMEOUT);

      // 发送 connect 请求
      const sendConnectReq = () => {
        const connectId = this.generateId();
        const params: Record<string, unknown> = {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'webchat-ui',  // Gateway 要求特定的 client id
            displayName: `${APP_VERSION_DISPLAY} Server`,
            version: APP_VERSION,
            platform: 'nodejs',
            mode: 'webchat',   // Gateway 要求特定的 mode
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin'],
          auth: { token: this.config!.token },
          locale: 'zh-CN',
        };
        log.debug('sending_connect', { connectId });
        this.sendRaw({ type: 'req', id: connectId, method: 'connect', params });
      };

      // 创建 WebSocket 连接（使用 Node.js ws 库）
      if (!this.config) {
        settle(false, new Error('No config set'));
        return;
      }
      // 指定 WebSocket 选项，禁用压缩扩展避免兼容性问题
      // 添加 Origin header 以通过 Gateway 的 origin 验证
      this.ws = new WebSocket(this.config.url, {
        handshakeTimeout: ServerGatewayClient.HANDSHAKE_TIMEOUT,
        perMessageDeflate: false,  // 禁用压缩，避免 mask 函数问题
        headers: {
          Origin: 'http://localhost:3000',  // Gateway 需要验证 origin
        },
      });

      this.ws.on('open', () => {
        log.debug('ws_opened', {});
        // 等待 challenge 或超时后主动发送 connect
        setTimeout(() => {
          if (!settled && !connectSent) {
            connectSent = true;
            sendConnectReq();
          }
        }, 750);
      });

      this.ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
        try {
          // 检查是否为二进制数据
          if (isBinary) {
            log.debug('ws_message_binary', { size: Buffer.isBuffer(data) ? data.length : 0 });
          }
          const msg = JSON.parse(data.toString()) as GatewayMessage;
          log.debug('ws_message', { type: msg.type, event: msg.event, method: msg.method });

          // 处理 challenge 事件
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            log.debug('received_challenge', {});
            if (!connectSent) {
              connectSent = true;
              sendConnectReq();
            }
            return;
          }

          // 处理 hello-ok 响应
          if (msg.type === 'res' && msg.ok) {
            const payload = msg.payload as Record<string, unknown> | undefined;
            if (payload && (payload.type === 'hello-ok' || payload.protocol !== undefined)) {
              log.info('received_hello_ok', { protocol: payload.protocol });
              this.connected = true;
              this.reconnectAttempts = 0;
              this.updateConfigStatus('connected');
              this.startHeartbeat();
              // 通知前端连接成功
              this.notifyStatusChange('connected');
              settle(true);
              // 切换到正常消息处理
              this.ws!.on('message', this.handleMessage.bind(this));
              return;
            }
          }

          // 处理连接拒绝（认证失败等）
          if (msg.type === 'res' && !msg.ok && !this.connected) {
            const errMsg = typeof msg.error === 'string' 
              ? msg.error 
              : (msg.error as { message?: string })?.message || 'Connection rejected';
            log.error('connection_rejected', { error: errMsg });
            // 首次连接就被拒绝，说明配置有误（token 错误等），不再重试
            if (this.reconnectAttempts === 0) {
              this.updateConfigStatus('error_auth', errMsg);
            }
            settle(false, new Error(errMsg));
            return;
          }
        } catch (e) {
          log.error('message_parse_error', {}, String(e));
        }
      });

      this.ws.on('error', (error: Error) => {
        log.error('ws_error', {}, error.message);
        // 首次连接就出错（网络不可达等），标记为连接错误
        if (this.reconnectAttempts === 0) {
          this.updateConfigStatus('error_connection', error.message);
        }
        settle(false, error);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        log.info('ws_closed', { code, reason: reason.toString() });
        this.connected = false;
        this.stopHeartbeat();
        
        if (!settled) {
          // 首次连接就断开，可能是地址错误或 Gateway 未启动
          if (this.reconnectAttempts === 0) {
            const reasonStr = reason.toString() || 'Connection closed unexpectedly';
            this.updateConfigStatus('error_connection', reasonStr);
          }
          settle(false, new Error(`WebSocket closed (code: ${code})`));
        } else {
          // 已连接后断开，触发重连
          this.updateConfigStatus('disconnected');
          // 通知前端连接断开
          this.notifyStatusChange('disconnected');
          this.scheduleReconnect();
        }
      });
    });
  }

  /**
   * 处理正常消息
   */
  private handleMessage(data: WebSocket.Data, isBinary: boolean): void {
    try {
      if (isBinary) {
        logger.debug('handle_message_binary', { size: Buffer.isBuffer(data) ? data.length : 0 });
      }
      const msg = JSON.parse(data.toString()) as GatewayMessage;

      // 处理响应
      if (msg.type === 'res' && msg.id) {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          const duration = Date.now() - pending.startTime;
          
          if (msg.ok) {
            logger.withRequestId(msg.id).info('request_success', { duration });
            pending.resolve(msg.payload);
          } else {
            const errMsg = typeof msg.error === 'string' 
              ? msg.error 
              : (msg.error as { message?: string })?.message || 'Request failed';
            logger.withRequestId(msg.id).error('request_failed', { duration, error: errMsg });
            pending.reject(new Error(errMsg));
          }
        }
      }

      // 处理事件
      if (msg.type === 'event' && msg.event) {
        logger.withRequestId(this.generateRequestId()).info('event_received', { event: msg.event });
        
        // 调用本地事件处理器
        for (const handler of this.eventHandlers) {
          try {
            handler(msg.event, msg.payload);
          } catch (e) {
            logger.error('event_handler_error', { event: msg.event }, String(e));
          }
        }

        // 转发事件到 SSE
        this.forwardEventToSSE(msg.event, msg.payload);
      }
    } catch (e) {
      logger.error('handle_message_error', {}, String(e));
    }
  }

  /**
   * 转发事件到 SSE
   */
  // chat delta 批量缓冲（减少 SSE 推送频率）
  private chatDeltaBuffer: Map<string, { deltas: string[]; lastPayload: unknown }> = new Map();
  private chatDeltaFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly CHAT_DELTA_FLUSH_INTERVAL = 50; // 50ms 批量合并

  private forwardEventToSSE(event: string, payload: unknown): void {
    // 根据事件类型决定如何转发
    const eventType = this.mapGatewayEventToSSEType(event);
    
    if (eventType) {
      if (event === 'chat') {
        const chatPayload = payload as { sessionKey?: string; state?: string; runId?: string; message?: { content?: unknown; text?: string } } | undefined;
        
        // [F2] 服务端自动解析执行 chat actions（不依赖前端 ChatPanel）
        if (chatPayload?.state === 'final') {
          // final 事件：先 flush 缓冲区，再立即发送 final
          this.flushChatDeltaBuffer();
          this.handleChatActions(chatPayload).catch(err => {
            logger.error('chat_actions_auto_exec_error', {
              sessionKey: chatPayload?.sessionKey,
            }, String(err));
          });
          eventBus.emit({ type: eventType, data: { gatewayEvent: event, payload } });
          return;
        }
        
        if (chatPayload?.state === 'delta') {
          // delta 事件：缓冲合并，减少 SSE 推送频率
          const key = chatPayload.sessionKey || '_default';
          const buf = this.chatDeltaBuffer.get(key);
          const msg = chatPayload.message;
          const text = (typeof msg?.content === 'string' ? msg.content : msg?.text) || '';
          
          if (buf) {
            buf.deltas.push(text);
            buf.lastPayload = payload;
          } else {
            this.chatDeltaBuffer.set(key, { deltas: [text], lastPayload: payload });
          }
          
          // 设置定时 flush
          if (!this.chatDeltaFlushTimer) {
            this.chatDeltaFlushTimer = setTimeout(() => {
              this.flushChatDeltaBuffer();
            }, ServerGatewayClient.CHAT_DELTA_FLUSH_INTERVAL);
          }
          return;
        }
        
        // 其他 chat 状态（start 等）直接转发
        eventBus.emit({ type: eventType, data: { gatewayEvent: event, payload } });
        return;
      }
      eventBus.emit({
        type: eventType,
        data: {
          gatewayEvent: event,
          payload,
        },
      });
    }
  }

  /**
   * 将缓冲的 chat delta 合并后一次性推送
   */
  private flushChatDeltaBuffer(): void {
    if (this.chatDeltaFlushTimer) {
      clearTimeout(this.chatDeltaFlushTimer);
      this.chatDeltaFlushTimer = null;
    }
    
    for (const [, buf] of this.chatDeltaBuffer) {
      if (buf.deltas.length === 0) continue;
      
      // 将多个 delta 合并为一条
      const mergedText = buf.deltas.join('');
      const mergedPayload = buf.lastPayload as Record<string, unknown>;
      const mergedMessage = { ...(mergedPayload?.message as Record<string, unknown> || {}), content: mergedText, text: mergedText };
      const finalPayload = { ...mergedPayload, message: mergedMessage };
      
      eventBus.emit({
        type: 'gateway_chat_event',
        data: { gatewayEvent: 'chat', payload: finalPayload },
      });
    }
    
    this.chatDeltaBuffer.clear();
  }

  /**
   * [F2] 自动解析并执行 chat 消息中的 actions
   * 
   * 当 server_proxy 模式下收到 final chat 消息时：
   * 1. 提取消息文本内容
   * 2. 检测是否包含 {"actions": [...]}
   * 3. 解析 actions 并通过 executor 执行
   * 4. 将执行结果通过 chat.send 回传给 AI
   */
  private async handleChatActions(chatPayload: Record<string, unknown>): Promise<void> {
    const sessionKey = chatPayload.sessionKey as string | undefined;
    const message = chatPayload.message as Record<string, unknown> | undefined;
    
    if (!message) return;
    
    // 提取消息文本内容（兼容不同消息格式）
    const content = this.extractMessageContent(message);
    if (!content) return;

    // 快速检测是否包含 actions
    if (!hasChatActions(content)) return;

    logger.info('chat_actions_detected', {
      sessionKey: sessionKey || 'unknown',
      contentLength: content.length,
    });

    // 解析 actions
    const { actions, hasActions, parseError, unrecognized } = parseChatActions(content);
    
    if (parseError) {
      logger.warn('chat_actions_parse_error', {
        sessionKey: sessionKey || 'unknown',
        error: parseError,
      });
    }

    if (!hasActions || actions.length === 0) {
    // 即使没有有效 action，如果有未识别的 action，也回传建议
    if (unrecognized && unrecognized.length > 0 && sessionKey && this.connected) {
      const hintMessage = this.formatUnrecognizedHints(unrecognized);
      try {
        await this.request(RPC_METHODS.CHAT_SEND, {
          sessionKey,
          message: hintMessage,
          idempotencyKey: `action-hint-${Date.now()}`,
        });
        logger.info('chat_actions_hint_sent', {
          sessionKey,
          unrecognizedCount: unrecognized.length,
        });
      } catch (sendErr) {
        logger.error('chat_actions_hint_send_failed', { sessionKey }, String(sendErr));
      }
    }
      return;
    }

    logger.info('chat_actions_executing', {
      sessionKey: sessionKey || 'unknown',
      actionCount: actions.length,
      actionTypes: actions.map(a => a.type),
    });

    // [F3] 从 sessionKey 推导 memberId（用于 get_mcp_token 等需要身份的操作）
    let memberId: string | undefined;
    if (sessionKey) {
      memberId = await this.resolveMemberIdFromSession(sessionKey);
      if (memberId) {
        logger.info('chat_actions_member_resolved', {
          sessionKey,
          memberId,
        });
      }
    }

    // 执行 actions (动态导入避免循环依赖)
    const executorOptions: ExecutorOptions = {
      source: 'chat',
      memberId,
      triggerRefresh: false,  // 服务端不需要触发 Zustand Store 刷新（通过 eventBus 通知前端）
    };

    const { executeActions } = await import('@/lib/chat-channel/executor');
    const result = await executeActions(actions, executorOptions);

    logger.info('chat_actions_executed', {
      sessionKey: sessionKey || 'unknown',
      total: result.summary.total,
      success: result.summary.success,
      failed: result.summary.failed,
      requestId: result.requestId,
    });

    // [F4] 将执行结果通过 chat.send 回传给 AI
    if (sessionKey && this.connected) {
      try {
        const resultMessage = this.formatActionResults(result, unrecognized);
        await this.request(RPC_METHODS.CHAT_SEND, {
          sessionKey,
          message: resultMessage,
          idempotencyKey: `action-result-${result.requestId}`,
        });
        logger.info('chat_actions_result_sent', {
          sessionKey,
          requestId: result.requestId,
        });
      } catch (sendErr) {
        logger.error('chat_actions_result_send_failed', {
          sessionKey,
          requestId: result.requestId,
        }, String(sendErr));
      }
    }
  }

  /**
   * 提取消息内容文本（兼容多种消息格式）
   */
  private extractMessageContent(message: Record<string, unknown>): string {
    // 格式1: { content: string }
    if (typeof message.content === 'string') {
      return message.content;
    }
    // 格式2: { content: [{ type: 'text', text: '...' }] } (OpenAI 格式)
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part: unknown) => typeof part === 'object' && part !== null && (part as Record<string, unknown>).type === 'text')
        .map((part: unknown) => (part as Record<string, unknown>).text || '')
        .join('\n');
    }
    // 格式3: { text: string }
    if (typeof message.text === 'string') {
      return message.text;
    }
    return '';
  }

  /**
   * [F3] 从 sessionKey 推导 memberId
   * sessionKey 格式通常为 "agent:xxx"，xxx 是 agentId
   * 需要通过 agentId 查找对应的 member 记录
   */
  private async resolveMemberIdFromSession(sessionKey: string): Promise<string | undefined> {
    try {
      // 从 sessionKey 提取 agentId
      const agentIdMatch = sessionKey.match(/^agent:(.+)$/);
      if (!agentIdMatch) return undefined;
      
      const agentId = agentIdMatch[1];
      
      // 查找 openclawAgentId 匹配的成员
      const result = await db.select().from(members).where(
        and(
          eq(members.type, 'ai'),
          eq(members.openclawAgentId, agentId),
        )
      );
      
      if (result.length > 0) {
        return result[0].id;
      }

      // 回退：尝试用 openclawName 匹配（有些 agent 的 name 就是 agentId）
      const byName = await db.select().from(members).where(
        and(
          eq(members.type, 'ai'),
          eq(members.openclawName, agentId),
        )
      );
      
      if (byName.length > 0) {
        return byName[0].id;
      }
      
      logger.warn('chat_actions_member_not_found', { sessionKey, agentId });
      return undefined;
    } catch (err) {
      logger.error('chat_actions_member_resolve_error', { sessionKey }, String(err));
      return undefined;
    }
  }

  /**
   * [F4] 格式化 action 执行结果为回传消息
   */
  private formatActionResults(
    result: { results: Array<{ type: string; success: boolean; message: string; data?: Record<string, unknown> }>; summary: { total: number; success: number; failed: number }; requestId: string },
    unrecognized?: UnrecognizedAction[]
  ): string {
    const lines: string[] = [];
    lines.push(`[TeamClaw Action Results] (requestId: ${result.requestId})`);
    lines.push(`执行完成: ${result.summary.success}/${result.summary.total} 成功`);
    lines.push('');
    
    for (const r of result.results) {
      const icon = r.success ? '✅' : '❌';
      lines.push(`${icon} ${r.type}: ${r.message}`);
      // 对于 get_mcp_token 等需要返回数据的操作，附加 data
      if (r.success && r.data && Object.keys(r.data).length > 0) {
        lines.push('```json');
        lines.push(JSON.stringify(r.data, null, 2));
        lines.push('```');
      }
    }
    
    // 附加自动修正提示
    if (unrecognized && unrecognized.length > 0) {
      const autoFixed = unrecognized.filter(u => u.autoFixed);
      const notFixed = unrecognized.filter(u => !u.autoFixed);
      
      if (autoFixed.length > 0) {
        lines.push('');
        lines.push('⚠️ 自动修正了以下 action type:');
        for (const u of autoFixed) {
          lines.push(`  "${u.originalType}" → "${u.suggestedType}"`);
        }
        lines.push('建议直接使用标准 type 名称以避免歧义。');
      }
      
      if (notFixed.length > 0) {
        lines.push('');
        lines.push('❓ 以下 action type 无法识别:');
        for (const u of notFixed) {
          if (u.suggestedType) {
            lines.push(`  "${u.originalType}" — 你是否想用 "${u.suggestedType}"？`);
          } else {
            lines.push(`  "${u.originalType}" — 无法匹配到任何已知操作`);
          }
        }
        lines.push('');
        lines.push(this.buildAvailableActionsHint());
      }
    }
    
    return lines.join('\n');
  }

  /**
   * 格式化未识别 action 的提示信息（当所有 action 都无法识别时）
   */
  private formatUnrecognizedHints(unrecognized: UnrecognizedAction[]): string {
    const lines: string[] = [];
    lines.push('[TeamClaw Action Parser] 你发送的 actions 中包含无法识别的操作类型:');
    lines.push('');
    
    for (const u of unrecognized) {
      if (u.suggestedType) {
        lines.push(`  ❓ "${u.originalType}" — 你是否想用 "${u.suggestedType}"？正确格式: {"type": "${u.suggestedType}", ...}`);
      } else {
        lines.push(`  ❓ "${u.originalType}" — 无法匹配到任何已知操作`);
      }
    }
    
    lines.push('');
    lines.push(this.buildAvailableActionsHint());
    
    return lines.join('\n');
  }

  /**
   * 构建可用 action 列表提示
   */
  private buildAvailableActionsHint(): string {
    const definitions = Object.values(ACTION_DEFINITIONS).filter(def => def.supportedInChat);

    // 按类别分组
    const byCategory = {
      query: definitions.filter(d => d.category === 'query'),
      write: definitions.filter(d => d.category === 'write'),
      status: definitions.filter(d => d.category === 'status'),
      sop: definitions.filter(d => d.category === 'sop'),
      extension: definitions.filter(d => d.category === 'extension'),
    };

    const lines: string[] = [];
    lines.push('支持的 chat action type:');

    if (byCategory.query.length > 0) {
      lines.push(`\n🔍 查询类: ${byCategory.query.map(d => `"${d.type}"`).join(', ')}`);
    }
    if (byCategory.write.length > 0) {
      lines.push(`✏️ 写入类: ${byCategory.write.map(d => `"${d.type}"`).join(', ')}`);
    }
    if (byCategory.status.length > 0) {
      lines.push(`📊 状态类: ${byCategory.status.map(d => `"${d.type}"`).join(', ')}`);
    }
    if (byCategory.sop.length > 0) {
      lines.push(`📋 SOP类: ${byCategory.sop.map(d => `"${d.type}"`).join(', ')}`);
    }
    if (byCategory.extension.length > 0) {
      lines.push(`🔧 扩展类: ${byCategory.extension.map(d => `"${d.type}"`).join(', ')}`);
    }

    lines.push('\n💡 详细使用说明请阅读 teamclaw skill 文档（skills/teamclaw/SKILL.md）');

    return lines.join('\n');
  }

  /**
   * 映射 Gateway 事件到 SSE 事件类型
   */
  private mapGatewayEventToSSEType(event: string): SSEEventType | null {
    // Agent 相关事件
    if (event.startsWith('agent')) {
      return 'gateway_agent_update';
    }
    // 会话相关事件
    if (event.startsWith('session')) {
      return 'gateway_session_update';
    }
    // Chat 事件
    if (event === 'chat') {
      return 'gateway_chat_event';
    }
    // Cron 事件
    if (event.startsWith('cron')) {
      return 'gateway_cron_update';
    }
    // 配置事件
    if (event.startsWith('config')) {
      return 'gateway_config_update';
    }
    // 默认：通用 Gateway 事件
    return 'gateway_event';
  }

  /**
   * 发送请求
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.generateId();
    const requestId = this.generateRequestId();
    const log = logger.withRequestId(requestId);

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        log.error('request_failed', { method }, 'Not connected');
        reject(new Error('Not connected'));
        return;
      }

      log.info('request_start', { method, requestId: id });

      this.pendingRequests.set(id, { 
        resolve: resolve as (v: unknown) => void, 
        reject,
        startTime: Date.now(),
      });

      this.sendRaw({ type: 'req', id, method, params: params || {} });

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          log.error('request_timeout', { method, timeout: ServerGatewayClient.REQUEST_TIMEOUT });
          reject(new Error(`Request ${method} timed out`));
        }
      }, ServerGatewayClient.REQUEST_TIMEOUT);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    logger.info('disconnect', {});
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.updateConfigStatus('disconnected');
  }

  /**
   * 注册事件处理器
   */
  onEvent(handler: GatewayEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取当前配置
   */
  get currentConfig(): ServerGatewayConfig | null {
    return this.config;
  }

  // ==================== 私有方法 ====================

  private generateId(): string {
    return `req-${++this.messageId}-${Date.now()}`;
  }

  private generateRequestId(): string {
    return randomBytes(8).toString('hex');
  }

  private sendRaw(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    if (this.reconnectAttempts >= ServerGatewayClient.MAX_RECONNECT_ATTEMPTS) {
      logger.warn('max_reconnect_attempts_reached', { attempts: this.reconnectAttempts });
      this.updateConfigStatus('error', 'Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      ServerGatewayClient.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      ServerGatewayClient.MAX_RECONNECT_DELAY
    );
    this.reconnectAttempts++;

    logger.info('scheduling_reconnect', { 
      delay, 
      attempt: this.reconnectAttempts,
      maxAttempts: ServerGatewayClient.MAX_RECONNECT_ATTEMPTS,
    });

    this.updateConfigStatus('connecting');

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (e) {
        logger.error('reconnect_failed', {}, String(e));
        this.scheduleReconnect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.request('health', { probe: true }).catch(() => {
          logger.warn('heartbeat_failed', {});
        });
      }
    }, ServerGatewayClient.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async updateConfigStatus(status: ConnectionStatus, error?: string): Promise<void> {
    if (!this.config) return;

    try {
      await db.update(gatewayConfigs)
        .set({
          status,
          lastError: error || null,
          lastConnectedAt: status === 'connected' ? new Date() : undefined,
          reconnectAttempts: this.reconnectAttempts,
          updatedAt: new Date(),
        })
        .where(eq(gatewayConfigs.id, this.config.id));
    } catch (e) {
      logger.error('update_status_failed', {}, String(e));
    }
  }

  /**
   * 通知前端连接状态变化（通过 SSE）
   */
  private notifyStatusChange(status: ConnectionStatus): void {
    eventBus.emit({
      type: 'gateway_status_update',
      data: {
        status,
        mode: this.config?.mode,
        timestamp: Date.now(),
      },
    });
  }
}

// ==================== 单例管理 ====================

// 使用 globalThis 存储单例，确保在热重载和不同模块上下文中保持一致
const GLOBAL_CLIENT_KEY = '__teamclaw_server_gateway_client__';

/**
 * 获取服务端 Gateway 客户端单例
 */
export function getServerGatewayClient(): ServerGatewayClient {
  const globalObj = globalThis as Record<string, unknown>;
  
  if (!globalObj[GLOBAL_CLIENT_KEY]) {
    globalObj[GLOBAL_CLIENT_KEY] = new ServerGatewayClient();
  }
  
  return globalObj[GLOBAL_CLIENT_KEY] as ServerGatewayClient;
}

/**
 * 初始化服务端 Gateway 客户端
 */
export async function initServerGatewayClient(): Promise<ServerGatewayClient | null> {
  const client = getServerGatewayClient();
  
  try {
    await client.connectFromConfig();
    logger.info('init_success', {});
    return client;
  } catch (e) {
    logger.error('init_failed', {}, String(e));
    return null;
  }
}


