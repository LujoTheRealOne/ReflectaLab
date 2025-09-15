import React, { useEffect, useRef, memo } from 'react';
import { View, Animated, ColorSchemeName, StyleSheet } from 'react-native';

interface SpinningAnimationProps {
  colorScheme: ColorSchemeName;
}

export const SpinningAnimation = memo(({ colorScheme }: SpinningAnimationProps) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true
      })
    );
    
    spinAnimation.start();
    
    return () => {
      spinAnimation.stop();
    };
  }, [spinValue]);
  
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  return (
    <View style={styles.loadingSpinner}>
      <Animated.View 
        style={[
          styles.spinner,
          { 
            backgroundColor: colorScheme === 'dark' ? '#666666' : '#333333',
            transform: [{ rotate: spin }]
          }
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
