import React, { useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MobileChatMessage } from '@/src/stores/mobileChatStore';
import { colors, spacing, borderRadius } from '@/src/theme';
import { MarkdownRenderer } from '@/src/components/MarkdownRenderer';
import { ToolCallBlock } from '@/src/components/ToolCallBlock';
import { PulsingDots } from './PulsingDots';
import { formatTime } from './shared';

interface MessageBubbleProps {
  message: MobileChatMessage;
  providerColor: string;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  providerColor,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const hasContent = message.content && message.content.trim().length > 0;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

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

  // Don't render empty bubbles (no content, not streaming, no tool calls)
  if (!hasContent && !isStreaming && !hasToolCalls) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {hasContent ? (
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
});

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  bubble: {
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
  toolCallsContainer: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  streamingIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
});
