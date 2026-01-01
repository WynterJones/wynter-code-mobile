/**
 * React Query hooks for subscriptions, bookmarks, and kanban data fetching
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
  Bookmark,
  BookmarkCollection,
  Subscription,
  SubscriptionCategory,
  KanbanTask,
  CreateKanbanTaskInput,
  UpdateKanbanTaskInput,
  MoveKanbanTaskInput,
} from '../types';
import { useIsConnected, useOptimisticMutation } from './hooks';

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
  type BookmarkData = { bookmarks: Bookmark[]; collections: BookmarkCollection[] };
  return useOptimisticMutation<BookmarkData, { id: string; input: UpdateBookmarkInput }>({
    mutationFn: ({ id, input }) => updateBookmark(id, input),
    queryKey: queryKeys.bookmarks,
    optimisticUpdate: (old, { id, input }) =>
      old ? { ...old, bookmarks: old.bookmarks.map((b) => (b.id === id ? { ...b, ...input } : b)) } as BookmarkData : undefined,
  });
}

/**
 * Delete a bookmark
 */
export function useDeleteBookmark() {
  type BookmarkData = { bookmarks: Bookmark[]; collections: BookmarkCollection[] };
  return useOptimisticMutation<BookmarkData, string>({
    mutationFn: (id) => deleteBookmark(id),
    queryKey: queryKeys.bookmarks,
    optimisticUpdate: (old, id) =>
      old ? { ...old, bookmarks: old.bookmarks.filter((b) => b.id !== id) } : undefined,
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
            s.id === id ? { ...s, ...input } as Subscription : s
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
            c.id === id ? { ...c, ...input } as SubscriptionCategory : c
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
  return useOptimisticMutation<KanbanTask[], { taskId: string; input: UpdateKanbanTaskInput }>({
    mutationFn: ({ taskId, input }) => updateKanbanTask(workspaceId, taskId, input),
    queryKey: queryKeys.kanban(workspaceId),
    optimisticUpdate: (old, { taskId, input }) =>
      old?.map((task) =>
        task.id === taskId ? { ...task, ...input, updatedAt: Date.now() } : task
      ),
  });
}

/**
 * Delete a kanban task
 */
export function useDeleteKanbanTask(workspaceId: string) {
  return useOptimisticMutation<KanbanTask[], string>({
    mutationFn: (taskId) => deleteKanbanTask(workspaceId, taskId),
    queryKey: queryKeys.kanban(workspaceId),
    optimisticUpdate: (old, taskId) => old?.filter((task) => task.id !== taskId),
  });
}

/**
 * Move a kanban task to a different column
 */
export function useMoveKanbanTask(workspaceId: string) {
  return useOptimisticMutation<KanbanTask[], { taskId: string; input: MoveKanbanTaskInput }>({
    mutationFn: ({ taskId, input }) => moveKanbanTask(workspaceId, taskId, input),
    queryKey: queryKeys.kanban(workspaceId),
    optimisticUpdate: (old, { taskId, input }) =>
      old?.map((task) =>
        task.id === taskId
          ? { ...task, status: input.status, order: input.order ?? task.order, updatedAt: Date.now() }
          : task
      ),
  });
}
