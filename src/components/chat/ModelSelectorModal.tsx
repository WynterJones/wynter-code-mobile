import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { AIProvider, AIModel, AIMode } from '@/src/types';
import { PROVIDER_MODES } from '@/src/types';
import { colors, spacing, borderRadius } from '@/src/theme';
import { ProviderIcon } from './ProviderIcon';
import { PROVIDER_COLORS, MODELS } from './shared';

interface ModelSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  currentProvider: AIProvider;
  currentModel?: AIModel;
  currentMode?: AIMode;
  onSelect: (provider: AIProvider, model: AIModel, mode: AIMode) => void;
}

export function ModelSelectorModal({
  visible,
  onClose,
  currentProvider,
  currentModel,
  currentMode,
  onSelect,
}: ModelSelectorModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(currentProvider);
  const [selectedModel, setSelectedModel] = useState<AIModel | undefined>(currentModel);
  const [selectedMode, setSelectedMode] = useState<AIMode>(currentMode || 'normal');

  // Reset selections when provider changes
  useEffect(() => {
    const models = MODELS.filter((m) => m.provider === selectedProvider);
    if (models.length > 0 && !models.find(m => m.id === selectedModel)) {
      setSelectedModel(models[0].id);
    }
    // Reset mode if not available for new provider
    const modes = PROVIDER_MODES[selectedProvider];
    if (!modes.find(m => m.id === selectedMode)) {
      setSelectedMode('normal');
    }
  }, [selectedProvider]);

  const filteredModels = useMemo(
    () => MODELS.filter((m) => m.provider === selectedProvider),
    [selectedProvider]
  );

  const availableModes = PROVIDER_MODES[selectedProvider] || [];

  const providers: { id: AIProvider; name: string }[] = [
    { id: 'claude', name: 'Claude' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Gemini' },
  ];

  const handleApply = () => {
    if (selectedModel) {
      onSelect(selectedProvider, selectedModel, selectedMode);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Model</Text>
            <TouchableOpacity onPress={onClose} style={styles.close}>
              <FontAwesome name="times" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Provider tabs */}
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

          {/* Mode selector */}
          <View style={styles.section}>
            <Text style={styles.label}>Mode</Text>
            <View style={styles.modeSelector}>
              {availableModes.map((modeOption) => (
                <TouchableOpacity
                  key={modeOption.id}
                  style={[
                    styles.modeOption,
                    selectedMode === modeOption.id && styles.modeOptionSelected,
                  ]}
                  onPress={() => setSelectedMode(modeOption.id)}
                >
                  <Text style={[
                    styles.modeOptionText,
                    selectedMode === modeOption.id && styles.modeOptionTextSelected,
                  ]}>
                    {modeOption.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Model list */}
          <ScrollView style={styles.modelList}>
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

          {/* Apply button */}
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <FontAwesome name="check" size={14} color={colors.bg.primary} />
            <Text style={styles.applyButtonText}>Apply Changes</Text>
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
  close: {
    padding: spacing.sm,
  },
  providerTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: spacing.md,
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
  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeOption: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeOptionSelected: {
    backgroundColor: colors.accent.purple + '15',
    borderColor: colors.accent.purple + '30',
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  modeOptionTextSelected: {
    color: colors.accent.purple,
  },
  modelList: {
    padding: spacing.lg,
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
  applyButton: {
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
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bg.primary,
  },
});
