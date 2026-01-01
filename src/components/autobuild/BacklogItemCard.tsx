import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import type { QueueItem } from '@/src/types';
import { formatTime } from './utils';

export const BacklogItemCard = memo(function BacklogItemCard({
  item,
  position,
  onRemove,
}: {
  item: QueueItem;
  position: number;
  onRemove: () => void;
}) {
  return (
    <View style={styles.backlogItem}>
      <View style={styles.backlogPosition}>
        <Text style={styles.backlogPositionText}>{position}</Text>
      </View>
      <View style={styles.backlogContent}>
        <Text style={styles.backlogText} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.backlogMeta}>
          Added {formatTime(item.createdAt)}
        </Text>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <FontAwesome name="times" size={14} color={colors.text.muted} />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  backlogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  backlogPosition: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backlogPositionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  backlogContent: {
    flex: 1,
  },
  backlogText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  backlogMeta: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
});
