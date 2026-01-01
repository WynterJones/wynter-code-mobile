import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Linking,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import { fetchBookmarks, queryKeys } from '@/src/api/client';
import {
  useCreateBookmark,
  useUpdateBookmark,
  useDeleteBookmark,
  useCreateBookmarkCollection,
  useDeleteBookmarkCollection,
} from '@/src/api/hooks';
import type { Bookmark, BookmarkCollection } from '@/src/types';

function FaviconImage({ url, faviconUrl, name }: { url: string; faviconUrl?: string; name: string }) {
  const [error, setError] = useState(false);

  const imageUrl = useMemo(() => {
    if (faviconUrl && !error) return faviconUrl;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  }, [url, faviconUrl, error]);

  if (!imageUrl) {
    return (
      <View style={styles.fallbackIcon}>
        <Text style={styles.fallbackText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.favicon}
      onError={() => setError(true)}
    />
  );
}

interface BookmarkCardProps {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}

function BookmarkCard({ bookmark, onEdit, onDelete }: BookmarkCardProps) {
  const [showActions, setShowActions] = useState(false);

  const handlePress = () => {
    Linking.openURL(bookmark.url);
  };

  const handleLongPress = () => {
    setShowActions(true);
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        <View style={styles.cardIcon}>
          <FaviconImage
            url={bookmark.url}
            faviconUrl={bookmark.faviconUrl}
            name={bookmark.title}
          />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{bookmark.title}</Text>
          <Text style={styles.cardUrl} numberOfLines={1}>{getHostname(bookmark.url)}</Text>
          {bookmark.description && (
            <Text style={styles.cardDescription} numberOfLines={1}>
              {bookmark.description}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowActions(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome name="ellipsis-v" size={14} color={colors.text.muted} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Action Sheet Modal */}
      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <Pressable style={styles.actionOverlay} onPress={() => setShowActions(false)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionTitle} numberOfLines={1}>{bookmark.title}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActions(false);
                handlePress();
              }}
            >
              <FontAwesome name="external-link" size={16} color={colors.text.primary} />
              <Text style={styles.actionText}>Open in Browser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActions(false);
                onEdit(bookmark);
              }}
            >
              <FontAwesome name="pencil" size={16} color={colors.accent.purple} />
              <Text style={[styles.actionText, { color: colors.accent.purple }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActions(false);
                onDelete(bookmark);
              }}
            >
              <FontAwesome name="trash" size={16} color={colors.accent.red} />
              <Text style={[styles.actionText, { color: colors.accent.red }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setShowActions(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

interface CollectionSectionProps {
  collection: BookmarkCollection | null;
  bookmarks: Bookmark[];
  onEditBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
}

function CollectionSection({
  collection,
  bookmarks,
  onEditBookmark,
  onDeleteBookmark,
}: CollectionSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.sectionTitleRow}>
          {collection?.icon && collection.icon.length <= 2 ? (
            <Text style={styles.collectionIcon}>{collection.icon}</Text>
          ) : (
            <FontAwesome
              name={collection ? 'folder' : 'inbox'}
              size={16}
              color={collection?.color || colors.text.muted}
            />
          )}
          <Text style={styles.sectionTitle}>
            {collection?.name || 'Uncategorized'}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{bookmarks.length}</Text>
          </View>
        </View>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={colors.text.muted}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sectionContent}>
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onEdit={onEditBookmark}
              onDelete={onDeleteBookmark}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface BookmarkFormData {
  title: string;
  url: string;
  description: string;
  collectionId: string | undefined;
}

interface BookmarkModalProps {
  visible: boolean;
  bookmark: Bookmark | null;
  collections: BookmarkCollection[];
  onClose: () => void;
  onSave: (data: BookmarkFormData) => void;
  isLoading: boolean;
}

function BookmarkModal({ visible, bookmark, collections, onClose, onSave, isLoading }: BookmarkModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [collectionId, setCollectionId] = useState<string | undefined>(undefined);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  // Reset form when modal opens
  useMemo(() => {
    if (visible) {
      setTitle(bookmark?.title || '');
      setUrl(bookmark?.url || '');
      setDescription(bookmark?.description || '');
      setCollectionId(bookmark?.collectionId);
    }
  }, [visible, bookmark]);

  const handleSave = () => {
    if (!title.trim() || !url.trim()) {
      Alert.alert('Required Fields', 'Please enter both title and URL');
      return;
    }

    // Validate URL
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    onSave({ title: title.trim(), url: finalUrl, description: description.trim(), collectionId });
  };

  const selectedCollection = collections.find(c => c.id === collectionId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{bookmark ? 'Edit Bookmark' : 'Add Bookmark'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <FontAwesome name="times" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Bookmark title"
                placeholderTextColor={colors.text.muted}
                autoFocus={!bookmark}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>URL *</Text>
              <TextInput
                style={styles.textInput}
                value={url}
                onChangeText={setUrl}
                placeholder="https://example.com"
                placeholderTextColor={colors.text.muted}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Collection</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowCollectionPicker(true)}
              >
                {selectedCollection ? (
                  <View style={styles.pickerValue}>
                    {selectedCollection.icon && selectedCollection.icon.length <= 2 ? (
                      <Text style={styles.pickerIcon}>{selectedCollection.icon}</Text>
                    ) : (
                      <FontAwesome name="folder" size={14} color={colors.text.secondary} />
                    )}
                    <Text style={styles.pickerText}>{selectedCollection.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.pickerPlaceholder}>No collection</Text>
                )}
                <FontAwesome name="chevron-down" size={12} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelModalButton} onPress={onClose}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={styles.saveButtonText}>{isLoading ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Collection Picker Modal */}
        <Modal
          visible={showCollectionPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCollectionPicker(false)}
        >
          <Pressable style={styles.actionOverlay} onPress={() => setShowCollectionPicker(false)}>
            <View style={styles.actionSheet}>
              <Text style={styles.actionTitle}>Select Collection</Text>
              <TouchableOpacity
                style={[styles.actionButton, !collectionId && styles.selectedOption]}
                onPress={() => {
                  setCollectionId(undefined);
                  setShowCollectionPicker(false);
                }}
              >
                <FontAwesome name="inbox" size={16} color={colors.text.secondary} />
                <Text style={styles.actionText}>No collection</Text>
                {!collectionId && <FontAwesome name="check" size={14} color={colors.accent.green} />}
              </TouchableOpacity>
              {collections.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.actionButton, collectionId === c.id && styles.selectedOption]}
                  onPress={() => {
                    setCollectionId(c.id);
                    setShowCollectionPicker(false);
                  }}
                >
                  {c.icon && c.icon.length <= 2 ? (
                    <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                  ) : (
                    <FontAwesome name="folder" size={16} color={c.color || colors.text.secondary} />
                  )}
                  <Text style={styles.actionText}>{c.name}</Text>
                  {collectionId === c.id && <FontAwesome name="check" size={14} color={colors.accent.green} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setShowCollectionPicker(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BookmarksScreen() {
  const connection = useConnectionStore((s) => s.connection);
  const isConnected = connection.status === 'connected';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.bookmarks,
    queryFn: () => fetchBookmarks(),
    enabled: isConnected,
    staleTime: 60000,
  });

  const createBookmarkMutation = useCreateBookmark();
  const updateBookmarkMutation = useUpdateBookmark();
  const deleteBookmarkMutation = useDeleteBookmark();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAddBookmark = () => {
    setEditingBookmark(null);
    setModalVisible(true);
  };

  const handleEditBookmark = useCallback((bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setModalVisible(true);
  }, []);

  const handleDeleteBookmark = useCallback((bookmark: Bookmark) => {
    Alert.alert(
      'Delete Bookmark',
      `Are you sure you want to delete "${bookmark.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBookmarkMutation.mutate(bookmark.id);
          },
        },
      ]
    );
  }, [deleteBookmarkMutation]);

  const handleSaveBookmark = useCallback(async (formData: BookmarkFormData) => {
    try {
      if (editingBookmark) {
        await updateBookmarkMutation.mutateAsync({
          id: editingBookmark.id,
          input: {
            title: formData.title,
            url: formData.url,
            description: formData.description || undefined,
            collectionId: formData.collectionId,
          },
        });
      } else {
        await createBookmarkMutation.mutateAsync({
          title: formData.title,
          url: formData.url,
          description: formData.description || undefined,
          collectionId: formData.collectionId,
        });
      }
      setModalVisible(false);
      setEditingBookmark(null);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }, [editingBookmark, createBookmarkMutation, updateBookmarkMutation]);

  // Filter and group bookmarks
  const { filteredBookmarks, groupedBookmarks } = useMemo(() => {
    if (!data) return { filteredBookmarks: [], groupedBookmarks: [] };

    const { bookmarks, collections } = data;

    // Filter by search query
    let filtered = bookmarks;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = bookmarks.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.url.toLowerCase().includes(query) ||
          (b.description && b.description.toLowerCase().includes(query))
      );
    }

    // Filter by collection
    if (selectedCollectionId !== null) {
      if (selectedCollectionId === 'uncategorized') {
        filtered = filtered.filter((b) => !b.collectionId);
      } else {
        filtered = filtered.filter((b) => b.collectionId === selectedCollectionId);
      }
    }

    // Sort by order
    filtered = filtered.sort((a, b) => a.order - b.order);

    // Group by collection
    const groups: Array<{ collection: BookmarkCollection | null; bookmarks: Bookmark[] }> = [];

    if (selectedCollectionId === null) {
      // Show all grouped
      const collectionMap = new Map<string | null, Bookmark[]>();
      collectionMap.set(null, []);
      collections.forEach((c) => collectionMap.set(c.id, []));

      filtered.forEach((b) => {
        const list = collectionMap.get(b.collectionId || null) || collectionMap.get(null)!;
        list.push(b);
      });

      collections
        .sort((a, b) => a.order - b.order)
        .forEach((collection) => {
          const bks = collectionMap.get(collection.id) || [];
          if (bks.length > 0) {
            groups.push({ collection, bookmarks: bks });
          }
        });

      const uncategorized = collectionMap.get(null) || [];
      if (uncategorized.length > 0) {
        groups.push({ collection: null, bookmarks: uncategorized });
      }
    } else {
      // Show single collection
      const collection = collections.find((c) => c.id === selectedCollectionId) || null;
      groups.push({ collection, bookmarks: filtered });
    }

    return { filteredBookmarks: filtered, groupedBookmarks: groups };
  }, [data, searchQuery, selectedCollectionId]);

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
            Connect to your desktop to view bookmarks
          </Text>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="bookmark" size={48} color={colors.accent.purple} />
          </View>
          <Text style={styles.emptyTitle}>Loading Bookmarks...</Text>
        </View>
      </View>
    );
  }

  // Error
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, styles.errorIcon]}>
            <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
          </View>
          <Text style={styles.emptyTitle}>Error Loading Bookmarks</Text>
          <Text style={styles.emptySubtitle}>{(error as Error).message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <FontAwesome name="refresh" size={16} color={colors.text.primary} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty - but still show add button
  const isEmpty = !data || data.bookmarks.length === 0;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInput}>
          <FontAwesome name="search" size={14} color={colors.text.muted} />
          <TextInput
            style={styles.searchText}
            placeholder="Search bookmarks..."
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
      </View>

      {/* Collection Chips */}
      {data && data.collections.length > 0 && (
        <View style={styles.chipWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            <TouchableOpacity
              style={[styles.chip, selectedCollectionId === null && styles.chipActive]}
              onPress={() => setSelectedCollectionId(null)}
            >
              <FontAwesome name="th-list" size={14} color={selectedCollectionId === null ? colors.accent.purple : colors.text.muted} />
              <Text style={[styles.chipText, selectedCollectionId === null && styles.chipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {data.collections.map((collection) => {
              const hasEmoji = collection.icon && collection.icon.length <= 2;
              const isActive = selectedCollectionId === collection.id;
              return (
                <TouchableOpacity
                  key={collection.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSelectedCollectionId(collection.id)}
                >
                  {hasEmoji ? (
                    <Text style={styles.chipIcon}>{collection.icon}</Text>
                  ) : (
                    <FontAwesome
                      name="folder"
                      size={14}
                      color={isActive ? colors.accent.purple : colors.text.muted}
                    />
                  )}
                  <Text
                    style={[styles.chipText, isActive && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {collection.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {isEmpty ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="bookmark" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Bookmarks</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + button to add your first bookmark
          </Text>
        </View>
      ) : (
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
          {filteredBookmarks.length === 0 ? (
            <View style={styles.noResults}>
              <FontAwesome name="search" size={24} color={colors.text.muted} />
              <Text style={styles.noResultsText}>No bookmarks found</Text>
            </View>
          ) : selectedCollectionId !== null ? (
            // Single collection view - flat list
            <View style={styles.flatList}>
              {filteredBookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={handleEditBookmark}
                  onDelete={handleDeleteBookmark}
                />
              ))}
            </View>
          ) : (
            // All collections view - grouped
            groupedBookmarks.map((group) => (
              <CollectionSection
                key={group.collection?.id || 'uncategorized'}
                collection={group.collection}
                bookmarks={group.bookmarks}
                onEditBookmark={handleEditBookmark}
                onDeleteBookmark={handleDeleteBookmark}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* FAB - Add Bookmark */}
      <TouchableOpacity style={styles.fab} onPress={handleAddBookmark}>
        <FontAwesome name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Bookmark Modal */}
      <BookmarkModal
        visible={modalVisible}
        bookmark={editingBookmark}
        collections={data?.collections || []}
        onClose={() => {
          setModalVisible(false);
          setEditingBookmark(null);
        }}
        onSave={handleSaveBookmark}
        isLoading={createBookmarkMutation.isPending || updateBookmarkMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  searchBar: {
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
  },
  chipWrapper: {
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    marginRight: spacing.sm,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.accent.purple + '20',
    borderColor: colors.accent.purple + '40',
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    color: colors.text.muted,
    flexShrink: 1,
  },
  chipTextActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  sectionContent: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  flatList: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favicon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
  },
  fallbackIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.purple + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent.purple,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  cardUrl: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  cardDescription: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 4,
  },
  moreButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  noResultsText: {
    fontSize: 14,
    color: colors.text.muted,
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
  errorIcon: {
    backgroundColor: `${colors.accent.red}20`,
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
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
  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: 40,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionText: {
    fontSize: 16,
    color: colors.text.primary,
    flex: 1,
  },
  cancelButton: {
    marginTop: spacing.md,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  selectedOption: {
    backgroundColor: colors.accent.purple + '10',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerIcon: {
    fontSize: 16,
  },
  pickerText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: colors.text.muted,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelModalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
  },
  cancelModalText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.purple,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
