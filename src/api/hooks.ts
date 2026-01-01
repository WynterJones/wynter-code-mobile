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
  fetchDocsList,
  fetchDocContent,
  fetchBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  createBookmarkCollection,
  updateBookmarkCollection,
  deleteBookmarkCollection,
  fetchSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  createSubscriptionCategory,
  updateSubscriptionCategory,
  deleteSubscriptionCategory,
  fetchKanbanTasks,
  createKanbanTask,
  updateKanbanTask,
  deleteKanbanTask,
  moveKanbanTask,
  queryKeys,
  type DocFile,
  type CreateBookmarkInput,
  type UpdateBookmarkInput,
  type CreateBookmarkCollectionInput,
  type UpdateBookmarkCollectionInput,
  type CreateSubscriptionInput,
  type UpdateSubscriptionInput,
  type CreateSubscriptionCategoryInput,
  type UpdateSubscriptionCategoryInput,
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
  Bookmark,
  BookmarkCollection,
  Subscription,
  SubscriptionCategory,
  KanbanTask,
  CreateKanbanTaskInput,
  UpdateKanbanTaskInput,
  MoveKanbanTaskInput,
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
    // Deduplicate workspaces by id to prevent duplicate key errors during cache invalidation race conditions
    select: (data) => {
      const seen = new Set<string>();
      return data.filter((ws) => {
        if (seen.has(ws.id)) return false;
        seen.add(ws.id);
        return true;
      });
    },
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
  const { subscribe, handleUpdate } = useAutoBuildStore();

  // Subscribe to WebSocket updates when query is enabled
  useEffect(() => {
    if (isConnected && projectId) {
      subscribe(projectId);
    }
  }, [isConnected, projectId, subscribe]);

  return useQuery({
    queryKey: queryKeys.autoBuild(projectId),
    queryFn: async () => {
      const status = await fetchAutoBuildStatus(projectId);
      // Also update the store with the fetched data
      handleUpdate({
        type: 'AutoBuildUpdate',
        project_id: projectId,
        status: status as unknown as {
          status: 'idle' | 'running' | 'paused' | 'error';
          current_issue_id?: string;
          current_phase?: string;
          progress: number;
          workers: Array<{ id: number; issue_id?: string; phase?: string; current_action?: string; progress?: number }>;
          queue: Array<{ id: string; title: string; status: string; created_at: string }>;
          human_review?: Array<{ id: string; title: string; status: string; created_at: string }>;
          completed?: Array<{ id: string; title: string; status: string; created_at: string }>;
          logs: Array<{ id: string; level: 'info' | 'success' | 'warn' | 'error' | 'claude'; message: string; timestamp: string }>;
        },
      });
      return status;
    },
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

// ============================================================================
// Docs Hooks
// ============================================================================

/**
 * Fetch list of markdown files for the selected project
 */
export function useDocs() {
  const isConnected = useIsConnected();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectPath = selectedProject?.path ?? '';

  return useQuery({
    queryKey: queryKeys.docs(projectPath),
    queryFn: () => fetchDocsList(projectPath),
    enabled: isConnected && !!projectPath,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch content of a specific markdown file
 */
export function useDocContent(filePath: string) {
  const isConnected = useIsConnected();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const projectPath = selectedProject?.path ?? '';

  return useQuery({
    queryKey: queryKeys.docContent(projectPath, filePath),
    queryFn: () => fetchDocContent(projectPath, filePath),
    enabled: isConnected && !!projectPath && !!filePath,
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================================
// Bookmark Hooks
// ============================================================================

/**
 * Fetch bookmarks and collections
 */
export function useBookmarks() {
  const isConnected = useIsConnected();

  return useQuery({
    queryKey: queryKeys.bookmarks,
    queryFn: fetchBookmarks,
    enabled: isConnected,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Create a new bookmark
 */
export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookmarkInput) => createBookmark(input),
    onSettled: () => {
      // Invalidate to refetch fresh data from server
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

/**
 * Update a bookmark
 */
export function useUpdateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBookmarkInput }) =>
      updateBookmark(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks });

      const previousData = queryClient.getQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks
      );

      queryClient.setQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks,
        (old) => old ? {
          ...old,
          bookmarks: old.bookmarks.map((b) =>
            b.id === id ? { ...b, ...input } : b
          ),
        } : undefined
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.bookmarks, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

/**
 * Delete a bookmark
 */
export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBookmark(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks });

      const previousData = queryClient.getQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks
      );

      queryClient.setQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks,
        (old) => old ? {
          ...old,
          bookmarks: old.bookmarks.filter((b) => b.id !== id),
        } : undefined
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.bookmarks, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

/**
 * Create a new bookmark collection
 */
export function useCreateBookmarkCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookmarkCollectionInput) => createBookmarkCollection(input),
    onSettled: () => {
      // Invalidate to refetch fresh data from server
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

/**
 * Update a bookmark collection
 */
export function useUpdateBookmarkCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBookmarkCollectionInput }) =>
      updateBookmarkCollection(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks });

      const previousData = queryClient.getQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks
      );

      queryClient.setQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks,
        (old) => old ? {
          ...old,
          collections: old.collections.map((c) =>
            c.id === id ? { ...c, ...input } : c
          ),
        } : undefined
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.bookmarks, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

/**
 * Delete a bookmark collection
 */
export function useDeleteBookmarkCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBookmarkCollection(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks });

      const previousData = queryClient.getQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks
      );

      queryClient.setQueryData<{ bookmarks: Bookmark[]; collections: BookmarkCollection[] }>(
        queryKeys.bookmarks,
        (old) => old ? {
          ...old,
          collections: old.collections.filter((c) => c.id !== id),
          // Also move bookmarks from deleted collection to uncategorized
          bookmarks: old.bookmarks.map((b) =>
            b.collectionId === id ? { ...b, collectionId: undefined } : b
          ),
        } : undefined
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.bookmarks, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

// ============================================================================
// Subscription Hooks
// ============================================================================

/**
 * Fetch subscriptions and categories, optionally filtered by workspace
 */
export function useSubscriptions(workspaceId?: string) {
  const isConnected = useIsConnected();

  return useQuery({
    queryKey: queryKeys.subscriptions(workspaceId),
    queryFn: () => fetchSubscriptions(workspaceId),
    enabled: isConnected,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Create a new subscription
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSubscriptionInput) => createSubscription(input),
    onSettled: (newSubscription, _error, input) => {
      // Invalidate to refetch fresh data from server
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(input.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions() });
    },
  });
}

/**
 * Update an existing subscription
 */
export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input, workspaceId }: { id: string; input: UpdateSubscriptionInput; workspaceId: string }) =>
      updateSubscription(id, input),
    onMutate: async ({ id, input, workspaceId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subscriptions(workspaceId) });

      const previousData = queryClient.getQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId)
      );

      queryClient.setQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId),
        (old) => old ? {
          ...old,
          subscriptions: old.subscriptions.map((s) =>
            s.id === id ? { ...s, ...input } : s
          ),
        } : undefined
      );

      return { previousData, workspaceId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.subscriptions(context.workspaceId), context.previousData);
      }
    },
    onSettled: (_, __, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions() });
    },
  });
}

/**
 * Delete a subscription
 */
export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workspaceId }: { id: string; workspaceId: string }) => deleteSubscription(id),
    onMutate: async ({ id, workspaceId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subscriptions(workspaceId) });

      const previousData = queryClient.getQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId)
      );

      queryClient.setQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId),
        (old) => old ? {
          ...old,
          subscriptions: old.subscriptions.filter((s) => s.id !== id),
        } : undefined
      );

      return { previousData, workspaceId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.subscriptions(context.workspaceId), context.previousData);
      }
    },
    onSettled: (_, __, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions() });
    },
  });
}

/**
 * Create a new subscription category
 */
export function useCreateSubscriptionCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSubscriptionCategoryInput) => createSubscriptionCategory(input),
    onSettled: (_newCategory, _error, input) => {
      // Invalidate to refetch fresh data from server
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(input.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions() });
    },
  });
}

/**
 * Update a subscription category
 */
export function useUpdateSubscriptionCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input, workspaceId }: { id: string; input: UpdateSubscriptionCategoryInput; workspaceId: string }) =>
      updateSubscriptionCategory(id, input),
    onMutate: async ({ id, input, workspaceId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subscriptions(workspaceId) });

      const previousData = queryClient.getQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId)
      );

      queryClient.setQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId),
        (old) => old ? {
          ...old,
          categories: old.categories.map((c) =>
            c.id === id ? { ...c, ...input } : c
          ),
        } : undefined
      );

      return { previousData, workspaceId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.subscriptions(context.workspaceId), context.previousData);
      }
    },
    onSettled: (_, __, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions() });
    },
  });
}

/**
 * Delete a subscription category
 */
export function useDeleteSubscriptionCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workspaceId }: { id: string; workspaceId: string }) => deleteSubscriptionCategory(id),
    onMutate: async ({ id, workspaceId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subscriptions(workspaceId) });

      const previousData = queryClient.getQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId)
      );

      queryClient.setQueryData<{ subscriptions: Subscription[]; categories: SubscriptionCategory[] }>(
        queryKeys.subscriptions(workspaceId),
        (old) => old ? {
          ...old,
          categories: old.categories.filter((c) => c.id !== id),
          // Also move subscriptions from deleted category to uncategorized
          subscriptions: old.subscriptions.map((s) =>
            s.categoryId === id ? { ...s, categoryId: undefined } : s
          ),
        } : undefined
      );

      return { previousData, workspaceId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.subscriptions(context.workspaceId), context.previousData);
      }
    },
    onSettled: (_, __, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions() });
    },
  });
}

// ============================================================================
// Kanban Board Hooks
// ============================================================================

/**
 * Fetch kanban tasks for a workspace
 */
export function useKanbanTasks(workspaceId: string) {
  const isConnected = useIsConnected();
  const queryClient = useQueryClient();

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!isConnected || !workspaceId) return;

    const unsubscribe = wsManager.addHandler((update) => {
      if (update.type === 'KanbanUpdate' && update.workspace_id === workspaceId) {
        // Invalidate query to refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.kanban(workspaceId) });
      }
    });

    return unsubscribe;
  }, [isConnected, workspaceId, queryClient]);

  return useQuery({
    queryKey: queryKeys.kanban(workspaceId),
    queryFn: () => fetchKanbanTasks(workspaceId),
    enabled: isConnected && !!workspaceId,
    staleTime: 30000,
    // Deduplicate tasks by ID to prevent duplicate key errors during sync race conditions
    select: (tasks) => {
      const seen = new Set<string>();
      return tasks.filter((task) => {
        if (seen.has(task.id)) return false;
        seen.add(task.id);
        return true;
      });
    },
  });
}

/**
 * Create a new kanban task
 */
export function useCreateKanbanTask(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKanbanTaskInput) => createKanbanTask(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kanban(workspaceId) });
    },
  });
}

/**
 * Update a kanban task
 */
export function useUpdateKanbanTask(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateKanbanTaskInput }) =>
      updateKanbanTask(workspaceId, taskId, input),
    onMutate: async ({ taskId, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.kanban(workspaceId) });

      const previousTasks = queryClient.getQueryData<KanbanTask[]>(
        queryKeys.kanban(workspaceId)
      );

      queryClient.setQueryData<KanbanTask[]>(queryKeys.kanban(workspaceId), (old) =>
        old?.map((task) =>
          task.id === taskId ? { ...task, ...input, updatedAt: Date.now() } : task
        )
      );

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.kanban(workspaceId), context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kanban(workspaceId) });
    },
  });
}

/**
 * Delete a kanban task
 */
export function useDeleteKanbanTask(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteKanbanTask(workspaceId, taskId),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.kanban(workspaceId) });

      const previousTasks = queryClient.getQueryData<KanbanTask[]>(
        queryKeys.kanban(workspaceId)
      );

      queryClient.setQueryData<KanbanTask[]>(queryKeys.kanban(workspaceId), (old) =>
        old?.filter((task) => task.id !== taskId)
      );

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.kanban(workspaceId), context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kanban(workspaceId) });
    },
  });
}

/**
 * Move a kanban task to a different column
 */
export function useMoveKanbanTask(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: MoveKanbanTaskInput }) =>
      moveKanbanTask(workspaceId, taskId, input),
    onMutate: async ({ taskId, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.kanban(workspaceId) });

      const previousTasks = queryClient.getQueryData<KanbanTask[]>(
        queryKeys.kanban(workspaceId)
      );

      queryClient.setQueryData<KanbanTask[]>(queryKeys.kanban(workspaceId), (old) =>
        old?.map((task) =>
          task.id === taskId
            ? { ...task, status: input.status, order: input.order ?? task.order, updatedAt: Date.now() }
            : task
        )
      );

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.kanban(workspaceId), context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kanban(workspaceId) });
    },
  });
}
