import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import type { QueueItem } from '@/src/types';

export const LifecycleItemCard = memo(function LifecycleItemCard({
  item,
  stage,
}: {
  item: QueueItem;
  stage: 'review' | 'completed';
}) {
  const stageConfig = {
    review: {
      color: colors.accent.yellow,
      icon: 'eye' as const,
      label: 'Awaiting Review',
    },
    completed: {
      color: colors.accent.green,
      icon: 'check-circle' as const,
      label: 'Completed',
    },
  };

  const config = stageConfig[stage];

  return (
    <View style={[styles.lifecycleItem, { borderLeftColor: config.color }]}>
      <View style={[styles.lifecycleIcon, { backgroundColor: config.color + '20' }]}>
        <FontAwesome name={config.icon} size={14} color={config.color} />
      </View>
      <View style={styles.lifecycleContent}>
        <Text style={styles.lifecycleText} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.lifecycleMeta}>{config.label}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  lifecycleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    gap: spacing.md,
  },
  lifecycleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifecycleContent: {
    flex: 1,
  },
  lifecycleText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  lifecycleMeta: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
});
