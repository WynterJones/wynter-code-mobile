import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useProjectStore, useConnectionStore } from '@/src/stores';

interface FarmworkStats {
  audit_scores: {
    security: AuditMetadata;
    tests: AuditMetadata;
    performance: AuditMetadata;
    accessibility: AuditMetadata;
    code_quality: AuditMetadata;
    farmhouse: AuditMetadata;
  };
  garden_stats: {
    active_ideas: number;
    planted: number;
    growing: number;
    picked: number;
  };
  compost_stats: {
    rejected_ideas: number;
  };
  beads_stats?: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
  };
}

interface AuditMetadata {
  score: number;
  open_items: Array<{ priority: string; text: string }>;
  last_updated?: string;
  status?: string;
}

function ScoreCard({ title, icon, score, color }: { title: string; icon: string; score: number; color: string }) {
  // Score is out of 10, not percentage
  const getScoreColor = (s: number) => {
    if (s >= 8) return colors.accent.green;
    if (s >= 6) return colors.accent.yellow;
    return colors.accent.red;
  };

  return (
    <View style={styles.scoreCard}>
      <View style={[styles.scoreIconContainer, { backgroundColor: color + '20' }]}>
        <FontAwesome name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.scoreTitle}>{title}</Text>
      <Text style={[styles.scoreValue, { color: getScoreColor(score) }]}>
        {score % 1 === 0 ? score.toFixed(0) : score.toFixed(1)}
      </Text>
    </View>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <FontAwesome name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function FarmworkScreen() {
  const connection = useConnectionStore((s) => s.connection);
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (): Promise<FarmworkStats | null> => {
    if (!connection.device || !selectedProject?.path) return null;

    const { host, port, token } = connection.device;
    const params = new URLSearchParams({ project_path: selectedProject.path });
    const url = `http://${host}:${port}/api/v1/farmwork/stats?${params}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  };

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['farmwork-stats', selectedProject?.path],
    queryFn: fetchStats,
    enabled: !!connection.device && !!selectedProject?.path,
    staleTime: 60000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  };

  const openInBrowser = async () => {
    if (!connection.device || !selectedProject?.path) return;

    const { host, port, token } = connection.device;
    const params = new URLSearchParams({
      host,
      port: String(port),
      token,
      project_path: selectedProject.path,
    });

    const url = `http://${host}:${port}/farmwork?${params}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await WebBrowser.openBrowserAsync(url);
  };

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
          <Text style={styles.emptySubtitle}>
            Connect to your desktop to view Farmwork stats
          </Text>
        </View>
      </View>
    );
  }

  // No project selected state
  if (!selectedProject) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <FontAwesome name="folder-open-o" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Project Selected</Text>
          <Text style={styles.emptySubtitle}>
            Select a project from the Home tab to view its Farmwork stats
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.green}
          />
        }
      >
        {/* Project Header */}
        <View style={styles.projectHeader}>
          <FontAwesome name="folder" size={16} color={colors.accent.green} />
          <Text style={styles.projectName} numberOfLines={1}>
            {selectedProject.name}
          </Text>
        </View>

        {isLoading && !stats ? (
          <View style={styles.loadingState}>
            <Text style={styles.loadingText}>Loading Farmwork stats...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorState}>
            <FontAwesome name="exclamation-triangle" size={32} color={colors.accent.red} />
            <Text style={styles.errorText}>Failed to load stats</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : stats ? (
          <>
            {/* Audit Scores */}
            <Text style={styles.sectionTitle}>Audit Scores</Text>
            <View style={styles.scoresGrid}>
              <ScoreCard
                title="Security"
                icon="shield"
                score={stats.audit_scores.security.score}
                color={colors.accent.red}
              />
              <ScoreCard
                title="Tests"
                icon="check-circle"
                score={stats.audit_scores.tests.score}
                color={colors.accent.green}
              />
              <ScoreCard
                title="Performance"
                icon="tachometer"
                score={stats.audit_scores.performance.score}
                color={colors.accent.yellow}
              />
              <ScoreCard
                title="Accessibility"
                icon="universal-access"
                score={stats.audit_scores.accessibility.score}
                color={colors.accent.blue}
              />
              <ScoreCard
                title="Code Quality"
                icon="code"
                score={stats.audit_scores.code_quality.score}
                color={colors.accent.purple}
              />
              <ScoreCard
                title="Farmhouse"
                icon="home"
                score={stats.audit_scores.farmhouse.score}
                color={colors.accent.orange}
              />
            </View>

            {/* Garden Stats */}
            <Text style={styles.sectionTitle}>Idea Garden</Text>
            <View style={styles.statsRow}>
              <StatCard
                label="Ideas"
                value={stats.garden_stats.planted}
                icon="lightbulb-o"
                color={colors.accent.yellow}
              />
              <StatCard
                label="Plans"
                value={stats.garden_stats.growing}
                icon="file-text-o"
                color={colors.accent.purple}
              />
              <StatCard
                label="Compost"
                value={stats.compost_stats.rejected_ideas}
                icon="recycle"
                color={colors.text.muted}
              />
            </View>

            {/* Beads Stats */}
            {stats.beads_stats && (
              <>
                <Text style={styles.sectionTitle}>Issues (Beads)</Text>
                <View style={styles.statsRow}>
                  <StatCard
                    label="Open"
                    value={stats.beads_stats.open}
                    icon="circle-o"
                    color={colors.accent.blue}
                  />
                  <StatCard
                    label="In Progress"
                    value={stats.beads_stats.in_progress}
                    icon="spinner"
                    color={colors.accent.yellow}
                  />
                  <StatCard
                    label="Closed"
                    value={stats.beads_stats.closed}
                    icon="check-circle"
                    color={colors.accent.green}
                  />
                </View>
              </>
            )}
          </>
        ) : null}

        {/* Open Full View Button */}
        <TouchableOpacity style={styles.openButton} onPress={openInBrowser}>
          <FontAwesome name="external-link" size={16} color={colors.bg.primary} />
          <Text style={styles.openButtonText}>Open Full Visualizer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
  },
  projectName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scoreCard: {
    width: '31%',
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  scoreIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  scoreTitle: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.green,
    borderRadius: borderRadius.md,
  },
  openButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.bg.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  errorText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
