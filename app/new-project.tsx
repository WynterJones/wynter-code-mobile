import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import {
  fetchTemplates,
  fetchFilesystemBrowse,
  fetchHomeDirectory,
  createDirectory,
  createTerminal,
  writeTerminal,
  closeTerminal,
} from '@/src/api/client';
import { XTermWebView } from '@/src/components/XTermWebView';
import type { ProjectTemplate, CategoryInfo, DirectoryEntry, Workspace } from '@/src/types';

type Step = 'template' | 'location' | 'name' | 'running' | 'complete';

interface TemplateColorMap {
  [key: string]: string;
}

const templateColors: TemplateColorMap = {
  purple: colors.accent.purple,
  blue: colors.accent.blue,
  green: colors.accent.green,
  red: colors.accent.red,
  yellow: colors.accent.yellow,
  cyan: colors.accent.cyan,
  pink: colors.accent.pink,
  orange: colors.accent.orange,
  emerald: colors.accent.green,
  violet: colors.accent.purple,
  indigo: colors.accent.blue,
  sky: colors.accent.cyan,
  white: colors.text.primary,
};

export default function NewProjectScreen() {
  const router = useRouter();
  const { connection } = useConnectionStore();
  const isConnected = connection.status === 'connected';

  // Wizard state
  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');

  // Template data
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('frontend');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Filesystem data
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | undefined>();
  const [loadingPath, setLoadingPath] = useState(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Terminal state
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  // Workspace selection for attaching project
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  // Load templates on mount
  useEffect(() => {
    if (isConnected) {
      loadTemplates();
      loadHomeDirectory();
    }
  }, [isConnected]);

  // When terminal is ready, send the pending command
  const handleTerminalReady = useCallback(async () => {
    setTerminalReady(true);
    // Small delay to ensure terminal is fully ready
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (ptyId && pendingCommand) {
      await writeTerminal(ptyId, pendingCommand + '\n');
      setPendingCommand(null);
    }
  }, [ptyId, pendingCommand]);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await fetchTemplates();
      setTemplates(response.templates);
      // Custom order: frontend first, ai last
      const categoryOrder: Record<string, number> = {
        frontend: 0,
        backend: 1,
        mobile: 2,
        'browser-extensions': 3,
        ai: 99,
      };
      setCategories(response.categories.sort((a, b) => {
        const orderA = categoryOrder[a.id] ?? 50;
        const orderB = categoryOrder[b.id] ?? 50;
        return orderA - orderB;
      }));
    } catch (err) {
      console.error('Failed to load templates:', err);
      Alert.alert('Error', 'Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadHomeDirectory = async () => {
    try {
      const response = await fetchHomeDirectory();
      setCurrentPath(response.path);
      setSelectedPath(response.path);
      await browseDirectory(response.path);
    } catch (err) {
      console.error('Failed to get home directory:', err);
    }
  };

  const browseDirectory = async (path: string) => {
    try {
      setLoadingPath(true);
      const response = await fetchFilesystemBrowse(path);
      setCurrentPath(response.path);
      setParentPath(response.parent);
      setEntries(response.entries.filter(e => e.is_directory));
    } catch (err) {
      console.error('Failed to browse directory:', err);
      Alert.alert('Error', 'Failed to browse directory');
    } finally {
      setLoadingPath(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const newPath = `${currentPath}/${newFolderName.trim()}`;
      await createDirectory(newPath);
      setNewFolderName('');
      setShowNewFolder(false);
      await browseDirectory(currentPath);
    } catch (err) {
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const filteredTemplates = useMemo(() => {
    let filtered = templates.filter(t => t.category === activeCategory);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = templates.filter(
        t =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [templates, activeCategory, searchQuery]);

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setProjectName(template.project_name_placeholder);
    setStep('location');
  };

  const handleSelectLocation = () => {
    setSelectedPath(currentPath);
    setStep('name');
  };

  const handleStartCreation = async () => {
    if (!selectedTemplate || !selectedPath || !projectName.trim()) return;

    setStep('running');
    setTerminalReady(false);
    setIsRunning(true);
    setIsComplete(false);

    try {
      // Build the command - replace placeholder with project name
      let command = selectedTemplate.command;
      if (command.includes(selectedTemplate.project_name_placeholder)) {
        command = command.replace(selectedTemplate.project_name_placeholder, projectName.trim());
      } else {
        // Append project name to command
        command = `${command} ${projectName.trim()}`;
      }

      // Store command to be sent when terminal is ready
      setPendingCommand(command);

      // Create terminal in the selected directory
      const response = await createTerminal({
        cwd: selectedPath,
        cols: 80,
        rows: 24,
      });

      setPtyId(response.pty_id);
      // The command will be sent when handleTerminalReady fires

      // Wait for completion (poll for a bit, then assume done)
      // User can also manually click Done when they see it's finished
      setTimeout(() => {
        setIsRunning(false);
        setIsComplete(true);
        setStep('complete');
      }, 60000); // Increased to 60s for larger project scaffolds
    } catch (err) {
      console.error('Failed to create project:', err);
      Alert.alert('Error', 'Failed to create project');
      setIsRunning(false);
    }
  };

  const handleFinish = async () => {
    // Close terminal if open
    if (ptyId) {
      try {
        await closeTerminal(ptyId);
      } catch (err) {
        console.error('Failed to close terminal:', err);
      }
    }

    // TODO: Optionally attach to workspace using createProject API
    router.back();
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['template', 'location', 'name', 'running'].map((s, i) => (
        <React.Fragment key={s}>
          <View
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              ['running', 'complete'].includes(step) && i < 3 && styles.stepDotComplete,
            ]}
          >
            {(['running', 'complete'].includes(step) && i < 3) && (
              <FontAwesome name="check" size={10} color={colors.bg.primary} />
            )}
          </View>
          {i < 3 && <View style={styles.stepLine} />}
        </React.Fragment>
      ))}
    </View>
  );

  const renderTemplateStep = () => (
    <Animated.View entering={FadeIn} style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose a Template</Text>

      {/* Search */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={16} color={colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates..."
          placeholderTextColor={colors.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <FontAwesome name="times" size={16} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Tabs */}
      {!searchQuery && (
        <View style={styles.categoryTabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabsContent}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTab,
                  activeCategory === cat.id && styles.categoryTabActive,
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategory === cat.id && styles.categoryTabTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Templates Grid */}
      {loadingTemplates ? (
        <ActivityIndicator size="large" color={colors.accent.purple} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredTemplates}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.templatesGrid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.templateCard}
              onPress={() => handleSelectTemplate(item)}
            >
              <View
                style={[
                  styles.templateIcon,
                  { backgroundColor: (templateColors[item.color] || colors.accent.purple) + '20' },
                ]}
              >
                <FontAwesome
                  name="code"
                  size={24}
                  color={templateColors[item.color] || colors.accent.purple}
                />
              </View>
              <Text style={styles.templateName}>{item.name}</Text>
              <Text style={styles.templateDesc} numberOfLines={2}>
                {item.description}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </Animated.View>
  );

  const renderLocationStep = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Location</Text>
      <Text style={styles.stepSubtitle}>
        Selected: {selectedTemplate?.name}
      </Text>

      {/* Current Path */}
      <View style={styles.pathBar}>
        <FontAwesome name="folder-open" size={16} color={colors.accent.yellow} />
        <Text style={styles.pathText} numberOfLines={1}>
          {currentPath}
        </Text>
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => parentPath && browseDirectory(parentPath)}
          disabled={!parentPath}
        >
          <FontAwesome
            name="arrow-up"
            size={16}
            color={parentPath ? colors.text.primary : colors.text.muted}
          />
          <Text style={[styles.navButtonText, !parentPath && styles.textMuted]}>Up</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setShowNewFolder(true)}
        >
          <FontAwesome name="plus" size={16} color={colors.accent.green} />
          <Text style={styles.navButtonText}>New Folder</Text>
        </TouchableOpacity>
      </View>

      {/* New Folder Input */}
      {showNewFolder && (
        <View style={styles.newFolderRow}>
          <TextInput
            style={styles.newFolderInput}
            placeholder="Folder name..."
            placeholderTextColor={colors.text.muted}
            value={newFolderName}
            onChangeText={setNewFolderName}
            autoFocus
          />
          <TouchableOpacity style={styles.newFolderButton} onPress={handleCreateFolder}>
            <FontAwesome name="check" size={16} color={colors.accent.green} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newFolderButton}
            onPress={() => {
              setShowNewFolder(false);
              setNewFolderName('');
            }}
          >
            <FontAwesome name="times" size={16} color={colors.accent.red} />
          </TouchableOpacity>
        </View>
      )}

      {/* Directory Listing */}
      {loadingPath ? (
        <ActivityIndicator size="large" color={colors.accent.purple} style={styles.loader} />
      ) : (
        <ScrollView style={styles.directoryList}>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>No subdirectories</Text>
          ) : (
            entries.map((entry) => (
              <TouchableOpacity
                key={entry.path}
                style={styles.directoryItem}
                onPress={() => browseDirectory(entry.path)}
              >
                <FontAwesome name="folder" size={20} color={colors.accent.yellow} />
                <Text style={styles.directoryName}>{entry.name}</Text>
                <FontAwesome name="chevron-right" size={12} color={colors.text.muted} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Select Button */}
      <TouchableOpacity style={styles.primaryButton} onPress={handleSelectLocation}>
        <Text style={styles.primaryButtonText}>Select This Location</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderNameStep = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Name Your Project</Text>
      <Text style={styles.stepSubtitle}>
        Template: {selectedTemplate?.name}
      </Text>
      <Text style={styles.stepSubtitle}>
        Location: {selectedPath}
      </Text>

      <View style={styles.nameInputContainer}>
        <FontAwesome name="file-code-o" size={20} color={colors.accent.purple} />
        <TextInput
          style={styles.nameInput}
          placeholder="Project name..."
          placeholderTextColor={colors.text.muted}
          value={projectName}
          onChangeText={setProjectName}
          autoFocus
        />
      </View>

      <View style={styles.commandPreview}>
        <Text style={styles.commandLabel}>Command to run:</Text>
        <Text style={styles.commandText}>
          {selectedTemplate?.command} {projectName}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !projectName.trim() && styles.buttonDisabled]}
        onPress={handleStartCreation}
        disabled={!projectName.trim()}
      >
        <FontAwesome name="rocket" size={16} color={colors.bg.primary} />
        <Text style={styles.primaryButtonText}>Create Project</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderRunningStep = () => (
    <Animated.View entering={SlideInRight} style={styles.stepContainer}>
      <View style={styles.runningHeader}>
        {isRunning ? (
          <>
            <ActivityIndicator size="small" color={colors.accent.purple} />
            <Text style={styles.runningTitle}>Creating Project...</Text>
          </>
        ) : (
          <>
            <FontAwesome name="check-circle" size={24} color={colors.accent.green} />
            <Text style={styles.runningTitle}>Project Created!</Text>
          </>
        )}
      </View>

      {/* Full XTerm terminal */}
      {ptyId && (
        <View style={styles.terminalContainer}>
          <XTermWebView
            ptyId={ptyId}
            onReady={handleTerminalReady}
            style={styles.terminal}
          />
        </View>
      )}

      {/* Allow user to finish early or when auto-complete triggers */}
      <TouchableOpacity style={styles.primaryButton} onPress={handleFinish}>
        <Text style={styles.primaryButtonText}>{isRunning ? 'Finish Early' : 'Done'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderCompleteStep = () => renderRunningStep();

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <FontAwesome name="plug" size={48} color={colors.text.muted} />
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptySubtitle}>
            Connect to your desktop to create new projects
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      {step === 'template' && renderTemplateStep()}
      {step === 'location' && renderLocationStep()}
      {step === 'name' && renderNameStep()}
      {(step === 'running' || step === 'complete') && renderRunningStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.accent.purple,
    borderColor: colors.accent.purple,
  },
  stepDotComplete: {
    backgroundColor: colors.accent.green,
    borderColor: colors.accent.green,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
  },
  stepContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    color: colors.text.primary,
    fontSize: 16,
  },
  categoryTabsWrapper: {
    marginBottom: spacing.md,
  },
  categoryTabsContent: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  categoryTab: {
    height: 36,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabActive: {
    backgroundColor: colors.accent.purple,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.muted,
  },
  categoryTabTextActive: {
    color: colors.bg.primary,
  },
  templatesGrid: {
    paddingBottom: spacing.xl,
  },
  templateCard: {
    flex: 1,
    margin: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    maxWidth: '48%',
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  templateDesc: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 16,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  pathBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  pathText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: 14,
  },
  navRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  navButtonText: {
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: 14,
  },
  textMuted: {
    color: colors.text.muted,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  newFolderInput: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: 14,
  },
  newFolderButton: {
    padding: spacing.md,
    marginLeft: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
  },
  directoryList: {
    flex: 1,
    marginBottom: spacing.md,
  },
  directoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  directoryName: {
    flex: 1,
    marginLeft: spacing.md,
    color: colors.text.primary,
    fontSize: 14,
  },
  emptyText: {
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  nameInput: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    color: colors.text.primary,
    fontSize: 18,
  },
  commandPreview: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  commandLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  commandText: {
    fontSize: 14,
    color: colors.accent.cyan,
    fontFamily: 'monospace',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bg.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  runningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  runningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  terminalContainer: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  terminal: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
