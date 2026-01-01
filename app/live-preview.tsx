import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore, useProjectStore } from '@/src/stores';
import {
  detectPreviewProject,
  startPreview,
  stopPreview,
  fetchPreviewList,
  checkTunnel,
  startTunnel,
  stopTunnel,
  fetchTunnelList,
  queryKeys,
} from '@/src/api/client';
import type { PreviewServer, TunnelInfo, PreviewDetectResult } from '@/src/types';

const STATUS_COLORS: Record<string, string> = {
  running: colors.accent.green,
  starting: colors.accent.yellow,
  stopping: colors.accent.yellow,
  stopped: colors.text.muted,
  error: colors.accent.red,
};

function PreviewServerCard({
  server,
  tunnel,
  onStop,
  onStartTunnel,
  onStopTunnel,
  isStoppingServer,
  isStartingTunnel,
  isStoppingTunnel,
}: {
  server: PreviewServer;
  tunnel?: TunnelInfo;
  onStop: () => void;
  onStartTunnel: () => void;
  onStopTunnel: () => void;
  isStoppingServer: boolean;
  isStartingTunnel: boolean;
  isStoppingTunnel: boolean;
}) {
  const isRunning = server.status === 'running';
  const hasTunnel = tunnel && tunnel.url;

  const handleOpenLocal = () => {
    if (server.url) {
      Linking.openURL(server.url);
    }
  };

  const handleOpenTunnel = () => {
    if (tunnel?.url) {
      Linking.openURL(tunnel.url);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.accent.green}20` }]}>
          <FontAwesome name="play-circle" size={20} color={colors.accent.green} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{server.projectType}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[server.status] }]} />
            <Text style={[styles.statusLabel, { color: STATUS_COLORS[server.status] }]}>
              {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.stopButton, isStoppingServer && styles.buttonDisabled]}
          onPress={onStop}
          disabled={isStoppingServer}
        >
          {isStoppingServer ? (
            <ActivityIndicator size="small" color={colors.accent.red} />
          ) : (
            <FontAwesome name="stop" size={14} color={colors.accent.red} />
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Local URL */}
        <TouchableOpacity style={styles.urlRow} onPress={handleOpenLocal}>
          <FontAwesome name="laptop" size={14} color={colors.text.muted} />
          <Text style={styles.urlText} numberOfLines={1}>
            {server.url}
          </Text>
          <FontAwesome name="external-link" size={12} color={colors.text.muted} />
        </TouchableOpacity>

        {/* Tunnel URL */}
        {hasTunnel && (
          <TouchableOpacity style={styles.urlRow} onPress={handleOpenTunnel}>
            <FontAwesome name="globe" size={14} color={colors.accent.cyan} />
            <Text style={[styles.urlText, { color: colors.accent.cyan }]} numberOfLines={1}>
              {tunnel.url}
            </Text>
            <FontAwesome name="external-link" size={12} color={colors.accent.cyan} />
          </TouchableOpacity>
        )}

        {/* Port Info */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Port</Text>
          <Text style={styles.infoValue}>{server.port}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Project</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {server.projectPath.split('/').pop()}
          </Text>
        </View>
      </View>

      {/* Tunnel Actions */}
      <View style={styles.cardFooter}>
        {hasTunnel ? (
          <TouchableOpacity
            style={[styles.tunnelButton, styles.tunnelButtonActive]}
            onPress={onStopTunnel}
            disabled={isStoppingTunnel}
          >
            {isStoppingTunnel ? (
              <ActivityIndicator size="small" color={colors.accent.cyan} />
            ) : (
              <>
                <FontAwesome name="globe" size={14} color={colors.accent.cyan} />
                <Text style={styles.tunnelButtonTextActive}>Tunnel Active</Text>
                <FontAwesome name="times" size={12} color={colors.accent.cyan} />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.tunnelButton}
            onPress={onStartTunnel}
            disabled={isStartingTunnel || !isRunning}
          >
            {isStartingTunnel ? (
              <ActivityIndicator size="small" color={colors.text.muted} />
            ) : (
              <>
                <FontAwesome name="globe" size={14} color={colors.text.muted} />
                <Text style={styles.tunnelButtonText}>Start Public Tunnel</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function LivePreviewScreen() {
  const connection = useConnectionStore((s) => s.connection);
  const isConnected = connection.status === 'connected';
  const activeProject = useProjectStore((s) => s.selectedProject);
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch preview detection for current project
  const { data: detection, isLoading: isDetecting } = useQuery({
    queryKey: queryKeys.previewDetect(activeProject?.path || ''),
    queryFn: () => detectPreviewProject(activeProject!.path),
    enabled: isConnected && !!activeProject?.path,
  });

  // Fetch active preview servers
  const { data: servers, isLoading: isLoadingServers, refetch: refetchServers } = useQuery({
    queryKey: queryKeys.previewList,
    queryFn: fetchPreviewList,
    enabled: isConnected,
    refetchInterval: 5000,
  });

  // Fetch tunnel status
  const { data: tunnelCheck } = useQuery({
    queryKey: queryKeys.tunnelCheck,
    queryFn: checkTunnel,
    enabled: isConnected,
  });

  // Fetch active tunnels
  const { data: tunnels, refetch: refetchTunnels } = useQuery({
    queryKey: queryKeys.tunnelList,
    queryFn: fetchTunnelList,
    enabled: isConnected,
    refetchInterval: 5000,
  });

  // Start preview mutation
  const startMutation = useMutation({
    mutationFn: startPreview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.previewList });
    },
  });

  // Stop preview mutation
  const stopMutation = useMutation({
    mutationFn: stopPreview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.previewList });
    },
  });

  // Start tunnel mutation
  const startTunnelMutation = useMutation({
    mutationFn: startTunnel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tunnelList });
    },
  });

  // Stop tunnel mutation
  const stopTunnelMutation = useMutation({
    mutationFn: stopTunnel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tunnelList });
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchServers(), refetchTunnels()]);
    setRefreshing(false);
  };

  const handleStartPreview = () => {
    if (!activeProject) return;
    const isStaticSite = detection?.framework === 'Static Site';
    startMutation.mutate({
      projectPath: activeProject.path,
      port: detection?.devPort || undefined,
      useFrameworkServer: !isStaticSite, // Use static server for static sites
    });
  };

  const handleStopPreview = (serverId: string) => {
    stopMutation.mutate(serverId);
  };

  const handleStartTunnel = (port: number) => {
    startTunnelMutation.mutate(port);
  };

  const handleStopTunnel = (tunnelId: string) => {
    stopTunnelMutation.mutate(tunnelId);
  };

  // Find tunnel for a server
  const findTunnelForServer = (server: PreviewServer): TunnelInfo | undefined => {
    return tunnels?.find((t) => t.port === server.port);
  };

  // Check if there's a server running for the active project
  const activeServerForProject = servers?.find(
    (s) => s.projectPath === activeProject?.path && s.status === 'running'
  );

  // Not connected
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="plug" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptySubtitle}>
            Connect to your desktop to use Live Preview
          </Text>
        </View>
      </View>
    );
  }

  // No active project
  if (!activeProject) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="folder-open-o" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Project Selected</Text>
          <Text style={styles.emptySubtitle}>
            Select a project to start a Live Preview
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
            tintColor={colors.accent.purple}
          />
        }
      >
        {/* Current Project Detection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Project</Text>
          <View style={styles.detectionCard}>
            <View style={styles.detectionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.accent.purple}20` }]}>
                <FontAwesome name="folder" size={18} color={colors.accent.purple} />
              </View>
              <View style={styles.detectionInfo}>
                <Text style={styles.projectName}>{activeProject.name}</Text>
                {isDetecting ? (
                  <Text style={styles.detectionStatus}>Detecting framework...</Text>
                ) : detection?.framework ? (
                  <Text style={styles.detectionStatus}>
                    {detection.framework}{detection.devPort ? ` • Port ${detection.devPort}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.detectionStatus}>No framework or index.html detected</Text>
                )}
              </View>
            </View>

            {detection?.startCommand && (
              <View style={styles.commandPreview}>
                <Text style={styles.commandLabel}>Command</Text>
                <Text style={styles.commandText}>{detection.startCommand}</Text>
              </View>
            )}

            {!activeServerForProject ? (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  (!detection?.framework || startMutation.isPending) && styles.buttonDisabled,
                ]}
                onPress={handleStartPreview}
                disabled={!detection?.framework || startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.bg.primary} />
                ) : (
                  <>
                    <FontAwesome name="play" size={16} color={colors.bg.primary} />
                    <Text style={styles.startButtonText}>
                      {detection?.framework === 'Static Site' ? 'Start Static Server' : 'Start Dev Server'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.runningBadge}>
                <FontAwesome name="check-circle" size={14} color={colors.accent.green} />
                <Text style={styles.runningBadgeText}>Server Running</Text>
              </View>
            )}
          </View>
        </View>

        {/* Active Servers */}
        {servers && servers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Servers</Text>
            {servers.map((server) => (
              <PreviewServerCard
                key={server.serverId}
                server={server}
                tunnel={findTunnelForServer(server)}
                onStop={() => handleStopPreview(server.serverId)}
                onStartTunnel={() => handleStartTunnel(server.port)}
                onStopTunnel={() => {
                  const tunnel = findTunnelForServer(server);
                  if (tunnel) handleStopTunnel(tunnel.tunnelId);
                }}
                isStoppingServer={stopMutation.isPending}
                isStartingTunnel={startTunnelMutation.isPending}
                isStoppingTunnel={stopTunnelMutation.isPending}
              />
            ))}
          </View>
        )}

        {/* Tunnel Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tunnel Status</Text>
          <View style={styles.tunnelStatusCard}>
            <FontAwesome
              name={tunnelCheck?.installed ? 'check-circle' : 'times-circle'}
              size={18}
              color={tunnelCheck?.installed ? colors.accent.green : colors.accent.red}
            />
            <Text style={styles.tunnelStatusText}>
              {tunnelCheck?.installed
                ? `Cloudflared ${tunnelCheck.version || 'installed'}`
                : 'Cloudflared not installed'}
            </Text>
          </View>
          {!tunnelCheck?.installed && (
            <Text style={styles.tunnelHint}>
              Install cloudflared to create public tunnels for your dev server
            </Text>
          )}
        </View>
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.accent.red}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.text.muted,
  },
  infoValue: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  cardFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tunnelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
  },
  tunnelButtonActive: {
    backgroundColor: `${colors.accent.cyan}20`,
  },
  tunnelButtonText: {
    fontSize: 13,
    color: colors.text.muted,
    fontWeight: '500',
  },
  tunnelButtonTextActive: {
    fontSize: 13,
    color: colors.accent.cyan,
    fontWeight: '500',
    flex: 1,
  },
  detectionCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  detectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detectionInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  detectionStatus: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  commandPreview: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  commandLabel: {
    fontSize: 10,
    color: colors.text.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  commandText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.purple,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.bg.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  runningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.accent.green}20`,
  },
  runningBadgeText: {
    fontSize: 13,
    color: colors.accent.green,
    fontWeight: '500',
  },
  tunnelStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tunnelStatusText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  tunnelHint: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
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
});
