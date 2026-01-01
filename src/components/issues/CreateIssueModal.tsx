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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import type { IssueType, Priority, CreateIssueInput } from '@/src/types';

interface CreateIssueModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreateIssueInput) => void;
  isCreating: boolean;
}

export function CreateIssueModal({
  visible,
  onClose,
  onCreate,
  isCreating,
}: CreateIssueModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('task');
  const [priority, setPriority] = useState<Priority>(2);

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      priority,
    });
    // Reset form
    setTitle('');
    setDescription('');
    setType('task');
    setPriority(2);
  };

  const typeOptions: { value: IssueType; label: string; icon: string; color: string }[] = [
    { value: 'bug', label: 'Bug', icon: 'bug', color: colors.accent.red },
    { value: 'feature', label: 'Feature', icon: 'star', color: colors.accent.green },
    { value: 'task', label: 'Task', icon: 'check-square-o', color: colors.accent.blue },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Issue</Text>
          <TouchableOpacity
            onPress={handleCreate}
            style={styles.modalClose}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={colors.accent.purple} />
            ) : (
              <Text style={styles.modalCreateText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Title</Text>
            <TextInput
              style={styles.formInput}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.text.muted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMultiline]}
              placeholder="Add more details..."
              placeholderTextColor={colors.text.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Type */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.typeOptions}>
              {typeOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.typeOption,
                    type === opt.value && { backgroundColor: opt.color + '20', borderColor: opt.color },
                  ]}
                  onPress={() => setType(opt.value)}
                >
                  <FontAwesome
                    name={opt.icon as any}
                    size={14}
                    color={type === opt.value ? opt.color : colors.text.muted}
                  />
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === opt.value && { color: opt.color },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.priorityOptions}>
              {[0, 1, 2, 3, 4].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    priority === p && styles.priorityOptionActive,
                  ]}
                  onPress={() => setPriority(p as Priority)}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      priority === p && styles.priorityOptionTextActive,
                    ]}
                  >
                    P{p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  modalCancelText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  modalCreateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent.purple,
    textAlign: 'right',
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.xl,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  formInput: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.muted,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityOptionActive: {
    backgroundColor: colors.accent.purple + '20',
    borderColor: colors.accent.purple,
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.muted,
  },
  priorityOptionTextActive: {
    color: colors.accent.purple,
  },
});
