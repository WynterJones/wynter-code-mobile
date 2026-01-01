import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useProjectStore, useBeadsStore, useConnectionStore } from '@/src/stores';
import { useIssues, useCreateIssue, useUpdateIssue, useCloseIssue } from '@/src/api/hooks';
import { BlueprintGrid } from '@/src/components/BlueprintGrid';
import { GlassButton } from '@/src/components/GlassButton';
import { haptics } from '@/src/lib';
import type { Issue, IssueStatus, IssueType, Priority, CreateIssueInput } from '@/src/types';

type StatusFilter = 'all' | IssueStatus;
type TypeFilter = 'all' | IssueType;

export default function IssuesScreen() {
  const router = useRouter();
  const connection = useConnectionStore((s) => s.connection);
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const { selectedIssue, selectIssue } = useBeadsStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [livePolling, setLivePolling] = useState(false);

  // React Query hooks for data fetching
  const {
    data: issues = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useIssues({ pollingEnabled: livePolling, pollingInterval: 5000 });

  const createIssueMutation = useCreateIssue();
  const updateIssueMutation = useUpdateIssue();
  const closeIssueMutation = useCloseIssue();

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    let result = issues;

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter((i) => i.type === typeFilter);
    }

    return result;
  }, [issues, statusFilter, typeFilter]);

  // Stats
  const openCount = issues.filter((i) => i.status === 'open').length;
  const inProgressCount = issues.filter((i) => i.status === 'in_progress').length;
  const closedCount = issues.filter((i) => i.status === 'closed').length;
  const epicCount = issues.filter((i) => i.type === 'epic').length;

  // Not connected state
  if (!connection.device) {
    return (
      <View style={styles.container}>
        <BlueprintGrid>
          <View style={styles.emptyState}>
            <View style={styles.iconContainer}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.emptyTitle}>Not Connected</Text>
            <Text style={styles.emptyText}>
              Connect to your desktop to manage issues.
            </Text>
            <GlassButton
              onPress={() => router.push('/modal')}
              label="Connect to Desktop"
              icon="qrcode"
              size="large"
            />
          </View>
        </BlueprintGrid>
      </View>
    );
  }

  // No project selected
  if (!selectedProject) {
    return (
      <View style={styles.container}>
        <BlueprintGrid>
          <View style={styles.emptyState}>
            <View style={styles.iconContainerMuted}>
              <FontAwesome name="folder-o" size={48} color={colors.text.muted} />
            </View>
            <Text style={styles.emptyTitle}>No Project Selected</Text>
            <Text style={styles.emptyText}>
              Select a project from the Projects tab to view and manage its issues.
            </Text>
            <GlassButton
              onPress={() => router.push('/')}
              label="Go to Projects"
              icon="folder"
              variant="secondary"
              size="large"
            />
          </View>
        </BlueprintGrid>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.projectBadge}>
            <FontAwesome name="folder-open" size={14} color={colors.accent.purple} />
            <Text style={styles.projectName}>{selectedProject.name}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.purple} />
          <Text style={styles.loadingText}>Loading issues...</Text>
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
        <BlueprintGrid>
          <View style={styles.emptyState}>
            <View style={styles.iconContainerError}>
              <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
            </View>
            <Text style={styles.emptyTitle}>Failed to Load</Text>
            <Text style={styles.emptyText}>
              {error instanceof Error ? error.message : 'Unable to connect to desktop'}
            </Text>
            <GlassButton
              onPress={() => router.push('/modal')}
              label="Check Connection"
              icon="link"
              variant="danger"
              size="large"
            />
          </View>
        </BlueprintGrid>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with project context */}
      <View style={styles.header}>
        <View style={styles.projectBadge}>
          <FontAwesome name="folder-open" size={14} color={colors.accent.purple} />
          <Text style={styles.projectName}>{selectedProject.name}</Text>
        </View>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterSection}>
        {/* Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'open' && styles.filterChipActive]}
            onPress={() => {
              haptics.selectionChanged();
              setStatusFilter('open');
            }}
          >
            <View style={[styles.filterDot, { backgroundColor: colors.status.open }]} />
            <Text style={[styles.filterChipText, statusFilter === 'open' && styles.filterChipTextActive]}>
              Open ({openCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'in_progress' && styles.filterChipActive]}
            onPress={() => {
              haptics.selectionChanged();
              setStatusFilter('in_progress');
            }}
          >
            <View style={[styles.filterDot, { backgroundColor: colors.status.inProgress }]} />
            <Text style={[styles.filterChipText, statusFilter === 'in_progress' && styles.filterChipTextActive]}>
              Active ({inProgressCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'closed' && styles.filterChipActive]}
            onPress={() => {
              haptics.selectionChanged();
              setStatusFilter('closed');
            }}
          >
            <View style={[styles.filterDot, { backgroundColor: colors.status.done }]} />
            <Text style={[styles.filterChipText, statusFilter === 'closed' && styles.filterChipTextActive]}>
              Closed ({closedCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Type Filter & Live Polling Row */}
        <View style={styles.secondaryFilterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeFilterRow}
          >
            <TouchableOpacity
              style={[styles.typeChip, typeFilter === 'all' && styles.typeChipActive]}
              onPress={() => {
                haptics.selectionChanged();
                setTypeFilter('all');
              }}
            >
              <Text style={[styles.typeChipText, typeFilter === 'all' && styles.typeChipTextActive]}>
                All Types
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeChip, typeFilter === 'epic' && styles.typeChipActive]}
              onPress={() => {
                haptics.selectionChanged();
                setTypeFilter('epic');
              }}
            >
              <FontAwesome name="rocket" size={10} color={typeFilter === 'epic' ? colors.accent.purple : colors.text.muted} />
              <Text style={[styles.typeChipText, typeFilter === 'epic' && styles.typeChipTextActive]}>
                Epics ({epicCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeChip, typeFilter === 'bug' && styles.typeChipActive]}
              onPress={() => {
                haptics.selectionChanged();
                setTypeFilter('bug');
              }}
            >
              <FontAwesome name="bug" size={10} color={typeFilter === 'bug' ? colors.accent.red : colors.text.muted} />
              <Text style={[styles.typeChipText, typeFilter === 'bug' && styles.typeChipTextActive]}>
                Bugs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeChip, typeFilter === 'feature' && styles.typeChipActive]}
              onPress={() => {
                haptics.selectionChanged();
                setTypeFilter('feature');
              }}
            >
              <FontAwesome name="star" size={10} color={typeFilter === 'feature' ? colors.accent.green : colors.text.muted} />
              <Text style={[styles.typeChipText, typeFilter === 'feature' && styles.typeChipTextActive]}>
                Features
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeChip, typeFilter === 'task' && styles.typeChipActive]}
              onPress={() => {
                haptics.selectionChanged();
                setTypeFilter('task');
              }}
            >
              <FontAwesome name="check-square-o" size={10} color={typeFilter === 'task' ? colors.accent.blue : colors.text.muted} />
              <Text style={[styles.typeChipText, typeFilter === 'task' && styles.typeChipTextActive]}>
                Tasks
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Live Polling Toggle */}
        <View style={styles.pollingRow}>
          <View style={styles.pollingLabel}>
            <FontAwesome
              name="refresh"
              size={12}
              color={livePolling ? colors.accent.green : colors.text.muted}
            />
            <Text style={[styles.pollingText, livePolling && styles.pollingTextActive]}>
              Live Refresh
            </Text>
            {livePolling && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>ON</Text>
              </View>
            )}
          </View>
          <Switch
            value={livePolling}
            onValueChange={(value) => {
              haptics.selectionChanged();
              setLivePolling(value);
            }}
            trackColor={{ false: colors.bg.tertiary, true: colors.accent.green + '50' }}
            thumbColor={livePolling ? colors.accent.green : colors.text.muted}
          />
        </View>
      </View>

      {/* Issues List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent.purple}
          />
        }
      >
        {filteredIssues.length === 0 ? (
          <View style={styles.emptyList}>
            <FontAwesome name="check-circle" size={32} color={colors.text.muted} />
            <Text style={styles.emptyListText}>
              {statusFilter === 'all' && typeFilter === 'all'
                ? 'No issues yet'
                : `No ${typeFilter !== 'all' ? typeFilter + ' ' : ''}${statusFilter !== 'all' ? statusFilter.replace('_', ' ') + ' ' : ''}issues`}
            </Text>
          </View>
        ) : (
          filteredIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onPress={() => selectIssue(issue)}
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          haptics.mediumTap();
          setShowCreateModal(true);
        }}
      >
        <FontAwesome name="plus" size={20} color={colors.bg.primary} />
      </TouchableOpacity>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => selectIssue(null)}
          onUpdate={(updates) => {
            updateIssueMutation.mutate({ issueId: selectedIssue.id, input: updates });
          }}
          onCloseIssue={(reason) => {
            closeIssueMutation.mutate(
              { issueId: selectedIssue.id, reason },
              { onSuccess: () => selectIssue(null) }
            );
          }}
          isUpdating={updateIssueMutation.isPending || closeIssueMutation.isPending}
        />
      )}

      {/* Create Issue Modal */}
      <CreateIssueModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(input) => {
          createIssueMutation.mutate(input, {
            onSuccess: () => setShowCreateModal(false),
            onError: (err) => {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create issue');
            },
          });
        }}
        isCreating={createIssueMutation.isPending}
      />
    </View>
  );
}

function IssueCard({ issue, onPress }: { issue: Issue; onPress: () => void }) {
  const handlePress = () => {
    haptics.lightTap();
    onPress();
  };
  const statusColors: Record<IssueStatus, string> = {
    open: colors.status.open,
    in_progress: colors.status.inProgress,
    closed: colors.status.done,
  };

  const typeIcons: Record<IssueType, string> = {
    bug: 'bug',
    feature: 'star',
    task: 'check-square-o',
    epic: 'rocket',
  };

  const typeColors: Record<IssueType, string> = {
    bug: colors.accent.red,
    feature: colors.accent.green,
    task: colors.accent.blue,
    epic: colors.accent.purple,
  };

  return (
    <TouchableOpacity style={styles.issueCard} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.issueHeader}>
        <View style={styles.issueHeaderLeft}>
          <View style={[styles.typeIcon, { backgroundColor: (typeColors[issue.type] || colors.accent.blue) + '20' }]}>
            <FontAwesome
              name={(typeIcons[issue.type] || 'circle') as any}
              size={14}
              color={typeColors[issue.type] || colors.accent.blue}
            />
          </View>
          <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
        </View>
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityText}>P{issue.priority}</Text>
        </View>
      </View>
      <View style={styles.issueFooter}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[issue.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[issue.status] }]} />
          <Text style={[styles.statusText, { color: statusColors[issue.status] }]}>
            {issue.status.replace('_', ' ')}
          </Text>
        </View>
        <Text style={styles.issueId}>#{issue.id}</Text>
      </View>
    </TouchableOpacity>
  );
}

function IssueDetailModal({
  issue,
  onClose,
  onUpdate,
  onCloseIssue,
  isUpdating,
}: {
  issue: Issue;
  onClose: () => void;
  onUpdate: (updates: Partial<Issue>) => void;
  onCloseIssue: (reason: string) => void;
  isUpdating: boolean;
}) {
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const statusColors: Record<IssueStatus, string> = {
    open: colors.status.open,
    in_progress: colors.status.inProgress,
    closed: colors.status.done,
  };

  const handleStatusChange = (newStatus: IssueStatus) => {
    if (newStatus === 'closed') {
      setShowCloseDialog(true);
    } else {
      onUpdate({ status: newStatus, updatedAt: new Date().toISOString() });
    }
  };

  const handleClose = () => {
    if (!closeReason.trim()) {
      Alert.alert('Required', 'Please enter a close reason.');
      return;
    }
    onCloseIssue(closeReason.trim());
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <FontAwesome name="chevron-down" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Issue #{issue.id}</Text>
          <View style={styles.modalClose} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Title */}
          <Text style={styles.detailTitle}>{issue.title}</Text>

          {/* Badges */}
          <View style={styles.detailBadges}>
            <View style={[styles.detailBadge, { backgroundColor: statusColors[issue.status] + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors[issue.status] }]} />
              <Text style={[styles.detailBadgeText, { color: statusColors[issue.status] }]}>
                {issue.status.replace('_', ' ')}
              </Text>
            </View>
            <View style={[styles.detailBadge, { backgroundColor: colors.bg.tertiary }]}>
              <Text style={styles.detailBadgeText}>{issue.type}</Text>
            </View>
            <View style={[styles.detailBadge, { backgroundColor: colors.bg.tertiary }]}>
              <Text style={styles.detailBadgeText}>Priority {issue.priority}</Text>
            </View>
          </View>

          {/* Description */}
          {issue.description && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailDescription}>{issue.description}</Text>
            </View>
          )}

          {/* Close Reason (if closed) */}
          {issue.closeReason && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Close Reason</Text>
              <Text style={styles.detailDescription}>{issue.closeReason}</Text>
            </View>
          )}

          {/* Dates */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Timeline</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineItem}>
                <FontAwesome name="plus-circle" size={14} color={colors.accent.green} />
                <Text style={styles.timelineText}>
                  Created {new Date(issue.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.timelineItem}>
                <FontAwesome name="pencil" size={14} color={colors.accent.blue} />
                <Text style={styles.timelineText}>
                  Updated {new Date(issue.updatedAt).toLocaleDateString()}
                </Text>
              </View>
              {issue.closedAt && (
                <View style={styles.timelineItem}>
                  <FontAwesome name="check-circle" size={14} color={colors.status.done} />
                  <Text style={styles.timelineText}>
                    Closed {new Date(issue.closedAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Actions */}
          {issue.status !== 'closed' && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Actions</Text>
              <View style={styles.actionButtons}>
                {issue.status === 'open' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.status.inProgress + '20' }]}
                    onPress={() => handleStatusChange('in_progress')}
                  >
                    <FontAwesome name="play" size={14} color={colors.status.inProgress} />
                    <Text style={[styles.actionButtonText, { color: colors.status.inProgress }]}>
                      Start Working
                    </Text>
                  </TouchableOpacity>
                )}
                {issue.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.status.open + '20' }]}
                    onPress={() => handleStatusChange('open')}
                  >
                    <FontAwesome name="pause" size={14} color={colors.status.open} />
                    <Text style={[styles.actionButtonText, { color: colors.status.open }]}>
                      Pause
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.status.done + '20' }]}
                  onPress={() => handleStatusChange('closed')}
                >
                  <FontAwesome name="check" size={14} color={colors.status.done} />
                  <Text style={[styles.actionButtonText, { color: colors.status.done }]}>
                    Close Issue
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Close Dialog */}
        {showCloseDialog && (
          <View style={styles.closeDialog}>
            <Text style={styles.closeDialogTitle}>Close Issue</Text>
            <Text style={styles.closeDialogLabel}>Reason for closing:</Text>
            <TextInput
              style={styles.closeDialogInput}
              placeholder="What was done?"
              placeholderTextColor={colors.text.muted}
              value={closeReason}
              onChangeText={setCloseReason}
              multiline
            />
            <View style={styles.closeDialogButtons}>
              <TouchableOpacity
                style={styles.closeDialogCancel}
                onPress={() => setShowCloseDialog(false)}
              >
                <Text style={styles.closeDialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeDialogConfirm} onPress={handleClose}>
                <Text style={styles.closeDialogConfirmText}>Close Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function CreateIssueModal({
  visible,
  onClose,
  onCreate,
  isCreating,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreateIssueInput) => void;
  isCreating: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('task');
  const [priority, setPriority] = useState<Priority>(2);

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      priority,
    });
    // Reset form
    setTitle('');
    setDescription('');
    setType('task');
    setPriority(2);
  };

  const typeOptions: { value: IssueType; label: string; icon: string; color: string }[] = [
    { value: 'bug', label: 'Bug', icon: 'bug', color: colors.accent.red },
    { value: 'feature', label: 'Feature', icon: 'star', color: colors.accent.green },
    { value: 'task', label: 'Task', icon: 'check-square-o', color: colors.accent.blue },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Issue</Text>
          <TouchableOpacity
            onPress={handleCreate}
            style={styles.modalClose}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={colors.accent.purple} />
            ) : (
              <Text style={styles.modalCreateText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Title</Text>
            <TextInput
              style={styles.formInput}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.text.muted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMultiline]}
              placeholder="Add more details..."
              placeholderTextColor={colors.text.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Type */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.typeOptions}>
              {typeOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.typeOption,
                    type === opt.value && { backgroundColor: opt.color + '20', borderColor: opt.color },
                  ]}
                  onPress={() => setType(opt.value)}
                >
                  <FontAwesome
                    name={opt.icon as any}
                    size={14}
                    color={type === opt.value ? opt.color : colors.text.muted}
                  />
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === opt.value && { color: opt.color },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.priorityOptions}>
              {[0, 1, 2, 3, 4].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    priority === p && styles.priorityOptionActive,
                  ]}
                  onPress={() => setPriority(p as Priority)}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      priority === p && styles.priorityOptionTextActive,
                    ]}
                  >
                    P{p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
  filterSection: {
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bg.tertiary,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: colors.accent.purple + '20',
    borderColor: colors.accent.purple + '50',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.muted,
  },
  filterChipTextActive: {
    color: colors.accent.purple,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  secondaryFilterRow: {
    marginTop: spacing.sm,
  },
  typeFilterRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bg.tertiary,
    gap: 4,
  },
  typeChipActive: {
    backgroundColor: colors.accent.purple + '15',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.muted,
  },
  typeChipTextActive: {
    color: colors.accent.purple,
  },
  pollingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pollingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pollingText: {
    fontSize: 13,
    color: colors.text.muted,
  },
  pollingTextActive: {
    color: colors.accent.green,
  },
  liveBadge: {
    backgroundColor: colors.accent.green + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent.green,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyList: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyListText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  issueCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  issueHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBadge: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  issueTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 20,
  },
  issueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  issueId: {
    fontSize: 12,
    color: colors.text.muted,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 100,
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
  iconContainerError: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent.red + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconContainerMuted: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalClose: {
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalCancelText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  modalCreateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent.purple,
    textAlign: 'right',
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
    lineHeight: 28,
  },
  detailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  detailBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  detailSection: {
    marginBottom: spacing.xl,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  detailDescription: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  actionButtons: {
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeDialog: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.secondary,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeDialogTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  closeDialogLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  closeDialogInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  closeDialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  closeDialogCancel: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
  },
  closeDialogCancelText: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  closeDialogConfirm: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.green,
  },
  closeDialogConfirmText: {
    fontSize: 15,
    color: colors.bg.primary,
    fontWeight: '600',
  },
  // Form styles
  formGroup: {
    marginBottom: spacing.xl,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  formInput: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.muted,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityOptionActive: {
    backgroundColor: colors.accent.purple + '20',
    borderColor: colors.accent.purple,
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.muted,
  },
  priorityOptionTextActive: {
    color: colors.accent.purple,
  },
});
