/**
 * Chat Store - manages chat sessions, messages, and streaming state
 */
import { create } from 'zustand';
import { wsManager, ChatStreamUpdate, ToolCallUpdate } from '../api/websocket';
import type { ChatSession, ChatMessage, ToolCall } from '../types';

// ============================================================================
// Efficient Map Update Utilities
// ============================================================================

/**
 * Efficiently updates a Map by mutating a copy only when necessary.
 * Reduces allocations compared to creating a new Map on every update.
 */
function updateMap<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
  // Check if we actually need to update
  const existing = map.get(key);
  if (existing === value) {
    return map; // No change needed, return same reference
  }
  // Create new Map only when we have an actual change
  const newMap = new Map(map);
  newMap.set(key, value);
  return newMap;
}

/**
 * Efficiently deletes from a Map by mutating a copy only when necessary.
 */
function deleteFromMap<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  if (!map.has(key)) {
    return map; // Key doesn't exist, return same reference
  }
  const newMap = new Map(map);
  newMap.delete(key);
  return newMap;
}

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
      const updated = updateMap(current, sessionId, messages);
      if (updated !== current) {
        set({ messages: updated });
      }
    },

    addMessage: (sessionId, message) => {
      const current = get().messages;
      const sessionMessages = current.get(sessionId) || [];
      const newMessages = [...sessionMessages, message];
      set({ messages: updateMap(current, sessionId, newMessages) });
    },

    updateMessage: (sessionId, messageId, updates) => {
      const current = get().messages;
      const sessionMessages = current.get(sessionId) || [];
      const updatedMessages = sessionMessages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      // Only update if we actually changed something
      const hasChanges = sessionMessages.some((msg, i) => msg !== updatedMessages[i]);
      if (hasChanges) {
        set({ messages: updateMap(current, sessionId, updatedMessages) });
      }
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
      set({ pendingToolCalls: updateMap(current, toolCall.id, toolCall) });
    },

    updateToolCallStatus: (toolCallId, status) => {
      const { pendingToolCalls, messages, selectedSessionId } = get();

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
