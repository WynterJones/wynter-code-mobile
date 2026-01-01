import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';

interface LinkItem {
  title: string;
  subtitle: string;
  url: string;
  icon: keyof typeof FontAwesome.glyphMap;
  color: string;
}

const links: LinkItem[] = [
  {
    title: 'Wynter Code',
    subtitle: 'Desktop application for Mac',
    url: 'https://code.wynter.ai',
    icon: 'desktop',
    color: colors.accent.purple,
  },
  {
    title: 'Farmwork',
    subtitle: 'Get the best out of your workflow',
    url: 'https://farmwork.dev',
    icon: 'leaf',
    color: colors.accent.green,
  },
];

export default function AboutScreen() {
  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'About',
          headerStyle: { backgroundColor: colors.bg.primary },
          headerTintColor: colors.text.primary,
          headerBackTitle: 'Home',
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* App Icon and Name */}
        <View style={styles.heroSection}>
          <View style={styles.iconWrapper}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>Wynter Code Mobile</Text>
          <Text style={styles.version}>Companion App</Text>
        </View>

        {/* Description Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome name="info-circle" size={20} color={colors.accent.cyan} />
            <Text style={styles.cardTitle}>How It Works</Text>
          </View>
          <Text style={styles.description}>
            Wynter Code Mobile connects to your Wynter Code desktop application over your local network.
            Run chat sessions, monitor builds, and access the most important features right from your phone.
          </Text>
          <View style={styles.requirementBox}>
            <FontAwesome name="desktop" size={16} color={colors.accent.purple} />
            <Text style={styles.requirementText}>
              Requires Wynter Code desktop app running on your Mac
            </Text>
          </View>
        </View>

        {/* Links Section */}
        <Text style={styles.sectionTitle}>Resources</Text>
        {links.map((link) => (
          <TouchableOpacity
            key={link.url}
            style={styles.linkCard}
            onPress={() => handleOpenLink(link.url)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconContainer, { backgroundColor: link.color + '20' }]}>
              <FontAwesome name={link.icon} size={20} color={link.color} />
            </View>
            <View style={styles.linkContent}>
              <Text style={styles.linkTitle}>{link.title}</Text>
              <Text style={styles.linkSubtitle}>{link.subtitle}</Text>
            </View>
            <FontAwesome name="external-link" size={14} color={colors.text.muted} />
          </TouchableOpacity>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with care for developers</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  appIcon: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  version: {
    fontSize: 14,
    color: colors.text.muted,
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  requirementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purple + '30',
  },
  requirementText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  linkIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  linkSubtitle: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    fontSize: 13,
    color: colors.text.muted,
  },
});
