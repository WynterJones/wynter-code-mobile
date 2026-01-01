import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import type { Issue } from '@/src/types';

export function AddToBacklogModal({
  visible,
  issues,
  onClose,
  onAdd,
}: {
  visible: boolean;
  issues: Issue[];
  onClose: () => void;
  onAdd: (issueId: string) => void;
}) {
  const typeColors: Record<string, { bg: string; text: string }> = {
    bug: { bg: colors.accent.red + '20', text: colors.accent.red },
    feature: { bg: colors.accent.green + '20', text: colors.accent.green },
    task: { bg: colors.accent.blue + '20', text: colors.accent.blue },
    epic: { bg: colors.accent.purple + '20', text: colors.accent.purple },
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Backlog</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <FontAwesome name="times" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {issues.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.emptySectionText}>No open issues available</Text>
              </View>
            ) : (
              issues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  style={styles.issueOption}
                  onPress={() => onAdd(issue.id)}
                >
                  <View style={[styles.typeBadge, { backgroundColor: typeColors[issue.type]?.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColors[issue.type]?.text }]}>
                      {issue.type}
                    </Text>
                  </View>
                  <Text style={styles.issueOptionTitle} numberOfLines={2}>
                    {issue.title}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
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
  modalClose: {
    padding: spacing.sm,
  },
  modalList: {
    padding: spacing.lg,
  },
  modalEmpty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  issueOptionTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
});
