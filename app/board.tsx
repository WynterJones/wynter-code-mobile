import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import { useWorkspaces } from '@/src/api/hooks';
import {
  useKanbanTasks,
  useCreateKanbanTask,
  useUpdateKanbanTask,
  useMoveKanbanTask,
  useDeleteKanbanTask,
} from '@/src/api/hooks';
import type {
  KanbanTask,
  KanbanStatus,
  KanbanPriority,
  CreateKanbanTaskInput,
} from '@/src/types';
import {
  KANBAN_COLUMNS,
  KANBAN_PRIORITY_LABELS,
  KANBAN_PRIORITY_COLORS,
} from '@/src/types';

// ============================================================================
// Task Card Component
// ============================================================================
function TaskCard({
  task,
  onMove,
  onDelete,
  onToggleLock,
  showLockToggle,
}: {
  task: KanbanTask;
  onMove: (status: KanbanStatus) => void;
  onDelete: () => void;
  onToggleLock?: () => void;
  showLockToggle?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  // Get available move targets (columns other than current)
  const moveTargets = KANBAN_COLUMNS.filter((col) => col.id !== task.status);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: KANBAN_PRIORITY_COLORS[task.priority] },
      ]}
      onPress={() => setShowActions(!showActions)}
    >
      {/* Priority indicator */}
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.priorityDot,
            { backgroundColor: KANBAN_PRIORITY_COLORS[task.priority] },
          ]}
        />
        <Text style={styles.priorityLabel}>
          {KANBAN_PRIORITY_LABELS[task.priority]}
        </Text>
        {showLockToggle && onToggleLock && (
          <TouchableOpacity
            style={styles.lockToggle}
            onPress={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
          >
            <FontAwesome
              name="square-o"
              size={14}
              color={colors.text.muted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {task.title}
      </Text>

      {/* Description preview */}
      {task.description && (
        <Text style={styles.cardDescription} numberOfLines={1}>
          {task.description}
        </Text>
      )}

      {/* Quick actions */}
      {showActions && (
        <View style={styles.cardActions}>
          {moveTargets.map((col) => (
            <TouchableOpacity
              key={col.id}
              style={[styles.moveButton, { borderColor: col.color }]}
              onPress={() => onMove(col.id)}
            >
              <FontAwesome name="arrow-right" size={10} color={col.color} />
              <Text style={[styles.moveButtonText, { color: col.color }]}>
                {col.title}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.deleteButton]} onPress={onDelete}>
            <FontAwesome name="trash" size={12} color={colors.accent.red} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// Locked/Completed Task Card Component (for polished column)
// ============================================================================
function LockedTaskCard({
  task,
  onToggleLock,
}: {
  task: KanbanTask;
  onToggleLock?: () => void;
}) {
  return (
    <View style={styles.lockedCard}>
      <Text style={styles.lockedCardTitle} numberOfLines={1}>
        {task.title}
      </Text>
      {onToggleLock && (
        <TouchableOpacity style={styles.unlockButton} onPress={onToggleLock}>
          <FontAwesome name="check-square" size={14} color={colors.accent.green} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// Column Component
// ============================================================================
function KanbanColumnView({
  column,
  tasks,
  onMoveTask,
  onDeleteTask,
  onToggleLock,
}: {
  column: (typeof KANBAN_COLUMNS)[0];
  tasks: KanbanTask[];
  onMoveTask: (taskId: string, status: KanbanStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleLock?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const isPolishedColumn = column.id === 'polished';

  // Separate locked and unlocked tasks (only for polished column)
  const { unlockedTasks, lockedTasks } = useMemo(() => {
    if (!isPolishedColumn) {
      return { unlockedTasks: tasks, lockedTasks: [] };
    }
    return {
      unlockedTasks: tasks.filter((t) => !t.locked),
      lockedTasks: tasks.filter((t) => t.locked),
    };
  }, [tasks, isPolishedColumn]);

  return (
    <View style={styles.column}>
      <TouchableOpacity
        style={styles.columnHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={[styles.columnDot, { backgroundColor: column.color }]} />
        <Text style={styles.columnTitle}>{column.title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{tasks.length}</Text>
        </View>
        {lockedTasks.length > 0 && (
          <View style={styles.completedBadge}>
            <FontAwesome name="check-square" size={10} color={colors.accent.green} />
            <Text style={styles.completedBadgeText}>{lockedTasks.length}</Text>
          </View>
        )}
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.columnContent}>
          {unlockedTasks.length === 0 && lockedTasks.length === 0 ? (
            <Text style={styles.emptyColumnText}>{column.emptyMessage}</Text>
          ) : unlockedTasks.length === 0 ? (
            <Text style={styles.emptyColumnText}>All tasks completed</Text>
          ) : (
            unlockedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onMove={(status) => onMoveTask(task.id, status)}
                onDelete={() => onDeleteTask(task.id)}
                onToggleLock={onToggleLock ? () => onToggleLock(task.id) : undefined}
                showLockToggle={isPolishedColumn}
              />
            ))
          )}

          {/* Completed/Locked Tasks Section (Polished column only) */}
          {lockedTasks.length > 0 && (
            <View style={styles.completedSection}>
              <View style={styles.completedHeader}>
                <FontAwesome name="check-square" size={12} color={`${colors.accent.green}99`} />
                <Text style={styles.completedHeaderText}>
                  Completed ({lockedTasks.length})
                </Text>
              </View>
              <View style={styles.completedList}>
                {lockedTasks.map((task) => (
                  <LockedTaskCard
                    key={task.id}
                    task={task}
                    onToggleLock={onToggleLock ? () => onToggleLock(task.id) : undefined}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Add Task Modal
// ============================================================================
function AddTaskModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateKanbanTaskInput) => void;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<KanbanPriority>(2);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority(2);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
    });
    // Reset form immediately after submitting to prevent duplicates
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Task</Text>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome name="times" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Task title"
            placeholderTextColor={colors.text.muted}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.text.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {/* Priority selector */}
          <Text style={styles.label}>Priority</Text>
          <View style={styles.prioritySelector}>
            {([0, 1, 2, 3, 4] as KanbanPriority[]).map((p) => {
              const isSelected = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    { borderColor: KANBAN_PRIORITY_COLORS[p] },
                    isSelected && {
                      backgroundColor: KANBAN_PRIORITY_COLORS[p] + '25',
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: KANBAN_PRIORITY_COLORS[p] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.priorityOptionText,
                      isSelected && {
                        color: KANBAN_PRIORITY_COLORS[p],
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {KANBAN_PRIORITY_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!title.trim() || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Adding...' : 'Add to Backlog'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================================
// Main Board Screen
// ============================================================================
export default function BoardScreen() {
  const connection = useConnectionStore((s) => s.connection);
  const isConnected = connection.status === 'connected';

  // Get workspaces to let user select one (or use first by default)
  const { data: workspaces } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );

  // Use first workspace if none selected
  const workspaceId = selectedWorkspaceId || workspaces?.[0]?.id || '';

  // Fetch tasks
  const { data: tasks, isLoading, error, refetch } = useKanbanTasks(workspaceId);

  // Mutations
  const createTask = useCreateKanbanTask(workspaceId);
  const updateTask = useUpdateKanbanTask(workspaceId);
  const moveTask = useMoveKanbanTask(workspaceId);
  const deleteTask = useDeleteKanbanTask(workspaceId);

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<KanbanStatus, KanbanTask[]> = {
      backlog: [],
      doing: [],
      mvp: [],
      polished: [],
    };

    if (tasks) {
      tasks.forEach((task) => {
        grouped[task.status].push(task);
      });
      // Sort by order within each column
      Object.keys(grouped).forEach((status) => {
        grouped[status as KanbanStatus].sort((a, b) => a.order - b.order);
      });
    }

    return grouped;
  }, [tasks]);

  const handleMoveTask = useCallback(
    (taskId: string, status: KanbanStatus) => {
      moveTask.mutate({ taskId, input: { status } });
    },
    [moveTask]
  );

  const handleToggleLock = useCallback(
    (taskId: string) => {
      const task = tasks?.find((t) => t.id === taskId);
      if (task) {
        updateTask.mutate({ taskId, input: { locked: !task.locked } });
      }
    },
    [tasks, updateTask]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTask.mutate(taskId),
        },
      ]);
    },
    [deleteTask]
  );

  const handleAddTask = useCallback(
    (input: CreateKanbanTaskInput) => {
      createTask.mutate(input, {
        onSuccess: () => setShowAddModal(false),
      });
    },
    [createTask]
  );

  // Not connected state
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="plug" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptySubtitle}>
            Connect to your desktop to view your board
          </Text>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading && !tasks) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="columns" size={48} color={colors.accent.purple} />
          </View>
          <Text style={styles.emptyTitle}>Loading Board...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, styles.errorIcon]}>
            <FontAwesome
              name="exclamation-triangle"
              size={48}
              color={colors.accent.red}
            />
          </View>
          <Text style={styles.emptyTitle}>Error Loading Board</Text>
          <Text style={styles.emptySubtitle}>{(error as Error).message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <FontAwesome name="refresh" size={16} color={colors.text.primary} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Workspace Selector */}
      {workspaces && workspaces.length > 1 && (
        <View style={styles.workspaceSelector}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.workspaceChips}
          >
            {workspaces.map((ws) => (
              <TouchableOpacity
                key={ws.id}
                style={[
                  styles.workspaceChip,
                  workspaceId === ws.id && styles.workspaceChipActive,
                ]}
                onPress={() => setSelectedWorkspaceId(ws.id)}
              >
                <Text
                  style={[
                    styles.workspaceChipText,
                    workspaceId === ws.id && styles.workspaceChipTextActive,
                  ]}
                >
                  {ws.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Board Columns */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.purple}
          />
        }
      >
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumnView
            key={column.id}
            column={column}
            tasks={tasksByColumn[column.id]}
            onMoveTask={handleMoveTask}
            onDeleteTask={handleDeleteTask}
            onToggleLock={handleToggleLock}
          />
        ))}
      </ScrollView>

      {/* FAB to add task */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <FontAwesome name="plus" size={24} color={colors.bg.primary} />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <AddTaskModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddTask}
        isSubmitting={createTask.isPending}
      />
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },

  // Workspace selector
  workspaceSelector: {
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  workspaceChips: { padding: spacing.md, gap: spacing.sm },
  workspaceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  workspaceChipActive: {
    backgroundColor: colors.accent.purple + '20',
    borderWidth: 1,
    borderColor: colors.accent.purple + '40',
  },
  workspaceChipText: { fontSize: 13, color: colors.text.muted },
  workspaceChipTextActive: { color: colors.accent.purple, fontWeight: '600' },

  // Column styles
  column: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  columnDot: { width: 8, height: 8, borderRadius: 4 },
  columnTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: { fontSize: 12, color: colors.text.muted },
  columnContent: { padding: spacing.sm, gap: spacing.sm },
  emptyColumnText: {
    textAlign: 'center',
    padding: spacing.lg,
    color: colors.text.muted,
    fontStyle: 'italic',
  },

  // Card styles
  card: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  priorityLabel: {
    fontSize: 10,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
  cardDescription: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  moveButtonText: { fontSize: 11, fontWeight: '500' },
  deleteButton: {
    padding: spacing.sm,
    marginLeft: 'auto',
  },
  lockToggle: {
    marginLeft: 'auto',
    padding: spacing.xs,
  },

  // Locked/Completed card styles
  lockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.bg.tertiary}50`,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: `${colors.border}50`,
  },
  lockedCardTitle: {
    flex: 1,
    fontSize: 12,
    color: colors.text.muted,
  },
  unlockButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Completed section styles
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.accent.green}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  completedBadgeText: {
    fontSize: 11,
    color: colors.accent.green,
    fontWeight: '500',
  },
  completedSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: `${colors.border}50`,
    backgroundColor: `${colors.bg.tertiary}30`,
    marginHorizontal: -spacing.sm,
    marginBottom: -spacing.sm,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}40`,
  },
  completedHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  completedList: {
    padding: spacing.sm,
    gap: spacing.xs,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary },
  input: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  prioritySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  priorityOptionText: { fontSize: 12, color: colors.text.secondary },
  submitButton: {
    backgroundColor: colors.accent.purple,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.bg.primary,
  },

  // Empty states
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorIcon: { backgroundColor: colors.accent.red + '20' },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
