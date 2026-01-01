import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import type { Issue, IssueStatus } from '@/src/types';

interface IssueDetailModalProps {
  issue: Issue;
  onClose: () => void;
  onUpdate: (updates: Partial<Issue>) => void;
  onCloseIssue: (reason: string) => void;
  isUpdating: boolean;
}

export function IssueDetailModal({
  issue,
  onClose,
  onUpdate,
  onCloseIssue,
  isUpdating,
}: IssueDetailModalProps) {
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const statusColors: Record<IssueStatus, string> = {
    open: colors.status.open,
    in_progress: colors.status.inProgress,
    closed: colors.status.done,
  };

  const handleStatusChange = (newStatus: IssueStatus) => {
    if (newStatus === 'closed') {
      setShowCloseDialog(true);
    } else {
      onUpdate({ status: newStatus, updatedAt: new Date().toISOString() });
    }
  };

  const handleClose = () => {
    if (!closeReason.trim()) {
      Alert.alert('Required', 'Please enter a close reason.');
      return;
    }
    onCloseIssue(closeReason.trim());
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <FontAwesome name="chevron-down" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Issue #{issue.id}</Text>
          <View style={styles.modalClose} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Title */}
          <Text style={styles.detailTitle}>{issue.title}</Text>

          {/* Badges */}
          <View style={styles.detailBadges}>
            <View style={[styles.detailBadge, { backgroundColor: statusColors[issue.status] + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors[issue.status] }]} />
              <Text style={[styles.detailBadgeText, { color: statusColors[issue.status] }]}>
                {issue.status.replace('_', ' ')}
              </Text>
            </View>
            <View style={[styles.detailBadge, { backgroundColor: colors.bg.tertiary }]}>
              <Text style={styles.detailBadgeText}>{issue.type}</Text>
            </View>
            <View style={[styles.detailBadge, { backgroundColor: colors.bg.tertiary }]}>
              <Text style={styles.detailBadgeText}>Priority {issue.priority}</Text>
            </View>
          </View>

          {/* Description */}
          {issue.description && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailDescription}>{issue.description}</Text>
            </View>
          )}

          {/* Close Reason (if closed) */}
          {issue.closeReason && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Close Reason</Text>
              <Text style={styles.detailDescription}>{issue.closeReason}</Text>
            </View>
          )}

          {/* Dates */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Timeline</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineItem}>
                <FontAwesome name="plus-circle" size={14} color={colors.accent.green} />
                <Text style={styles.timelineText}>
                  Created {new Date(issue.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.timelineItem}>
                <FontAwesome name="pencil" size={14} color={colors.accent.blue} />
                <Text style={styles.timelineText}>
                  Updated {new Date(issue.updatedAt).toLocaleDateString()}
                </Text>
              </View>
              {issue.closedAt && (
                <View style={styles.timelineItem}>
                  <FontAwesome name="check-circle" size={14} color={colors.status.done} />
                  <Text style={styles.timelineText}>
                    Closed {new Date(issue.closedAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Actions */}
          {issue.status !== 'closed' && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Actions</Text>
              <View style={styles.actionButtons}>
                {issue.status === 'open' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.status.inProgress + '20' }]}
                    onPress={() => handleStatusChange('in_progress')}
                  >
                    <FontAwesome name="play" size={14} color={colors.status.inProgress} />
                    <Text style={[styles.actionButtonText, { color: colors.status.inProgress }]}>
                      Start Working
                    </Text>
                  </TouchableOpacity>
                )}
                {issue.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.status.open + '20' }]}
                    onPress={() => handleStatusChange('open')}
                  >
                    <FontAwesome name="pause" size={14} color={colors.status.open} />
                    <Text style={[styles.actionButtonText, { color: colors.status.open }]}>
                      Pause
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.status.done + '20' }]}
                  onPress={() => handleStatusChange('closed')}
                >
                  <FontAwesome name="check" size={14} color={colors.status.done} />
                  <Text style={[styles.actionButtonText, { color: colors.status.done }]}>
                    Close Issue
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Close Dialog */}
        {showCloseDialog && (
          <View style={styles.closeDialog}>
            <Text style={styles.closeDialogTitle}>Close Issue</Text>
            <Text style={styles.closeDialogLabel}>Reason for closing:</Text>
            <TextInput
              style={styles.closeDialogInput}
              placeholder="What was done?"
              placeholderTextColor={colors.text.muted}
              value={closeReason}
              onChangeText={setCloseReason}
              multiline
            />
            <View style={styles.closeDialogButtons}>
              <TouchableOpacity
                style={styles.closeDialogCancel}
                onPress={() => setShowCloseDialog(false)}
              >
                <Text style={styles.closeDialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeDialogConfirm} onPress={handleClose}>
                <Text style={styles.closeDialogConfirmText}>Close Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalClose: {
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
    lineHeight: 28,
  },
  detailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  detailBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  detailSection: {
    marginBottom: spacing.xl,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  detailDescription: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  actionButtons: {
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  closeDialog: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.secondary,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeDialogTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  closeDialogLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  closeDialogInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  closeDialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  closeDialogCancel: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
  },
  closeDialogCancelText: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  closeDialogConfirm: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.green,
  },
  closeDialogConfirmText: {
    fontSize: 15,
    color: colors.bg.primary,
    fontWeight: '600',
  },
});
