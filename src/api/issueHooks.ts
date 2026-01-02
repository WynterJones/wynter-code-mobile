/**
 * React Query hooks for issue and auto-build data fetching
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchIssues,
  createIssue,
  updateIssue,
  closeIssue,
  fetchAutoBuildStatus,
  fetchAutoBuildBacklog,
  startAutoBuild,
  pauseAutoBuild,
  stopAutoBuild,
  addToAutoBuildQueue,
  removeFromAutoBuildQueue,
  queryKeys,
} from './client';
import type { AutoBuildUpdate } from './websocket';
import type {
  AutoBuildState,
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
} from '../types';
import { useAutoBuildStore } from '../stores/autoBuildStore';
import { useIsConnected, useSelectedProject, useAppActive } from './hooks';

/**
 * Fetch issues for the selected project with optional pagination
 */
export function useIssues(options?: {
  pollingEnabled?: boolean;
  pollingInterval?: number;
  limit?: number;
  offset?: number;
}) {
  const isConnected = useIsConnected();
  const selectedProject = useSelectedProject();
  const projectPath = selectedProject?.path ?? '';
  const { pollingEnabled = false, pollingInterval = 5000, limit = 50, offset = 0 } = options ?? {};

  return useQuery({
    queryKey: [...queryKeys.issues(projectPath), { limit, offset }],
    queryFn: () => fetchIssues(projectPath, { limit, offset }),
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
  const selectedProject = useSelectedProject();
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
  const selectedProject = useSelectedProject();
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
  const selectedProject = useSelectedProject();
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
 * Transforms AutoBuildState (camelCase) to AutoBuildUpdate['status'] (snake_case)
 * to properly type the WebSocket update format
 */
function transformAutoBuildStateToUpdate(state: AutoBuildState): AutoBuildUpdate['status'] {
  return {
    status: state.status === 'stopped' ? 'idle' : state.status as 'idle' | 'running' | 'paused' | 'error',
    current_issue_id: state.currentIssueId,
    current_phase: state.currentPhase,
    progress: state.progress ?? 0,
    workers: (state.workers ?? []).map((w, index) => ({
      id: typeof w.id === 'string' ? index : (w.id as unknown as number),
      issue_id: (w as { issueId?: string }).issueId,
      phase: w.status,
      current_action: w.currentTask,
      progress: w.progress,
    })),
    queue: (state.queue ?? []).map((q) => ({
      id: q.id,
      title: q.description,
      status: q.status,
      created_at: q.createdAt,
    })),
    human_review: (state.humanReview ?? []).map((h) => ({
      id: h.id,
      title: h.description,
      status: h.status,
      created_at: h.createdAt,
    })),
    completed: (state.completed ?? []).map((c) => ({
      id: c.id,
      title: c.description,
      status: c.status,
      created_at: c.createdAt,
    })),
    logs: (state.logs ?? []).map((l) => ({
      id: l.id,
      level: l.level,
      message: l.message,
      timestamp: l.timestamp,
    })),
  };
}

/**
 * Fetch auto-build status (initial load, before WebSocket takes over)
 */
export function useAutoBuildStatus() {
  const isConnected = useIsConnected();
  const selectedProject = useSelectedProject();
  const projectId = selectedProject?.id ?? '';
  const { subscribe, handleUpdate, unsubscribe } = useAutoBuildStore();

  // Subscribe to WebSocket updates when query is enabled
  useEffect(() => {
    if (isConnected && projectId) {
      subscribe(projectId);
    }
    return () => {
      unsubscribe();
    };
  }, [isConnected, projectId, subscribe, unsubscribe]);

  return useQuery({
    queryKey: queryKeys.autoBuild(projectId),
    queryFn: async () => {
      const status = await fetchAutoBuildStatus(projectId);
      // Also update the store with the fetched data (transform to WebSocket format)
      handleUpdate({
        type: 'AutoBuildUpdate',
        project_id: projectId,
        status: transformAutoBuildStateToUpdate(status),
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
  const selectedProject = useSelectedProject();
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
  const selectedProject = useSelectedProject();
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
  const selectedProject = useSelectedProject();
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
  const selectedProject = useSelectedProject();
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
      queryClient.invalidateQueries({ queryKey: queryKeys.autoBuildBacklog(projectId) });
    },
  });
}

/**
 * Remove issue from auto-build queue
 */
export function useRemoveFromAutoBuildQueue() {
  const queryClient = useQueryClient();
  const selectedProject = useSelectedProject();
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
      queryClient.invalidateQueries({ queryKey: queryKeys.autoBuildBacklog(projectId) });
    },
  });
}

/**
 * Fetch persistent auto-build backlog
 * This survives app restarts and shows the saved queue state
 */
export function useAutoBuildBacklog() {
  const isConnected = useIsConnected();
  const isAppActive = useAppActive();
  const selectedProject = useSelectedProject();
  const projectId = selectedProject?.id ?? '';

  return useQuery({
    queryKey: queryKeys.autoBuildBacklog(projectId),
    queryFn: () => fetchAutoBuildBacklog(projectId),
    enabled: isConnected && !!projectId,
    staleTime: 30000, // 30 seconds
    // Only poll when app is in foreground to save battery
    refetchInterval: isAppActive ? 60000 : false,
  });
}
