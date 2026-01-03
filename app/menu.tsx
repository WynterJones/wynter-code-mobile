import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import Animated, {
  SlideInLeft,
  SlideOutLeft,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore, useProjectStore } from '@/src/stores';
import { checkFarmworkInstalled, queryKeys } from '@/src/api/client';

interface MenuItem {
  name: string;
  icon: keyof typeof FontAwesome.glyphMap;
  route: string;
  color?: string;
  subtitle?: string;
  disabled?: boolean;
  loading?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function MenuScreen() {
  const router = useRouter();
  const { connection } = useConnectionStore();
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const isConnected = connection.status === 'connected';

  // Check if farmwork is installed for the selected project
  const { data: farmworkStatus, isLoading: farmworkLoading } = useQuery({
    queryKey: queryKeys.farmworkCheck(selectedProject?.path || ''),
    queryFn: () => checkFarmworkInstalled(selectedProject!.path),
    enabled: isConnected && !!selectedProject?.path,
    staleTime: 60000,
  });

  // Build menu sections with dynamic farmwork item
  const menuSections = useMemo((): MenuSection[] => {
    const farmworkItem: MenuItem = farmworkStatus?.installed
      ? {
          name: 'Farmwork',
          icon: 'leaf',
          route: '/farmwork',
          color: colors.accent.green,
        }
      : {
          name: 'Install Farmwork',
          icon: 'leaf',
          route: '/farmwork-install',
          color: colors.accent.green,
          subtitle: selectedProject ? 'Set up for this project' : 'Select a project first',
          disabled: !selectedProject,
          loading: farmworkLoading,
        };

    return [
      {
        title: 'Manage',
        items: [
          { name: 'New Project', icon: 'plus-circle', route: '/new-project', color: colors.accent.green },
          { name: 'Workspaces', icon: 'th-large', route: '/workspace-board', color: colors.accent.purple },
          { name: 'The Board', icon: 'columns', route: '/board', color: colors.accent.cyan },
          { name: 'Docs', icon: 'file-text-o', route: '/docs', color: colors.text.muted },
          farmworkItem,
        ],
      },
      {
        title: 'Tools',
        items: [
          { name: 'Live Preview', icon: 'play-circle', route: '/live-preview', color: colors.accent.cyan },
          { name: 'Netlify Deploy', icon: 'cloud-upload', route: '/netlify-deploy', color: colors.accent.blue },
        ],
      },
      {
        title: 'Observe',
        items: [
          { name: 'Overwatch', icon: 'eye', route: '/overwatch', color: colors.accent.purple },
          { name: 'Subscriptions', icon: 'credit-card', route: '/subscriptions', color: colors.accent.orange },
          { name: 'Bookmarks', icon: 'bookmark', route: '/bookmarks', color: colors.accent.yellow },
        ],
      },
      {
        title: '',
        items: [
          { name: 'About', icon: 'info-circle', route: '/about', color: colors.text.muted },
        ],
      },
    ];
  }, [farmworkStatus, selectedProject, farmworkLoading]);

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
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
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

        {/* Menu Sections */}
        <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
          {menuSections.map((section, sectionIndex) => (
            <View key={section.title}>
              <Text style={[styles.sectionTitle, sectionIndex > 0 && styles.sectionTitleSpaced]}>
                {section.title}
              </Text>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
                  onPress={() => !item.disabled && handleNavigate(item.route)}
                  disabled={item.disabled}
                >
                  <View style={[styles.iconContainer, { backgroundColor: (item.color || colors.accent.purple) + '20' }]}>
                    {item.loading ? (
                      <ActivityIndicator size="small" color={item.color || colors.accent.purple} />
                    ) : (
                      <FontAwesome
                        name={item.icon}
                        size={18}
                        color={item.disabled ? colors.text.muted : (item.color || colors.accent.purple)}
                      />
                    )}
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={[styles.menuItemText, item.disabled && styles.menuItemTextDisabled]}>
                      {item.name}
                    </Text>
                    {item.subtitle && (
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                  <FontAwesome name="chevron-right" size={12} color={colors.text.muted} />
                </TouchableOpacity>
              ))}
            </View>
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
    width: '90%',
    height: '100%',
    backgroundColor: colors.bg.secondary,
    paddingTop: 60,
    borderRightWidth: 1,
    borderRightColor: colors.border,
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
    overflow: 'hidden',
  },
  logoImage: {
    width: 40,
    height: 40,
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
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitleSpaced: {
    paddingTop: spacing.lg,
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
  menuItemContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  menuItemTextDisabled: {
    color: colors.text.muted,
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  menuItemDisabled: {
    opacity: 0.6,
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
    borderWidth: 1,
    borderColor: colors.accent.purple + '50',
  },
  footerButtonText: {
    marginLeft: spacing.md,
    fontSize: 14,
    color: colors.text.muted,
  },
});
