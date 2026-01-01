import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ToolCall } from '@/src/types';
import { colors, spacing, borderRadius } from '@/src/theme';
import { MarkdownRenderer } from '@/src/components/MarkdownRenderer';
import { ToolCallBlock } from '@/src/components/ToolCallBlock';
import { PulsingDots } from './PulsingDots';

interface StreamingMessageProps {
  content: string;
  currentTool?: ToolCall;
  toolCalls?: ToolCall[];
  providerColor: string;
}

export function StreamingMessage({
  content,
  currentTool,
  toolCalls,
  providerColor,
}: StreamingMessageProps) {
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
    <View style={styles.container}>
      <View style={styles.bubble}>
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

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  bubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bg.card,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolCallsContainer: {
    marginTop: spacing.md,
    gap: spacing.xs,
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
  streamingIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
});
