import React, { useCallback } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { colors } from '@/src/theme';
import { useConnectionStore, useProjectStore } from '@/src/stores';
import { GlassTabBar } from '@/src/components/GlassTabBar';

const EDGE_WIDTH = 30;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  disabled?: boolean;
}) {
  return (
    <FontAwesome
      size={24}
      style={{ marginBottom: -3, opacity: props.disabled ? 0.3 : 1 }}
      name={props.name}
      color={props.disabled ? colors.text.muted : props.color}
    />
  );
}

function HamburgerButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => !disabled && router.push('/menu')}
      style={{ marginLeft: 16, opacity: disabled ? 0.3 : 1 }}
      disabled={disabled}
    >
      <FontAwesome name="bars" size={22} color={colors.text.primary} />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const connection = useConnectionStore((s) => s.connection);
  const selectedProject = useProjectStore((s) => s.selectedProject);
  const isConnected = connection.status === 'connected';
  const hasProject = selectedProject !== null;
  const isEnabled = isConnected && hasProject;

  const openMenu = useCallback(() => {
    if (isEnabled) {
      router.push('/menu');
    }
  }, [isEnabled, router]);

  const startX = useSharedValue(0);
  const isEdgeSwipe = useSharedValue(false);

  const swipeToOpenDrawer = Gesture.Pan()
    .manualActivation(true)
    .onBegin((e) => {
      startX.value = e.absoluteX;
      isEdgeSwipe.value = e.absoluteX < EDGE_WIDTH;
    })
    .onTouchesMove((e, state) => {
      // Only activate if started from left edge
      if (isEdgeSwipe.value) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onEnd((e) => {
      if (isEdgeSwipe.value && e.translationX > 50) {
        runOnJS(openMenu)();
      }
    });

  return (
    <GestureDetector gesture={swipeToOpenDrawer}>
      <View style={styles.container}>
        <Tabs
          tabBar={(props) => <GlassTabBar {...props} />}
          screenOptions={{
            tabBarActiveTintColor: colors.accent.purple,
            tabBarInactiveTintColor: colors.text.muted,
            tabBarStyle: {
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopColor: 'transparent',
              height: 85,
              paddingBottom: 20,
              paddingTop: 8,
            },
            headerStyle: {
              backgroundColor: colors.bg.secondary,
            },
            headerTintColor: colors.text.primary,
            headerLeft: () => <HamburgerButton disabled={!isEnabled} />,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Projects',
              tabBarIcon: ({ color }) => <TabBarIcon name="folder" color={color} />,
            }}
          />
          <Tabs.Screen
            name="issues"
            options={{
              title: 'Issues',
              tabBarIcon: ({ color }) => (
                <TabBarIcon name="check-square-o" color={color} disabled={!isEnabled} />
              ),
              tabBarLabelStyle: !isEnabled ? { color: colors.text.muted, opacity: 0.3 } : undefined,
            }}
            listeners={{
              tabPress: (e) => {
                if (!isEnabled) {
                  e.preventDefault();
                }
              },
            }}
          />
          <Tabs.Screen
            name="autobuild"
            options={{
              title: 'Auto-Build',
              tabBarIcon: ({ color }) => (
                <TabBarIcon name="bolt" color={color} disabled={!isEnabled} />
              ),
              tabBarLabelStyle: !isEnabled ? { color: colors.text.muted, opacity: 0.3 } : undefined,
            }}
            listeners={{
              tabPress: (e) => {
                if (!isEnabled) {
                  e.preventDefault();
                }
              },
            }}
          />
          <Tabs.Screen
            name="chat"
            options={{
              title: 'Chat',
              tabBarIcon: ({ color }) => (
                <TabBarIcon name="comments" color={color} disabled={!isEnabled} />
              ),
              tabBarLabelStyle: !isEnabled ? { color: colors.text.muted, opacity: 0.3 } : undefined,
            }}
            listeners={{
              tabPress: (e) => {
                if (!isEnabled) {
                  e.preventDefault();
                }
              },
            }}
          />
        </Tabs>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
