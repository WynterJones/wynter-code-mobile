import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { FontAwesome } from '@expo/vector-icons';
import { colors } from '@/src/theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type IconName = React.ComponentProps<typeof FontAwesome>['name'];

interface GlassButtonProps {
  onPress: () => void;
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export function GlassButton({
  onPress,
  label,
  icon,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
  labelStyle,
}: GlassButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 400,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const variantColors = getVariantColors(variant);
  const sizeConfig = getSizeConfig(size);

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={disabled}
      style={[styles.touchable, animatedStyle, style, disabled && styles.disabled]}
    >
      <BlurView
        intensity={60}
        tint="dark"
        style={[
          styles.blur,
          {
            borderRadius: sizeConfig.borderRadius,
            borderColor: variantColors.border,
          },
        ]}
      >
        <View
          style={[
            styles.content,
            {
              backgroundColor: variantColors.background,
              paddingHorizontal: sizeConfig.paddingH,
              paddingVertical: sizeConfig.paddingV,
            },
          ]}
        >
          {icon && (
            <FontAwesome
              name={icon}
              size={sizeConfig.iconSize}
              color={variantColors.text}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.label,
              { fontSize: sizeConfig.fontSize, color: variantColors.text },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      </BlurView>
    </AnimatedTouchable>
  );
}

function getVariantColors(variant: 'primary' | 'secondary' | 'danger') {
  switch (variant) {
    case 'primary':
      return {
        border: colors.accent.purple + '50',
        background: colors.accent.purple + '20',
        text: colors.accent.purple,
      };
    case 'secondary':
      return {
        border: colors.text.secondary + '40',
        background: colors.text.secondary + '15',
        text: colors.text.secondary,
      };
    case 'danger':
      return {
        border: colors.accent.red + '50',
        background: colors.accent.red + '20',
        text: colors.accent.red,
      };
  }
}

function getSizeConfig(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return {
        paddingH: 16,
        paddingV: 10,
        borderRadius: 10,
        fontSize: 14,
        iconSize: 14,
      };
    case 'medium':
      return {
        paddingH: 24,
        paddingV: 14,
        borderRadius: 12,
        fontSize: 16,
        iconSize: 16,
      };
    case 'large':
      return {
        paddingH: 32,
        paddingV: 16,
        borderRadius: 14,
        fontSize: 17,
        iconSize: 18,
      };
  }
}

const styles = StyleSheet.create({
  touchable: {
    alignSelf: 'center',
  },
  blur: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 10,
  },
  label: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
