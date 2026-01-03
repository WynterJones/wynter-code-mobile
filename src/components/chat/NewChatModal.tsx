import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { AIProvider, AIModel } from '@/src/types';
import { useMobileChatStore, useProjectStore } from '@/src/stores';
import { colors, spacing, borderRadius } from '@/src/theme';
import { ProviderIcon } from './ProviderIcon';
import { PROVIDER_COLORS, MODELS, DEFAULT_PROVIDER, DEFAULT_MODEL } from './shared';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NewChatModal({ visible, onClose }: NewChatModalProps) {
  const [chatName, setChatName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(DEFAULT_PROVIDER);
  const [selectedModel, setSelectedModel] = useState<AIModel>(DEFAULT_MODEL);
  const { createSession, selectSession } = useMobileChatStore();
  const selectedProject = useProjectStore((s) => s.selectedProject);

  const filteredModels = useMemo(
    () => MODELS.filter((m) => m.provider === selectedProvider),
    [selectedProvider]
  );

  // Update selected model when provider changes
  useEffect(() => {
    const defaultForProvider = filteredModels[0];
    if (defaultForProvider && !filteredModels.find((m) => m.id === selectedModel)) {
      setSelectedModel(defaultForProvider.id);
    }
  }, [selectedProvider, filteredModels, selectedModel]);

  const handleCreate = async () => {
    const name = chatName.trim() || `Chat ${new Date().toLocaleDateString()}`;
    const projectPath = selectedProject?.path;
    const session = await createSession(name, selectedProvider, selectedModel, 'normal', projectPath);
    selectSession(session.id);
    setChatName('');
    onClose();
  };

  const providers: { id: AIProvider; name: string }[] = [
    { id: 'claude', name: 'Claude' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Gemini' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>New Chat</Text>
              {selectedProject && (
                <View style={styles.projectContext}>
                  <FontAwesome name="folder-o" size={10} color={colors.accent.purple} />
                  <Text style={styles.projectContextText} numberOfLines={1}>
                    {selectedProject.name}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.close}>
              <FontAwesome name="times" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Chat name input */}
          <View style={styles.section}>
            <Text style={styles.label}>Chat Name (optional)</Text>
            <TextInput
              style={styles.nameInput}
              value={chatName}
              onChangeText={setChatName}
              placeholder={`Chat ${new Date().toLocaleDateString()}`}
              placeholderTextColor={colors.text.muted}
            />
          </View>

          {/* Provider tabs */}
          <View style={styles.section}>
            <Text style={styles.label}>AI Provider</Text>
            <View style={styles.providerTabs}>
              {providers.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.providerTab,
                    selectedProvider === p.id && {
                      backgroundColor: PROVIDER_COLORS[p.id] + '20',
                      borderColor: PROVIDER_COLORS[p.id],
                    },
                  ]}
                  onPress={() => setSelectedProvider(p.id)}
                >
                  <ProviderIcon provider={p.id} size={16} />
                  <Text
                    style={[
                      styles.providerTabText,
                      selectedProvider === p.id && { color: PROVIDER_COLORS[p.id] },
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Model selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Model</Text>
            <ScrollView style={styles.modelList} showsVerticalScrollIndicator={false}>
              {filteredModels.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.modelOption,
                    selectedModel === model.id && styles.modelOptionSelected,
                  ]}
                  onPress={() => setSelectedModel(model.id)}
                >
                  <View style={styles.modelOptionInfo}>
                    <Text style={styles.modelOptionName}>{model.name}</Text>
                    <Text style={styles.modelOptionDesc}>{model.description}</Text>
                  </View>
                  {selectedModel === model.id && (
                    <FontAwesome name="check" size={16} color={colors.accent.green} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Create button */}
          <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
            <FontAwesome name="plus" size={14} color={colors.bg.primary} />
            <Text style={styles.createButtonText}>Create Chat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  projectContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  projectContextText: {
    fontSize: 12,
    color: colors.accent.purple,
    fontWeight: '500',
    maxWidth: 200,
  },
  close: {
    padding: spacing.sm,
  },
  section: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  nameInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  providerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  modelList: {
    padding: spacing.md,
    paddingTop: 0,
    maxHeight: 200,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg.secondary,
  },
  modelOptionSelected: {
    backgroundColor: colors.accent.purple + '15',
    borderWidth: 1,
    borderColor: colors.accent.purple + '30',
  },
  modelOptionInfo: {
    flex: 1,
  },
  modelOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modelOptionDesc: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.purple,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bg.primary,
  },
});
