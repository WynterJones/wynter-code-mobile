import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack, useNavigation } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useDocs, useDocContent, useIsConnected } from '@/src/api/hooks';
import { useProjectStore } from '@/src/stores/projectStore';
import type { DocFile } from '@/src/api/client';
import { saveDocContent } from '@/src/api/client';

// Group docs by folder
function groupDocsByFolder(docs: DocFile[]): Map<string, DocFile[]> {
  const groups = new Map<string, DocFile[]>();

  for (const doc of docs) {
    const folder = doc.folder || 'Root';
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder)!.push(doc);
  }

  return groups;
}

// Markdown styles
const markdownStyles = StyleSheet.create({
  body: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  heading1: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  heading2: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  heading3: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paragraph: {
    marginVertical: spacing.sm,
  },
  code_inline: {
    backgroundColor: colors.bg.tertiary,
    color: colors.accent.blue,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  fence: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
  },
  code_block: {
    color: colors.text.secondary,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  blockquote: {
    backgroundColor: colors.bg.tertiary,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.blue,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
  },
  bullet_list: {
    marginVertical: spacing.sm,
  },
  ordered_list: {
    marginVertical: spacing.sm,
  },
  list_item: {
    marginVertical: 2,
  },
  link: {
    color: colors.accent.blue,
    textDecorationLine: 'underline',
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginVertical: spacing.sm,
  },
  thead: {
    backgroundColor: colors.bg.tertiary,
  },
  th: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  td: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  hr: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.md,
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  s: {
    textDecorationLine: 'line-through',
  },
  image: {
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
  },
});

// Doc list view
function DocsList({
  docs,
  onSelectDoc,
  isLoading,
  onRefresh,
}: {
  docs: DocFile[];
  onSelectDoc: (doc: DocFile) => void;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Root', '_AUDIT']));

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs;
    const query = searchQuery.toLowerCase();
    return docs.filter(doc =>
      doc.name.toLowerCase().includes(query) ||
      (doc.folder && doc.folder.toLowerCase().includes(query))
    );
  }, [docs, searchQuery]);

  const groupedDocs = useMemo(() => groupDocsByFolder(filteredDocs), [filteredDocs]);

  const toggleFolder = (folder: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folder)) {
      newExpanded.delete(folder);
    } else {
      newExpanded.add(folder);
    }
    setExpandedFolders(newExpanded);
  };

  // Sort folders: Root first, then _AUDIT, then alphabetically
  const sortedFolders = useMemo(() => {
    const folders = Array.from(groupedDocs.keys());
    return folders.sort((a, b) => {
      if (a === 'Root') return -1;
      if (b === 'Root') return 1;
      if (a === '_AUDIT') return -1;
      if (b === '_AUDIT') return 1;
      return a.localeCompare(b);
    });
  }, [groupedDocs]);

  return (
    <View style={styles.listContainer}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={16} color={colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search docs..."
          placeholderTextColor={colors.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <FontAwesome name="times-circle" size={16} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Doc count */}
      <Text style={styles.docCount}>
        {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'}
      </Text>

      {/* Folders and docs */}
      <ScrollView
        style={styles.docList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.accent.blue}
          />
        }
      >
        {sortedFolders.map(folder => {
          const folderDocs = groupedDocs.get(folder) || [];
          const isExpanded = expandedFolders.has(folder);

          return (
            <View key={folder} style={styles.folderSection}>
              <TouchableOpacity
                style={styles.folderHeader}
                onPress={() => toggleFolder(folder)}
              >
                <FontAwesome
                  name={isExpanded ? 'folder-open' : 'folder'}
                  size={16}
                  color={colors.accent.yellow}
                />
                <Text style={styles.folderName}>{folder}</Text>
                <Text style={styles.folderCount}>{folderDocs.length}</Text>
                <FontAwesome
                  name={isExpanded ? 'chevron-down' : 'chevron-right'}
                  size={12}
                  color={colors.text.muted}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.folderContent}>
                  {folderDocs.map(doc => (
                    <TouchableOpacity
                      key={doc.path}
                      style={styles.docItem}
                      onPress={() => onSelectDoc(doc)}
                    >
                      <FontAwesome
                        name="file-text-o"
                        size={14}
                        color={colors.accent.blue}
                      />
                      <Text style={styles.docName} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <FontAwesome
                        name="chevron-right"
                        size={10}
                        color={colors.text.muted}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {filteredDocs.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <FontAwesome name="file-o" size={48} color={colors.text.muted} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching documents' : 'No documents found'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Header actions component for the viewer
function ViewerHeaderActions({
  isEditing,
  setIsEditing,
  hasChanges,
  isSaving,
  onSave,
}: {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <View style={styles.headerActions}>
      {isEditing && hasChanges && (
        <TouchableOpacity
          style={styles.saveButton}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#1a1a1a" />
          ) : (
            <>
              <FontAwesome name="save" size={14} color="#1a1a1a" />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => setIsEditing(!isEditing)}
      >
        <FontAwesome
          name={isEditing ? 'eye' : 'pencil'}
          size={18}
          color={isEditing ? colors.accent.blue : colors.text.secondary}
        />
      </TouchableOpacity>
    </View>
  );
}

// Doc viewer
function DocViewer({
  filePath,
}: {
  filePath: string;
}) {
  const { data, isLoading, error, refetch } = useDocContent(filePath);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.blue} />
        <Text style={styles.loadingText}>Loading document...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
        <Text style={styles.errorText}>Failed to load document</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.markdownContainer}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.markdownContent}
    >
      <Markdown style={markdownStyles}>
        {data.content}
      </Markdown>
    </ScrollView>
  );
}

// Doc editor
function DocEditor({
  filePath,
  projectPath,
  editContent,
  setEditContent,
  setHasChanges,
  originalContent,
}: {
  filePath: string;
  projectPath: string;
  editContent: string;
  setEditContent: (content: string) => void;
  setHasChanges: (hasChanges: boolean) => void;
  originalContent: string;
}) {
  const handleContentChange = (text: string) => {
    setEditContent(text);
    setHasChanges(text !== originalContent);
  };

  return (
    <KeyboardAvoidingView
      style={styles.editorKeyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.editorContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.editor}
          value={editContent}
          onChangeText={handleContentChange}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function DocsScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ file?: string }>();
  const isConnected = useIsConnected();
  const selectedProject = useProjectStore((s) => s.selectedProject);

  const [selectedDoc, setSelectedDoc] = useState<DocFile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  const { data: docs = [], isLoading, refetch } = useDocs();
  const { data: docData, refetch: refetchDoc } = useDocContent(selectedDoc?.path || '');

  // Initialize edit content when doc data loads
  React.useEffect(() => {
    if (docData?.content) {
      setEditContent(docData.content);
      setOriginalContent(docData.content);
      setHasChanges(false);
    }
  }, [docData?.content]);

  // Handle initial file param (for deep linking from audit files)
  React.useEffect(() => {
    if (params.file && docs.length > 0) {
      const doc = docs.find(d => d.path === params.file);
      if (doc) {
        setSelectedDoc(doc);
      }
    }
  }, [params.file, docs]);

  // Warn about unsaved changes when navigating back
  React.useEffect(() => {
    if (!hasChanges || !selectedDoc) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setSelectedDoc(null);
              setIsEditing(false);
              setHasChanges(false);
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [hasChanges, selectedDoc, navigation]);

  // Save document
  const handleSave = async () => {
    if (!hasChanges || isSaving || !selectedDoc || !selectedProject) return;

    setIsSaving(true);
    try {
      await saveDocContent(selectedProject.path, selectedDoc.path, editContent);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHasChanges(false);
      setOriginalContent(editContent);
      refetchDoc();
      Alert.alert('Saved', 'Document saved successfully');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  // When viewing a doc, use Stack header with proper title and actions
  if (selectedDoc && selectedProject) {
    return (
      <>
        <Stack.Screen
          options={{
            title: selectedDoc.name,
            headerStyle: { backgroundColor: colors.bg.primary },
            headerTintColor: colors.text.primary,
            headerBackTitle: 'Home',
            headerRight: () => (
              <ViewerHeaderActions
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                hasChanges={hasChanges}
                isSaving={isSaving}
                onSave={handleSave}
              />
            ),
          }}
        />
        <View style={styles.container}>
          {isEditing ? (
            <DocEditor
              filePath={selectedDoc.path}
              projectPath={selectedProject.path}
              editContent={editContent}
              setEditContent={setEditContent}
              setHasChanges={setHasChanges}
              originalContent={originalContent}
            />
          ) : (
            <DocViewer filePath={selectedDoc.path} />
          )}
        </View>
      </>
    );
  }

  if (!isConnected) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Docs',
            headerStyle: { backgroundColor: colors.bg.primary },
            headerTintColor: colors.text.primary,
          }}
        />
        <View style={styles.notConnectedContainer}>
          <FontAwesome name="chain-broken" size={48} color={colors.text.muted} />
          <Text style={styles.notConnectedText}>Connect to desktop to view docs</Text>
        </View>
      </>
    );
  }

  if (!selectedProject) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Docs',
            headerStyle: { backgroundColor: colors.bg.primary },
            headerTintColor: colors.text.primary,
          }}
        />
        <View style={styles.notConnectedContainer}>
          <FontAwesome name="folder-o" size={48} color={colors.text.muted} />
          <Text style={styles.notConnectedText}>Select a project to view docs</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Docs',
          headerStyle: { backgroundColor: colors.bg.primary },
          headerTintColor: colors.text.primary,
        }}
      />
      <View style={styles.container}>
        {/* Project name */}
        <View style={styles.projectHeader}>
          <FontAwesome name="folder-o" size={14} color={colors.text.muted} />
          <Text style={styles.projectName} numberOfLines={1}>
            {selectedProject.name}
          </Text>
        </View>

        {/* Doc list */}
        <DocsList
          docs={docs}
          onSelectDoc={setSelectedDoc}
          isLoading={isLoading}
          onRefresh={() => refetch()}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Project header
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  projectName: {
    fontSize: 13,
    color: colors.text.muted,
    flex: 1,
  },

  // Not connected
  notConnectedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg.primary,
  },
  notConnectedText: {
    fontSize: 16,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // List view
  listContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 15,
    color: colors.text.primary,
  },
  docCount: {
    fontSize: 12,
    color: colors.text.muted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  docList: {
    flex: 1,
  },

  // Folders
  folderSection: {
    marginBottom: spacing.xs,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg.secondary,
  },
  folderName: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  folderCount: {
    fontSize: 12,
    color: colors.text.muted,
    marginRight: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  folderContent: {
    paddingLeft: spacing.lg,
  },

  // Doc items
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  docName: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.muted,
    marginTop: spacing.md,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.md,
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.muted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.accent.blue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
  },

  // Header
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  saveButtonText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Markdown viewer
  markdownContainer: {
    flex: 1,
  },
  markdownContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },

  // Editor
  editorKeyboardView: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
  },
  editor: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.primary,
    lineHeight: 20,
    minHeight: '100%',
  },
});
