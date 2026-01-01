/**
 * Mobile Chat Store - manages mobile-only chat sessions with local persistence
 *
 * These chats are independent from desktop sessions and stored locally on the device.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AIProvider, AIModel, AIMode, ToolCall } from '../types';

// ============================================================================
// Efficient Map Update Utilities
// ============================================================================

/**
 * Efficiently updates a Map by mutating a copy only when necessary.
 * Reduces allocations compared to creating a new Map on every update.
 */
function updateMap<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
  const existing = map.get(key);
  if (existing === value) {
    return map;
  }
  const newMap = new Map(map);
  newMap.set(key, value);
  return newMap;
}

/**
 * Efficiently deletes from a Map by mutating a copy only when necessary.
 */
function deleteFromMap<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  if (!map.has(key)) {
    return map;
  }
  const newMap = new Map(map);
  newMap.delete(key);
  return newMap;
}

// Mobile-specific types
export interface MobileChatSession {
  id: string;
  name: string;
  provider: AIProvider;
  model: AIModel;
  mode: AIMode;
  projectPath?: string; // Working directory for CLI processes
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface MobileChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

interface StreamingState {
  sessionId: string;
  messageId: string;
  content: string;
  isStreaming: boolean;
  currentTool?: ToolCall;
  toolCalls: ToolCall[];
}

interface MobileChatStore {
  // Sessions
  sessions: MobileChatSession[];
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Messages (in-memory, keyed by sessionId)
  messages: Map<string, MobileChatMessage[]>;

  // Streaming
  streamingState: StreamingState | null;

  // Pending tool calls
  pendingToolCalls: Map<string, ToolCall>;

  // Persistence
  loadSessions: () => Promise<void>;
  saveSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  saveMessages: (sessionId: string) => Promise<void>;

  // Session CRUD
  createSession: (name: string, provider: AIProvider, model: AIModel, mode?: AIMode, projectPath?: string) => Promise<MobileChatSession>;
  updateSession: (sessionId: string, updates: Partial<MobileChatSession>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  selectSession: (sessionId: string | null) => void;

  // Message actions
  addMessage: (sessionId: string, message: MobileChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<MobileChatMessage>) => void;
  getSessionMessages: (sessionId: string) => MobileChatMessage[];

  // Streaming
  startStreaming: (sessionId: string, messageId: string) => void;
  appendStreamContent: (content: string) => void;
  startToolCall: (tool: ToolCall) => void;
  updateCurrentToolCall: (updates: Partial<ToolCall>) => void;
  completeToolCall: (toolId: string, output?: string, isError?: boolean) => void;
  endStreaming: () => void;

  // Tool calls
  addPendingToolCall: (toolCall: ToolCall) => void;
  updateToolCallStatus: (toolCallId: string, status: ToolCall['status']) => void;
  removePendingToolCall: (toolCallId: string) => void;

  // Computed
  getSelectedSession: () => MobileChatSession | null;
}

const SESSIONS_KEY = 'mobile_chat_sessions';
const MESSAGES_KEY_PREFIX = 'mobile_chat_messages_';

// Helper to get messages key for a session
const getMessagesKey = (sessionId: string) => `${MESSAGES_KEY_PREFIX}${sessionId}`;

// Debounce utility for persistence operations
function debounce<T extends (...args: unknown[]) => Promise<void>>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return new Promise<void>((resolve) => {
      timeoutId = setTimeout(async () => {
        await fn(...args);
        resolve();
      }, delay);
    });
  }) as T;
}

// Debounced persistence functions (300ms delay to batch rapid updates)
let debouncedSaveSessionsImpl: (() => Promise<void>) | null = null;
const debouncedSaveMessagesMap = new Map<string, () => Promise<void>>();

export const useMobileChatStore = create<MobileChatStore>((set, get) => ({
  sessions: [],
  selectedSessionId: null,
  isLoading: false,
  error: null,
  messages: new Map(),
  streamingState: null,
  pendingToolCalls: new Map(),

  // Persistence
  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const stored = await SecureStore.getItemAsync(SESSIONS_KEY);
      if (stored) {
        const sessions: MobileChatSession[] = JSON.parse(stored);
        // Sort by most recent first
        sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        set({ sessions });
      }
    } catch (error) {
      console.error('[MobileChatStore] Failed to load sessions:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load chats' });
    } finally {
      set({ isLoading: false });
    }
  },

  saveSessions: async () => {
    // Use debounced save to batch rapid updates (e.g., during streaming)
    if (!debouncedSaveSessionsImpl) {
      debouncedSaveSessionsImpl = debounce(async () => {
        try {
          const { sessions } = get();
          await SecureStore.setItemAsync(SESSIONS_KEY, JSON.stringify(sessions));
        } catch (error) {
          console.error('[MobileChatStore] Failed to save sessions:', error);
        }
      }, 300);
    }
    await debouncedSaveSessionsImpl();
  },

  loadMessages: async (sessionId: string) => {
    try {
      const stored = await SecureStore.getItemAsync(getMessagesKey(sessionId));
      if (stored) {
        const messages: MobileChatMessage[] = JSON.parse(stored);
        const current = get().messages;
        set({ messages: updateMap(current, sessionId, messages) });
      }
    } catch (error) {
      console.error('[MobileChatStore] Failed to load messages:', error);
    }
  },

  saveMessages: async (sessionId: string) => {
    // Use debounced save per session to batch rapid updates (e.g., during streaming)
    if (!debouncedSaveMessagesMap.has(sessionId)) {
      debouncedSaveMessagesMap.set(
        sessionId,
        debounce(async () => {
          try {
            const messages = get().messages.get(sessionId) || [];
            await SecureStore.setItemAsync(getMessagesKey(sessionId), JSON.stringify(messages));
          } catch (error) {
            console.error('[MobileChatStore] Failed to save messages:', error);
          }
        }, 300)
      );
    }
    await debouncedSaveMessagesMap.get(sessionId)!();
  },

  // Session CRUD
  createSession: async (name: string, provider: AIProvider, model: AIModel, mode: AIMode = 'normal', projectPath?: string) => {
    const now = new Date().toISOString();
    const session: MobileChatSession = {
      id: `mobile-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name,
      provider,
      model,
      mode,
      projectPath,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    const { sessions, saveSessions } = get();
    set({ sessions: [session, ...sessions], selectedSessionId: session.id });
    await saveSessions();

    return session;
  },

  updateSession: async (sessionId: string, updates: Partial<MobileChatSession>) => {
    const { sessions, saveSessions } = get();
    const updatedSessions = sessions.map((s) =>
      s.id === sessionId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    );
    set({ sessions: updatedSessions });
    await saveSessions();
  },

  deleteSession: async (sessionId: string) => {
    const { sessions, selectedSessionId, saveSessions, messages } = get();

    // Remove session
    const updatedSessions = sessions.filter((s) => s.id !== sessionId);

    // Remove messages from memory using efficient utility
    const updatedMessages = deleteFromMap(messages, sessionId);

    // Clear from SecureStore
    try {
      await SecureStore.deleteItemAsync(getMessagesKey(sessionId));
    } catch (error) {
      console.error('[MobileChatStore] Failed to delete messages:', error);
    }

    // Update selection if needed
    const newSelectedId = selectedSessionId === sessionId ? null : selectedSessionId;

    set({
      sessions: updatedSessions,
      selectedSessionId: newSelectedId,
      messages: updatedMessages,
    });
    await saveSessions();
  },

  selectSession: (sessionId) => {
    set({ selectedSessionId: sessionId });
    if (sessionId) {
      get().loadMessages(sessionId);
    }
  },

  // Message actions
  addMessage: (sessionId, message) => {
    const { messages, sessions, updateSession, saveMessages } = get();
    const sessionMessages = messages.get(sessionId) || [];
    const newMessages = [...sessionMessages, message];
    set({ messages: updateMap(messages, sessionId, newMessages) });

    // Update message count
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      updateSession(sessionId, { messageCount: session.messageCount + 1 });
    }

    // Persist
    saveMessages(sessionId);
  },

  updateMessage: (sessionId, messageId, updates) => {
    const { messages, saveMessages } = get();
    const sessionMessages = messages.get(sessionId) || [];
    const updatedMessages = sessionMessages.map((msg) =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    // Only update if we actually changed something
    const hasChanges = sessionMessages.some((msg, i) => msg !== updatedMessages[i]);
    if (hasChanges) {
      set({ messages: updateMap(messages, sessionId, updatedMessages) });
      saveMessages(sessionId);
    }
  },

  getSessionMessages: (sessionId) => {
    return get().messages.get(sessionId) || [];
  },

  // Streaming
  startStreaming: (sessionId, messageId) => {
    set({
      streamingState: {
        sessionId,
        messageId,
        content: '',
        isStreaming: true,
        toolCalls: [],
      },
    });
  },

  appendStreamContent: (content) => {
    const { streamingState, updateMessage } = get();
    if (!streamingState) return;

    const newContent = streamingState.content + content;
    set({
      streamingState: {
        ...streamingState,
        content: newContent,
      },
    });

    updateMessage(streamingState.sessionId, streamingState.messageId, {
      content: newContent,
    });
  },

  startToolCall: (tool) => {
    const { streamingState, updateMessage } = get();
    if (!streamingState) return;

    const newToolCalls = [...streamingState.toolCalls, tool];
    set({
      streamingState: {
        ...streamingState,
        currentTool: tool,
        toolCalls: newToolCalls,
      },
    });

    updateMessage(streamingState.sessionId, streamingState.messageId, {
      toolCalls: newToolCalls,
    });
  },

  updateCurrentToolCall: (updates) => {
    const { streamingState, updateMessage } = get();
    if (!streamingState || !streamingState.currentTool) return;

    const updatedTool = { ...streamingState.currentTool, ...updates };
    const newToolCalls = streamingState.toolCalls.map((t) =>
      t.id === updatedTool.id ? updatedTool : t
    );

    set({
      streamingState: {
        ...streamingState,
        currentTool: updatedTool,
        toolCalls: newToolCalls,
      },
    });

    updateMessage(streamingState.sessionId, streamingState.messageId, {
      toolCalls: newToolCalls,
    });
  },

  completeToolCall: (toolId, output, isError) => {
    const { streamingState, updateMessage } = get();
    if (!streamingState) return;

    const newToolCalls = streamingState.toolCalls.map((t) =>
      t.id === toolId
        ? { ...t, status: isError ? 'error' as const : 'completed' as const, output, isError, completedAt: Date.now() }
        : t
    );

    set({
      streamingState: {
        ...streamingState,
        currentTool: undefined,
        toolCalls: newToolCalls,
      },
    });

    updateMessage(streamingState.sessionId, streamingState.messageId, {
      toolCalls: newToolCalls,
    });
  },

  endStreaming: () => {
    const { streamingState, updateMessage, saveMessages } = get();
    if (streamingState) {
      updateMessage(streamingState.sessionId, streamingState.messageId, {
        content: streamingState.content,
        toolCalls: streamingState.toolCalls,
        isStreaming: false,
      });
      saveMessages(streamingState.sessionId);
    }
    set({ streamingState: null });
  },

  // Tool calls
  addPendingToolCall: (toolCall) => {
    const current = get().pendingToolCalls;
    set({ pendingToolCalls: updateMap(current, toolCall.id, toolCall) });
  },

  updateToolCallStatus: (toolCallId, status) => {
    const { pendingToolCalls, messages, selectedSessionId, saveMessages } = get();

    // Update in pending map
    const toolCall = pendingToolCalls.get(toolCallId);
    if (toolCall) {
      if (status === 'pending') {
        set({ pendingToolCalls: updateMap(pendingToolCalls, toolCallId, { ...toolCall, status }) });
      } else {
        set({ pendingToolCalls: deleteFromMap(pendingToolCalls, toolCallId) });
      }
    }

    // Update in messages
    if (selectedSessionId) {
      const sessionMessages = messages.get(selectedSessionId) || [];
      const updatedMessages = sessionMessages.map((msg) => {
        if (!msg.toolCalls) return msg;
        const hasToolCall = msg.toolCalls.some((tc) => tc.id === toolCallId);
        if (!hasToolCall) return msg;
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.id === toolCallId ? { ...tc, status } : tc
          ),
        };
      });
      // Only update if we actually changed something
      const hasChanges = sessionMessages.some((msg, i) => msg !== updatedMessages[i]);
      if (hasChanges) {
        set({ messages: updateMap(messages, selectedSessionId, updatedMessages) });
        saveMessages(selectedSessionId);
      }
    }
  },

  removePendingToolCall: (toolCallId) => {
    const current = get().pendingToolCalls;
    const updated = deleteFromMap(current, toolCallId);
    if (updated !== current) {
      set({ pendingToolCalls: updated });
    }
  },

  // Computed
  getSelectedSession: () => {
    const { sessions, selectedSessionId } = get();
    return sessions.find((s) => s.id === selectedSessionId) || null;
  },
}));
