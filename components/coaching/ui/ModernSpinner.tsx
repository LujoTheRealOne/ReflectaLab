import React, { useEffect, useRef } from 'react';
import { Animated, ColorSchemeName } from 'react-native';

interface ModernSpinnerProps {
  colorScheme: ColorSchemeName;
  size?: number;
}

export const ModernSpinner = ({ colorScheme, size = 20 }: ModernSpinnerProps) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();
    
    return () => spinAnimation.stop();
  }, [spinValue]);
  
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: colorScheme === 'dark' ? '#666666' : '#CCCCCC',
          borderTopColor: colorScheme === 'dark' ? '#FFFFFF' : '#333333',
          transform: [{ rotate: spin }],
        },
      ]}
    />
  );
};
