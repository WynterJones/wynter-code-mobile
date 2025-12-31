/**
 * Chat Store - manages chat sessions, messages, and streaming state
 */
import { create } from 'zustand';
import { wsManager, ChatStreamUpdate, ToolCallUpdate } from '../api/websocket';
import type { ChatSession, ChatMessage, ToolCall } from '../types';

interface StreamingState {
  sessionId: string;
  messageId: string;
  content: string;
  isStreaming: boolean;
  currentTool?: string;
}

interface ChatStore {
  // Sessions
  sessions: ChatSession[];
  selectedSessionId: string | null;
  isLoadingSessions: boolean;

  // Messages
  messages: Map<string, ChatMessage[]>; // sessionId -> messages
  isLoadingMessages: boolean;

  // Streaming
  streamingState: StreamingState | null;

  // Pending tool calls (for quick access)
  pendingToolCalls: Map<string, ToolCall>; // toolCallId -> ToolCall

  // Actions
  setSessions: (sessions: ChatSession[]) => void;
  selectSession: (sessionId: string | null) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  setLoadingSessions: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;

  // Streaming
  startStreaming: (sessionId: string, messageId: string) => void;
  appendStreamContent: (content: string) => void;
  setStreamingTool: (toolName?: string) => void;
  endStreaming: () => void;

  // Tool calls
  addPendingToolCall: (toolCall: ToolCall) => void;
  updateToolCallStatus: (toolCallId: string, status: ToolCall['status']) => void;
  removePendingToolCall: (toolCallId: string) => void;

  // WebSocket handlers
  handleChatStream: (update: ChatStreamUpdate) => void;
  handleToolCall: (update: ToolCallUpdate) => void;

  // Real-time
  subscribe: (projectId: string) => void;
  unsubscribe: () => void;

  // Computed
  getSessionMessages: (sessionId: string) => ChatMessage[];
  getSelectedSession: () => ChatSession | null;
}

export const useChatStore = create<ChatStore>((set, get) => {
  let unsubscribeWs: (() => void) | null = null;

  return {
    sessions: [],
    selectedSessionId: null,
    isLoadingSessions: false,
    messages: new Map(),
    isLoadingMessages: false,
    streamingState: null,
    pendingToolCalls: new Map(),

    setSessions: (sessions) => set({ sessions }),

    selectSession: (sessionId) => set({ selectedSessionId: sessionId }),

    setMessages: (sessionId, messages) => {
      const current = get().messages;
      const updated = new Map(current);
      updated.set(sessionId, messages);
      set({ messages: updated });
    },

    addMessage: (sessionId, message) => {
      const current = get().messages;
      const updated = new Map(current);
      const sessionMessages = updated.get(sessionId) || [];
      updated.set(sessionId, [...sessionMessages, message]);
      set({ messages: updated });
    },

    updateMessage: (sessionId, messageId, updates) => {
      const current = get().messages;
      const updated = new Map(current);
      const sessionMessages = updated.get(sessionId) || [];
      const updatedMessages = sessionMessages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      updated.set(sessionId, updatedMessages);
      set({ messages: updated });
    },

    setLoadingSessions: (isLoadingSessions) => set({ isLoadingSessions }),

    setLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),

    // Streaming actions
    startStreaming: (sessionId, messageId) => {
      set({
        streamingState: {
          sessionId,
          messageId,
          content: '',
          isStreaming: true,
        },
      });
    },

    appendStreamContent: (content) => {
      const { streamingState } = get();
      if (!streamingState) return;

      set({
        streamingState: {
          ...streamingState,
          content: streamingState.content + content,
        },
      });

      // Also update the message in the messages map
      const { messages, updateMessage } = get();
      updateMessage(streamingState.sessionId, streamingState.messageId, {
        content: streamingState.content + content,
      });
    },

    setStreamingTool: (toolName) => {
      const { streamingState } = get();
      if (!streamingState) return;

      set({
        streamingState: {
          ...streamingState,
          currentTool: toolName,
        },
      });
    },

    endStreaming: () => {
      const { streamingState } = get();
      if (streamingState) {
        // Finalize the message content
        get().updateMessage(streamingState.sessionId, streamingState.messageId, {
          content: streamingState.content,
        });
      }
      set({ streamingState: null });
    },

    // Tool call actions
    addPendingToolCall: (toolCall) => {
      const current = get().pendingToolCalls;
      const updated = new Map(current);
      updated.set(toolCall.id, toolCall);
      set({ pendingToolCalls: updated });
    },

    updateToolCallStatus: (toolCallId, status) => {
      const { pendingToolCalls, messages, selectedSessionId } = get();

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
      }
    },

    removePendingToolCall: (toolCallId) => {
      const current = get().pendingToolCalls;
      const updated = new Map(current);
      updated.delete(toolCallId);
      set({ pendingToolCalls: updated });
    },

    // WebSocket handlers
    handleChatStream: (update) => {
      const { chunk, session_id } = update;
      const { streamingState, addMessage, startStreaming, appendStreamContent, setStreamingTool, endStreaming } = get();

      switch (chunk.type) {
        case 'message_start':
          // Start a new streaming message
          const messageId = `msg-${Date.now()}`;
          const newMessage: ChatMessage = {
            id: messageId,
            sessionId: session_id,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
          };
          addMessage(session_id, newMessage);
          startStreaming(session_id, messageId);
          break;

        case 'content_block_delta':
        case 'text':
          if (chunk.content) {
            appendStreamContent(chunk.content);
          }
          break;

        case 'tool_use':
        case 'tool_start':
          setStreamingTool(chunk.tool_name);
          break;

        case 'tool_result':
          setStreamingTool(undefined);
          break;

        case 'message_stop':
        case 'result':
          endStreaming();
          break;
      }
    },

    handleToolCall: (update) => {
      const { tool_call, session_id } = update;
      const { addPendingToolCall, selectedSessionId, messages, addMessage, updateMessage } = get();

      const toolCall: ToolCall = {
        id: tool_call.id,
        name: tool_call.name,
        status: tool_call.status,
        input: tool_call.input,
      };

      if (tool_call.status === 'pending') {
        addPendingToolCall(toolCall);

        // Find the last assistant message and add the tool call to it
        if (selectedSessionId === session_id) {
          const sessionMessages = messages.get(session_id) || [];
          const lastAssistantMessage = [...sessionMessages].reverse().find((m) => m.role === 'assistant');

          if (lastAssistantMessage) {
            const existingToolCalls = lastAssistantMessage.toolCalls || [];
            updateMessage(session_id, lastAssistantMessage.id, {
              toolCalls: [...existingToolCalls, toolCall],
            });
          }
        }
      } else {
        // Update tool call status
        get().updateToolCallStatus(tool_call.id, tool_call.status);
      }
    },

    subscribe: (projectId) => {
      const { handleChatStream, handleToolCall } = get();

      // Connect WebSocket if not already connected
      wsManager.connect();

      // Register handlers
      unsubscribeWs = wsManager.addHandler((update) => {
        if (update.type === 'ChatStream') {
          handleChatStream(update);
        } else if (update.type === 'ToolCall') {
          handleToolCall(update);
        }
      });

      // Subscribe to project updates
      wsManager.subscribeToProject(projectId);
    },

    unsubscribe: () => {
      if (unsubscribeWs) {
        unsubscribeWs();
        unsubscribeWs = null;
      }
    },

    // Computed
    getSessionMessages: (sessionId) => {
      return get().messages.get(sessionId) || [];
    },

    getSelectedSession: () => {
      const { sessions, selectedSessionId } = get();
      return sessions.find((s) => s.id === selectedSessionId) || null;
    },
  };
});
