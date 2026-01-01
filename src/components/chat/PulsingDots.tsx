import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '@/src/theme';

export function PulsingDots() {
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let isMounted = true;

    const animate = (value: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      );
    };

    const anim1 = animate(opacity1, 0);
    const anim2 = animate(opacity2, 150);
    const anim3 = animate(opacity3, 300);

    if (isMounted) {
      anim1.start();
      anim2.start();
      anim3.start();
    }

    return () => {
      isMounted = false;
      anim1.stop();
      anim2.stop();
      anim3.stop();
      // Reset values to prevent memory leaks
      opacity1.setValue(0.3);
      opacity2.setValue(0.3);
      opacity3.setValue(0.3);
    };
  }, [opacity1, opacity2, opacity3]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { opacity: opacity1 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity2 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
  },
});
