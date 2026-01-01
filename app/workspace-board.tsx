import { useState, useCallback, useEffect, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import {
  fetchWorkspaces,
  fetchProjects,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  createProject,
  updateProject,
  queryKeys,
} from '@/src/api/client';
import type { Workspace, Project } from '@/src/types';

// Color palette for workspaces/projects
const COLORS = [
  '#cba6f7', // Purple (Mauve)
  '#89b4fa', // Blue
  '#a6e3a1', // Green
  '#f9e2af', // Yellow
  '#fab387', // Orange (Peach)
  '#f38ba8', // Red/Pink
  '#94e2d5', // Teal
  '#cdd6f4', // White/Light
];

interface WorkspaceWithProjects extends Workspace {
  projects: Project[];
  isLoading: boolean;
}

// Color Picker Component
function ColorPicker({
  selectedColor,
  onSelectColor,
}: {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}) {
  return (
    <View style={styles.colorPicker}>
      {COLORS.map((color) => (
        <TouchableOpacity
          key={color}
          style={[
            styles.colorOption,
            { backgroundColor: color },
            selectedColor === color && styles.colorOptionSelected,
          ]}
          onPress={() => onSelectColor(color)}
        >
          {selectedColor === color && (
            <FontAwesome name="check" size={14} color="#1e1e2e" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Workspace Modal for Create/Edit
function WorkspaceModal({
  visible,
  workspace,
  onClose,
  onSave,
  isLoading,
}: {
  visible: boolean;
  workspace?: Workspace | null;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  // Reset state when modal opens/closes or workspace changes
  useEffect(() => {
    if (visible) {
      setName(workspace?.name || '');
      setColor(workspace?.color || COLORS[0]);
    }
  }, [visible, workspace]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Workspace name is required');
      return;
    }
    onSave(name.trim(), color);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {workspace ? 'Edit Workspace' : 'New Workspace'}
          </Text>

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Workspace name"
            placeholderTextColor={colors.text.muted}
            autoFocus
          />

          <Text style={styles.inputLabel}>Color</Text>
          <ColorPicker selectedColor={color} onSelectColor={setColor} />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#1e1e2e" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {workspace ? 'Save' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Project Modal for Create/Edit
function ProjectModal({
  visible,
  project,
  onClose,
  onSave,
  isLoading,
}: {
  visible: boolean;
  project?: Project | null;
  onClose: () => void;
  onSave: (name: string, path: string, color?: string) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [color, setColor] = useState('');

  // Reset state when modal opens/closes or project changes
  useEffect(() => {
    if (visible) {
      setName(project?.name || '');
      setPath(project?.path || '');
      setColor(project?.color || '');
    }
  }, [visible, project]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Project name is required');
      return;
    }
    if (!path.trim() && !project) {
      Alert.alert('Error', 'Project path is required');
      return;
    }
    onSave(name.trim(), path.trim(), color || undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {project ? 'Edit Project' : 'New Project'}
          </Text>

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Project name"
            placeholderTextColor={colors.text.muted}
            autoFocus
          />

          {!project && (
            <>
              <Text style={styles.inputLabel}>Path</Text>
              <TextInput
                style={styles.textInput}
                value={path}
                onChangeText={setPath}
                placeholder="/path/to/project"
                placeholderTextColor={colors.text.muted}
              />
            </>
          )}

          <Text style={styles.inputLabel}>Color (optional)</Text>
          <ColorPicker
            selectedColor={color || COLORS[0]}
            onSelectColor={(c) => setColor(c === color ? '' : c)}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#1e1e2e" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {project ? 'Save' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Project Card Component
function ProjectCard({
  project,
  onEdit,
}: {
  project: Project;
  onEdit: () => void;
}) {
  return (
    <View style={styles.projectCard}>
      <View style={[styles.projectIcon, { backgroundColor: (project.color || colors.accent.purple) + '20' }]}>
        <FontAwesome name="code" size={14} color={project.color || colors.accent.purple} />
      </View>
      <View style={styles.projectContent}>
        <Text style={styles.projectName} numberOfLines={1}>
          {project.name}
        </Text>
        <Text style={styles.projectPath} numberOfLines={1}>
          {project.path}
        </Text>
      </View>
      <TouchableOpacity style={styles.iconButton} onPress={onEdit}>
        <FontAwesome name="pencil" size={14} color={colors.text.muted} />
      </TouchableOpacity>
    </View>
  );
}

// Workspace Section Component
function WorkspaceSection({
  workspace,
  projects,
  isLoadingProjects,
  onEdit,
  onDelete,
  onAddProject,
  onEditProject,
}: {
  workspace: Workspace;
  projects: Project[];
  isLoadingProjects: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddProject: () => void;
  onEditProject: (project: Project) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const canDelete = projects.length === 0 && !isLoadingProjects;

  const handleDelete = () => {
    Alert.alert(
      'Delete Workspace',
      `Are you sure you want to delete "${workspace.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <View style={styles.workspaceSection}>
      {/* Workspace Header */}
      <TouchableOpacity
        style={styles.workspaceHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View
          style={[styles.workspaceIcon, { backgroundColor: (workspace.color || colors.accent.purple) + '20' }]}
        >
          <FontAwesome
            name="folder"
            size={18}
            color={workspace.color || colors.accent.purple}
          />
        </View>
        <View style={styles.workspaceInfo}>
          <Text style={styles.workspaceName}>{workspace.name}</Text>
          <Text style={styles.workspaceCount}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.workspaceActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onAddProject();
            }}
          >
            <FontAwesome name="plus" size={12} color={colors.accent.green} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <FontAwesome name="cog" size={12} color={colors.text.muted} />
          </TouchableOpacity>
          {canDelete && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              <FontAwesome name="trash" size={12} color={colors.accent.red} />
            </TouchableOpacity>
          )}
          <FontAwesome
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.text.muted}
            style={styles.chevron}
          />
        </View>
      </TouchableOpacity>

      {/* Projects List */}
      {expanded && (
        <View style={styles.projectsList}>
          {isLoadingProjects ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accent.purple} />
            </View>
          ) : projects.length === 0 ? (
            <Text style={styles.emptyText}>No projects yet</Text>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => onEditProject(project)}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

// Main Screen Component
export default function WorkspaceBoardScreen() {
  const queryClient = useQueryClient();
  const { connection } = useConnectionStore();
  const isConnected = connection.status === 'connected';

  // Modals state
  const [workspaceModal, setWorkspaceModal] = useState<{
    visible: boolean;
    workspace?: Workspace | null;
  }>({ visible: false });
  const [projectModal, setProjectModal] = useState<{
    visible: boolean;
    workspaceId?: string;
    project?: Project | null;
  }>({ visible: false });

  // Projects cache per workspace
  const [projectsCache, setProjectsCache] = useState<Record<string, Project[]>>({});
  const [loadingWorkspaces, setLoadingWorkspaces] = useState<Record<string, boolean>>({});

  // Fetch workspaces
  const {
    data: rawWorkspaces = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: fetchWorkspaces,
    enabled: isConnected,
  });

  // Deduplicate workspaces by id (safety for race conditions during cache invalidation)
  const workspaces = useMemo(() => {
    const seen = new Set<string>();
    return rawWorkspaces.filter((ws) => {
      if (seen.has(ws.id)) return false;
      seen.add(ws.id);
      return true;
    });
  }, [rawWorkspaces]);

  // Load projects for a workspace
  const loadProjects = useCallback(async (workspaceId: string) => {
    if (loadingWorkspaces[workspaceId]) return;

    setLoadingWorkspaces((prev) => ({ ...prev, [workspaceId]: true }));
    try {
      const projects = await fetchProjects(workspaceId);
      setProjectsCache((prev) => ({ ...prev, [workspaceId]: projects }));
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoadingWorkspaces((prev) => ({ ...prev, [workspaceId]: false }));
    }
  }, [loadingWorkspaces]);

  // Load all projects on workspace fetch
  const onRefresh = useCallback(async () => {
    await refetch();
    // Reload all projects
    for (const ws of workspaces) {
      loadProjects(ws.id);
    }
  }, [refetch, workspaces, loadProjects]);

  // Initial load of projects
  useState(() => {
    workspaces.forEach((ws) => {
      if (!projectsCache[ws.id]) {
        loadProjects(ws.id);
      }
    });
  });

  // Mutations
  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      setWorkspaceModal({ visible: false });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      updateWorkspace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      setWorkspaceModal({ visible: false });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: ({ workspaceId, ...data }: { workspaceId: string; name: string; path: string; color?: string }) =>
      createProject(workspaceId, data),
    onSuccess: (_, variables) => {
      loadProjects(variables.workspaceId);
      setProjectModal({ visible: false });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string; workspaceId: string }) =>
      updateProject(id, data),
    onSuccess: (_, variables) => {
      loadProjects(variables.workspaceId);
      setProjectModal({ visible: false });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });


  // Handlers
  const handleSaveWorkspace = (name: string, color: string) => {
    if (workspaceModal.workspace) {
      updateWorkspaceMutation.mutate({
        id: workspaceModal.workspace.id,
        name,
        color,
      });
    } else {
      createWorkspaceMutation.mutate({ name, color });
    }
  };

  const handleSaveProject = (name: string, path: string, color?: string) => {
    if (projectModal.project) {
      updateProjectMutation.mutate({
        id: projectModal.project.id,
        name,
        color,
        workspaceId: projectModal.workspaceId!,
      });
    } else if (projectModal.workspaceId) {
      createProjectMutation.mutate({
        workspaceId: projectModal.workspaceId,
        name,
        path,
        color,
      });
    }
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Manage' }} />
        <View style={styles.notConnected}>
          <FontAwesome name="chain-broken" size={48} color={colors.text.muted} />
          <Text style={styles.notConnectedText}>Not connected to desktop</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Manage' }} />

      {/* Header with Add Button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workspaces</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setWorkspaceModal({ visible: true })}
        >
          <FontAwesome name="plus" size={16} color="#1e1e2e" />
          <Text style={styles.addButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent.purple}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.purple} />
          </View>
        ) : workspaces.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="briefcase" size={48} color={colors.text.muted} />
            <Text style={styles.emptyStateText}>No workspaces yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create a workspace to organize your projects
            </Text>
          </View>
        ) : (
          workspaces.map((workspace) => (
            <WorkspaceSection
              key={workspace.id}
              workspace={workspace}
              projects={projectsCache[workspace.id] || []}
              isLoadingProjects={loadingWorkspaces[workspace.id] || false}
              onEdit={() => setWorkspaceModal({ visible: true, workspace })}
              onDelete={() => deleteWorkspaceMutation.mutate(workspace.id)}
              onAddProject={() =>
                setProjectModal({ visible: true, workspaceId: workspace.id })
              }
              onEditProject={(project) =>
                setProjectModal({
                  visible: true,
                  workspaceId: workspace.id,
                  project,
                })
              }
            />
          ))
        )}
      </ScrollView>

      {/* Modals */}
      <WorkspaceModal
        visible={workspaceModal.visible}
        workspace={workspaceModal.workspace}
        onClose={() => setWorkspaceModal({ visible: false })}
        onSave={handleSaveWorkspace}
        isLoading={createWorkspaceMutation.isPending || updateWorkspaceMutation.isPending}
      />

      <ProjectModal
        visible={projectModal.visible}
        project={projectModal.project}
        onClose={() => setProjectModal({ visible: false })}
        onSave={handleSaveProject}
        isLoading={createProjectMutation.isPending || updateProjectMutation.isPending}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e1e2e',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  notConnected: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  notConnectedText: {
    fontSize: 16,
    color: colors.text.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.muted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Workspace Section
  workspaceSection: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  workspaceIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
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
  workspaceCount: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  workspaceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    padding: spacing.sm,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
  // Projects List
  projectsList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  projectIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectContent: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  projectName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  projectPath: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.bg.tertiary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.muted,
  },
  saveButton: {
    backgroundColor: colors.accent.purple,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e2e',
  },
});
