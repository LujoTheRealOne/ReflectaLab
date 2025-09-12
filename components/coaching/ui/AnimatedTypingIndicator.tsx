import React, { useEffect, useRef } from 'react';
import { View, Animated, ColorSchemeName, StyleSheet } from 'react-native';

interface AnimatedTypingIndicatorProps {
  colorScheme: ColorSchemeName;
}

export const AnimatedTypingIndicator = ({ colorScheme }: AnimatedTypingIndicatorProps) => {
  const dot1Animation = useRef(new Animated.Value(0)).current;
  const dot2Animation = useRef(new Animated.Value(0)).current;
  const dot3Animation = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Create individual animations for each dot
    const animation1 = Animated.loop(
      Animated.sequence([
        Animated.timing(dot1Animation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true
        }),
        Animated.timing(dot1Animation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true
        })
      ])
    );

    const animation2 = Animated.loop(
      Animated.sequence([
        Animated.timing(dot2Animation, {
          toValue: 1,
          duration: 600,
          delay: 200,
          useNativeDriver: true
        }),
        Animated.timing(dot2Animation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true
        })
      ])
    );

    const animation3 = Animated.loop(
      Animated.sequence([
        Animated.timing(dot3Animation, {
          toValue: 1,
          duration: 600,
          delay: 400,
          useNativeDriver: true
        }),
        Animated.timing(dot3Animation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true
        })
      ])
    );

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1Animation, dot2Animation, dot3Animation]);

  const dot1Opacity = dot1Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1]
  });

  const dot2Opacity = dot2Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1]
  });

  const dot3Opacity = dot3Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1]
  });

  return (
    <View style={styles.typingIndicator}>
      <Animated.View 
        style={[
          styles.typingDot, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#888888' : '#333333',
            opacity: dot1Opacity
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.typingDot, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#888888' : '#333333',
            opacity: dot2Opacity
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.typingDot, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#888888' : '#333333',
            opacity: dot3Opacity
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
});
