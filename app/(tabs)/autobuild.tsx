import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useProjectStore, useConnectionStore, useAutoBuildStore } from '@/src/stores';
import {
  useAutoBuildStatus,
  useStartAutoBuild,
  usePauseAutoBuild,
  useStopAutoBuild,
  useAddToAutoBuildQueue,
  useRemoveFromAutoBuildQueue,
  useIssues,
} from '@/src/api/hooks';
import type { QueueItem, LogEntry, AutoBuildStatus, AutoBuildPhase, Issue } from '@/src/types';

export default function AutoBuildScreen() {
  const router = useRouter();
  const connection = useConnectionStore((s) => s.connection);
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const buildState = useAutoBuildStore((s) => s.state);

  const [showAddModal, setShowAddModal] = useState(false);

  // Query hooks
  const { refetch, isLoading, isRefetching, isError, error } = useAutoBuildStatus();
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
    await refetch();
  }, [refetch]);

  // Filter open issues that can be added to backlog
  const availableIssues = useMemo(() => {
    const queuedIds = new Set(buildState.queue.map(q => q.id));
    return issues.filter(
      (issue) =>
        issue.status === 'open' &&
        issue.type !== 'epic' &&
        !queuedIds.has(issue.id)
    );
  }, [issues, buildState.queue]);

  // Not connected state
  if (!connection.device) {
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

  // Error state
  if (isError) {
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
          <Text style={styles.emptyText}>
            {error instanceof Error ? error.message : 'Unable to connect to desktop'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/modal')}>
            <FontAwesome name="link" size={16} color={colors.bg.primary} />
            <Text style={styles.buttonText}>Check Connection</Text>
          </TouchableOpacity>
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

  const getPhaseLabel = (phase: AutoBuildPhase): string => {
    switch (phase) {
      case 'selecting': return 'Selecting';
      case 'working': return 'Working';
      case 'selfReviewing': return 'Self Review';
      case 'auditing': return 'Auditing';
      case 'testing': return 'Testing';
      case 'fixing': return 'Fixing';
      case 'reviewing': return 'Review';
      case 'committing': return 'Committing';
      default: return '';
    }
  };

  // Find current issue being worked on
  const currentIssue = buildState.currentIssueId
    ? buildState.queue.find(q => q.id === buildState.currentIssueId)
    : null;

  // Backlog items (excluding current)
  const backlogItems = buildState.queue.filter(q => q.id !== buildState.currentIssueId);

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
            {buildState.queue.length} in backlog
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
        {isLoading ? (
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

// Current work card showing active progress
function CurrentWorkCard({
  item,
  phase,
  progress,
}: {
  item: QueueItem;
  phase?: AutoBuildPhase;
  progress: number;
}) {
  const getPhaseIcon = (phase?: AutoBuildPhase) => {
    switch (phase) {
      case 'working': return 'wrench';
      case 'selfReviewing': return 'eye';
      case 'auditing': return 'search';
      case 'testing': return 'flask';
      case 'fixing': return 'wrench';
      case 'committing': return 'git-square';
      case 'reviewing': return 'eye';
      default: return 'bolt';
    }
  };

  return (
    <View style={styles.currentWorkCard}>
      <View style={styles.currentWorkHeader}>
        <View style={[styles.currentWorkIcon, { backgroundColor: colors.accent.green + '20' }]}>
          <FontAwesome name={getPhaseIcon(phase) as any} size={16} color={colors.accent.green} />
        </View>
        <View style={styles.currentWorkInfo}>
          <Text style={styles.currentWorkTitle} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.currentWorkPhase}>
            {phase ? phase.replace(/([A-Z])/g, ' $1').trim() : 'Processing'}
          </Text>
        </View>
        {progress > 0 && (
          <Text style={styles.currentWorkProgress}>{progress}%</Text>
        )}
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

// Backlog item card with remove button
function BacklogItemCard({
  item,
  position,
  onRemove,
}: {
  item: QueueItem;
  position: number;
  onRemove: () => void;
}) {
  return (
    <View style={styles.backlogItem}>
      <View style={styles.backlogPosition}>
        <Text style={styles.backlogPositionText}>{position}</Text>
      </View>
      <View style={styles.backlogContent}>
        <Text style={styles.backlogText} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.backlogMeta}>
          Added {formatTime(item.createdAt)}
        </Text>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <FontAwesome name="times" size={14} color={colors.text.muted} />
      </TouchableOpacity>
    </View>
  );
}

// Lifecycle item card (for human review and completed stages)
function LifecycleItemCard({
  item,
  stage,
}: {
  item: QueueItem;
  stage: 'review' | 'completed';
}) {
  const stageConfig = {
    review: {
      color: colors.accent.yellow,
      icon: 'eye' as const,
      label: 'Awaiting Review',
    },
    completed: {
      color: colors.accent.green,
      icon: 'check-circle' as const,
      label: 'Completed',
    },
  };

  const config = stageConfig[stage];

  return (
    <View style={[styles.lifecycleItem, { borderLeftColor: config.color }]}>
      <View style={[styles.lifecycleIcon, { backgroundColor: config.color + '20' }]}>
        <FontAwesome name={config.icon} size={14} color={config.color} />
      </View>
      <View style={styles.lifecycleContent}>
        <Text style={styles.lifecycleText} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.lifecycleMeta}>{config.label}</Text>
      </View>
    </View>
  );
}

// Log entry row
function LogEntryRow({ log }: { log: LogEntry }) {
  const levelColors: Record<string, string> = {
    info: colors.accent.blue,
    success: colors.accent.green,
    warn: colors.accent.yellow,
    error: colors.accent.red,
  };

  const levelIcons: Record<string, string> = {
    info: 'info-circle',
    success: 'check-circle',
    warn: 'exclamation-triangle',
    error: 'times-circle',
  };

  return (
    <View style={styles.logEntry}>
      <FontAwesome
        name={levelIcons[log.level] as any}
        size={12}
        color={levelColors[log.level]}
        style={styles.logIcon}
      />
      <Text style={styles.logMessage} numberOfLines={1}>
        {log.message}
      </Text>
      <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
    </View>
  );
}

// Add to backlog modal
function AddToBacklogModal({
  visible,
  issues,
  onClose,
  onAdd,
}: {
  visible: boolean;
  issues: Issue[];
  onClose: () => void;
  onAdd: (issueId: string) => void;
}) {
  const typeColors: Record<string, { bg: string; text: string }> = {
    bug: { bg: colors.accent.red + '20', text: colors.accent.red },
    feature: { bg: colors.accent.green + '20', text: colors.accent.green },
    task: { bg: colors.accent.blue + '20', text: colors.accent.blue },
    epic: { bg: colors.accent.purple + '20', text: colors.accent.purple },
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Backlog</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <FontAwesome name="times" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {issues.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.emptySectionText}>No open issues available</Text>
              </View>
            ) : (
              issues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  style={styles.issueOption}
                  onPress={() => onAdd(issue.id)}
                >
                  <View style={[styles.typeBadge, { backgroundColor: typeColors[issue.type]?.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColors[issue.type]?.text }]}>
                      {issue.type}
                    </Text>
                  </View>
                  <Text style={styles.issueOptionTitle} numberOfLines={2}>
                    {issue.title}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  // Current work styles
  currentWorkCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.green + '40',
  },
  currentWorkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  currentWorkIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentWorkInfo: {
    flex: 1,
  },
  currentWorkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  currentWorkPhase: {
    fontSize: 13,
    color: colors.accent.green,
    textTransform: 'capitalize',
  },
  currentWorkProgress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent.green,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.green,
    borderRadius: 2,
  },
  // Backlog styles
  backlogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  backlogPosition: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backlogPositionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  backlogContent: {
    flex: 1,
  },
  backlogText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  backlogMeta: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  // Lifecycle styles (for review and completed stages)
  lifecycleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    gap: spacing.md,
  },
  lifecycleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifecycleContent: {
    flex: 1,
  },
  lifecycleText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  lifecycleMeta: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  // Log styles
  logsCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  logIcon: {
    width: 16,
  },
  logMessage: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
  },
  logTime: {
    fontSize: 11,
    color: colors.text.muted,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalClose: {
    padding: spacing.sm,
  },
  modalList: {
    padding: spacing.lg,
  },
  modalEmpty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  issueOptionTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
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
});
