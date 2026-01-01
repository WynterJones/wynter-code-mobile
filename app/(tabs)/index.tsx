import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useConnectionStore, useProjectStore } from '@/src/stores';
import { useWorkspaces } from '@/src/api/hooks';
import { BlueprintGrid } from '@/src/components/BlueprintGrid';
import { GlassButton } from '@/src/components/GlassButton';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import type { Workspace, Project } from '@/src/types';

function ProjectsScreenContent() {
  const router = useRouter();
  const connection = useConnectionStore((s) => s.connection);
  const { selectedProject, setWorkspaces, selectProject } = useProjectStore();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());

  // React Query hook for fetching workspaces (already deduplicated in hook)
  const {
    data: workspaces = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useWorkspaces();

  // Sync workspaces to store for other components
  useEffect(() => {
    if (workspaces.length > 0) {
      setWorkspaces(workspaces);
      // Auto-expand all workspaces initially
      setExpandedWorkspaces(new Set(workspaces.map(ws => ws.id)));
    }
  }, [workspaces, setWorkspaces]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Toggle workspace expansion
  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select project
  const handleSelectProject = (project: Project) => {
    selectProject(project);
  };

  // Get project counts
  const totalProjects = useMemo(() => {
    return workspaces.reduce((sum, ws) => sum + ws.projects.length, 0);
  }, [workspaces]);

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
              Connect to your wynter-code desktop to view and manage your projects.
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

  // Error state
  if (isError) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.connectionBadge} onPress={() => router.push('/modal')}>
              <View style={styles.connectionDot} />
              <Text style={styles.connectionText}>Connection</Text>
            </TouchableOpacity>
          </View>
        </View>
        <BlueprintGrid>
          <View style={styles.emptyState}>
            <View style={styles.iconContainerError}>
              <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
            </View>
            <Text style={styles.emptyTitle}>Failed to Load</Text>
            <Text style={styles.emptyText}>
              {error instanceof Error ? error.message : 'Unable to fetch workspaces'}
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.connectionBadge} onPress={() => router.push('/modal')}>
            <View style={styles.connectionDot} />
            <Text style={styles.connectionText}>Connection</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Project Banner */}
        {selectedProject ? (
          <TouchableOpacity
            style={styles.selectedBanner}
            onPress={() => selectProject(null)}
          >
            <View style={styles.selectedIcon}>
              <FontAwesome name="folder-open" size={16} color={colors.accent.purple} />
            </View>
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedLabel}>Active Project</Text>
              <Text style={styles.selectedName}>{selectedProject.name}</Text>
            </View>
            <FontAwesome name="times-circle" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        ) : workspaces.length > 0 ? (
          <View style={styles.selectBanner}>
            <FontAwesome name="hand-pointer-o" size={16} color={colors.accent.orange} />
            <Text style={styles.selectBannerText}>Select a project to continue</Text>
          </View>
        ) : null}
      </View>

      {/* Content */}
      {isLoading && workspaces.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.purple} />
          <Text style={styles.loadingText}>Loading workspaces...</Text>
        </View>
      ) : (
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
          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{workspaces.length}</Text>
              <Text style={styles.statLabel}>Workspaces</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalProjects}</Text>
              <Text style={styles.statLabel}>Projects</Text>
            </View>
          </View>

          {/* Workspaces */}
          {workspaces.map((workspace) => (
            <WorkspaceSection
              key={workspace.id}
              workspace={workspace}
              isExpanded={expandedWorkspaces.has(workspace.id)}
              onToggle={() => toggleWorkspace(workspace.id)}
              selectedProjectId={selectedProject?.id}
              onSelectProject={handleSelectProject}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

interface WorkspaceSectionProps {
  workspace: Workspace;
  isExpanded: boolean;
  onToggle: () => void;
  selectedProjectId?: string;
  onSelectProject: (project: Project) => void;
}

function WorkspaceSection({
  workspace,
  isExpanded,
  onToggle,
  selectedProjectId,
  onSelectProject,
}: WorkspaceSectionProps) {
  return (
    <View style={styles.workspaceSection}>
      <TouchableOpacity style={styles.workspaceHeader} onPress={onToggle}>
        <View style={styles.workspaceIcon}>
          <FontAwesome
            name={isExpanded ? 'folder-open' : 'folder'}
            size={18}
            color={colors.accent.blue}
          />
        </View>
        <View style={styles.workspaceInfo}>
          <Text style={styles.workspaceName}>{workspace.name}</Text>
          <Text style={styles.workspacePath}>{workspace.path}</Text>
        </View>
        <View style={styles.workspaceCount}>
          <Text style={styles.workspaceCountText}>{workspace.projects.length}</Text>
        </View>
        <FontAwesome
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.projectList}>
          {workspace.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isSelected={project.id === selectedProjectId}
              onSelect={() => onSelectProject(project)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
}

function ProjectCard({ project, isSelected, onSelect }: ProjectCardProps) {
  return (
    <TouchableOpacity
      style={[styles.projectCard, isSelected && styles.projectCardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.projectIconContainer}>
        <FontAwesome
          name={isSelected ? 'check-circle' : 'code'}
          size={16}
          color={isSelected ? colors.accent.green : colors.accent.cyan}
        />
      </View>
      <View style={styles.projectInfo}>
        <Text style={[styles.projectName, isSelected && styles.projectNameSelected]}>
          {project.name}
        </Text>
        <Text style={styles.projectPath}>{project.path}</Text>
      </View>
      {project.lastOpened && (
        <Text style={styles.projectMeta}>
          {formatRelativeDate(project.lastOpened)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.green,
  },
  connectionText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple + '15',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purple + '30',
  },
  selectedIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.purple + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedInfo: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 11,
    color: colors.accent.purple,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedName: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
  },
  selectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.orange + '15',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent.orange + '30',
  },
  selectBannerText: {
    fontSize: 14,
    color: colors.accent.orange,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
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
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  workspaceSection: {
    marginBottom: spacing.lg,
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  workspaceIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.blue + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceInfo: {
    flex: 1,
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  workspacePath: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  workspaceCount: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  workspaceCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  projectList: {
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  projectCardSelected: {
    backgroundColor: colors.accent.green + '15',
    borderWidth: 1,
    borderColor: colors.accent.green + '30',
  },
  projectIconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  projectNameSelected: {
    color: colors.accent.green,
  },
  projectPath: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 1,
  },
  projectMeta: {
    fontSize: 11,
    color: colors.text.muted,
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
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  connectButtonText: {
    color: colors.bg.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function ProjectsScreen() {
  return (
    <ScreenErrorBoundary screenName="Projects" showGoBack={false}>
      <ProjectsScreenContent />
    </ScreenErrorBoundary>
  );
}
