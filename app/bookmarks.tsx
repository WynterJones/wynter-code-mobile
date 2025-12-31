import { useState, useMemo } from 'react';
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
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import { fetchBookmarks, queryKeys } from '@/src/api/client';
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

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const handlePress = () => {
    Linking.openURL(bookmark.url);
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
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
      <FontAwesome name="external-link" size={12} color={colors.text.muted} />
    </TouchableOpacity>
  );
}

function CollectionSection({
  collection,
  bookmarks,
}: {
  collection: BookmarkCollection | null;
  bookmarks: Bookmark[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.sectionTitleRow}>
          {collection?.icon ? (
            <Text style={styles.collectionIcon}>{collection.icon}</Text>
          ) : (
            <FontAwesome
              name={collection ? 'folder' : 'inbox'}
              size={16}
              color={collection?.color || colors.text.muted}
            />
          )}
          <Text style={styles.sectionTitle}>
            {collection?.name || 'All Bookmarks'}
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
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </View>
      )}
    </View>
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

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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

  // Empty
  if (!data || data.bookmarks.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="bookmark" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Bookmarks</Text>
          <Text style={styles.emptySubtitle}>
            Add bookmarks in the desktop app to access them here
          </Text>
        </View>
      </View>
    );
  }

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipContainer}
      >
        <TouchableOpacity
          style={[styles.chip, selectedCollectionId === null && styles.chipActive]}
          onPress={() => setSelectedCollectionId(null)}
        >
          <FontAwesome name="th-list" size={12} color={selectedCollectionId === null ? colors.accent.purple : colors.text.muted} />
          <Text style={[styles.chipText, selectedCollectionId === null && styles.chipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {data.collections.map((collection) => (
          <TouchableOpacity
            key={collection.id}
            style={[styles.chip, selectedCollectionId === collection.id && styles.chipActive]}
            onPress={() => setSelectedCollectionId(collection.id)}
          >
            {collection.icon ? (
              <Text style={styles.chipIcon}>{collection.icon}</Text>
            ) : (
              <FontAwesome
                name="folder"
                size={12}
                color={selectedCollectionId === collection.id ? colors.accent.purple : colors.text.muted}
              />
            )}
            <Text style={[styles.chipText, selectedCollectionId === collection.id && styles.chipTextActive]}>
              {collection.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
              <BookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </View>
        ) : (
          // All collections view - grouped
          groupedBookmarks.map((group) => (
            <CollectionSection
              key={group.collection?.id || 'uncategorized'}
              collection={group.collection}
              bookmarks={group.bookmarks}
            />
          ))
        )}
      </ScrollView>
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
  chipContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.full,
    gap: 6,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent.purple + '20',
  },
  chipIcon: {
    fontSize: 12,
  },
  chipText: {
    fontSize: 13,
    color: colors.text.muted,
  },
  chipTextActive: {
    color: colors.accent.purple,
    fontWeight: '500',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
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
});
