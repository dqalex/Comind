'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useChatStore } from '@/domains/chat';
import { useMemberStore } from '@/domains/member';
import { useGatewayStore } from '@/core/gateway/store';
import { useAuthStore } from '@/domains/auth';
import type { ChatAttachment } from '@/types';
import {
  X, ChevronLeft, Maximize2, Minimize2,
} from 'lucide-react';
import { type ThinkingLevel, getActiveGwClient, normalizeContent, normalizeHistoryMessages } from './chat-utils';
import { subscribeChatStream } from '@/hooks/useChatStream';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import ChatInputArea from './ChatInputArea';
import ChatMessageList from './ChatMessageList';
import ChatSessionList from './ChatSessionList';
import { useTranslation } from 'react-i18next';

interface ChatPanelProps {
  onClose: () => void;
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const { t } = useTranslation();
  // 使用单一 selector 合并相关状态，减少订阅数量
  const {
    sessions,
    activeSessionId,
    selectedMemberId,
    sending,
    initialized,
    pendingChatMessage,
    pendingChatMemberId,
    pendingGatewaySessionKey,
    activeGwSessionKey,
  } = useChatStore(useCallback((s) => ({
    sessions: s.sessions,
    activeSessionId: s.activeSessionId,
    selectedMemberId: s.selectedMemberId,
    sending: s.sending,
    initialized: s.initialized,
    pendingChatMessage: s.pendingChatMessage,
    pendingChatMemberId: s.pendingChatMemberId,
    pendingGatewaySessionKey: s.pendingGatewaySessionKey,
    activeGwSessionKey: s.activeGwSessionKey,
  }), []));

  // 方法引用稳定不变，单独订阅
  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const createSession = useChatStore((s) => s.createSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setSelectedMember = useChatStore((s) => s.setSelectedMember);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setSending = useChatStore((s) => s.setSending);
  const updateSessionConversationId = useChatStore((s) => s.updateSessionConversationId);
  const clearPendingChat = useChatStore((s) => s.clearPendingChat);
  const setActiveGwSessionKey = useChatStore((s) => s.setActiveGwSessionKey);

  // 精确 selector 订阅
  const members = useMemberStore((s) => s.members);

  // Gateway 连接状态
  const gwConnected = useGatewayStore((s) =>
    s.connectionMode === 'server_proxy' ? s.serverProxyConnected : s.connected
  );
  const agentsMainKey = useGatewayStore((s) => s.agentsMainKey);
  const getUserSessionKey = useGatewayStore((s) => s.getUserSessionKey);

  // Gateway 会话状态
  const [gwSessionMessages, setGwSessionMessages] = useState<{ role: string; content: unknown }[]>([]);
  const [gwSessionKey, setGwSessionKey] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 消息队列
  interface QueueItem { id: string; text: string; attachments: ChatAttachment[] }
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;

  // Abort 支持
  const [currentRun, setCurrentRun] = useState<{ sessionKey: string; runId: string } | null>(null);
  const abortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus 模式
  const [focusMode, setFocusMode] = useState(false);

  // 同步标记：避免持久监听器和发送监听器竞争
  const handlerActiveRef = useRef(false);

  // 派生数据
  const aiMembers = useMemo(() => members.filter(m => m.type === 'ai'), [members]);
  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  // 自动滚动
  const {
    messagesEndRef, scrollContainerRef, showScrollBtn, handleScroll, scrollToBottom,
  } = useAutoScroll(
    activeSession?.messages.length ?? 0,
    gwSessionMessages.length,
  );

  // 额外触发：historyLoaded 变化时也要滚动
  useEffect(() => {
    if (historyLoaded) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      });
    }
  }, [historyLoaded, messagesEndRef]);

  // 清理 abort timeout
  useEffect(() => {
    return () => {
      if (abortTimeoutRef.current) clearTimeout(abortTimeoutRef.current);
    };
  }, []);

  // 初始化
  useEffect(() => {
    if (!initialized) fetchSessions();
  }, [initialized, fetchSessions]);

  // ==================== Gateway 会话事件处理 ====================

  // 辅助：更新 gwSessionMessages 中的 assistant 消息
  const updateGwAssistant = useCallback((content: string) => {
    setGwSessionMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { role: 'assistant', content }];
      }
      return [...prev, { role: 'assistant', content }];
    });
  }, []);

  // 辅助：完成 gwSession 流式响应
  const completeGwStream = useCallback((content: string) => {
    updateGwAssistant(content);
    setSending(false);
  }, [updateGwAssistant, setSending]);

  // 处理 pending 消息（从外部触发的聊天）
  useEffect(() => {
    console.log('[ChatPanel] Pending message effect triggered:', {
      hasMessage: !!pendingChatMessage,
      initialized,
      gwConnected,
      agentsMainKey,
      pendingGatewaySessionKey,
      handlerActive: handlerActiveRef.current,
    });
    
    if (!pendingChatMessage || !initialized) return;
    if (gwConnected && !agentsMainKey && !pendingGatewaySessionKey) {
      console.log('[ChatPanel] Waiting for agentsMainKey or pendingGatewaySessionKey');
      return;
    }

    const msg = pendingChatMessage;
    // v3.0 多用户：优先使用 pendingGatewaySessionKey（用户专用会话），否则使用 agentsMainKey
    const targetSessionKey = pendingGatewaySessionKey || agentsMainKey;
    console.log('[ChatPanel] Processing pending message with session:', targetSessionKey);
    clearPendingChat();

    // Gateway 模式
    if (gwConnected && targetSessionKey) {
      console.log('[ChatPanel] Using Gateway mode, setting up session');
      setGwSessionKey(targetSessionKey);
      setActiveGwSessionKey(targetSessionKey);
      setActiveSession(null);
      setLoadingHistory(true);
      setHistoryLoaded(false);
      setGwSessionMessages([]);

      const gwClient = getActiveGwClient();
      if (!gwClient) { 
        console.error('[ChatPanel] No Gateway client available');
        setLoadingHistory(false); 
        return; 
      }

      // 加载历史 → 发送消息 → 订阅流式回复
      gwClient.getChatHistory(targetSessionKey, 200)
        .then((result) => {
          console.log('[ChatPanel] Chat history loaded, messages count:', result.messages?.length || 0);
          const historyMsgs = normalizeHistoryMessages(result.messages || []);
          setGwSessionMessages([...historyMsgs, { role: 'user', content: msg }]);
          setHistoryLoaded(true);
          setLoadingHistory(false);

          // 订阅 AI 响应
          console.log('[ChatPanel] Subscribing to chat stream for:', targetSessionKey);
          setSending(true);
          setGwSessionMessages(prev => [...prev, { role: 'assistant', content: '' }]);

          const stream = subscribeChatStream(targetSessionKey, {
            onDelta: (content) => {
              console.log('[ChatPanel] Send listener received delta, length:', content.length);
              updateGwAssistant(content);
            },
            onComplete: (content, state, error) => {
              console.log('[ChatPanel] Send listener completed:', state, 'handlerActive will be reset');
              completeGwStream(content);
              // 确保 handlerActiveRef 被重置
              handlerActiveRef.current = false;
            },
          }, handlerActiveRef);

          setTimeout(() => {
            console.log('[ChatPanel] Sending chat message to Gateway');
            gwClient.sendChatMessage({
              sessionKey: targetSessionKey,
              message: msg,
            }).catch((e) => {
              console.error('[ChatPanel] Failed to send message:', e);
              stream.cleanup();
              handlerActiveRef.current = false;
              setSending(false);
            });
          }, 100);
        })
        .catch((e) => {
          console.error('[ChatPanel] Failed to load chat history:', e);
          setLoadingHistory(false);
          setGwSessionMessages([{ role: 'user', content: msg }]);
          setHistoryLoaded(true);

          // 即使加载历史失败也发送消息
          console.log('[ChatPanel] Sending message without history');
          setSending(true);
          setGwSessionMessages(prev => [...prev, { role: 'assistant', content: '' }]);
          const stream = subscribeChatStream(targetSessionKey, {
            onDelta: (content) => {
              console.log('[ChatPanel] Send listener (no history) received delta, length:', content.length);
              updateGwAssistant(content);
            },
            onComplete: (content, state, error) => {
              console.log('[ChatPanel] Send listener (no history) completed:', state);
              completeGwStream(content);
              handlerActiveRef.current = false;
            },
          }, handlerActiveRef);

          setTimeout(() => {
            gwClient.sendChatMessage({
              sessionKey: targetSessionKey,
              message: msg,
            }).catch((err) => {
              console.error('[ChatPanel] Failed to send message:', err);
              stream.cleanup();
              handlerActiveRef.current = false;
              setSending(false);
            });
          }, 100);
        });
      return;
    }

    // 本地 session 模式
    const memberId = pendingChatMemberId || aiMembers[0]?.id;
    if (!memberId) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    (async () => {
      const sid = await createSession(memberId, member.name);
      await addMessage(sid, { role: 'user', content: msg, status: 'sent' });
    })();
  }, [pendingChatMessage, pendingChatMemberId, initialized, gwConnected, agentsMainKey, aiMembers, members, clearPendingChat, createSession, addMessage, setActiveSession, setActiveGwSessionKey, setSending, updateGwAssistant, completeGwStream]);

  // 处理 Gateway session 跳转
  useEffect(() => {
    console.log('[ChatPanel] Session jump effect triggered:', { 
      pendingGatewaySessionKey, 
      gwConnected,
      pendingChatMessage: !!pendingChatMessage 
    });
    
    if (!pendingGatewaySessionKey || !gwConnected) {
      console.log('[ChatPanel] Skipping session jump - missing key or not connected');
      return;
    }
    const key = pendingGatewaySessionKey;
    console.log('[ChatPanel] Setting up Gateway session:', key);
    
    // 关键修复：只有当没有 pendingChatMessage 时才清理
    // 如果有 pendingChatMessage，让 Pending message effect 来处理清理和发送
    if (!pendingChatMessage) {
      console.log('[ChatPanel] No pending message, clearing pending chat');
      clearPendingChat();
    } else {
      console.log('[ChatPanel] Has pending message, skipping clearPendingChat (will be handled by pending message effect)');
    }

    setGwSessionKey(key);
    setGwSessionMessages([]);
    setLoadingHistory(true);
    setHistoryLoaded(false);
    setActiveSession(null);

    const gwClient = getActiveGwClient();
    if (!gwClient) { setLoadingHistory(false); return; }

    gwClient.getChatHistory(key, 200)
      .then((result) => {
        setGwSessionMessages(normalizeHistoryMessages(result.messages || []));
        setHistoryLoaded(true);
      })
      .catch((e) => {
        setGwSessionMessages([]);
        setErrorMessage('加载对话历史失败，请重试');
        console.error('Failed to load chat history:', e);
      })
      .finally(() => setLoadingHistory(false));
  }, [pendingGatewaySessionKey, gwConnected, pendingChatMessage, clearPendingChat, setActiveSession]);

  // 持续监听 Gateway session 的 chat 事件（接收 AI 主动推送）
  // 关键修复：只要有 gwSessionKey 就注册监听器，不依赖 gwConnected
  // 因为 gwConnected 可能在消息发送后才变为 true，导致错过响应
  useEffect(() => {
    console.log('[ChatPanel] Persistent listener effect triggered:', { 
      gwSessionKey, 
      gwConnected, 
      hasHandlerActiveRef: !!handlerActiveRef 
    });
    
    // 关键修复：只检查 gwSessionKey，不检查 gwConnected
    // gwConnected 可能在消息发送后才变为 true，如果等待它，会错过 AI 响应
    if (!gwSessionKey) {
      console.log('[ChatPanel] Skipping persistent listener - no session key');
      return;
    }

    console.log('[ChatPanel] Registering persistent listener for:', gwSessionKey, '(connected:', gwConnected, ')');

    const stream = subscribeChatStream(gwSessionKey, {
      onDelta: (accumulated) => {
        // 当发送中的 handler 活跃时，跳过持久监听器的处理
        if (handlerActiveRef.current) {
          console.log('[ChatPanel] Skipping delta (handler active)');
          return;
        }
        console.log('[ChatPanel] Persistent listener received delta, length:', accumulated.length);
        updateGwAssistant(accumulated);
      },
      onComplete: (content, state, errorMessage) => {
        if (handlerActiveRef.current) {
          console.log('[ChatPanel] Skipping complete (handler active)');
          return;
        }
        console.log('[ChatPanel] Persistent listener completed:', state);
        updateGwAssistant(content);
        setSending(false);
        
        if (state === 'error' && errorMessage) {
          setErrorMessage(errorMessage);
        }
      },
      onKeyMatched: (matchedKey) => {
        console.log('[ChatPanel] Persistent listener matched key:', matchedKey);
      },
    });

    return () => {
      console.log('[ChatPanel] Cleaning up persistent listener for:', gwSessionKey);
      stream.cleanup();
    };
  }, [gwSessionKey, updateGwAssistant, setSending]); // 移除 gwConnected 依赖

  // 刷新恢复
  useEffect(() => {
    if (!pendingGatewaySessionKey && activeGwSessionKey && !gwSessionKey && gwConnected) {
      setGwSessionKey(activeGwSessionKey);
      setLoadingHistory(true);
      setHistoryLoaded(false);

      const gwClient = getActiveGwClient();
      if (!gwClient) { setLoadingHistory(false); return; }

      gwClient.getChatHistory(activeGwSessionKey, 200)
        .then((result) => {
          setGwSessionMessages(normalizeHistoryMessages(result.messages || []));
          setHistoryLoaded(true);
        })
        .catch((e) => {
          console.error('Failed to restore chat history:', e);
          setHistoryLoaded(true);
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [activeGwSessionKey, gwSessionKey, gwConnected, pendingGatewaySessionKey]);

  // ==================== 事件处理 ====================

  const handleCloseGwSession = useCallback(() => {
    setGwSessionKey(null);
    setGwSessionMessages([]);
    setHistoryLoaded(false);
    setActiveGwSessionKey(null);
  }, [setActiveGwSessionKey]);

  const handleAbort = useCallback(async () => {
    if (!currentRun) return;
    const gwClient = getActiveGwClient();
    if (gwClient) {
      try {
        await gwClient.abortChat(currentRun.sessionKey, currentRun.runId);
      } catch (e) {
        console.error('Abort failed:', e);
        setErrorMessage('取消请求失败，请重试');
      }
    }
    if (abortTimeoutRef.current) { clearTimeout(abortTimeoutRef.current); abortTimeoutRef.current = null; }
    setCurrentRun(null);
    setSending(false);
  }, [currentRun, setSending]);

  // 处理队列
  const processNextInQueue = useCallback(() => {
    const nextItem = queueRef.current[0];
    if (!nextItem) return;
    setQueue(prev => prev.slice(1));
    // 延迟重触发发送
    setTimeout(() => {
      handleLocalSend(nextItem.text, nextItem.attachments, 'medium');
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gateway 会话发送
  const handleGwSessionSend = useCallback((content: string) => {
    if (!content || sending || !gwSessionKey) return;
    setSending(true);
    setGwSessionMessages(prev => [...prev, { role: 'user', content }]);

    const gwClient = getActiveGwClient();
    if (!gwClient) { setSending(false); return; }

    // 添加空 assistant 占位
    setGwSessionMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const stream = subscribeChatStream(gwSessionKey, {
      onDelta: updateGwAssistant,
      onComplete: completeGwStream,
    }, handlerActiveRef);

    gwClient.sendChatMessage({
      sessionKey: gwSessionKey,
      message: content,
      idempotencyKey: `msg-${Date.now()}`,
      deliver: true,
    }).catch((e) => {
      stream.cleanup();
      setSending(false);
      setErrorMessage(t('chatPanel.sendFailed'));
      console.error('Send message error:', e);
    });
  }, [sending, gwSessionKey, setSending, updateGwAssistant, completeGwStream]);

  // 本地会话发送
  const handleLocalSend = useCallback(async (
    content: string,
    currentAttachments: ChatAttachment[],
    thinkingLevel: ThinkingLevel,
  ) => {
    const hasAttachments = currentAttachments.length > 0;
    if (!content && !hasAttachments) return;
    if (!activeSession && !selectedMemberId) return;

    // 队列处理
    if (sending) {
      setQueue(prev => [...prev, {
        id: `q-${Date.now()}`,
        text: content,
        attachments: [...currentAttachments],
      }]);
      return;
    }

    let sessionId = activeSessionId;
    if (!sessionId) {
      const memberId = selectedMemberId || aiMembers[0]?.id;
      if (!memberId) return;
      const member = members.find(m => m.id === memberId);
      if (!member) return;
      sessionId = await createSession(memberId, member.name);
    }

    // 构建用户消息
    let userContent = content;
    if (hasAttachments) {
      const attachmentInfo = currentAttachments.map(a => `[图片: ${a.mimeType}]`).join(' ');
      userContent = content ? `${content}\n${attachmentInfo}` : attachmentInfo;
    }

    setSending(true);

    try {
      await addMessage(sessionId, { role: 'user', content: userContent, status: 'sent' });
      const aiMsgId = await addMessage(sessionId, { role: 'assistant', content: '', status: 'sending' });

      const gwClient = getActiveGwClient();

      if (gwClient) {
        // Gateway 流式回复
        const currentSessions = useChatStore.getState().sessions;
        const session = currentSessions.find(s => s.id === sessionId);
        let sessionKey = session?.conversationId || '';
        if (!sessionKey) {
          // v3.0 多用户：优先使用用户专用会话键
          const member = members.find(m => m.id === session?.memberId);
          const agentId = member?.openclawAgentId;
          // 优先级：用户专用会话 > agent 前缀 > agentsMainKey > teamclaw 会话
          const authUser = useAuthStore.getState().user;
          const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;
          sessionKey = userSessionKey || (agentId ? `agent:${agentId}` : (agentsMainKey || `teamclaw-${sessionId}`));
        }
        const clientRunId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // 附件转换
        const apiAttachments = hasAttachments
          ? currentAttachments.map(att => {
              const match = /^data:([^;]+);base64,(.+)$/.exec(att.dataUrl);
              if (!match) return null;
              return { type: 'image', mimeType: match[1], content: match[2] };
            }).filter((a): a is NonNullable<typeof a> => a !== null)
          : undefined;

        let fullContent = '';
        handlerActiveRef.current = true;

        const stream = subscribeChatStream(sessionKey, {
          onDelta: (accumulated) => {
            fullContent = accumulated;
            updateMessage(sessionId!, aiMsgId, { content: accumulated, status: 'sending' });
          },
          onComplete: (resultContent, state) => {
            updateMessage(sessionId!, aiMsgId, {
              content: resultContent,
              status: state === 'final' ? 'sent' : state === 'error' ? 'error' : 'sent',
            });
            handlerActiveRef.current = false;
            if (abortTimeoutRef.current) clearTimeout(abortTimeoutRef.current);
            setCurrentRun(null);
            setSending(false);
            processNextInQueue();
          },
          onRunId: (runId, sk) => {
            setCurrentRun({ sessionKey: sk, runId });
          },
          onKeyMatched: (matchedKey) => {
            updateSessionConversationId(sessionId!, matchedKey);
          },
        });

        try {
          await gwClient.sendChatMessage({
            sessionKey,
            message: content,
            idempotencyKey: clientRunId,
            deliver: true,
            thinking: thinkingLevel,
            attachments: apiAttachments,
          });
          if (!session?.conversationId) {
            updateSessionConversationId(sessionId!, sessionKey);
          }
          // 超时处理
          abortTimeoutRef.current = setTimeout(() => {
            const state = useChatStore.getState();
            const msg = state.sessions.find(s => s.id === sessionId)?.messages.find(m => m.id === aiMsgId);
            if (msg?.status === 'sending') {
              updateMessage(sessionId!, aiMsgId, { content: fullContent || '(超时)', status: 'error' });
              stream.cleanup();
              setCurrentRun(null);
              setSending(false);
              processNextInQueue();
            }
          }, 60000);
        } catch (err) {
          stream.cleanup();
          if (abortTimeoutRef.current) clearTimeout(abortTimeoutRef.current);
          await updateMessage(sessionId!, aiMsgId, {
            content: `Gateway 错误: ${err instanceof Error ? err.message : '发送失败'}`,
            status: 'error',
          });
          setCurrentRun(null);
          setSending(false);
          processNextInQueue();
        }
      } else {
        // REST API 回退
        const currentSessions = useChatStore.getState().sessions;
        const session = currentSessions.find(s => s.id === sessionId);
        const memberId = session?.memberId || selectedMemberId || '';
        const history = (session?.messages || [])
          .filter(m => m.role !== 'system' && m.status !== 'error')
          .slice(-20)
          .map(m => ({ role: m.role, content: m.content }));

        const res = await fetch('/api/chat-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, message: userContent, conversationId: session?.conversationId, history }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await updateMessage(sessionId!, aiMsgId, { content: data.content || '(空回复)', status: 'sent' });
          if (data.conversationId && sessionId) {
            updateSessionConversationId(sessionId, data.conversationId);
          }
        } else {
          await updateMessage(sessionId!, aiMsgId, { content: `错误: ${data.error || '请求失败'}`, status: 'error' });
        }
        setSending(false);
        processNextInQueue();
      }
    } catch (err) {
      setSending(false);
      processNextInQueue();
    }
  }, [activeSession, activeSessionId, selectedMemberId, sending, aiMembers, members, agentsMainKey, createSession, addMessage, updateMessage, setSending, updateSessionConversationId, processNextInQueue]);

  const handleNewSession = useCallback(async () => {
    const memberId = selectedMemberId || aiMembers[0]?.id;
    if (!memberId) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    // v3.0 多用户：优先使用用户专用会话键
    const authUser = useAuthStore.getState().user;
    const userSessionKey = authUser?.id ? getUserSessionKey(authUser.id) : null;
    const baseSessionKey = userSessionKey || agentsMainKey;

    if (gwConnected && baseSessionKey) {
      const newSessionKey = `${baseSessionKey}:teamclaw-${Date.now()}`;
      setGwSessionKey(newSessionKey);
      setActiveGwSessionKey(newSessionKey);
      setGwSessionMessages([]);
      setLoadingHistory(false);
      setHistoryLoaded(true);
      return;
    }
    await createSession(memberId, member.name);
  }, [selectedMemberId, aiMembers, members, gwConnected, agentsMainKey, getUserSessionKey, createSession, setActiveGwSessionKey]);

  const handleDeleteSession = useCallback(async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(sid);
  }, [deleteSession]);

  // ==================== 视图路由 ====================

  // 视图 1: Gateway 会话
  if (gwSessionKey) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={handleCloseGwSession} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
              <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t('chatPanel.gwSession')}</div>
              <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{gwSessionKey}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
            <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        <ChatMessageList
          gwMessages={gwSessionMessages}
          loading={loadingHistory}
          scrollContainerRef={scrollContainerRef}
          messagesEndRef={messagesEndRef}
          onScroll={handleScroll}
          showScrollBtn={showScrollBtn}
          onScrollToBottom={scrollToBottom}
        />

        <ChatInputArea
          onSend={(content) => handleGwSessionSend(content)}
          sending={sending}
          placeholder="继续对话..."
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
          showAttachments={false}
        />
      </div>
    );
  }

  // 视图 2: 会话列表
  if (!activeSessionId) {
    return (
      <ChatSessionList
        sessions={sessions}
        members={members}
        selectedMemberId={selectedMemberId}
        gwConnected={gwConnected}
        onSelectMember={setSelectedMember}
        onSelectSession={setActiveSession}
        onDeleteSession={handleDeleteSession}
        onNewSession={handleNewSession}
        onClose={onClose}
      />
    );
  }

  // 视图 3: 对话详情
  if (!activeSession) {
    // 等待会话加载完成，避免白屏
    if (activeSessionId && !sessions.length) {
      return (
        <div className="flex flex-col h-full items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full" />
        </div>
      );
    }
    // 如果没有活动会话但有会话列表，显示列表
    if (sessions.length > 0) {
      return (
        <ChatSessionList
          sessions={sessions}
          members={members}
          selectedMemberId={selectedMemberId}
          gwConnected={gwConnected}
          onSelectMember={setSelectedMember}
          onSelectSession={setActiveSession}
          onDeleteSession={handleDeleteSession}
          onNewSession={handleNewSession}
          onClose={onClose}
        />
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Focus Mode 退出按钮 */}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="absolute top-4 right-4 z-50 p-2 rounded-lg shadow-float"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          title={t('chatPanel.exitFocusMode')}
        >
          <Minimize2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      )}

      {/* 顶栏 */}
      {!focusMode && (
        <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setActiveSession(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
              <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{activeSession.title}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{activeSession.memberName}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setFocusMode(true)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" title="专注模式">
              <Maximize2 className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
              <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </div>
      )}

      {/* 实体绑定 Banner */}
      {!focusMode && activeSession.entity && (
        <div className="px-4 py-2 border-b text-xs flex items-center gap-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
          <span className="tag text-[10px] bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
            {activeSession.entity.type === 'task' ? '任务' : activeSession.entity.type === 'project' ? '项目' : '定时任务'}
          </span>
          <span className="truncate">{activeSession.entity.title}</span>
        </div>
      )}

      {/* 消息列表 */}
      <ChatMessageList
        messages={activeSession.messages}
        emptyText={`开始和 ${activeSession.memberName} 对话`}
        scrollContainerRef={scrollContainerRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
        showScrollBtn={showScrollBtn}
        onScrollToBottom={scrollToBottom}
      />

      {/* 输入区 */}
      <ChatInputArea
        onSend={handleLocalSend}
        sending={sending}
        currentRun={currentRun}
        onAbort={handleAbort}
        showThinking={true}
        showAttachments={true}
        queue={queue}
        onRemoveQueueItem={(id) => setQueue(prev => prev.filter(q => q.id !== id))}
        errorMessage={errorMessage}
        onClearError={() => setErrorMessage(null)}
      />
    </div>
  );
}
