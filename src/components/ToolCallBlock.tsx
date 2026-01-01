/**
 * ToolCallBlock - displays a tool call with expandable details
 * Similar to desktop's ToolCallBlock.tsx
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, borderRadius } from '@/src/theme';
import type { ToolCall } from '@/src/types';

// Tool icons and colors mapping
const TOOL_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  Bash: { icon: 'terminal', color: '#f9e2af', label: 'Terminal' },
  Read: { icon: 'file-text-o', color: '#a6e3a1', label: 'Read' },
  Write: { icon: 'pencil', color: '#cba6f7', label: 'Write' },
  Edit: { icon: 'edit', color: '#89b4fa', label: 'Edit' },
  Grep: { icon: 'search', color: '#89dceb', label: 'Search' },
  Glob: { icon: 'folder-open-o', color: '#fab387', label: 'Glob' },
  WebFetch: { icon: 'globe', color: '#74c7ec', label: 'Fetch' },
  WebSearch: { icon: 'search', color: '#74c7ec', label: 'Web Search' },
  TodoWrite: { icon: 'list', color: '#94e2d5', label: 'Todo' },
  Task: { icon: 'rocket', color: '#cba6f7', label: 'Agent' },
  NotebookEdit: { icon: 'book', color: '#f5c2e7', label: 'Notebook' },
};

interface ToolCallBlockProps {
  tool: ToolCall;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function ToolCallBlock({ tool, isExpanded = false, onToggle }: ToolCallBlockProps) {
  const config = TOOL_CONFIG[tool.name] || { icon: 'cog', color: colors.text.secondary, label: tool.name };
  const statusColor = getStatusColor(tool.status);

  const inputSummary = getInputSummary(tool.name, tool.input);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
            <FontAwesome name={config.icon as any} size={14} color={config.color} />
          </View>
          <Text style={styles.toolName}>{config.label}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '30' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{tool.status}</Text>
          </View>
        </View>
        <FontAwesome
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {/* Summary line */}
      {inputSummary && (
        <Text style={styles.summary} numberOfLines={isExpanded ? undefined : 1}>
          {inputSummary}
        </Text>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Tool Input */}
          {tool.input && (
            <ToolInputDisplay name={tool.name} input={tool.input} />
          )}

          {/* Tool Output */}
          {tool.output && (
            <View style={styles.outputSection}>
              <Text style={styles.sectionLabel}>Output</Text>
              <ScrollView horizontal style={styles.outputScroll}>
                <CodeBlock content={tool.output} maxLines={20} />
              </ScrollView>
            </View>
          )}

          {/* Error indicator */}
          {tool.isError && (
            <View style={styles.errorBadge}>
              <FontAwesome name="exclamation-triangle" size={12} color={colors.accent.red} />
              <Text style={styles.errorText}>Error</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// Tool input display component
function ToolInputDisplay({ name, input }: { name: string; input: Record<string, unknown> }) {
  switch (name) {
    case 'Bash':
      return <BashInputDisplay input={input} />;
    case 'Read':
      return <FileInputDisplay input={input} action="Reading" />;
    case 'Write':
      return <FileInputDisplay input={input} action="Writing" />;
    case 'Edit':
      return <EditInputDisplay input={input} />;
    case 'Grep':
      return <GrepInputDisplay input={input} />;
    case 'Glob':
      return <GlobInputDisplay input={input} />;
    case 'Task':
      return <TaskInputDisplay input={input} />;
    default:
      return <JsonInputDisplay input={input} />;
  }
}

// Bash command display
function BashInputDisplay({ input }: { input: Record<string, unknown> }) {
  const command = input.command as string || '';
  const description = input.description as string;

  return (
    <View style={styles.inputSection}>
      {description && <Text style={styles.description}>{description}</Text>}
      <View style={styles.codeContainer}>
        <Text style={styles.codePrefix}>$</Text>
        <Text style={styles.bashCommand}>{command}</Text>
      </View>
    </View>
  );
}

// File operation display
function FileInputDisplay({ input, action }: { input: Record<string, unknown>; action: string }) {
  const filePath = (input.file_path || input.path) as string || '';
  const displayPath = filePath.replace(/^\/Users\/[^/]+\//, '~/');

  return (
    <View style={styles.inputSection}>
      <View style={styles.filePathContainer}>
        <FontAwesome name="file-o" size={12} color={colors.text.muted} />
        <Text style={styles.filePath}>{displayPath}</Text>
      </View>
    </View>
  );
}

// Edit diff display
function EditInputDisplay({ input }: { input: Record<string, unknown> }) {
  const filePath = (input.file_path || input.path) as string || '';
  const oldString = input.old_string as string || '';
  const newString = input.new_string as string || '';
  const displayPath = filePath.replace(/^\/Users\/[^/]+\//, '~/');

  return (
    <View style={styles.inputSection}>
      <View style={styles.filePathContainer}>
        <FontAwesome name="file-o" size={12} color={colors.text.muted} />
        <Text style={styles.filePath}>{displayPath}</Text>
      </View>

      {oldString && (
        <View style={styles.diffSection}>
          <Text style={styles.diffLabel}>- Remove:</Text>
          <CodeBlock content={oldString} style="deletion" maxLines={10} />
        </View>
      )}

      {newString && (
        <View style={styles.diffSection}>
          <Text style={styles.diffLabelAdd}>+ Add:</Text>
          <CodeBlock content={newString} style="addition" maxLines={10} />
        </View>
      )}
    </View>
  );
}

// Grep search display
function GrepInputDisplay({ input }: { input: Record<string, unknown> }) {
  const pattern = input.pattern as string || '';
  const path = (input.path || '.') as string;

  return (
    <View style={styles.inputSection}>
      <View style={styles.searchContainer}>
        <Text style={styles.searchLabel}>Pattern:</Text>
        <Text style={styles.searchPattern}>{pattern}</Text>
      </View>
      <View style={styles.searchContainer}>
        <Text style={styles.searchLabel}>Path:</Text>
        <Text style={styles.searchPath}>{path}</Text>
      </View>
    </View>
  );
}

// Glob pattern display
function GlobInputDisplay({ input }: { input: Record<string, unknown> }) {
  const pattern = input.pattern as string || '';
  const path = (input.path || '.') as string;

  return (
    <View style={styles.inputSection}>
      <View style={styles.searchContainer}>
        <Text style={styles.searchLabel}>Pattern:</Text>
        <Text style={styles.searchPattern}>{pattern}</Text>
      </View>
    </View>
  );
}

// Task/Agent display
function TaskInputDisplay({ input }: { input: Record<string, unknown> }) {
  const subagentType = input.subagent_type as string || 'general';
  const prompt = input.prompt as string || '';

  return (
    <View style={styles.inputSection}>
      <View style={styles.agentBadge}>
        <FontAwesome name="rocket" size={12} color={colors.accent.purple} />
        <Text style={styles.agentType}>{subagentType}</Text>
      </View>
      {prompt && (
        <Text style={styles.agentPrompt} numberOfLines={3}>{prompt}</Text>
      )}
    </View>
  );
}

// Generic JSON display
function JsonInputDisplay({ input }: { input: Record<string, unknown> }) {
  const json = JSON.stringify(input, null, 2);
  return (
    <View style={styles.inputSection}>
      <CodeBlock content={json} maxLines={15} />
    </View>
  );
}

// Simple code block component
interface CodeBlockProps {
  content: string;
  style?: 'default' | 'addition' | 'deletion';
  maxLines?: number;
}

export function CodeBlock({ content, style = 'default', maxLines = 50 }: CodeBlockProps) {
  const lines = content.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const truncated = maxLines && lines.length > maxLines;

  const bgColor = style === 'addition' ? '#a6e3a115' :
                  style === 'deletion' ? '#f38ba815' :
                  '#1e1e2e';
  const borderColor = style === 'addition' ? '#a6e3a140' :
                      style === 'deletion' ? '#f38ba840' :
                      colors.border;

  return (
    <View style={[styles.codeBlock, { backgroundColor: bgColor, borderColor }]}>
      {displayLines.map((line, i) => (
        <View key={i} style={styles.codeLine}>
          <Text style={styles.lineNumber}>{i + 1}</Text>
          <Text style={styles.codeText}>{line || ' '}</Text>
        </View>
      ))}
      {truncated && (
        <Text style={styles.truncatedText}>... {lines.length - maxLines} more lines</Text>
      )}
    </View>
  );
}

// Helper functions
function getStatusColor(status: ToolCall['status']): string {
  switch (status) {
    case 'running': return colors.accent.yellow;
    case 'pending': return colors.accent.blue;
    case 'completed': return colors.accent.green;
    case 'approved': return colors.accent.green;
    case 'error': return colors.accent.red;
    case 'rejected': return colors.accent.red;
    default: return colors.text.muted;
  }
}

function getInputSummary(name: string, input?: Record<string, unknown>): string {
  if (!input) return '';

  if (input.command) return input.command as string;
  if (input.file_path) {
    const path = input.file_path as string;
    return path.replace(/^\/Users\/[^/]+\//, '~/');
  }
  if (input.path) {
    const path = input.path as string;
    return path.replace(/^\/Users\/[^/]+\//, '~/');
  }
  if (input.pattern) return `/${input.pattern as string}/`;
  if (input.query) return (input.query as string).slice(0, 50);
  if (input.url) return input.url as string;
  if (input.prompt) return (input.prompt as string).slice(0, 50) + '...';
  if (input.subagent_type) return `Agent: ${input.subagent_type}`;

  return '';
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.xs,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolName: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  summary: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'monospace',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.sm,
  },
  inputSection: {
    marginBottom: spacing.sm,
  },
  outputSection: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  outputScroll: {
    maxHeight: 200,
  },
  description: {
    color: colors.text.secondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e1e2e',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  codePrefix: {
    color: colors.accent.green,
    fontFamily: 'monospace',
    fontSize: 13,
    marginRight: spacing.xs,
  },
  bashCommand: {
    color: '#f9e2af',
    fontFamily: 'monospace',
    fontSize: 13,
    flex: 1,
  },
  filePathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.tertiary,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  filePath: {
    color: colors.accent.blue,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  diffSection: {
    marginTop: spacing.xs,
  },
  diffLabel: {
    color: colors.accent.red,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  diffLabelAdd: {
    color: colors.accent.green,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  searchLabel: {
    color: colors.text.muted,
    fontSize: 11,
  },
  searchPattern: {
    color: colors.accent.cyan,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  searchPath: {
    color: colors.text.secondary,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  agentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.purple + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  agentType: {
    color: colors.accent.purple,
    fontSize: 12,
    fontWeight: '600',
  },
  agentPrompt: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  codeBlock: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.xs,
    overflow: 'hidden',
  },
  codeLine: {
    flexDirection: 'row',
    minHeight: 18,
  },
  lineNumber: {
    color: colors.text.muted,
    fontFamily: 'monospace',
    fontSize: 11,
    width: 30,
    textAlign: 'right',
    marginRight: spacing.xs,
    opacity: 0.5,
  },
  codeText: {
    color: colors.text.primary,
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  truncatedText: {
    color: colors.text.muted,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.red + '20',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.accent.red,
    fontSize: 11,
    fontWeight: '600',
  },
});
