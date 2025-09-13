import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, useColorScheme, ViewStyle } from 'react-native';

interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

export default function Skeleton({ style, radius = 8 }: SkeletonProps) {
  const colorScheme = useColorScheme();
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const baseColor = colorScheme === 'dark' ? '#232323' : '#EDEDED';

  return (
    <Animated.View
      style={[
        styles.base,
        { opacity, backgroundColor: baseColor, borderRadius: radius },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});


