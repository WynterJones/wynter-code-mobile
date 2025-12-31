import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import Animated, {
  SlideInLeft,
  SlideOutLeft,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';

interface MenuItem {
  name: string;
  icon: keyof typeof FontAwesome.glyphMap;
  route: string;
  color?: string;
}

const menuItems: MenuItem[] = [
  { name: 'Farmwork', icon: 'leaf', route: '/farmwork', color: colors.accent.green },
  { name: 'Overwatch', icon: 'eye', route: '/overwatch', color: colors.accent.purple },
  { name: 'Subscriptions', icon: 'credit-card', route: '/subscriptions', color: colors.accent.blue },
  { name: 'Bookmarks', icon: 'bookmark', route: '/bookmarks', color: colors.accent.yellow },
];

export default function MenuScreen() {
  const router = useRouter();
  const { connection } = useConnectionStore();
  const isConnected = connection.status === 'connected';

  const handleClose = () => {
    router.back();
  };

  const handleNavigate = (route: string) => {
    router.back();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        />
      </Pressable>

      {/* Menu Panel */}
      <Animated.View
        entering={SlideInLeft.duration(250)}
        exiting={SlideOutLeft.duration(200)}
        style={styles.menu}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <FontAwesome name="code" size={28} color={colors.accent.purple} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Wynter Code</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? colors.accent.green : colors.accent.red },
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <FontAwesome name="times" size={20} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Tools</Text>

        {/* Menu Items */}
        <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => handleNavigate(item.route)}
            >
              <View style={[styles.iconContainer, { backgroundColor: (item.color || colors.accent.purple) + '20' }]}>
                <FontAwesome
                  name={item.icon}
                  size={18}
                  color={item.color || colors.accent.purple}
                />
              </View>
              <Text style={styles.menuItemText}>{item.name}</Text>
              <FontAwesome name="chevron-right" size={12} color={colors.text.muted} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => {
              handleClose();
              setTimeout(() => router.push('/modal'), 100);
            }}
          >
            <FontAwesome
              name={isConnected ? 'plug' : 'chain-broken'}
              size={16}
              color={colors.text.muted}
            />
            <Text style={styles.footerButtonText}>
              {isConnected ? 'Connection Settings' : 'Connect to Desktop'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menu: {
    width: 280,
    height: '100%',
    backgroundColor: colors.bg.secondary,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  closeButton: {
    padding: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  menuList: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
  },
  footerButtonText: {
    marginLeft: spacing.md,
    fontSize: 14,
    color: colors.text.muted,
  },
});
