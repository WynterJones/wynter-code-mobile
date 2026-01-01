import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
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
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import { IssueCard, IssueDetailModal, CreateIssueModal } from '@/src/components/issues';
import { haptics } from '@/src/lib';
import type { IssueStatus, IssueType } from '@/src/types';

type StatusFilter = 'all' | IssueStatus;
type TypeFilter = 'all' | IssueType;

function IssuesScreenContent() {
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

  // Stats - memoized to avoid recalculating on every render
  const { openCount, inProgressCount, closedCount, epicCount } = useMemo(() => ({
    openCount: issues.filter((i) => i.status === 'open').length,
    inProgressCount: issues.filter((i) => i.status === 'in_progress').length,
    closedCount: issues.filter((i) => i.status === 'closed').length,
    epicCount: issues.filter((i) => i.type === 'epic').length,
  }), [issues]);

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
        <BlueprintGrid>
          <View style={styles.emptyState}>
            <View style={styles.iconContainerWarning}>
              <FontAwesome name="puzzle-piece" size={48} color={colors.accent.orange} />
            </View>
            <Text style={styles.emptyTitle}>Issue Tracking Not Available</Text>
            <Text style={styles.emptyText}>
              You don't have Beads issue tracking installed for this project. Install Beads from Wynter Code desktop to enable issue management.
            </Text>
            <GlassButton
              onPress={() => router.push('/')}
              label="Back to Projects"
              icon="arrow-left"
              variant="secondary"
              size="large"
            />
          </View>
        </BlueprintGrid>
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
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filteredIssues}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            onPress={() => selectIssue(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <FontAwesome name="check-circle" size={32} color={colors.text.muted} />
            <Text style={styles.emptyListText}>
              {statusFilter === 'all' && typeFilter === 'all'
                ? 'No issues yet'
                : `No ${typeFilter !== 'all' ? typeFilter + ' ' : ''}${statusFilter !== 'all' ? statusFilter.replace('_', ' ') + ' ' : ''}issues`}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent.purple}
          />
        }
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />

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
  iconContainerWarning: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent.orange + '15',
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
});

export default function IssuesScreen() {
  return (
    <ScreenErrorBoundary screenName="Issues" showGoBack={false}>
      <IssuesScreenContent />
    </ScreenErrorBoundary>
  );
}
