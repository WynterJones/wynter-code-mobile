import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';

import { colors } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';

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
  const connection = useConnectionStore((s) => s.connection);
  const isConnected = connection.status === 'connected';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent.purple,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border,
          height: 85,
          paddingBottom: 20,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: colors.bg.secondary,
        },
        headerTintColor: colors.text.primary,
        headerLeft: () => <HamburgerButton disabled={!isConnected} />,
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
            <TabBarIcon name="check-square-o" color={color} disabled={!isConnected} />
          ),
          tabBarLabelStyle: !isConnected ? { color: colors.text.muted, opacity: 0.3 } : undefined,
        }}
        listeners={{
          tabPress: (e) => {
            if (!isConnected) {
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
            <TabBarIcon name="bolt" color={color} disabled={!isConnected} />
          ),
          tabBarLabelStyle: !isConnected ? { color: colors.text.muted, opacity: 0.3 } : undefined,
        }}
        listeners={{
          tabPress: (e) => {
            if (!isConnected) {
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
            <TabBarIcon name="comments" color={color} disabled={!isConnected} />
          ),
          tabBarLabelStyle: !isConnected ? { color: colors.text.muted, opacity: 0.3 } : undefined,
        }}
        listeners={{
          tabPress: (e) => {
            if (!isConnected) {
              e.preventDefault();
            }
          },
        }}
      />
    </Tabs>
  );
}
