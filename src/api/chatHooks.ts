/**
 * React Query hooks for chat and conversation data fetching
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSessions,
  fetchMessages,
  sendMessage,
  approveToolCall,
  rejectToolCall,
  queryKeys,
} from './client';
import { wsManager } from './websocket';
import type { ChatMessage } from '../types';
import { useChatStore } from '../stores/chatStore';
import { useIsConnected, useSelectedProject } from './hooks';

/**
 * Fetch chat sessions for the selected project
 */
export function useSessions() {
  const isConnected = useIsConnected();
  const selectedProject = useSelectedProject();
  const projectId = selectedProject?.id ?? '';
  const { setSessions, subscribe } = useChatStore();

  // Subscribe to WebSocket for real-time updates
  useEffect(() => {
    if (isConnected && projectId) {
      subscribe(projectId);
    }
  }, [isConnected, projectId, subscribe]);

  return useQuery({
    queryKey: queryKeys.sessions(projectId),
    queryFn: async () => {
      const sessions = await fetchSessions(projectId);
      setSessions(sessions);
      return sessions;
    },
    enabled: isConnected && !!projectId,
    staleTime: 30000,
  });
}

/**
 * Fetch messages for a specific session
 */
export function useMessages(sessionId: string) {
  const isConnected = useIsConnected();
  const selectedProject = useSelectedProject();
  const projectId = selectedProject?.id ?? '';
  const { setMessages } = useChatStore();

  return useQuery({
    queryKey: queryKeys.messages(projectId, sessionId),
    queryFn: async () => {
      const messages = await fetchMessages(projectId, sessionId);
      setMessages(sessionId, messages);
      return messages;
    },
    enabled: isConnected && !!projectId && !!sessionId,
    staleTime: 10000, // Short stale time, WebSocket handles real-time
  });
}

/**
 * Send a message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  const selectedProject = useSelectedProject();
  const projectId = selectedProject?.id ?? '';
  const { addMessage, selectedSessionId } = useChatStore();

  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      sendMessage(projectId, sessionId, content),
    onMutate: async ({ sessionId, content }) => {
      // Optimistically add the user message
      const newMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        sessionId,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      addMessage(sessionId, newMessage);
      return { newMessage };
    },
    onSuccess: (_, { sessionId }) => {
      // Response will come via WebSocket streaming
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages(projectId, sessionId),
      });
    },
  });
}

/**
 * Approve a tool call
 */
export function useApproveToolCall() {
  const selectedProject = useSelectedProject();
  const projectId = selectedProject?.id ?? '';
  const { updateToolCallStatus } = useChatStore();

  return useMutation({
    mutationFn: ({ sessionId, toolCallId }: { sessionId: string; toolCallId: string }) =>
      approveToolCall(projectId, sessionId, toolCallId),
    onMutate: ({ toolCallId }) => {
      // Optimistically update status
      updateToolCallStatus(toolCallId, 'approved');
    },
    onSuccess: (_, { toolCallId }) => {
      // Also notify via WebSocket for immediate execution
      wsManager.approveToolCall(projectId, toolCallId);
    },
  });
}

/**
 * Reject a tool call
 */
export function useRejectToolCall() {
  const selectedProject = useSelectedProject();
  const projectId = selectedProject?.id ?? '';
  const { updateToolCallStatus } = useChatStore();

  return useMutation({
    mutationFn: ({ sessionId, toolCallId }: { sessionId: string; toolCallId: string }) =>
      rejectToolCall(projectId, sessionId, toolCallId),
    onMutate: ({ toolCallId }) => {
      // Optimistically update status
      updateToolCallStatus(toolCallId, 'rejected');
    },
    onSuccess: (_, { toolCallId }) => {
      // Also notify via WebSocket
      wsManager.rejectToolCall(projectId, toolCallId);
    },
  });
}
