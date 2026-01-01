import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { haptics } from '@/src/lib';
import type { Issue, IssueStatus, IssueType } from '@/src/types';

interface IssueCardProps {
  issue: Issue;
  onPress: () => void;
}

// Memoized to prevent unnecessary re-renders in FlatList
export const IssueCard = memo(function IssueCard({ issue, onPress }: IssueCardProps) {
  const handlePress = () => {
    haptics.lightTap();
    onPress();
  };
  const statusColors: Record<IssueStatus, string> = {
    open: colors.status.open,
    in_progress: colors.status.inProgress,
    closed: colors.status.done,
  };

  const typeIcons: Record<IssueType, string> = {
    bug: 'bug',
    feature: 'star',
    task: 'check-square-o',
    epic: 'rocket',
  };

  const typeColors: Record<IssueType, string> = {
    bug: colors.accent.red,
    feature: colors.accent.green,
    task: colors.accent.blue,
    epic: colors.accent.purple,
  };

  return (
    <TouchableOpacity style={styles.issueCard} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.issueHeader}>
        <View style={styles.issueHeaderLeft}>
          <View style={[styles.typeIcon, { backgroundColor: (typeColors[issue.type] || colors.accent.blue) + '20' }]}>
            <FontAwesome
              name={(typeIcons[issue.type] || 'circle') as any}
              size={14}
              color={typeColors[issue.type] || colors.accent.blue}
            />
          </View>
          <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
        </View>
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityText}>P{issue.priority}</Text>
        </View>
      </View>
      <View style={styles.issueFooter}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[issue.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[issue.status] }]} />
          <Text style={[styles.statusText, { color: statusColors[issue.status] }]}>
            {issue.status.replace('_', ' ')}
          </Text>
        </View>
        <Text style={styles.issueId}>#{issue.id}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  issueCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  issueHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBadge: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  issueTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 20,
  },
  issueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  issueId: {
    fontSize: 12,
    color: colors.text.muted,
  },
});
