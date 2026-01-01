import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing } from '@/src/theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <BlurView intensity={60} tint="dark" style={styles.container}>
      <View style={styles.innerBorder}>
        <View style={styles.tabsContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

            const isFocused = state.index === index;
            const tabBarIcon = options.tabBarIcon;

            // Check if disabled via tabBarLabelStyle opacity
            const isDisabled = typeof options.tabBarLabelStyle === 'object' &&
              options.tabBarLabelStyle !== null &&
              'opacity' in options.tabBarLabelStyle;

            const onPress = () => {
              if (isDisabled) return;

              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            };

            return (
              <GlassTabItem
                key={route.key}
                label={typeof label === 'string' ? label : route.name}
                isFocused={isFocused}
                isDisabled={isDisabled}
                tabBarIcon={tabBarIcon}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>
    </BlurView>
  );
}

interface GlassTabItemProps {
  label: string;
  isFocused: boolean;
  isDisabled: boolean;
  tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  onPress: () => void;
}

function GlassTabItem({ label, isFocused, isDisabled, tabBarIcon, onPress }: GlassTabItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const color = isDisabled
    ? colors.text.muted
    : isFocused
      ? colors.accent.purple
      : colors.text.secondary;

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tabItem, animatedStyle]}
      activeOpacity={1}
      disabled={isDisabled}
    >
      {isFocused && <View style={styles.activeIndicator} />}
      <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
        {tabBarIcon ? (
          tabBarIcon({ focused: isFocused, color, size: 22 })
        ) : (
          <FontAwesome name="circle" size={22} color={color} />
        )}
      </View>
      <Text style={[
        styles.label,
        { color },
        isDisabled && styles.labelDisabled,
      ]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors.accent.purple + '20',
    overflow: 'hidden',
  },
  innerBorder: {
    backgroundColor: colors.bg.primary + '40',
    paddingTop: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingBottom: 20,
    paddingTop: 8,
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    backgroundColor: colors.accent.purple,
    borderRadius: 2,
  },
  iconWrapper: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 2,
  },
  iconWrapperActive: {
    backgroundColor: colors.accent.purple + '15',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  labelDisabled: {
    opacity: 0.3,
  },
});
