/**
 * React Query hooks for API data fetching
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkspaces,
  fetchProjects,
  fetchIssues,
  createIssue,
  updateIssue,
  closeIssue,
  fetchAutoBuildStatus,
  startAutoBuild,
  pauseAutoBuild,
  stopAutoBuild,
  addToAutoBuildQueue,
  removeFromAutoBuildQueue,
  fetchSessions,
  fetchMessages,
  sendMessage,
  approveToolCall,
  rejectToolCall,
  queryKeys,
} from './client';
import { wsManager } from './websocket';
import type {
  Workspace,
  Project,
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
  ChatSession,
  ChatMessage,
  QueueItem,
} from '../types';
import { useConnectionStore } from '../stores/connectionStore';
import { useProjectStore } from '../stores/projectStore';
import { useAutoBuildStore } from '../stores/autoBuildStore';
import { useChatStore } from '../stores/chatStore';

/**
 * Hook to check if we're connected to desktop
 */
export function useIsConnected() {
  const connection = useConnectionStore((s) => s.connection);
  return connection.device !== null;
}

/**
 * Fetch all workspaces
 */
export function useWorkspaces() {
  const isConnected = useIsConnected();

  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: fetchWorkspaces,
    enabled: isConnected,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch projects for a workspace
 */
export function useProjects(workspaceId: string) {
  const isConnected = useIsConnected();

  return useQuery({
    queryKey: queryKeys.projects(workspaceId),
    queryFn: () => fetchProjects(workspaceId),
    enabled: isConnected && !!workspaceId,
  });
}

/**
 * Fetch issues for the selected project
 */
export function useIssues(options?: { pollingEnabled?: boolean; pollingInterval?: number }) {
  const isConnected = useIsConnected();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectPath = selectedProject?.path ?? '';
  const { pollingEnabled = false, pollingInterval = 5000 } = options ?? {};

  return useQuery({
    queryKey: queryKeys.issues(projectPath),
    queryFn: () => fetchIssues(projectPath),
    enabled: isConnected && !!projectPath,
    staleTime: 30000, // 30 seconds
    refetchInterval: pollingEnabled ? pollingInterval : false,
  });
}

/**
 * Create a new issue
 */
export function useCreateIssue() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectPath = selectedProject?.path ?? '';

  return useMutation({
    mutationFn: (input: CreateIssueInput) => createIssue(projectPath, input),
    onSuccess: (newIssue) => {
      // Optimistically update the cache
      queryClient.setQueryData<Issue[]>(
        queryKeys.issues(projectPath),
        (old) => (old ? [newIssue, ...old] : [newIssue])
      );
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.issues(projectPath) });
    },
  });
}

/**
 * Update an issue
 */
export function useUpdateIssue() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectPath = selectedProject?.path ?? '';

  return useMutation({
    mutationFn: ({ issueId, input }: { issueId: string; input: UpdateIssueInput }) =>
      updateIssue(projectPath, issueId, input),
    onMutate: async ({ issueId, input }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.issues(projectPath) });

      // Snapshot previous value
      const previousIssues = queryClient.getQueryData<Issue[]>(
        queryKeys.issues(projectPath)
      );

      // Optimistically update
      queryClient.setQueryData<Issue[]>(queryKeys.issues(projectPath), (old) =>
        old?.map((issue) =>
          issue.id === issueId
            ? { ...issue, ...input, updatedAt: new Date().toISOString() }
            : issue
        )
      );

      return { previousIssues };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousIssues) {
        queryClient.setQueryData(
          queryKeys.issues(projectPath),
          context.previousIssues
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues(projectPath) });
    },
  });
}

/**
 * Close an issue
 */
export function useCloseIssue() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectPath = selectedProject?.path ?? '';

  return useMutation({
    mutationFn: ({ issueId, reason }: { issueId: string; reason: string }) =>
      closeIssue(projectPath, issueId, reason),
    onMutate: async ({ issueId, reason }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.issues(projectPath) });

      const previousIssues = queryClient.getQueryData<Issue[]>(
        queryKeys.issues(projectPath)
      );

      queryClient.setQueryData<Issue[]>(queryKeys.issues(projectPath), (old) =>
        old?.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                status: 'closed' as const,
                closedAt: new Date().toISOString(),
                closeReason: reason,
                updatedAt: new Date().toISOString(),
              }
            : issue
        )
      );

      return { previousIssues };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousIssues) {
        queryClient.setQueryData(
          queryKeys.issues(projectPath),
          context.previousIssues
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues(projectPath) });
    },
  });
}

// ============================================================================
// Auto-Build Hooks
// ============================================================================

/**
 * Fetch auto-build status (initial load, before WebSocket takes over)
 */
export function useAutoBuildStatus() {
  const isConnected = useIsConnected();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectId = selectedProject?.id ?? '';
  const { subscribe } = useAutoBuildStore();

  // Subscribe to WebSocket updates when query is enabled
  useEffect(() => {
    if (isConnected && projectId) {
      subscribe(projectId);
    }
  }, [isConnected, projectId, subscribe]);

  return useQuery({
    queryKey: queryKeys.autoBuild(projectId),
    queryFn: () => fetchAutoBuildStatus(projectId),
    enabled: isConnected && !!projectId,
    staleTime: 5000, // Short stale time since WebSocket provides real-time updates
  });
}

/**
 * Start auto-build
 */
export function useStartAutoBuild() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectId = selectedProject?.id ?? '';

  return useMutation({
    mutationFn: () => startAutoBuild(projectId),
    onSuccess: () => {
      // Invalidate to trigger refetch (WebSocket will handle real-time updates)
      queryClient.invalidateQueries({ queryKey: queryKeys.autoBuild(projectId) });
    },
  });
}

/**
 * Pause auto-build
 */
export function usePauseAutoBuild() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectId = selectedProject?.id ?? '';

  return useMutation({
    mutationFn: () => pauseAutoBuild(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoBuild(projectId) });
    },
  });
}

/**
 * Stop auto-build
 */
export function useStopAutoBuild() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectId = selectedProject?.id ?? '';

  return useMutation({
    mutationFn: () => stopAutoBuild(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoBuild(projectId) });
    },
  });
}

/**
 * Add issue to auto-build queue
 */
export function useAddToAutoBuildQueue() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectId = selectedProject?.id ?? '';
  const projectPath = selectedProject?.path ?? '';
  const { addToQueue } = useAutoBuildStore();

  return useMutation({
    mutationFn: (issueId: string) => addToAutoBuildQueue(projectId, issueId),
    onMutate: async (issueId) => {
      // Get the issue details from cache to populate the queue item
      const issues = queryClient.getQueryData<Issue[]>(queryKeys.issues(projectPath));
      const issue = issues?.find((i) => i.id === issueId);

      // Optimistically add to queue
      addToQueue({
        id: issueId,
        description: issue?.title || `Issue ${issueId}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      // WebSocket will handle real-time queue updates
      queryClient.invalidateQueries({ queryKey: queryKeys.autoBuild(projectId) });
    },
  });
}

/**
 * Remove issue from auto-build queue
 */
export function useRemoveFromAutoBuildQueue() {
  const queryClient = useQueryClient();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectId = selectedProject?.id ?? '';
  const { removeFromQueue } = useAutoBuildStore();

  return useMutation({
    mutationFn: (issueId: string) => removeFromAutoBuildQueue(projectId, issueId),
    onMutate: async (issueId) => {
      // Optimistically remove from queue
      removeFromQueue(issueId);
    },
    onSuccess: () => {
      // WebSocket will handle real-time queue updates
      queryClient.invalidateQueries({ queryKey: queryKeys.autoBuild(projectId) });
    },
  });
}

// ============================================================================
// Chat Session Hooks
// ============================================================================

/**
 * Fetch chat sessions for the selected project
 */
export function useSessions() {
  const isConnected = useIsConnected();
  const selectedProject = useProjectStore((s) => s.selectedProject);
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
  const selectedProject = useProjectStore((s) => s.selectedProject);
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
  const selectedProject = useProjectStore((s) => s.selectedProject);
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
  const selectedProject = useProjectStore((s) => s.selectedProject);
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
  const selectedProject = useProjectStore((s) => s.selectedProject);
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
