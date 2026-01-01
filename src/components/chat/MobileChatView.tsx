import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { MobileChatSession, MobileChatMessage } from '@/src/stores/mobileChatStore';
import { useMobileChatStore } from '@/src/stores';
import { sendMobileChatMessage, MobileChatChunk } from '@/src/api/client';
import { colors, spacing, borderRadius } from '@/src/theme';
import type { AIProvider, AIModel, AIMode } from '@/src/types';
import { PROVIDER_MODES } from '@/src/types';
import { ProviderIcon } from './ProviderIcon';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { PulsingDots } from './PulsingDots';
import { ModelSelectorModal } from './ModelSelectorModal';
import { PROVIDER_COLORS, getModelName } from './shared';

interface MobileChatViewProps {
  session: MobileChatSession;
  onBack: () => void;
}

export function MobileChatView({ session, onBack }: MobileChatViewProps) {
  const [inputText, setInputText] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const {
    getSessionMessages,
    addMessage,
    updateSession,
    deleteSession,
    selectSession,
    streamingState,
    startStreaming,
    appendStreamContent,
    startToolCall,
    completeToolCall,
    endStreaming,
  } = useMobileChatStore();

  const handleDeleteChat = () => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${session.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(session.id);
            selectSession(null);
            onBack();
          },
        },
      ]
    );
  };

  const messages = getSessionMessages(session.id);
  const isStreaming = streamingState?.sessionId === session.id && streamingState?.isStreaming;

  const provider = session.provider || 'claude';
  const providerColor = PROVIDER_COLORS[provider];

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingState?.content]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    const content = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Add user message
    const userMessage: MobileChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: session.id,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    addMessage(session.id, userMessage);

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now() + 1}`;
    const assistantMessage: MobileChatMessage = {
      id: assistantMessageId,
      sessionId: session.id,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    addMessage(session.id, assistantMessage);
    startStreaming(session.id, assistantMessageId);

    try {
      // Build history from previous messages (limit to last 10)
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Send to API with streaming
      await sendMobileChatMessage(
        {
          provider: session.provider,
          model: session.model,
          mode: session.mode || 'normal',
          message: content,
          cwd: session.projectPath,
          history,
        },
        (chunk: MobileChatChunk) => {
          if (chunk.type === 'content' && chunk.content) {
            appendStreamContent(chunk.content);
          } else if (chunk.type === 'tool_start') {
            // Start a new tool call
            const toolId = chunk.tool_id || `tool-${Date.now()}`;
            startToolCall({
              id: toolId,
              name: chunk.tool_name || 'unknown',
              status: 'running',
              input: chunk.tool_input,
              startedAt: Date.now(),
            });
          } else if (chunk.type === 'tool_result') {
            // Complete the tool call
            const toolId = chunk.tool_id || '';
            completeToolCall(toolId, chunk.tool_output, chunk.tool_is_error);
          } else if (chunk.type === 'tool_error') {
            // Tool errored
            const toolId = chunk.tool_id || '';
            completeToolCall(toolId, chunk.error || chunk.tool_output, true);
          } else if (chunk.type === 'thinking') {
            // Append thinking content (could be styled differently if needed)
            if (chunk.content) {
              appendStreamContent(chunk.content);
            }
          } else if (chunk.type === 'done') {
            endStreaming();
          } else if (chunk.type === 'error') {
            endStreaming();
            Alert.alert('Error', chunk.error || 'Failed to get response');
          }
        }
      );
    } catch (error) {
      console.error('[MobileChat] Send error:', error);
      endStreaming();
      Alert.alert('Error', 'Failed to send message. Check your connection.');
    } finally {
      setIsSending(false);
    }
  };

  const handleModelChange = async (newProvider: AIProvider, newModel: AIModel, newMode: AIMode) => {
    await updateSession(session.id, { provider: newProvider, model: newModel, mode: newMode });
    setShowModelSelector(false);
  };

  const mode = session.mode || 'normal';
  const modeLabel = PROVIDER_MODES[provider]?.find(m => m.id === mode)?.name || 'Normal';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Header with provider/model selector */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={16} color={colors.accent.blue} />
            <Text style={styles.backText}>Chats</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.providerButton, { borderColor: providerColor + '50' }]}
              onPress={() => setShowModelSelector(true)}
            >
              <ProviderIcon provider={provider} size={14} />
              <Text style={[styles.providerButtonText, { color: providerColor }]}>
                {getModelName(session.model)}
              </Text>
              {mode !== 'normal' && (
                <View style={[styles.modeBadge, { backgroundColor: mode === 'auto' ? colors.accent.green + '30' : colors.accent.yellow + '30' }]}>
                  <Text style={[styles.modeBadgeText, { color: mode === 'auto' ? colors.accent.green : colors.accent.yellow }]}>
                    {modeLabel}
                  </Text>
                </View>
              )}
              <FontAwesome name="chevron-down" size={10} color={providerColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteChat} style={styles.deleteButton}>
              <FontAwesome name="trash-o" size={18} color={colors.accent.red} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={1}>{session.name}</Text>
          <Text style={styles.subtitle}>Mobile Chat</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={scrollViewRef as any}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            providerColor={providerColor}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <ProviderIcon provider={provider} size={32} />
            <Text style={styles.emptyChatText}>Start a conversation</Text>
            <Text style={styles.emptyChatSubtext}>
              Messages are stored locally on your device
            </Text>
          </View>
        }
        ListFooterComponent={
          <>
            {/* Streaming indicator with content */}
            {isStreaming && streamingState && !messages.find((m) => m.id === streamingState.messageId) && (
              <StreamingMessage
                content={streamingState.content}
                currentTool={streamingState.currentTool}
                toolCalls={streamingState.toolCalls}
                providerColor={providerColor}
              />
            )}

            {/* Typing indicator when sending */}
            {isSending && !isStreaming && (
              <View style={styles.typingIndicator}>
                <PulsingDots />
              </View>
            )}
          </>
        }
        maxToRenderPerBatch={15}
        windowSize={7}
        initialNumToRender={15}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: spacing.md + insets.bottom + 60 }]}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={colors.text.muted}
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          <FontAwesome
            name="send"
            size={16}
            color={inputText.trim() ? colors.bg.primary : colors.text.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Model Selector Modal */}
      <ModelSelectorModal
        visible={showModelSelector}
        onClose={() => setShowModelSelector(false)}
        currentProvider={provider}
        currentModel={session.model}
        currentMode={mode}
        onSelect={handleModelChange}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backText: {
    fontSize: 14,
    color: colors.accent.blue,
    fontWeight: '500',
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    backgroundColor: colors.bg.tertiary,
  },
  providerButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  modeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginLeft: spacing.xs,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  headerInfo: {
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.muted,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyChatText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
  },
  typingIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    maxHeight: 120,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.bg.tertiary,
  },
});
