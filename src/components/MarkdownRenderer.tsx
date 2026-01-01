/**
 * MarkdownRenderer - renders markdown content with code block support
 * Handles inline code, code blocks with language detection, and basic formatting
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, borderRadius } from '@/src/theme';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

// Language display names and colors
const LANGUAGE_CONFIG: Record<string, { name: string; color: string }> = {
  typescript: { name: 'TypeScript', color: '#3178c6' },
  ts: { name: 'TypeScript', color: '#3178c6' },
  javascript: { name: 'JavaScript', color: '#f7df1e' },
  js: { name: 'JavaScript', color: '#f7df1e' },
  jsx: { name: 'JSX', color: '#61dafb' },
  tsx: { name: 'TSX', color: '#3178c6' },
  python: { name: 'Python', color: '#3776ab' },
  py: { name: 'Python', color: '#3776ab' },
  rust: { name: 'Rust', color: '#dea584' },
  rs: { name: 'Rust', color: '#dea584' },
  go: { name: 'Go', color: '#00add8' },
  java: { name: 'Java', color: '#b07219' },
  kotlin: { name: 'Kotlin', color: '#a97bff' },
  swift: { name: 'Swift', color: '#fa7343' },
  ruby: { name: 'Ruby', color: '#cc342d' },
  rb: { name: 'Ruby', color: '#cc342d' },
  php: { name: 'PHP', color: '#4f5d95' },
  css: { name: 'CSS', color: '#563d7c' },
  scss: { name: 'SCSS', color: '#c6538c' },
  html: { name: 'HTML', color: '#e34c26' },
  json: { name: 'JSON', color: '#292929' },
  yaml: { name: 'YAML', color: '#cb171e' },
  yml: { name: 'YAML', color: '#cb171e' },
  xml: { name: 'XML', color: '#0060ac' },
  sql: { name: 'SQL', color: '#e38c00' },
  bash: { name: 'Bash', color: '#89e051' },
  sh: { name: 'Shell', color: '#89e051' },
  shell: { name: 'Shell', color: '#89e051' },
  zsh: { name: 'Zsh', color: '#89e051' },
  markdown: { name: 'Markdown', color: '#083fa1' },
  md: { name: 'Markdown', color: '#083fa1' },
  diff: { name: 'Diff', color: '#41b883' },
  toml: { name: 'TOML', color: '#9c4121' },
  dockerfile: { name: 'Dockerfile', color: '#2496ed' },
  graphql: { name: 'GraphQL', color: '#e535ab' },
  c: { name: 'C', color: '#555555' },
  cpp: { name: 'C++', color: '#f34b7d' },
  csharp: { name: 'C#', color: '#178600' },
  cs: { name: 'C#', color: '#178600' },
};

interface ParsedBlock {
  type: 'text' | 'code' | 'inline_code';
  content: string;
  language?: string;
}

export function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'code':
            return (
              <CodeBlockView
                key={index}
                content={block.content}
                language={block.language}
              />
            );
          case 'inline_code':
            return (
              <Text key={index} style={styles.inlineCode}>
                {block.content}
              </Text>
            );
          case 'text':
            return <TextBlock key={index} content={block.content} />;
          default:
            return null;
        }
      })}
      {isStreaming && <Text style={styles.cursor}>|</Text>}
    </View>
  );
}

// Parse markdown content into blocks
function parseMarkdown(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index);
      blocks.push(...parseInlineCode(textContent));
    }

    // Add code block
    blocks.push({
      type: 'code',
      language: match[1] || undefined,
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    blocks.push(...parseInlineCode(textContent));
  }

  return blocks;
}

// Parse inline code within text
function parseInlineCode(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const inlineRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    blocks.push({
      type: 'inline_code',
      content: match[1],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    blocks.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return blocks;
}

// Text block with basic formatting
function TextBlock({ content }: { content: string }) {
  // Handle bold, italic, and basic formatting
  const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g);

  return (
    <Text style={styles.text}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <Text key={i} style={styles.italic}>{part.slice(1, -1)}</Text>;
        }
        if (part.startsWith('__') && part.endsWith('__')) {
          return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('_') && part.endsWith('_')) {
          return <Text key={i} style={styles.italic}>{part.slice(1, -1)}</Text>;
        }
        return part;
      })}
    </Text>
  );
}

// Code block with header and copy button
function CodeBlockView({ content, language }: { content: string; language?: string }) {
  const langConfig = language ? LANGUAGE_CONFIG[language.toLowerCase()] : null;
  const lines = content.split('\n');

  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
  };

  return (
    <View style={styles.codeBlockContainer}>
      {/* Header */}
      <View style={styles.codeHeader}>
        <View style={styles.codeHeaderLeft}>
          {langConfig ? (
            <View style={[styles.languageBadge, { backgroundColor: langConfig.color + '30' }]}>
              <Text style={[styles.languageText, { color: langConfig.color }]}>
                {langConfig.name}
              </Text>
            </View>
          ) : language ? (
            <Text style={styles.languageTextPlain}>{language}</Text>
          ) : null}
          <Text style={styles.lineCount}>{lines.length} lines</Text>
        </View>
        <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
          <FontAwesome name="copy" size={12} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Code content */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.codeContent}>
          {lines.map((line, i) => (
            <View key={i} style={styles.codeLine}>
              <Text style={styles.lineNumber}>{i + 1}</Text>
              <SyntaxHighlightedLine line={line} language={language} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// Basic syntax highlighting for a line
function SyntaxHighlightedLine({ line, language }: { line: string; language?: string }) {
  // Simple keyword-based highlighting
  const highlighted = useMemo(() => {
    if (!language) return [{ text: line, style: 'normal' as const }];

    const tokens: { text: string; style: 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'normal' }[] = [];
    let remaining = line;

    // Comments
    const commentMatch = remaining.match(/^(\s*)(\/\/.*|#.*)$/);
    if (commentMatch) {
      if (commentMatch[1]) tokens.push({ text: commentMatch[1], style: 'normal' });
      tokens.push({ text: commentMatch[2], style: 'comment' });
      return tokens;
    }

    // String literals
    const stringRegex = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g;
    let match;
    let lastEnd = 0;

    while ((match = stringRegex.exec(remaining)) !== null) {
      if (match.index > lastEnd) {
        tokens.push(...tokenizeCode(remaining.slice(lastEnd, match.index), language));
      }
      tokens.push({ text: match[0], style: 'string' });
      lastEnd = match.index + match[0].length;
    }

    if (lastEnd < remaining.length) {
      tokens.push(...tokenizeCode(remaining.slice(lastEnd), language));
    }

    return tokens.length ? tokens : [{ text: line, style: 'normal' as const }];
  }, [line, language]);

  return (
    <Text style={styles.codeText}>
      {highlighted.map((token, i) => (
        <Text key={i} style={getTokenStyle(token.style)}>
          {token.text}
        </Text>
      ))}
    </Text>
  );
}

// Tokenize code for keywords
function tokenizeCode(code: string, language?: string): { text: string; style: 'keyword' | 'number' | 'function' | 'normal' }[] {
  const tokens: { text: string; style: 'keyword' | 'number' | 'function' | 'normal' }[] = [];

  const keywords = getKeywords(language);
  const wordRegex = /(\b\w+\b|\s+|[^\w\s]+)/g;
  let match;

  while ((match = wordRegex.exec(code)) !== null) {
    const word = match[0];
    if (keywords.includes(word)) {
      tokens.push({ text: word, style: 'keyword' });
    } else if (/^\d+\.?\d*$/.test(word)) {
      tokens.push({ text: word, style: 'number' });
    } else if (/^\w+(?=\()/.test(word)) {
      tokens.push({ text: word, style: 'function' });
    } else {
      tokens.push({ text: word, style: 'normal' });
    }
  }

  return tokens;
}

function getKeywords(language?: string): string[] {
  const common = ['if', 'else', 'for', 'while', 'return', 'function', 'const', 'let', 'var', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'super', 'extends', 'implements', 'interface', 'type', 'enum', 'public', 'private', 'protected', 'static', 'readonly'];

  switch (language?.toLowerCase()) {
    case 'rust':
    case 'rs':
      return [...common, 'fn', 'let', 'mut', 'pub', 'mod', 'use', 'struct', 'impl', 'trait', 'where', 'match', 'loop', 'break', 'continue', 'move', 'ref', 'self', 'Self', 'dyn', 'Box', 'Vec', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err'];
    case 'python':
    case 'py':
      return [...common, 'def', 'elif', 'except', 'finally', 'in', 'is', 'lambda', 'not', 'or', 'and', 'pass', 'raise', 'with', 'yield', 'True', 'False', 'None', 'self', 'cls'];
    case 'go':
      return [...common, 'func', 'package', 'defer', 'go', 'select', 'case', 'default', 'chan', 'map', 'range', 'struct', 'interface', 'type', 'nil'];
    case 'bash':
    case 'sh':
    case 'shell':
      return ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'export', 'source', 'cd', 'ls', 'rm', 'mv', 'cp', 'mkdir', 'cat', 'grep', 'sed', 'awk'];
    default:
      return common;
  }
}

function getTokenStyle(style: string) {
  switch (style) {
    case 'keyword':
      return { color: colors.accent.purple };
    case 'string':
      return { color: colors.accent.green };
    case 'comment':
      return { color: colors.text.muted, fontStyle: 'italic' as const };
    case 'number':
      return { color: colors.accent.orange };
    case 'function':
      return { color: colors.accent.blue };
    default:
      return {};
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    backgroundColor: colors.bg.tertiary,
    color: colors.accent.cyan,
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cursor: {
    color: colors.accent.purple,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  codeBlockContainer: {
    backgroundColor: '#1e1e2e',
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#181825',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  codeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  languageBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  languageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  languageTextPlain: {
    color: colors.text.muted,
    fontSize: 11,
  },
  lineCount: {
    color: colors.text.muted,
    fontSize: 10,
  },
  copyButton: {
    padding: spacing.xs,
  },
  codeContent: {
    padding: spacing.sm,
    minWidth: '100%',
  },
  codeLine: {
    flexDirection: 'row',
    minHeight: 20,
  },
  lineNumber: {
    color: colors.text.muted,
    fontFamily: 'monospace',
    fontSize: 12,
    width: 35,
    textAlign: 'right',
    marginRight: spacing.sm,
    opacity: 0.5,
  },
  codeText: {
    color: colors.text.primary,
    fontFamily: 'monospace',
    fontSize: 13,
    flex: 1,
  },
});
