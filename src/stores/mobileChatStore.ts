/**
 * Mobile Chat Store - manages mobile-only chat sessions with local persistence
 *
 * These chats are independent from desktop sessions and stored locally on the device.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AIProvider, AIModel, AIMode, ToolCall } from '../types';

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
    try {
      const { sessions } = get();
      await SecureStore.setItemAsync(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('[MobileChatStore] Failed to save sessions:', error);
    }
  },

  loadMessages: async (sessionId: string) => {
    try {
      const stored = await SecureStore.getItemAsync(getMessagesKey(sessionId));
      if (stored) {
        const messages: MobileChatMessage[] = JSON.parse(stored);
        const current = get().messages;
        const updated = new Map(current);
        updated.set(sessionId, messages);
        set({ messages: updated });
      }
    } catch (error) {
      console.error('[MobileChatStore] Failed to load messages:', error);
    }
  },

  saveMessages: async (sessionId: string) => {
    try {
      const messages = get().messages.get(sessionId) || [];
      await SecureStore.setItemAsync(getMessagesKey(sessionId), JSON.stringify(messages));
    } catch (error) {
      console.error('[MobileChatStore] Failed to save messages:', error);
    }
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

    // Remove messages from memory
    const updatedMessages = new Map(messages);
    updatedMessages.delete(sessionId);

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
    const updated = new Map(messages);
    const sessionMessages = updated.get(sessionId) || [];
    updated.set(sessionId, [...sessionMessages, message]);
    set({ messages: updated });

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
    const updated = new Map(messages);
    const sessionMessages = updated.get(sessionId) || [];
    const updatedMessages = sessionMessages.map((msg) =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    updated.set(sessionId, updatedMessages);
    set({ messages: updated });
    saveMessages(sessionId);
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
    const updated = new Map(current);
    updated.set(toolCall.id, toolCall);
    set({ pendingToolCalls: updated });
  },

  updateToolCallStatus: (toolCallId, status) => {
    const { pendingToolCalls, messages, selectedSessionId, saveMessages } = get();

    // Update in pending map
    const updated = new Map(pendingToolCalls);
    const toolCall = updated.get(toolCallId);
    if (toolCall) {
      updated.set(toolCallId, { ...toolCall, status });
      if (status !== 'pending') {
        updated.delete(toolCallId);
      }
    }
    set({ pendingToolCalls: updated });

    // Update in messages
    if (selectedSessionId) {
      const sessionMessages = messages.get(selectedSessionId) || [];
      const updatedMessages = sessionMessages.map((msg) => {
        if (!msg.toolCalls) return msg;
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.id === toolCallId ? { ...tc, status } : tc
          ),
        };
      });
      const newMessages = new Map(messages);
      newMessages.set(selectedSessionId, updatedMessages);
      set({ messages: newMessages });
      saveMessages(selectedSessionId);
    }
  },

  removePendingToolCall: (toolCallId) => {
    const current = get().pendingToolCalls;
    const updated = new Map(current);
    updated.delete(toolCallId);
    set({ pendingToolCalls: updated });
  },

  // Computed
  getSelectedSession: () => {
    const { sessions, selectedSessionId } = get();
    return sessions.find((s) => s.id === selectedSessionId) || null;
  },
}));
