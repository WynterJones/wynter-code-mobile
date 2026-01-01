import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import type { QueueItem, AutoBuildPhase } from '@/src/types';
import { getPhaseIcon } from './utils';

export function CurrentWorkCard({
  item,
  phase,
  progress,
}: {
  item: QueueItem;
  phase?: AutoBuildPhase;
  progress: number;
}) {
  return (
    <View style={styles.currentWorkCard}>
      <View style={styles.currentWorkHeader}>
        <View style={[styles.currentWorkIcon, { backgroundColor: colors.accent.green + '20' }]}>
          <FontAwesome name={getPhaseIcon(phase) as any} size={16} color={colors.accent.green} />
        </View>
        <View style={styles.currentWorkInfo}>
          <Text style={styles.currentWorkTitle} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.currentWorkPhase}>
            {phase ? phase.replace(/([A-Z])/g, ' $1').trim() : 'Processing'}
          </Text>
        </View>
        {progress > 0 && (
          <Text style={styles.currentWorkProgress}>{progress}%</Text>
        )}
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  currentWorkCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.green + '40',
  },
  currentWorkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  currentWorkIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentWorkInfo: {
    flex: 1,
  },
  currentWorkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  currentWorkPhase: {
    fontSize: 13,
    color: colors.accent.green,
    textTransform: 'capitalize',
  },
  currentWorkProgress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent.green,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.green,
    borderRadius: 2,
  },
});
