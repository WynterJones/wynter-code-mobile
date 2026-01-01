import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore, useMobileChatStore, useProjectStore } from '@/src/stores';
import { sendMobileChatMessage, MobileChatChunk } from '@/src/api/client';
import { BlueprintGrid } from '@/src/components/BlueprintGrid';
import { GlassButton } from '@/src/components/GlassButton';
import { ToolCallBlock } from '@/src/components/ToolCallBlock';
import { MarkdownRenderer } from '@/src/components/MarkdownRenderer';
import type { AIProvider, AIModel, AIMode, ModelInfo, ToolCall } from '@/src/types';
import { PROVIDER_MODES } from '@/src/types';
import type { MobileChatSession, MobileChatMessage } from '@/src/stores/mobileChatStore';

// Provider colors
const PROVIDER_COLORS: Record<AIProvider, string> = {
  claude: '#D97757',
  openai: '#10A37F',
  gemini: '#4285F4',
};

// Model configurations
const MODELS: ModelInfo[] = [
  // Claude
  { id: 'claude-opus-4-20250514', name: 'Opus', description: 'Most capable', provider: 'claude' },
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet', description: 'Balanced', provider: 'claude' },
  { id: 'claude-3-5-haiku-20241022', name: 'Haiku', description: 'Fastest', provider: 'claude' },
  // OpenAI
  { id: 'gpt-5.2-codex', name: 'Codex', description: 'Balanced', provider: 'openai' },
  { id: 'gpt-5.1-codex-max', name: 'Max', description: 'Most capable', provider: 'openai' },
  { id: 'gpt-5.1-codex-mini', name: 'Mini', description: 'Fastest', provider: 'openai' },
  // Gemini
  { id: 'gemini-3-pro-preview', name: 'Pro 3', description: 'Preview', provider: 'gemini' },
  { id: 'gemini-3-flash-preview', name: 'Flash 3', description: 'Fast preview', provider: 'gemini' },
  { id: 'gemini-2.5-flash', name: 'Flash 2.5', description: 'Fast', provider: 'gemini' },
  { id: 'gemini-2.5-pro', name: 'Pro 2.5', description: 'Most capable', provider: 'gemini' },
];

const DEFAULT_PROVIDER: AIProvider = 'claude';
const DEFAULT_MODEL: AIModel = 'claude-sonnet-4-20250514';

export default function ChatScreen() {
  const router = useRouter();
  const connection = useConnectionStore((s) => s.connection);
  const {
    sessions,
    selectedSessionId,
    isLoading,
    error,
    selectSession,
    loadSessions,
  } = useMobileChatStore();

  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  const onRefresh = useCallback(async () => {
    await loadSessions();
  }, [loadSessions]);

  if (!connection.device) {
    return (
      <View style={styles.container}>
        <BlueprintGrid>
          <View style={styles.emptyState}>
            <View style={styles.iconContainer}>
              <Image source={require('@/assets/images/icon.png')} style={styles.logoImage} />
            </View>
            <Text style={styles.emptyTitle}>Not Connected</Text>
            <Text style={styles.emptyText}>Connect to your desktop to start chatting with AI.</Text>
            <GlassButton
              onPress={() => router.push('/modal')}
              label="Connect to Desktop"
              icon="qrcode"
              size="large"
            />
          </View>
        </BlueprintGrid>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mobile Chats</Text>
        </View>
        <BlueprintGrid>
          <View style={styles.emptyState}>
            <View style={styles.iconContainerError}>
              <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
            </View>
            <Text style={styles.emptyTitle}>Failed to Load</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <GlassButton
              onPress={() => router.push('/modal')}
              label="Check Connection"
              icon="link"
              variant="danger"
              size="large"
            />
          </View>
        </BlueprintGrid>
      </View>
    );
  }

  if (selectedSession) {
    return (
      <MobileChatView
        session={selectedSession}
        onBack={() => selectSession(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mobile Chats</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => setShowNewChatModal(true)}
        >
          <FontAwesome name="plus" size={14} color={colors.bg.primary} />
          <Text style={styles.newChatButtonText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.sessionList}
        contentContainerStyle={styles.sessionListContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.accent.purple} />
        }
      >
        {isLoading && sessions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.purple} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyList}>
            <FontAwesome name="comments-o" size={32} color={colors.text.muted} />
            <Text style={styles.emptyListText}>No chats yet</Text>
            <Text style={styles.emptyListSubtext}>Create a new chat to get started</Text>
            <TouchableOpacity
              style={styles.emptyNewChat}
              onPress={() => setShowNewChatModal(true)}
            >
              <FontAwesome name="plus" size={14} color={colors.accent.purple} />
              <Text style={styles.emptyNewChatText}>Start New Chat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onPress={() => selectSession(session.id)}
            />
          ))
        )}
      </ScrollView>

      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
      />
    </View>
  );
}

// Session card with provider icon
function SessionCard({ session, onPress }: { session: MobileChatSession; onPress: () => void }) {
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
      style={styles.sessionCard}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.sessionIcon, { backgroundColor: providerColor + '20' }]}>
        <ProviderIcon provider={provider} size={20} />
      </View>
      <View style={styles.sessionContent}>
        <Text style={styles.sessionName}>{session.name}</Text>
        <View style={styles.sessionMetaRow}>
          <Text style={styles.sessionMeta}>{session.messageCount} messages</Text>
          {session.model && (
            <View style={[styles.modelBadge, { backgroundColor: providerColor + '15' }]}>
              <Text style={[styles.modelBadgeText, { color: providerColor }]}>
                {getModelName(session.model)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.sessionTime}>
        <Text style={styles.sessionTimeText}>{formatRelativeTime(session.updatedAt)}</Text>
        <FontAwesome name="chevron-right" size={12} color={colors.text.muted} />
      </View>
    </TouchableOpacity>
  );
}

// Provider icon component
function ProviderIcon({ provider, size = 16 }: { provider: AIProvider; size?: number }) {
  const color = PROVIDER_COLORS[provider];

  // Use FontAwesome icons with provider colors
  const icons: Record<AIProvider, string> = {
    claude: 'comment',
    openai: 'bolt',
    gemini: 'diamond',
  };

  return (
    <FontAwesome name={icons[provider] as any} size={size} color={color} />
  );
}

function getModelName(modelId: AIModel): string {
  const model = MODELS.find((m) => m.id === modelId);
  return model?.name || modelId;
}

// New Chat Modal
function NewChatModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Chat</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <FontAwesome name="times" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Chat name input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Chat Name (optional)</Text>
            <TextInput
              style={styles.nameInput}
              value={chatName}
              onChangeText={setChatName}
              placeholder={`Chat ${new Date().toLocaleDateString()}`}
              placeholderTextColor={colors.text.muted}
            />
          </View>

          {/* Provider tabs */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>AI Provider</Text>
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
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Model</Text>
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

// Mobile Chat view with streaming support
function MobileChatView({
  session,
  onBack,
}: {
  session: MobileChatSession;
  onBack: () => void;
}) {
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
      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderTop}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={16} color={colors.accent.blue} />
            <Text style={styles.backText}>Chats</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderActions}>
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
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatTitle} numberOfLines={1}>{session.name}</Text>
          <Text style={styles.chatSubtitle}>Mobile Chat</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <ProviderIcon provider={provider} size={32} />
            <Text style={styles.emptyChatText}>Start a conversation</Text>
            <Text style={styles.emptyChatSubtext}>
              Messages are stored locally on your device
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              providerColor={providerColor}
            />
          ))
        )}

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
      </ScrollView>

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

// Streaming message component
function StreamingMessage({
  content,
  currentTool,
  toolCalls,
  providerColor,
}: {
  content: string;
  currentTool?: ToolCall;
  toolCalls?: ToolCall[];
  providerColor: string;
}) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  return (
    <View style={styles.messageContainer}>
      <View style={styles.assistantBubble}>
        {/* Render content with markdown */}
        {content ? (
          <MarkdownRenderer content={content} isStreaming />
        ) : currentTool ? (
          <View style={styles.inlineToolUse}>
            <View style={[styles.inlineToolIcon, { backgroundColor: colors.accent.cyan + '20' }]}>
              <FontAwesome name="cog" size={12} color={colors.accent.cyan} />
            </View>
            <Text style={styles.inlineToolText}>Using {currentTool.name}...</Text>
          </View>
        ) : (
          <PulsingDots />
        )}

        {/* Show completed tool calls */}
        {toolCalls && toolCalls.length > 0 && (
          <View style={styles.toolCallsContainer}>
            {toolCalls.map((tool) => (
              <ToolCallBlock
                key={tool.id}
                tool={tool}
                isExpanded={expandedTools.has(tool.id)}
                onToggle={() => toggleTool(tool.id)}
              />
            ))}
          </View>
        )}

        {/* Show current running tool */}
        {content && currentTool && (
          <View style={[styles.inlineToolUse, { marginTop: spacing.sm }]}>
            <View style={[styles.inlineToolIcon, { backgroundColor: colors.accent.cyan + '20' }]}>
              <FontAwesome name="cog" size={12} color={colors.accent.cyan} />
            </View>
            <Text style={styles.inlineToolText}>Using {currentTool.name}...</Text>
          </View>
        )}
      </View>
      <View style={[styles.streamingIndicator, { backgroundColor: providerColor }]} />
    </View>
  );
}

// Pulsing dots animation
function PulsingDots() {
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (value: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      );
    };

    const anim1 = animate(opacity1, 0);
    const anim2 = animate(opacity2, 150);
    const anim3 = animate(opacity3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  return (
    <View style={styles.pulsingDotsContainer}>
      <Animated.View style={[styles.pulsingDot, { opacity: opacity1 }]} />
      <Animated.View style={[styles.pulsingDot, { opacity: opacity2 }]} />
      <Animated.View style={[styles.pulsingDot, { opacity: opacity3 }]} />
    </View>
  );
}

// Message bubble
function MessageBubble({
  message,
  providerColor,
}: {
  message: MobileChatMessage;
  providerColor: string;
}) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  return (
    <View style={styles.messageContainer}>
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {message.content ? (
          isUser ? (
            <Text style={[styles.messageText, styles.userText]}>{message.content}</Text>
          ) : (
            <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
          )
        ) : isStreaming ? (
          <PulsingDots />
        ) : null}

        {/* Tool Calls with expandable details */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <View style={styles.toolCallsContainer}>
            {message.toolCalls.map((toolCall) => (
              <ToolCallBlock
                key={toolCall.id}
                tool={toolCall}
                isExpanded={expandedTools.has(toolCall.id)}
                onToggle={() => toggleTool(toolCall.id)}
              />
            ))}
          </View>
        )}
      </View>
      {!isStreaming && (
        <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>
          {formatTime(message.timestamp)}
        </Text>
      )}
      {isStreaming && (
        <View style={[styles.streamingIndicator, { backgroundColor: providerColor }]} />
      )}
    </View>
  );
}

// Inline tool call component (compact design, read-only for mobile)
function InlineToolCall({ toolCall }: { toolCall: ToolCall }) {
  const toolIcons: Record<string, string> = {
    Read: 'file-text-o',
    Edit: 'pencil',
    Write: 'save',
    Bash: 'terminal',
    Grep: 'search',
    Glob: 'folder-o',
    Task: 'tasks',
    WebFetch: 'globe',
    WebSearch: 'search',
  };

  const statusConfig: Record<string, { color: string; icon: string }> = {
    pending: { color: colors.accent.yellow, icon: 'clock-o' },
    approved: { color: colors.accent.blue, icon: 'check' },
    completed: { color: colors.accent.green, icon: 'check-circle' },
    rejected: { color: colors.accent.red, icon: 'times-circle' },
  };

  const config = statusConfig[toolCall.status];

  return (
    <View style={[styles.inlineToolCard, { borderLeftColor: config.color }]}>
      <View style={styles.inlineToolHeader}>
        <FontAwesome
          name={toolIcons[toolCall.name] as any || 'cog'}
          size={12}
          color={config.color}
        />
        <Text style={styles.inlineToolName}>{toolCall.name}</Text>
        <View style={[styles.inlineToolStatus, { backgroundColor: config.color + '20' }]}>
          <FontAwesome name={config.icon as any} size={10} color={config.color} />
        </View>
      </View>
    </View>
  );
}

// Model selector modal
function ModelSelectorModal({
  visible,
  onClose,
  currentProvider,
  currentModel,
  currentMode,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  currentProvider: AIProvider;
  currentModel?: AIModel;
  currentMode?: AIMode;
  onSelect: (provider: AIProvider, model: AIModel, mode: AIMode) => void;
}) {
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Model</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
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
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Mode</Text>
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
          <TouchableOpacity style={styles.createButton} onPress={handleApply}>
            <FontAwesome name="check" size={14} color={colors.bg.primary} />
            <Text style={styles.createButtonText}>Apply Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  newChatButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg.primary,
  },
  sessionList: {
    flex: 1,
  },
  sessionListContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyList: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyListText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
  },
  emptyNewChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.purple + '50',
    borderStyle: 'dashed',
  },
  emptyNewChatText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent.purple,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  sessionCard: {
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
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionContent: {
    flex: 1,
  },
  sessionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionMeta: {
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
  sessionTime: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  sessionTimeText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  chatHeader: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatHeaderTop: {
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
  chatHeaderActions: {
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
  chatHeaderInfo: {
    gap: 2,
  },
  chatTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chatSubtitle: {
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
  messageContainer: {
    marginBottom: spacing.md,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  userBubble: {
    backgroundColor: colors.accent.purple,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.bg.card,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  userText: {
    color: colors.bg.primary,
  },
  messageTime: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  messageTimeUser: {
    textAlign: 'right',
  },
  // Inline tool calls
  inlineToolCalls: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  toolCallsContainer: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  inlineToolCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
  },
  inlineToolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineToolName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  inlineToolStatus: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineToolUse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineToolIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineToolText: {
    fontSize: 13,
    color: colors.accent.cyan,
    fontWeight: '500',
  },
  // Streaming
  streamingIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  typingIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pulsingDotsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
  },
  // Input
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
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
  inputSection: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  inputLabel: {
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
  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  iconContainerError: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent.red + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    maxWidth: 280,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  buttonText: {
    color: colors.bg.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
