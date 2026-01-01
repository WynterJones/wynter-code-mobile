import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing } from '@/src/theme';
import type { LogEntry } from '@/src/types';
import { formatTime } from './utils';

export function LogEntryRow({ log }: { log: LogEntry }) {
  const levelColors: Record<string, string> = {
    info: colors.accent.blue,
    success: colors.accent.green,
    warn: colors.accent.yellow,
    error: colors.accent.red,
  };

  const levelIcons: Record<string, string> = {
    info: 'info-circle',
    success: 'check-circle',
    warn: 'exclamation-triangle',
    error: 'times-circle',
  };

  return (
    <View style={styles.logEntry}>
      <FontAwesome
        name={levelIcons[log.level] as any}
        size={12}
        color={levelColors[log.level]}
        style={styles.logIcon}
      />
      <Text style={styles.logMessage} numberOfLines={1}>
        {log.message}
      </Text>
      <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  logIcon: {
    width: 16,
  },
  logMessage: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
  },
  logTime: {
    fontSize: 11,
    color: colors.text.muted,
  },
});
