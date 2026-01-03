import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useProjectStore, useAutoBuildStore } from '@/src/stores';
import {
  useAutoBuildStatus,
  useAutoBuildBacklog,
  useStartAutoBuild,
  usePauseAutoBuild,
  useStopAutoBuild,
  useAddToAutoBuildQueue,
  useRemoveFromAutoBuildQueue,
  useIssues,
  useIsConnected,
} from '@/src/api/hooks';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import type { QueueItem, AutoBuildStatus } from '@/src/types';
import {
  CurrentWorkCard,
  BacklogItemCard,
  LifecycleItemCard,
  LogEntryRow,
  AddToBacklogModal,
  getPhaseLabel,
} from '@/src/components/autobuild';

function AutoBuildScreenContent() {
  const router = useRouter();
  const isConnected = useIsConnected();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const buildState = useAutoBuildStore((s) => s.state);

  const [showAddModal, setShowAddModal] = useState(false);

  // Query hooks
  const { refetch, isLoading, isRefetching, isError, error } = useAutoBuildStatus();
  const { data: backlogData, refetch: refetchBacklog, isLoading: isBacklogLoading } = useAutoBuildBacklog();
  const { data: issues = [] } = useIssues();

  // Mutation hooks for controls
  const startMutation = useStartAutoBuild();
  const pauseMutation = usePauseAutoBuild();
  const stopMutation = useStopAutoBuild();
  const addToQueueMutation = useAddToAutoBuildQueue();
  const removeFromQueueMutation = useRemoveFromAutoBuildQueue();

  const isControlLoading = startMutation.isPending || pauseMutation.isPending || stopMutation.isPending;

  // Controls
  const handleStart = () => startMutation.mutate();
  const handlePause = () => pauseMutation.mutate();
  const handleStop = () => stopMutation.mutate();

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchBacklog()]);
  }, [refetch, refetchBacklog]);

  // Get persistent backlog items (map to QueueItem format)
  const persistentBacklogItems: QueueItem[] = useMemo(() => {
    if (!backlogData?.issues) return [];
    return backlogData.issues.map((item) => ({
      id: item.id,
      description: item.title || `Issue ${item.id}`,
      status: item.status === 'pending' ? 'pending' as const :
              item.status === 'processing' ? 'processing' as const :
              item.status === 'completed' ? 'completed' as const : 'pending' as const,
      createdAt: item.created_at || new Date().toISOString(),
    }));
  }, [backlogData?.issues]);

  // Filter open issues that can be added to backlog
  const availableIssues = useMemo(() => {
    // Use persistent backlog IDs for filtering
    const backlogIds = new Set(persistentBacklogItems.map(q => q.id));
    const queuedIds = new Set(buildState.queue.map(q => q.id));
    return issues.filter(
      (issue) =>
        issue.status === 'open' &&
        issue.type !== 'epic' &&
        !queuedIds.has(issue.id) &&
        !backlogIds.has(issue.id)
    );
  }, [issues, buildState.queue, persistentBacklogItems]);

  // Not connected state
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logoImage}
            />
          </View>
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptyText}>
            Connect to your desktop to use Auto-Build.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/modal')}>
            <Text style={styles.buttonText}>Connect to Desktop</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // No project selected
  if (!selectedProject) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <FontAwesome name="folder-o" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Project Selected</Text>
          <Text style={styles.emptyText}>
            Select a project from the Projects tab to use Auto-Build.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
            <FontAwesome name="folder" size={16} color={colors.bg.primary} />
            <Text style={styles.buttonText}>Go to Projects</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Check if beads is not installed
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
  const beadsNotInstalled = isError && (
    errorMessage.includes('beads') && errorMessage.includes('not') ||
    errorMessage.includes('not installed') ||
    errorMessage.includes('beads_not_installed') ||
    errorMessage.includes('no beads')
  );

  // Beads not installed state
  if (beadsNotInstalled) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.projectBadge}>
            <FontAwesome name="folder-open" size={14} color={colors.accent.purple} />
            <Text style={styles.projectName}>{selectedProject.name}</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>
            <FontAwesome name="puzzle-piece" size={48} color={colors.accent.orange} />
          </View>
          <Text style={styles.emptyTitle}>Auto-Build Not Available</Text>
          <Text style={styles.emptyText}>
            You don't have Beads issue tracking installed for this project. Auto-Build requires Beads to work.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
            <FontAwesome name="arrow-left" size={16} color={colors.bg.primary} />
            <Text style={styles.buttonText}>Back to Projects</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Error state
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to connect to desktop';
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.projectBadge}>
            <FontAwesome name="folder-open" size={14} color={colors.accent.purple} />
            <Text style={styles.projectName}>{selectedProject.name}</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
          </View>
          <Text style={styles.emptyTitle}>Failed to Load</Text>
          <Text style={styles.emptyText}>{errorMessage}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={[styles.button, { marginRight: 8 }]}
              onPress={() => refetch()}
            >
              <FontAwesome name="refresh" size={16} color={colors.bg.primary} />
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => router.push('/modal')}
            >
              <FontAwesome name="link" size={16} color={colors.text.primary} />
              <Text style={[styles.buttonText, { color: colors.text.primary }]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const statusColors: Record<AutoBuildStatus, string> = {
    running: colors.accent.green,
    paused: colors.accent.yellow,
    stopped: colors.text.muted,
    idle: colors.text.muted,
    error: colors.accent.red,
  };

  // Find current issue being worked on (check both in-memory queue and persistent backlog)
  const currentIssue = buildState.currentIssueId
    ? (buildState.queue.find(q => q.id === buildState.currentIssueId) ||
       persistentBacklogItems.find(q => q.id === buildState.currentIssueId))
    : null;

  // Backlog items from persistent storage (excluding current)
  const backlogItems = persistentBacklogItems.filter(q => q.id !== buildState.currentIssueId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.projectBadge}>
          <FontAwesome name="folder-open" size={14} color={colors.accent.purple} />
          <Text style={styles.projectName}>{selectedProject.name}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent.purple}
          />
        }
      >
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[buildState.status] }]} />
            <Text style={[styles.statusText, { color: statusColors[buildState.status] }]}>
              {buildState.status.charAt(0).toUpperCase() + buildState.status.slice(1)}
            </Text>
            {buildState.currentPhase && (
              <View style={styles.phaseBadge}>
                <Text style={styles.phaseText}>
                  {getPhaseLabel(buildState.currentPhase)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.queueCount}>
            {persistentBacklogItems.length} in backlog
          </Text>
          {buildState.status === 'running' && buildState.progress > 0 && (
            <View style={styles.overallProgressBar}>
              <View
                style={[styles.overallProgressFill, { width: `${buildState.progress}%` }]}
              />
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              (buildState.status === 'running' || isControlLoading) && styles.controlButtonDisabled,
            ]}
            onPress={handleStart}
            disabled={buildState.status === 'running' || isControlLoading}
          >
            {startMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.accent.green} />
            ) : (
              <FontAwesome
                name="play"
                size={14}
                color={buildState.status === 'running' ? colors.text.muted : colors.accent.green}
              />
            )}
            <Text
              style={[
                styles.controlText,
                { color: buildState.status === 'running' ? colors.text.muted : colors.accent.green },
              ]}
            >
              Start
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              (buildState.status !== 'running' || isControlLoading) && styles.controlButtonDisabled,
            ]}
            onPress={handlePause}
            disabled={buildState.status !== 'running' || isControlLoading}
          >
            {pauseMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.accent.yellow} />
            ) : (
              <FontAwesome
                name="pause"
                size={14}
                color={buildState.status === 'running' ? colors.accent.yellow : colors.text.muted}
              />
            )}
            <Text
              style={[
                styles.controlText,
                { color: buildState.status === 'running' ? colors.accent.yellow : colors.text.muted },
              ]}
            >
              Pause
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              styles.controlButtonDanger,
              (buildState.status === 'stopped' || isControlLoading) && styles.controlButtonDisabled,
            ]}
            onPress={handleStop}
            disabled={buildState.status === 'stopped' || isControlLoading}
          >
            {stopMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.accent.red} />
            ) : (
              <FontAwesome
                name="stop"
                size={14}
                color={buildState.status !== 'stopped' ? colors.accent.red : colors.text.muted}
              />
            )}
            <Text
              style={[
                styles.controlText,
                { color: buildState.status !== 'stopped' ? colors.accent.red : colors.text.muted },
              ]}
            >
              Stop
            </Text>
          </TouchableOpacity>
        </View>

        {/* Current Work - only show if running */}
        {buildState.status === 'running' && currentIssue && (
          <>
            <Text style={styles.sectionTitle}>In Progress</Text>
            <CurrentWorkCard item={currentIssue} phase={buildState.currentPhase} progress={buildState.progress} />
          </>
        )}

        {/* Human Review */}
        {buildState.humanReview.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Human Review ({buildState.humanReview.length})</Text>
            </View>
            {buildState.humanReview.map((item) => (
              <LifecycleItemCard key={item.id} item={item} stage="review" />
            ))}
          </>
        )}

        {/* Completed */}
        {buildState.completed.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Completed ({buildState.completed.length})</Text>
            </View>
            {buildState.completed.slice(-5).map((item) => (
              <LifecycleItemCard key={item.id} item={item} stage="completed" />
            ))}
          </>
        )}

        {/* Backlog */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Backlog ({backlogItems.length})</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
            disabled={availableIssues.length === 0}
          >
            <FontAwesome
              name="plus"
              size={12}
              color={availableIssues.length > 0 ? colors.accent.purple : colors.text.muted}
            />
            <Text
              style={[
                styles.addButtonText,
                { color: availableIssues.length > 0 ? colors.accent.purple : colors.text.muted },
              ]}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>
        {isLoading || isBacklogLoading ? (
          <View style={styles.emptySection}>
            <ActivityIndicator size="small" color={colors.accent.purple} />
          </View>
        ) : backlogItems.length === 0 ? (
          <View style={styles.emptySection}>
            <FontAwesome name="inbox" size={24} color={colors.text.muted} style={{ marginBottom: spacing.sm }} />
            <Text style={styles.emptySectionText}>Backlog is empty</Text>
            <Text style={styles.emptySectionHint}>Add issues to start auto-building</Text>
          </View>
        ) : (
          backlogItems.map((item, index) => (
            <BacklogItemCard
              key={item.id}
              item={item}
              position={index + 1}
              onRemove={() => removeFromQueueMutation.mutate(item.id)}
            />
          ))
        )}

        {/* Recent Activity */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}>Activity</Text>
        <View style={styles.logsCard}>
          {isLoading ? (
            <View style={styles.emptySection}>
              <ActivityIndicator size="small" color={colors.accent.purple} />
            </View>
          ) : buildState.logs.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No activity yet</Text>
            </View>
          ) : (
            buildState.logs.slice(-10).map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add to Backlog Modal */}
      <AddToBacklogModal
        visible={showAddModal}
        issues={availableIssues}
        onClose={() => setShowAddModal(false)}
        onAdd={(issueId) => {
          addToQueueMutation.mutate(issueId);
          setShowAddModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  statusHeader: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  queueCount: {
    fontSize: 13,
    color: colors.text.muted,
  },
  phaseBadge: {
    backgroundColor: colors.accent.purple + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  phaseText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.accent.purple,
    textTransform: 'capitalize',
  },
  overallProgressBar: {
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: colors.accent.purple,
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  controlButtonDanger: {
    borderColor: colors.accent.red + '30',
  },
  controlText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptySection: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySectionText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  emptySectionHint: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  // Log styles
  logsCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Empty state styles
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    maxWidth: 280,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  buttonText: {
    color: colors.bg.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: colors.bg.tertiary,
  },
  errorActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
});

export default function AutoBuildScreen() {
  return (
    <ScreenErrorBoundary screenName="Auto-Build" showGoBack={false}>
      <AutoBuildScreenContent />
    </ScreenErrorBoundary>
  );
}
