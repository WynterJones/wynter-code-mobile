import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Match desktop colors exactly
const GRID_COLOR = 'rgba(99, 102, 241, 0.06)';
const SWEEP_COLOR_1 = 'rgba(99, 102, 241, 0.12)';
const SWEEP_COLOR_2 = 'rgba(139, 92, 246, 0.08)';
const LINE_PURPLE = 'rgba(139, 92, 246, 0.6)';
const LINE_WHITE = 'rgba(255, 255, 255, 0.9)';
const LINE_BLUE = 'rgba(99, 102, 241, 0.6)';

interface BlueprintGridProps {
  children?: React.ReactNode;
}

export function BlueprintGrid({ children }: BlueprintGridProps) {
  // Sweep animation progress (0 to 1 over 8 seconds)
  const sweepProgress = useSharedValue(0);
  // Shimmer line progress (0 to 1 over 25 seconds)
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    // Sweep animation: 8 seconds per cycle
    sweepProgress.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1, // infinite
      false // don't reverse
    );

    // Shimmer line: 25 seconds per cycle
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 25000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  // Sweep gradient animated style - just fade in and out
  const sweepStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      sweepProgress.value,
      [0, 0.3, 0.5, 0.7, 1],
      [0, 1, 1, 1, 0]
    );

    return { opacity };
  });

  // Shimmer line animated style
  const shimmerStyle = useAnimatedStyle(() => {
    // Quick shimmer in first 15% of animation
    const translateX = interpolate(
      shimmerProgress.value,
      [0, 0.15, 1],
      [-SCREEN_WIDTH, SCREEN_WIDTH, SCREEN_WIDTH]
    );

    // Opacity: visible from 3% to 12%
    const opacity = interpolate(
      shimmerProgress.value,
      [0, 0.03, 0.12, 0.15, 1],
      [0, 1, 1, 0, 0]
    );

    return {
      transform: [{ translateX }],
      opacity,
    };
  });

  return (
    <View style={styles.container}>
      {/* SVG Grid Pattern */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="grid"
            width={32}
            height={32}
            patternUnits="userSpaceOnUse"
          >
            <Line
              x1={0}
              y1={0}
              x2={0}
              y2={32}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
            <Line
              x1={0}
              y1={0}
              x2={32}
              y2={0}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />
      </Svg>

      {/* Sweep Gradient (behind content) */}
      <Animated.View style={[styles.sweep, sweepStyle]}>
        <LinearGradient
          colors={['transparent', SWEEP_COLOR_1, SWEEP_COLOR_2, 'transparent']}
          locations={[0, 0.3, 0.5, 1]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={styles.sweepGradient}
        />
      </Animated.View>

      {/* Shimmer Line (quick horizontal flash) */}
      <Animated.View style={[styles.shimmerLine, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', LINE_PURPLE, LINE_WHITE, LINE_BLUE, 'transparent']}
          locations={[0, 0.45, 0.5, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.lineGradient}
        />
      </Animated.View>

      {/* Content (above animations) */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: 0,
    height: 250,
  },
  sweepGradient: {
    flex: 1,
  },
  shimmerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    width: SCREEN_WIDTH,
  },
  lineGradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80, // Shift content up slightly
  },
});
