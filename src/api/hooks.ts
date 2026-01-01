/**
 * React Query hooks for API data fetching
 *
 * This file contains shared utilities and re-exports all domain-specific hooks
 * for backward compatibility.
 */
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '../stores/connectionStore';
import { useProjectStore } from '../stores/projectStore';

// ============================================================================
// Common Utilities
// ============================================================================

/**
 * Hook to check if we're connected to desktop
 */
export function useIsConnected() {
  const connection = useConnectionStore((s) => s.connection);
  return connection.device !== null;
}

/**
 * Hook to get the currently selected project
 * Extracts common selector pattern used throughout the app
 */
export function useSelectedProject() {
  return useProjectStore((s) => s.selectedProject);
}

/**
 * Hook to track if app is in foreground (active)
 * Used to pause polling when app is backgrounded to save battery
 */
export function useAppActive() {
  const appState = useRef(AppState.currentState);
  const [isActive, setIsActive] = useState(appState.current === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
      setIsActive(nextAppState === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return isActive;
}

// ============================================================================
// Optimistic Mutation Helper
// ============================================================================

/**
 * Configuration for useOptimisticMutation helper
 */
interface OptimisticMutationConfig<TData, TVariables, TContext = { previousData: TData | undefined }> {
  /** The mutation function to execute */
  mutationFn: (variables: TVariables) => Promise<unknown>;
  /** Query key for the data being mutated (accepts readonly arrays) */
  queryKey: readonly unknown[];
  /** Function to optimistically update cached data */
  optimisticUpdate: (oldData: TData | undefined, variables: TVariables) => TData | undefined;
  /** Additional query keys to invalidate on success (optional) */
  invalidateQueryKeys?: readonly (readonly unknown[])[];
  /** Custom context builder (optional, defaults to { previousData }) */
  buildContext?: (previousData: TData | undefined, variables: TVariables) => TContext;
  /** Custom rollback function (optional, uses previousData by default) */
  rollback?: (context: TContext | undefined, queryClient: ReturnType<typeof useQueryClient>) => void;
}

/**
 * Generic hook for optimistic mutations with automatic rollback on error.
 * Eliminates boilerplate for cancel → snapshot → update → rollback → invalidate pattern.
 *
 * @example
 * // Simple delete
 * useOptimisticMutation({
 *   mutationFn: (id: string) => deleteItem(id),
 *   queryKey: ['items'],
 *   optimisticUpdate: (old, id) => old?.filter(item => item.id !== id),
 * });
 *
 * @example
 * // Update with multiple invalidations
 * useOptimisticMutation({
 *   mutationFn: updateItem,
 *   queryKey: ['items', workspaceId],
 *   optimisticUpdate: (old, { id, data }) => old?.map(i => i.id === id ? { ...i, ...data } : i),
 *   invalidateQueryKeys: [['items'], ['items', workspaceId]],
 * });
 */
export function useOptimisticMutation<TData, TVariables, TContext = { previousData: TData | undefined }>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  invalidateQueryKeys,
  buildContext,
  rollback,
}: OptimisticMutationConfig<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData<TData>(queryKey, (old) => optimisticUpdate(old, variables));

      // Return context with snapshotted value
      if (buildContext) {
        return buildContext(previousData, variables);
      }
      return { previousData } as TContext;
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (rollback) {
        rollback(context, queryClient);
      } else if (context && typeof context === 'object' && 'previousData' in context) {
        queryClient.setQueryData(queryKey, (context as { previousData: TData | undefined }).previousData);
      }
    },
    onSettled: () => {
      // Always invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey });
      // Invalidate additional keys if specified
      if (invalidateQueryKeys) {
        invalidateQueryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    },
  });
}

// ============================================================================
// Re-exports for Backward Compatibility
// ============================================================================

// Workspace & Project hooks
export {
  useWorkspaces,
  useProjects,
  useDocs,
  useDocContent,
} from './workspaceHooks';

// Issue & Auto-Build hooks
export {
  useIssues,
  useCreateIssue,
  useUpdateIssue,
  useCloseIssue,
  useAutoBuildStatus,
  useStartAutoBuild,
  usePauseAutoBuild,
  useStopAutoBuild,
  useAddToAutoBuildQueue,
  useRemoveFromAutoBuildQueue,
  useAutoBuildBacklog,
} from './issueHooks';

// Chat hooks
export {
  useSessions,
  useMessages,
  useSendMessage,
  useApproveToolCall,
  useRejectToolCall,
} from './chatHooks';

// Subscription, Bookmark & Kanban hooks
export {
  useBookmarks,
  useCreateBookmark,
  useUpdateBookmark,
  useDeleteBookmark,
  useCreateBookmarkCollection,
  useUpdateBookmarkCollection,
  useDeleteBookmarkCollection,
  useSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useDeleteSubscription,
  useCreateSubscriptionCategory,
  useUpdateSubscriptionCategory,
  useDeleteSubscriptionCategory,
  useKanbanTasks,
  useCreateKanbanTask,
  useUpdateKanbanTask,
  useDeleteKanbanTask,
  useMoveKanbanTask,
} from './subscriptionHooks';
