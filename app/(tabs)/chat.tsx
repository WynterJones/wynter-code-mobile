import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useMobileChatStore } from '@/src/stores';
import { useIsConnected } from '@/src/api/hooks';
import { BlueprintGrid } from '@/src/components/BlueprintGrid';
import { GlassButton } from '@/src/components/GlassButton';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import {
  SessionCard,
  MobileChatView,
  NewChatModal,
} from '@/src/components/chat';

function ChatScreenContent() {
  const router = useRouter();
  const isConnected = useIsConnected();
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

  if (!isConnected) {
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
});

export default function ChatScreen() {
  return (
    <ScreenErrorBoundary screenName="Chat" showGoBack={false}>
      <ChatScreenContent />
    </ScreenErrorBoundary>
  );
}
