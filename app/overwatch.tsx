import { useState } from 'react';
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
import { fetchOverwatchServices, queryKeys } from '@/src/api/client';
import type { OverwatchService, ServiceProvider, ServiceStatus } from '@/src/types';

const PROVIDER_ICONS: Record<ServiceProvider, string> = {
  railway: 'train',
  plausible: 'bar-chart',
  netlify: 'globe',
  sentry: 'bug',
  link: 'link',
};

const PROVIDER_COLORS: Record<ServiceProvider, string> = {
  railway: '#9B4DFF',
  plausible: '#5850EC',
  netlify: '#00C7B7',
  sentry: '#362D59',
  link: '#6c7086',
};

const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: colors.accent.green,
  degraded: colors.accent.yellow,
  down: colors.accent.red,
  unknown: colors.text.muted,
  loading: colors.accent.purple,
};

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'Never updated';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function ServiceCard({ service }: { service: OverwatchService }) {
  const isLink = service.provider === 'link';
  const iconName = PROVIDER_ICONS[service.provider] as keyof typeof FontAwesome.glyphMap;
  const color = isLink && service.linkColor ? service.linkColor : PROVIDER_COLORS[service.provider];
  const status = service.status || 'unknown';

  const handlePress = () => {
    if (service.externalUrl) {
      Linking.openURL(service.externalUrl);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      disabled={!service.externalUrl}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <FontAwesome name={iconName} size={18} color={color} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{service.name}</Text>
          {isLink ? (
            <View style={styles.statusRow}>
              <FontAwesome name="link" size={10} color={colors.text.muted} />
              <Text style={styles.statusLabel}>Quick link</Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
              <Text style={[styles.statusLabel, { color: STATUS_COLORS[status] }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          )}
        </View>
        {service.externalUrl && (
          <FontAwesome name="external-link" size={14} color={colors.text.muted} />
        )}
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {isLink ? (
          <Text style={styles.contentText}>Click to open external link</Text>
        ) : service.error ? (
          <Text style={styles.errorText}>{service.error}</Text>
        ) : service.metrics ? (
          <View style={styles.metricsGrid}>
            {Object.entries(service.metrics).slice(0, 4).map(([key, value]) => (
              <View key={key} style={styles.metricItem}>
                <Text style={styles.metricLabel}>{key.replace(/_/g, ' ')}</Text>
                <Text style={styles.metricValue}>{String(value)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.contentText}>No data available</Text>
        )}
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>
          {isLink && service.externalUrl
            ? new URL(service.externalUrl).hostname
            : formatTimeAgo(service.lastUpdated)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function OverwatchScreen() {
  const connection = useConnectionStore((s) => s.connection);
  const isConnected = connection.status === 'connected';

  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.overwatch(),
    queryFn: () => fetchOverwatchServices(),
    enabled: isConnected,
    staleTime: 60000,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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
            Connect to your desktop to view service status
          </Text>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading && !services) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="eye" size={48} color={colors.accent.purple} />
          </View>
          <Text style={styles.emptyTitle}>Loading Services...</Text>
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
          <Text style={styles.emptyTitle}>Error Loading Services</Text>
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
  if (!services || services.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="eye" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Services Configured</Text>
          <Text style={styles.emptySubtitle}>
            Add services in the desktop app to monitor them here
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
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
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
    color: colors.text.muted,
  },
  cardContent: {
    padding: spacing.md,
  },
  contentText: {
    fontSize: 13,
    color: colors.text.muted,
  },
  errorText: {
    fontSize: 13,
    color: colors.accent.red,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricItem: {
    minWidth: '45%',
  },
  metricLabel: {
    fontSize: 11,
    color: colors.text.muted,
    textTransform: 'capitalize',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: 2,
  },
  cardFooter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: `${colors.bg.tertiary}50`,
  },
  footerText: {
    fontSize: 11,
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
