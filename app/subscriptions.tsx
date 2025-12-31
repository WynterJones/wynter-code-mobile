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
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import { fetchSubscriptions, queryKeys } from '@/src/api/client';
import type { Subscription, SubscriptionCategory, BillingCycle } from '@/src/types';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getBillingLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'monthly': return '/mo';
    case 'yearly': return '/yr';
    case 'quarterly': return '/qtr';
    case 'weekly': return '/wk';
    case 'one-time': return 'once';
    default: return '';
  }
}

function FaviconImage({ url, faviconUrl, name }: { url?: string; faviconUrl?: string; name: string }) {
  const [error, setError] = useState(false);

  const imageUrl = useMemo(() => {
    if (faviconUrl && !error) return faviconUrl;
    if (url) {
      try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      } catch {
        return null;
      }
    }
    return null;
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

function SubscriptionCard({ subscription }: { subscription: Subscription }) {
  const handlePress = () => {
    if (subscription.url) {
      Linking.openURL(subscription.url);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, !subscription.isActive && styles.cardInactive]}
      onPress={handlePress}
      disabled={!subscription.url}
    >
      <FaviconImage
        url={subscription.url}
        faviconUrl={subscription.faviconUrl}
        name={subscription.name}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{subscription.name}</Text>
          {!subscription.isActive && (
            <View style={styles.inactiveTag}>
              <Text style={styles.inactiveTagText}>Inactive</Text>
            </View>
          )}
        </View>
        <View style={styles.cardDetails}>
          <Text style={styles.costText}>
            {formatCurrency(subscription.monthlyCost, subscription.currency)}
            <Text style={styles.cycleText}>{getBillingLabel(subscription.billingCycle)}</Text>
          </Text>
          {subscription.url && (
            <>
              <Text style={styles.separator}>|</Text>
              <Text style={styles.domainText} numberOfLines={1}>
                {new URL(subscription.url).hostname}
              </Text>
            </>
          )}
        </View>
        {subscription.notes && (
          <Text style={styles.notesText} numberOfLines={2}>{subscription.notes}</Text>
        )}
      </View>
      {subscription.url && (
        <FontAwesome name="external-link" size={12} color={colors.text.muted} />
      )}
    </TouchableOpacity>
  );
}

function CategorySection({
  category,
  subscriptions,
  totalCost,
}: {
  category: SubscriptionCategory | null;
  subscriptions: Subscription[];
  totalCost: number;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.sectionTitleRow}>
          {category?.color && (
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
          )}
          <Text style={styles.sectionTitle}>
            {category?.name || 'Uncategorized'}
          </Text>
          <Text style={styles.sectionCount}>({subscriptions.length})</Text>
        </View>
        <View style={styles.sectionRight}>
          <Text style={styles.sectionTotal}>{formatCurrency(totalCost, 'USD')}</Text>
          <FontAwesome
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.text.muted}
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sectionContent}>
          {subscriptions.map((sub) => (
            <SubscriptionCard key={sub.id} subscription={sub} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function SubscriptionsScreen() {
  const connection = useConnectionStore((s) => s.connection);
  const isConnected = connection.status === 'connected';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.subscriptions(),
    queryFn: () => fetchSubscriptions(),
    enabled: isConnected,
    staleTime: 60000,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Group subscriptions by category
  const groupedSubscriptions = useMemo(() => {
    if (!data) return [];

    const { subscriptions, categories } = data;
    const categoryMap = new Map<string | null, Subscription[]>();

    // Initialize with null for uncategorized
    categoryMap.set(null, []);
    categories.forEach((c) => categoryMap.set(c.id, []));

    // Sort subscriptions into categories
    subscriptions
      .filter((s) => s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((sub) => {
        const list = categoryMap.get(sub.categoryId || null) || categoryMap.get(null)!;
        list.push(sub);
      });

    // Build result
    const result: Array<{
      category: SubscriptionCategory | null;
      subscriptions: Subscription[];
      totalCost: number;
    }> = [];

    categories
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((category) => {
        const subs = categoryMap.get(category.id) || [];
        if (subs.length > 0) {
          result.push({
            category,
            subscriptions: subs,
            totalCost: subs.reduce((sum, s) => sum + s.monthlyCost, 0),
          });
        }
      });

    // Add uncategorized
    const uncategorized = categoryMap.get(null) || [];
    if (uncategorized.length > 0) {
      result.push({
        category: null,
        subscriptions: uncategorized,
        totalCost: uncategorized.reduce((sum, s) => sum + s.monthlyCost, 0),
      });
    }

    return result;
  }, [data]);

  // Calculate summary
  const summary = useMemo(() => {
    if (!data) return { totalMonthly: 0, activeCount: 0 };

    const active = data.subscriptions.filter((s) => s.isActive);
    const totalMonthly = active.reduce((sum, s) => {
      switch (s.billingCycle) {
        case 'yearly': return sum + s.monthlyCost / 12;
        case 'quarterly': return sum + s.monthlyCost / 3;
        case 'weekly': return sum + s.monthlyCost * 4.33;
        case 'one-time': return sum;
        default: return sum + s.monthlyCost;
      }
    }, 0);

    return { totalMonthly, activeCount: active.length };
  }, [data]);

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
            Connect to your desktop to view subscriptions
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
            <FontAwesome name="credit-card" size={48} color={colors.accent.purple} />
          </View>
          <Text style={styles.emptyTitle}>Loading Subscriptions...</Text>
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
          <Text style={styles.emptyTitle}>Error Loading Subscriptions</Text>
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
  if (!data || data.subscriptions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="credit-card" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Subscriptions</Text>
          <Text style={styles.emptySubtitle}>
            Add subscriptions in the desktop app to track them here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Monthly</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.totalMonthly, 'USD')}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Yearly</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.totalMonthly * 12, 'USD')}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryValue}>{summary.activeCount}</Text>
        </View>
      </View>

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
        {groupedSubscriptions.map((group, idx) => (
          <CategorySection
            key={group.category?.id || 'uncategorized'}
            category={group.category}
            subscriptions={group.subscriptions}
            totalCost={group.totalCost}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
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
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.text.muted,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent.purple,
  },
  sectionContent: {
    padding: spacing.sm,
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
  cardInactive: {
    opacity: 0.5,
  },
  favicon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
  },
  fallbackIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.purple + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent.purple,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  inactiveTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.sm,
  },
  inactiveTagText: {
    fontSize: 10,
    color: colors.text.muted,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  costText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    fontFamily: 'SpaceMono',
  },
  cycleText: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: '400',
  },
  separator: {
    marginHorizontal: spacing.sm,
    color: colors.border,
  },
  domainText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.muted,
  },
  notesText: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
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
