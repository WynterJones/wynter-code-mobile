import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { MobileChatSession } from '@/src/stores/mobileChatStore';
import { useMobileChatStore } from '@/src/stores';
import { colors, spacing, borderRadius } from '@/src/theme';
import { ProviderIcon } from './ProviderIcon';
import { PROVIDER_COLORS, getModelName, formatRelativeTime } from './shared';

interface SessionCardProps {
  session: MobileChatSession;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: SessionCardProps) {
  const provider = session.provider || 'claude';
  const providerColor = PROVIDER_COLORS[provider];
  const { deleteSession } = useMobileChatStore();

  const handleLongPress = () => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${session.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSession(session.id),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.icon, { backgroundColor: providerColor + '20' }]}>
        <ProviderIcon provider={provider} size={20} />
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{session.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{session.messageCount} messages</Text>
          {session.model && (
            <View style={[styles.modelBadge, { backgroundColor: providerColor + '15' }]}>
              <Text style={[styles.modelBadgeText, { color: providerColor }]}>
                {getModelName(session.model)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.time}>
        <Text style={styles.timeText}>{formatRelativeTime(session.updatedAt)}</Text>
        <FontAwesome name="chevron-right" size={12} color={colors.text.muted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    fontSize: 13,
    color: colors.text.muted,
  },
  modelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  modelBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  time: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  timeText: {
    fontSize: 12,
    color: colors.text.muted,
  },
});
