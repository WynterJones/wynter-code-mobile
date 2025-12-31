import { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useProjectStore, useConnectionStore, useChatStore } from '@/src/stores';
import {
  useSessions,
  useMessages,
  useSendMessage,
  useApproveToolCall,
  useRejectToolCall,
} from '@/src/api/hooks';
import type { ChatSession, ChatMessage, ToolCall } from '@/src/types';

export default function ChatScreen() {
  const router = useRouter();
  const connection = useConnectionStore((s) => s.connection);
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const { selectedSessionId, selectSession } = useChatStore();

  // Fetch sessions from API
  const { data: sessions = [], isLoading, refetch, isRefetching } = useSessions();

  // Find selected session
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Not connected state
  if (!connection.device) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <FontAwesome name="plug" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptyText}>
            Connect to your desktop to access chat sessions.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/modal')}>
            <Text style={styles.buttonText}>Connect to Desktop</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // No project selected
  if (!selectedProject) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <FontAwesome name="folder-o" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Project Selected</Text>
          <Text style={styles.emptyText}>
            Select a project from the Projects tab to view its chat sessions.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
            <FontAwesome name="folder" size={16} color={colors.bg.primary} />
            <Text style={styles.buttonText}>Go to Projects</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show chat view if session selected
  if (selectedSession) {
    return (
      <ChatView
        session={selectedSession}
        onBack={() => selectSession(null)}
        projectName={selectedProject.name}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.projectBadge}>
          <FontAwesome name="folder-open" size={14} color={colors.accent.purple} />
          <Text style={styles.projectName}>{selectedProject.name}</Text>
        </View>
      </View>

      {/* Sessions List */}
      <ScrollView
        style={styles.sessionList}
        contentContainerStyle={styles.sessionListContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent.purple}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.purple} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyList}>
            <FontAwesome name="comments-o" size={32} color={colors.text.muted} />
            <Text style={styles.emptyListText}>No chat sessions yet</Text>
            <Text style={styles.emptyListSubtext}>
              Sessions started on desktop will appear here
            </Text>
          </View>
        ) : (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => selectSession(session.id)}
              activeOpacity={0.7}
            >
              <View style={styles.sessionIcon}>
                <FontAwesome name="comments" size={18} color={colors.accent.cyan} />
              </View>
              <View style={styles.sessionContent}>
                <Text style={styles.sessionName}>{session.name}</Text>
                <Text style={styles.sessionMeta}>
                  {session.messageCount} messages
                </Text>
              </View>
              <View style={styles.sessionTime}>
                <Text style={styles.sessionTimeText}>
                  {formatRelativeTime(session.updatedAt)}
                </Text>
                <FontAwesome name="chevron-right" size={12} color={colors.text.muted} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ChatView({
  session,
  onBack,
  projectName,
}: {
  session: ChatSession;
  onBack: () => void;
  projectName: string;
}) {
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Get messages from store (updated in real-time via WebSocket)
  const messagesFromStore = useChatStore((s) => s.getSessionMessages(session.id));
  const streamingState = useChatStore((s) => s.streamingState);

  // Fetch messages from API (populates store on initial load)
  const { data: messages = messagesFromStore, isLoading } = useMessages(session.id);

  // Use store messages if available (more up-to-date with streaming)
  const displayMessages = messagesFromStore.length > 0 ? messagesFromStore : messages;

  // Mutations
  const sendMutation = useSendMessage();
  const approveMutation = useApproveToolCall();
  const rejectMutation = useRejectToolCall();

  const isSending = sendMutation.isPending;
  const isStreaming = streamingState?.sessionId === session.id && streamingState?.isStreaming;

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [displayMessages, streamingState?.content]);

  // Handle send message
  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const content = inputText.trim();
    setInputText('');
    sendMutation.mutate({ sessionId: session.id, content });
  };

  // Handle tool approval
  const handleToolAction = (toolId: string, action: 'approve' | 'reject') => {
    if (action === 'approve') {
      approveMutation.mutate({ sessionId: session.id, toolCallId: toolId });
    } else {
      rejectMutation.mutate({ sessionId: session.id, toolCallId: toolId });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={16} color={colors.accent.blue} />
          <Text style={styles.backText}>Sessions</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatTitle} numberOfLines={1}>{session.name}</Text>
          <Text style={styles.chatSubtitle}>{projectName}</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.purple} />
          </View>
        ) : (
          displayMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onToolAction={handleToolAction}
            />
          ))
        )}
        {(isSending || isStreaming) && (
          <View style={styles.typingIndicator}>
            {streamingState?.currentTool ? (
              <View style={styles.streamingToolBadge}>
                <FontAwesome name="cog" size={12} color={colors.accent.cyan} />
                <Text style={styles.streamingToolText}>{streamingState.currentTool}</Text>
              </View>
            ) : (
              <>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDotDelay1]} />
                <View style={[styles.typingDot, styles.typingDotDelay2]} />
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
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
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  onToolAction,
}: {
  message: ChatMessage;
  onToolAction: (toolId: string, action: 'approve' | 'reject') => void;
}) {
  const isUser = message.role === 'user';

  return (
    <View style={styles.messageContainer}>
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={[styles.messageText, isUser && styles.userText]}>
          {message.content}
        </Text>
      </View>

      {/* Tool Calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <View style={styles.toolCalls}>
          {message.toolCalls.map((toolCall) => (
            <ToolCallCard
              key={toolCall.id}
              toolCall={toolCall}
              onAction={onToolAction}
            />
          ))}
        </View>
      )}

      <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}

function ToolCallCard({
  toolCall,
  onAction,
}: {
  toolCall: ToolCall;
  onAction: (toolId: string, action: 'approve' | 'reject') => void;
}) {
  const toolIcons: Record<string, string> = {
    Read: 'file-text-o',
    Edit: 'pencil',
    Write: 'save',
    Bash: 'terminal',
    Grep: 'search',
    Glob: 'folder-o',
  };

  const statusColors: Record<string, string> = {
    pending: colors.accent.yellow,
    approved: colors.accent.blue,
    completed: colors.accent.green,
    rejected: colors.accent.red,
  };

  const isPending = toolCall.status === 'pending';

  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <View style={[styles.toolIcon, { backgroundColor: statusColors[toolCall.status] + '20' }]}>
          <FontAwesome
            name={toolIcons[toolCall.name] as any || 'cog'}
            size={14}
            color={statusColors[toolCall.status]}
          />
        </View>
        <View style={styles.toolInfo}>
          <Text style={styles.toolName}>{toolCall.name}</Text>
          {toolCall.input && (
            <Text style={styles.toolInput} numberOfLines={1}>
              {typeof toolCall.input === 'object' && 'file' in toolCall.input
                ? (toolCall.input as { file: string }).file
                : JSON.stringify(toolCall.input)}
            </Text>
          )}
        </View>
        {!isPending && (
          <View style={[styles.toolStatusBadge, { backgroundColor: statusColors[toolCall.status] + '20' }]}>
            <Text style={[styles.toolStatusText, { color: statusColors[toolCall.status] }]}>
              {toolCall.status}
            </Text>
          </View>
        )}
      </View>

      {isPending && (
        <View style={styles.toolActions}>
          <TouchableOpacity
            style={[styles.toolActionButton, styles.toolRejectButton]}
            onPress={() => onAction(toolCall.id, 'reject')}
          >
            <FontAwesome name="times" size={14} color={colors.accent.red} />
            <Text style={[styles.toolActionText, { color: colors.accent.red }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolActionButton, styles.toolApproveButton]}
            onPress={() => onAction(toolCall.id, 'approve')}
          >
            <FontAwesome name="check" size={14} color={colors.accent.green} />
            <Text style={[styles.toolActionText, { color: colors.accent.green }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sessionList: {
    flex: 1,
  },
  sessionListContent: {
    padding: spacing.md,
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
    backgroundColor: colors.accent.cyan + '20',
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
    marginBottom: 2,
  },
  sessionMeta: {
    fontSize: 13,
    color: colors.text.muted,
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: 14,
    color: colors.accent.blue,
    fontWeight: '500',
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
    paddingBottom: spacing.lg,
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
  toolCalls: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  toolCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toolIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  toolInput: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 1,
  },
  toolStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  toolStatusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  toolActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  toolActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  toolRejectButton: {
    backgroundColor: colors.accent.red + '15',
    borderWidth: 1,
    borderColor: colors.accent.red + '30',
  },
  toolApproveButton: {
    backgroundColor: colors.accent.green + '15',
    borderWidth: 1,
    borderColor: colors.accent.green + '30',
  },
  toolActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.bg.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
    opacity: 0.4,
  },
  typingDotDelay1: {
    opacity: 0.6,
  },
  typingDotDelay2: {
    opacity: 0.8,
  },
  streamingToolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accent.cyan + '20',
    borderRadius: borderRadius.full,
  },
  streamingToolText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accent.cyan,
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
    maxHeight: 100,
    minHeight: 44,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
