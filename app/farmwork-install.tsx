import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore, useProjectStore } from '@/src/stores';
import { createTerminal, writeTerminal, queryKeys } from '@/src/api/client';
import { wsManager, TerminalOutputUpdate } from '@/src/api/websocket';
import { XTermWebView } from '@/src/components/XTermWebView';

type InstallStatus = 'idle' | 'running' | 'success' | 'error';

export default function FarmworkInstallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const isConnected = connection.status === 'connected';

  const [status, setStatus] = useState<InstallStatus>('idle');
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);

  // Listen for completion indicators from terminal output
  useEffect(() => {
    if (!ptyId) return;

    const unsubscribe = wsManager.addHandler((update) => {
      if (update.type === 'TerminalOutput' && (update as TerminalOutputUpdate).pty_id === ptyId) {
        const data = (update as TerminalOutputUpdate).data;

        // Check for completion indicators
        if (data.includes('Farmwork initialized') || data.includes('.farmwork.json created')) {
          setStatus('success');
          // Invalidate farmwork check query to update menu
          if (selectedProject?.path) {
            queryClient.invalidateQueries({ queryKey: queryKeys.farmworkCheck(selectedProject.path) });
          }
        } else if (data.includes('Error:') || data.includes('error:')) {
          setStatus('error');
        }
      }
    });

    return unsubscribe;
  }, [ptyId, selectedProject?.path, queryClient]);

  // Handle terminal ready - run farmwork init
  const handleTerminalReady = useCallback(async () => {
    setTerminalReady(true);
    // Small delay to ensure terminal is fully ready
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (ptyId) {
      await writeTerminal(ptyId, 'farmwork init\n');
    }
  }, [ptyId]);

  const handleInstall = useCallback(async () => {
    if (!selectedProject?.path) return;

    setStatus('running');
    setTerminalReady(false);

    try {
      // Create a terminal session in the project directory
      const result = await createTerminal({
        cwd: selectedProject.path,
        cols: 80,
        rows: 24,
      });

      setPtyId(result.pty_id);
      // The terminal will auto-run farmwork init when ready via handleTerminalReady
    } catch (error) {
      console.error('Failed to start farmwork init:', error);
      setStatus('error');
    }
  }, [selectedProject?.path]);

  const handleGoToFarmwork = useCallback(() => {
    router.replace('/farmwork');
  }, [router]);

  const handleRetry = useCallback(() => {
    setStatus('idle');
    setPtyId(null);
    setTerminalReady(false);
  }, []);

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
            Connect to your desktop to install Farmwork
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
          <View style={styles.emptyIcon}>
            <FontAwesome name="folder-open-o" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Project Selected</Text>
          <Text style={styles.emptySubtitle}>
            Select a project from the Home tab to install Farmwork
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors.accent.green}20` }]}>
            <FontAwesome name="leaf" size={32} color={colors.accent.green} />
          </View>
          <Text style={styles.title}>Install Farmwork</Text>
          <Text style={styles.subtitle}>
            Set up Farmwork for audit tracking, idea management, and project health metrics
          </Text>
        </View>

        {/* Project Info */}
        <View style={styles.projectCard}>
          <FontAwesome name="folder" size={16} color={colors.accent.purple} />
          <View style={styles.projectInfo}>
            <Text style={styles.projectName}>{selectedProject.name}</Text>
            <Text style={styles.projectPath} numberOfLines={1}>
              {selectedProject.path}
            </Text>
          </View>
        </View>

        {/* Features List */}
        {status === 'idle' && (
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>What Farmwork Provides</Text>
            <View style={styles.featuresList}>
              <FeatureItem
                icon="shield"
                title="Audit Tracking"
                description="Track security, tests, performance, and accessibility scores"
              />
              <FeatureItem
                icon="lightbulb-o"
                title="Idea Garden"
                description="Manage project ideas from conception to implementation"
              />
              <FeatureItem
                icon="check-circle"
                title="Health Metrics"
                description="Monitor code quality and project health over time"
              />
              <FeatureItem
                icon="line-chart"
                title="Progress Visualization"
                description="View your project's progress with visual dashboards"
              />
            </View>
          </View>
        )}

        {/* Terminal - Full XTerm emulator */}
        {(status === 'running' || status === 'success' || status === 'error') && ptyId && (
          <View style={styles.terminalSection}>
            <Text style={styles.sectionTitle}>Terminal</Text>
            <View style={styles.terminalContainer}>
              <XTermWebView
                ptyId={ptyId}
                onReady={handleTerminalReady}
                style={styles.terminal}
              />
            </View>
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actionSection}>
          {status === 'idle' && (
            <TouchableOpacity style={styles.installButton} onPress={handleInstall}>
              <FontAwesome name="terminal" size={18} color={colors.bg.primary} />
              <Text style={styles.installButtonText}>Run farmwork init</Text>
            </TouchableOpacity>
          )}

          {status === 'running' && (
            <View style={styles.runningIndicator}>
              <ActivityIndicator size="small" color={colors.accent.green} />
              <Text style={styles.runningText}>Installing Farmwork...</Text>
            </View>
          )}

          {status === 'success' && (
            <>
              <View style={styles.successIndicator}>
                <FontAwesome name="check-circle" size={24} color={colors.accent.green} />
                <Text style={styles.successText}>Farmwork Installed!</Text>
              </View>
              <TouchableOpacity style={styles.continueButton} onPress={handleGoToFarmwork}>
                <Text style={styles.continueButtonText}>Open Farmwork</Text>
                <FontAwesome name="arrow-right" size={14} color={colors.bg.primary} />
              </TouchableOpacity>
            </>
          )}

          {status === 'error' && (
            <>
              <View style={styles.errorIndicator}>
                <FontAwesome name="times-circle" size={24} color={colors.accent.red} />
                <Text style={styles.errorText}>Installation Failed</Text>
              </View>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <FontAwesome name="refresh" size={14} color={colors.text.primary} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <FontAwesome name="info-circle" size={14} color={colors.text.muted} />
          <Text style={styles.infoNoteText}>
            This will run farmwork init and guide you through the CLI installation process.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: `${colors.accent.green}15` }]}>
        <FontAwesome name={icon as any} size={16} color={colors.accent.green} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  projectPath: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  featuresSection: {
    marginBottom: spacing.xl,
  },
  featuresList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: colors.text.muted,
    lineHeight: 18,
  },
  terminalSection: {
    marginBottom: spacing.lg,
  },
  terminalContainer: {
    height: 300,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  terminal: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
  },
  actionSection: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.green,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  installButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bg.primary,
  },
  runningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.accent.green}20`,
    borderRadius: borderRadius.md,
  },
  runningText: {
    fontSize: 14,
    color: colors.accent.green,
    fontWeight: '500',
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.accent.green}20`,
    borderRadius: borderRadius.md,
  },
  successText: {
    fontSize: 16,
    color: colors.accent.green,
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  continueButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.bg.primary,
  },
  errorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.accent.red}20`,
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontSize: 16,
    color: colors.accent.red,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
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
