import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
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
} from '@/src/api/hooks';
import type { Worker, QueueItem, LogEntry, AutoBuildStatus } from '@/src/types';

export default function AutoBuildScreen() {
  const router = useRouter();
  const connection = useConnectionStore((s) => s.connection);
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const buildState = useAutoBuildStore((s) => s.state);

  // Query hook for initial data load and WebSocket subscription
  const { refetch, isLoading, isRefetching } = useAutoBuildStatus();

  // Mutation hooks for controls
  const startMutation = useStartAutoBuild();
  const pauseMutation = usePauseAutoBuild();
  const stopMutation = useStopAutoBuild();

  const isControlLoading = startMutation.isPending || pauseMutation.isPending || stopMutation.isPending;

  // Controls
  const handleStart = () => startMutation.mutate();
  const handlePause = () => pauseMutation.mutate();
  const handleStop = () => stopMutation.mutate();

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Not connected state
  if (!connection.device) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <FontAwesome name="plug" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptyText}>
            Connect to your desktop to monitor auto-build.
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
            Select a project from the Projects tab to monitor its auto-build status.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
            <FontAwesome name="folder" size={16} color={colors.bg.primary} />
            <Text style={styles.buttonText}>Go to Projects</Text>
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
                  {buildState.currentPhase.replace(/([A-Z])/g, ' $1').trim()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.queueCount}>
            {buildState.queue.length} items in queue
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

        {/* Workers */}
        <Text style={styles.sectionTitle}>Workers</Text>
        {isLoading ? (
          <View style={styles.emptySection}>
            <ActivityIndicator size="small" color={colors.accent.purple} />
          </View>
        ) : buildState.workers.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No active workers</Text>
          </View>
        ) : (
          buildState.workers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))
        )}

        {/* Queue */}
        <Text style={styles.sectionTitle}>Queue ({buildState.queue.length})</Text>
        {buildState.queue.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>Queue is empty</Text>
          </View>
        ) : (
          buildState.queue.map((item, index) => (
            <QueueItemCard key={item.id} item={item} position={index + 1} />
          ))
        )}

        {/* Recent Logs */}
        <Text style={styles.sectionTitle}>Recent Logs</Text>
        <View style={styles.logsCard}>
          {isLoading ? (
            <View style={styles.emptySection}>
              <ActivityIndicator size="small" color={colors.accent.purple} />
            </View>
          ) : buildState.logs.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No logs yet</Text>
            </View>
          ) : (
            buildState.logs.map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function WorkerCard({ worker }: { worker: Worker }) {
  const statusConfig = {
    idle: { color: colors.text.muted, icon: 'moon-o', label: 'Idle' },
    working: { color: colors.accent.green, icon: 'bolt', label: 'Working' },
    error: { color: colors.accent.red, icon: 'exclamation-triangle', label: 'Error' },
    paused: { color: colors.accent.yellow, icon: 'pause', label: 'Paused' },
  };

  const config = statusConfig[worker.status];

  return (
    <View style={styles.workerCard}>
      <View style={styles.workerHeader}>
        <View style={[styles.workerIcon, { backgroundColor: config.color + '20' }]}>
          <FontAwesome name={config.icon as any} size={16} color={config.color} />
        </View>
        <View style={styles.workerInfo}>
          <Text style={styles.workerName}>{worker.name}</Text>
          <Text style={[styles.workerStatus, { color: config.color }]}>{config.label}</Text>
        </View>
        {worker.progress !== undefined && (
          <Text style={styles.workerProgress}>{worker.progress}%</Text>
        )}
      </View>
      {worker.currentTask && (
        <View style={styles.workerTask}>
          <Text style={styles.workerTaskText} numberOfLines={1}>
            {worker.currentTask}
          </Text>
        </View>
      )}
      {worker.progress !== undefined && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${worker.progress}%` }]} />
        </View>
      )}
    </View>
  );
}

function QueueItemCard({ item, position }: { item: QueueItem; position: number }) {
  return (
    <View style={styles.queueItem}>
      <View style={styles.queuePosition}>
        <Text style={styles.queuePositionText}>{position}</Text>
      </View>
      <View style={styles.queueContent}>
        <Text style={styles.queueText} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.queueMeta}>
          Added {formatTime(item.createdAt)}
        </Text>
      </View>
      <View style={[styles.queueStatusBadge, { backgroundColor: colors.accent.blue + '20' }]}>
        <Text style={[styles.queueStatusText, { color: colors.accent.blue }]}>
          {item.status}
        </Text>
      </View>
    </View>
  );
}

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
    paddingBottom: spacing.xxl,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  emptySection: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  workerCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workerIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  workerStatus: {
    fontSize: 13,
  },
  workerProgress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent.green,
  },
  workerTask: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  workerTaskText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.green,
    borderRadius: 2,
  },
  queueItem: {
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
  queuePosition: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuePositionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  queueContent: {
    flex: 1,
  },
  queueText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  queueMeta: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  queueStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  queueStatusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
